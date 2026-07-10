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
import { CosmicCycle } from './cosmic-cycle';

export class CanvasRenderer implements Renderer {
  /** 풀스크린 게임 캔버스(세계 배경 + 전경 게임판). */
  private bgCtx: CanvasRenderingContext2D | null;
  private bgCanvas: HTMLCanvasElement | null;
  /** 배경 = 우주적 현미경 세계(층별 distinct + 전환 하강). */
  private world: WorldRenderer;
  /** 전경 = 다이제틱 공허 게임판(중심 코어·궤도 껍질·세포). */
  private board: BoardRenderer;
  /** 데스크톱 위젯 "코스믹 사이클" 씬(선택 장면). widget+scene='cosmic'일 때만 그린다. */
  private cosmic: CosmicCycle;
  private widget = false;
  /** 위젯 장면: 'world'=현재 층 세계(게임과 동기화, 기본) / 'cosmic'=우주 사이클(별도 은유). */
  private widgetScene: 'world' | 'cosmic' = 'world';
  /** 투명 배경 모드(Tauri 투명창) — FX 풀렉트 백화를 radial로 대체. */
  private transparentBg = false;
  /** 위젯 FX(장면 공통): 포크 리플(최대 6) + 빅뱅 섬광. 렌더 전용 — 보상·경제 없음. */
  private readonly pokes: { x: number; y: number; t: number }[] = [];
  private bangT = 0;
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
    this.cosmic = new CosmicCycle();

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
    this.cosmic.setReducedMotion(v);
  }

  /** 데스크톱 위젯 모드 on/off — draw가 게임판 대신 위젯 장면(세계 또는 코스믹)을 그린다. */
  setWidgetMode(v: boolean): void {
    this.widget = v;
  }

  /** 위젯 장면 선택(설정 prefs.widgetScene — 기본 'world' = 게임과 동기화). */
  setWidgetScene(v: 'world' | 'cosmic'): void {
    this.widgetScene = v;
  }

  /** 코스믹 사이클 진행도 주입(0..1 = 게임 dec/26 연동). App pushRender에서 매 스냅샷 갱신. */
  setCosmicProgress(p: number): void {
    this.cosmic.setProgress(p);
  }

  /** 빅크런치 → 빅뱅 섬광(App이 bigCrunch 이벤트에서 호출). 장면 공통 위젯 FX. */
  widgetBang(): void {
    this.bangT = 1;
  }

  /** 투명 배경 모드(Tauri 투명창 위젯) — 두 장면 모두 불투명 배경 대신 소프트 헤일로로 그린다. */
  setTransparent(v: boolean): void {
    this.transparentBg = v;
    this.cosmic.setTransparent(v);
    this.world.setTransparent(v);
  }

  /** 위젯 만지기(포크) — 렌더 전용 리플(보상·경제 없음). 좌표는 캔버스 CSS px. 장면 공통. */
  widgetPoke(x: number, y: number): void {
    if (this.pokes.length >= 6) this.pokes.shift();
    this.pokes.push({ x, y, t: 0 });
  }

  /**
   * 층 전환(slug 변화 시 App에서 호출). 세계 전환 하강 재생 + 새 세계 물질 교체.
   *  첫 호출(부팅 슬러그)은 즉시 스냅(전환 없음), 이후 slug 변화는 떨어짐 전환(art §5-B).
   */
  onLayerChange(layerSlug: string, moneyShot = false): void {
    this.applyLayer(layerSlug, !this.applied, moneyShot);
  }

  /** immediate=true면 세계를 즉시 맞춤(부팅·강제), false면 전환 하강 + 세포 재시드. */
  private applyLayer(slug: string, immediate: boolean, moneyShot = false): void {
    if (immediate) this.world.setLayerImmediate(slug);
    else this.world.setLayerBySlug(slug, moneyShot);
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
    if (this.widget && this.widgetScene === 'cosmic') {
      // 위젯(코스믹): 우주 사이클 장면 + FX. 진행도는 App이 setCosmicProgress로 주입.
      this.cosmic.draw(ctx, this.bgW, this.bgH, dt);
      this.drawWidgetFx(ctx, dt);
      return;
    }
    // 게임 화면과 위젯(세계 장면)은 동일 드로우 경로 — 위젯 = 게임 그대로, UI/상호작용만 없음(동기화).
    this.world.draw(ctx, this.bgW, this.bgH, dt); // 세계 배경(자체 합성 복원)
    if (!this.reducedMotion) this.boardTime += dt;
    this.board.setLayerColor(this.world.currentColorRGB());
    this.board.draw(ctx, this.bgW, this.bgH, dt, this.boardTime); // 전경 게임판(lighter)
    if (this.widget) this.drawWidgetFx(ctx, dt);
  }

  /** 위젯 FX — 포크 리플 + 빅뱅 섬광(장면 위 합성). 클릭/크런치 때만 발생(저빈도 — gradient 즉석 OK). */
  private drawWidgetFx(ctx: CanvasRenderingContext2D, dt: number): void {
    const W = this.bgW;
    const H = this.bgH;
    const R = Math.min(W, H) * 0.42;
    if (this.pokes.length > 0) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = this.pokes.length - 1; i >= 0; i--) {
        const k = this.pokes[i];
        k.t += dt;
        const u = Math.min(1, k.t / 0.8);
        if (u >= 1) {
          this.pokes.splice(i, 1);
          continue;
        }
        const e = 1 - Math.pow(1 - u, 3);
        const rr = R * (this.reducedMotion ? 0.1 : 0.04 + e * 0.16);
        const al = (1 - u) * 0.5;
        ctx.beginPath();
        ctx.arc(k.x, k.y, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(210,225,255,${al})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        this.fxGlow(ctx, k.x, k.y, rr * 0.8, '210,225,255', al * 0.6);
      }
    }
    if (this.bangT > 0) {
      this.bangT = Math.max(0, this.bangT - dt / 1.4);
      const b = this.bangT;
      if (b > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        this.fxGlow(ctx, W / 2, H / 2, R * (0.3 + (1 - b) * 2.2), '255,250,240', b * 0.9);
        ctx.globalCompositeOperation = 'source-over';
        if (this.transparentBg) {
          // 투명창: 풀렉트 백화 대신 radial(가장자리 투명 유지 — 흰 사각 플래시 방지).
          this.fxGlow(ctx, W / 2, H / 2, Math.max(W, H) * 0.7, '255,252,245', b * b * 0.5);
        } else {
          ctx.fillStyle = `rgba(255,252,245,${b * b * 0.5})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** FX 전용 radial 글로우(저빈도 — 스프라이트 캐시 불필요). */
  private fxGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number): void {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.4, `rgba(${col},${a * 0.35})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
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
