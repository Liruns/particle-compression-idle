/**
 * chain/engine — 8단 압축기 체인 엔진. (economy.md §2, system-flows.md §1·§2)
 *
 * design/sim/engine.py 의 **검증된 이산 모델과 동형**(Euler, 역순 단일 패스).
 *   - Tk(k=2..8)가 Tk-1을 생산. T1이 C·E를 생산.
 *   - dg_k/dt = g_{k+1}·mult        (k=1..7,  역순 패스: g8→g7→…→g1)
 *   - dC/dt   = g_1·mult,  dE/dt = g_1·mult   (E = 구매 통화, C와 같은 소스 — engine.py 주석)
 *   - 전부 Decimal(tech-arch §2.2 native 금지). tick에서 Decimal 연산 최소화(§6.2).
 *
 * 상태 표현(중요):
 *   - `bought[k]`  : 구매한 정수 개수 (native number). 비용·마일스톤 기준. 세이브 대상(data-spec §6-D).
 *   - `produced[k]`: 상위 티어가 생산해 누적된 분량 (Decimal). 진짜 누적 상태 → 세이브 대상.
 *   - `owned[k]`   : 보유 총량 = bought[k] + produced[k] (Decimal). 생산식 입력. 파생(저장 안 함).
 *   sim의 g[k]가 곧 owned[k]. bought만으로는 produced를 복원 못 하므로 produced를 별도 보존한다.
 *   (tech-architect 보고 사항: state 스키마 chain에 produced[8] Decimal 배열 추가 — §아래 ChainRuntime.)
 *
 * 비용/대량구매: **닫힌형 등비급수**(economy §0 — while-bank 루프 절대 금지).
 *   cost_k(n) = base_k·growth_k^n  →  bulk·max_affordable는 cost.ts.
 */

import { Decimal, D, ZERO, type DecimalSource } from '../bignum';
import { CHAIN_TIERS } from '../../data/constants';

/**
 * 체인 런타임 상태. owned는 produced(누적, Decimal) + bought(정수) 로 구성.
 * GameState.chain 은 { bought, produced } 를 보존(둘 다 세이브). owned는 매 접근 시 합성.
 */
export interface ChainRuntime {
  /** 보유 총량 g[k] (Decimal, 길이 8). produced + bought. 생산식 입력. */
  owned: Decimal[];
}

/** 8단 빈 owned 배열(전부 0). */
export function emptyOwned(): Decimal[] {
  return new Array<Decimal>(CHAIN_TIERS).fill(ZERO);
}

/**
 * owned[k] = bought[k] + produced[k] 합성.
 * @param bought   정수 카운트(native number[8])
 * @param produced 누적 생산분(Decimal[8])
 */
export function composeOwned(bought: readonly number[], produced: readonly Decimal[]): Decimal[] {
  const owned = new Array<Decimal>(CHAIN_TIERS);
  for (let i = 0; i < CHAIN_TIERS; i++) {
    owned[i] = D(bought[i] ?? 0).add(produced[i] ?? ZERO);
  }
  return owned;
}

/** tick 한 스텝의 산출. C·E 증분과 갱신된 produced 배열을 돌려준다(순수 — 상태 변경은 호출측). */
export interface ChainTickResult {
  /** 이번 스텝의 dC (= g1·mult·dt). lifetime_C 누적·C 가산에 사용. */
  dC: Decimal;
  /** 이번 스텝의 dE (= g1·mult·dt). E 가산에 사용(C와 동일 소스). */
  dE: Decimal;
  /** 갱신된 produced[8]. 상위 티어 생산분이 누적된 결과. */
  produced: Decimal[];
}

/**
 * 체인 생산 한 스텝(Euler, 역순 단일 패스). engine.py simulate 루프의 생산 블록과 동형.
 *
 *   new_g[k] += g[k+1]·mult·dt   (k=7..1, 역순)   ← 상위가 하위를 채움
 *   dC = dE  = g[1]·mult·dt
 *
 * **단일 패스 결정성**: 같은 틱 안에서 모든 생산은 *직전 틱의 g* 기준(동시 갱신).
 *   즉 g[k+1]은 이번 틱 증분이 반영되기 *전* 값을 쓴다(sim의 new_g = g[:] 복제와 동일).
 *
 * @param bought   정수 카운트(비용 기준, 생산에는 owned로 반영됨)
 * @param produced 현재 누적 생산분(Decimal[8])
 * @param mult     production_mult (Decimal)
 * @param dt       고정 스텝(초, native number)
 */
export function chainTick(
  bought: readonly number[],
  produced: readonly Decimal[],
  mult: Decimal,
  dt: number,
): ChainTickResult {
  // g[k] = owned (직전 틱 기준 스냅샷). 인덱스 0..7 = T1..T8.
  const g = composeOwned(bought, produced);
  const mdt = mult.mul(dt); // mult·dt 한 번만 계산(틱당 Decimal 연산 최소화 §6.2)

  // 역순 패스: 상위 티어(g[k+1])가 하위 티어(produced[k])를 채운다.
  // produced의 *복제본*을 만들어 누적(동시 갱신 — sim new_g 의미 유지).
  const nextProduced = produced.slice() as Decimal[];
  for (let k = CHAIN_TIERS - 2; k >= 0; k--) {
    // T(k+1) 인덱스 = k+1. g[k+1]가 T(k+2)에서 받기 전 값이어야 하므로 g(스냅샷) 사용.
    const inflow = g[k + 1].mul(mdt); // g[k+1]·mult·dt
    if (inflow.gt(0)) nextProduced[k] = nextProduced[k].add(inflow);
  }

  // C·E = T1(g[0]) 생산.
  const dC = g[0].mul(mdt);

  return { dC, dE: dC, produced: nextProduced };
}

/**
 * 현재 dC/dt rate (= g1·mult, dt=1초 기준). 오프라인 일괄 지급·UI 생산율 표시용.
 * (생산율은 "현재 owned 기준 순간값" — 복리 미반영, system-flows §7.1 보수적 하한.)
 */
export function chainRateC(owned: readonly Decimal[], mult: Decimal): Decimal {
  return owned[0].mul(mult);
}

/**
 * 티어 k(0-기반 인덱스)의 생산율 표시값: "초당 몇 개의 하위 단위를 만드는가".
 *   T1(k=0): dC/dt = g1·mult.   T(k>=1): d(produced[k-1])/dt = g[k]·mult.
 * UI 체인 테이블의 "생산율" 칸(ui-flow §2-D).
 * @param tierIndex 0-기반(0=T1 … 7=T8)
 */
export function tierProductionRate(
  tierIndex: number,
  owned: readonly Decimal[],
  mult: Decimal,
): Decimal {
  const g = owned[tierIndex] ?? ZERO;
  return D(g).mul(mult);
}

/** 시드: 새 런 시작 시 T1을 1개 보유(bought[0]=1)해 C가 t=0부터 누적되게(engine.py start_g1=1). */
export const SEED_T1_BOUGHT = 1;

export { CHAIN_TIERS };
export type { DecimalSource };
