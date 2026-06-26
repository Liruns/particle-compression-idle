/**
 * render/glow — r 게이지 본체 + 중심 글로우(m2-render-plan §3·V2-1·V2-2). 마케팅 심장.
 *  게이지 캔버스에 **3요소**(ux §2-A, DESIGN game-ui.gauge)를 그린다:
 *   (a) 동심원 4개 — dec 진행에 바깥부터 페이드(줄어드는 원 = 역설의 절반).
 *   (b) 외곽 dec 진행 링 — 호 길이 = 층 내 진행, 12시 시작 시계방향.
 *   (c) 중심 글로우 — 코어(날카로움, 맥동)/헤일로(채움, 프레임 비례) 2매핑 분리.
 *
 *  글로우 합성 층별 분기(V2-2): 따뜻색=add(lighter), 차가운 단색=normal(source-over)+낮은 알파+작은 코어.
 *  dec 스텝 lerp 추격으로 20fps 갱신을 부드럽게(art §3-A 200ms ease). reduced-motion이면 맥동 0·즉시 반영.
 *  입력은 snapshot 파생 number만(dec·rateCPositive) — Decimal 미접근.
 */
import { rgba, mix, desaturate, type RGB, type ColorCache } from './color';
import type { GlowBlend } from './layer-visuals';

// 토큰 정합(tokens.css --glow-core-radius-*). 코어 3→14px.
const GLOW_MIN = 3;
const GLOW_MAX = 14;
const CORE_K = 0.42; // dec26에서 max 도달(현 App 공식 유지 — 밸런스 영향 0)

// 동심원(DESIGN game-ui.gauge).
const CONCENTRIC_COUNT = 4;
const CONCENTRIC_OPACITY = [0.15, 0.12, 0.1, 0.08];
const CONCENTRIC_RADIUS_RATIO = [0.9, 0.7, 0.5, 0.3]; // × R_frame
const OUTER_RING_THICKNESS = 4; // px

const PULSE_AMP = 0.06; // 코어 맥동 진폭(미세)
const PULSE_PERIOD = 4000; // ms (--motion-ambient-pulse)
const LERP_TIME_CONST = 0.15; // s — dec 추격 시간상수(~150ms)

/** dec → 코어 반경(px). clamp(3 + dec·k, 3, 14). */
function coreRadius(dec: number): number {
  const r = GLOW_MIN + dec * CORE_K;
  return r < GLOW_MIN ? GLOW_MIN : r > GLOW_MAX ? GLOW_MAX : r;
}

/** dec → 헤일로 비율(프레임 대비). dec0≈0.2 → dec_max(≈26)≈0.95(프레임 거의 채움). */
function haloRatio(dec: number): number {
  const t = Math.min(1, Math.max(0, dec / 26));
  return 0.2 + t * 0.75; // 0.2~0.95
}

/** 층 내 진행 비율(dec 소수부) — 외곽 링 호 길이. 0~1. */
function decProgress(dec: number): number {
  const frac = dec - Math.floor(dec);
  return frac < 0 ? 0 : frac > 1 ? 1 : frac;
}

export class Glow {
  private colors: ColorCache;
  /** 표시 반경(lerp 추격). target는 dec에서 매 프레임 산출. */
  private displayCore = GLOW_MIN;
  private blend: GlowBlend = 'add';
  /** 캐시된 합성 색(onLayerChange 시 갱신). */
  private coreColor: RGB = { r: 62, g: 207, b: 142 };
  private haloColor: RGB = { r: 62, g: 207, b: 142 };
  private ringColor: RGB = { r: 139, g: 195, b: 74 };
  private concentricColor: RGB = { r: 61, g: 81, b: 98 };

  constructor(colors: ColorCache) {
    this.colors = colors;
  }

  /**
   * 층 전환 시 합성 색·blend 갱신. colors는 이미 read() 완료 가정.
   *  코어 = glow-core에 층 악센트 15% 블렌딩(§3-A). 차가운 단색층은 채도↓(네온 차단 V2-2).
   */
  onLayerChange(blend: GlowBlend): void {
    this.blend = blend;
    const glowCore = this.colors.get('--col-glow-core', { r: 62, g: 207, b: 142 });
    const accent = this.colors.get('--layer-accent', glowCore);
    let core = mix(glowCore, accent, 0.15);
    let halo = mix(glowCore, accent, 0.35);
    if (blend === 'normal') {
      // 차가운 단색: 악센트가 코어를 지배하되 채도를 낮춰(회색 방향) 네온감 제거.
      core = desaturate(mix(glowCore, accent, 0.6), 0.25);
      halo = desaturate(accent, 0.4);
    }
    this.coreColor = core;
    this.haloColor = halo;
    this.ringColor = accent;
    this.concentricColor = this.colors.get('--foreground-dim', { r: 61, g: 81, b: 98 });
  }

  /**
   * 게이지 드로우. ctx는 dpr setTransform 적용 상태(CSS px 좌표). cx,cy=캔버스 중심(CSS px).
   *  R_frame=게이지 프레임 반경(파라미터 — GIF 모드에서 키우면 헤일로 비례 확장).
   *  dec/rateCPositive=snapshot 파생. t=렌더러 내부 시간(ms). dt=클램프 delta(s).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rFrame: number,
    dec: number,
    rateCPositive: boolean,
    tMs: number,
    dt: number,
    reducedMotion: boolean,
  ): void {
    // --- dec 추격 lerp(20fps 스텝 부드럽게). reduced-motion이면 즉시 반영. ---
    const targetCore = coreRadius(dec);
    if (reducedMotion) {
      this.displayCore = targetCore;
    } else {
      const k = 1 - Math.exp(-dt / LERP_TIME_CONST);
      this.displayCore += (targetCore - this.displayCore) * k;
    }

    // --- 맥동(생산 중 + 모션 허용일 때만, 코어에만 V2-1·V2-7 M6). ---
    let pulse = 1;
    if (rateCPositive && !reducedMotion) {
      pulse = 1 + PULSE_AMP * Math.sin((2 * Math.PI * tMs) / PULSE_PERIOD);
    }

    // === (a) 동심원 4개 — dec 진행에 바깥부터 페이드 ===
    // 깊어질수록(dec↑) 바깥 원부터 사라진다. fadeBudget = 사라질 원 수(연속).
    const decFloor = Math.floor(dec);
    for (let i = 0; i < CONCENTRIC_COUNT; i++) {
      // i=0이 가장 바깥. dec가 커질수록 바깥(i 작은) 원이 먼저 옅어짐.
      // 층 정수부마다 한 겹씩 옅어지되, 최소 1개(가장 안쪽)는 항상 남긴다.
      const fadeIndex = decFloor % (CONCENTRIC_COUNT + 1); // 0~4 순환
      let opacity = CONCENTRIC_OPACITY[i];
      if (i < fadeIndex) {
        opacity *= 0.15; // 거의 소멸(완전 0은 구조 상실 — 흔적만)
      }
      const r = CONCENTRIC_RADIUS_RATIO[i] * rFrame;
      ctx.strokeStyle = rgba(this.concentricColor, opacity);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // === (b) 외곽 dec 진행 링 — 호 길이 = 층 내 진행, 12시 시작 시계방향 ===
    const prog = decProgress(dec);
    const ringR = rFrame - OUTER_RING_THICKNESS / 2;
    if (ringR > 0) {
      // 배경 트랙(아주 옅게).
      ctx.strokeStyle = rgba(this.concentricColor, 0.1);
      ctx.lineWidth = OUTER_RING_THICKNESS;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      // 진행 호(층 악센트).
      if (prog > 0.001) {
        const start = -Math.PI / 2; // 12시
        ctx.strokeStyle = rgba(this.ringColor, 0.85);
        ctx.lineWidth = OUTER_RING_THICKNESS;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, start, start + prog * Math.PI * 2);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }

    // === (c) 중심 글로우 — 헤일로(먼저, 넓고 약함) → 코어(나중, 좁고 강함) ===
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = this.blend === 'add' ? 'lighter' : 'source-over';

    // 헤일로: 프레임 비례(haloRatio). 맥동 미적용(또는 극미). 차가운 단색은 알파 더 낮게.
    const haloR = Math.max(1, rFrame * haloRatio(dec));
    const haloAlphaPeak = this.blend === 'add' ? 0.3 : 0.16;
    const haloGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
    haloGrad.addColorStop(0, rgba(this.haloColor, haloAlphaPeak));
    haloGrad.addColorStop(0.45, rgba(this.haloColor, haloAlphaPeak * 0.4));
    haloGrad.addColorStop(1, rgba(this.haloColor, 0));
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
    ctx.fill();

    // 코어: 날카로운 중심. 맥동은 코어 반경·알파에만. 차가운 단색은 코어 더 작게.
    const coreScale = this.blend === 'add' ? 1 : 0.75; // 차가운 단색 = 작고 날카롭게
    const coreR = Math.max(1, this.displayCore * pulse * coreScale);
    const coreAlpha = (this.blend === 'add' ? 1 : 0.85) * pulse;
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    coreGrad.addColorStop(0, rgba(this.coreColor, coreAlpha));
    coreGrad.addColorStop(0.6, rgba(this.coreColor, coreAlpha * 0.5));
    coreGrad.addColorStop(1, rgba(this.coreColor, 0));
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = prevOp;
  }

  /** lerp 상태 리셋(층 강제 전환 등). */
  reset(dec: number): void {
    this.displayCore = coreRadius(dec);
  }
}
