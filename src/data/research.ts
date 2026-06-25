/**
 * data/research — 연구 트리 노드 데이터 (데이터 주도). (research-tree.md, economy.md §7.2, systems.md §3)
 *
 * 전체 52노드 중 **프로토타입 정거장1 = A가지(체인 증폭) 2노드만**(scope-mvp §2, roadmap M1.7).
 *   나머지 50노드(A 잔여·B 시너지·C 자동화·D 위상심화)는 후속 정거장. "작은 단위."
 *
 * ★ economy §7.2.1 C안(구조 분리) 준수 — **production_mult 외부, research_mult ≈ 1.0**:
 *   A가지 체인 증폭 노드의 효과는 "특정 티어 생산에만 곱하는 **체인 내부 배율**"이다.
 *   전 체인에 곱하는 전역 production_mult 상수곱이 **아니다**(그건 §3.4 race 가드레일 대상).
 *   구현: chainTick의 tierMult(티어별 배율 배열, 하모닉과 동형) 경로로 적용 → research_mult 불변.
 *   "구현이 이 분리를 어기면(체인 내부 배율이 사실상 전역 곱이 되면) §3.4 재검증"(economy §7.2.1 경고).
 *   A1/A2는 *일부* 티어(T1 / T5~T8)만 곱하므로 전역 곱이 아님 — 분리 유지.
 *
 * 효과 종류(현재 구현분):
 *   - tier_mult: 지정 티어들의 생산 배율 × value (체인 내부, chainTick tierMult로 전달).
 *
 * 비용·배율([ECONOMY] 위임값): 정확값 economy 미확정 → **보수적 시드**(D는 "느린 연구 화폐"
 *   economy §7.2.3 — 오비탈 공명 D_PER_CLICK=1 기준 수 분 내 첫 노드 구매 가능한 입도).
 *   data 분리로 economy가 로직 수정 없이 튜닝(tech-arch §4.4). 문제 발견 시 economy-designer 보고.
 *
 * 해금(research-tree §0·§2): A가지 = 원자층(L2) 진입 + 첫 D 획득 시. 깊이 노드는 선행 노드 구매 게이트.
 */

/** 연구 가지(research-tree §0). 프로토타입은 CHAIN(A)만 활성, 나머지는 후속. */
export type ResearchBranch = 'CHAIN' | 'SYNERGY' | 'AUTO' | 'PHASE';

/**
 * 연구 노드 효과(현재 구현분). C안 — 전역 production_mult 곱이 아니다.
 *  - tier_mult: tiers(1-기반 티어 번호) 각각의 생산을 value배(체인 내부 배율, chainTick tierMult).
 */
export type ResearchEffect = {
  kind: 'tier_mult';
  /** 배율을 적용할 1-기반 티어 번호들(예: [1]=T1, [5,6,7,8]=고위 4티어). */
  tiers: number[];
  /** 배율(>1). 해당 티어 생산에만 곱(전역 곱 아님 — research_mult 불변). */
  value: number;
};

/** 연구 노드 정의(research-tree §1 스키마 — 프로토타입 구현분만). */
export interface ResearchNode {
  /** 코드 식별자(research-tree A1·A2 등). */
  id: string;
  /** 가지. */
  branch: ResearchBranch;
  /** 표시 이름. */
  name: string;
  /** 한국어 이름. */
  nameKo: string;
  /** 가지 내 깊이(1=루트 바로 아래). */
  depth: number;
  /** 효과(체인 내부 배율 — C안). */
  effect: ResearchEffect;
  /** 효과 1줄 설명(UI 노드 카드). */
  effectKo: string;
  /** 선행 노드 ID(빈 배열 = 가지 루트). 전부 구매돼야 해금(research-tree prerequisites). */
  prerequisites: string[];
  /** D 비용(노드 1회 구매, native number — D는 비교적 작은 화폐). */
  costD: number;
  /** 플레이버(narrative §3 보이스 요약 — 최종은 locale 패스 M3). */
  flavorKo: string;
}

/**
 * A. 체인 증폭(CHAIN) 가지 — 프로토타입 2노드(research-tree §2 A1·A2).
 *   A1: T1 증폭(루트). A2: 고위 티어(T5~T8) 증폭(루트). 둘 다 깊이1 루트 — 선행 없음.
 *   (research-tree A2는 L3 게이팅이나, 프로토타입은 층 게이트 대신 첫 D 해금 + 비용으로 페이싱.
 *    더 깊은 노드 A3·A4…와 층 게이트는 후속 정거장.)
 */
export const RESEARCH_NODES: readonly ResearchNode[] = [
  {
    id: 'A1',
    branch: 'CHAIN',
    name: 'T1 Amplifier',
    nameKo: 'T1 증폭기',
    depth: 1,
    effect: { kind: 'tier_mult', tiers: [1], value: 1.5 },
    effectKo: 'T1 압축기 생산 ×1.5',
    prerequisites: [],
    costD: 50,
    flavorKo: '체인의 기초를 강화한다. 첫 번째 단이 강해질수록 모든 것이 강해진다.',
  },
  {
    id: 'A2',
    branch: 'CHAIN',
    name: 'High-Tier Amplifier',
    nameKo: '고위 티어 증폭',
    depth: 1,
    effect: { kind: 'tier_mult', tiers: [5, 6, 7, 8], value: 1.5 },
    effectKo: 'T5~T8 압축기 생산 ×1.5 (4개 티어)',
    prerequisites: ['A1'],
    costD: 500,
    flavorKo: '체인의 정점을 밀어올린다. 높은 곳이 강해지면 아래도 따라온다.',
  },
] as const;

/** id → 노드(빠른 조회). */
const NODE_BY_ID = new Map<string, ResearchNode>(RESEARCH_NODES.map((n) => [n.id, n]));

/** id로 노드 조회(없으면 undefined). */
export function researchNodeById(id: string): ResearchNode | undefined {
  return NODE_BY_ID.get(id);
}
