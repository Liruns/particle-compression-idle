# 데이터 사전 (Data Specification) — data-spec v0.1

- 작성: content-designer
- 기준: GDD v0.3 / content-pipeline v0.1 §1 / codex.md §1·§13 / research-tree.md §1 / economy.md v0.3 §0·§1·§2·§3·§7 / tech-architecture.md §1.1
- 상태: 구조·필드 정의·값 출처 매핑·무결성 규칙 확정 초안 / 수치 [ECONOMY] = economy-designer 소관
- 작성일: 2026-06-26
- 소유권: **구조·필드·키 정의 = content-designer** / **수치 파라미터 = economy-designer** (§7 경계 표)

---

## 0. 이 문서의 역할

**이 문서는 `data/` JSON 파일을 채우는 사람이 가장 먼저 읽어야 하는 단일 참조(data dictionary)다.**

- content-pipeline.md(§1) = 데이터 모델·워크플로 — "무엇을 어떻게 추가하는가"
- **본 문서 = 데이터 사전 — "각 필드가 무엇이고, 값의 범위는 무엇이며, 어디서 왔는가"**

이 문서가 정하지 않는 것: 플레이버 텍스트(narrative 소관), 구체적 수치(economy 소관), 렌더 구현(graphics-programmer 소관).

---

## 1. 데이터 타입 목록

| 타입 ID | 파일 위치 | 레코드 수 | 소유자 |
|---|---|---|---|
| `Particle` | `data/particles/*.json` | 87 (MVP v1.0) + 18 (C1) | content-designer |
| `ResearchNode` | `data/research/*.json` | 52 (MVP) + 12 (C1) | content-designer |
| `LayerDefinition` | `data/layers/layer_definitions.json` | 11 | content-designer + systems-designer |
| `EconomyParams` | `data/economy_params.json` | (키-값 맵) | economy-designer |
| `SaveState` | 런타임 세이브 — `data/` 미포함 | — | tech-architect |
| `LocaleEntry` | `data/locale/ko.json`, `en.json` | 87×2 + 52×2 키 | narrative-designer / 번역가 |

---

## 2. Particle 타입 — 전체 필드 사전

### 2-A. 기본 필드 (codex.md §1 기준)

| 필드명 | 타입 | 필수 | 허용 범위·형식 | 의미 | 예시 |
|---|---|---|---|---|---|
| `id` | string | 필수 | snake_case, 전체 고유, 영문·숫자·밑줄만 | 코드 식별자. `_index.json` 전수 고유성 보장 | `"up_quark"` |
| `name` | string | 필수 | 화학식·기호 포함 가능 | UI 표시 이름 (영/공통) | `"u (업 쿼크)"` |
| `name_ko` | string | 필수 | 한국어 | 한국어 표시 이름 | `"업 쿼크"` |
| `layer` | integer | 필수 | 1 ~ 11 | 속한 층 번호 (L1=분자 … L11=플랑크) | `5` |
| `scale_m` | string | 필수* | 과학 표기 문자열 또는 `"< 1e-18"` 형식, null 불가 (*완성보너스 제외) | 입자 크기 (m 단위). `real:false`이면 내부 설정값 | `"< 1e-18"` |
| `decade` | number | 필수 | 0 ~ 26 (실수 허용) | dec 값. α·log₁₀(C) 기준 해금 시점. 압축 장벽 dec과 서사 스케일 dec은 별개 — GDD §9 [지시 3] | `9` |
| `real` | boolean | 필수 | true / false | 실제 물리 입자 여부. false = 미지 상상 입자 | `true` |
| `mass_eV` | string \| null | 필수 | 숫자 파싱 가능 문자열("2.2e6"), 미지입자는 "[UNKNOWN]", 질량0은 "0", 질량없음null 허용 | 질량 (eV/c²). 실제 입자: PDG 기준값 필수. null = 완성보너스 엔트리 등 해당없음 | `"2.2e6"` |
| `charge` | number \| null | 필수 | −2 ~ +2 (e 단위), null = 완성보너스 | 전하. 실제 입자: PDG 기준 (쿼크 분수전하 허용: ±1/3, ±2/3) | `0.667` |
| `spin` | number \| null | 필수 | 0, 0.5, 1, 1.5, 2, 3.5 등 반정수, null = 완성보너스 | 스핀 (ℏ 단위). 실제 입자: PDG 기준 | `0.5` |
| `rarity` | string | 필수 | `"COMMON"` \| `"UNCOMMON"` \| `"RARE"` \| `"EPIC"` \| `"LEGENDARY"` | 희귀도. LEGENDARY = 층 완성 보너스 엔트리 (discoverable: false) | `"COMMON"` |
| `unlock_condition` | string | 필수 | 게임 로직이 파싱하는 조건 문자열 | 발견(해금) 조건. 로직 파싱 키워드: `decade`, `tier`, `event_count`, `codex_count`, `research_node` | `"decade 9 진입 즉시"` |
| `unlock_bonus_type` | string | 필수 | 자유 서술 (economy와 협의 후 `bonus_ref` 키와 대응) | 발견 보너스의 종류. 수치는 `bonus_ref`가 가리키는 economy_params 키에 있음 | `"T1 압축기 비용 소폭 할인"` |
| `flavor_brief` | string | 필수 | 1~2문장 | narrative-designer에게 전달할 플레이버 방향. 실제 텍스트는 locale.ko.json | `"가장 가벼운 업타입 쿼크."` |

### 2-B. 파이프라인 확장 필드 (content-pipeline v0.1 §1-B)

| 필드명 | 타입 | 필수 | 허용 범위·형식 | 의미 | 예시 |
|---|---|---|---|---|---|
| `locale_key` | string | 필수 | `"particle." + id` 고정 형식 | 현지화 키 네임스페이스. ko.json / en.json에서 `particle.{id}.name`, `particle.{id}.flavor` 두 키 존재 필수 | `"particle.up_quark"` |
| `bonus_ref` | string \| null | 필수 | `economy_params.json`의 기존 키 이름 또는 null | economy 수치 참조 키. null이면 이 입자는 보너스 없음. economy_params에 없는 키 참조 시 빌드 FAIL | `"bonus.t1_cost_discount"` |
| `discoverable` | boolean | 필수 | true / false | 홀로그래픽 완성도 분모 76에 포함 여부. LEGENDARY 11개 = false, 나머지 = true | `true` |
| `version_added` | string | 필수 | `"v1.0"`, `"v1.1-c1"` 형식 | 이 엔트리가 최초 활성화되는 빌드 버전 | `"v1.0"` |
| `content_pass` | string | 필수 | `"mvp"` \| `"c1"` \| `"c2"` | scope-mvp §5 컷 기준. mvp = v1.0, c1 = 재하강 심화 패치 | `"mvp"` |
| `focus_layer` | integer \| null | 필수 | 6 ~ 11 또는 null | c1 심화 입자 전용: 어느 집중 서브층 소속인지. mvp 입자는 반드시 null | `null` |

### 2-C. 필드 간 의존성 규칙

```
discoverable:
  LEGENDARY → false (층 완성 보너스 엔트리)
  그 외 모두 → true

focus_layer:
  content_pass == "mvp"  → null (필수)
  content_pass == "c1"   → 6~11 정수 (필수)

bonus_ref:
  null이 아닌 경우 → economy_params.json에 해당 키 존재 필수

locale_key:
  항상 "particle." + id (계산 파생, 수동 입력 금지)

scale_m:
  layer 11의 완성보너스(id="l11_big_crunch") 등 개념적 엔트리 → null 허용
  그 외 모든 입자 → null 불가, 과학 표기 문자열 필수

real == true:
  mass_eV: 숫자 파싱 가능 문자열 또는 "0" 필수 (PDG 기준)
  charge: −2 ~ +2 범위 필수 (PDG 기준)
  spin: 0, 0.5, 1, 1.5, 2, 3.5 중 하나 (PDG 기준 반정수)

real == false (미지 입자):
  mass_eV: "[UNKNOWN]" 또는 "0" 또는 "ephemeral" 허용
  charge: 내부 설정 체계에 따른 값 (±1/3 등 허용)
  내부 논리 체계 일관성 필수 (codex.md §7~12 층별 내부 논리 준수)
```

### 2-D. 실제 입자 물리 데이터 출처 규칙

```
출처 권위: Particle Data Group (PDG) Review of Particle Physics
  URL: https://pdg.lbl.gov/

PDG 기준으로만 기재해야 하는 필드:
  - mass_eV (eV/c²)
  - charge (e 단위)
  - spin (ℏ 단위)

scale_m 기준:
  - 원자/핵: 실험적 측정 반경 (charge radius)
  - 렙톤/보손/쿼크: "< 1e-18" (현재 실험 상한)
  - 점입자: "0" 또는 "< 1e-18"

mass_eV 단위 주의:
  - 분자/원자핵: u(원자질량단위) → eV/c² 변환: 1 u = 931.494 MeV/c²
    예) H₂O 분자 질량 18.015 u → 1.675e10 eV/c²
  - 쿼크: PDG "current quark mass" 사용 (constituent mass 아님)
    up quark: 2.16 MeV = 2.16e6 eV
    down quark: 4.67 MeV = 4.67e6 eV
    strange: 93.4 MeV = 9.34e7 eV
    charm: 1.27 GeV = 1.27e9 eV (PDG MS-bar)
    bottom: 4.18 GeV = 4.18e9 eV
    top: 172.69 GeV = 1.7269e11 eV
```

---

## 3. ResearchNode 타입 — 전체 필드 사전

### 3-A. 기본 필드 (research-tree.md §1 기준)

| 필드명 | 타입 | 필수 | 허용 범위·형식 | 의미 | 예시 |
|---|---|---|---|---|---|
| `id` | string | 필수 | 영문 대문자·숫자·밑줄 (A1, B8, D_E_COH 등), 전체 고유 | 코드 식별자 | `"A13"` |
| `branch` | string | 필수 | `"CHAIN"` \| `"SYNERGY"` \| `"AUTO"` \| `"PHASE"` | 소속 가지 | `"CHAIN"` |
| `name` | string | 필수 | 영문 | 노드 이름 (영문) | `"Full-Chain Cascade"` |
| `name_ko` | string | 필수 | 한국어 | 노드 이름 (한국어) | `"전체 티어 연쇄"` |
| `depth` | integer | 필수 | 1 ~ 4 | 가지 내 깊이 (1 = 가지 루트 직속) | `4` |
| `effect_type` | string | 필수 | 자유 서술 (어떤 메커니즘·자원에 영향하는지 명시) | 효과의 종류. 수치는 `effect_value`·`economy_params`에 있음 | `"Tk 보유수에 비례 Tk+1 생산 추가"` |
| `effect_value` | string | 필수 | economy_params.json 키 참조 문자열 또는 확정 수치 또는 `"[ECONOMY]"` | 효과 수치. 상수곱 금지 규칙 준수 여부도 여기 표기 | `"+0.01/개 (체인 내부)"` |
| `prerequisites` | string[] | 필수 | 기존 node_id 배열, 빈 배열 = 가지 루트 | 선행 노드 ID 목록. 순환 금지 | `["A9"]` |
| `gate_layer` | integer | 필수 | 1 ~ 11 | 최소 층 번호 — 해당 층 진입 전까지 구매 불가 | `6` |
| `gate_condition` | string | 필수 | 텍스트 조건 (게임 로직 파싱) | gate_layer 외 추가 조건 | `"A9 구매 + 프리온층(L6) 진입"` |
| `cost_D` | string | 필수 | economy_params.json 키 참조 또는 `"[ECONOMY]"` | D 비용. 구매에 소비되는 발견 데이터 | `"cost.A13"` |
| `milestone_warning` | boolean | 필수 | true / false | economy.md §2.3 마일스톤 경고 해당 여부. production_mult 직접 상수곱 시 true 로 경고 | `false` |
| `flavor_brief` | string | 필수 | 1~2문장 | narrative 방향 | `"연쇄가 완성됐다."` |

### 3-B. 파이프라인 확장 필드 (content-pipeline v0.1 §1-C)

| 필드명 | 타입 | 필수 | 허용 범위·형식 | 의미 | 예시 |
|---|---|---|---|---|---|
| `locale_key` | string | 필수 | `"research." + id` 고정 형식 | 현지화 키. ko.json에서 `research.{id}.name`, `research.{id}.tooltip` 두 키 필수 | `"research.A13"` |
| `version_added` | string | 필수 | `"v1.0"`, `"v1.1-c1"` 등 | 최초 활성화 빌드 버전 | `"v1.0"` |
| `content_pass` | string | 필수 | `"mvp"` \| `"c1"` \| `"c2"` | 컨텐츠 패스 분류 | `"mvp"` |
| `overlap_cap_note` | string \| null | 필수 | 관련 경고 텍스트 또는 null | production_mult 경계 주석. A13·B8·B12·B_HOLO 등 경계 노드에 필수. 해당 없으면 null | `"production_mult 상수곱 아님 — 체인 내부 배율(C안)"` |

### 3-C. 가지별 핵심 규칙

```
CHAIN (A 가지, 14노드):
  gate_layer 최소값 = 2 (원자층)
  해금: 원자층(L2) 진입 시 가지 전체 자동 해금
  마일스톤 배율(×2/×3/×5/×7) 절대 금지 — economy §2.3
  A13: production_mult 상수곱 아님, 체인 내부 연속 강화 배율 (C안)

SYNERGY (B 가지, 12노드):
  gate_layer 최소값 = 3 (핵층)
  해금: 핵층(L3) 진입 + D 누적 [economy_params.cost.synergy_unlock] 이상
  B8: 조건부 dC/dt 이벤트 배율 (세 메커니즘 동시 활성 구간만) — 상수곱 아님
  B12: B 가지 이벤트 D·QF 트리클 경로 — 상수곱 아님
  B_HOLO: codex 완성도 풀(≤+0.35×)에 흡수. 별도 holographic 가산항 금지

AUTO (C 가지, 10노드):
  gate_layer 최소값 = 2 (오비탈 슬롯 자동화)
  해금: 첫 상전이 완료 (dec19 벽 돌파) 후
  원칙: 수동 30~50회 능동 개입 후 해금 (FTUE 보호)
  C10: 오프라인 modifier 상향 — 2회 이상 상전이 후 해금

PHASE (D 가지, 16노드):
  층 진입 시 해당 층 노드 1~2개 자동 해금 (발견의 느낌)
  gate_layer = 해당 층 번호와 일치
  D_E_COH / D_E_DIS / D_E_RES: 세 노드 중 하나만 선택 가능 (exclusive)
  D_I2: gate_layer = 11 (플랑크층 필수)
```

---

## 4. LayerDefinition 타입 — 전체 필드 사전

파일 위치: `data/layers/layer_definitions.json`

| 필드명 | 타입 | 필수 | 허용 범위·형식 | 의미 | 예시 |
|---|---|---|---|---|---|
| `layer_index` | integer | 필수 | 1 ~ 11 | 층 번호 | `6` |
| `layer_id` | string | 필수 | snake_case | 코드 식별자 | `"preon"` |
| `name_ko` | string | 필수 | 한국어 | 층 이름 | `"프리온층"` |
| `real` | boolean | 필수 | true / false | 실제 물리 층(L1~L5) = true, 미지 서브층(L6~L11) = false | `false` |
| `scale_m_min` | string | 필수 | 과학 표기 | 해당 층 스케일 하한 (m) | `"1e-21"` |
| `scale_m_max` | string | 필수 | 과학 표기 | 해당 층 스케일 상한 (m) | `"1e-19"` |
| `decade_range` | number[] | 필수 | [start, end], 실수 허용 | 서사 스케일 decade 범위. [주의] 게임플레이 상전이 벽과 다를 수 있음 (GDD §9 [지시 3]) | `[9, 12]` |
| `prestige_wall_dec` | number \| null | 필수 | 0 ~ 26 또는 null | 해당 층에서 발생하는 상전이 압축 장벽 dec. 상전이 없는 층 = null | `19` |
| `prestige_index` | integer \| null | 필수 | 1 ~ 7 또는 null | 몇 번째 상전이인지. PT1~PT7 (PT7 = 빅 크런치). 상전이 없으면 null | `1` |
| `mechanism_id` | string | 필수 | snake_case | 해당 층의 주 메커니즘 코드 ID (systems §2 기준) | `"phase_overlap"` |
| `mechanism_name_ko` | string | 필수 | 한국어 | 메커니즘 이름 | `"위상 겹침"` |
| `unlock_bonus_type` | string | 필수 | 자유 서술 | 층 완성(LEGENDARY 해금) 시 제공하는 보너스 종류 | `"끈층 진입 V 초기값 증가"` |
| `particle_count_mvp` | integer | 필수 | 양의 정수 | v1.0 기준 해당 층 입자 수 (LEGENDARY 포함) | `7` |
| `particle_count_c1_focus` | integer \| null | 필수 | 양의 정수 또는 null | C1 집중 서브층 시 추가되는 심화 입자 수. 미지 서브층만 해당 | `3` |

### 4-A. 11개 층 요약 참조표

| layer_index | layer_id | real | decade_range | prestige_wall_dec | prestige_index | mechanism_id |
|---|---|---|---|---|---|---|
| 1 | `molecule` | true | [0, 0] | null | null | `manual_compress` |
| 2 | `atom` | true | [1, 1] | null | null | `orbital_resonance` |
| 3 | `nucleus` | true | [5, 5] | null | null | `nuclear_gauge` |
| 4 | `hadron` | true | [6, 6] | null | null | `color_charge_trinity` |
| 5 | `quark` | true | [9, 9] | null | null | `asymptotic_freedom` |
| 6 | `preon` | false | [9, 12] | 19 | 1 | `phase_overlap` |
| 7 | `string` | false | [12, 15] | 21.5 | 2 | `vibration_harmonics` |
| 8 | `loop` | false | [15, 18] | 23 | 3 | `spin_network` |
| 9 | `foam` | false | [18, 21] | 24.5 | 4 | `quantum_fluctuation` |
| 10 | `info` | false | [21, 24] | 25.5 | 5 | `holographic_encoding` |
| 11 | `planck` | false | [24, 26] | 26 | 6 | `spacetime_pixel_collapse` |

> [주의] 빅 크런치(PT7) = prestige_index 7이나 `layer_definitions.json`에 별도 레이어로 정의하지 않는다. 플랑크층(L11)의 dec26 도달이 PT6 + 빅 크런치 트리거를 동시에 발동한다. (GDD §9)

---

## 5. Economy 파라미터 테이블 — 확정값 사전

`data/economy_params.json` 파일의 키-값 전체 목록. **이 파일은 economy-designer가 소유하고 유지한다.** content 파일은 키 이름만 참조한다.

### 5-A. 핵심 수식 파라미터 (economy.md §1·§2·§3 확정값)

| 키 이름 | 확정값 | 단위 | 출처 §§ | 의미 |
|---|---|---|---|---|
| `engine.alpha` | `0.65` | 무차원 | economy §2.2 / GDD §7 | 로그 저항 계수. `dec = α·log₁₀(C+1)` |
| `engine.r0_m` | `1e-9` | m | GDD §7 | 초기 반경. `r = r₀·10^(-dec)` |
| `engine.base_rate` | `0.25` | 무차원 | economy §1.1·§1.3 | QF 영구 부스트 계수. `production_mult = 1 + 0.25·log₁₀(1+QF)` |
| `engine.D_norm` | `1e26` | C 단위 | economy §1.1 | QF 정규화 상수. `QF = floor(K·(lifetime_C/D_norm)^0.5)` |
| `engine.QF_exponent` | `0.5` | 무차원 | economy §1.1·§1.4 | QF 산출 지수 (제곱근 = AdCap형) |
| `engine.K_default` | `1.0` | 무차원 | economy §7.4 | QF 계수 기본값 |
| `engine.K_bekenstein` | `1.05` | 무차원 | economy §7.4 | 베켄슈타인 홀론 발견 후 QF 계수 (K: 1.0 → 1.05). +5% QF |

### 5-B. 비용 곡선 파라미터 (economy.md §2.1 확정값)

| 키 이름 | 확정값 | 출처 §§ | 의미 |
|---|---|---|---|
| `chain.base_k.t1` | `2.00e2` | economy §2.1 | T1 base_k = 10^(1+1.3×1) |
| `chain.base_k.t2` | `3.98e3` | economy §2.1 | T2 base_k = 10^(1+1.3×2) |
| `chain.base_k.t3` | `7.94e4` | economy §2.1 | T3 base_k = 10^(1+1.3×3) |
| `chain.base_k.t4` | `1.58e6` | economy §2.1 | T4 base_k = 10^(1+1.3×4) |
| `chain.base_k.t5` | `3.16e7` | economy §2.1 | T5 base_k = 10^(1+1.3×5) |
| `chain.base_k.t6` | `6.31e8` | economy §2.1 | T6 base_k = 10^(1+1.3×6) |
| `chain.base_k.t7` | `1.26e10` | economy §2.1 | T7 base_k = 10^(1+1.3×7) |
| `chain.base_k.t8` | `2.51e11` | economy §2.1 | T8 base_k = 10^(1+1.3×8) |
| `chain.growth_k.t1` | `2.200` | economy §2.1 | T1 growth. 공식: 2.2 − (0.4/7)·(k−1) |
| `chain.growth_k.t2` | `2.143` | economy §2.1 | T2 growth |
| `chain.growth_k.t3` | `2.086` | economy §2.1 | T3 growth |
| `chain.growth_k.t4` | `2.029` | economy §2.1 | T4 growth |
| `chain.growth_k.t5` | `1.971` | economy §2.1 | T5 growth |
| `chain.growth_k.t6` | `1.914` | economy §2.1 | T6 growth |
| `chain.growth_k.t7` | `1.857` | economy §2.1 | T7 growth |
| `chain.growth_k.t8` | `1.800` | economy §2.1 | T8 growth |

### 5-C. 상전이 벽 스케줄 (economy.md §1.2 확정값)

| 키 이름 | 확정값 | 출처 §§ | 의미 |
|---|---|---|---|
| `prestige.walls` | `[19, 21.5, 23, 24.5, 25.5, 26]` | economy §0·§1.2 | 6개 상전이 압축 장벽 dec 값. WALLS[0]=PT1(프리온), WALLS[5]=PT6(플랑크) |
| `prestige.decade_cap` | `26` | economy §1.2 / GDD §9 | 최대 decade 캡 (플랑크 길이) |
| `prestige.big_crunch_index` | `7` | GDD §9 | 빅 크런치는 7번째 상전이 (PT6 도달 후 자동 발동) |

### 5-D. 오프라인 파라미터 (economy.md §3.1 확정값)

| 키 이름 | 확정값 | 단위 | 출처 §§ | 의미 |
|---|---|---|---|---|
| `offline.cap_h` | `24` | 시간 | economy §3.1 | 오프라인 크레딧 상한 시간 |
| `offline.modifier` | `0.65` | 무차원 | economy §3.1 | 오프라인 효율 (온라인의 65%) |
| `offline.modifier_post_prestige` | `1.0` | 무차원 | economy §3.1·§3.3 | 상전이 직후 첫 오프라인 modifier (1회성 보너스) |
| `offline.tamper_clamp_h` | `48` | 시간 | economy §3.1·§3.3 | 시계조작 방어 하드 상한 |
| `offline.long_idle_bonus_LB` | `0.5` | 무차원 | economy §3.1 | 24h~48h 구간 로그 보너스 계수 |

### 5-E. 도감 완성도 파라미터 (economy.md §7.1 확정값)

| 키 이름 | 확정값 | 출처 §§ | 의미 |
|---|---|---|---|
| `codex.completion_denominator` | `76` | economy §7.1 / codex §13 | 홀로그래픽 완성도 분모. LEGENDARY 11개 제외한 수집 대상 수 |
| `codex.holographic_coeff` | `0.35` | economy §7.1 | 도감 완성도 보너스 계수. `bonus(c) = 0.35·c²` (곡선 B) |
| `codex.holographic_cap` | `0.35` | economy §7.1 | codex 항 상한. min(0.35·c², 0.35) |
| `codex.bonus_curve` | `"quadratic"` | economy §7.1 | 곡선 타입 식별자 (B=제곱, 후반 가중) |

### 5-F. 홀로그래픽 배율 파라미터 (economy.md §7.2.3 확정값)

| 키 이름 | 확정값 | 출처 §§ | 의미 |
|---|---|---|---|
| `holo.factor` | `0.008` | economy §7.2.3 | D항 계수. `D항 = log₁₀(D_total+1) × 0.008`. D_total ≲ 1e7 가정 |
| `holo.D_budget_max` | `0.058` | economy §7.2.3 | D항 서브예산 상한 (+5.8%). 총 H < ×1.4286 조건에서 역산 |
| `holo.total_H_cap` | `1.4286` | economy §7.2.3 | 전체 holographic_mult 추가곱 상한. dec26 −30% 기준 역산 |

### 5-G. D 보존율 파라미터 (economy.md §7.3 확정값)

| 키 이름 | 확정값 | 출처 §§ | 의미 |
|---|---|---|---|
| `redescent.D_lifetime_preservation` | `1.00` | economy §7.3 | D_lifetime 빅 크런치 보존율 (항상 100%) |
| `redescent.D_current_curve` | `[null, 0.65, 0.50, 0.40, 0.40, 0.38, 0.35]` | economy §7.3 | 재하강 회차별 D_current 보존율. 인덱스 0 = 해당없음, 인덱스 1 = 1회차 후 2회차 진입 시 |
| `redescent.D_current_default` | `0.50` | economy §7.3 | 회차 인덱스 초과 시 기본값 |

### 5-H. 재하강 차별화 파라미터 (economy.md §7.5 확정값)

| 키 이름 | 확정값 | 출처 §§ | 의미 |
|---|---|---|---|
| `redescent.cost_mult_curve` | `[1.0, 0.952, 0.909, 0.870, 0.833, 0.800]` | economy §7.5.2 | 회차별 비용 경감 계수. 개입 플레이어 능동시간 보조 레버 (방치 캘린더 단축 아님) |
| `redescent.focus_layer_count` | `6` | GDD §9 | 집중 서브층 회전 대상 수 (L6~L11) |
| `redescent.idle_calendar_days` | `5.77` | economy §7.5 | 방치 플레이어 회차당 캘린더 일수 (오프라인 바운드, 고정) |

### 5-I. 연구 트리 D 비용 파라미터 (economy-designer 위임, 미확정)

```
// 형식 예시 — 실제 값은 economy-designer가 채운다
"cost.A1":  [ECONOMY],   // 원자층 T1 증폭기
"cost.A2":  [ECONOMY],   // 핵층 고위 티어 증폭
...
"cost.A14": [ECONOMY],
"cost.B1":  [ECONOMY],
...
"cost.B_HOLO": [ECONOMY],
"cost.C1":  [ECONOMY],
...
"cost.C10": [ECONOMY],
"cost.D_A": [ECONOMY],
...
"cost.D_I2": [ECONOMY]

// 비용 구조 원칙 (research-tree.md §6):
// node_cost = base_D × branch_factor × depth_in_branch
// A 가지: base 낮음 (체인 직접 강화 → 빠른 접근)
// B 가지: base 중간 (시너지 = 여러 시스템 필요)
// C 가지: base 높음 (자동화 = 방치 프리미엄)
// D 가지: base 중간~높음 (층별 심화 = 진행 필요)
```

### 5-J. 입자 발견 보너스 수치 파라미터 (economy-designer 위임, 미확정)

```
// 형식 예시 — 실제 값은 economy-designer가 채운다
"bonus.t1_cost_discount":   [ECONOMY],  // T1 압축기 비용 할인율
"bonus.e_rate_small":       [ECONOMY],  // E 생산율 소폭 상승
"bonus.d_trickle_small":    [ECONOMY],  // D 트리클 소량 증가
"bonus.resonance_mult":     [ECONOMY],  // 오비탈 공명 배율 증가
"bonus.gauge_speed":        [ECONOMY],  // 핵력 게이지 충전 속도
"bonus.qf_trickle":         [ECONOMY],  // QF 트리클 소량 증가
"bonus.chain_cascade_coeff": [ECONOMY], // A13 연속 강화 계수
// ...
// 각 입자 엔트리의 bonus_ref 필드가 이 키들을 참조한다
```

---

## 6. SaveState 스키마 — 네임스페이스별 필드

tech-architecture.md §1.1 기준. **이 스키마는 tech-architect 소관이다.** content-designer는 codex·research 네임스페이스의 구조만 참조한다.

### 6-A. 세이브 봉투 (envelope)

```jsonc
{
  "version":  <integer>,   // 스키마 버전. 마이그레이션 디스패치 키. 봉투 외부 평문 필수
  "data":     <string>,    // 내부 스키마를 직렬화+lz-string 압축한 페이로드
  "checksum": <string>     // data 무결성 검증값 (변조 탐지용)
}
```

### 6-B. `meta` 네임스페이스

| 필드명 | 타입 | 의미 |
|---|---|---|
| `version` | integer | 스키마 버전 (봉투의 version과 일치) |
| `build_version` | string | 게임 빌드 버전 ("v1.0", "v1.1-c1") |
| `created_at` | number | 최초 세이브 Unix timestamp (ms) |
| `last_saved_at` | number | 최종 저장 Unix timestamp (ms) — 변조 탐지 기준 |
| `total_playtime_s` | number | 총 능동 플레이타임 (초) |

### 6-C. `resources` 네임스페이스

| 필드명 | 타입 | 의미 | Decimal 여부 |
|---|---|---|---|
| `E` | string (Decimal) | 압축 에너지 현재값 | Decimal `.toString()` |
| `C` | string (Decimal) | 압축 깊이 현재값 | Decimal `.toString()` |
| `D_current` | string (Decimal) | 발견 데이터 (현재 런) | Decimal `.toString()` |
| `D_lifetime` | string (Decimal) | 발견 데이터 (전 런 누적, 상전이 후 100% 보존) | Decimal `.toString()` |
| `QF` | string (Decimal) | 양자 거품 총량 | Decimal `.toString()` |
| `lifetime_C` | string (Decimal) | 전 런 누적 압축 깊이 (AdCap 기준, QF 산출 입력) | Decimal `.toString()` |

> [주의] Decimal은 `new Decimal(str)` / `.toString()` 변환. JSON 직렬화 불가 (tech-arch §1.4·§2.4). 모든 Decimal 필드는 로드 시 `new Decimal(str)` 복원 필수.

### 6-D. `chain` 네임스페이스

| 필드명 | 타입 | 의미 |
|---|---|---|
| `bought` | integer[8] | 8단 압축기 각 티어 보유 개수 [T1_count, T2_count, …, T8_count]. native integer (Decimal 아님) |

> 비용·생산량은 파생값 → 저장 안 함. 로드 시 economy_params 수식으로 재계산.

### 6-E. `prestige` 네임스페이스

| 필드명 | 타입 | 의미 |
|---|---|---|
| `N_prestige` | integer | 총 상전이 횟수 (PT1~PT7 포함) |
| `run_index` | integer | 재하강 회차 (1 = 첫 캠페인, 2 = 첫 빅 크런치 후, …) |
| `QF_claimed` | string (Decimal) | 이미 수령한 QF (QF_gain = QF_total − QF_claimed) |
| `focus_sublayer` | integer \| null | 현재 회차 집중 서브층 (6~11). 1회차 = null |
| `post_prestige_offline_bonus_available` | boolean | 상전이 직후 modifier=1.0 보너스 미소비 여부 (1회성) |

### 6-F. `codex` 네임스페이스

| 필드명 | 타입 | 의미 |
|---|---|---|
| `discovered_ids` | string[] | 발견된 입자 ID 집합. 스파스 — boolean 87개 배열 아님. 새 입자 추가에 자동 호환 |
| `discovered_timestamps` | Record<string, number> | `{particle_id: unix_timestamp_ms}`. 발견 시각 기록 |

> `codex_completion = discovered_ids.filter(id => particles[id].discoverable).length / 76`  
> 파생값 — 저장 안 함, 로드 후 재계산.

### 6-G. `research` 네임스페이스

| 필드명 | 타입 | 의미 |
|---|---|---|
| `purchased_ids` | string[] | 구매한 연구 노드 ID 집합. 스파스 배열. 영구 보존 (재하강 후도 유지) |

### 6-H. `layers` 네임스페이스

| 필드명 | 타입 | 의미 |
|---|---|---|
| `current_layer` | integer | 현재 층 번호 (1~11) |
| `current_sublayer` | integer \| null | 현재 미지 서브층 (6~11, 실제 물리 층 = null) |
| `mechanism_states` | object | 층별 메커니즘 상태. 각 메커니즘 모듈이 `serialize()` 결과를 여기 저장. 구조는 모듈 소관 |

> `mechanism_states` 하위 구조 예시 (각 메커니즘 모듈이 정의):
> ```
> orbital_resonance: { slot_count, auto_click_interval, active_slots: [...] }
> nuclear_gauge: { charge_level, event_count }
> color_charge: { balance_r, balance_g, balance_b, trinity_count }
> phase_overlap: { current_phase: "coherent"|"dispersed"|"resonant", lock_e_cost }
> spin_network: { nodes: [...], edges: [...] }
> quantum_fluctuation: { event_history: [...] }
> holographic_encoding: { D_total_snapshot }
> ```

### 6-I. `settings` 네임스페이스

| 필드명 | 타입 | 의미 |
|---|---|---|
| `offline_precision_mode` | boolean | 미니 시뮬 오프라인 계산 on/off |
| `number_notation` | string | `"scientific"` \| `"engineering"` \| `"prefix"` |
| `sound_enabled` | boolean | 사운드 on/off |
| `graphics_quality` | string | `"low"` \| `"medium"` \| `"high"` |

### 6-J. `stats` 네임스페이스

| 필드명 | 타입 | 의미 |
|---|---|---|
| `total_compressions` | integer | 총 압축 횟수 (native integer — 정확 카운팅) |
| `total_discoveries` | integer | 총 발견 입자 수 |
| `total_prestige_count` | integer | 총 상전이 횟수 (native integer) |
| `total_research_purchased` | integer | 총 연구 노드 구매 수 |
| `D_total_all_time` | string (Decimal) | 전 시간 누적 D 총량 (holo_factor 재검증 텔레메트리 대상 — economy §7.7) |
| `max_dec_all_time` | number | 전 생애 도달 최대 dec(상전이 리셋 넘어 유지) |

> **구현 현황(M2.4c, 2026-07-08):** 코드 `StatsState`(camelCase, `core/state`)는 위 계획의 **부분집합**을 먼저 구현:
> `manualCompresses`(≈`total_compressions`) · `totalBinds`(결속=구매 수량) · `maxDec`(≈`max_dec_all_time`).
> 세이브 봉투에 **옵셔널 필드**로 실려 버전 업 없이 보존(구버전=0 기본, `serialize.ts`). 상전이/재하강을 넘어 전 생애 누적.
> 나머지(`total_discoveries`·`total_prestige_count`·`total_research_purchased`·`D_total_all_time`)는 기존 상태에서 파생 표시(기록 패널)하거나 텔레메트리(R8, M3.8)로 후속. `settings.number_notation`의 `"prefix"`는 코드에선 `"standard"`.

---

## 7. 현지화 키 규칙

localization-plan.md §1-C 기준.

### 7-A. 키 네이밍 컨벤션

```
입자 키:
  particle.{id}.name     // 표시 이름
  particle.{id}.flavor   // 플레이버 텍스트 (1~3문장)

연구 노드 키:
  research.{id}.name     // 노드 이름
  research.{id}.tooltip  // 툴팁 (효과 설명 + 분위기)

층 키:
  layer.{layer_id}.name          // 층 이름
  layer.{layer_id}.enter_message // 층 진입 메시지

상전이 키:
  prestige.pt{N}.message  // N번째 상전이 메시지 (PT1~PT7)
  prestige.bigcrunch.message
```

### 7-B. ko.json 구조 예시

```jsonc
{
  "particle.up_quark.name": "업 쿼크",
  "particle.up_quark.flavor": "가장 가벼운 업타입 쿼크. 양성자의 두 주인공 중 하나.",
  "research.A1.name": "T1 증폭기",
  "research.A1.tooltip": "체인의 기초를 강화한다. 첫 번째 단이 강해질수록 모든 것이 강해진다.",
  "layer.preon.name": "프리온층",
  "layer.preon.enter_message": "쿼크의 경계를 넘었다. 이제 알 수 없는 영역이다."
}
```

### 7-C. 금지 사항

```
- locale 키에 수치 하드코딩 금지. 수치는 economy_params.json 참조.
- particle.{id}.flavor에 "최고", "엄청난" 등 AI 슬롭 표현 금지 (narrative.md §2 보이스 바이블)
- 상상 입자 이름의 임의 번역 금지 — localization-plan §4-C 고유 이름 표기 준수
```

---

## 8. 데이터 값 출처 매핑 (SSOT 권위 매핑)

이 표는 각 확정값이 **어느 문서 §**에서 왔는지를 명시한다. 중복 입력 아님 — 권위 소스 매핑.

| 데이터 카테고리 | 확정 값 | 권위 소스 |
|---|---|---|
| 입자 물리 데이터 (mass, charge, spin) | PDG 2024 값 | PDG Review of Particle Physics (외부) |
| 비용 곡선 `base_k`, `growth_k` | 표 §5-B | economy.md v0.3 §2.1 |
| 상전이 벽 WALLS | `[19,21.5,23,24.5,25.5,26]` | economy.md v0.3 §0·§1.2 |
| `base_rate` | `0.25` | economy.md v0.3 §1.1·§1.3 |
| `D_norm` | `1e26` | economy.md v0.3 §1.1 |
| `QF_exponent` | `0.5` | economy.md v0.3 §1.1·§1.4 |
| `K_bekenstein` | `1.05` | economy.md v0.3 §7.4 |
| 오프라인 `CAP`, `modifier`, `tamper_clamp` | 표 §5-D | economy.md v0.3 §3.1 |
| 도감 `completion_denominator` | `76` | economy.md v0.3 §7.1 + codex.md §0·§13 |
| 도감 `holographic_coeff` | `0.35` | economy.md v0.3 §7.1 (곡선 B) |
| `holo_factor` | `0.008` | economy.md v0.3 §7.2.3 |
| D 보존율 `D_current_curve` | `[-,0.65,0.50,0.40,0.40,0.38,0.35]` | economy.md v0.3 §7.3 |
| `cost_mult_curve` | `[1.0,0.952,…,0.800]` | economy.md v0.3 §7.5.2 |
| 입자 스키마 필드 정의 | codex.md §1 (기본) + content-pipeline §1-B (확장) | codex.md v0.1 §1 / content-pipeline v0.1 §1-B |
| 연구 노드 스키마 필드 정의 | research-tree.md §1 (기본) + content-pipeline §1-C (확장) | research-tree.md v0.1 §1 / content-pipeline v0.1 §1-C |
| 층 정의 | codex.md §0 층별 개요 + GDD §9 층표 | GDD v0.3 §9 / codex.md v0.1 §0 |
| 세이브 스키마 네임스페이스 | 표 §6 전체 | tech-architecture.md v0.1 §1.1 |
| A13 effect_value | `+0.01/개 (체인 내부)` | economy.md v0.3 §7.2.1 / research-tree.md A13 |
| B8 effect_value | `dC/dt ×1.20 (조건부 이벤트)` | economy.md v0.3 §7.2.1 / research-tree.md B8 |
| B12 effect_value | `이벤트 D·QF 트리클 ×1.5 (이벤트 경로)` | economy.md v0.3 §7.2.1 / research-tree.md B12 |
| B_HOLO 배치 | codex 완성도 풀 흡수, 별도항 금지 | economy.md v0.3 §7.2.2 |
| 입자 수 (전체/수집대상/LEGENDARY) | 87 / 76 / 11 | codex.md v0.1 §0·§13-1·§13-2 |
| 연구 노드 수 (전체/가지별) | 52 (A14/B12/C10/D16) | research-tree.md v0.1 §0 |

---

## 9. 무결성 규칙 (content-pipeline §4 검사와 연계)

### 9-A. 데이터 무결성 검사 (빌드 타임)

```
[검사 1] ID 고유성
  particles/*.json 전체에서 id 중복 없음
  research/*.json 전체에서 id 중복 없음
  _index.json 목록 = 실제 파일 내 ID 집합과 일치

[검사 2] 필수 필드 누락
  Particle 필수 필드: id, name, name_ko, layer, decade, real,
    mass_eV, charge, spin, rarity, unlock_condition, unlock_bonus_type,
    flavor_brief, locale_key, bonus_ref, discoverable,
    version_added, content_pass, focus_layer
  ResearchNode 필수 필드: id, branch, name, name_ko, depth,
    effect_type, effect_value, prerequisites, gate_layer,
    gate_condition, cost_D, milestone_warning, flavor_brief,
    locale_key, version_added, content_pass, overlap_cap_note

[검사 3] bonus_ref 유효성
  null 또는 economy_params.json의 기존 키 이름만 허용
  없는 키 참조 → FAIL

[검사 4] prerequisites 순환 없음
  ResearchNode.prerequisites의 모든 id가 _index.json에 존재
  위상 정렬(DAG) 검사로 순환 선행조건 탐지

[검사 5] discoverable 분모 정합
  discoverable=true 입자 수 = 76 (MVP 기준)
  LEGENDARY rarity → discoverable=false 필수

[검사 6] 실제 입자 물리 범위 검사
  real=true → charge: −2 ~ +2 (e 단위)
  real=true → spin: {0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5} 중 하나
  real=true → mass_eV: null이 아닌 경우 숫자 파싱 가능 문자열

[검사 7] locale_key 형식
  Particle: locale_key === "particle." + id
  ResearchNode: locale_key === "research." + id
  형식 불일치 → FAIL

[검사 8] content_pass / focus_layer 정합
  content_pass="c1" → focus_layer: 6~11 정수 (null이면 FAIL)
  content_pass="mvp" → focus_layer: null (정수이면 FAIL)

[검사 9] milestone_warning 정합
  milestone_warning=true → overlap_cap_note가 null이 아님
  production_mult 상수곱 효과가 감지되면 자동 WARN

[검사 10] 층 번호 범위
  Particle.layer: 1~11
  ResearchNode.gate_layer: 1~11
  범위 초과 → FAIL
```

### 9-B. 밸런스 검사 트리거 (economy/qa-balancer 주도)

```
RARE/EPIC 입자 추가 → 도감 완성도 곡선 + production_mult 경계 재시뮬 필수
LEGENDARY 입자 추가 → discoverable 분모 76 불변 확인 필수
연구 노드 추가(production_mult 직접 상수곱) → economy §7.2 30% 가드레일 재시뮬 필수
c1 집중 서브층 콘텐츠 추가 → 재하강 페이싱 재검증 (redescent_diff.py 기반) 필수
```

### 9-C. production_mult 가드레일 (절대 규칙)

```
절대 금지 (위반 시 economy §2.3 dec26 −72% 붕괴):
  ❌ 마일스톤 배율 ×2/×3/×5/×7 형태의 연구 노드 또는 입자 보너스
  ❌ dec26 시간 −30% 이상 단축하는 임의 상수 배율 추가
  ❌ B_HOLO를 holographic_mult 별도 가산항으로 추가 (→ ×1.454 → −31.2% FAIL)
  ❌ 힉스 보손 unlock_bonus를 production_mult 상수곱으로 구현

허용 (C안 구조):
  ✓ 체인 내부 연속 강화 배율 (A13: +0.01/개, Tk→Tk+1)
  ✓ 조건부 이벤트 배율 (B8: dC/dt ×1.20, 세 메커니즘 동시 활성 시)
  ✓ 이벤트 경로 트리클 (B12: D·QF 트리클 ×1.5)
  ✓ 도감 완성도 codex 풀 내 효과 (≤+0.35× 상한 준수)
  ✓ 플레이버 보너스 ×1.1 이하
```

---

## 10. 키 네이밍 컨벤션

### 10-A. 입자 ID

```
형식: {particle_name}_{qualifier}
예:
  up_quark          — 업 쿼크 (snake_case, 영문 소문자)
  water_molecule    — 물 분자
  preon_plus        — 양위상 프리온
  l1_completion     — L1 완성 보너스 (층 완성 보너스: l{N}_completion 형식 고정)
  l6_completion     — L6 완성 보너스

금지:
  ❌ 대문자 (upQuark)
  ❌ 하이픈 (up-quark)
  ❌ 공백
  ❌ 한글 포함
```

### 10-B. 연구 노드 ID

```
형식: {가지_코드}{번호} 또는 {가지_코드}_{하위식별자}
가지 코드: A, B, C, D

예:
  A1, A2, …, A14   — CHAIN 가지
  B1, B2, …, B12, B_HOLO  — SYNERGY 가지
  C1, C2, …, C10   — AUTO 가지
  D_A, D_A2, D_B, D_B2, D_C, D_C2, D_D, D_D2   — PHASE 가지 기본
  D_E, D_E_COH, D_E_DIS, D_E_RES   — 위상 전문화 (선택 분기)
  D_F, D_F2, D_G, D_G2, D_H, D_H2, D_I, D_I2   — PHASE 가지 후속
```

### 10-C. economy_params.json 키

```
네임스페이스.카테고리.식별자 형식:

engine.*       — 핵심 수식 파라미터 (alpha, base_rate, D_norm, …)
chain.*        — 8단 체인 파라미터 (base_k.t1, growth_k.t1, …)
prestige.*     — 상전이 파라미터 (walls, decade_cap, …)
offline.*      — 오프라인 파라미터 (cap_h, modifier, tamper_clamp_h, …)
codex.*        — 도감 완성도 파라미터 (completion_denominator, holographic_coeff, …)
holo.*         — 홀로그래픽 배율 파라미터 (factor, D_budget_max, …)
redescent.*    — 재하강 파라미터 (D_lifetime_preservation, D_current_curve, …)
cost.{node_id} — 연구 노드 D 비용 (cost.A1, cost.B_HOLO, …)
bonus.{name}   — 입자 발견 보너스 수치 (bonus.t1_cost_discount, …)
effect.{node_id}.{param} — 연구 효과 수치 (effect.A3.cascade_coeff, …)
```

---

## 11. 소유권 경계

| 결정 사항 | 소유자 | 위치 | 비고 |
|---|---|---|---|
| 입자 존재 여부·어느 층·어떤 종류 | content-designer | `particles/*.json` | |
| 입자 발견 보너스의 **종류** (어떤 자원·메커니즘에) | content-designer | `particles/*.json` `.unlock_bonus_type` | |
| 입자 발견 보너스의 **수치** | economy-designer | `economy_params.json` `bonus.*` 키 | |
| 연구 노드 존재 여부·가지·깊이 | content-designer | `research/*.json` | |
| 연구 노드 효과의 **종류** (어떤 시스템에 영향) | content-designer | `research/*.json` `.effect_type` | |
| 연구 노드 효과의 **수치** | economy-designer | `economy_params.json` `effect.*` 키 | |
| 연구 노드 D **비용 수치** | economy-designer | `economy_params.json` `cost.*` 키 | |
| 해금 조건 (어떤 상태에서 해금) | content-designer | `particles/*.json`, `research/*.json` `.unlock_condition` | |
| 층 정의 (스케일·decade·메커니즘 종류) | content-designer + systems-designer | `layers/layer_definitions.json` | |
| production_mult 경계 판정 | economy-designer | economy.md §7.2 + `economy_params.json` | |
| 세이브 스키마 구조 | tech-architect | tech-architecture.md §1.1 | |
| 직렬화·마이그레이션 구현 | tech-architect + game-programmer | `src/core/save/` | |
| 플레이버 텍스트 | narrative-designer | `data/locale/ko.json` `particle.*.flavor` | |
| 영어 번역 | 외부 번역가 + narrative 감수 | `data/locale/en.json` | |

**핵심 경계 원칙:**
- **content = 구조·종류·조건**: 무엇이 존재하고, 어떤 종류의 효과를 주며, 어떤 조건에서 해금되는가
- **economy = 수치·배율**: 그 효과가 얼마나 강한가, 비용이 얼마인가, 경제 파라미터 값이 얼마인가

content 파일이 수치를 하드코딩하거나, economy 파일이 입자의 존재 여부를 결정하는 것은 경계 위반이다.

---

*이 문서는 `data/` JSON을 채우는 모든 작업자(game-programmer, content-designer, economy-designer)가 참조하는 단일 데이터 사전이다. 구조·필드는 content-designer, 수치는 economy-designer, 검증은 CI + qa-balancer가 담당한다.*
