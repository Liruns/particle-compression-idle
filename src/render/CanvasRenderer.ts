/**
 * render/CanvasRenderer — Renderer 구현체. 풀스크린 게임 캔버스 하나에 두 레이어를 합성한다:
 *   - 세계 배경(WorldRenderer): 게임 현재 층 slug → distinct 세계 + 전환 하강 + 비네팅(source-over).
 *   - 전경 게임판(BoardRenderer): 중심 코어 + 8 궤도 껍질 + 떠다니는 세포(세계 위 lighter 가산).
 *
 *  와이어링(V2-4): App subscribe(s) 콜백에서 gameBoard.setInput(s 파생) → draw() 연달아. 자체 rAF 없음.
 *  읽기전용(V2-7): board 입력은 number/bool/string 파생만(Decimal/Set 미접근 — 결정성·세이브 보호).
 *  ★2단계 정리: 구 게이지 글로우(Glow/ColorCache/layer-visuals/haze/particles)는 게이지→코어 대체로
 *   전부 데드 → 제거. 이 렌더러는 세계+게임판 합성만 담당(단일 캔버스).
 */
import type { Renderer } from './index';
import { WorldRenderer } from './world-renderer';
import { BoardRenderer } from './board';

export class CanvasRenderer implements Renderer {
  /** 풀스크린 게임 캔버스(세계 배경 + 전경 게임판). */
  private bgCtx: CanvasRenderingContext2D | null;
  private bgCanvas: HTMLCanvasElement | null;
  /** 배경 = 우주적 현미경 세계(층별 distinct + 전환 하강). */
  private world: WorldRenderer;
  /** 전경 = 다이제틱 공허 게임판(중심 코어·궤도 껍질·세포). */
  private board: BoardRenderer;
  /** 게임판 애니메이션 누적 시간(초). bg dt를 적분 — 사인 위상 일관(world.t와 독립). */
  private boardTime = 0;
  private reducedMotion = false;
  /** 첫 onLayerChange(부팅 슬러그)는 즉시 스냅 → 이후 변화만 전환 하강. */
  private applied = false;

  // 시간(앰비언트 모션 자체 적분 — 로직 tick 무관). dt 클램프(복귀 점프 방지 V2-6).
  private lastTime = -1;
  private dpr = 1;
  // 캔버스 CSS 크기(리사이즈 시 갱신).
  private bgW = 0;
  private bgH = 0;
  // dpr 변경 감지 matchMedia(dispose에서 해제).
  private dprMql: MediaQueryList | null = null;
  private onDprChange: (() => void) | null = null;

  constructor(opts: { bgCanvas: HTMLCanvasElement | null }) {
    this.bgCanvas = opts.bgCanvas;
    this.bgCtx = opts.bgCanvas?.getContext('2d') ?? null;
    this.world = new WorldRenderer();
    this.board = new BoardRenderer();

    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    this.applyLayer('mol', true); // 초기 층(mol) 즉시(전환 없이 — 부팅 슬러그)
    this.resize(); // 초기 백버퍼 설정(0이면 스킵)

    // dpr 변경(모니터 이동) → 백버퍼 재설정.
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

  /** 캔버스 컨텍스트가 살아있는지(폴백 판정용). */
  get ready(): boolean {
    return this.bgCtx != null;
  }

  /** 전경 게임판 — App이 입력 주입·포인터 상호작용을 위해 접근(단방향: board는 히트테스트만). */
  get gameBoard(): BoardRenderer {
    return this.board;
  }

  /** 현재 세계 발광색('r,g,b', 전환 보간). DOM 성표 주석(QF=층색 §3-C)이 읽는다. */
  get layerColorRGB(): string {
    return this.world.currentColorRGB();
  }

  /** reduced-motion 토글(스토어 구독 → App에서 주입). 세계·게임판 구동기에 전파(전환 즉시 스냅). */
  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
    this.world.setReducedMotion(v);
    this.board.setReducedMotion(v);
  }

  /**
   * 층 전환(slug 변화 시 App에서 호출). 세계 전환 하강 재생 + 새 세계 물질 교체.
   *  첫 호출(부팅 슬러그)은 즉시 스냅(전환 없음), 이후 slug 변화는 떨어짐 전환(art §5-B).
   */
  onLayerChange(layerSlug: string): void {
    this.applyLayer(layerSlug, !this.applied);
  }

  /** immediate=true면 세계를 즉시 맞춤(부팅·강제), false면 전환 하강 + 세포 재시드. */
  private applyLayer(slug: string, immediate: boolean): void {
    if (immediate) this.world.setLayerImmediate(slug);
    else this.world.setLayerBySlug(slug);
    // 층이 실제로 바뀌면(부팅 제외) 새 세계의 물질로 교체 — 만질 세포도 세계 따라 달라짐(§3-C).
    if (!immediate) this.board.reseedCells();
    this.applied = true;
  }

  /**
   * 리사이즈·DPI 재설정. 백버퍼 = CSS크기 × dpr, setTransform(dpr)로 스케일.
   *  width/height ≤ 0(탭 전환·display:none)면 스킵(NaN 반경 throw 방지 V2-7 M6). 매 프레임 아님.
   */
  resize(): void {
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
  }

  /**
   * Renderer 계약. alpha 미사용(앰비언트 — 내부 시간 delta로 모션 적분). 읽기전용.
   *  세계 배경(source-over void + lighter 세계빛 + source-over 비네팅) → 전경 게임판(lighter 가산).
   */
  draw(_alpha = 1): void {
    const ctx = this.bgCtx;
    if (!ctx || this.bgW <= 0 || this.bgH <= 0) return;

    // dt(클램프 — 백그라운드 복귀 점프 방지 V2-6: dt=min(realDt,0.1)).
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let dt = this.lastTime < 0 ? 0 : (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt < 0) dt = 0;
    if (dt > 0.1) dt = 0.1;

    ctx.clearRect(0, 0, this.bgW, this.bgH);
    this.world.draw(ctx, this.bgW, this.bgH, dt); // 세계 배경(자체 합성 복원)
    if (!this.reducedMotion) this.boardTime += dt;
    this.board.setLayerColor(this.world.currentColorRGB());
    this.board.draw(ctx, this.bgW, this.bgH, dt, this.boardTime); // 전경 게임판(lighter)
  }

  /** 정리(누수 방지). dpr 리스너 제거. */
  dispose(): void {
    if (this.dprMql && this.onDprChange && typeof this.dprMql.removeEventListener === 'function') {
      this.dprMql.removeEventListener('change', this.onDprChange);
    }
    this.dprMql = null;
    this.onDprChange = null;
  }
}
