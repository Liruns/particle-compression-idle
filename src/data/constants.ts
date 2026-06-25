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

// --- 오비탈 공명 (systems.md §2-A, 원자층 L2 메커니즘 — M1.4) ----------------
/**
 * 전자 오비탈 공명(systems §2-A). 주기적으로 슬롯이 열리고, 능동 클릭(타이밍)이면
 * 더 높은 효율로 공명 배율 + D 획득. 방치 시 기본 자동 공명(낮은 효율)이 진행을 잇는다.
 *   → 필러 ③(방치·개입 모두 보상). 공명 배율은 체인 전체 production에 곱해진다(§2-A).
 *
 * 출처(systems §2-A 의사코드 + economy 60/40 능동 룰, 임의 변경 금지 — 문제 발견 시 보고):
 *   - resonance_window = 3초(슬롯 유효 시간). dec2~3 험프 넛지는 UI가 2.5초로 단축(ux §5-7, 표시만).
 *   - 클릭 성공 시 resonance_bonus ×1.5, 30초에 걸쳐 1.0으로 감쇠(§2-A).
 *   - 방치 자동 공명: 기본 배율(낮음). 클릭이 그 위에 ×1.5를 얹는다(60/40 — 방치 60%, 개입 +40%).
 *   - D는 "느린 연구 화폐"(economy §7.2.3) — 공명 성공 시 소량. 정확 수치는 economy 미확정 →
 *     온보딩 체감(첫 D 수 분 내, 연구 탭 게이트) 기준의 보수적 시드값. data로 분리해 튜닝.
 */
export const RESONANCE = {
  /** 슬롯 열림 주기(초). 닫힌 뒤 이 시간 후 다음 슬롯이 열린다. */
  SLOT_INTERVAL_SECONDS: 6,
  /** 슬롯 유효 시간(초, systems §2-A resonance_window=3). 이 안에 클릭해야 성공. */
  SLOT_WINDOW_SECONDS: 3,
  /** 클릭 성공 시 공명 배율(systems §2-A: resonance_bonus ×1.5 = +50% 개입 보상). */
  CLICK_BONUS: 1.5,
  /** 방치 자동 공명 기본 배율(낮은 효율 — 방치도 진행되되 개입보다 약함, §2-A). */
  IDLE_BASE: 1.1,
  /** 공명 배율 감쇠 시간(초, systems §2-A: 30초에 걸쳐 1.0으로). */
  DECAY_SECONDS: 30,
  /** 클릭 성공 1회 D 획득량(발견 데이터, 느린 화폐 — economy §7.2.3 트리클). */
  D_PER_CLICK: 1,
  /**
   * 방치 자동 공명 1회 D 획득량(클릭보다 적음 — 개입 보상 차등).
   * 자동 공명은 SLOT_INTERVAL+WINDOW 주기마다 1회 발화하므로 D_PER_CLICK 대비 누적도 느리다.
   */
  D_PER_IDLE: 0.2,
} as const;

// --- 수동 압축 (ui-flow §2 '압축' 버튼, systems §4-2·§4-3 60/40 능동) --------
/**
 * 수동 압축 클릭(분자층 L1 첫 손맛 + 전 층 공통 능동 입력).
 * "클릭은 체인 생산의 *위에* 더해지는 구조, 대체 아님"(systems §4-2). 클릭당 C 가산 =
 *   현재 dC/dt(=g1·mult)의 CLICK_SECONDS초 분량. 체인이 비어도(T1 시드) 소폭 진행 →
 *   초반 클릭이 의미를 갖되, 자동 생산이 곧 추월(systems §4-1 "업그레이드 > 클릭" 학습).
 *
 * 출처(systems §4-2·§4-3, economy §8 클릭 파워 곡선 — 정확값 economy 미확정 →
 *   "클릭이 체인 대비 의미 있되 클릭 게임이 되지 않는" 보수적 시드. data 분리로 튜닝.):
 */
export const MANUAL_COMPRESS = {
  /** 클릭 1회 = 현재 dC/dt의 이 초만큼 즉시 가산(systems §4-2 C_click = 현재 생산의 일부). */
  CLICK_SECONDS: 0.5,
} as const;

// --- 위상 겹침 (systems.md §2-E, 프리온층 L6 메커니즘 — M1.6) ------------------
/**
 * 위상 겹침(Phase Superposition, systems §2-E). 프리온층 진입 시 C가 "위상 C"로 재정의되어
 *   세 상태(응집/분산/공명)를 오간다. **오비탈 공명과 다른 결**(필러 ④): 타이밍 클릭이 아니라
 *   "어떤 자원을 우선할지"의 전략적 상태 선택이다. 방치 시 자동 순환(평균 효율), 개입 시 상태
 *   고정으로 전문화(체인/연구/QF 중 하나에 집중).
 *
 * 상태별 출력(systems §2-E 의사코드):
 *   - 응집(COHERENT): 체인 배율 최대, D 생산 0.            → P+ 발견(양위상)
 *   - 분산(DISPERSED): 체인 배율 낮음, D 생산 최대.        → P- 발견(음위상)
 *   - 공명(RESONANT): 중간 배율, QF 미적립(트리클) 지속.   → P0 발견(중립위상)
 *
 * 출처(systems §2-E + economy 미해결질문 #3 "응집/분산/공명 배율이 방치·개입 40% 격차 유지"):
 *   정확 수치 economy 미확정 → 보수적 시드(방치 자동순환 평균 ≈ 1.0 중립, 고정 전문화 시 ±이득).
 *   data 분리로 튜닝. 배율은 체인 production에 곱(오비탈 공명과 동형 — game.ts가 합성).
 */
export const PHASE_OVERLAP = {
  /** 자동 순환 주기(초). 방치 시 이 간격마다 다음 상태로 전환(가중 랜덤 아닌 결정적 순환 — 결정성 R9). */
  AUTO_CYCLE_SECONDS: 12,
  /** 응집 상태 체인 배율(최대 — 체인 몬스터). */
  COHERENT_MULT: 1.35,
  /** 분산 상태 체인 배율(낮음 — 대신 D 러시). */
  DISPERSED_MULT: 1.05,
  /** 공명 상태 체인 배율(중간 — QF 축적). */
  RESONANT_MULT: 1.18,
  /** 분산 상태 초당 D 생산(systems §2-E "D 생산 최대"). 응집/공명은 0. */
  DISPERSED_D_RATE: 0.5,
  /** 공명 상태 초당 QF 트리클(systems §2-E "QF 미적립 지속"). 느린 화폐 — 아주 소량. */
  RESONANT_QF_RATE: 0.002,
  /**
   * 상태 고정(pin) 1회 비용 = 현재 dC/dt의 이 초 분량 E 소모(systems §2-E pin_cost_E).
   * 고정은 한 번 비용을 내면 다음 자동 순환을 막고 선택 상태를 유지. 해제(unpin)는 무료.
   * (economy 미확정 → 체인 대비 가벼운 시드. 너무 비싸면 개입 동기 소멸·너무 싸면 자동순환 무의미.)
   */
  PIN_COST_SECONDS: 2,
  /** 상태별 프리온 발견 누적 임계(systems §2-E "상태 N회 유지"·codex L6 unlock_condition). */
  DISCOVER_COHERENT_SECONDS: 10, // P+ : 응집 누적 10초
  DISCOVER_DISPERSED_SECONDS: 10, // P- : 분산 누적 10초
  DISCOVER_RESONANT_SECONDS: 20, // P0 : 공명 누적 20초(중재자 — 더 오래)
} as const;

// --- 진동 하모닉스 (systems.md §2-F, 끈층 L7 메커니즘 — M1.6) ------------------
/**
 * 진동 하모닉스(Vibrational Harmonics, systems §2-F). 끈층 진입 후 체인 생산 틱마다 진동
 *   에너지 V가 누적되고, 특정 V 임계마다 하모닉 공명이 일어나 **체인 특정 티어가 폭발**한다.
 *   위상 겹침(상태 선택)·오비탈 공명(타이밍 클릭)과 또 다른 결: "다음 공명 티어 예측" 자동 진행.
 *
 * 동작(systems §2-F 의사코드):
 *   V += production_rate(대용 — 활성 시 고정 충전율) · dt
 *   harmonic_n = floor(V / HARMONIC_INTERVAL);  resonant_tier = (harmonic_n % 8) + 1
 *   V가 임계 교차 시 → 해당 티어 burst(짧은 배율) + V 잔여 이월. 8티어 순환.
 *
 * 출처(systems §2-F + economy 미해결질문 #6 "하모닉 인터벌 — 너무 빠르면 지루·느리면 무관심"):
 *   정확 수치 economy 미확정 → 보수적 시드. 본 메커니즘은 "수동 없음(자동 충전)"(ui-flow §2-E).
 */
export const HARMONICS = {
  /** 활성 시 초당 V 충전량(production_rate 대용 — 끈층 진입 후 고정 비율, 결정성). */
  FILL_RATE: 1,
  /** 하모닉 1단계 간격(V). harmonic_n = floor(V/interval). */
  HARMONIC_INTERVAL: 8,
  /** 공명 발생 시 해당 티어 burst 배율(짧게 적용 — 전체 체인엔 합성 시 평탄화). */
  BURST_MULT: 2,
  /** burst 지속(초). 이 시간 동안 resonant_tier에 BURST_MULT 적용 후 소멸. */
  BURST_SECONDS: 3,
} as const;
