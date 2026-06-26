/**
 * render/layer-visuals — 층 slug별 비주얼 config (데이터 주도, m2-render-plan §6·V2 스펙).
 *  렌더러는 코드 수정 없이 이 표만 보고 헤이즈·파티클·글로우 합성을 바꾼다.
 *  L2~L11 추가 = 데이터 추가(코드 0). 이번 슬라이스는 **mol·prn만 실값**, 나머지는 스텁(키만 존재).
 *
 *  색은 토큰 **키**(문자열)로 둔다 → 런타임 getComputedStyle로 해석(색맹·토큰 변경 자동 반영 §1.2).
 *  표현 파라미터(로직 수치 아님) — game `data/`(로직 수치)와 분리해 `src/render/` 아래 둔다(tech Q4).
 */

/** 파티클 형태(DESIGN game-ui.particles와 1:1). 이번 슬라이스 구현: circle·arc. 나머지 스텁. */
export type ParticleShape =
  | 'circle' // L1 분자: 부드러운 원, 브라운 운동
  | 'arc' // L6 프리온: 간섭 파면 아크
  | 'circle-trail'
  | 'cluster-dot'
  | 'triangle-rgb'
  | 'linear-stroke'
  | 'sine-segment'
  | 'grid-node'
  | 'bubble'
  | 'h-stream'
  | 'pixel-frag';

/** 스폰/운동 패턴. 이번 슬라이스: brownian·interference-arc. */
export type SpawnPattern =
  | 'brownian' // 느린 무작위 보행(L1)
  | 'interference-arc' // 위상 전환 시 무리 재생성(L6)
  | 'none';

/** 소멸 방식. opacity=수명 페이드, regen=위상 신호로 무리 재생성. */
export type FadeMode = 'opacity' | 'regen';

/** 글로우 합성(V2-2): 따뜻색=가산(lighter), 차가운 단색=normal(source-over). */
export type GlowBlend = 'add' | 'normal';

/** 배경 헤이즈 config(L1만 — 오프스크린 value-noise 타일 드리프트, §4·V2-7). */
export interface HazeConfig {
  /** 타일 색 토큰 키(getComputedStyle 해석). */
  colorToken: string;
  /** 알파 범위 [min,max] — 저주파 명암(0.04~0.08, V2-7). */
  alpha: [number, number];
  /** 드리프트 속도(px/s). 고정 저속 — rateC 비례 금지(V2-7). */
  driftPxPerSec: number;
  /** value-noise 옥타브 수(최소 2 — 격자 비침 방지, V2-7). */
  octaves: number;
}

/** 파티클 config. */
export interface ParticlesConfig {
  shape: ParticleShape;
  /** px 크기 범위. */
  sizeRange: [number, number];
  /** 목표 동시 활성 수(중밀도/저밀도 → 숫자). */
  density: number;
  /** 기준 속도(px/s, rateC 매핑 전). */
  speedBase: number;
  /** 수명 범위(s) — 페이드 소멸. */
  lifeRange: [number, number];
  fade: FadeMode;
  /** 색 토큰 키(글로우와 별도). */
  colorToken: string;
  spawnPattern: SpawnPattern;
}

/**
 * 차가운 배경 처리(V2-3). L6 등 차가운 단색층에 헤이즈와 동급 비용의 최소 처리 1개.
 *  vignette=극저알파 비네팅(심자주). 풀 위상간섭 배경은 차기.
 */
export interface BgConfig {
  kind: 'vignette';
  colorToken: string;
  /** 극저알파(0.02~0.03, V2-3). */
  alpha: number;
}

export interface LayerVisual {
  /** 헤이즈(없으면 null). */
  haze: HazeConfig | null;
  /** 파티클(없으면 null — 스텁 층). */
  particles: ParticlesConfig | null;
  /** 글로우 합성(따뜻/차가운 분기, V2-2). */
  glowBlend: GlowBlend;
  /** 차가운 최소 배경(없으면 null). */
  bg: BgConfig | null;
}

/**
 * 층 slug → 비주얼 config. slug는 tokens.css/layers.ts와 동일(mol/atom/.../plk).
 *  ★mol·prn만 실값. 나머지 9층은 스텁(파티클·헤이즈 null, glowBlend만 온도 분기로 미리 분류).
 *   차기 슬라이스가 이 표의 행을 채운다.
 */
export const LAYER_VISUALS: Record<string, LayerVisual> = {
  // L1 분자층 — 황록 온기. 헤이즈 + 부드러운 원 브라운 파티클. 가산 글로우(인광 그린).
  mol: {
    haze: {
      colorToken: '--layer-mol-accent',
      alpha: [0.04, 0.08],
      driftPxPerSec: 0.25, // ≤0.3px/s (art §2-3)
      octaves: 2,
    },
    particles: {
      shape: 'circle',
      sizeRange: [3, 6],
      density: 48, // 중밀도(40~70 범위 하단 — 절제)
      speedBase: 7, // px/s 기준(rateC 매핑 전)
      lifeRange: [6, 11],
      fade: 'opacity',
      colorToken: '--layer-mol-accent',
      spawnPattern: 'brownian',
    },
    glowBlend: 'add',
    bg: null,
  },

  // L6 프리온층 — 심자주 냉기. 간섭 아크 저밀도 + 차가운 최소 배경. normal 합성(네온 차단 V2-2).
  prn: {
    haze: null,
    particles: {
      shape: 'arc',
      sizeRange: [10, 26], // 아크 반경 범위
      density: 14, // 저밀도(10~20)
      speedBase: 4, // 위상 속도 — 느린 확장
      lifeRange: [4, 8],
      fade: 'regen', // 위상 전환 시 무리 재생성
      colorToken: '--layer-prn-accent',
      spawnPattern: 'interference-arc',
    },
    glowBlend: 'normal',
    bg: { kind: 'vignette', colorToken: '--layer-prn-accent', alpha: 0.025 },
  },

  // --- 스텁(키만 존재, 차기 슬라이스에서 채움). glowBlend만 온도 아크로 미리 분류(V2-2). ---
  atom: { haze: null, particles: null, glowBlend: 'add', bg: null }, // 따뜻(청록)
  nuc: { haze: null, particles: null, glowBlend: 'add', bg: null }, // 따뜻(주황)
  ncl: { haze: null, particles: null, glowBlend: 'add', bg: null }, // 삼원색 — 차기 판단
  qrk: { haze: null, particles: null, glowBlend: 'add', bg: null }, // 탈색 — 차기 판단
  str: { haze: null, particles: null, glowBlend: 'normal', bg: null }, // 차가운 단색
  lp: { haze: null, particles: null, glowBlend: 'normal', bg: null },
  fm: { haze: null, particles: null, glowBlend: 'normal', bg: null },
  inf: { haze: null, particles: null, glowBlend: 'normal', bg: null },
  plk: { haze: null, particles: null, glowBlend: 'normal', bg: null },
};

/** slug로 config 조회. 미정의 slug는 안전한 빈 비주얼(가산·전부 null)로 폴백. */
export function visualFor(slug: string): LayerVisual {
  return LAYER_VISUALS[slug] ?? { haze: null, particles: null, glowBlend: 'add', bg: null };
}

/** 렌더러가 onLayerChange 시 색 캐시에 읽어둘 토큰 키 전체(층 무관 고정 집합). */
export const RENDER_TOKEN_KEYS: string[] = [
  '--col-glow-core',
  '--layer-accent',
  '--layer-glow',
  '--layer-bg',
  '--foreground-dim',
  '--layer-mol-accent',
  '--layer-prn-accent',
];
