/**
 * 연구 트리 검증 (M1.7 — research-tree.md, economy §7.2 C안, system-flows §9). A가지 체인증폭 2노드.
 *
 * 커버:
 *  - 노드 데이터(A1·A2): 효과 종류·비용·선행. data/research.ts 정합.
 *  - 해금 게이트: 첫 D + 원자층(L2). 미충족 시 잠금(isResearchUnlocked).
 *  - 선행 조건: A2는 A1 선행. 미구매면 잠금(arePrerequisitesMet).
 *  - 구매 판정(buyResearchNode): 미발견/중복/잠금/D부족 분기.
 *  - 효과 적용(chainTierMultipliers): A1→T1 ×1.5, A2→T5~T8 ×1.5, 합성 곱.
 *  - ★ C안 불변: 효과는 **특정 티어만**(전역 곱 아님 — research_mult≈1.0). T2~T4는 항상 ×1.
 *  - 직렬화 라운드트립: research.purchased 보존(영구).
 */
import { describe, it, expect } from 'vitest';
import {
  RESEARCH_NODES,
  researchNodeById,
  isResearchUnlocked,
  arePrerequisitesMet,
  isNodePurchasable,
  buyResearchNode,
  chainTierMultipliers,
  researchSnapshot,
} from '../research';
import { createInitialState } from '../state';
import { serializeState, deserializeState } from '../save/serialize';

describe('연구 노드 데이터 — A가지 체인증폭 (research-tree §2)', () => {
  it('프로토타입 = 2노드(A1·A2), 둘 다 CHAIN 가지', () => {
    expect(RESEARCH_NODES.length).toBe(2);
    expect(RESEARCH_NODES.every((n) => n.branch === 'CHAIN')).toBe(true);
  });

  it('A1: T1 ×1.5, 비용 50 D, 선행 없음(루트)', () => {
    const a1 = researchNodeById('A1')!;
    expect(a1.effect).toEqual({ kind: 'tier_mult', tiers: [1], value: 1.5 });
    expect(a1.costD).toBe(50);
    expect(a1.prerequisites).toEqual([]);
  });

  it('A2: T5~T8 ×1.5, 비용 500 D, A1 선행', () => {
    const a2 = researchNodeById('A2')!;
    expect(a2.effect).toEqual({ kind: 'tier_mult', tiers: [5, 6, 7, 8], value: 1.5 });
    expect(a2.costD).toBe(500);
    expect(a2.prerequisites).toEqual(['A1']);
  });

  it('없는 id → undefined', () => {
    expect(researchNodeById('ZZZ')).toBeUndefined();
  });
});

describe('해금 게이트 — 첫 D + 원자층 (research-tree §3-C, ui-flow §3-C)', () => {
  it('분자층(L1) → 미해금(원자층 게이트)', () => {
    expect(isResearchUnlocked(1, true)).toBe(false);
  });
  it('원자층(L2) + D 없음 → 미해금', () => {
    expect(isResearchUnlocked(2, false)).toBe(false);
  });
  it('원자층(L2) + D 보유 → 해금', () => {
    expect(isResearchUnlocked(2, true)).toBe(true);
  });
  it('미지 진입(L6) + D 보유 → 해금(상위 층에서도 유지)', () => {
    expect(isResearchUnlocked(6, true)).toBe(true);
  });
});

describe('선행 조건 — A2는 A1 선행 (research-tree prerequisites)', () => {
  it('A1(루트): 빈 집합에서도 선행 충족', () => {
    expect(arePrerequisitesMet(researchNodeById('A1')!, new Set())).toBe(true);
  });
  it('A2: A1 미구매면 미충족', () => {
    expect(arePrerequisitesMet(researchNodeById('A2')!, new Set())).toBe(false);
  });
  it('A2: A1 구매 후 충족', () => {
    expect(arePrerequisitesMet(researchNodeById('A2')!, new Set(['A1']))).toBe(true);
  });

  it('isNodePurchasable: 이미 구매 → false, 선행 미충족 → false', () => {
    expect(isNodePurchasable(researchNodeById('A1')!, new Set(['A1']))).toBe(false); // 중복
    expect(isNodePurchasable(researchNodeById('A2')!, new Set())).toBe(false); // 선행 미충족
    expect(isNodePurchasable(researchNodeById('A1')!, new Set())).toBe(true); // 가능
  });
});

describe('구매 판정 — buyResearchNode (system-flows §9.3 분기)', () => {
  it('정상 구매: 미구매·선행충족·D충분 → ok', () => {
    const r = buyResearchNode('A1', new Set(), true);
    expect(r.ok).toBe(true);
    expect(r.node?.id).toBe('A1');
  });
  it('없는 노드 → not_found', () => {
    expect(buyResearchNode('ZZZ', new Set(), true).reason).toBe('not_found');
  });
  it('이미 구매 → already_owned', () => {
    expect(buyResearchNode('A1', new Set(['A1']), true).reason).toBe('already_owned');
  });
  it('선행 미충족 → locked (A2, A1 없음)', () => {
    expect(buyResearchNode('A2', new Set(), true).reason).toBe('locked');
  });
  it('D 부족 → insufficient_d', () => {
    const r = buyResearchNode('A1', new Set(), false);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('insufficient_d');
  });
});

describe('효과 적용 — chainTierMultipliers (C안 tier_mult)', () => {
  it('구매 없음 → 전부 ×1', () => {
    expect(chainTierMultipliers(new Set())).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('A1 구매 → T1만 ×1.5, 나머지 ×1', () => {
    const m = chainTierMultipliers(new Set(['A1']));
    expect(m[0]).toBe(1.5); // T1
    expect(m.slice(1)).toEqual([1, 1, 1, 1, 1, 1, 1]); // T2~T8
  });

  it('A2 구매 → T5~T8 ×1.5, T1~T4 ×1', () => {
    const m = chainTierMultipliers(new Set(['A2']));
    expect(m.slice(0, 4)).toEqual([1, 1, 1, 1]); // T1~T4
    expect(m.slice(4)).toEqual([1.5, 1.5, 1.5, 1.5]); // T5~T8
  });

  it('A1+A2 모두 → T1 ×1.5, T5~T8 ×1.5, T2~T4 ×1(겹침 없음)', () => {
    const m = chainTierMultipliers(new Set(['A1', 'A2']));
    expect(m).toEqual([1.5, 1, 1, 1, 1.5, 1.5, 1.5, 1.5]);
  });

  it('★ C안 불변: 전 티어 동일 곱이 아님(T2~T4는 항상 1) — research_mult≈1.0 보장', () => {
    // 모든 노드 구매해도 중간 티어(T2,T3,T4)는 절대 강화 안 됨 → 전역 곱 아님(체인 내부 일부).
    const m = chainTierMultipliers(new Set(['A1', 'A2']));
    expect(m[1]).toBe(1); // T2
    expect(m[2]).toBe(1); // T3
    expect(m[3]).toBe(1); // T4
  });
});

describe('연구 스냅샷 — researchSnapshot (ui-flow §3 표시 상태)', () => {
  it('미해금: unlocked false', () => {
    const v = researchSnapshot(new Set(), false, () => true);
    expect(v.unlocked).toBe(false);
    expect(v.branchProgress).toEqual([0, 2]);
  });

  it('A1 구매 가능(D 충분) → affordable true, A2는 선행 미충족 잠금', () => {
    const v = researchSnapshot(new Set(), true, () => true);
    const a1 = v.nodes.find((n) => n.id === 'A1')!;
    const a2 = v.nodes.find((n) => n.id === 'A2')!;
    expect(a1.affordable).toBe(true);
    expect(a1.unlocked).toBe(true); // 선행 없음.
    expect(a2.unlocked).toBe(false); // A1 선행 미충족.
    expect(a2.affordable).toBe(false);
  });

  it('A1 구매 후: A1 purchased, A2 해금(선행 충족)·D 충분 시 affordable', () => {
    const v = researchSnapshot(new Set(['A1']), true, () => true);
    const a1 = v.nodes.find((n) => n.id === 'A1')!;
    const a2 = v.nodes.find((n) => n.id === 'A2')!;
    expect(a1.purchased).toBe(true);
    expect(a2.unlocked).toBe(true);
    expect(a2.affordable).toBe(true);
    expect(a2.prereqNamesKo).toContain('T1 증폭기'); // 선행 노드 한국어 이름.
    expect(v.branchProgress).toEqual([1, 2]);
  });

  it('D 부족: affordable false(잠금 아님 — 해금은 됨)', () => {
    const v = researchSnapshot(new Set(), true, () => false);
    const a1 = v.nodes.find((n) => n.id === 'A1')!;
    expect(a1.unlocked).toBe(true); // 선행 충족.
    expect(a1.affordable).toBe(false); // D 부족.
  });
});

describe('직렬화 — research.purchased 라운드트립 (§1.1 영구 보존)', () => {
  it('구매 노드 집합 직렬화/복원', () => {
    const s = createInitialState();
    s.research.purchased.add('A1');
    s.research.purchased.add('A2');

    const data = serializeState(s);
    expect(data.research?.purchased).toEqual(['A1', 'A2']); // 정렬 배열.

    const restored = deserializeState(data);
    expect(restored.research.purchased.has('A1')).toBe(true);
    expect(restored.research.purchased.has('A2')).toBe(true);
    expect(restored.research.purchased.size).toBe(2);
  });

  it('구버전(research 없음) → 빈 집합(§1.3 방어)', () => {
    const data = serializeState(createInitialState());
    delete (data as { research?: unknown }).research;
    const restored = deserializeState(data as never);
    expect(restored.research.purchased.size).toBe(0);
  });

  it('손상 값(문자열 아님) 무시(§1.3)', () => {
    const data = serializeState(createInitialState());
    (data.research as { purchased: unknown }).purchased = ['A1', 123, null, 'A2'];
    const restored = deserializeState(data);
    expect([...restored.research.purchased].sort()).toEqual(['A1', 'A2']);
  });
});
