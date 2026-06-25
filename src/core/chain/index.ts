/**
 * chain — 8단 압축기 체인 생산/비용 + 코어 r/dec 매핑(파생 계산). (economy.md §1·§2, GDD §7)
 *
 * tech-architecture.md §1.1 진실/파생 분리: 비용 곡선·생산량·dec·r·production_mult는 전부
 *   **파생값 → 저장 금지, 로드 후 재계산**. 이 모듈은 그 파생 함수를 모은 곳이다(순수 함수).
 *
 * 스캐폴딩 범위: 헬로 셸이 "C → dec → r" 와 production_mult를 정확히 계산할 수 있게 한다.
 *   8단 체인 자기증식(t^n/n!)·구매·벽 판정의 풀 구현은 M1.2~M1.5. 여기선 코어 매핑 + 비용 스텁.
 */

import { Decimal, D, pow10, mul, add, type DecimalSource } from '../bignum';
import {
  ALPHA,
  R0_METERS,
  COST_BASE_EXP,
  COST_GROWTH,
  QF_PRODUCTION_RATE,
} from '../../data/constants';

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
 * 모든 생산에 곱해지는 프레스티지 배율. 헬로 셸에선 QF=0 → 1.0.
 */
export function productionMult(QF: DecimalSource): Decimal {
  const qf = D(QF);
  return add(1, mul(QF_PRODUCTION_RATE, qf.add(1).log10()));
}

/**
 * cost_k(n) = base_k · growth_k^n.  (economy.md §2)
 *   base_k = 10^(1 + 1.3·k),  growth_k = 2.2 − (0.4/7)·(k−1).
 * @param tier 1-기반 티어 인덱스 k (1..8)
 * @param n    이미 보유한 개수(다음 1개 비용 = cost_k(n))
 */
export function tierCost(tier: number, n: number): Decimal {
  const base = pow10(COST_BASE_EXP(tier));
  const growth = D(COST_GROWTH(tier));
  return base.mul(growth.pow(n));
}

/**
 * 헬로 셸용 임시 생산 rate: dC/dt.
 * 풀 체인(t^n/n! 자기증식)은 M1.2. 지금은 "구조가 돈다"를 보이기 위한 최소 생산:
 *   기본 1/s에 production_mult를 곱한 값. (체인 보유 0이어도 C가 증가해 dec/r가 움직인다.)
 */
export function helloShellRate(QF: DecimalSource): Decimal {
  return productionMult(QF); // 1.0/s × mult
}
