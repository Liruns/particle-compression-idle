/**
 * render/layer-worlds — 우주적 현미경: 11층 distinct 세계 (prototypes/cosmic-layers.html 이식).
 *
 *  각 층 = 그 스케일의 의도된 구조(형태로 구별) + 색온도 아크(따뜻→차가움→무색).
 *  분자=세포/막 … 플랑크=픽셀 격자. art-direction-cosmic.md §2-C 팔레트·§7 금지목록 준수:
 *   - 고요(상시 줌 없음·번쩍임 0): 부드러운 등장·넓은 코어·낮은 그레인(프로토타입 검증값 그대로).
 *   - 발광(reflective 아님): 모든 빛은 radial gradient halo를 가진 광원에서만(F8).
 *   - 공허가 캔버스: 화면 대부분은 어둠. 각 층은 자기 void 색을 가진다(§2-B).
 *
 *  이 모듈은 **표현 전담·읽기전용**: 게임 상태를 변형하지 않는다. 색은 각 세계가 자체 보유
 *   (tokens.css의 구 네온 팔레트에 비의존 — 프로토타입의 탈채도 발광색을 그대로 박는다).
 *
 *  계약: 각 World는 draw(ctx,t,cx,cy,sc,al,W,H). ctx는 dpr setTransform 적용(CSS px 좌표).
 *   sc=스케일(전환 줌), al=알파(전환 페이드), W/H=CSS px 캔버스 크기. t=초 단위 누적 시간.
 *   합성(lighter)은 호출자(WorldRenderer)가 세팅 — 각 World는 그 안에서 그린다.
 *   init()로 결정적 시드 기반 배치를 1회 만든다(프레임당 추가 힙 할당 0 지향).
 */

import { TAU } from './util';

/** 결정적 의사난수(시드 기반, 프로토타입 rng와 동일). 외부 의존 없음 — 결정성 보장. */
function makeRng(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 부드러운 발광 덩어리(radial gradient — 매끈, 번쩍임 없음). 광원에서만 빛난다(§2-C·F8).
 *  col='r,g,b' 문자열. a<=0 또는 r<=0이면 스킵(NaN gradient 방지).
 */
function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  col: string,
  a: number,
): void {
  if (a <= 0 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${col},${a})`);
  g.addColorStop(0.4, `rgba(${col},${a * 0.32})`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** 발광 선 — 부드러운 가닥(끈·격자·스캔라인 등). lighter 모드 전제. */
function lineGlow(
  ctx: CanvasRenderingContext2D,
  pts: number[],
  col: string,
  a: number,
  w: number,
): void {
  if (a <= 0) return;
  ctx.strokeStyle = `rgba(${col},${a})`;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    if (i) ctx.lineTo(pts[i], pts[i + 1]);
    else ctx.moveTo(pts[i], pts[i + 1]);
  }
  ctx.stroke();
}

/**
 * 한 층의 세계. void=배경 색(hex), col='r,g,b'=대표 발광색(전환·HUD 참조용).
 *  draw는 lighter 합성 하에서 호출됨(WorldRenderer가 세팅). W,H=CSS px.
 */
export interface World {
  /** tokens.css/layers.ts와 동일 slug. */
  slug: string;
  /** 한국어 — 영문 라벨(디버그·전환 HUD). */
  name: string;
  /** 배경 void 색(hex, art §2-B). */
  void: string;
  /** 대표 발광색 'r,g,b'(전환 줌·색온도 참조). */
  col: string;
  /** 결정적 배치 1회 생성(시드 기반). */
  init(): void;
  /** 세계 드로우. ctx=lighter 합성. sc=전환 줌, al=전환 알파. */
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void;
}

// ─── 11층 세계 — 프로토타입(검증·고요 캘리브레이션) 그대로 이식 ───
// 각 세계는 자기 상태(cells/rings/…)를 init에서 만들고 draw에서 읽는다(프레임당 할당 0 지향).

// L1 분자 — 옅은 유기 조직 헤이즈(만질 세포의 "양분 무대"). sage.
//   ★2단계 정합(prototypes/cosmic-particle-game.html worlds[0]): 만질 수 있는 세포는 BoardRenderer가
//    전경으로 그린다. 그래서 이 세계 *배경*은 가득 찬 세포·막이 아니라 **뒤로 물러난 옅은 헤이즈**여야
//    전경 세포가 또렷이 도드라진다(구 cosmic-layers 버전은 배경 세포가 전경과 겹쳐 혼탁 → 헤이즈로 후퇴).
class MoleculeWorld implements World {
  slug = 'mol';
  name = '분자층 — Molecular';
  void = '#0a0e0c';
  col = '159,184,154';
  private haze: { a: number; d: number; sz: number; ph: number; sp: number }[] = [];
  init(): void {
    const r = makeRng(7);
    this.haze = [];
    for (let i = 0; i < 7; i++)
      this.haze.push({
        a: r() * TAU,
        d: 0.12 + r() * 0.5,
        sz: 120 + r() * 180,
        ph: r() * TAU,
        sp: 0.03 + r() * 0.05,
      });
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5;
    for (const h of this.haze) {
      const rad = h.d * R * sc;
      const x = cx + Math.cos(h.a + Math.sin(t * h.sp + h.ph) * 0.1) * rad;
      const y = cy + Math.sin(h.a + Math.cos(t * h.sp + h.ph) * 0.1) * rad;
      const br = 0.5 + 0.3 * Math.sin(t * 0.22 + h.ph);
      glow(ctx, x, y, h.sz * sc, this.col, 0.035 * br * al);
    }
  }
}

// L2 원자 — 핵 + 오비탈 껍질·궤도 + 여러 전자 + 확률 구름. teal.
class AtomWorld implements World {
  slug = 'atom';
  name = '원자층 — Atomic';
  void = '#0a0e0c';
  col = '127,176,184';
  private rings: { rx: number; ry: number; ti: number; sp: number; n: number }[] = [];
  init(): void {
    this.rings = [
      { rx: 0.3, ry: 0.12, ti: 0.35, sp: 0.55, n: 2 },
      { rx: 0.44, ry: 0.2, ti: -0.6, sp: -0.34, n: 3 },
      { rx: 0.2, ry: 0.32, ti: 1.15, sp: 0.66, n: 2 },
      { rx: 0.52, ry: 0.4, ti: -1.5, sp: 0.28, n: 3 },
    ];
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5 * sc;
    const breathe = 0.92 + 0.08 * Math.sin(t * 0.22);
    glow(ctx, cx, cy, R * 0.44 * breathe, this.col, 0.05 * al);
    glow(ctx, cx, cy, 46 * sc * breathe, this.col, 0.7 * al);
    glow(ctx, cx, cy, 16 * sc, '205,233,238', 0.8 * al);
    for (const g of this.rings) {
      const ca = Math.cos(g.ti),
        sa = Math.sin(g.ti);
      ctx.strokeStyle = `rgba(${this.col},${0.2 * al})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const a = (k / 64) * TAU;
        const ex = Math.cos(a) * g.rx * R,
          ey = Math.sin(a) * g.ry * R;
        const wx = cx + ex * ca - ey * sa,
          wy = cy + ex * sa + ey * ca;
        if (k) ctx.lineTo(wx, wy);
        else ctx.moveTo(wx, wy);
      }
      ctx.stroke();
      for (let e = 0; e < g.n; e++) {
        const ea = t * g.sp + (e * TAU) / g.n;
        const ex = Math.cos(ea) * g.rx * R,
          ey = Math.sin(ea) * g.ry * R;
        const wx = cx + ex * ca - ey * sa,
          wy = cy + ex * sa + ey * ca;
        const br = 0.85 + 0.12 * Math.sin(t * 0.8 + e + g.sp * 7);
        glow(ctx, wx, wy, 14 * sc, this.col, br * al);
        glow(ctx, wx, wy, 4 * sc, '225,244,247', br * 0.7 * al);
      }
    }
  }
}

// L3 핵 — 밀집 핵자 클러스터. amber. 강결합 진동·압력감.
class NucleusWorld implements World {
  slug = 'nuc';
  name = '핵층 — Nuclear';
  void = '#0c0d0a';
  col = '217,154,108';
  private nuc: { bx: number; by: number; ph: number; sp: number; sz: number; kind: number }[] = [];
  init(): void {
    const r = makeRng(31);
    this.nuc = [];
    const N = 30;
    for (let i = 0; i < N; i++) {
      const u = r(),
        rr = Math.pow(u, 0.6) * 0.165;
      const a = r() * TAU;
      this.nuc.push({
        bx: Math.cos(a) * rr,
        by: Math.sin(a) * rr,
        ph: r() * TAU,
        sp: 0.5 + r() * 0.7,
        sz: 10 + r() * 8,
        kind: r() < 0.5 ? 1 : 0,
      });
    }
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5 * sc;
    const press = 0.5 + 0.5 * Math.sin(t * 0.4);
    glow(ctx, cx, cy, R * 0.34, this.col, (0.16 + 0.06 * press) * al);
    glow(ctx, cx, cy, R * 0.2, '235,175,125', 0.14 * al);
    for (const n of this.nuc) {
      const wob = (0.012 + 0.006 * press) * Math.sin(t * n.sp + n.ph);
      const x = cx + (n.bx + Math.cos(n.ph) * wob) * R,
        y = cy + (n.by + Math.sin(n.ph) * wob) * R;
      const br = 0.68 + 0.26 * Math.sin(t * 0.6 + n.ph);
      const c = n.kind ? '233,172,118' : '205,128,140';
      glow(ctx, x, y, n.sz * sc, c, br * 0.92 * al);
      glow(ctx, x, y, n.sz * 0.32 * sc, '252,228,208', br * 0.6 * al);
    }
  }
}

// L4 핵자 — 색전하 삼색. 탈채도 RGB. 삼체 글루온 결속.
class NucleonWorld implements World {
  slug = 'ncl';
  name = '핵자층 — Nucleon';
  void = '#0b0c0d';
  col = '150,176,170';
  private tri: { col: string; ph: number }[] = [];
  init(): void {
    this.tri = [
      { col: '214,120,142', ph: 0 },
      { col: '112,158,205', ph: TAU / 3 },
      { col: '128,200,150', ph: (TAU * 2) / 3 },
    ];
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5 * sc;
    const base = 0.215,
      swing = 0.05;
    const rot = t * 0.18;
    const pos = this.tri.map((q) => {
      const rr = base + swing * Math.sin(t * 0.5 + q.ph * 1.7);
      const a = rot + q.ph;
      return { x: cx + Math.cos(a) * rr * R, y: cy + Math.sin(a) * rr * R, col: q.col };
    });
    glow(ctx, cx, cy, R * 0.3, '170,175,185', 0.1 * al);
    for (let e = 0; e < 3; e++) {
      const A = pos[e],
        B = pos[(e + 1) % 3];
      lineGlow(ctx, [A.x, A.y, B.x, B.y], '205,212,220', 0.16 * al, 1.8);
      const f = (t * 0.5 + e * 0.33) % 1;
      const gx = A.x + (B.x - A.x) * f,
        gy = A.y + (B.y - A.y) * f;
      glow(ctx, gx, gy, 9 * sc, '225,228,233', 0.32 * al);
    }
    glow(ctx, cx, cy, R * 0.12, '215,220,228', 0.2 * al);
    for (let i = 0; i < pos.length; i++) {
      const p = pos[i];
      const br = 0.82 + 0.16 * Math.sin(t * 0.7 + i * 2.1);
      glow(ctx, p.x, p.y, 40 * sc, p.col, br * 0.42 * al);
      glow(ctx, p.x, p.y, 22 * sc, p.col, br * 0.95 * al);
      glow(ctx, p.x, p.y, 7 * sc, '240,244,246', br * 0.7 * al);
    }
  }
}

// L5 쿼크 — 거의 빈 공허 + 날카로운 점. 점근 자유·가둠선. 차가운 흰.
class QuarkWorld implements World {
  slug = 'qrk';
  name = '쿼크층 — Quark';
  void = '#070a0d';
  col = '216,224,228';
  private pts: { a: number; d: number; ph: number; sp: number; sw: number }[] = [];
  init(): void {
    const r = makeRng(23);
    this.pts = [];
    for (let i = 0; i < 7; i++)
      this.pts.push({
        a: r() * TAU,
        d: 0.07 + r() * 0.42,
        ph: r() * TAU,
        sp: 0.05 + r() * 0.09,
        sw: 0.05 + r() * 0.06,
      });
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5 * sc;
    glow(ctx, cx, cy, 7 * sc, this.col, 0.5 * al);
    for (const p of this.pts) {
      const pull = Math.sin(t * p.sw + p.ph);
      const rad = p.d * (0.78 + 0.22 * (pull * 0.5 + 0.5)) * R;
      const x = cx + Math.cos(p.a + Math.sin(t * p.sp + p.ph) * 0.05) * rad;
      const y = cy + Math.sin(p.a + Math.cos(t * p.sp) * 0.04) * rad;
      const dist = Math.hypot(x - cx, y - cy) / R;
      const br = 0.62 + 0.36 * Math.sin(t * 0.45 + p.ph);
      const conf = Math.min(1, dist / 0.4);
      lineGlow(ctx, [x, y, cx, cy], this.col, 0.14 * conf * br * al, 1.0);
      glow(ctx, x, y, 12 * sc, this.col, br * 0.9 * al);
      glow(ctx, x, y, 2.8 * sc, '255,255,255', br * al);
    }
  }
}

// L6 프리온 — 위상 간섭 무늬. 차가운 보라. 보강/상쇄 마디선·홀로그램 잔상.
class PreonWorld implements World {
  slug = 'prn';
  name = '프리온층 — Preon';
  void = '#06070d';
  col = '138,127,208';
  private k = 0.055;
  init(): void {
    this.k = 0.055;
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5;
    const sep = R * 0.2 * sc;
    const drift = Math.sin(t * 0.13) * R * 0.04 * sc;
    const s1x = cx - sep + drift,
      s1y = cy,
      s2x = cx + sep - drift,
      s2y = cy;
    const k = this.k / sc;
    glow(ctx, cx, cy, R * 0.62 * sc, this.col, 0.1 * al);
    glow(ctx, cx, cy, R * 0.34 * sc, '120,110,200', 0.08 * al);
    const lines = 11;
    const maxR = R * 0.64 * sc;
    // 호출자가 이미 lighter — 여기선 명시적으로 보강(중첩 빛).
    for (let n = -lines; n <= lines; n++) {
      const pathDiff = n * (TAU / k) * 0.5;
      const pts: number[] = [];
      let ok = false;
      for (let s = -1.0; s <= 1.0001; s += 0.04) {
        const a = pathDiff * 0.5;
        const c = sep;
        if (Math.abs(a) >= c) continue;
        const b2 = c * c - a * a;
        const yy = s * maxR;
        const xx =
          Math.sign(a || 1) * Math.abs(a) * Math.sqrt(1 + (yy * yy) / Math.max(1, b2));
        pts.push(cx + xx, cy + yy);
        ok = true;
      }
      if (ok && pts.length >= 4) {
        const fade = 0.5 + 0.5 * (1 - Math.abs(n) / (lines + 1));
        const breath = 0.62 + 0.38 * Math.sin(t * 0.32 + n * 0.55);
        const central = 1 - Math.abs(n) / (lines + 1);
        lineGlow(ctx, pts, this.col, 0.44 * fade * breath * al, 1.4 + central * 1.0);
        if (n !== 0) {
          for (let m = 0; m < pts.length; m += 12) {
            const beadF = fade * breath * (0.5 + 0.5 * Math.sin(t * 0.4 + m * 0.3 + n));
            glow(ctx, pts[m], pts[m + 1], 5 * sc, this.col, 0.3 * beadF * al);
          }
        }
      }
    }
    const wf = (t * 0.05) % 0.07;
    for (const [sxx, syy] of [
      [s1x, s1y],
      [s2x, s2y],
    ]) {
      for (let rr = 0.06; rr < 0.5; rr += 0.07) {
        const rad = (rr + wf) * R * sc;
        const ringA = 0.07 * (1 - rr / 0.5) * al;
        ctx.strokeStyle = `rgba(${this.col},${ringA})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sxx, syy, rad, 0, TAU);
        ctx.stroke();
      }
    }
    glow(ctx, cx, cy, R * 0.14 * sc, '170,160,235', 0.12 * al);
    const sb = 0.6 + 0.18 * Math.sin(t * 0.4);
    glow(ctx, s1x, s1y, 20 * sc, '180,170,238', 0.85 * sb * al);
    glow(ctx, s2x, s2y, 20 * sc, '180,170,238', 0.85 * sb * al);
    glow(ctx, s1x, s1y, 4 * sc, '232,228,252', 0.9 * al);
    glow(ctx, s2x, s2y, 4 * sc, '232,228,252', 0.9 * al);
  }
}

// L7 끈 — 진동 사인 필라멘트. 식은 자홍. 여러 하모닉 모드 동시 진동.
class StringWorld implements World {
  slug = 'str';
  name = '끈층 — String';
  void = '#06070d';
  col = '196,122,154';
  private str: { y: number; harm: number; amp: number; ph: number; sp: number; hue: number }[] = [];
  init(): void {
    const r = makeRng(71);
    this.str = [];
    const N = 9;
    for (let i = 0; i < N; i++)
      this.str.push({
        y: (i - (N - 1) / 2) / (((N - 1) / 2) * 1.18),
        harm: 1 + (i % 6),
        amp: 0.045 + r() * 0.05,
        ph: r() * TAU,
        sp: 0.45 + r() * 0.6,
        hue: i / N,
      });
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5;
    const halfW = R * 0.66 * sc;
    for (const s of this.str) {
      const baseY = cy + s.y * R * 0.46 * sc;
      const pts: number[] = [];
      const segs = 80;
      const drive = Math.sin(t * s.sp + s.ph);
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const x = cx - halfW + u * halfW * 2;
        const env = Math.sin(u * Math.PI * s.harm);
        const yy = baseY + env * drive * s.amp * R * sc;
        pts.push(x, yy);
      }
      const energy = 0.55 + 0.45 * Math.abs(drive);
      const cool = s.hue;
      const c = `${Math.round(200 - cool * 46)},${Math.round(120 + cool * 14)},${Math.round(
        152 + cool * 36,
      )}`;
      lineGlow(ctx, pts, c, 0.1 * energy * al, 4.0);
      lineGlow(ctx, pts, c, 0.34 * energy * al, 1.5);
      for (let m = 0; m < s.harm; m++) {
        const u = (m + 0.5) / s.harm;
        const x = cx - halfW + u * halfW * 2;
        const yy = baseY + Math.sin(u * Math.PI * s.harm) * drive * s.amp * R * sc;
        glow(ctx, x, yy, 5 * sc, c, 0.3 * energy * al);
      }
      for (let m = 1; m < s.harm; m++) {
        const u = m / s.harm;
        const x = cx - halfW + u * halfW * 2;
        glow(ctx, x, baseY, 3 * sc, '235,210,225', 0.28 * energy * al);
      }
    }
  }
}

// L8 루프 — 스핀 네트워크 격자. 깊은 청. 육각/삼각 노드 그물·위상 전파 펄스.
class LoopWorld implements World {
  slug = 'lp';
  name = '루프층 — Loop';
  void = '#05060d';
  col = '95,127,208';
  private nodes: { x: number; y: number; ph: number }[] = [];
  private edges: [number, number][] = [];
  init(): void {
    const r = makeRng(88);
    this.nodes = [];
    this.edges = [];
    const gx = 7,
      gy = 5,
      step = 0.155;
    const idx = (i: number, j: number) => i * gy + j;
    for (let i = 0; i < gx; i++)
      for (let j = 0; j < gy; j++) {
        const offx = (j % 2) * step * 0.5;
        this.nodes.push({
          x: (i - (gx - 1) / 2) * step + offx,
          y: (j - (gy - 1) / 2) * step * 0.92,
          ph: r() * TAU,
        });
      }
    for (let i = 0; i < gx; i++)
      for (let j = 0; j < gy; j++) {
        const a = idx(i, j);
        const cand: [number, number][] = [
          [i + 1, j],
          [i, j + 1],
          [j % 2 ? i + 1 : i - 1, j + 1],
        ];
        for (const [ni, nj] of cand) {
          if (ni >= 0 && ni < gx && nj >= 0 && nj < gy) this.edges.push([a, idx(ni, nj)]);
        }
      }
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5 * sc;
    const P = this.nodes.map((n) => ({ x: cx + n.x * R, y: cy + n.y * R, ph: n.ph }));
    glow(ctx, cx, cy, R * 0.5, this.col, 0.05 * al);
    const waveR = (t * 0.16) % 1.4,
      waveR2 = (t * 0.16 + 0.7) % 1.4;
    const pulseAt = (d: number) =>
      Math.max(0, 1 - Math.abs(d - waveR) * 4.5) + 0.7 * Math.max(0, 1 - Math.abs(d - waveR2) * 4.5);
    for (const [a, b] of this.edges) {
      const A = P[a],
        B = P[b];
      const mx = (A.x + B.x) / 2 - cx,
        my = (A.y + B.y) / 2 - cy;
      const d = Math.hypot(mx, my) / R;
      const pulse = pulseAt(d);
      lineGlow(ctx, [A.x, A.y, B.x, B.y], this.col, (0.13 + 0.26 * pulse) * al, 1.1 + pulse * 1.0);
    }
    for (const p of P) {
      const d = Math.hypot(p.x - cx, p.y - cy) / R;
      const pulse = pulseAt(d);
      const br = 0.5 + 0.6 * Math.min(1, pulse) + 0.12 * Math.sin(t * 0.6 + p.ph);
      glow(ctx, p.x, p.y, 9 * sc, this.col, br * 0.6 * al);
      glow(ctx, p.x, p.y, 2.6 * sc, '190,205,245', br * 0.5 * al);
    }
  }
}

// L9 거품 — 양자 요동 거품. 은청. 무작위 버블 생성/소멸(확률적), 비어있음.
class FoamWorld implements World {
  slug = 'fm';
  name = '거품층 — Quantum Foam';
  void = '#05070a';
  col = '143,168,176';
  private bubbles: { x: number; y: number; sz: number; life: number; dur: number }[] = [];
  private seed = makeRng(909);
  private spawn = 0;
  init(): void {
    this.bubbles = [];
    this.seed = makeRng(909);
    this.spawn = 0;
  }
  draw(
    ctx: CanvasRenderingContext2D,
    _t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
    dt = 1 / 60,
  ): void {
    const R = Math.min(W, H) * 0.5;
    // 확률적 생성·소멸 — dt 기반(탭 백그라운드 안정). 프로토타입은 1/60 고정, 여기선 dt 전달.
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.spawn = 0.03 + this.seed() * 0.07;
      const a = this.seed() * TAU,
        rr = Math.pow(this.seed(), 0.5) * 0.46;
      this.bubbles.push({
        x: cx + Math.cos(a) * rr * R,
        y: cy + Math.sin(a) * rr * R,
        sz: 6 + this.seed() * 20,
        life: 0,
        dur: 0.7 + this.seed() * 1.7,
      });
    }
    if (this.bubbles.length > 110) this.bubbles.splice(0, this.bubbles.length - 110);
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.life += dt;
      const u = b.life / b.dur;
      if (u >= 1) {
        this.bubbles.splice(i, 1);
        continue;
      }
      const env = Math.sin(u * Math.PI);
      const grow = 0.6 + 0.4 * u;
      glow(ctx, b.x, b.y, b.sz * sc * grow, this.col, env * 0.55 * al);
      glow(ctx, b.x, b.y, b.sz * 0.28 * sc, '200,218,222', env * 0.45 * al);
      if (b.sz > 10) {
        ctx.strokeStyle = `rgba(${this.col},${env * 0.2 * al})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.sz * sc * grow * 0.9, 0, TAU);
        ctx.stroke();
      }
    }
    glow(ctx, cx, cy, R * 0.42 * sc, this.col, 0.05 * al);
  }
}

// L10 정보 — 홀로그래픽. 청록. 얇은 스캔라인 평면 + 흐르는 데이터 스트림.
class InfoWorld implements World {
  slug = 'inf';
  name = '정보층 — Information';
  void = '#04060a';
  col = '95,176,192';
  private streams: { x: number; sp: number; ph: number; dir: number }[] = [];
  init(): void {
    const r = makeRng(1010);
    this.streams = [];
    for (let i = 0; i < 7; i++)
      this.streams.push({
        x: (i - 3) / 3.4,
        sp: 0.1 + r() * 0.12,
        ph: r() * TAU,
        dir: r() < 0.5 ? 1 : -1,
      });
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5;
    const halfH = R * 0.62 * sc;
    glow(ctx, cx, cy, R * 0.6 * sc, this.col, 0.05 * al);
    const lines = 26;
    const scan = (t * 0.08) % 1;
    for (let i = 0; i < lines; i++) {
      const u = i / (lines - 1);
      const y = cy - halfH + u * halfH * 2;
      const sweep = 0.04 + 0.04 * Math.sin(t * 0.4 + u * 6);
      const w = R * 0.6 * sc * (0.72 + 0.28 * Math.sin(t * 0.2 + u * 3));
      const near = Math.max(0, 1 - Math.abs(u - scan) * 6);
      const sl = 0.12 + 0.05 * Math.sin(t * 0.6 + u * 2.0) + 0.22 * near;
      ctx.strokeStyle = `rgba(${this.col},${sl * al})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - w, y + sweep * 30 * sc);
      ctx.lineTo(cx + w, y - sweep * 30 * sc);
      ctx.stroke();
    }
    for (const s of this.streams) {
      const sx = cx + s.x * R * 0.5 * sc;
      const flow = (t * s.sp + s.ph) % 1;
      for (let p = 0; p < 7; p++) {
        const u0 = (flow + p / 7) % 1;
        const u = s.dir > 0 ? u0 : 1 - u0;
        const y = cy - halfH + u * halfH * 2;
        const br = Math.sin(u * Math.PI) * (0.7 + 0.3 * Math.sin(t * 1.0 + p));
        glow(ctx, sx, y, 8 * sc, this.col, br * 0.85 * al);
        glow(ctx, sx, y, 2.4 * sc, '210,242,248', br * 0.7 * al);
        const ty = y - s.dir * 10 * sc;
        glow(ctx, sx, ty, 4 * sc, this.col, br * 0.3 * al);
      }
      ctx.strokeStyle = `rgba(${this.col},${0.06 * al})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, cy - halfH);
      ctx.lineTo(sx, cy + halfH);
      ctx.stroke();
    }
  }
}

// L11 플랑크 — 픽셀 격자 붕괴. 순백. 이산 타일, 시공간이 눈금으로 깨짐.
class PlanckWorld implements World {
  slug = 'plk';
  name = '플랑크층 — Planck';
  void = '#000000';
  col = '244,246,248';
  // 시머는 결정적 sin(시드 불필요) — 프로토타입의 미사용 rng 제거.
  init(): void {
    /* 정적 격자(시드 없음). */
  }
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    cx: number,
    cy: number,
    sc: number,
    al: number,
    W: number,
    H: number,
  ): void {
    const R = Math.min(W, H) * 0.5;
    const cell = 14 * sc;
    const span = R * 0.66 * sc;
    glow(ctx, cx, cy, R * 0.3 * sc, '255,255,255', 0.1 * al);
    glow(ctx, cx, cy, R * 0.14 * sc, '255,255,255', 0.22 * al);
    const frac = 0.3 + 0.16 * Math.sin(t * 0.3);
    const cols = Math.ceil((span * 2) / cell),
      rows = Math.ceil((span * 2) / cell);
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const gx = cx - span + i * cell + cell * 0.5,
          gy = cy - span + j * cell + cell * 0.5;
        const dx = gx - cx,
          dy = gy - cy;
        const d = Math.hypot(dx, dy) / R;
        if (d > 0.66) continue;
        const fall = 1 - d / 0.66;
        const shim = 0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7 + j * 2.3);
        const crack = Math.max(0, 1 - Math.abs(d - frac) * 8);
        const br = fall * fall * (0.5 + 0.45 * shim) + crack * 0.35 * fall;
        if (br < 0.05) continue;
        const tw = cell * 0.78;
        ctx.fillStyle = `rgba(${this.col},${Math.min(0.95, br * 0.7) * al})`;
        ctx.fillRect(gx - tw / 2, gy - tw / 2, tw, tw);
        if (br > 0.5) {
          ctx.fillStyle = `rgba(255,255,255,${(br - 0.5) * 1.2 * al})`;
          ctx.fillRect(gx - tw * 0.3, gy - tw * 0.3, tw * 0.6, tw * 0.6);
        }
      }
    // 격자선 — 시공간 눈금. globalAlpha를 쓰므로 그린 뒤 1로 복원(호출자 상태 보호).
    ctx.strokeStyle = `rgba(${this.col},${0.09 * al})`;
    ctx.lineWidth = 1;
    const prevA = ctx.globalAlpha;
    for (let i = 0; i <= cols; i++) {
      const x = cx - span + i * cell;
      const fade = 1 - Math.abs(x - cx) / span;
      if (fade <= 0) continue;
      ctx.globalAlpha = fade * al;
      ctx.beginPath();
      ctx.moveTo(x, cy - span * fade);
      ctx.lineTo(x, cy + span * fade);
      ctx.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      const y = cy - span + j * cell;
      const fade = 1 - Math.abs(y - cy) / span;
      if (fade <= 0) continue;
      ctx.globalAlpha = fade * al;
      ctx.beginPath();
      ctx.moveTo(cx - span * fade, y);
      ctx.lineTo(cx + span * fade, y);
      ctx.stroke();
    }
    ctx.globalAlpha = prevA;
  }
}

/** 11세계(층 순서 = layers.ts index 1..11). slug로 1:1 매핑. */
export const WORLDS: World[] = [
  new MoleculeWorld(),
  new AtomWorld(),
  new NucleusWorld(),
  new NucleonWorld(),
  new QuarkWorld(),
  new PreonWorld(),
  new StringWorld(),
  new LoopWorld(),
  new FoamWorld(),
  new InfoWorld(),
  new PlanckWorld(),
];

/** slug → 세계 인덱스(없으면 0=분자). 게임 현재 층 slug로 어느 세계를 그릴지 결정. */
export function worldIndexForSlug(slug: string): number {
  const i = WORLDS.findIndex((w) => w.slug === slug);
  return i < 0 ? 0 : i;
}

let initialized = false;
/** 모든 세계의 결정적 배치를 1회 생성(부팅 시). 중복 호출 무해. */
export function initWorlds(): void {
  if (initialized) return;
  for (const w of WORLDS) w.init();
  initialized = true;
}
