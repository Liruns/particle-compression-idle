/**
 * ftue — 첫 경험 점진 공개(Progressive Disclosure) 상태 파생. (ux.md §3, ui-flow §7·§11-A)
 *
 * "팝업 튜토리얼 없음. 강제 순서 없음. UI 자체가 가르친다." 정보 과부하 관리 = 진행에 따라
 *   UI 요소를 점진 노출. 이 모듈은 **현재 진행에서 무엇을 보여줄지**를 순수 계산(렌더는 UI).
 *
 * M1.3 범위(roadmap §1-B): 압축 클릭 → T1 자동화 → 체인 확장 → 첫 도감 발견 → 다음 층.
 *   탭(압축/도감)은 진행에 따라 등장. 연구 탭은 D 획득(M1.7) 게이트 — M1.3에선 항상 잠금.
 *
 * 입력은 "진실 상태에서 파생 가능한 신호"만(저장 안 함, 매 스냅샷 재계산):
 *   - 체인 보유(첫 구매 여부), 발견 입자 수, 현재 dec/층.
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
  /** 연구 탭 표시(D 획득 후 — M1.7. M1.3은 항상 false). */
  showResearchTab: boolean;
  /** 자원 D 행 표시(M1.7 — M1.3 false). */
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

  // 힌트(ux.md §3-1 단계별 1줄). 강요 아님 — 정보 제공.
  let hint: string | null = null;
  switch (stage) {
    case 'click':
      hint = '물질이 있다. 압축하라.';
      break;
    case 'firstTier':
      hint = 'Tier-1 압축기 구매 가능. 자동 압축을 시작한다.';
      break;
    case 'automating':
      hint = '압축기가 스스로 작동한다. 더 작아진다.';
      break;
    case 'codex':
      hint = '입자가 도감에 기록됐다.';
      break;
    case 'layering':
      hint = null; // 층 진입 비트가 내러티브를 담당(중복 방지).
      break;
  }

  return {
    stage,
    showChain,
    showCodexTab,
    showResearchTab: false, // M1.7
    showResourceD: false, // M1.7
    showResourceQF: hasPrestiged, // M1.5 (M1.3 항상 false)
    showMechanismSlot,
    hint,
  };
}
