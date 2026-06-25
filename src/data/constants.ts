/**
 * data/constants — 코어 경제 상수 (데이터 주도). (tech-architecture.md §4.4 `data/`)
 *
 * "data/ 분리가 핵심: 입자·연구·층·비용을 코드가 아닌 데이터로 두면, economy/content/systems가
 *  확정한 수치를 game-programmer가 로직 수정 없이 주입·튜닝." (Vite HMR 밸런싱)
 *
 * 출처(확정값, 임의 변경 금지 — 문제 발견 시 economy-designer에 보고):
 *   - GDD.md §7:        r = r₀·10^(−dec),  r₀ = 1e-9 m,  dec = α·log₁₀(C+1),  α = 0.65
 *   - economy.md §2:    cost_k(n) = base_k·growth_k^n,  base_k = 10^(1+1.3·k),
 *                       growth_k = 2.2 − (0.4/7)·(k−1)   (내림차순 T1=2.2 … T8=1.8)
 *   - economy.md §1.1:  production_mult = 1 + 0.25·log₁₀(1 + QF_total)
 *   - economy.md §1.2:  WALLS = [19, 21.5, 23, 24.5, 25.5, 26]  (6벽, dec26 플랑크 캡)
 *   - economy.md §3:    오프라인 CAP=24h, modifier=0.65, 상전이직후=1.0, LB=0.5, 48h 탬퍼 클램프
 *
 * 스캐폴딩 단계에서는 헬로 셸 tick이 r/dec/production을 정확히 계산할 만큼만 사용.
 * 8단 체인 풀 구현·벽·오프라인은 후속 마일스톤(M1.2~M1.7).
 */

// --- r / dec 매핑 (GDD §7) ---------------------------------------------------
/** 시작 반경 r₀ = 1e-9 m (분자 스케일). */
export const R0_METERS = '1e-9';
/** dec = α·log₁₀(C+1)의 로그 저항 계수 α. */
export const ALPHA = 0.65;

// --- 8단 체인 비용 (economy.md §2) -------------------------------------------
export const CHAIN_TIERS = 8;
/** base_k = 10^(1 + 1.3·k), k=1..8. (지수만 보관, Decimal pow10으로 생성.) */
export const COST_BASE_EXP = (k: number): number => 1 + 1.3 * k;
/** growth_k = 2.2 − (0.4/7)·(k−1), k=1..8 → T1=2.2 … T8=1.8. */
export const COST_GROWTH = (k: number): number => 2.2 - (0.4 / 7) * (k - 1);

// --- 프레스티지 (economy.md §1.1) --------------------------------------------
/** production_mult = 1 + QF_PRODUCTION_RATE·log₁₀(1 + QF_total). */
export const QF_PRODUCTION_RATE = 0.25;

// --- 상전이 벽 (economy.md §1.2) ---------------------------------------------
/** WALLS = dec 임계값 6개. 마지막(26)은 빅 크런치(PT7) 트리거. */
export const WALLS: readonly number[] = [19, 21.5, 23, 24.5, 25.5, 26] as const;

// --- 오프라인 (economy.md §3) ------------------------------------------------
export const OFFLINE = {
  /** 캡 24시간(초). */
  CAP_SECONDS: 24 * 3600,
  /** 기본 효율 modifier. */
  MODIFIER: 0.65,
  /** 상전이 직후 첫 오프라인 효율(§3.3). */
  MODIFIER_AFTER_PRESTIGE: 1.0,
  /** 장기 방치 보너스 계수 LB. */
  LONG_IDLE_BONUS: 0.5,
  /** 48h 하드 탬퍼 클램프 배수(CAP·TAMPER_MULT = 48h). */
  TAMPER_MULT: 2,
} as const;
