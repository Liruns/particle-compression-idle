/**
 * offline — 오프라인 계산기 (등가-시간 일괄 지급 + 48h 탬퍼 클램프). (tech-architecture.md §3, economy.md §3)
 *
 * economy §3이 수식을 **이미 확정**(CAP=24h, modifier=0.65, 상전이 직후 1.0, LB=0.5, 48h 클램프).
 * 본 모듈은 그 수식을 **단일 진입점**에서 실행하는 구조만 제공(수식 재설계 금지).
 *
 * §3.2 클램프 적용 순서(economy §3.1 그대로, "어디서"만 본 문서가 정함):
 *   raw_elapsed   = now − last_save                       // last_save = §1.7 최댓값 채택
 *   elapsed_clamp = min(raw_elapsed, CAP·TAMPER_MULT)     // = min(_, 48h)  ← 탬퍼 클램프
 *   capped        = min(elapsed_clamp, CAP)               // = min(_, 24h)
 *   long_idle     = 1 + LB·log10(1 + max(0, elapsed_clamp − CAP)/CAP)
 *   effective_s   = capped · modifier · long_idle          // modifier=0.65 (상전이 직후=1.0)
 *
 * "클램프는 오프라인 계산 함수의 입구에서 딱 한 번. 그 함수만이 last_save와 now를 비교한다
 *  → 시계조작 방어선이 하나로 수렴." (§3.2)
 *
 * 부여 방식(§3.1 일괄 지급 = 보수적 하한): "접속 끊긴 시점의 생산 rate × 유효시간 분량을 E·C에
 *   일괄 지급. 생산이 C에 선형이므로 'rate×Δt×mod 일괄지급'은 'frozen rate로 mod·Δt만큼 온라인
 *   진행'과 등가(보수적 하한 — 온라인은 복리로 더 빠르므로)." rate는 호출 측(game.ts)이 끊긴 시점
 *   체인 dC/dt(=g1·mult)로 넘긴다. 본 모듈은 시간 수식과 일괄 적용만 책임(메커니즘 방치 기본값
 *   §3.4는 rate에 이미 반영돼 들어옴 — 본 모듈은 rate를 모름).
 */

import { Decimal, D, ZERO, mul, type DecimalSource } from '../bignum';
import { OFFLINE } from '../../data/constants';

export interface OfflineInput {
  /** 현재 시각(ms). */
  now: number;
  /** 마지막 저장 시각(ms). §1.7: 파일·Cloud 기록의 **최댓값**을 호출 측이 미리 채택해 넘긴다. */
  lastSave: number;
  /** §3.3 상전이 직후 첫 오프라인이면 true → modifier=1.0. */
  afterPrestige: boolean;
}

export interface OfflineResult {
  /** 클램프 전 실제 경과(초, 음수는 0). 표시·로그용. */
  rawSeconds: number;
  /** 48h 탬퍼 클램프 적용 경과(초). */
  clampedSeconds: number;
  /** 보상에 쓰이는 유효시간(초) = capped·modifier·long_idle. */
  effectiveSeconds: number;
  /** 적용된 modifier(0.65 또는 1.0). */
  modifier: number;
  /** 장기 방치 보너스 배수. */
  longIdleBonus: number;
  /** CAP(24h) 초과로 잘렸는지(UI "24시간 상한 도달" 안내, ui-flow §10-C). */
  cappedHit: boolean;
}

/**
 * 유효 오프라인 시간 계산(§3.2 단일 진입점). 시계 역행 → 0 클램프(§1.7).
 * rate를 곱해 자원에 더하는 것은 applyOfflineCredit가 effectiveSeconds로 수행.
 */
export function computeOffline(input: OfflineInput): OfflineResult {
  const { CAP_SECONDS, MODIFIER, MODIFIER_AFTER_PRESTIGE, LONG_IDLE_BONUS, TAMPER_MULT } =
    OFFLINE;

  const rawSeconds = Math.max(0, (input.now - input.lastSave) / 1000); // 음수 → 0(§1.7)

  // 탬퍼 클램프(48h) → 그 다음 CAP(24h)
  const elapsedClamp = Math.min(rawSeconds, CAP_SECONDS * TAMPER_MULT);
  const capped = Math.min(elapsedClamp, CAP_SECONDS);

  // 장기 방치 보너스: CAP 초과분에 로그 보상
  const overCap = Math.max(0, elapsedClamp - CAP_SECONDS);
  const longIdleBonus = 1 + LONG_IDLE_BONUS * Math.log10(1 + overCap / CAP_SECONDS);

  const modifier = input.afterPrestige ? MODIFIER_AFTER_PRESTIGE : MODIFIER;
  const effectiveSeconds = capped * modifier * longIdleBonus;

  return {
    rawSeconds,
    clampedSeconds: elapsedClamp,
    effectiveSeconds,
    modifier,
    longIdleBonus,
    cappedHit: rawSeconds > CAP_SECONDS,
  };
}

/** applyOfflineCredit가 돌려주는 자원 증분(일괄 지급분). 표시(모달)·검증용. */
export interface OfflineCredit {
  /** 지급된 C 증분(= rateC·effectiveSeconds). lifetime_C에도 동일 가산. */
  dC: Decimal;
  /** 지급된 E 증분(= rateE·effectiveSeconds, C와 동일 소스). */
  dE: Decimal;
  /** 지급된 D 증분(= rateD·effectiveSeconds, 메커니즘 방치 기본값). */
  dD: Decimal;
}

/**
 * 오프라인 일괄 지급분 계산(§3.1 보수적 하한). **순수** — 자원 상태를 직접 바꾸지 않고
 *   "끊긴 시점 rate × 유효시간" 증분을 돌려준다(game.ts가 자원에 가산 + lifetime_C·D_lifetime 반영).
 *
 *   C·E는 같은 소스(engine.py 주석)라 rateC로 둘 다. D는 메커니즘 방치 기본 트리클(§3.4 "방치
 *   기본 배율 — 최댓값 아님·최악값 아님"). rate가 0이면 0(체인 미보유 등).
 *
 * @param effectiveSeconds computeOffline의 유효시간(이미 클램프·modifier·long_idle 반영).
 * @param rateC 끊긴 시점 dC/dt(=g1·mult, Decimal). C·E 공통 소스.
 * @param rateD 끊긴 시점 D 트리클율(초당, 메커니즘 방치 기본 — 없으면 0).
 */
export function applyOfflineCredit(
  effectiveSeconds: number,
  rateC: DecimalSource,
  rateD: DecimalSource = 0,
): OfflineCredit {
  if (effectiveSeconds <= 0) return { dC: ZERO, dE: ZERO, dD: ZERO };
  const dC = mul(rateC, effectiveSeconds);
  const dD = mul(rateD, effectiveSeconds);
  return { dC, dE: dC, dD: dD.gt(0) ? dD : ZERO };
}

export { D };
