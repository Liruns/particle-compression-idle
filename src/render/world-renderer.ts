/**
 * render/world-renderer — 우주적 현미경 배경 구동기(prototypes/cosmic-layers.html 이식).
 *
 *  역할: 게임의 **현재 층 slug** → 해당 세계(WORLDS) 드로우. 층이 바뀌면 **전환 하강**("떨어지며
 *   이어짐") 재생. 공허(층별 void) → 세계 → 비네팅 합성. 앰비언트 모션은 내부 시간 적분(로직 tick
 *   무관). dt 클램프로 탭 백그라운드 rAF 스로틀·offline 복귀에도 전환이 점프 없이 부드럽게 마무리.
 *
 *  ★표현 전담·읽기전용: 게임 상태를 변형하지 않는다. 색은 각 세계가 자체 보유(art §2-C 탈채도 발광).
 *  ★고요(art §7): 상시 줌 없음(정적 세계는 sc=1 고정), 번쩍임 0(전환만 느린 1.7s 하강).
 *  ★reduced-motion: 시간 적분 정지(정적 프레임) + 전환 즉시 스냅(연속 줌 멀미 방지, accessibility §2).
 *
 *  CanvasRenderer가 배경 캔버스 컨텍스트를 넘겨 위임한다(게이지 글로우는 별도 캔버스 유지).
 */
import { WORLDS, worldIndexForSlug, initWorlds, type World } from './layer-worlds';
import { hexToRgb } from './util';

/** 전환 길이(초). 프로토타입 DUR=1.7 — 느린 하강(art §5-B). */
const TRANSITION_DUR = 1.7;
/** 머니샷 전환 길이(초) — 첫 미지 진입(쿼크→프리온) 색온도 식는 순간을 더 길고 무겁게(art-cosmic §6). */
const MONEY_SHOT_DUR = 3.2;
/** dt 상한(초). 백그라운드 복귀 큰 갭을 클램프(프로토타입 0.1). */
const DT_CLAMP = 0.1;

interface Transition {
  from: number;
  to: number;
  /** 진행 0..1. */
  p: number;
  /** 머니샷(첫 미지 진입): 더 긴 하강 + 깊은 문턱 어둠 + 도착 후 냉색 블룸(art-cosmic §6). */
  moneyShot: boolean;
}

export class WorldRenderer {
  /** 현재 세계 인덱스(WORLDS). */
  private cur = 0;
  private trans: Transition | null = null;
  private reducedMotion = false;
  /** 앰비언트 누적 시간(초). performance.now 기반 dt 적분 — 로직 tick과 독립. */
  private t = 0;
  /** 투명 위젯 모드 — void/어둠/비네팅을 불투명 풀렉트 대신 중앙 radial(가장자리 완전 투명)로. */
  private transparent = false;

  /** 투명 배경 모드 on/off(Tauri 투명창 위젯 — CanvasRenderer가 전파). */
  setTransparent(v: boolean): void {
    this.transparent = v;
  }

  /** void 채움 — 불투명: 풀렉트 / 투명: 중앙 소프트 헤일로(코스믹과 동일 문법). */
  private fillVoid(ctx: CanvasRenderingContext2D, W: number, H: number, voidHex: string): void {
    if (!this.transparent) {
      ctx.fillStyle = voidHex;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const rgb = hexToRgb(voidHex);
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    g.addColorStop(0, `rgba(${rgb},0.62)`);
    g.addColorStop(0.6, `rgba(${rgb},0.30)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /** 전환 어둠 오버레이 — 투명 모드에선 radial(가장자리 투명 유지, 검은 사각 플래시 방지). */
  private darkOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number): void {
    if (alpha <= 0) return;
    if (!this.transparent) {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    g.addColorStop(0, `rgba(0,0,0,${alpha})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  constructor() {
    initWorlds();
  }

  /** 현재 층 slug 설정. 부팅·강제전환 시 즉시(전환 없이) 맞춘다(App onLayerChange 초기 호출 호환). */
  setLayerImmediate(slug: string): void {
    this.cur = worldIndexForSlug(slug);
    this.trans = null;
  }

  /**
   * 게임 층이 바뀌었을 때 호출 — 전환 하강 재생.
   *  reduced-motion이면 전환 애니메이션 없이 즉시 스냅(멀미 방지). 같은 층이면 무시.
   *  이미 전환 중이면 목표를 교체(중첩 점프 방지: 진행 중 전환은 끝까지 두고, 새 목표는 그 다음).
   */
  setLayerBySlug(slug: string, moneyShot = false): void {
    const ni = worldIndexForSlug(slug);
    if (this.reducedMotion) {
      this.cur = ni;
      this.trans = null;
      return;
    }
    if (this.trans) {
      // 진행 중 전환이 있으면, 그 목표를 새 slug로 갱신(연쇄 점프 시 마지막 목표로 수렴).
      if (this.trans.to !== ni) this.trans.to = ni;
      // 진행 중에 머니샷 신호가 오면 승격(첫 미지 진입이 연쇄에 묻히지 않게).
      if (moneyShot) this.trans.moneyShot = true;
      return;
    }
    if (ni === this.cur) return;
    this.trans = { from: this.cur, to: ni, p: 0, moneyShot };
  }

  /** 전환 진행 중 여부(테스트·HUD). */
  get transitioning(): boolean {
    return this.trans !== null;
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
    // 모션 끄면 진행 중 전환을 즉시 마무리(정적 프레임으로).
    if (v && this.trans) {
      this.cur = this.trans.to;
      this.trans = null;
    }
  }

  /** 현재 그려질 세계(디버그·전환 HUD용). */
  get currentWorld(): World {
    return WORLDS[this.cur];
  }

  /**
   * 현재 세계 발광색('r,g,b'). 전환 중이면 from→to 보간(프로토타입 worldColorRGB 이식) — 코어·자유빛이
   *  따라가 "지금 얼마나 깊은가"가 곧 빛(§3-C QF=층색). BoardRenderer가 매 프레임 읽는다(표현 전용).
   */
  currentColorRGB(): string {
    if (!this.trans) return WORLDS[this.cur].col;
    const a = WORLDS[this.trans.from].col.split(',').map(Number);
    const b = WORLDS[this.trans.to].col.split(',').map(Number);
    const k = Math.min(1, Math.max(0, (this.trans.p - 0.4) / 0.3));
    const r = Math.round(a[0] + (b[0] - a[0]) * k);
    const g = Math.round(a[1] + (b[1] - a[1]) * k);
    const bb = Math.round(a[2] + (b[2] - a[2]) * k);
    return `${r},${g},${bb}`;
  }

  /**
   * 배경 한 프레임. ctx=배경 캔버스(dpr setTransform 적용, CSS px 좌표). W,H=CSS px.
   *  nowMs=performance.now()(시간 적분), dt=호출자가 클램프한 delta(초, 추가로 여기서도 클램프).
   *  void(검정) 채움 → 세계(lighter 합성) → 비네팅(source-over). 읽기전용.
   */
  draw(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number): void {
    if (W <= 0 || H <= 0) return;
    // 시간 적분(reduced-motion이면 정지 — 정적 프레임). dt 클램프(복귀 점프 방지).
    let d = dt;
    if (d < 0) d = 0;
    if (d > DT_CLAMP) d = DT_CLAMP;
    if (!this.reducedMotion) this.t += d;
    const t = this.t;
    const cx = W / 2,
      cy = H / 2;

    ctx.globalCompositeOperation = 'source-over';

    if (!this.trans) {
      // 정적: 현재 세계의 void 채움 + 세계 드로우(상시 줌 없음 — sc=1).
      const w = WORLDS[this.cur];
      this.fillVoid(ctx, W, H, w.void);
      ctx.globalCompositeOperation = 'lighter';
      this.drawWorld(w, ctx, t, cx, cy, 1, 1, W, H, d);
    } else {
      // 전환 하강("떨어지며 이어짐", 프로토타입 frame 로직 이식). 머니샷은 더 길게.
      const money = this.trans.moneyShot;
      this.trans.p += d / (money ? MONEY_SHOT_DUR : TRANSITION_DUR);
      const p = Math.min(1, this.trans.p);
      const from = WORLDS[this.trans.from];
      const to = WORLDS[this.trans.to];
      this.fillVoid(ctx, W, H, p < 0.5 ? from.void : to.void);
      ctx.globalCompositeOperation = 'lighter';
      // A: 현재 세계로 *떨어진다* (확대 + 페이드아웃).
      if (p < 0.62) {
        const k = p / 0.62;
        this.drawWorld(from, ctx, t, cx, cy, 1 + k * 1.7, (1 - k) * (1 - k), W, H, d);
      }
      // B: 새 세계가 떠오른다 (확대되며 등장).
      if (p > 0.4) {
        const k = (p - 0.4) / 0.6;
        this.drawWorld(to, ctx, t, cx, cy, 0.42 + Math.min(1, k) * 0.58, Math.min(1, k), W, H, d);
      }
      // 문턱의 어둠 — 통과하는 순간 가장 깊은 침묵. 머니샷은 더 깊고 오래(미지로 넘는 무게).
      ctx.globalCompositeOperation = 'source-over';
      const darkPeak = money ? 0.82 : 0.55;
      const darkCurve = money ? Math.pow(Math.sin(p * Math.PI), 0.7) : Math.sin(p * Math.PI);
      this.darkOverlay(ctx, W, H, darkPeak * darkCurve);
      // 머니샷 도착 냉색 블룸 — 어둠을 뚫고 새(더 차가운) 세계색이 번진다(플래시 아님, 부드러운 상승).
      if (money && p > 0.72) {
        const k = (p - 0.72) / 0.28; // 0→1
        const c = to.col.split(',').map(Number);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.28 * k})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (this.trans.p >= 1) {
        this.cur = this.trans.to;
        this.trans = null;
      }
    }

    // 비네팅 — 현미경 시야(art §2-B: 중심 밝고 가장자리 어둠). 항상 source-over.
    if (!this.transparent) this.vignette(ctx, W, H);
  }

  /** 세계 드로우 디스패치. Foam(L9)은 확률적 스폰이라 dt를 추가 인자로 받는다. */
  private drawWorld(
    w: World,
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
    dt: number,
  ): void {
    // Foam의 draw는 9번째 인자로 dt를 받는다(선택적). 타입상 World.draw 시그니처는 8인자이므로 캐스팅.
    (
      w.draw as (
        ctx: CanvasRenderingContext2D,
        t: number,
        cx: number,
        cy: number,
        sc: number,
        al: number,
        W: number,
        H: number,
        dt?: number,
      ) => void
    )(ctx, t, cx, cy, sc, al, W, H, dt);
  }

  /** 비네팅(프로토타입 vignette 이식). 중심 투명 → 가장자리 어둠. */
  private vignette(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    ctx.globalCompositeOperation = 'source-over';
    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.22,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.72,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}
