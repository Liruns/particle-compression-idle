/**
 * 8단 압축기 체인 + 코어 수식 검증. (M1.2)
 * economy.md 확정값과의 정합을 증명한다(test-strategy 단위 우선).
 *
 * 커버:
 *  - 비용 곡선: base_k 테이블(§2.1), growth_k 내림차순, cost_k(n)=base·growth^n.
 *  - 닫힌형 대량구매: bulk_cost 등비급수 정확, max_affordable 역산, planBuy 잔액 재검증.
 *  - 코어 수식: dec=α·log₁₀(C+1), r=r₀·10^(−dec), production_mult.
 *  - 체인 엔진: 역순 단일 패스 생산, T1 시드, 8단 자기증식.
 *  - 페이싱 정합: dec19 ≈ 4.27h (economy §1.2 PT1, sim 재현).
 *  - 최적 티어 전환: 후반(깊은 보유) → T8 최저가 (§2.4).
 */
import { describe, it, expect } from 'vitest';
import { D, ZERO } from '../bignum';
import {
  computeDec,
  computeRadius,
  productionMult,
  tierCost,
  tierBase,
  tierGrowth,
  bulkCost,
  maxAffordable,
  planBuy,
  chainTick,
  composeOwned,
  emptyOwned,
  tierProductionRate,
  CHAIN_TIERS,
  SEED_T1_BOUGHT,
} from '../chain';
import { COST_BASE_EXP, COST_GROWTH } from '../../data/constants';

// economy §2.1 확정 base_k 표 (검증 기준값).
const BASE_K_TABLE = [
  1.995262e2, // T1 = 10^2.3
  3.981072e3, // T2 = 10^3.6
  7.943282e4, // T3 = 10^4.9
  1.584893e6, // T4 = 10^6.2
  3.162278e7, // T5 = 10^7.5
  6.309573e8, // T6 = 10^8.8
  1.258925e10, // T7 = 10^10.1
  2.511886e11, // T8 = 10^11.4
];
// economy §2.1 growth_k = 2.2 − (0.4/7)(k−1).
const GROWTH_K_TABLE = [2.2, 2.142857, 2.085714, 2.028571, 1.971429, 1.914286, 1.857143, 1.8];

describe('비용 곡선 — economy §2.1 확정값', () => {
  it('base_k = 10^(1+1.3k) 테이블 정합(T1..T8)', () => {
    for (let k = 1; k <= CHAIN_TIERS; k++) {
      const expected = BASE_K_TABLE[k - 1];
      // 상대오차 < 1e-5
      expect(tierBase(k).div(expected).sub(1).abs().toNumber()).toBeLessThan(1e-5);
      // 상수 공식과도 정합
      expect(COST_BASE_EXP(k)).toBeCloseTo(1 + 1.3 * k, 10);
    }
  });

  it('growth_k 내림차순 2.2 → 1.8', () => {
    for (let k = 1; k <= CHAIN_TIERS; k++) {
      expect(tierGrowth(k)).toBeCloseTo(GROWTH_K_TABLE[k - 1], 6);
      expect(COST_GROWTH(k)).toBeCloseTo(GROWTH_K_TABLE[k - 1], 6);
    }
    // 단조 감소 + 경계값
    expect(tierGrowth(1)).toBe(2.2);
    expect(tierGrowth(8)).toBeCloseTo(1.8, 10);
    for (let k = 1; k < CHAIN_TIERS; k++) {
      expect(tierGrowth(k)).toBeGreaterThan(tierGrowth(k + 1));
    }
  });

  it('cost_k(n) = base_k · growth_k^n', () => {
    // T1, n=0 → base (BASE_K_TABLE는 7자리 반올림이므로 tol 1e-5).
    expect(tierCost(1, 0).div(BASE_K_TABLE[0]).sub(1).abs().toNumber()).toBeLessThan(1e-5);
    // cost_k(n) = base_k · growth_k^n 정확 항등(전정밀): cost(1,5) = base·2.2^5.
    const exact = tierBase(1).mul(D(2.2).pow(5));
    expect(tierCost(1, 5).eq(exact)).toBe(true);
    // n 증가 → 비용 증가(단조)
    expect(tierCost(3, 10).gt(tierCost(3, 9))).toBe(true);
  });
});

describe('닫힌형 대량구매 — 등비급수 (economy §0, while-bank 금지)', () => {
  it('bulk_cost = base·growth^owned·(growth^n−1)/(growth−1)', () => {
    // T1, owned=0: 알려진 정확값(Python 재현).
    const cases: [number, number][] = [
      [1, 1.995262e2],
      [2, 6.384839e2],
      [3, 1.604191e3],
      [5, 8.402768e3],
      [10, 4.414505e5],
    ];
    for (const [n, expected] of cases) {
      expect(bulkCost(1, 0, n).div(expected).sub(1).abs().toNumber()).toBeLessThan(1e-5);
    }
  });

  it('bulk_cost(n=1) = cost_k(owned) (단일구매 일치)', () => {
    for (let owned = 0; owned < 5; owned++) {
      expect(bulkCost(2, owned, 1).eq(tierCost(2, owned))).toBe(true);
    }
  });

  it('bulk_cost = 개별 cost 합 (정의 검증)', () => {
    // owned=3에서 4개 구매 = cost(3)+cost(4)+cost(5)+cost(6)
    let manual = ZERO;
    for (let i = 3; i < 7; i++) manual = manual.add(tierCost(4, i));
    expect(bulkCost(4, 3, 4).div(manual).sub(1).abs().toNumber()).toBeLessThan(1e-9);
  });

  it('max_affordable 역산 (T1 owned=0)', () => {
    const cases: [number, number][] = [
      [1e2, 0],
      [1e3, 2],
      [1e4, 5],
      [1e5, 8],
      [1e6, 11],
    ];
    for (const [bank, expected] of cases) {
      expect(maxAffordable(1, 0, D(bank))).toBe(expected);
    }
  });

  it('max_affordable 정합: bulk_cost(maxAff) ≤ bank < bulk_cost(maxAff+1)', () => {
    const bank = D('5e7');
    const n = maxAffordable(3, 2, bank);
    expect(bulkCost(3, 2, n).lte(bank)).toBe(true);
    expect(bulkCost(3, 2, n + 1).gt(bank)).toBe(true);
  });

  it('planBuy: target 제한 + 잔액 재검증', () => {
    // 충분한 bank, target=10 → 정확히 10개, cost ≤ bank
    const bank = D('1e8');
    const p = planBuy(1, 0, bank, 10);
    expect(p.count).toBe(10);
    expect(p.cost.lte(bank)).toBe(true);
    // Max(target<0) → max_affordable 전량
    const pmax = planBuy(1, 0, bank, -1);
    expect(pmax.count).toBe(maxAffordable(1, 0, bank));
    // 부족하면 0
    expect(planBuy(1, 0, D(10), 1).count).toBe(0);
  });
});

describe('코어 수식 — GDD §7 / economy §1.1', () => {
  it('dec = α·log₁₀(C+1), α=0.65', () => {
    expect(computeDec(0)).toBe(0);
    expect(computeDec(D('1e10'))).toBeCloseTo(6.5, 6); // 0.65·10
    expect(computeDec(D('1e26'))).toBeCloseTo(16.9, 6);
    expect(computeDec(D('1e40'))).toBeCloseTo(26.0, 6);
  });

  it('r = r₀·10^(−dec), r₀=1e-9 (작아짐=강해짐)', () => {
    expect(computeRadius(0).eq('1e-9')).toBe(true);
    // C=1e40 → dec=26 → r=1e-9·10^-26 = 1e-35 (플랑크 근방)
    expect(computeRadius(D('1e40')).div('1e-35').sub(1).abs().toNumber()).toBeLessThan(1e-9);
    // C 증가 → r 단조 감소
    expect(computeRadius(D('1e26')).lt(computeRadius(D('1e10')))).toBe(true);
  });

  it('production_mult = 1 + 0.25·log₁₀(1+QF)', () => {
    expect(productionMult(0).eq(1)).toBe(true);
    // 정확 항등: 1 + 0.25·log₁₀(1+QF). (QF=1e4 → log₁₀(10001)≈4.0000434 → ≈2.00001)
    const qf = D('1e4');
    const exact = D(1).add(D(0.25).mul(qf.add(1).log10()));
    expect(productionMult(qf).eq(exact)).toBe(true);
    expect(productionMult(qf).toNumber()).toBeCloseTo(2.0, 4);
    // QF=10.84M (PT6) → 빅 크런치 진입 mult ≈ 2.76 (economy §1.2 밴드 2~3×)
    expect(productionMult(D('1.084e7')).toNumber()).toBeCloseTo(2.759, 2);
  });
});

describe('체인 엔진 — 역순 단일 패스 (engine.py 동형)', () => {
  it('T1 시드 1개 → C가 t=0부터 누적', () => {
    const bought = new Array<number>(CHAIN_TIERS).fill(0);
    bought[0] = SEED_T1_BOUGHT;
    const produced = emptyOwned();
    const r = chainTick(bought, produced, D(1), 1);
    // dC = g1·mult·dt = 1·1·1 = 1
    expect(r.dC.eq(1)).toBe(true);
    expect(r.dE.eq(r.dC)).toBe(true);
  });

  it('상위 티어가 하위를 생산(T2 → T1 누적)', () => {
    const bought = [1, 1, 0, 0, 0, 0, 0, 0];
    const produced = emptyOwned();
    const r = chainTick(bought, produced, D(1), 1);
    // produced[T1] += g[T2]·mult·dt = 1
    expect(r.produced[0].eq(1)).toBe(true);
    // C = g[T1]·mult·dt = 1 (이번 틱 생산분은 다음 틱에 반영 — 스냅샷)
    expect(r.dC.eq(1)).toBe(true);
  });

  it('동시 갱신: 같은 틱 생산은 직전 g 기준(단일 패스 결정성)', () => {
    // T3=1, T2=0, T1=0 → 한 틱 후 produced[T2]=1, produced[T1]=0 (T2 증분은 다음 틱)
    const bought = [0, 0, 1, 0, 0, 0, 0, 0];
    const r = chainTick(bought, emptyOwned(), D(1), 1);
    expect(r.produced[1].eq(1)).toBe(true); // T2 받음
    expect(r.produced[0].eq(0)).toBe(true); // T1은 아직(T2가 이번 틱엔 0이었음)
    expect(r.dC.eq(0)).toBe(true);
  });

  it('composeOwned = bought + produced', () => {
    const owned = composeOwned([3, 2, 0, 0, 0, 0, 0, 0], [D('1.5'), ZERO, ZERO, ZERO, ZERO, ZERO, ZERO, ZERO]);
    expect(owned[0].eq('4.5')).toBe(true);
    expect(owned[1].eq(2)).toBe(true);
  });

  it('tierProductionRate(T1) = g1·mult', () => {
    const owned = composeOwned([5, 0, 0, 0, 0, 0, 0, 0], emptyOwned());
    expect(tierProductionRate(0, owned, D(2)).eq(10)).toBe(true); // 5·2
  });

  it('mult 적용: production_mult가 생산을 스케일', () => {
    const bought = [2, 0, 0, 0, 0, 0, 0, 0];
    const r1 = chainTick(bought, emptyOwned(), D(1), 1);
    const r2 = chainTick(bought, emptyOwned(), D(3), 1);
    expect(r2.dC.div(r1.dC).eq(3)).toBe(true);
  });
});

describe('페이싱 정합 — economy §1.2 (TS chainTick 직접 시뮬)', () => {
  /**
   * dt=1s 이산 시뮬을 TS 엔진으로 직접 돌려 dec19 도달 시각을 잰다.
   * economy §1.2: PT1(dec19) = 4.26h, dec26 = 62.66h (mult=1 단일런, Max 고티어우선 구매).
   * sim/engine.py·campaign6.py와 동일 모델 → 4.27h 재현(±2% 허용).
   */
  function simulateToDecade(targetDec: number, maxHours: number): number {
    const bought = new Array<number>(CHAIN_TIERS).fill(0);
    bought[0] = SEED_T1_BOUGHT;
    let produced = emptyOwned();
    let C = ZERO;
    let E = ZERO;
    const mult = D(1);
    const dt = 1;
    const maxT = maxHours * 3600;
    for (let t = 0; t < maxT; t++) {
      const r = chainTick(bought, produced, mult, dt);
      produced = r.produced;
      C = C.add(r.dC);
      E = E.add(r.dE);
      // 고티어 우선 Max 구매(시뮬 휴리스틱, system-flows §12.1).
      for (let tier = CHAIN_TIERS; tier >= 1; tier--) {
        const idx = tier - 1;
        const plan = planBuy(tier, bought[idx], E, -1);
        if (plan.count > 0) {
          E = E.sub(plan.cost);
          bought[idx] += plan.count;
        }
      }
      if (computeDec(C) >= targetDec) return t / 3600;
    }
    return Infinity;
  }

  it('dec19 (PT1) ≈ 4.27h (economy §1.2)', () => {
    const hours = simulateToDecade(19, 8);
    expect(hours).toBeGreaterThan(4.0);
    expect(hours).toBeLessThan(4.6);
  });

  it('dec9 (쿼크 한계) ≈ 1.2h (economy §2.2)', () => {
    // §2.2: dec9 누적 1.197h. 온보딩 dec1~5는 분 단위(dec1=0.009h)이나 dec9까지는 ~1.2h.
    const hours = simulateToDecade(9, 2);
    expect(hours).toBeGreaterThan(1.0);
    expect(hours).toBeLessThan(1.4);
  });

  it('dec1 점화 < 0.05h (첫 자기증식, §2.2 dec1=0.009h)', () => {
    const hours = simulateToDecade(1, 0.5);
    expect(hours).toBeLessThan(0.05);
  });
});

describe('최적 구매 티어 전환 — economy §2.4', () => {
  /** 다음 1개 최저가(해금된 티어 중) 인덱스. */
  function cheapestNextTier(owned: number[]): number {
    let best = -1;
    let bestCost = null as ReturnType<typeof tierCost> | null;
    for (let i = 0; i < CHAIN_TIERS; i++) {
      const unlocked = i === 0 || owned[i - 1] > 0;
      if (!unlocked) continue;
      const c = tierCost(i + 1, owned[i]);
      if (bestCost === null || c.lt(bestCost)) {
        bestCost = c;
        best = i + 1;
      }
    }
    return best;
  }

  it('후반(깊은 보유, 전 티어 80~110) → T8 최저가', () => {
    // economy §2.4: growth^n이 고-base 티어를 상대적으로 싸게 만듦 → 후반 T8.
    const late = [110, 108, 105, 100, 95, 90, 85, 80];
    expect(cheapestNextTier(late)).toBe(8);
  });

  it('초반(T1만 소량) → 저티어 우선', () => {
    // 초반엔 낮은 base가 지배 → T1 또는 인접 저티어.
    const early = [5, 1, 0, 0, 0, 0, 0, 0];
    expect(cheapestNextTier(early)).toBeLessThanOrEqual(2);
  });

  it('전환 단조성: 보유가 깊어질수록 최적 티어 인덱스 비감소 경향', () => {
    const shallow = cheapestNextTier([10, 3, 1, 0, 0, 0, 0, 0]);
    const deep = cheapestNextTier([110, 108, 105, 100, 95, 90, 85, 80]);
    expect(deep).toBeGreaterThanOrEqual(shallow);
  });
});
