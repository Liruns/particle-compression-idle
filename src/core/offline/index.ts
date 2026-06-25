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
 * 스캐폴딩 범위: 유효시간 계산(클램프 포함)을 정확히 구현. rate×시간을 자원에 더하는
 *   실제 적용(능동 메커니즘 방치 기본값 §3.4 포함)은 M1.7에서 체인 생산과 결합.
 */

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
}

/**
 * 유효 오프라인 시간 계산(§3.2 단일 진입점). 시계 역행 → 0 클램프(§1.7).
 * rate를 곱해 자원에 더하는 것은 호출 측(생산 모듈)이 effectiveSeconds로 수행.
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
  };
}
