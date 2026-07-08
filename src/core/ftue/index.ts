/**
 * ftue — 첫 경험 점진 공개(Progressive Disclosure) 상태 파생. (ux.md §3, ui-flow §7·§11-A)
 *
 * "팝업 튜토리얼 없음. 강제 순서 없음. UI 자체가 가르친다." 정보 과부하 관리 = 진행에 따라
 *   UI 요소를 점진 노출. 이 모듈은 **현재 진행에서 무엇을 보여줄지**를 순수 계산(렌더는 UI).
 *
 * M1.3 범위(roadmap §1-B): 압축 클릭 → T1 자동화 → 체인 확장 → 첫 도감 발견 → 다음 층.
 *   탭(압축/도감)은 진행에 따라 등장. 연구 탭은 D 획득(M1.7) 게이트 — M1.3에선 항상 잠금.
 *
 * M1.4 추가: 원자층 오비탈 공명 → 첫 D 획득 시 **자원 D 행 노출**(ui-flow §2-C "D 첫 획득 후").
 *
 * M1.7 추가: 첫 D 획득 시 **연구 탭 해금**(ui-flow §7 "발견 데이터 축적. 연구 가능." §3-D).
 *   D는 모이는 화폐이자 이제 소비처(연구 노드)가 생김. showResearchTab이 D>0 + 원자층(L2)에서 켜진다.
 *
 * 입력은 "진실 상태에서 파생 가능한 신호"만(저장 안 함, 매 스냅샷 재계산):
 *   - 체인 보유(첫 구매 여부), 발견 입자 수, 현재 dec/층, D 보유 여부.
 */

/** FTUE 단계(표시 순서). 단조 증가(되돌아가지 않음). */
export type FtueStage =
  | 'click' // 0~1분: 압축 버튼·r 게이지·E/C만. 체인/탭 숨김.
  | 'firstTier' // T1 구매 가능 노출(아직 미구매).
  | 'automating' // T1 구매 후 — 자동 생산 체감, 체인 확장.
  | 'codex' // 첫 입자 발견 — 도감 탭 등장.
  | 'layering'; // 첫 층 전환(원자층+) 이후 — 메커니즘 위젯 자리 노출.

/** UI가 읽는 점진 공개 플래그(어떤 요소를 그릴지). */
export interface FtueState {
  stage: FtueStage;
  /** 8단 체인 테이블 표시(T1 비용 도달 또는 보유 시). */
  showChain: boolean;
  /** 도감 탭 표시(첫 발견 후 — 게임 시작 직후 물 분자부터). */
  showCodexTab: boolean;
  /** 연구 탭 표시(첫 D 획득 + 원자층 — M1.7. 연구 노드 소비처 등장). */
  showResearchTab: boolean;
  /** 자원 D 행 표시(D 첫 획득 후 — M1.4 오비탈 공명, ui-flow §2-C). */
  showResourceD: boolean;
  /** 자원 QF 행 표시(첫 상전이 후 — M1.5. M1.3 false). */
  showResourceQF: boolean;
  /** 우측 메커니즘 위젯 영역 표시(원자층+ 진입 시 자리 노출, 풀 구현 M1.4). */
  showMechanismSlot: boolean;
  /** 상태 로그에 띄울 1줄 FTUE 힌트(없으면 null). */
  hint: string | null;
}

/** FTUE 파생 입력(진실 상태에서 추출). */
export interface FtueInput {
  /** 체인 첫 구매(T1 이상) 했는가. */
  hasBoughtAnyTier: boolean;
  /** T1 첫 구매가 가능한가(E ≥ T1 next cost). */
  canAffordFirstTier: boolean;
  /** 발견한 입자 수(>0이면 도감 등장). */
  discoveredCount: number;
  /** 현재 층 index(1=분자 … 5=쿼크). 2+ 이면 메커니즘 위젯 자리 노출. */
  layerIndex: number;
  /** 첫 상전이 완료(M1.5). M1.3은 항상 false. */
  hasPrestiged: boolean;
  /** D(발견 데이터) 보유 여부(>0). M1.4 오비탈 공명 첫 획득 시 자원 D 행 노출. */
  hasDiscoveryData: boolean;
}

/**
 * 진행 신호 → FTUE 표시 상태(ux.md §3-2 / ui-flow §7-B 공개표).
 *  - 단계는 신호의 단조 누적으로 결정(되돌아가지 않게 우선순위 순 평가).
 */
export function deriveFtue(input: FtueInput): FtueState {
  const {
    hasBoughtAnyTier,
    canAffordFirstTier,
    discoveredCount,
    layerIndex,
    hasPrestiged,
    hasDiscoveryData,
  } = input;

  // 단계 결정(높은 단계부터 — 한 번 도달하면 표시 요소는 누적 유지).
  let stage: FtueStage;
  if (layerIndex >= 2) stage = 'layering';
  else if (discoveredCount > 0) stage = 'codex';
  else if (hasBoughtAnyTier) stage = 'automating';
  else if (canAffordFirstTier) stage = 'firstTier';
  else stage = 'click';

  // 표시 플래그(누적 — 일단 켜지면 유지). showChain은 T1 비용 도달부터.
  const showChain = canAffordFirstTier || hasBoughtAnyTier || discoveredCount > 0 || layerIndex >= 2;
  const showCodexTab = discoveredCount > 0;
  const showMechanismSlot = layerIndex >= 2;

  // 힌트(ux.md §3-1). 강요 아님 — 정보 제공. ★**액션 신호 기반**(stage 아님): 물 분자가 t=0에
  //   자동 발견돼 stage가 즉시 'codex'로 뛰므로, stage로 힌트를 정하면 "결속하라"가 살 수 없는
  //   초반 내내 뜬다(첫 T1 ≈ base_1·growth_1 E). → 살 수 없으면 "압축", 살 수 있으면 "결속",
  //   결속 후엔 "가속", 층 진입 후엔 내러티브에 양보. 카피는 공허 게임판 패러다임(만지기·궤도 껍질).
  let hint: string | null = null;
  if (!hasBoughtAnyTier) {
    // 첫 결속 전엔 층과 무관하게 안내 — 첫 T1이 원자층 진입 뒤에야 여유될 수 있어(rate 1/s) 층 게이트를 안 씀.
    hint = canAffordFirstTier
      ? '궤도 껍질을 눌러 압축기를 결속 — 자동 압축이 시작된다.'
      : '떠다니는 물질을 만져 압축하라.';
  } else if (layerIndex >= 2) {
    hint = null; // 학습 완료 + 층 진입 → 층 전환 비트·메커니즘 안내에 양보(중복 방지).
  } else {
    hint = '압축기가 스스로 작동한다. 더 결속할수록 빨라진다.';
  }

  return {
    stage,
    showChain,
    showCodexTab,
    // 연구 탭: 첫 D 획득 + 원자층(L2+) 진입 시 해금(M1.7, ui-flow §3-C). A가지 = 첫 D 게이트.
    showResearchTab: hasDiscoveryData && layerIndex >= 2,
    showResourceD: hasDiscoveryData, // M1.4 — D 첫 획득 후(오비탈 공명)
    showResourceQF: hasPrestiged, // M1.5 (M1.3/M1.4 항상 false)
    showMechanismSlot,
    hint,
  };
}
