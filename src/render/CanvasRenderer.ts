/**
 * render/CanvasRenderer — Renderer 계약 구현체(m2-render-plan §9·V2 → UI 마이그레이션 1단계).
 *  두 캔버스(배경 fx / 게이지 글로우)의 2D context를 소유한다.
 *   - 배경 fx = **우주적 현미경 세계**(WorldRenderer): 게임 현재 층 slug → distinct 세계 + 전환 하강.
 *     (구 헤이즈·파티클·비네팅 합성을 교체 — art-direction-cosmic.md §2·prototypes/cosmic-layers.html.)
 *   - 게이지 글로우 = 종전 그대로(Glow). 1단계에선 층 세계 배경이 주역, 게이지는 유지(2단계 정리).
 *  호출자(App subscribe 콜백) 무관 — draw는 읽기전용.
 *
 *  와이어링(V2-4): App subscribe(s) 콜백에서 setSnapshot(s) → draw() 연달아. 자체 rAF 없음.
 *  읽기전용 규율(V2-7): snapshot에서 dec(number)·rateCLog10(number)·rateCPositive(bool)·layer.slug(string)만.
 *   live discovered(Set)·Decimal(C/rateC/r/mult) 직접 접근 금지(결정성·세이브 보호).
 *  프레임당 추가 힙 할당: 세계 배치는 init 1회 사전생성, 게이지 gradient는 프레임당 소수(코어·헤일로) — V2-5 정신 유지.
 */
import type { Renderer } from './index';
import { ColorCache } from './color';
import { Glow } from './glow';
import { WorldRenderer } from './world-renderer';
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
  /** 배경 = 우주적 현미경 세계(층별 distinct + 전환 하강). 구 헤이즈/파티클 대체. */
  private world: WorldRenderer;

  private currentVisual: LayerVisual = visualFor('mol');
  private input: RenderInput | null = null;
  private reducedMotion = false;
  /** 첫 onLayerChange(부팅 슬러그)는 즉시 스냅 → 이후 변화만 전환 하강. */
  private applied = false;

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
    this.world = new WorldRenderer();

    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    // 색 캐시 초기 읽기 + 초기 층(mol) 설정(전환 없이 즉시 — 부팅 슬러그).
    this.colors.read(RENDER_TOKEN_KEYS);
    this.applyLayer('mol', true);
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

  /** reduced-motion 토글(스토어 구독 → App에서 주입). 세계 구동기에도 전파(전환 즉시 스냅). */
  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
    this.world.setReducedMotion(v);
  }

  /**
   * 층 전환(slug 변화 시 App에서 호출). 게이지 색·glowBlend 갱신 + **세계 전환 하강 재생**.
   *  첫 호출(부팅 슬러그)은 즉시 스냅(전환 없음), 이후 slug 변화는 떨어짐 전환(art §5-B).
   */
  onLayerChange(layerSlug: string): void {
    this.applyLayer(layerSlug, !this.applied);
  }

  /** immediate=true면 세계를 즉시 맞춤(부팅·강제), false면 전환 하강. */
  private applyLayer(slug: string, immediate: boolean): void {
    this.currentVisual = visualFor(slug);
    // 색 캐시 재읽기(data-layer가 이미 바뀐 상태 가정 — App이 setProperty 후 호출). 게이지 글로우용.
    this.colors.read(RENDER_TOKEN_KEYS);
    this.glow.onLayerChange(this.currentVisual.glowBlend);
    // 배경 세계: 부팅은 즉시, 층 변화는 전환 하강.
    if (immediate) this.world.setLayerImmediate(slug);
    else this.world.setLayerBySlug(slug);
    this.applied = true;
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

  /**
   * 배경 fx = 우주적 현미경 세계(WorldRenderer): 현재 층 distinct 세계 + 전환 하강 + 비네팅.
   *  void 채움·lighter 합성·source-over 비네팅은 WorldRenderer가 자체 관리(합성 상태 복원 포함).
   *  input은 미사용(세계는 slug로만 결정 — onLayerChange가 이미 반영). 읽기전용.
   */
  private drawBackground(_input: RenderInput, dt: number): void {
    const ctx = this.bgCtx;
    if (!ctx || this.bgW <= 0 || this.bgH <= 0) return;
    ctx.clearRect(0, 0, this.bgW, this.bgH);
    this.world.draw(ctx, this.bgW, this.bgH, dt);
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

  /** 정리(누수 방지). dpr 리스너 제거 + 입력 참조 해제(세계는 외부 리소스 없음 — 플레인 상태). */
  dispose(): void {
    if (this.dprMql && this.onDprChange && typeof this.dprMql.removeEventListener === 'function') {
      this.dprMql.removeEventListener('change', this.onDprChange);
    }
    this.dprMql = null;
    this.onDprChange = null;
    this.input = null;
  }
}
