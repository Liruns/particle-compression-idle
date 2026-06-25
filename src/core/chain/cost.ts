/**
 * chain/cost — 비용 곡선 + 닫힌형 대량구매. (economy.md §2·§0, system-flows.md §2)
 *
 * 비용:  cost_k(n) = base_k · growth_k^n
 *        base_k   = 10^(1 + 1.3·k)            (T1=10^2.3 … T8=10^11.4)
 *        growth_k = 2.2 − (0.4/7)·(k−1)       (내림차순 T1=2.2 … T8=1.8)
 *
 * **닫힌형 등비급수**(economy §0 — `while-bank` 루프 절대 금지):
 *   n개 누적 구매 비용(이미 owned개 보유):
 *     bulk_cost = base·growth^owned · (growth^n − 1)/(growth − 1)
 *   bank로 살 수 있는 최대 수량:
 *     max_affordable = floor( log_growth( bank·(growth−1)/(base·growth^owned) + 1 ) )
 *
 * 전부 Decimal(tech-arch §2.2). 지수 n·owned는 native number(정수 카운트), 결과는 Decimal(§2.2 경계).
 */

import { Decimal, D, ZERO, type DecimalSource } from '../bignum';
import { COST_BASE_EXP, COST_GROWTH } from '../../data/constants';

/** base_k = 10^(1 + 1.3·k). (Decimal pow10로 생성 — magnitude만 필요.) */
export function tierBase(tier: number): Decimal {
  return Decimal.pow(10, COST_BASE_EXP(tier));
}

/** growth_k = 2.2 − (0.4/7)·(k−1). 스칼라(native) — 비교/지수 계산에 쓰임. */
export function tierGrowth(tier: number): number {
  return COST_GROWTH(tier);
}

/**
 * cost_k(n) = base_k · growth_k^n. 다음 1개 비용은 cost_k(owned).
 * @param tier 1-기반 티어 k (1..8)
 * @param n    이미 보유한 개수(정수)
 */
export function tierCost(tier: number, n: number): Decimal {
  const base = tierBase(tier);
  return base.mul(D(tierGrowth(tier)).pow(n));
}

/**
 * 닫힌형 등비급수: owned개 보유 상태에서 count개 추가 구매 총비용.
 *   Σ_{i=0}^{count-1} base·growth^(owned+i) = base·growth^owned·(growth^count − 1)/(growth − 1)
 * @returns count<=0 이면 0.
 */
export function bulkCost(tier: number, owned: number, count: number): Decimal {
  if (count <= 0) return ZERO;
  const base = tierBase(tier);
  const growth = tierGrowth(tier);
  // growth==1 방어(이론상 불가 — growth 1.8~2.2): 등비급수 분모 0 → 선형 합 count·base(system-flows §2.3).
  if (growth === 1) return base.mul(count);
  const g = D(growth);
  const first = base.mul(g.pow(owned)); // base·growth^owned = cost_k(owned)
  // (growth^count − 1)/(growth − 1)
  const ratio = g.pow(count).sub(1).div(g.sub(1));
  return first.mul(ratio);
}

/**
 * 닫힌형 max-affordable: bank로 owned에서 시작해 살 수 있는 최대 개수.
 *   bank ≥ base·growth^owned·(growth^n − 1)/(growth − 1) 를 n에 대해 풀면
 *   n = floor( log_growth( bank·(growth−1)/(base·growth^owned) + 1 ) )
 * @param tier  1-기반 티어 k
 * @param owned 현재 보유 개수(정수)
 * @param bank  사용 가능 자원 E (Decimal)
 * @returns 살 수 있는 최대 정수 개수(0 이상). native number.
 */
export function maxAffordable(tier: number, owned: number, bank: DecimalSource): number {
  const base = tierBase(tier);
  const growth = tierGrowth(tier);
  const b = D(bank);
  const cur = base.mul(D(growth).pow(owned)); // 다음 1개 비용
  if (b.lt(cur)) return 0;
  if (growth === 1) {
    // 선형: n = floor(bank / cur)
    return Math.max(0, Math.floor(b.div(cur).toNumber()));
  }
  // val = bank·(growth−1)/(base·growth^owned) + 1
  const val = b.mul(growth - 1).div(cur).add(1);
  if (val.lte(0)) return 0;
  // n = floor( log_growth(val) ) = floor( log10(val) / log10(growth) )
  const n = Math.floor(val.log10().toNumber() / Math.log10(growth));
  return n > 0 ? n : 0;
}

/**
 * 구매 계획 계산(원자 적용 전 단계, system-flows §2.1).
 * target개(또는 max)를 사려 할 때 실제 구매 수량·총비용을 닫힌형으로 산출.
 *   - target<0 이면 "Max"(전액): max_affordable 전량.
 *   - 부동소수 경계로 total > bank가 되면 1개 줄여 재계산(§2.3 잔액 재검증).
 */
export interface BuyPlan {
  /** 실제 구매 가능 수량. */
  count: number;
  /** 총비용(Decimal). */
  cost: Decimal;
}

export function planBuy(
  tier: number,
  owned: number,
  bank: DecimalSource,
  target: number,
): BuyPlan {
  const affordable = maxAffordable(tier, owned, bank);
  let count = target < 0 ? affordable : Math.min(target, affordable);
  if (count <= 0) return { count: 0, cost: ZERO };

  let cost = bulkCost(tier, owned, count);
  // 잔액 재검증(부동소수 오차로 cost가 bank 초과 시 1개 감소, §2.3).
  const b = D(bank);
  if (cost.gt(b) && count > 1) {
    count -= 1;
    cost = bulkCost(tier, owned, count);
  }
  if (cost.gt(b)) return { count: 0, cost: ZERO };
  return { count, cost };
}
