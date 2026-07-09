/**
 * data/research — 연구 트리 노드 데이터 (데이터 주도). (research-tree.md, economy.md §7.2, systems.md §3)
 *
 * 진행 축("연구소" 컨셉): 발견(D) → 노드 언락(선행 그래프) → 강화 → 더 깊이. 분자층(L1)부터 열려
 *   초반 선택지를 준다(D는 도감 발견에서 나옴 — game.ts). 슬라이스 시드 = 7노드(후속 확장).
 *
 * ★ economy §7.2.1 C안(구조 분리) 준수 — 생산 레이스에 곱해지는 건 **부분 티어 배율(tier_mult)뿐**:
 *   tier_mult는 "지정 티어 생산에만 곱하는 체인 내부 배율"이지 전역 production_mult 상수곱이 아니다.
 *   시드 노드는 T1·T5~T8만 강화(T2~T4는 미강화) → 전 티어를 덮지 않으므로 전역 곱이 아님(가드레일 안전).
 *   "체인 내부 배율이 사실상 전역 곱이 되면 §3.4 재검증"(economy §7.2.1) — 부분 티어 원칙 유지 필수.
 *
 * 효과 종류(생산 레이스 안전형 위주):
 *   - tier_mult:  지정 티어 생산 ×value (체인 내부, chainTick tierMult). 부분 티어만.
 *   - click_power: 수동 압축(만지기) 파워 ×value. 클릭은 소수 기여라 레이스 영향 미미.
 *   - d_yield:    발견·공명 D 획득 ×value. **연구 축 자체를 가속**(생산 레이스 무관 — 안전한 성장 축).
 *
 * 비용([ECONOMY] 위임 시드): D는 "느린 연구 화폐". L1 발견 D(≈48)로 값싼 루트 몇 개 구매 가능한 입도.
 *   data 분리로 economy가 로직 수정 없이 튜닝(tech-arch §4.4).
 */

/** 연구 가지(research-tree §0). 표시 그룹 태그. */
export type ResearchBranch = 'CHAIN' | 'SYNERGY' | 'AUTO' | 'PHASE';

/**
 * 연구 노드 효과. 생산 레이스에 직접 곱하는 건 tier_mult(부분 티어)뿐 — C안 분리 유지.
 */
export type ResearchEffect =
  | {
      kind: 'tier_mult';
      /** 배율을 적용할 1-기반 티어 번호들(예: [1]=T1, [5,6,7,8]=고위 4티어). 부분 티어만. */
      tiers: number[];
      /** 배율(>1). 해당 티어 생산에만 곱(전역 곱 아님 — research_mult 불변). */
      value: number;
    }
  | {
      /** 수동 압축(만지기) 파워 배율(>1). 클릭 bump에만 곱 — 자동 생산 레이스와 분리. */
      kind: 'click_power';
      value: number;
    }
  | {
      /** 발견·공명 D 획득 배율(>1). 연구 연료를 가속 — 생산 레이스 무관(안전한 성장 축). */
      kind: 'd_yield';
      value: number;
    }
  | {
      /** 공명 D(클릭+자동) 획득 배율(>1). 오비탈 공명 전용 연료↑ — 생산 레이스 무관. */
      kind: 'resonance_d';
      value: number;
    }
  | {
      /** 공명 창 연장(초). 슬롯 유효 시간↑ — 타이밍이 관대해짐(QoL). */
      kind: 'resonance_window';
      value: number;
    }
  | {
      /** 콤보 상한 증가(정수). 연속 성공 D 가속의 천장↑. */
      kind: 'resonance_combo_max';
      value: number;
    }
  | {
      /** 자동 공명. 열린 슬롯을 자동으로 잡아 성공 처리(개입 자동화 — 콤보 유지). */
      kind: 'auto_resonance';
    };

/** 연구 노드 정의(research-tree §1 스키마). */
export interface ResearchNode {
  /** 코드 식별자. */
  id: string;
  /** 가지(표시 그룹). */
  branch: ResearchBranch;
  /** 표시 이름. */
  name: string;
  /** 한국어 이름. */
  nameKo: string;
  /** 가지 내 깊이(1=루트). */
  depth: number;
  /** 효과. */
  effect: ResearchEffect;
  /** 효과 1줄 설명(UI 노드 카드). */
  effectKo: string;
  /** 선행 노드 ID(빈 배열 = 루트). 전부 구매돼야 해금(prerequisites). */
  prerequisites: string[];
  /** D 비용(노드 1회 구매, native number). */
  costD: number;
  /** 플레이버(narrative §3 보이스 요약). */
  flavorKo: string;
}

/**
 * 연구 노드 시드(7개). 루트 3(값싼 L1 진입) → 깊이 노드 4(선행 게이트).
 *   tier_mult는 T1·T5~T8만(부분 티어 — 가드레일 안전). 나머지 agency는 click_power·d_yield로.
 */
export const RESEARCH_NODES: readonly ResearchNode[] = [
  // --- 루트(선행 없음 — 첫 D로 바로 진입) ---
  {
    id: 'C1',
    branch: 'CHAIN',
    name: 'Focused Observation',
    nameKo: '관측 집중',
    depth: 1,
    effect: { kind: 'click_power', value: 1.6 },
    effectKo: '수동 압축(만지기) 파워 ×1.6',
    prerequisites: [],
    costD: 8,
    flavorKo: '손끝의 압력을 벼린다. 직접 만지는 한 번이 더 깊이 파고든다.',
  },
  {
    id: 'R1',
    branch: 'SYNERGY',
    name: 'Clear Observation',
    nameKo: '선명한 관측',
    depth: 1,
    effect: { kind: 'd_yield', value: 1.35 },
    effectKo: '발견·공명 데이터(D) 획득 ×1.35',
    prerequisites: [],
    costD: 12,
    flavorKo: '흐릿하던 관측 신호가 또렷해진다. 같은 발견에서 더 많은 데이터.',
  },
  {
    id: 'A1',
    branch: 'CHAIN',
    name: 'T1 Amplifier',
    nameKo: 'T1 증폭기',
    depth: 1,
    effect: { kind: 'tier_mult', tiers: [1], value: 1.5 },
    effectKo: 'T1 압축기 생산 ×1.5',
    prerequisites: [],
    costD: 30,
    flavorKo: '체인의 기초를 강화한다. 첫 번째 단이 강해질수록 모든 것이 강해진다.',
  },

  // --- 깊이(선행 게이트) ---
  {
    id: 'C2',
    branch: 'CHAIN',
    name: 'Precision Observation',
    nameKo: '정밀 관측',
    depth: 2,
    effect: { kind: 'click_power', value: 2.0 },
    effectKo: '수동 압축 파워 추가 ×2.0',
    prerequisites: ['C1'],
    costD: 70,
    flavorKo: '관측이 외과적으로 정밀해진다. 만지는 손이 곧 압축기다.',
  },
  {
    id: 'R2',
    branch: 'SYNERGY',
    name: 'Data Distillation',
    nameKo: '데이터 증류',
    depth: 2,
    effect: { kind: 'd_yield', value: 1.6 },
    effectKo: '발견·공명 데이터(D) 추가 ×1.6',
    prerequisites: ['R1'],
    costD: 90,
    flavorKo: '잡음을 걷어내고 순수한 데이터만 남긴다. 연구가 가속된다.',
  },
  {
    id: 'A2',
    branch: 'CHAIN',
    name: 'High-Tier Amplifier',
    nameKo: '고위 티어 증폭',
    depth: 2,
    effect: { kind: 'tier_mult', tiers: [5, 6, 7, 8], value: 1.5 },
    effectKo: 'T5~T8 압축기 생산 ×1.5 (4개 티어)',
    prerequisites: ['A1'],
    costD: 350,
    flavorKo: '체인의 정점을 밀어올린다. 높은 곳이 강해지면 아래도 따라온다.',
  },
  {
    id: 'A3',
    branch: 'CHAIN',
    name: 'T1 Resonant Amplifier',
    nameKo: 'T1 공진 증폭',
    depth: 3,
    effect: { kind: 'tier_mult', tiers: [1], value: 2.0 },
    effectKo: 'T1 압축기 생산 추가 ×2.0',
    prerequisites: ['A2'],
    costD: 800,
    flavorKo: '기초 단을 공진시켜 폭발적으로 끌어올린다. 뿌리가 깊을수록 나무는 높다.',
  },
  {
    id: 'Q1',
    branch: 'SYNERGY',
    name: 'Resonance Data',
    nameKo: '공명 데이터',
    depth: 2,
    effect: { kind: 'resonance_d', value: 1.5 },
    effectKo: '공명 데이터(D) 획득 ×1.5 (클릭·자동)',
    prerequisites: ['R1'],
    costD: 60,
    flavorKo: '공명의 순간을 더 깊이 기록한다. 같은 공명에서 더 많은 데이터.',
  },
  {
    id: 'Q2',
    branch: 'SYNERGY',
    name: 'Wide Resonance Window',
    nameKo: '넓은 공명창',
    depth: 3,
    effect: { kind: 'resonance_window', value: 1.5 },
    effectKo: '공명 슬롯 유효 시간 +1.5초 (타이밍 관대)',
    prerequisites: ['Q1'],
    costD: 160,
    flavorKo: '공명의 창이 넓어진다. 서두르지 않아도 잡을 수 있다.',
  },
  {
    id: 'Q3',
    branch: 'SYNERGY',
    name: 'Deep Resonance',
    nameKo: '깊은 공명',
    depth: 4,
    effect: { kind: 'resonance_combo_max', value: 5 },
    effectKo: '공명 콤보 상한 +5 (연속 성공 D 천장↑)',
    prerequisites: ['Q2'],
    costD: 450,
    flavorKo: '공명이 공명을 부른다. 끊기지 않는 한 더 깊이 울린다.',
  },
  {
    id: 'Z1',
    branch: 'AUTO',
    name: 'Auto Resonance',
    nameKo: '자동 공명',
    depth: 3,
    effect: { kind: 'auto_resonance' },
    effectKo: '열린 공명 슬롯을 자동으로 잡음 (개입 자동화 — 콤보 유지)',
    prerequisites: ['Q1'],
    costD: 600,
    flavorKo: '관측 장치가 스스로 공명을 포착한다. 손을 떼도 공명은 이어진다.',
  },
] as const;

/** id → 노드(빠른 조회). */
const NODE_BY_ID = new Map<string, ResearchNode>(RESEARCH_NODES.map((n) => [n.id, n]));

/** id로 노드 조회(없으면 undefined). */
export function researchNodeById(id: string): ResearchNode | undefined {
  return NODE_BY_ID.get(id);
}
