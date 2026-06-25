# QA 검증 리포트 v3 — economy v0.3 §7 독립 검증 (후속 경제 패스 W3)

- 작성: qa-balancer (독립 검증 레인 — 설계 에이전트와 분리)
- 기준 문서: design/economy.md §7 (v0.3), design/followup-systems.md, design/followup-codex-ramp.md
- 검증 방법: design/sim/ 스크립트 직접 실행 (`PYTHONIOENCODING=utf-8 python <script>`)
- 작성일: 2026-06-25

---

## 재현 환경

| 항목 | 값 |
|---|---|
| 베이스라인 dec26 | **62.65h (2.611d)** — 이하 모든 편차의 기준 |
| 실행 엔진 | engine.py (Euler dt=2s, 8단 체인) |
| 파라미터 | WALLS=[19,21.5,23,24.5,25.5,26], ALPHA=0.65, SLOPE=1.3, base_rate=0.25, K=1.0/1.05, D_norm=1e26, e=0.5 |

---

## 검증 항목 1 — B_HOLO 배치: 옵션 B(별도 가산항) vs 옵션 A(codex 풀 흡수)

**설계 주장 (economy.md §7.2.2):**
- 옵션 B(별도 가산항): codex 기여 +0.454 → ×1.454 → dec26 −31.2% FAIL
- 옵션 A(codex 풀 흡수): ×1.350 → −25.9%
- 결정: 옵션 A 채택, B_HOLO 별도항 금지

**독립 재현 (synergy_codex_integ.py §1, §3):**

| 옵션 | codex 기여 @완주 | holo_mult | dec26 단축 | 판정 |
|---|---|---|---|---|
| A) curve B only (B_HOLO 흡수) | +0.350 | ×1.350 | −25.9% | PASS |
| B) curve B + 별도 B_HOLO 가산항 | +0.454 | ×1.454 | −31.2% | FAIL |
| C) B_HOLO만 (×0.0012 리터럴) | +0.104 | ×1.104 | — (시뮬 미실행) | 약함 |

- 설계 주장값 "옵션 B → ×1.454, −31.2%": **완전 일치** (편차 0)
- 설계 주장값 "옵션 A → ×1.350, −25.9%": **완전 일치** (편차 0)

**판정: PASS** — 결정 타당성 수치 확인. B_HOLO 별도항이 예산을 초과한다는 주장 정확.

---

## 검증 항목 2 — holographic 캡 아키텍처 (holographic_cap_def.py)

**설계 주장 (economy.md §7.2.3):**
- holo_factor=0.008
- worst(완주+D_total=1e6 상수 PT1): D항 +4.8%, 전체 H=×1.398 → −28.5%
- reachable(L10 국소 활성): −18.7%
- §3.4 총 H<×1.4286(=−30%) 확인

**독립 재현 (holographic_cap_def.py 전체 실행):**

§3.4 총예산 경계:
- H < ×1.4286 (1 − 1/1.4286 = 30.0%) — **설계 수치와 일치**

D항 서브예산: ×1.35 위 헤드룸 = 1.4286/1.35 = **×1.058 (D항 ≤+5.8%)** — 설계 일치

worst-case(상수 PT1, D_total=1e6) 결과:

| D_total | D항 | codex항 | holo H | dec26 단축 | 판정 |
|---|---|---|---|---|---|
| 1e4 | +3.2% | +35.0% | ×1.3820 | −27.6% | PASS |
| 1e5 | +4.0% | +35.0% | ×1.3900 | −28.0% | PASS |
| 1e6 | +4.8% | +35.0% | ×1.3980 | **−28.5%** | PASS |
| 1e7 | +5.6% | +35.0% | ×1.4060 | −28.9% | PASS |

- 설계 주장 "D_total=1e6 worst −28.5%": **완전 일치** (편차 0)

reachable(L10 국소, dec25 이후만 활성):

| D_total | dec26 단축 | 판정 |
|---|---|---|
| 1e5 | −18.5% | PASS |
| 1e6 | **−18.7%** | PASS |
| 1e7 | −18.8% | PASS |

- 설계 주장 "reachable −18.7%": **완전 일치** (편차 0)

**판정: PASS** — holo_factor=0.008, 캡 아키텍처 구조, worst/reachable 수치 전부 일치.

---

## 검증 항목 3 — 결합 §3.4 (research C-plan=1.0 + 곡선 B)

**설계 주장 (economy.md §7.2.6):**
- C안 채택 → research_mult=1.0 → 결합 −25.9% PASS
- "−30.1% 경계는 research ×1.06 존재 시만 발생, C안이 그 ×1.06을 제거하므로 경계 없음"

**독립 재현 (synergy_codex_integ.py §3):**

| 시나리오 | H_total | dec26 | 단축 | 판정 |
|---|---|---|---|---|
| codex c=1.0 + research=1.0 (C안) | 1.3500 | 46.41h | −25.9% | **PASS** |
| codex c=0.65 (중반) + research=1.0 | 1.1479 | 54.58h | −12.9% | PASS |
| codex c=1.0 + research ×1.06 (구 예산) | 1.4310 | 43.78h | −30.1% | **FAIL** |
| codex c=1.0 + research ×1.055 (헤지) | 1.4243 | 43.99h | −29.8% | PASS |
| Option B (별도 B_HOLO + res=1.0) | 1.4544 | 43.08h | −31.2% | FAIL |

- "−30.1% 경계는 ×1.06 존재 시만": sim 결과 확인 — C안(research=1.0)은 −25.9%, ×1.06 결합 시 −30.1% FAIL. **주장 정확.**
- C안이 그 곱을 제거하므로 경계 breach 없음: **CONFIRMED**

**판정: PASS** — C안 채택의 §3.4 해소 논리 및 수치 독립 검증 완료.

---

## 검증 항목 4 — 곡선 B 단조성 (c=1.0 및 c=0.65 캠페인 런 시퀀스)

**설계 주장 (economy.md §7.2.6):**
- c=1.0(×1.35) 캠페인 런 시퀀스: `3.16→5.32→7.11→11.38→15.26→17.48h`, monotonic=True
- c=0.65(×1.148) 캠페인 런 시퀀스: `3.72→6.25→8.36→13.38→17.95→20.56h`, monotonic=True

**독립 재현 (synergy_codex_integ.py §5):**

| 구분 | 런 시퀀스 (h) | monotonic |
|---|---|---|
| no codex (×1.00) | 4.26→7.18→9.60→15.36→20.60→23.60 | True |
| curve B max (×1.35, c=1.0) | **3.16→5.32→7.11→11.38→15.26→17.48** | **True** |
| curve B mid (×1.148, c=0.65) | **3.72→6.25→8.36→13.38→17.95→20.56** | **True** |

- 설계 주장 런 시퀀스 수치: **완전 일치** (편차 0)
- 단조성 양쪽 보존: **CONFIRMED**

재하강 내 단조성 (redescent_diff.py §4):
- run2 active-time seq: `1.53→3.64→6.54→12.08→18.37→22.63h`, monotonic=True
- run4 active-time seq: `1.51→3.62→6.51→12.05→18.34→22.60h`, monotonic=True

**판정: PASS** — 곡선 B 적용 후 캠페인·재하강 런 시퀀스 단조성 구조적으로 보존.

---

## 검증 항목 5 — 재하강 차별화 (비용감소/방치 캘린더/개입 경로/누적)

**설계 주장 (economy.md §7.5):**
- 비용감소 1.0→0.5에도 방치 캘린더 5.77일 불변 (negative result)
- 개입 경로(3체크인): ×0.80 압축
- 3회 누적 2.47주
- 집중 서브층 참여 ≥4h (deep block +6h)

**독립 재현:**

방치 캘린더 비용 민감도 (redescent_diag.py §B):

| cost_m | PT6 active_h | 전체 cal 일 |
|---|---|---|
| 1.000 | 22.65 | **5.771** |
| 0.952 | 22.63 | **5.771** |
| 0.900 | 22.61 | **5.771** |
| 0.800 | 22.57 | **5.771** |
| 0.650 | 22.51 | **5.771** |
| 0.500 | 22.44 | **5.771** |

- 설계 주장 "비용감소 1.0→0.5에도 방치 캘린더 5.77일 불변": **완전 일치**. 이유: 캘린더는 오프라인 캡 24h×0.65=15.6h/일 바닥에 묶여 있으며, PT6 active time 22.65h→22.44h(−0.9%)는 gap count를 3에서 3으로 유지 (step-like 구조 확인).

개입 경로 (redescent_diff.py §2b):
- 1회차(3체크인): 5.16 cal-d
- 2회차(3체크인, focus+deep): 4.12 cal-d = **×0.800** of run1
- 설계 주장 "개입 경로 ×0.80": **완전 일치**

누적 (redescent_diff.py §3):
- 3회차 누적: 17.31d = **2.47주** — 설계 주장 일치

집중 서브층:
- +6h deep block 적용 → 집중층 참여 ≥6h — "≥4h" 기준 **PASS**

**판정: PASS** — negative result(비용감소 방치캘린더 무영향) 독립 확인. 개입 ×0.80, 2.47주 일치.

---

## 검증 항목 6 — 베켄슈타인 K=1.05 (bekenstein_k.py)

**설계 주장 (economy.md §7.4):**
- PT6 QF: 1.084e7 → 1.138e7 (×1.05)
- production_mult 변화: +0.0053× (+0.192%)
- race 무영향 (런 차 ~2.77분)
- 단조성 양쪽 보존

**독립 재현 (bekenstein_k.py 전체 실행):**

| 항목 | 설계 주장 | 재현값 | 편차 |
|---|---|---|---|
| PT6 QF (K=1.0) | 1.084e7 | **1.084e7** | 0 |
| PT6 QF (K=1.05) | 1.138e7 | **1.138e7** | 0 |
| QF 비율 | ×1.05 | **×1.0500** | 0 |
| mult 변화 | +0.0053× | **+0.0053×** | 0 |
| mult 변화율 | +0.192% | **+0.192%** | 0 |
| 런 최대 차이 | ~2.77분 | **2.77분 (0.0461h)** | 0 |
| 단조성 K=1.0 | True | **True** | — |
| 단조성 K=1.05 | True | **True** | — |
| 빅 크런치 진입 mult K=1.05 | 2.764× | **2.7641×** | 0 |

해석 확인: delta = 0.25×log₁₀(1.05) = 0.0053 — analytic 일치.

**판정: PASS** — K=1.05 전 수치 완전 일치. 밴드 2~3× 유지. 무영향 검증.

---

## 검증 항목 7 — 분모 76 정합 (followup-codex-ramp.md §3)

**설계 주장 (economy.md §7.1, followup-codex-ramp.md §3-3):**
- `codex_completion = collected_discoverable / 76`
- LEGENDARY 11개 제외, UI 표시 87과 분리
- 분모 76은 상한·factor에 무영향(순수 표기·행동 정합)

**독립 검증 (설계 문서 교차 확인 + 산술):**
- synergy_codex_integ.py 코드: `N_CODEX = 87` (UI 전체), 분모 76은 completion 정의에서 분리 관리
- followup-codex-ramp.md §3-2: 87은 LEGENDARY 11 포함 전체 엔트리, 76은 플레이어가 직접 발견하는 수집 대상
- economy.md §7.1 확정 수식: `codex_completion = collected_discoverable / 76`
- codex.md §0 line 36의 `collected / 87`은 오기(수정 대상)로 명기됨 — economy.md가 76으로 확정

산술 확인: 87 - 76 = 11 (LEGENDARY) — 정합.

분모 영향 확인: `bonus = 0.35 × c²`에서 c = collected_discoverable/76 이면 완주(c=1.0) 시 bonus=0.35, 상한 ×1.35 — 분모가 76이든 87이든 완주 상한 동일. 주장 "상한·factor에 무영향" **CONFIRMED**.

**판정: PASS** — 분모 76 정합, 76/87 분리 구조 타당, 오기 위치 특정.

---

## CONCERN 목록

### 신규 CONCERN 없음

모든 7개 항목이 독립 재현에서 설계 주장과 일치하거나 수치 편차 0으로 통과했다.

기존 한계(미검증 항목, economy.md §7.7 명시 사항) — 설계 문서가 이미 인지하고 있으며 QA가 새로 발견한 사항이 아님:

| 항목 | 현재 가정 | 재검증 조건 | 담당 |
|---|---|---|---|
| D_total magnitude | ≲1e7 | 연구트리 D 생산률 확정 후 | economy-designer |
| holo_factor=0.008 안전마진 | D_total ≲1e7에서 worst −28.9% | D_total ≫1e7이면 재튜닝 필요 | economy-designer |
| 체크인 모델 고정 | 2회/일 기준 | 텔레메트리 실측 필요 | — |
| 집중 서브층 +6h 블록 | 플레이스홀더 | content 분량 확정 후 캘린더 재검증 | content/systems |
| C안 구현 분리 | A13/B8/B12 prod_mult 외부 0 | 구현이 이를 어기면 §3.4 재검증 필요 | game-programmer |

---

## 종합 판정 — Go/No-Go

| 검증 항목 | 판정 | 핵심 수치 | 편차 |
|---|---|---|---|
| 1. B_HOLO 배치 (옵션 A/B 분기) | **PASS** | 옵션 B −31.2% FAIL 확인 / 옵션 A −25.9% | 0 |
| 2. holographic 캡 아키텍처 | **PASS** | worst −28.5%, reachable −18.7%, holo_factor=0.008 | 0 |
| 3. 결합 §3.4 (C안 research=1.0) | **PASS** | 결합 −25.9% PASS / ×1.06 결합 −30.1% FAIL 확인 | 0 |
| 4. 곡선 B 단조성 | **PASS** | c=1.0·c=0.65 양쪽 monotonic=True, 재하강도 보존 | 0 |
| 5. 재하강 차별화 | **PASS** | 방치 5.77d 불변(negative), 개입 ×0.80, 2.47주 | 0 |
| 6. 베켄슈타인 K=1.05 | **PASS** | QF ×1.05, mult +0.0053×, 런 차 2.77분 | 0 |
| 7. 분모 76 정합 | **PASS** | 상한 무영향, 수집 행동 정합 | 0 |

**종합: Go — gdd-sync 가능.**

신규 CONCERN 없음. 7개 항목 전부 PASS. 독립 재현 수치가 설계 에이전트(economy-designer) 주장값과 편차 0으로 일치한다. 기존 미검증 항목(D_total magnitude, 텔레메트리, content 분량)은 설계 문서가 이미 인지하고 있는 후속 과제이며 gdd-sync 차단 요인이 아니다.

**gdd-sync 가능 여부: YES.** 단 gdd-sync 시 economy.md §7.6에 명시된 반영 대상(codex.md §0 line 36 오기 수정, systems.md §1-3·§2-I·§5-2·§3-5 갱신, research-tree.md A13/B8/B12 effect_value)을 함께 처리할 것.
