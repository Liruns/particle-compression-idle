/**
 * chain — 8단 압축기 체인 + 코어 r/dec/배율 매핑(파생 계산). (economy.md §1·§2, GDD §7)
 *
 * tech-architecture.md §1.1 진실/파생 분리: 비용 곡선·생산량·dec·r·production_mult는 전부
 *   **파생값 → 저장 금지, 로드 후 재계산**(produced 누적분만 진짜 상태로 보존 — engine.ts 참조).
 *
 * 이 파일 = 코어 수식(dec·r·production_mult) + 비용/엔진 재노출.
 *   - 8단 체인 엔진(역순 단일 패스):    engine.ts
 *   - 비용 곡선·닫힌형 대량구매:          cost.ts
 *   - 코어 수식(dec·r·production_mult):  여기
 */

import { Decimal, D, pow10, mul, add, type DecimalSource } from '../bignum';
import { ALPHA, R0_METERS, QF_PRODUCTION_RATE } from '../../data/constants';

/**
 * dec = α · log₁₀(C + 1).  (GDD §7 — 로그 저항: 작아질수록 기하급수로 어려움)
 * 반환은 native number(dec는 ~0..26 범위의 스칼라 — 벽 비교·표시에 쓰임).
 */
export function computeDec(C: DecimalSource): number {
  const c = D(C);
  if (c.lte(0)) return 0;
  return ALPHA * c.add(1).log10().toNumber();
}

/**
 * r = r₀ · 10^(−dec).  (GDD §7 — "작아짐=강해짐"의 작아짐 측)
 * Decimal 반환(극소값, 예: 1.6e-35 m). format.formatRadius가 표시 담당.
 */
export function computeRadius(C: DecimalSource): Decimal {
  const dec = computeDec(C);
  return mul(R0_METERS, pow10(-dec));
}

/**
 * production_mult = 1 + QF_PRODUCTION_RATE · log₁₀(1 + QF_total).  (economy.md §1.1)
 * 모든 생산에 곱해지는 프레스티지 배율. QF=0 → 1.0.
 * (holographic_mult·research_mult 결합은 M1.6+ — 현재 C안 research_mult=1.0이라 QF항만.)
 */
export function productionMult(QF: DecimalSource): Decimal {
  const qf = D(QF);
  return add(1, mul(QF_PRODUCTION_RATE, qf.add(1).log10()));
}

// --- 비용 곡선 (cost.ts 재노출) ----------------------------------------------
export {
  tierCost,
  tierBase,
  tierGrowth,
  bulkCost,
  maxAffordable,
  planBuy,
  type BuyPlan,
} from './cost';

// --- 체인 엔진 (engine.ts 재노출) --------------------------------------------
export {
  chainTick,
  composeOwned,
  emptyOwned,
  chainRateC,
  tierProductionRate,
  SEED_T1_BOUGHT,
  CHAIN_TIERS,
  type ChainTickResult,
  type ChainRuntime,
} from './engine';
