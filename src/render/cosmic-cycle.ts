/**
 * render/cosmic-cycle — 데스크톱 위젯 "코스믹 사이클" 씬 (진행 연동, 표현 전용).
 *
 *  진행도 p(0..1) = 게임 압축 깊이(dec/26)에 연동. p가 커질수록 우주가 자라고,
 *  빅크런치 시 bang() 플래시 후 게임 dec가 0으로 리셋되며 p도 회귀 → 다시 원자에서 시작.
 *
 *  단계(p): 원자(0~.25) → 행성계(.25~.5) → 은하(.5~.75) → 블랙홀(.75~1) → 빅뱅(bang) → 원자.
 *  경계에서 크로스페이드. 경제·로직 무관 — snapshot 파생 p만 읽는다(단방향).
 */

import { TAU, clamp, lerp, fract, rnd, mixRGB } from './util';

interface Orbiter {
  /** 궤도 반경 비율(0..1, R 기준). */
  rad: number;
  /** 시작 각. */
  ang: number;
  /** 각속도(부호=방향). */
  spd: number;
  /** 크기 시드(0..1). */
  sz: number;
  /** 타원 이심(0..0.4). */
  ecc: number;
  /** 색 시드(0..1). */
  hue: number;
}

export class CosmicCycle {
  private p = 0; // 부드럽게 추적한 현재 진행도.
  private target = 0;
  private time = 0;
  private bangT = 0; // 빅뱅 플래시(0..1 감쇠).
  private reduced = false;
  /** 투명 위젯 모드 — 불투명 배경 대신 중앙 소프트 헤일로(가장자리 완전 투명 → 바탕화면에 떠 있는 느낌). */
  private transparent = false;

  private readonly stars: { x: number; y: number; s: number; ph: number }[] = [];
  private readonly orbs: Orbiter[] = [];

  constructor() {
    // 배경 성단(정적 시드 — 화면 비율 무관 0..1 좌표).
    for (let i = 0; i < 90; i++) {
      this.stars.push({ x: rnd(i * 3.1), y: rnd(i * 7.7 + 2), s: 0.4 + rnd(i * 2.3) * 1.4, ph: rnd(i) * TAU });
    }
    // 궤도체 시드(전 단계 재사용 — 연속성).
    for (let i = 0; i < 60; i++) {
      this.orbs.push({
        rad: 0.12 + rnd(i * 1.7) * 0.84,
        ang: rnd(i * 5.3) * TAU,
        spd: (0.15 + rnd(i * 2.9) * 0.5) * (rnd(i * 4.1) < 0.5 ? -1 : 1),
        sz: rnd(i * 6.7),
        ecc: rnd(i * 8.9) * 0.35,
        hue: rnd(i * 9.3),
      });
    }
  }

  setProgress(p: number): void {
    this.target = clamp(Number.isFinite(p) ? p : 0, 0, 1);
  }
  /** 빅크런치 → 빅뱅 섬광. */
  bang(): void {
    this.bangT = 1;
  }
  setReducedMotion(v: boolean): void {
    this.reduced = v;
  }
  /** 투명 배경 모드 on/off(Tauri 투명창 위젯). */
  setTransparent(v: boolean): void {
    this.transparent = v;
  }

  /** 색별 글로우 스프라이트 캐시(팔레트가 정적이라 유한). 프레임당 gradient 할당 제거(성능/GC). */
  private readonly glowSprites = new Map<string, HTMLCanvasElement | null>();
  /** 투명 배경 radial 캐시(W×H 키 — 위젯 리사이즈에서만 재생성). */
  private bgGrad: { key: string; g: CanvasGradient } | null = null;

  private glowSprite(col: string): HTMLCanvasElement | null {
    let s = this.glowSprites.get(col);
    if (s === undefined) {
      s = null;
      if (typeof document !== 'undefined') {
        const cv = document.createElement('canvas');
        const SR = 96; // 스프라이트 반경(px). 씬 최대 글로우까지 업스케일 열화 무시 가능.
        cv.width = cv.height = SR * 2;
        const c2 = cv.getContext('2d');
        if (c2) {
          const g = c2.createRadialGradient(SR, SR, 0, SR, SR, SR);
          g.addColorStop(0, `rgba(${col},1)`);
          g.addColorStop(0.4, `rgba(${col},0.35)`);
          g.addColorStop(1, `rgba(${col},0)`);
          c2.fillStyle = g;
          c2.fillRect(0, 0, SR * 2, SR * 2);
          s = cv;
        }
      }
      this.glowSprites.set(col, s);
    }
    return s;
  }

  private glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number): void {
    if (a <= 0 || r <= 0) return;
    const s = this.glowSprite(col);
    if (s) {
      // 스톱(1, 0.35, 0)은 a에 선형 → globalAlpha 곱이 기존 (a, 0.35a, 0)과 동일.
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * Math.min(1, a);
      ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = prev;
      return;
    }
    // 폴백(document 없음 — 테스트/노드): 기존 gradient 경로.
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.4, `rgba(${col},${a * 0.35})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, dt: number): void {
    if (W <= 0 || H <= 0) return;
    this.p = lerp(this.p, this.target, Math.min(1, dt * 2.5));
    if (!this.reduced) this.time += dt;
    if (this.bangT > 0) this.bangT = Math.max(0, this.bangT - dt / 1.4);
    const t = this.time;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.42;
    const p = this.p;

    // 심우주 배경.
    ctx.globalCompositeOperation = 'source-over';
    if (this.transparent) {
      // 투명 위젯: 중앙만 은은히 어둡고 가장자리는 완전 투명 → 우주가 바탕화면에 떠 있는 느낌.
      const key = `${W}x${H}`;
      if (!this.bgGrad || this.bgGrad.key !== key) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
        g.addColorStop(0, 'rgba(5,6,10,0.62)');
        g.addColorStop(0.6, 'rgba(5,6,10,0.30)');
        g.addColorStop(1, 'rgba(5,6,10,0)');
        this.bgGrad = { key, g };
      }
      ctx.fillStyle = this.bgGrad.g;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, W, H);
    }
    // 성단(은하 단계에서 밝아짐).
    ctx.globalCompositeOperation = 'lighter';
    const starA = 0.25 + 0.35 * clamp((p - 0.4) / 0.4, 0, 1);
    for (const s of this.stars) {
      const tw = this.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(t * 0.8 + s.ph);
      ctx.fillStyle = `rgba(200,214,235,${starA * (0.3 + 0.7 * tw) * 0.5})`;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.s, 0, TAU);
      ctx.fill();
    }

    // 단계 크로스페이드: 각 밴드 끝 0.05에서 다음으로.
    const band = (lo: number, hi: number): number => {
      const fade = 0.05;
      return clamp((p - lo) / fade, 0, 1) * clamp((hi + fade - p) / fade, 0, 1);
    };
    const aAtom = p < 0.3 ? band(-1, 0.25) : 0;
    const aPlanet = band(0.25, 0.5);
    const aGalaxy = band(0.5, 0.75);
    const aHole = p > 0.72 ? band(0.75, 1.1) : 0;

    if (aAtom > 0.01) this.drawAtom(ctx, cx, cy, R, t, aAtom);
    if (aPlanet > 0.01) this.drawPlanetary(ctx, cx, cy, R, t, aPlanet);
    if (aGalaxy > 0.01) this.drawGalaxy(ctx, cx, cy, R, t, aGalaxy);
    if (aHole > 0.01) this.drawBlackHole(ctx, cx, cy, R, t, aHole);

    // 빅뱅 섬광(빅크런치 직후).
    if (this.bangT > 0.01) {
      const b = this.bangT;
      this.glow(ctx, cx, cy, R * (0.3 + (1 - b) * 2.2), '255,250,240', b * 0.9);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255,252,245,${b * b * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── 단계별 ──────────────────────────────────────────────────────────────

  /** 원자: 핵 + 전자 3개(빠른 타원 궤도). */
  private drawAtom(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number, a: number): void {
    ctx.globalCompositeOperation = 'lighter';
    this.glow(ctx, cx, cy, R * 0.18, '150,190,255', a * 0.5);
    this.glow(ctx, cx, cy, R * 0.05, '235,245,255', a * 0.9);
    const spin = this.reduced ? 0 : t;
    for (let e = 0; e < 3; e++) {
      const rot = (e / 3) * Math.PI;
      const rr = R * (0.22 + e * 0.07);
      const ang = spin * (1.6 + e * 0.4) + e * 2.1;
      const ex = Math.cos(ang) * rr;
      const ey = Math.sin(ang) * rr * 0.45;
      const x = cx + ex * Math.cos(rot) - ey * Math.sin(rot);
      const y = cy + ex * Math.sin(rot) + ey * Math.cos(rot);
      // 궤도 자취.
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * 0.45, rot, 0, TAU);
      ctx.strokeStyle = `rgba(150,190,255,${a * 0.14})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      this.glow(ctx, x, y, R * 0.05, '210,230,255', a * 0.9);
    }
  }

  /** 행성계: 별 + 행성 5개(느린 궤도, 하나는 고리). */
  private drawPlanetary(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number, a: number): void {
    ctx.globalCompositeOperation = 'lighter';
    const pulse = this.reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 0.6);
    this.glow(ctx, cx, cy, R * 0.32, '255,196,110', a * 0.4 * pulse);
    this.glow(ctx, cx, cy, R * 0.1, '255,238,200', a * 0.95);
    const cols: [number, number, number][] = [
      [150, 190, 230], [210, 170, 140], [180, 210, 170], [200, 180, 220], [230, 200, 160],
    ];
    for (let i = 0; i < 5; i++) {
      const o = this.orbs[i];
      const rr = R * (0.28 + i * 0.13);
      const ang = o.ang + (this.reduced ? 0 : t * (0.5 - i * 0.06) * o.spd * 2);
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr * 0.7;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * 0.7, 0, 0, TAU);
      ctx.strokeStyle = `rgba(200,200,210,${a * 0.08})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      const pr = R * (0.02 + o.sz * 0.03);
      const c = cols[i];
      this.glow(ctx, x, y, pr * 3, `${c[0]},${c[1]},${c[2]}`, a * 0.8);
      if (i === 2) {
        // 고리 행성.
        ctx.beginPath();
        ctx.ellipse(x, y, pr * 2.6, pr * 1.0, 0.5, 0, TAU);
        ctx.strokeStyle = `rgba(220,205,180,${a * 0.5})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }

  /** 은하: 밝은 중심 팽대부 + 나선팔 별무리(회전). */
  private drawGalaxy(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number, a: number): void {
    ctx.globalCompositeOperation = 'lighter';
    const rot = this.reduced ? 0 : t * 0.08;
    this.glow(ctx, cx, cy, R * 0.5, '255,224,180', a * 0.3);
    this.glow(ctx, cx, cy, R * 0.16, '255,244,220', a * 0.85);
    const arms = 2;
    for (const o of this.orbs) {
      // 로그 나선: 각 = base + k·반경. 두 팔로 분배.
      const arm = (Math.round(o.hue * 100) % arms) * (TAU / arms);
      const rr = o.rad * R * 0.95;
      const ang = arm + o.rad * 6.0 + rot + o.ang * 0.02;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr * 0.6;
      const c: [number, number, number] = o.hue < 0.5 ? [200, 214, 245] : [255, 214, 170];
      const sa = a * (0.35 + 0.5 * (1 - o.rad));
      this.glow(ctx, x, y, R * (0.012 + o.sz * 0.02), `${c[0]},${c[1]},${c[2]}`, sa);
    }
  }

  /** 블랙홀: 사건지평선(검은 원) + 강착원반(밝은 고리) + 렌즈 글로우 + 빨려드는 별. */
  private drawBlackHole(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, t: number, a: number): void {
    const rot = this.reduced ? 0 : t * 0.5;
    // 렌즈 글로우.
    ctx.globalCompositeOperation = 'lighter';
    this.glow(ctx, cx, cy, R * 0.6, '120,90,180', a * 0.3);
    // 강착원반(기울어진 밝은 타원 링, 회전 그라디언트 느낌).
    for (let k = 0; k < 3; k++) {
      const rr = R * (0.24 + k * 0.05);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * 0.32, 0.4, 0, TAU);
      const col = mixRGB('255,180,90', '255,245,220', k / 2);
      ctx.strokeStyle = `rgba(${col},${a * (0.5 - k * 0.12)})`;
      ctx.lineWidth = 2 + (2 - k);
      ctx.stroke();
    }
    // 빨려드는 별(반경 축소).
    for (let i = 0; i < 18; i++) {
      const o = this.orbs[i];
      const inspin = fract(o.rad + (this.reduced ? 0 : t * 0.12));
      const rr = R * (0.55 * (1 - inspin) + 0.1);
      const ang = o.ang + rot * (1.5 + (1 - inspin) * 3) + inspin * 8;
      const x = cx + Math.cos(ang) * rr;
      const y = cy + Math.sin(ang) * rr * 0.55;
      this.glow(ctx, x, y, R * 0.012, '255,230,200', a * (0.2 + 0.6 * inspin));
    }
    // 사건지평선(검은 코어) — source-over로 확실히 검게.
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.13, 0, TAU);
    ctx.fillStyle = `rgba(2,2,6,${a})`;
    ctx.fill();
    // 광자 링(테두리).
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.13, 0, TAU);
    ctx.strokeStyle = `rgba(255,240,210,${a * 0.7})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
  }
}
