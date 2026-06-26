/**
 * render/CanvasRenderer — Renderer 계약 구현체(m2-render-plan §9·V2). 표현 레이어 전담.
 *  두 캔버스(배경 fx / 게이지 글로우)의 2D context를 소유하고, snapshot 파생(읽기 전용)만 읽어
 *  헤이즈·파티클·게이지 본체+글로우를 합성한다. 호출자(App subscribe 콜백) 무관 — draw는 읽기전용.
 *
 *  와이어링(V2-4): App subscribe(s) 콜백에서 setSnapshot(s) → draw() 연달아. 자체 rAF 없음.
 *  읽기전용 규율(V2-7): snapshot에서 dec(number)·rateCLog10(number)·rateCPositive(bool)·layer.slug(string)만.
 *   live discovered(Set)·Decimal(C/rateC/r/mult) 직접 접근 금지(결정성·세이브 보호).
 *  프레임당 추가 힙 할당 0(풀·타일·gradient 사전할당/재사용 — V2-5).
 */
import type { Renderer } from './index';
import { ColorCache } from './color';
import { Glow } from './glow';
import { Haze } from './haze';
import { ParticleSystem } from './particles';
import { visualFor, RENDER_TOKEN_KEYS, type LayerVisual } from './layer-visuals';

/** 렌더러가 읽는 snapshot 부분집합(읽기 전용 — Decimal/Set 미포함). 결합 최소화. */
export interface RenderInput {
  dec: number;
  rateCPositive: boolean;
  rateCLog10: number;
  layer: { slug: string };
  /** L6 위상 신호(regen). 없으면 빈 문자열. */
  phaseState?: string;
}

/** 게이지 프레임 반경 기본(CSS px). 캔버스 크기에서 산출하지만 하한 보장. */
const DEFAULT_R_FRAME_MARGIN = 6; // 가장자리 여백(px)

export class CanvasRenderer implements Renderer {
  // 배경 fx 캔버스(헤이즈 + 파티클).
  private bgCtx: CanvasRenderingContext2D | null;
  private bgCanvas: HTMLCanvasElement | null;
  // 게이지 글로우 캔버스(본체 + 글로우).
  private glowCtx: CanvasRenderingContext2D | null;
  private glowCanvas: HTMLCanvasElement | null;

  private colors: ColorCache;
  private glow: Glow;
  private haze: Haze;
  private particles: ParticleSystem;

  private currentVisual: LayerVisual = visualFor('mol');
  private input: RenderInput | null = null;
  private reducedMotion = false;

  // 시간(앰비언트 모션 자체 적분 — 로직 tick 무관). dt 클램프(복귀 점프 방지 V2-6).
  private lastTime = -1;
  private dpr = 1;

  // 배경 캔버스 CSS 크기(리사이즈 시 갱신).
  private bgW = 0;
  private bgH = 0;
  // 글로우 캔버스 CSS 크기.
  private glowW = 0;
  private glowH = 0;

  // dpr 변경 감지 matchMedia(dispose에서 해제).
  private dprMql: MediaQueryList | null = null;
  private onDprChange: (() => void) | null = null;

  constructor(opts: {
    bgCanvas: HTMLCanvasElement | null;
    glowCanvas: HTMLCanvasElement | null;
    rootEl?: HTMLElement | null;
  }) {
    this.bgCanvas = opts.bgCanvas;
    this.glowCanvas = opts.glowCanvas;
    this.bgCtx = opts.bgCanvas?.getContext('2d') ?? null;
    this.glowCtx = opts.glowCanvas?.getContext('2d') ?? null;

    this.colors = new ColorCache(opts.rootEl);
    this.glow = new Glow(this.colors);
    this.haze = new Haze();
    this.particles = new ParticleSystem();

    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    // 색 캐시 초기 읽기 + 초기 층(mol) 설정.
    this.colors.read(RENDER_TOKEN_KEYS);
    this.applyLayer('mol');
    this.resize(); // 초기 백버퍼 설정(0이면 스킵)

    // dpr 변경(모니터 이동) → 백버퍼 재설정. (V2-7 M6)
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.dprMql = window.matchMedia(`(resolution: ${this.dpr}dppx)`);
      this.onDprChange = () => {
        const next = window.devicePixelRatio || 1;
        if (next !== this.dpr) {
          this.dpr = next;
          this.resize();
        }
      };
      if (typeof this.dprMql.addEventListener === 'function') {
        this.dprMql.addEventListener('change', this.onDprChange);
      }
    }
  }

  /** 현재 슬라이스의 canvas 컨텍스트가 하나라도 살아있는지(폴백 판정용). */
  get ready(): boolean {
    return this.bgCtx != null || this.glowCtx != null;
  }

  /** App이 subscribe 콜백에서 호출 — 최신 snapshot 파생을 주입(읽기 전용 복사 불필요, 즉시 draw). */
  setSnapshot(input: RenderInput): void {
    this.input = input;
  }

  /** reduced-motion 토글(스토어 구독 → App에서 주입). */
  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }

  /** 층 전환(slug 변화 시 App에서 호출). config 교체 + 색 캐시 재읽기 + 서브시스템 재설정. */
  onLayerChange(layerSlug: string): void {
    this.applyLayer(layerSlug);
  }

  private applyLayer(slug: string): void {
    this.currentVisual = visualFor(slug);
    // 색 캐시 재읽기(data-layer가 이미 바뀐 상태 가정 — App이 setProperty 후 호출).
    this.colors.read(RENDER_TOKEN_KEYS);
    this.glow.onLayerChange(this.currentVisual.glowBlend);
    // 헤이즈·파티클 config 적용(색은 토큰 캐시에서).
    const hazeCfg = this.currentVisual.haze;
    this.haze.setConfig(
      hazeCfg,
      hazeCfg ? this.colors.get(hazeCfg.colorToken) : { r: 139, g: 195, b: 74 },
    );
    const pCfg = this.currentVisual.particles;
    this.particles.setConfig(
      pCfg,
      pCfg ? this.colors.get(pCfg.colorToken) : { r: 139, g: 195, b: 74 },
    );
    this.particles.setSize(this.bgW, this.bgH);
  }

  /**
   * 리사이즈·DPI 재설정. 백버퍼 = CSS크기 × dpr, setTransform(dpr)로 스케일.
   *  width/height ≤ 0(탭 전환·display:none)면 그 캔버스만 스킵(NaN 반경 throw 방지 V2-7 M6).
   *  백버퍼 재할당은 여기서만(매 프레임 아님).
   */
  resize(): void {
    // 배경 캔버스.
    if (this.bgCanvas && this.bgCtx) {
      const rect = this.bgCanvas.getBoundingClientRect();
      const w = rect.width || this.bgCanvas.clientWidth;
      const h = rect.height || this.bgCanvas.clientHeight;
      if (w > 0 && h > 0) {
        this.bgW = w;
        this.bgH = h;
        this.bgCanvas.width = Math.round(w * this.dpr);
        this.bgCanvas.height = Math.round(h * this.dpr);
        this.bgCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.particles.setSize(w, h);
      }
    }
    // 글로우 캔버스.
    if (this.glowCanvas && this.glowCtx) {
      const rect = this.glowCanvas.getBoundingClientRect();
      const w = rect.width || this.glowCanvas.clientWidth;
      const h = rect.height || this.glowCanvas.clientHeight;
      if (w > 0 && h > 0) {
        this.glowW = w;
        this.glowH = h;
        this.glowCanvas.width = Math.round(w * this.dpr);
        this.glowCanvas.height = Math.round(h * this.dpr);
        this.glowCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      }
    }
  }

  /**
   * Renderer 계약. alpha는 이 슬라이스 미사용(앰비언트 — §2.3). 내부 시간 delta로 모션 적분.
   *  읽기 전용: input 파생만 읽는다.
   */
  draw(_alpha = 1): void {
    const input = this.input;
    if (!input) return;

    // dt 계산(클램프 — 백그라운드 복귀 점프 방지 V2-6: dt=min(realDt,0.1)).
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let dt = this.lastTime < 0 ? 0 : (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt < 0) dt = 0;
    if (dt > 0.1) dt = 0.1;

    this.drawBackground(input, dt);
    this.drawGauge(input, now, dt);
  }

  /** 배경 fx: 차가운 배경(L6 비네팅) → 헤이즈 → 파티클. */
  private drawBackground(input: RenderInput, dt: number): void {
    const ctx = this.bgCtx;
    if (!ctx || this.bgW <= 0 || this.bgH <= 0) return;
    ctx.clearRect(0, 0, this.bgW, this.bgH);

    // (V2-3) 차가운 최소 배경 — 비네팅(L6 등). 헤이즈와 동급 비용 1개.
    const bg = this.currentVisual.bg;
    if (bg && bg.kind === 'vignette') {
      const col = this.colors.get(bg.colorToken);
      const cx = this.bgW / 2;
      const cy = this.bgH / 2;
      const rOuter = Math.max(this.bgW, this.bgH) * 0.75;
      const g = ctx.createRadialGradient(cx, cy, rOuter * 0.4, cx, cy, rOuter);
      g.addColorStop(0, `rgba(${col.r},${col.g},${col.b},0)`);
      g.addColorStop(1, `rgba(${col.r},${col.g},${col.b},${bg.alpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.bgW, this.bgH);
    }

    // 헤이즈(L1) — update(드리프트) 후 draw(타일링).
    if (this.haze.active) {
      this.haze.update(dt, this.reducedMotion);
      this.haze.draw(ctx, this.bgW, this.bgH);
    }

    // 파티클 — 위상 신호(regen) → update → draw. 항상 source-over(부드러운 점/아크).
    if (this.particles.active) {
      if (input.phaseState) this.particles.signalPhase(input.phaseState);
      this.particles.update(dt, input.rateCLog10, this.reducedMotion);
      this.particles.draw(ctx);
    }
  }

  /** 게이지: 본체(동심원·외곽링) + 중심 글로우(코어/헤일로). */
  private drawGauge(input: RenderInput, nowMs: number, dt: number): void {
    const ctx = this.glowCtx;
    if (!ctx || this.glowW <= 0 || this.glowH <= 0) return; // V2-7 M6: 0크기 스킵
    ctx.clearRect(0, 0, this.glowW, this.glowH);

    const cx = this.glowW / 2;
    const cy = this.glowH / 2;
    const rFrame = Math.max(1, Math.min(cx, cy) - DEFAULT_R_FRAME_MARGIN);

    this.glow.draw(
      ctx,
      cx,
      cy,
      rFrame,
      input.dec,
      input.rateCPositive,
      nowMs,
      dt,
      this.reducedMotion,
    );
  }

  /** 정리(누수 방지). 풀·타일 해제·dpr 리스너 제거. */
  dispose(): void {
    this.haze.destroy();
    this.particles.destroy();
    if (this.dprMql && this.onDprChange && typeof this.dprMql.removeEventListener === 'function') {
      this.dprMql.removeEventListener('change', this.onDprChange);
    }
    this.dprMql = null;
    this.onDprChange = null;
    this.input = null;
  }
}
