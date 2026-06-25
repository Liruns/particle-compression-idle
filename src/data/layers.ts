/**
 * data/layers — 층 정의 (데이터 주도). (data-spec.md §4 LayerDefinition, systems.md §1-2, DESIGN.md §2)
 *
 * "data/ 분리 = 데이터 주도(수치는 economy/content, data-spec.md)." 층은 코드가 아닌 데이터.
 *
 * M1.3 범위: **알려진 물리 5층(분자/원자/핵/핵자/쿼크)만 진입 가능**. 미지 6 서브층은
 *   목록·도감 표시에만 쓰이고(L6~L11) 진입은 M1.5+(상전이 벽). "층 진입 ≠ 상전이"(필러④):
 *   알려진 물리는 상전이·프레스티지·리셋·QF 없음 — dec 임계 도달 시 스케일 진입 + 도감 + 비트만.
 *
 * 출처(임의 변경 금지 — 문제 발견 시 systems/content-designer에 보고):
 *   - systems.md §1-2 층 지도: 원자 dec1 / 핵 dec5 / 핵자 dec6 / 쿼크 dec9 (분자 = dec0 시작).
 *     [표기 주의] ui-flow §8-A는 "핵→핵자 dec7"로 적었으나 systems §1-2·data-spec §4-A·roadmap이
 *     모두 dec6으로 일치 → dec6 채택(권위 출처 다수결).
 *   - data-spec.md §4-A: layer_id·decade_range·mechanism_id 11층 표.
 *   - DESIGN.md §2 / tokens.css: 층별 팔레트 slug(mol/atom/nuc/ncl/qrk/...).
 *   - codex.md §2-6: 층별 입자 수(분자8/원자13/핵10/핵자9/쿼크17).
 */

/** 층 종류: 알려진 물리(무상전이) vs 미지(상전이·M1.5+). */
export type LayerKind = 'known' | 'unknown';

/**
 * LayerDefinition — 데이터 사전(data-spec §4)의 게임 런타임 형태.
 * 수치 캐시(생산·완성도)는 포함하지 않음(파생 — 런타임 계산).
 */
export interface LayerDefinition {
  /** 층 번호 1..11 (L1=분자 … L11=플랑크). */
  index: number;
  /** 코드 식별자(snake_case, data-spec layer_id). */
  id: string;
  /** CSS data-layer 슬러그(DESIGN.md / tokens.css). 팔레트 토큰 전환 키. */
  slug: string;
  /** 한국어 층 이름. */
  nameKo: string;
  /** 영문 층 이름(층 카드 양언어 표기). */
  nameEn: string;
  /** 실제 물리 층 여부(L1~L5 = true). */
  real: boolean;
  /** 진입 종류(known=무상전이 / unknown=상전이 벽). */
  kind: LayerKind;
  /**
   * 층 진입 dec 임계값(systems §1-2 게임플레이 decade).
   * 알려진 물리: dec 이 값 도달 시 자동 진입. 미지: 상전이 벽(M1.5+).
   */
  enterDec: number;
  /** 서사 스케일 decade 범위[start,end] (도감·내러티브 참조용 — 게임플레이 벽과 별개). */
  decadeRange: readonly [number, number];
  /** 대표 스케일(m, 과학 표기 문자열) — 층 카드 표시용. */
  scaleM: string;
  /** 주 메커니즘 코드 ID(systems §2). M1.4+ 구현 — M1.3은 이름만 표시. */
  mechanismId: string;
  /** 메커니즘 한국어 이름(층 카드 표시). */
  mechanismNameKo: string;
  /** 상전이 벽 dec(미지 서브층만 — 알려진 물리는 null). economy §1.2 WALLS. */
  prestigeWallDec: number | null;
  /** 몇 번째 상전이인지 PT1~PT6 (미지만 — 알려진 물리는 null). */
  prestigeIndex: number | null;
  /** 이 층의 입자 수(LEGENDARY 완성 보너스 포함, codex.md §0). */
  particleCount: number;
}

/**
 * 11층 정의. L1~L5 = 알려진 물리(M1.3 진입 가능), L6~L11 = 미지(M1.5+).
 * decade_range·prestige_wall은 data-spec §4-A 표 그대로. enterDec는 systems §1-2 게임플레이 벽.
 */
export const LAYERS: readonly LayerDefinition[] = [
  // --- 알려진 물리 5층 (M1.3) ------------------------------------------------
  {
    index: 1,
    id: 'molecule',
    slug: 'mol',
    nameKo: '분자층',
    nameEn: 'Molecular',
    real: true,
    kind: 'known',
    enterDec: 0,
    decadeRange: [0, 0],
    scaleM: '1e-9',
    mechanismId: 'manual_compress',
    mechanismNameKo: '수동 압축',
    prestigeWallDec: null,
    prestigeIndex: null,
    particleCount: 8,
  },
  {
    index: 2,
    id: 'atom',
    slug: 'atom',
    nameKo: '원자층',
    nameEn: 'Atomic',
    real: true,
    kind: 'known',
    enterDec: 1,
    decadeRange: [1, 1],
    scaleM: '1e-10',
    mechanismId: 'orbital_resonance',
    mechanismNameKo: '오비탈 공명',
    prestigeWallDec: null,
    prestigeIndex: null,
    particleCount: 13,
  },
  {
    index: 3,
    id: 'nucleus',
    slug: 'nuc',
    nameKo: '핵층',
    nameEn: 'Nuclear',
    real: true,
    kind: 'known',
    enterDec: 5,
    decadeRange: [5, 5],
    scaleM: '1e-14',
    mechanismId: 'nuclear_gauge',
    mechanismNameKo: '핵력 게이지',
    prestigeWallDec: null,
    prestigeIndex: null,
    particleCount: 10,
  },
  {
    index: 4,
    id: 'hadron',
    slug: 'ncl',
    nameKo: '핵자층',
    nameEn: 'Nucleon',
    real: true,
    kind: 'known',
    enterDec: 6,
    decadeRange: [6, 6],
    scaleM: '1e-15',
    mechanismId: 'color_charge_trinity',
    mechanismNameKo: '색전하 삼원합일',
    prestigeWallDec: null,
    prestigeIndex: null,
    particleCount: 9,
  },
  {
    index: 5,
    id: 'quark',
    slug: 'qrk',
    nameKo: '쿼크층',
    nameEn: 'Quark',
    real: true,
    kind: 'known',
    enterDec: 9,
    decadeRange: [9, 9],
    scaleM: '<1e-18',
    mechanismId: 'asymptotic_freedom',
    mechanismNameKo: '점근 자유 가속',
    prestigeWallDec: null,
    prestigeIndex: null,
    particleCount: 17,
  },
  // --- 미지 서브층 6개 (M1.5+ — M1.3은 도감 목록 표시만, 진입 불가) -------------
  {
    index: 6,
    id: 'preon',
    slug: 'prn',
    nameKo: '프리온층',
    nameEn: 'Preon',
    real: false,
    kind: 'unknown',
    enterDec: 19,
    decadeRange: [9, 12],
    scaleM: '1e-19',
    mechanismId: 'phase_overlap',
    mechanismNameKo: '위상 겹침',
    prestigeWallDec: 19,
    prestigeIndex: 1,
    particleCount: 7,
  },
  {
    index: 7,
    id: 'string',
    slug: 'str',
    nameKo: '끈층',
    nameEn: 'String',
    real: false,
    kind: 'unknown',
    enterDec: 21.5,
    decadeRange: [12, 15],
    scaleM: '1e-21',
    mechanismId: 'vibration_harmonics',
    mechanismNameKo: '진동 하모닉스',
    prestigeWallDec: 21.5,
    prestigeIndex: 2,
    particleCount: 6,
  },
  {
    index: 8,
    id: 'loop',
    slug: 'lp',
    nameKo: '루프층',
    nameEn: 'Loop',
    real: false,
    kind: 'unknown',
    enterDec: 23,
    decadeRange: [15, 18],
    scaleM: '1e-24',
    mechanismId: 'spin_network',
    mechanismNameKo: '스핀 네트워크',
    prestigeWallDec: 23,
    prestigeIndex: 3,
    particleCount: 5,
  },
  {
    index: 9,
    id: 'foam',
    slug: 'fm',
    nameKo: '거품층',
    nameEn: 'Foam',
    real: false,
    kind: 'unknown',
    enterDec: 24.5,
    decadeRange: [18, 21],
    scaleM: '1e-27',
    mechanismId: 'quantum_fluctuation',
    mechanismNameKo: '불확정 요동',
    prestigeWallDec: 24.5,
    prestigeIndex: 4,
    particleCount: 5,
  },
  {
    index: 10,
    id: 'info',
    slug: 'inf',
    nameKo: '정보층',
    nameEn: 'Information',
    real: false,
    kind: 'unknown',
    enterDec: 25.5,
    decadeRange: [21, 24],
    scaleM: '1e-30',
    mechanismId: 'holographic_encoding',
    mechanismNameKo: '홀로그래픽 인코딩',
    prestigeWallDec: 25.5,
    prestigeIndex: 5,
    particleCount: 4,
  },
  {
    index: 11,
    id: 'planck',
    slug: 'plk',
    nameKo: '플랑크층',
    nameEn: 'Planck',
    real: false,
    kind: 'unknown',
    enterDec: 26,
    decadeRange: [24, 26],
    scaleM: '1.6e-35',
    mechanismId: 'spacetime_pixel_collapse',
    mechanismNameKo: '시공간 픽셀 붕괴',
    prestigeWallDec: 26,
    prestigeIndex: 6,
    particleCount: 3,
  },
] as const;

/** M1.3에서 실제 진입 가능한 알려진 물리 층(L1~L5). */
export const KNOWN_LAYERS: readonly LayerDefinition[] = LAYERS.filter((l) => l.kind === 'known');

/** 층 index(1..11) → 정의. (없으면 undefined.) */
export function layerByIndex(index: number): LayerDefinition | undefined {
  return LAYERS.find((l) => l.index === index);
}

/** 층 id → 정의. */
export function layerById(id: string): LayerDefinition | undefined {
  return LAYERS.find((l) => l.id === id);
}
