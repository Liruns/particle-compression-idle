/**
 * audio/engine — 절차적 WebAudio 재생기(에셋 0). voices.ts의 VoiceSpec을 실제 소리로.
 *
 *  브라우저 자동재생 정책: AudioContext는 사용자 제스처 후에만 소리를 낸다. → 첫 포인터/키에서 unlock().
 *  unlock 전 발행되는 부팅/로드 이벤트(오프라인 복귀·초기 도감 발견 등)는 자연히 무음(ctx=null).
 *
 *  체인: 각 보이스 osc → gain(envelope) → master(volume) → compressor(리미터) → destination.
 *  master 하나로 mute/volume 일괄 제어. compressor로 화음 겹침 시 클리핑 방지(§audio 절제).
 *
 *  ★로직 0 간섭: 오직 이벤트 버스 구독(읽기). 게임 상태를 만지지 않는다.
 */

import type { EventBus } from '../events';
import { voiceForEvent, type VoiceSpec } from './voices';

/** 이벤트 이름 → 최소 throttle 간격(ms). 자동/연타 이벤트가 소리를 도배하지 않도록. */
const MIN_INTERVAL_MS: Record<string, number> = {
  manual_compress: 55, // 드래그 쓸어담기 연타 — 초당 ~18회 상한
  resonance_slot_open: 400,
  codexDiscover: 90, // 층 진입 시 동시 발견 다발 — 아르페지오처럼 벌린다
  chain_purchased: 40,
  phase_cycled: 100000, // 사실상 무음(voices도 빈 배열이지만 이중 가드)
};

/** 동시 발음 상한(과도 폴리포니 방지 — CPU/청감 보호). */
const MAX_VOICES = 24;

export interface AudioEngineOptions {
  /** 현재 층 인덱스 공급자(음역 결정). 스냅샷 접근을 엔진 밖에 둔다(결합 최소). */
  getLayerIndex: () => number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private muted = false;
  private volume = 0.7;
  private activeVoices = 0;
  private lastAt: Record<string, number> = {};
  private readonly getLayerIndex: () => number;
  private unsubs: (() => void)[] = [];

  constructor(opts: AudioEngineOptions) {
    this.getLayerIndex = opts.getLayerIndex;
  }

  /** 사용자 제스처에서 호출 — AudioContext 생성/재개. 브라우저 자동재생 정책 충족. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // WebAudio 미지원 — 무음 게임(기능 저하지 크래시 아님).
    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
      } catch {
        this.ctx = null;
        return;
      }
      this.comp = this.ctx.createDynamicsCompressor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.comp);
      this.comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  /** 이벤트 버스 구독 — 소리를 내는 이벤트만(voices.ts가 빈 배열이면 무음). 반환: 해제 함수. */
  bind(bus: EventBus): () => void {
    const names = [
      'manual_compress',
      'chain_purchased',
      'resonance_click',
      'resonance_slot_open',
      'phase_pinned',
      'phase_unpinned',
      'phase_pin_failed',
      'buy_failed',
      'harmonic_resonance',
      'research_purchased',
      'layerEnter',
      'layerEnter',
      'prestige_ready',
      'prestige',
      'offlineApplied',
    ] as const;
    for (const name of names) {
      // 타입 소거: 엔진은 페이로드를 Record로만 다룬다(voices가 필드 안전 추출).
      const off = (bus as unknown as {
        on: (n: string, cb: (p: Record<string, unknown>) => void) => () => void;
      }).on(name, (payload) => this.cue(name, payload ?? {}));
      this.unsubs.push(off);
    }
    return () => this.dispose();
  }

  /**
   * 이벤트 큐잉(공개) — throttle 통과 시 voices 계산 → 재생. bus 자동구독 + 직접 호출 공용.
   *  codexDiscover는 rarity(legendary)를 App만 알기에 자동구독에서 빼고 App이 직접 cue한다.
   */
  cue(name: string, payload: Record<string, unknown>): void {
    if (!this.ctx || !this.master || this.muted || this.volume <= 0) return;
    const now = performance.now();
    const min = MIN_INTERVAL_MS[name];
    if (min != null) {
      const last = this.lastAt[name] ?? -Infinity;
      if (now - last < min) return;
      this.lastAt[name] = now;
    }
    const voices = voiceForEvent(name, payload, { layerIndex: this.getLayerIndex() });
    for (const v of voices) this.playVoice(v);
  }

  /** 단일 보이스 재생 — osc + 게인 envelope(선형 어택 / 지수 감쇠). */
  private playVoice(v: VoiceSpec): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (this.activeVoices >= MAX_VOICES) return;

    const t0 = ctx.currentTime + (v.delay ?? 0);
    const attack = v.attack ?? 0.005;
    const dur = v.dur;
    const peak = v.gain;

    const osc = ctx.createOscillator();
    osc.type = v.wave;
    osc.frequency.setValueAtTime(v.freq, t0);
    if (v.glideTo != null && v.glideTo > 0) {
      osc.frequency.exponentialRampToValueAtTime(v.glideTo, t0 + dur * 0.9);
    }
    if (v.detune) osc.detune.setValueAtTime(v.detune, t0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    // 지수 감쇠(자연스러운 꼬리) — 0으로 못 가므로 아주 작은 값까지.
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(master);

    this.activeVoices++;
    osc.onended = () => {
      this.activeVoices--;
      g.disconnect();
      osc.disconnect();
    };
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** 구독 해제 + 컨텍스트 종료(누수 방지). */
  dispose(): void {
    for (const off of this.unsubs) off();
    this.unsubs = [];
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
      this.master = null;
      this.comp = null;
    }
  }
}
