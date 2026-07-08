/**
 * data/achievements — 관측 목표(업적) 정의. **데이터 주도**(tech-arch §4.4): 로직이 아니라 여기 표에.
 *
 *  ★가드레일(GDD §13): 마일스톤 배율(25/50/100→×2/×3)은 dec26 벽 −72% 파괴로 **금지**. 따라서 업적은
 *   **순수 인정·목표·기록형** — 생산 배율 0(검증된 경제를 한 줄도 안 건드림). 보상은 "완성의 도파민 +
 *   단기 목표 + 이른 첫 승리 + 수집 후킹"(리서치 리텐션 축). Steam 업적(M3.7)에 1:1 매핑될 후보이기도 하다.
 *
 *  판정은 **영속 상태 파생 컨텍스트**만 사용(이벤트 타이밍 비의존 → 어느 경로에서 평가해도 멱등).
 *   큰 수는 log10(number)로 받아 Decimal 미유입(순수·테스트 용이, render 파생과 동형).
 */

/** 업적 판정 컨텍스트 — 전부 영속 상태에서 파생. */
export interface AchievementContext {
  /** 전 생애 최대 dec(stats.maxDec). */
  maxDec: number;
  /** 도달 최대 층 index(1..11). */
  maxLayerIndex: number;
  /** 상전이 횟수 / 재하강 run index. */
  prestigeCount: number;
  runIndex: number;
  /** 도감 수집 수(discoverable) / 완성도 0..1. */
  codexCollected: number;
  codexCompletion: number;
  /** 구매 연구 노드 수. */
  researchCount: number;
  /** 누적 수동 압축 / 결속 수. */
  manualCompresses: number;
  totalBinds: number;
  /** 누적 C·D 의 log10(자리수). C=0이면 -Infinity 대신 0으로 정규화해 전달. */
  lifetimeCLog10: number;
  lifetimeDLog10: number;
}

export type AchievementCategory =
  | 'onboarding'
  | 'descent'
  | 'prestige'
  | 'codex'
  | 'research'
  | 'craft'
  | 'endgame';

export interface AchievementDef {
  /** 안정 ID(세이브·Steam 매핑 키 — 절대 변경 금지). */
  id: string;
  nameKo: string;
  descKo: string;
  category: AchievementCategory;
  /** 히든: 달성 전 이름/설명 가림(발견의 재미). */
  hidden?: boolean;
  /** 영속 컨텍스트 → 달성 여부(순수). */
  test: (c: AchievementContext) => boolean;
}

/**
 * 관측 목표 표. 카테고리별로 온보딩 첫 승리 → 하강 이정표 → 상전이/재하강 → 수집/연구 → 손맛 → 스케일.
 *  ID는 영구 계약(변경 시 기존 세이브 달성 소실). 새 목표는 **추가만** 한다.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // --- 온보딩: 이른 첫 승리(리서치 "quick first victory") ---
  { id: 'first_compress', nameKo: '첫 응결', descKo: '물질을 처음 만져 압축했다.', category: 'onboarding', test: (c) => c.manualCompresses >= 1 },
  { id: 'first_bind', nameKo: '첫 결속', descKo: '압축기를 처음 결속했다 — 자동 압축의 시작.', category: 'onboarding', test: (c) => c.totalBinds >= 1 },
  { id: 'first_discovery', nameKo: '첫 기록', descKo: '입자 세 종을 도감에 기록했다.', category: 'onboarding', test: (c) => c.codexCollected >= 3 },

  // --- 하강: dec 이정표(알려진 물리 → 미지) ---
  { id: 'dec_atom', nameKo: '원자 스케일', descKo: '원자층에 도달했다 (1×10⁻¹⁰ m).', category: 'descent', test: (c) => c.maxLayerIndex >= 2 },
  { id: 'dec_nucleus', nameKo: '핵의 문턱', descKo: 'dec 5 — 원자핵 규모로 내려갔다.', category: 'descent', test: (c) => c.maxDec >= 5 },
  { id: 'dec_quark_limit', nameKo: '알려진 물리의 끝', descKo: 'dec 9 — 쿼크 한계. 지도는 여기까지다.', category: 'descent', test: (c) => c.maxDec >= 9 },
  { id: 'dec_first_wall', nameKo: '미지의 첫 벽', descKo: 'dec 19 — 프리온. 미지 영역의 문턱.', category: 'descent', test: (c) => c.maxDec >= 19 },
  { id: 'dec_planck', nameKo: '시공간의 픽셀', descKo: 'dec 26 — 플랑크 길이. 더 작은 것은 없다… 아직은.', category: 'descent', test: (c) => c.maxDec >= 26 },

  // --- 미지 서브층 세계(각 = 한 새로움) ---
  { id: 'world_preon', nameKo: '위상의 세계', descKo: '프리온층 — 위상 겹침을 만났다.', category: 'descent', test: (c) => c.maxLayerIndex >= 6 },
  { id: 'world_string', nameKo: '진동의 세계', descKo: '끈층 — 진동 하모닉스를 만났다.', category: 'descent', test: (c) => c.maxLayerIndex >= 7 },
  { id: 'world_planck', nameKo: '경계의 세계', descKo: '플랑크층 — 마지막 미지 세계에 섰다.', category: 'descent', test: (c) => c.maxLayerIndex >= 11 },

  // --- 상전이 / 재하강(메타 루프) ---
  { id: 'prestige_1', nameKo: '무게', descKo: '첫 상전이 — 양자 거품을 얻었다.', category: 'prestige', test: (c) => c.prestigeCount >= 1 },
  { id: 'prestige_3', nameKo: '가속', descKo: '상전이 3회.', category: 'prestige', test: (c) => c.prestigeCount >= 3 },
  { id: 'prestige_7', nameKo: '빅 크런치', descKo: '일곱 문턱을 모두 넘었다.', category: 'prestige', test: (c) => c.prestigeCount >= 7 },
  { id: 'redescent_1', nameKo: '다시, 더 깊이', descKo: '첫 재하강 — 더 작은 것을 향해.', category: 'prestige', test: (c) => c.runIndex >= 1 },

  // --- 도감(수집 후킹) ---
  { id: 'codex_10', nameKo: '수집가', descKo: '입자 10종 기록.', category: 'codex', test: (c) => c.codexCollected >= 10 },
  { id: 'codex_half', nameKo: '절반의 우주', descKo: '입자 38종 기록 (완성도 50%).', category: 'codex', test: (c) => c.codexCompletion >= 0.5 },
  { id: 'codex_full', nameKo: '완전한 관측', descKo: '76종 전부 기록 — 홀로그래픽 완성.', category: 'codex', test: (c) => c.codexCompletion >= 0.999 },

  // --- 연구 ---
  { id: 'research_1', nameKo: '첫 통찰', descKo: '연구 노드를 처음 구매했다.', category: 'research', test: (c) => c.researchCount >= 1 },
  { id: 'research_10', nameKo: '연구소장', descKo: '연구 노드 10개 구매.', category: 'research', test: (c) => c.researchCount >= 10 },

  // --- 손맛(craft) ---
  { id: 'compress_1k', nameKo: '천 번의 응결', descKo: '수동 압축 1,000회.', category: 'craft', test: (c) => c.manualCompresses >= 1000 },
  { id: 'binds_500', nameKo: '결속의 대가', descKo: '압축기 결속 누적 500.', category: 'craft', test: (c) => c.totalBinds >= 500 },

  // --- 스케일(엔드게임) ---
  { id: 'scale_e15', nameKo: '천문학적 압축', descKo: '누적 압축 깊이 C가 10¹⁵를 넘었다.', category: 'endgame', test: (c) => c.lifetimeCLog10 >= 15 },
  { id: 'scale_e30', nameKo: '측정 불가', descKo: '누적 압축 깊이 C가 10³⁰을 넘었다.', category: 'endgame', test: (c) => c.lifetimeCLog10 >= 30 },

  // --- 히든(발견의 재미) ---
  { id: 'quiet_observer', nameKo: '관조자', descKo: '거의 만지지 않고 첫 상전이에 이르렀다.', category: 'prestige', hidden: true, test: (c) => c.prestigeCount >= 1 && c.manualCompresses < 50 },
  { id: 'the_signal', nameKo: '옛 신호', descKo: '쿼크 이하에서 무언가가 기다리고 있었다.', category: 'descent', hidden: true, test: (c) => c.maxLayerIndex >= 6 && c.codexCompletion >= 0.6 },
] as const;

/** 표시 분모(전체 목표 수). */
export const ACHIEVEMENT_TOTAL = ACHIEVEMENTS.length;
