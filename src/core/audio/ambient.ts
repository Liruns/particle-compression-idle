/**
 * audio/ambient — 층별 앰비언트 사운드스케이프(사운드 2차). 절차적(에셋 0) 드론 + 필터 노이즈.
 *
 *  audio-design §0·§1: "작아질수록 소리가 사라진다." 분자층=따뜻한 저역 웅성임(넓은 노이즈 베드 + 낮은 드론),
 *   깊을수록 음역↑·밀도↓·공간↓ → 플랑크층=협대역 초고역 점(거의 무향). 층 색온도 아크의 청각 짝.
 *
 *  ★로직·경제 0 간섭 — 표현 전용. 파라미터 매핑(`ambientParams`)은 순수(테스트), 실제 노드 wiring은
 *   AmbientBed가 담당(브라우저 검증). 마스터 게인 아래에 물려 mute/volume이 그대로 적용된다.
 */

import { layerBaseFreq } from './voices';

/** 층 → 앰비언트 파라미터(순수). 깊이 t=(index-1)/10 로 웜↔쿨 아크를 보간. */
export interface AmbientParams {
  /** 드론 기음(Hz) — 깊을수록 상승(작아짐=음고↑). */
  droneHz: number;
  /** 드론 게인(몸통) — 깊을수록 얇아짐. */
  droneGain: number;
  /** 노이즈 베드 게인(공기/매질) — 깊을수록 거의 사라짐(무향 접근). */
  noiseGain: number;
  /** 로우패스 컷오프(Hz) — 깊을수록 밝은 점(협대역 초고역). */
  cutoffHz: number;
  /** 드론 디튠(cents) — 웜 층의 코러스감, 깊을수록 0(순음). */
  detune: number;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 층 인덱스(1..11) → 앰비언트 파라미터. 웜(분자)→쿨(플랑크) 단조 보간.
 *  드론 음고 상승 / 노이즈·몸통 감소 / 컷오프 상승(밝은 점) / 디튠 감소 = §1 4축(음역·밀도·공간·질감).
 */
export function ambientParams(layerIndex: number): AmbientParams {
  const t = clamp01((Math.round(layerIndex) - 1) / 10);
  return {
    droneHz: layerBaseFreq(layerIndex) / 4, // 저역 토대(기음의 2옥타브 아래)
    droneGain: lerp(0.9, 0.32, t),
    noiseGain: lerp(1.0, 0.04, t), // 매질 소멸 → 플랑크 거의 침묵
    cutoffHz: lerp(900, 5200, t), // 웜=저역 웅성임, 딥=밝은 협대역 점
    detune: lerp(6, 0, t),
  };
}

/** 앰비언트 마스터 스케일(전체가 아주 조용 — 침묵 기반 §2). */
const AMBIENT_LEVEL = 0.09;
/** 파라미터 전이 시간(초) — 층 하강 시 부드러운 크로스페이드(플래시 금지 정신). */
const GLIDE_SEC = 1.6;

/**
 * AmbientBed — 지속 재생 노드 묶음. drone(루트+5도) + 필터 노이즈 → ambientGain → master.
 *  start()로 켜고 setLayer()로 파라미터를 부드럽게 재타겟, setEnabled/setVolume로 게이팅.
 */
export class AmbientBed {
  private readonly ctx: AudioContext;
  private readonly out: GainNode; // master로 향하는 앰비언트 서브게인(enable/level)
  private started = false;
  private enabled = true;
  private droneA: OscillatorNode | null = null;
  private droneB: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private noiseSrc: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0; // 시작 무음 → start 시 페이드 인
    this.out.connect(destination);
  }

  /** 노드 구성 + 첫 층 파라미터로 재생 시작(idempotent). */
  start(layerIndex: number): void {
    if (this.started) return;
    this.started = true;
    const ctx = this.ctx;
    const p = ambientParams(layerIndex);

    // 공유 로우패스 필터.
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = p.cutoffHz;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.out);

    // 드론 2기(루트 + 완전5도) — 얇은 화음 몸통.
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = p.droneGain * 0.5;
    this.droneGain.connect(this.filter);
    this.droneA = ctx.createOscillator();
    this.droneA.type = 'sine';
    this.droneA.frequency.value = p.droneHz;
    this.droneA.detune.value = -p.detune;
    this.droneB = ctx.createOscillator();
    this.droneB.type = 'sine';
    this.droneB.frequency.value = p.droneHz * 1.5; // 완전5도
    this.droneB.detune.value = p.detune;
    this.droneA.connect(this.droneGain);
    this.droneB.connect(this.droneGain);

    // 노이즈 베드(매질/공기) — 2초 화이트 노이즈 루프.
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = p.noiseGain * 0.06;
    this.noiseGain.connect(this.filter);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseSrc = ctx.createBufferSource();
    this.noiseSrc.buffer = buf;
    this.noiseSrc.loop = true;
    this.noiseSrc.connect(this.noiseGain);

    this.droneA.start();
    this.droneB.start();
    this.noiseSrc.start();

    // 페이드 인(활성 시).
    this.applyOut();
  }

  /** 층 변경 시 파라미터 부드럽게 재타겟(크로스페이드). */
  setLayer(layerIndex: number): void {
    if (!this.started || !this.ctx) return;
    const p = ambientParams(layerIndex);
    const t0 = this.ctx.currentTime;
    const glide = (param: AudioParam, v: number) => param.setTargetAtTime(v, t0, GLIDE_SEC / 3);
    if (this.filter) glide(this.filter.frequency, p.cutoffHz);
    if (this.droneGain) glide(this.droneGain.gain, p.droneGain * 0.5);
    if (this.noiseGain) glide(this.noiseGain.gain, p.noiseGain * 0.06);
    if (this.droneA) {
      glide(this.droneA.frequency, p.droneHz);
      this.droneA.detune.setTargetAtTime(-p.detune, t0, GLIDE_SEC / 3);
    }
    if (this.droneB) {
      glide(this.droneB.frequency, p.droneHz * 1.5);
      this.droneB.detune.setTargetAtTime(p.detune, t0, GLIDE_SEC / 3);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyOut();
  }

  /** 앰비언트 서브게인 적용(활성 시 AMBIENT_LEVEL, 비활성 시 0 — 부드럽게). */
  private applyOut(): void {
    if (!this.started) return;
    this.out.gain.setTargetAtTime(this.enabled ? AMBIENT_LEVEL : 0, this.ctx.currentTime, 0.4);
  }

  dispose(): void {
    try {
      this.droneA?.stop();
      this.droneB?.stop();
      this.noiseSrc?.stop();
    } catch {
      // 이미 정지/미시작 — 무시.
    }
    this.droneA?.disconnect();
    this.droneB?.disconnect();
    this.noiseSrc?.disconnect();
    this.droneGain?.disconnect();
    this.noiseGain?.disconnect();
    this.filter?.disconnect();
    this.out.disconnect();
    this.started = false;
  }
}
