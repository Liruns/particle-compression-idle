/**
 * research — 연구 트리: 노드 구매·효과 적용. (research-tree.md, economy.md §7.2, system-flows.md §9)
 *
 * 52연구 노드 중 **프로토타입 = A가지 체인증폭 2노드**(A1·A2, data/research.ts). 구매한 노드 ID
 *   집합으로 저장(§1.1 스파스 ID 배열, 영구 보존 — 상전이/재하강 불변).
 *
 * ★ economy §7.2 C안 준수 — **research_mult ≈ 1.0**(전역 production_mult 직접 곱 0):
 *   A가지 효과 = "특정 티어 생산에만 곱하는 체인 내부 배율"(tier_mult). chainTick의 tierMult 경로로
 *   적용된다(하모닉 공명과 동형 합성 — game.ts가 두 배율을 곱해 chainTick에 전달). 전 체인에 곱하는
 *   상수곱이 아니므로 §3.4 race 가드레일 밖(economy §7.2.1). 구현이 이 분리를 어기면 재검증 필요.
 *
 * 순수 함수 + 상태 비포함(파생). 구매 ID 집합(Set)은 state가 보유, D 차감·이벤트는 game.ts.
 *   → 결정성(system-flows §12.1)과 테스트(D 소비·효과·보존 정합)가 쉽다.
 *
 * 구매 흐름(system-flows §9.1):
 *   1. 구매 가능 체크: D_current ≥ cost / 미구매 / 해금 조건(선행 노드).
 *   2. D 차감 + 구매 기록(game.ts).
 *   3. 효과 적용: chainTierMultipliers가 구매 집합에서 티어 배율 배열을 재계산(파생 — 저장 안 함).
 *   4. research_mult 불변(C안).
 */

import { CHAIN_TIERS } from '../../data/constants';
import {
  RESEARCH_NODES,
  researchNodeById,
  type ResearchNode,
} from '../../data/research';

export type { ResearchNode } from '../../data/research';
export { RESEARCH_NODES, researchNodeById } from '../../data/research';

// --- 해금 판정 (system-flows §9.1 단계 1c) -----------------------------------

/**
 * 연구 가지(A 체인증폭) 해금 여부(research-tree §0·§3-C, ui-flow §3-C).
 *   A가지 = 원자층(L2) 진입 + 첫 D 획득 시. 프로토타입은 A가지만 — 첫 D 획득이 게이트.
 *   (FTUE: 첫 D 후 연구 탭 해금 — 점진 공개. ui-flow §7 "발견 데이터 축적. 연구 가능.")
 *
 * @param layerIndex 현재 층 index(2=원자층+).
 * @param hasDiscoveryData D를 한 번이라도 획득했는가(D_lifetime > 0 또는 D_current > 0).
 */
export function isResearchUnlocked(_layerIndex: number, hasDiscoveryData: boolean): boolean {
  // "연구소" 컨셉: 발견(D)이 곧 연구 연료 → 첫 D부터 해금(분자층 L1 포함). 층 게이트 제거.
  return hasDiscoveryData;
}

/**
 * 특정 노드의 선행 조건 충족 여부(research-tree prerequisites). 선행 노드가 전부 구매됐는지.
 *   루트 노드(prerequisites 빈 배열)는 항상 true.
 */
export function arePrerequisitesMet(node: ResearchNode, purchased: ReadonlySet<string>): boolean {
  return node.prerequisites.every((id) => purchased.has(id));
}

/**
 * 노드가 **구매 가능**한가(D 충분 제외 — 해금·미구매·선행만). UI 잠금/활성 분기.
 *   D 충분 여부는 canAfford로 별도(D 부족은 "흐림"이지 "잠금"이 아님 — ui-flow §3-B).
 */
export function isNodePurchasable(
  node: ResearchNode,
  purchased: ReadonlySet<string>,
): boolean {
  if (purchased.has(node.id)) return false; // 이미 구매(중복 방지 §9.3).
  return arePrerequisitesMet(node, purchased);
}

// --- 구매 (system-flows §9.1) -------------------------------------------------

/** 구매 시도 결과(game.ts가 D 차감·기록·이벤트에 사용). */
export interface BuyResearchResult {
  /** 구매 성공 여부. */
  ok: boolean;
  /** 구매한 노드(성공 시). */
  node?: ResearchNode;
  /** 실패 사유(UI 피드백 분기). */
  reason?: 'not_found' | 'already_owned' | 'locked' | 'insufficient_d';
}

/**
 * 연구 노드 구매 판정(**순수** — 상태를 바꾸지 않고 가부만 판단). game.ts가 결과로 D 차감·기록.
 *   D 비교는 native number(D는 비교적 작은 화폐 — node.costD가 number). 단 D_current는 Decimal이라
 *   호출 측이 dCurrent.gte(cost)로 비교하고 그 결과를 affordable로 넘긴다(Decimal 경계 §2.2).
 *
 * @param nodeId 구매할 노드 ID.
 * @param purchased 이미 구매한 노드 ID 집합.
 * @param affordable D_current ≥ node.costD 인가(Decimal 비교 결과 — 호출 측이 판단).
 */
export function buyResearchNode(
  nodeId: string,
  purchased: ReadonlySet<string>,
  affordable: boolean,
): BuyResearchResult {
  const node = researchNodeById(nodeId);
  if (!node) return { ok: false, reason: 'not_found' };
  if (purchased.has(nodeId)) return { ok: false, reason: 'already_owned' };
  if (!arePrerequisitesMet(node, purchased)) return { ok: false, reason: 'locked' };
  if (!affordable) return { ok: false, node, reason: 'insufficient_d' };
  return { ok: true, node };
}

// --- 효과 적용 (system-flows §9.1 단계 3, C안 tier_mult) -----------------------

/**
 * 구매한 연구 노드들의 **티어 배율 배열**(길이 8, 1-기반 T1..T8 → index 0..7). 파생 — 저장 안 함.
 *   각 tier_mult 효과의 value를 해당 티어들에 누적 곱한다(여러 노드가 같은 티어를 강화하면 곱셈).
 *   chainTick의 tierMult 경로로 들어가 **체인 내부 배율**로 작동(C안 — 전역 곱 아님, research_mult 불변).
 *
 *   ★ 하모닉 공명 tierMult(끈층)와 game.ts가 곱해 합성한다(둘 다 티어별 — 같은 인덱스 곱).
 *
 * @param purchased 구매한 노드 ID 집합.
 * @returns 길이 8 배율 배열(미강화 티어는 1). 구매 없으면 전부 1.
 */
export function chainTierMultipliers(purchased: ReadonlySet<string>): number[] {
  const mults = new Array<number>(CHAIN_TIERS).fill(1);
  for (const node of RESEARCH_NODES) {
    if (!purchased.has(node.id)) continue;
    const e = node.effect;
    if (e.kind === 'tier_mult') {
      for (const tier of e.tiers) {
        const i = tier - 1;
        if (i >= 0 && i < CHAIN_TIERS) mults[i] *= e.value;
      }
    }
  }
  return mults;
}

/**
 * 구매 노드들의 **수동 압축 파워 배율**(click_power 곱). 파생 — 저장 안 함. 없으면 1.
 *   클릭 bump에만 곱(game.ts manualCompress) — 자동 생산 레이스와 분리(안전).
 */
export function clickPowerMultiplier(purchased: ReadonlySet<string>): number {
  let m = 1;
  for (const node of RESEARCH_NODES) {
    if (purchased.has(node.id) && node.effect.kind === 'click_power') m *= node.effect.value;
  }
  return m;
}

/**
 * 구매 노드들의 **D 획득 배율**(d_yield 곱). 파생 — 저장 안 함. 없으면 1.
 *   발견·공명 D에 곱(game.ts addDiscovery) — 연구 축 가속(생산 레이스 무관).
 */
export function dYieldMultiplier(purchased: ReadonlySet<string>): number {
  let m = 1;
  for (const node of RESEARCH_NODES) {
    if (purchased.has(node.id) && node.effect.kind === 'd_yield') m *= node.effect.value;
  }
  return m;
}

/**
 * 공명 강화 집계(오비탈 공명 전용). 파생 — 저장 안 함. game.ts가 D 배율·orbital.configure에 사용.
 *   resonance_d = D 배율 곱, resonance_window = 창 연장 합(초), resonance_combo_max = 콤보 상한 증가 합.
 */
export function resonanceDMultiplier(purchased: ReadonlySet<string>): number {
  let m = 1;
  for (const node of RESEARCH_NODES) {
    if (purchased.has(node.id) && node.effect.kind === 'resonance_d') m *= node.effect.value;
  }
  return m;
}
export function resonanceWindowBonus(purchased: ReadonlySet<string>): number {
  let s = 0;
  for (const node of RESEARCH_NODES) {
    if (purchased.has(node.id) && node.effect.kind === 'resonance_window') s += node.effect.value;
  }
  return s;
}
export function resonanceComboMaxBonus(purchased: ReadonlySet<string>): number {
  let s = 0;
  for (const node of RESEARCH_NODES) {
    if (purchased.has(node.id) && node.effect.kind === 'resonance_combo_max') s += node.effect.value;
  }
  return s;
}
/** 자동 공명 연구 보유 여부(열린 슬롯 자동 잡기). */
export function hasAutoResonance(purchased: ReadonlySet<string>): boolean {
  for (const node of RESEARCH_NODES) {
    if (purchased.has(node.id) && node.effect.kind === 'auto_resonance') return true;
  }
  return false;
}

// --- UI 스냅샷 (ui-flow §3) ----------------------------------------------------

/** 연구 노드 1개의 표시 상태(ui-flow §3-B 노드 카드). */
export interface ResearchNodeView {
  id: string;
  nameKo: string;
  effectKo: string;
  flavorKo: string;
  costD: number;
  /** 이미 구매했는가(✓ 완료 표시). */
  purchased: boolean;
  /** 선행 충족(미충족이면 잠금 — 흐림 + 자물쇠). */
  unlocked: boolean;
  /** 지금 D로 구매 가능한가(미구매·해금·D 충분). */
  affordable: boolean;
  /** 선행 노드 한국어 이름(잠금 툴팁용, 빈 배열=루트). */
  prereqNamesKo: string[];
}

/** 연구 화면 전체 표시 상태(ui-flow §3-A). */
export interface ResearchView {
  /** 연구 탭 해금 여부(첫 D — false면 탭 숨김). */
  unlocked: boolean;
  /** A 가지 노드 목록(표시 순서 = 데이터 순서). */
  nodes: ResearchNodeView[];
  /** A 가지 완료율 [구매수, 전체]. */
  branchProgress: [number, number];
}

/**
 * 연구 화면 스냅샷(파생 — game.ts가 매 스냅샷 재계산, 저장 안 함).
 * @param purchased 구매 노드 집합.
 * @param unlocked 연구 탭 해금(isResearchUnlocked 결과).
 * @param canAfford (nodeId)=>boolean : D_current ≥ costD 판정(Decimal 비교, 호출 측 주입).
 */
export function researchSnapshot(
  purchased: ReadonlySet<string>,
  unlocked: boolean,
  canAfford: (costD: number) => boolean,
): ResearchView {
  const nodes: ResearchNodeView[] = RESEARCH_NODES.map((n) => {
    const isPurchased = purchased.has(n.id);
    const prereqMet = arePrerequisitesMet(n, purchased);
    return {
      id: n.id,
      nameKo: n.nameKo,
      effectKo: n.effectKo,
      flavorKo: n.flavorKo,
      costD: n.costD,
      purchased: isPurchased,
      unlocked: prereqMet,
      affordable: !isPurchased && prereqMet && canAfford(n.costD),
      prereqNamesKo: n.prerequisites
        .map((id) => researchNodeById(id)?.nameKo ?? id)
        .filter((s): s is string => !!s),
    };
  });
  const bought = nodes.filter((n) => n.purchased).length;
  return { unlocked, nodes, branchProgress: [bought, RESEARCH_NODES.length] };
}
