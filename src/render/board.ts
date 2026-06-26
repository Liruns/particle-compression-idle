/**
 * render/board — 다이제틱 공허 게임판 전경(이관 2단계, cosmic-direction §3·§4).
 *
 *  WorldRenderer가 그린 "세계 배경" 위에, 게임의 살아있는 빛을 lighter 합성으로 얹는다:
 *   - 중심 코어 = 떨어지는 점(관조 디폴트의 심장, 현재 층 발광색). (§3-B)
 *   - 8 궤도 껍질 = 8단 압축기 체인. 안쪽=저티어, 바깥=고티어. 보유량이 곧 켜의 밝기·점밀도·회전.
 *     "결속한 입자가 쌓인 구조가 보인다" = 작아짐=강해짐의 직접 구현(§3-C 궤도 껍질).
 *   - 떠다니는 세포 = 만질 물질. 만지면 압축·흡수(능동, §4 수동 압축). 흡수=중심으로 수축.
 *   - dec 진행 호 = 다음 세계로의 하강 게이트(외곽 둘레 빛 채움).
 *
 *  ★표현 전담·읽기전용: 게임 상태를 변형하지 않는다(cosmic-direction §6). 입력은 snapshot에서
 *   파생한 number/boolean/string만(BoardInput) — Decimal·Set 직접 접근 0(V2-8 경계 규율).
 *   상호작용은 히트테스트 결과만 돌려주고(grab/shellAt), 실제 game 호출은 App이 한다(단방향 §4.1).
 *  ★발광(art §2-C·F8): 모든 빛은 radial halo를 가진 광원에서만. 카드/테두리/박스 0(§3-A 폐기).
 *  ★고요(art §7): 상시 줌 없음, 번쩍임 0, 호흡만. reduced-motion이면 드리프트·맥동·트윙클 정지.
 *  ★프로토타입(prototypes/cosmic-particle-game.html) 검증 손맛을 이식하되, 모크 이코노미가 아니라
 *   실제 체인(buy/owned/affordable)·실제 능동(manualCompress)에 연결한다.
 */

const TAU = Math.PI * 2;

/** 한 껍질(=체인 티어) 표시 입력. owned는 number 파생(ownedLog10)으로만 — Decimal 미유입. */
export interface BoardShell {
  /** 1-기반 티어(1..8). */
  tier: number;
  /** log10(owned). owned≤0이면 음의 sentinel(예: -1) — 밝기/점밀도 0 처리. */
  ownedLog10: number;
  /** 구매 개수(정수, 점 개수 보강용). */
  bought: number;
  /** 해금 여부(미해금 껍질은 그리지 않음 — 점진 공개). */
  unlocked: boolean;
  /** 현재 결속(구매) 가능 — 부름 맥동 주인공 판정. */
  affordable: boolean;
  /** 생산 중(owned>0) — 빈 껍질과 구분. */
  producing: boolean;
  /** 최적(가장 싼 다음 구매) 티어 — ▶ 부름 강조. */
  best: boolean;
  /** 호버 툴팁용 사전 포맷 문자열(App이 formatNumber로 생성 — Decimal 미유입). */
  nameKo: string;
  costLabel: string;
  rateLabel: string;
}

/**
 * 오비탈 공명 다이제틱 입력(§4 표 2행). 슬롯/카운트다운 링 → "궤도를 도는 전자를 공명 타이밍에 클릭".
 *  active=원자~쿼크층(L2~5), open=슬롯 열림(클릭 유효), progress=현재 phase 진행 0..1.
 */
export interface BoardResonance {
  active: boolean;
  open: boolean;
  progress: number;
}

/** 게임판 한 프레임 입력(읽기전용 파생). */
export interface BoardInput {
  /** 해금된 껍질만(저→고 티어 순). 빈 배열이면 껍질 미표시(FTUE 체인 전). */
  shells: BoardShell[];
  /** 다음 세계 하강 진행 0..1(현재 층 decade 진행도). 외곽 게이트 호. */
  decadeProgress: number;
  /** E 잔량 라벨(껍질 호버 시 부족 사유 표시용). 사전 포맷. */
  energyLabel: string;
  /** 오비탈 공명 상태(원자층+). 비활성이면 active=false — 전자 미표시. */
  resonance: BoardResonance;
}

/** 히트테스트 결과 — App이 game 호출을 분기. */
export type BoardHit =
  | { kind: 'cell' }
  | { kind: 'shell'; tier: number }
  | { kind: 'resonance' }
  | { kind: 'none' };

/** 자원 발광색(§3-C 탈채도, 단일 악센트 해체). E 금 / 화이트 양자대용은 미사용. */
const COL_CELL_NUC = '214,232,208'; // 세포 핵점(따뜻한 흰빛)
const COL_FLIGHT = '235,244,250'; // 결속 비행 흰빛

/** 8 티어 발광색(탈채도 — 색온도 따뜻→차가움. art §2-B 정신). 'r,g,b'. */
const SHELL_COLORS: string[] = [
  '158,184,144', // T1 sage
  '127,176,184', // T2 teal
  '217,154,108', // T3 amber
  '199,138,154', // T4 분홍
  '122,159,192', // T5 청
  '216,224,228', // T6 탈색 흰
  '138,127,208', // T7 보라
  '196,122,154', // T8 자홍
];

interface Cell {
  a: number;
  dist: number;
  dax: number;
  day: number;
  ph: number;
  sp: number;
  sz: number;
  baseSz: number;
  nuc: number;
  nx: number;
  ny: number;
  div: number;
  dsp: number;
  hover: number;
  state: 'float' | 'captured';
  cap: number;
  capFromX: number;
  capFromY: number;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  dur: number;
  col: string;
  sz: number;
}
interface BindFlight {
  tier: number;
  t: number;
  dur: number;
  angle: number;
  delay: number;
}
interface FloatText {
  x: number;
  y: number;
  str: string;
  col: string;
  t: number;
  dur: number;
}

const CELL_TARGET = 15;

function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
function fract(x: number): number {
  return x - Math.floor(x);
}

/** 결정적 난수(layer-worlds와 동일 — 세포 시드용. 표현 전용이라 결정성은 권장사항). */
function makeRng(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BoardRenderer {
  private input: BoardInput = {
    shells: [],
    decadeProgress: 0,
    energyLabel: '0',
    resonance: { active: false, open: false, progress: 0 },
  };
  private reducedMotion = false;
  /** 현재 층 발광색('r,g,b') — WorldRenderer가 매 프레임 공급(전환 보간 포함). 코어·자유빛이 따른다. */
  private layerColor = '159,184,154';

  // 화면 기하(draw에서 갱신 — 히트테스트가 같은 값 사용).
  private cx = 0;
  private cy = 0;
  private minDim = 0;
  private nowSec = 0;

  // 표현 상태(렌더 전용 — 세이브 무관).
  private cells: Cell[] = [];
  private sparks: Spark[] = [];
  private flights: BindFlight[] = [];
  private floatTexts: FloatText[] = [];
  private cellSeed = makeRng(4242);
  private cellRespawn = 0;
  private coreFlash = 0;

  // 껍질 보간 상태(티어 인덱스 0..7).
  private shellBloom = new Array<number>(8).fill(0);
  private bindPulse = new Array<number>(8).fill(0);
  private affordPulse = new Array<number>(8).fill(0);

  // 포인터/호버.
  private pointerX = -1;
  private pointerY = -1;
  private hoverCell = -1;
  private hoverShellTier = 0; // 1-기반, 0=없음
  private hoverResonance = false; // 공명 전자 위(클릭 유효: open일 때만)
  private resonancePulse = 0; // 공명 성공 잔광(0..1)
  private resonanceMissPulse = 0; // 빗맞춤(닫힌 슬롯 클릭) 옅은 신호

  constructor() {
    this.seedCells();
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }
  setLayerColor(rgb: string): void {
    this.layerColor = rgb;
  }
  setInput(input: BoardInput): void {
    this.input = input;
  }

  /** 세계가 바뀌면 새 세계의 물질(세포)로 교체 — 만질 대상도 세계 따라 달라짐. */
  reseedCells(): void {
    this.seedCells();
  }

  private seedCells(): void {
    this.cells = [];
    for (let i = 0; i < CELL_TARGET; i++) this.spawnCell(false);
  }
  private spawnCell(atEdge: boolean): void {
    const r = this.cellSeed;
    let a: number, dist: number;
    if (atEdge) {
      a = r() * TAU;
      dist = 0.52 + r() * 0.06;
    } else {
      a = r() * TAU;
      dist = 0.18 + r() * 0.34;
    }
    const sz = 15 + r() * 26;
    this.cells.push({
      a,
      dist,
      dax: (r() - 0.5) * 0.016,
      day: (r() - 0.5) * 0.016,
      ph: r() * TAU,
      sp: 0.06 + r() * 0.1,
      sz,
      baseSz: sz,
      nuc: 0.42 + r() * 0.4,
      nx: (r() - 0.5) * 0.34,
      ny: (r() - 0.5) * 0.34,
      div: r() * TAU,
      dsp: 0.05 + r() * 0.06,
      hover: 0,
      state: 'float',
      cap: 0,
      capFromX: 0,
      capFromY: 0,
    });
  }

  // ── 포인터 입력(App이 캔버스 좌표로 호출). 좌표는 CSS px(draw와 동일계). ──
  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
  }
  clearPointer(): void {
    this.pointerX = -1;
    this.pointerY = -1;
    this.hoverCell = -1;
    this.hoverShellTier = 0;
  }

  /** 현재 세포 좌표(드리프트 적분). reduced-motion이면 정적 위치. */
  private cellPos(c: Cell): { x: number; y: number } {
    const R = this.minDim * 0.5;
    if (this.reducedMotion) {
      return { x: this.cx + Math.cos(c.a) * c.dist * R, y: this.cy + Math.sin(c.a) * c.dist * R };
    }
    const t = this.nowSec;
    const aa = c.a + Math.sin(t * c.sp + c.ph) * 0.18 + t * c.dax;
    const dd = c.dist + Math.cos(t * c.sp * 0.8 + c.ph) * 0.04 + Math.sin(t * c.day * 6) * 0.01;
    return { x: this.cx + Math.cos(aa) * dd * R, y: this.cy + Math.sin(aa) * dd * R };
  }

  /** 껍질 반지름(티어 1-기반). 안쪽 촘촘 → 외곽. 화면 단변 기준. */
  private shellRadius(tier: number): number {
    const r0 = this.minDim * 0.11;
    const r1 = this.minDim * 0.44;
    const u = (tier - 1) / 7;
    return r0 + (r1 - r0) * Math.pow(u, 0.92);
  }

  /** 공명 전자의 현재 화면 좌표(외곽 궤도를 도는 전자, §4 표 2행). */
  private resonancePos(): { x: number; y: number; r: number } {
    const rad = this.minDim * 0.3; // 중간 궤도(잘 보이는 전용 전자). open일 때만 히트 → 껍질 클릭과 비충돌.
    const ang = this.reducedMotion ? -Math.PI * 0.5 : -Math.PI * 0.5 + this.nowSec * 0.5;
    return { x: this.cx + Math.cos(ang) * rad, y: this.cy + Math.sin(ang) * rad, r: rad };
  }

  /** 마우스 아래 무엇? 세포 우선(능동) → 공명 전자(타이밍) → 껍질(엔진). */
  private updateHover(): void {
    this.hoverCell = -1;
    this.hoverShellTier = 0;
    this.hoverResonance = false;
    if (this.pointerX < 0) return;
    // 1) 세포(가장 가까운 float, 반경 내).
    let bestC = -1;
    let bestCD = 1e9;
    for (let i = 0; i < this.cells.length; i++) {
      const c = this.cells[i];
      if (c.state !== 'float') continue;
      const p = this.cellPos(c);
      const d = Math.hypot(this.pointerX - p.x, this.pointerY - p.y);
      const hitR = c.sz * 0.95 + 10;
      if (d < hitR && d < bestCD) {
        bestCD = d;
        bestC = i;
      }
    }
    if (bestC >= 0) {
      this.hoverCell = bestC;
      return;
    }
    // 2) 공명 전자 — 열린 슬롯일 때만 히트(닫히면 껍질 클릭을 막지 않음). 근처를 너그럽게(타이밍 손맛).
    if (this.input.resonance.active && this.input.resonance.open) {
      const e = this.resonancePos();
      if (Math.hypot(this.pointerX - e.x, this.pointerY - e.y) < this.minDim * 0.08) {
        this.hoverResonance = true;
        return;
      }
    }
    // 3) 껍질(가장 가까운 궤도, 좁은 밴드). 해금된 티어만.
    const dist = Math.hypot(this.pointerX - this.cx, this.pointerY - this.cy);
    let bestTier = 0;
    let bestSD = 1e9;
    for (const s of this.input.shells) {
      const d = Math.abs(dist - this.shellRadius(s.tier));
      if (d < bestSD) {
        bestSD = d;
        bestTier = s.tier;
      }
    }
    if (bestTier > 0 && bestSD < this.minDim * 0.03) this.hoverShellTier = bestTier;
  }

  /**
   * 포인터 다운/탭 시 호출 — 무엇을 만졌는지 돌려준다(세포면 흡수 애니 시작).
   *  App은 결과로 game.manualCompress()(cell) / game.buy(tier)(shell)을 호출한다.
   */
  activate(): BoardHit {
    this.updateHover();
    if (this.hoverCell >= 0) {
      this.beginCapture(this.hoverCell);
      return { kind: 'cell' };
    }
    if (this.hoverResonance) {
      // open이면 공명(성공), closed면 빗맞춤 신호만 — game 호출은 App이 분기.
      return { kind: 'resonance' };
    }
    if (this.hoverShellTier > 0) return { kind: 'shell', tier: this.hoverShellTier };
    return { kind: 'none' };
  }

  /** 드래그 중 지나가는 float 세포를 잡아 흡수(쓸어담기). 새로 잡힌 수를 돌려줌(App이 그만큼 compress). */
  dragAbsorb(x: number, y: number): number {
    let n = 0;
    for (const c of this.cells) {
      if (c.state !== 'float') continue;
      const p = this.cellPos(c);
      if (Math.hypot(x - p.x, y - p.y) < c.sz * 0.9 + 8) {
        c.state = 'captured';
        c.cap = 0;
        c.capFromX = p.x;
        c.capFromY = p.y;
        n++;
      }
    }
    return n;
  }

  private beginCapture(idx: number): void {
    const c = this.cells[idx];
    const p = this.cellPos(c);
    c.state = 'captured';
    c.cap = 0;
    c.capFromX = p.x;
    c.capFromY = p.y;
  }

  /** 결속(구매) 피드백 — 중심에서 그 껍질로 양자가 날아가 궤도에 합류. App이 buy 성공 시 호출. */
  onBind(tier: number, count: number): void {
    const n = Math.min(Math.max(1, count), 6);
    for (let k = 0; k < n; k++) {
      this.flights.push({
        tier,
        t: 0,
        dur: 0.5 + this.cellSeed() * 0.25,
        angle: this.cellSeed() * TAU,
        delay: k * 0.05,
      });
    }
    this.bindPulse[tier - 1] = 1;
  }

  /** 흡수 보상 떠오르는 수치(App이 manualCompress 후 실제 획득량으로 호출). 중심에서. */
  spawnCenterText(str: string, colorRgb: string): void {
    this.floatTexts.push({ x: this.cx, y: this.cy - 14, str, col: colorRgb, t: 0, dur: 1.1 });
  }

  /** 공명 클릭 결과 피드백(App이 clickResonance 결과로 호출). 성공=잔광+잔광 파편+"공명". */
  onResonance(success: boolean): void {
    const e = this.resonancePos();
    if (success) {
      this.resonancePulse = 1;
      this.spawnAbsorbSparks(e.x, e.y, this.atomColor());
      this.floatTexts.push({ x: e.x, y: e.y - 12, str: '공명', col: '205,233,238', t: 0, dur: 1.0 });
    } else {
      this.resonanceMissPulse = 1;
    }
  }

  /** 공명 전자 색(원자층 teal 계열 — 세계색과 무관하게 전자다움 유지). */
  private atomColor(): string {
    return '160,210,222';
  }

  // ── 발광 헬퍼(lighter 합성 전제). ──
  private glow(
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

  /**
   * 게임판 전경 한 프레임. ctx는 호출자(CanvasRenderer)가 lighter로 세팅(세계 위 가산 합성).
   *  W,H=CSS px, dt=초(클램프됨), nowSec=누적 시간(초). 끝에서 source-over로 복원.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    dt: number,
    nowSec: number,
  ): void {
    if (W <= 0 || H <= 0) return;
    this.cx = W / 2;
    this.cy = H / 2;
    this.minDim = Math.min(W, H);
    this.nowSec = nowSec;

    let d = dt;
    if (d < 0) d = 0;
    if (d > 0.1) d = 0.1;

    this.updateHover();
    this.updateCellSpawn(d);

    const shells = this.input.shells;
    const callTier = this.bestCallTier();

    // 보간 전진(부드러움). reduced-motion이면 즉시값(애니 정지).
    for (let i = 0; i < 8; i++) {
      const tier = i + 1;
      const isHover = this.hoverShellTier === tier ? 1 : 0;
      const isCall = callTier === tier ? 1 : 0;
      if (this.reducedMotion) {
        this.shellBloom[i] = isHover;
        this.bindPulse[i] = 0;
        this.affordPulse[i] = isCall;
      } else {
        this.shellBloom[i] += (isHover - this.shellBloom[i]) * Math.min(1, d * 6);
        this.bindPulse[i] += (0 - this.bindPulse[i]) * Math.min(1, d * 1.6);
        this.affordPulse[i] += (isCall - this.affordPulse[i]) * Math.min(1, d * 3);
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    const breath = this.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(nowSec * (TAU / 7));

    // 1) 껍질(엔진) — 안→밖.
    for (const s of shells) this.drawShell(ctx, s, nowSec);
    // 2) 결속 비행(중심→껍질).
    this.drawFlights(ctx, d);
    // 3) 중심 코어(관조 디폴트 심장).
    this.drawCenter(ctx, breath, d);
    // 4) 떠다니는 세포(만질 물질).
    this.drawCells(ctx, d);
    // 5) 흡수 잔광.
    this.drawSparks(ctx, d);
    // 5b) 공명 전자(활성 시) — 궤도를 도는 전자, open이면 클릭 가능(§4 표 2행).
    if (this.input.resonance.active) this.drawResonance(ctx, nowSec, d);
    // 6) dec 진행 호(다음 세계 하강 게이트).
    this.drawDecArc(ctx);
    // 7) 호버 툴팁(세포/껍질) — 공허에 뜬 텍스트.
    if (this.hoverCell >= 0) this.drawCellHover(ctx, this.cells[this.hoverCell]);
    else if (this.hoverShellTier > 0) this.drawShellHover(ctx, this.hoverShellTier);
    // 8) 떠오르는 수치(흡수 보상).
    this.drawFloatTexts(ctx, d);

    ctx.globalCompositeOperation = 'source-over';
  }

  /** 가장 싼 결속 가능 껍질(부름 맥동 주인공) = best 플래그 티어. */
  private bestCallTier(): number {
    for (const s of this.input.shells) if (s.best && s.affordable) return s.tier;
    for (const s of this.input.shells) if (s.affordable) return s.tier;
    return 0;
  }

  private shellByTier(tier: number): BoardShell | undefined {
    return this.input.shells.find((s) => s.tier === tier);
  }

  /** 한 껍질의 빛. 보유=밝기·점밀도·회전. 빈 껍질=어둡고 정적. 결속가능=따뜻한 맥동. */
  private drawShell(ctx: CanvasRenderingContext2D, s: BoardShell, now: number): void {
    const i = s.tier - 1;
    const r = this.shellRadius(s.tier);
    const col = SHELL_COLORS[i] ?? this.layerColor;
    const owned = s.ownedLog10 > 0 ? s.ownedLog10 : 0;
    const boundNorm = s.producing ? Math.min(1, owned / 6) : 0;
    const can = s.affordable;
    const bloom = this.shellBloom[i];
    const buyP = this.bindPulse[i];
    const call = this.affordPulse[i];
    const dir = i % 2 === 0 ? 1 : -1;
    const spin = this.reducedMotion ? 0 : dir * (0.04 + boundNorm * 0.5 + i * 0.006);
    const ang0 = now * spin;

    let baseA = 0.05 + boundNorm * 0.5;
    let callGlow = 0;
    if (!s.producing)
      baseA = can ? 0.08 + (this.reducedMotion ? 0.04 : 0.05 * (0.5 + 0.5 * Math.sin(now * 3))) : 0.025;
    if (can)
      callGlow =
        (0.1 + 0.18 * call) *
        (this.reducedMotion ? 0.8 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 2.4 + i)));
    const bloomGlow = bloom * 0.5 + buyP * 0.6;
    const ringA = baseA + callGlow * 0.6 + bloomGlow * 0.5;

    ctx.save();
    ctx.translate(this.cx, this.cy);
    if (ringA > 0.018) {
      const lw = 0.7 + boundNorm * 0.6 + bloom * 1.0 + buyP * 1.2;
      const haloA = bloom * 0.5 + buyP * 0.7 + call * 0.25;
      if (haloA > 0.01) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.strokeStyle = `rgba(${col},${Math.min(0.5, ringA * 0.5 * haloA + 0.035)})`;
        ctx.lineWidth = lw + 5 + haloA * 8;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.strokeStyle = `rgba(${col},${ringA * 0.7})`;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    // 결속 양자 = 궤도 위 발광 점. 수가 보유에 비례(쌓인 구조가 보인다).
    const dotCount = !s.producing
      ? can
        ? 4
        : 0
      : Math.max(3, Math.min(46, 4 + Math.floor(owned * 16 * 0.2) + (s.bought % 6)));
    const dotBaseR = 1.0 + boundNorm * 1.6 + bloom * 0.9;
    let brightBudget = 10;
    for (let k = 0; k < dotCount; k++) {
      const a = ang0 + (k / dotCount) * TAU;
      const h = fract(Math.sin(k * 12.9898 + i * 7.13) * 43758.5453);
      const twinkle = this.reducedMotion ? 0.8 : 0.55 + 0.45 * Math.sin(now * (0.6 + h) + k);
      const pr = dotBaseR * (0.6 + 0.8 * h);
      const pa = (ringA * 0.85 + bloomGlow * 0.4) * (0.45 + 0.55 * twinkle) * (0.45 + 0.55 * h);
      if (pa < 0.02) continue;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (pa > 0.3 && brightBudget > 0) {
        brightBudget--;
        this.glow(ctx, px, py, pr * 3.2 + 2, col, Math.min(0.5, pa * 0.5));
      }
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, TAU);
      ctx.fillStyle = `rgba(${col},${Math.min(0.95, pa)})`;
      ctx.fill();
    }
    ctx.restore();
  }

  private drawFlights(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let k = this.flights.length - 1; k >= 0; k--) {
      const f = this.flights[k];
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }
      f.t += dt;
      const u = clamp(f.t / f.dur, 0, 1);
      if (u >= 1) {
        this.flights.splice(k, 1);
        continue;
      }
      const e = easeOutCubic(u);
      const r = this.shellRadius(f.tier) * e;
      const col = SHELL_COLORS[f.tier - 1] ?? this.layerColor;
      const x = this.cx + Math.cos(f.angle) * r;
      const y = this.cy + Math.sin(f.angle) * r;
      const a = (1 - Math.abs(u - 0.5) * 1.4) * 0.9;
      this.glow(ctx, x, y, 5 + 6 * (1 - u), col, a * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + 1.4 * (1 - u), 0, TAU);
      ctx.fillStyle = `rgba(${COL_FLIGHT},${a * 0.8})`;
      ctx.fill();
    }
  }

  private drawCenter(ctx: CanvasRenderingContext2D, breath: number, dt: number): void {
    const col = this.layerColor;
    const pulse = 0.7 + 0.3 * breath + this.coreFlash * 0.5;
    this.coreFlash *= Math.pow(0.9, dt * 60);
    if (this.coreFlash < 0.001) this.coreFlash = 0;
    const coreR = (4.5 + this.coreFlash * 5) * pulse;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 7);
    g.addColorStop(0, `rgba(${col},${0.5 * pulse + this.coreFlash * 0.3})`);
    g.addColorStop(0.4, `rgba(${col},${0.12 * pulse})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 7, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, TAU);
    ctx.fillStyle = `rgba(245,250,255,${0.85 * pulse})`;
    ctx.fill();
    ctx.restore();
  }

  private drawCells(ctx: CanvasRenderingContext2D, dt: number): void {
    const wcol = this.layerColor;
    const now = this.nowSec;
    for (let i = this.cells.length - 1; i >= 0; i--) {
      const c = this.cells[i];
      const want = i === this.hoverCell ? 1 : 0;
      c.hover += (want - c.hover) * Math.min(1, dt * 8);

      if (c.state === 'captured') {
        c.cap += dt / 0.42;
        const u = clamp(c.cap, 0, 1);
        const e = easeOutCubic(u);
        const x = lerp(c.capFromX, this.cx, e);
        const y = lerp(c.capFromY, this.cy, e);
        const sz = c.baseSz * (1 - e * 0.85);
        const br = (1 - u) * 0.9 + 0.3;
        this.glow(ctx, x, y, sz * 1.5, wcol, br * 0.6);
        this.glow(ctx, x, y, sz * 0.6, COL_CELL_NUC, br * 0.5);
        if (u >= 1) {
          this.coreFlash = Math.min(1.4, this.coreFlash + 0.7);
          this.spawnAbsorbSparks(this.cx, this.cy, wcol);
          this.cells.splice(i, 1);
          this.cellRespawn = Math.min(this.cellRespawn, 0);
          continue;
        }
        continue;
      }

      const p = this.cellPos(c);
      const hov = c.hover;
      const br = this.reducedMotion
        ? 0.5 + hov * 0.5
        : 0.42 + 0.22 * Math.sin(now * 0.4 + c.ph) + hov * 0.5;
      const grow = this.reducedMotion ? 1 + hov * 0.1 : 1 + 0.05 * Math.sin(now * c.dsp + c.div) + hov * 0.1;
      const sz = c.sz * grow;
      this.glow(ctx, p.x, p.y, sz * 1.35, wcol, br * 0.5);
      this.glow(ctx, p.x, p.y, sz * 0.62, wcol, br * 0.22);
      this.glow(ctx, p.x + c.nx * sz, p.y + c.ny * sz, sz * 0.3 * c.nuc, COL_CELL_NUC, br * 0.6);
      if (hov > 0.03) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz * 1.15, 0, TAU);
        ctx.strokeStyle = `rgba(235,247,235,${hov * 0.32})`;
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    }
  }

  private spawnAbsorbSparks(x: number, y: number, col: string): void {
    const n = 5 + Math.floor(this.cellSeed() * 3);
    for (let k = 0; k < n; k++) {
      const a = this.cellSeed() * TAU;
      const sp = 14 + this.cellSeed() * 30;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0,
        dur: 0.6 + this.cellSeed() * 0.4,
        col,
        sz: 1.5 + this.cellSeed() * 2.2,
      });
    }
  }
  private drawSparks(ctx: CanvasRenderingContext2D, dt: number): void {
    for (let k = this.sparks.length - 1; k >= 0; k--) {
      const s = this.sparks[k];
      s.t += dt;
      const u = clamp(s.t / s.dur, 0, 1);
      if (u >= 1) {
        this.sparks.splice(k, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.pow(0.93, dt * 60);
      s.vy *= Math.pow(0.93, dt * 60);
      const a = (1 - u) * 0.7;
      this.glow(ctx, s.x, s.y, s.sz * 2.4, s.col, a * 0.5);
    }
  }

  /**
   * 공명 전자(§4 표 2행). 외곽 궤도를 도는 전자 + 그 궤도의 옅은 자취.
   *  closed=카운트다운 호가 전자 둘레에 차오름(다음 열림 예고), open=전자가 환히 펄스(클릭 신호).
   *  성공 잔광(resonancePulse)·빗맞춤(resonanceMissPulse)은 여기서 감쇠.
   */
  private drawResonance(ctx: CanvasRenderingContext2D, now: number, dt: number): void {
    const e = this.resonancePos();
    const r = this.input.resonance;
    const decay = Math.pow(0.88, dt * 60);
    this.resonancePulse *= decay;
    this.resonanceMissPulse *= decay;
    if (this.resonancePulse < 0.001) this.resonancePulse = 0;
    if (this.resonanceMissPulse < 0.001) this.resonanceMissPulse = 0;
    const col = this.atomColor();

    // 궤도 자취(아주 옅은 원) — 전자가 어디를 도는지 암시.
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, e.r, 0, TAU);
    ctx.strokeStyle = `rgba(${col},${0.045 + this.resonancePulse * 0.05})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (r.open) {
      // 열림 — 환히 펄스(클릭 타이밍). hover면 더 밝게(잡을 수 있다).
      const beat = this.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(now * 6);
      const hov = this.hoverResonance ? 1 : 0;
      const a = 0.7 + 0.3 * beat;
      this.glow(ctx, e.x, e.y, 22 + hov * 8, col, (0.55 + 0.25 * hov) * a + this.resonancePulse * 0.4);
      this.glow(ctx, e.x, e.y, 5, '225,244,247', a);
      // 열림 링 — "여기를 눌러" 신호.
      ctx.beginPath();
      ctx.arc(e.x, e.y, 13 + (this.reducedMotion ? 0 : 3 * Math.sin(now * 6)), 0, TAU);
      ctx.strokeStyle = `rgba(225,244,247,${0.4 * a})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      // 닫힘 — 옅은 전자 + 둘레 카운트다운 호(다음 열림까지 progress).
      this.glow(ctx, e.x, e.y, 11, col, 0.32);
      this.glow(ctx, e.x, e.y, 3, '225,244,247', 0.42);
      const p = clamp(r.progress, 0, 1);
      if (p > 0.001) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, 10, -Math.PI / 2, -Math.PI / 2 + p * TAU);
        ctx.strokeStyle = `rgba(${col},0.4)`;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
    if (this.resonanceMissPulse > 0.01) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, 16, 0, TAU);
      ctx.strokeStyle = `rgba(150,168,178,${0.3 * this.resonanceMissPulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** dec 진행 호 — 외곽 둘레 빛의 채움(다음 세계 하강이 가까워진다). 임박하면 하강 힌트. */
  private drawDecArc(ctx: CanvasRenderingContext2D): void {
    const frac = clamp(this.input.decadeProgress, 0, 1);
    if (frac <= 0.001) return;
    const col = this.layerColor;
    const r = this.shellRadius(8) + this.minDim * 0.06;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + frac * TAU);
    ctx.strokeStyle = `rgba(${col},${0.1 + 0.22 * frac})`;
    ctx.lineWidth = 1.0 + frac * 1.6;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
    // 임박 — 더 깊은 곳이 열린다(프로토타입 이식). 호 하단에 조용히 떠오름.
    if (frac > 0.8) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = "11px 'IBM Plex Sans KR', sans-serif";
      ctx.fillStyle = `rgba(${col},${((frac - 0.8) / 0.2) * 0.5})`;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 10;
      ctx.fillText('더 깊은 곳이 열린다', this.cx, this.cy + r + 22);
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'lighter';
    }
  }

  // ── 호버 툴팁(source-over 텍스트 — 공허에 직접, 테두리 0). 그린 뒤 lighter 복원. ──
  private drawCellHover(ctx: CanvasRenderingContext2D, c: Cell): void {
    if (c.state !== 'float') return;
    const p = this.cellPos(c);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 10;
    const ax = p.x + c.sz * 0.9 + 10;
    const ay = p.y - 2;
    ctx.font = "600 12px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.fillStyle = 'rgba(228,242,228,0.72)';
    ctx.fillText('압축 — 만져서 흡수', ax, ay);
    ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.fillStyle = 'rgba(217,184,106,0.62)';
    ctx.fillText('+E · +C', ax, ay + 15);
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'lighter';
  }

  private drawShellHover(ctx: CanvasRenderingContext2D, tier: number): void {
    const s = this.shellByTier(tier);
    if (!s) return;
    const i = tier - 1;
    const a = this.shellBloom[i];
    if (a < 0.05) return;
    const r = this.shellRadius(tier);
    const ang = -Math.PI * 0.32;
    const ax = this.cx + Math.cos(ang) * (r + 14);
    const ay = this.cy + Math.sin(ang) * (r + 14);
    const col = SHELL_COLORS[i] ?? this.layerColor;
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(ax, ay);
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 10;
    ctx.font = "600 13px 'IBM Plex Sans KR', 'IBM Plex Mono', sans-serif";
    ctx.fillStyle = `rgba(${col},${0.5 + 0.45 * a})`;
    ctx.fillText(s.nameKo, 0, 0);
    ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.fillStyle = `rgba(200,216,224,${0.36 * a})`;
    ctx.fillText(s.rateLabel, 0, 17);
    ctx.font = "600 12px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.fillStyle = s.affordable
      ? `rgba(217,184,106,${0.85 * a})`
      : `rgba(217,184,106,${0.3 * a})`;
    ctx.fillText(s.costLabel, 0, 34);
    if (!s.affordable) {
      ctx.font = "10px 'IBM Plex Sans KR', sans-serif";
      ctx.fillStyle = `rgba(150,168,178,${0.5 * a})`;
      ctx.fillText('E 부족', 0, 48);
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'lighter';
  }

  private drawFloatTexts(ctx: CanvasRenderingContext2D, dt: number): void {
    if (this.floatTexts.length === 0) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = "600 12px 'IBM Plex Mono', ui-monospace, monospace";
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    for (let k = this.floatTexts.length - 1; k >= 0; k--) {
      const f = this.floatTexts[k];
      f.t += dt;
      const u = clamp(f.t / f.dur, 0, 1);
      if (u >= 1) {
        this.floatTexts.splice(k, 1);
        continue;
      }
      const y = f.y - u * 26;
      const a = (u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8) * 0.85;
      ctx.fillStyle = `rgba(${f.col},${a})`;
      ctx.fillText(f.str, f.x, y);
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'lighter';
  }

  private updateCellSpawn(dt: number): void {
    let floatCount = 0;
    for (const c of this.cells) if (c.state === 'float') floatCount++;
    if (floatCount < CELL_TARGET) {
      this.cellRespawn -= dt;
      if (this.cellRespawn <= 0) {
        this.spawnCell(true);
        this.cellRespawn = 0.5 + this.cellSeed() * 0.8;
      }
    }
  }
}
