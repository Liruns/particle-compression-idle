# 콘텐츠 파이프라인 설계서 (content-pipeline v0.1)

- 작성: content-designer
- 기준: `GDD.md` v0.3 / `codex.md` v0.1 §1 / `research-tree.md` v0.1 / `tech-architecture.md` §4.4 / `scope-mvp.md` §4·§5 / `economy.md` v0.3 / `localization-plan.md` v0.1
- 상태: 구조·워크플로·라이브 파이프라인 확정 초안
- 담당: content-designer (데이터 설계) — 수치는 economy-designer, 플레이버는 narrative-designer, 번역 키는 localization-plan 체계를 따른다.
- 작성일: 2026-06-26

---

## 0. 이 문서가 정하는 것

**콘텐츠 데이터가 어디에 있고, 어떻게 추가·수정·검증·배포되는가.**

이 문서가 정하지 않는 것: 수식·파라미터 수치(economy 소관), 플레이버 텍스트(narrative 소관), 렌더·셰이더(graphics-programmer 소관), 저장 포맷 직렬화(tech-architecture 소관).

**핵심 원칙 (tech-architecture §4.4):** 입자·연구노드·층은 **코드가 아닌 `data/` JSON**으로 정의된다. 게임 로직은 데이터를 읽어 동작한다. 콘텐츠 추가 = 데이터 파일 수정이지 코드 수정이 아니다.

---

## 1. 데이터 주도 콘텐츠 모델

### 1-A. `data/` 디렉토리 구조

```
data/
  particles/
    l1_molecules.json     L1 분자층 (8입자)
    l2_atoms.json         L2 원자층 (13입자)
    l3_nuclei.json        L3 핵층 (10입자)
    l4_hadrons.json       L4 핵자층 (9입자)
    l5_quarks.json        L5 쿼크층 (17입자)
    l6_preons.json        L6 프리온층 (7입자)
    l7_strings.json       L7 끈층 (6입자)
    l8_loops.json         L8 루프층 (5입자)
    l9_foam.json          L9 거품층 (5입자)
    l10_info.json         L10 정보층 (4입자)
    l11_planck.json       L11 플랑크층 (3입자)
    _index.json           전체 입자 ID 목록 (87개) — 로더가 이 파일로 순서·층 매핑 확인
  research/
    branch_A_chain.json   체인 증폭 가지 (14노드)
    branch_B_synergy.json 시너지 엔진 가지 (12노드)
    branch_C_auto.json    자동화 확장 가지 (10노드)
    branch_D_phase.json   위상 심화 가지 (16노드)
    _index.json           전체 노드 ID 목록 (52개)
  layers/
    layer_definitions.json  11개 층 정의 (스케일·decade·메커니즘·층완성 보너스)
  economy_params.json       콘텐츠가 참조하는 economy 경계값 (아래 §1-D 참조)
  locale/
    ko.json                 한국어 기준 (localization-plan §1-B)
    en.json                 영어
```

### 1-B. 입자 엔트리 스키마 (codex.md §1 기준 + 파이프라인 확장)

`codex.md §1`에 정의된 기본 스키마에 파이프라인 운영을 위한 필드를 추가한다.

```jsonc
{
  // ── codex.md §1 기본 필드 ──
  "id": "string",               // 코드 식별자 (snake_case, 전체 고유)
  "name": "string",             // 표시 이름 (화학식·기호 포함 가능)
  "name_ko": "string",          // 한국어 이름
  "layer": 1..11,               // 속한 층
  "scale_m": "string",          // 크기 (m 단위, 과학 표기)
  "decade": number,             // dec 값 (α·log₁₀(C) 기준)
  "real": true | false,         // 실제 물리 vs 상상 입자
  "mass_eV": "string|null",     // 질량 (eV/c²)
  "charge": number,             // 전하 (e 단위)
  "spin": number,               // 스핀 (ℏ 단위)
  "rarity": "COMMON"|"UNCOMMON"|"RARE"|"EPIC"|"LEGENDARY",
  "unlock_condition": "string", // 해금 조건 (게임 로직이 파싱하는 조건 문자열)
  "unlock_bonus_type": "string",// 보너스 종류 (economy 수치 참조 키)
  "flavor_brief": "string",     // 플레이버 방향 (narrative가 채움)

  // ── 파이프라인 확장 필드 ──
  "locale_key": "string",       // particle.{id} — localization-plan §1-C particle.* 네임스페이스
  "bonus_ref": "string|null",   // economy_params.json 내 수치 키. null이면 효과 없음
  "discoverable": true | false, // 홀로그래픽 완성도 분모(76)에 포함 여부. LEGENDARY = false
  "version_added": "string",    // 최초 추가 버전 ("v1.0", "v1.1-c1" 등)
  "content_pass": "mvp"|"c1"|"c2", // scope-mvp §5 컷 기준 (mvp=v1.0, c1=재하강심화)
  "focus_layer": number|null    // c1 심화 입자의 집중 서브층 번호 (6~11). mvp 입자는 null
}
```

**핵심 규칙:**
- `id`는 전체 파일에서 단 하나여야 한다. `_index.json`이 전체 ID 목록을 보유하고 중복 검사 진입점이 된다.
- `discoverable: false` 입자(LEGENDARY 11개)는 `_index.json`에 존재하지만 홀로그래픽 완성도 계산 분모 76에 포함되지 않는다. (codex.md §0 확정)
- `locale_key`는 `particle.{id}` 형식으로 고정. `ko.json`에 `particle.{id}.name`, `particle.{id}.flavor` 두 키가 반드시 존재해야 한다.
- `bonus_ref`가 가리키는 `economy_params.json` 키에 수치가 없으면 빌드 검증(§4-A)이 FAIL을 낸다.

### 1-C. 연구 노드 스키마 (research-tree.md §1 기준 + 파이프라인 확장)

```jsonc
{
  // ── research-tree.md §1 기본 필드 ──
  "id": "string",
  "branch": "CHAIN"|"SYNERGY"|"AUTO"|"PHASE",
  "name": "string",
  "name_ko": "string",
  "depth": number,
  "effect_type": "string",
  "effect_value": "string",       // economy_params.json 키 참조 또는 확정 수치
  "prerequisites": ["node_id"],
  "gate_layer": number,
  "gate_condition": "string",
  "cost_D": "string",             // economy_params.json 키 참조
  "milestone_warning": boolean,
  "flavor_brief": "string",

  // ── 파이프라인 확장 필드 ──
  "locale_key": "string",         // research.{id} — localization-plan §1-C research.* 네임스페이스
  "version_added": "string",
  "content_pass": "mvp"|"c1"|"c2",
  "overlap_cap_note": "string|null" // production_mult 경계 주석. 해당 없으면 null
}
```

### 1-D. economy 수치 주입 경계 — 어디까지 content, 어디부터 economy

이 경계는 콘텐츠 담당자가 수치를 임의로 바꾸지 못하게 하고, economy 담당자가 콘텐츠 파일을 직접 편집하지 않아도 되게 한다.

**`economy_params.json` — economy-designer가 소유하는 파일:**

```jsonc
{
  // 입자 해금 보너스 수치
  "bonus.t1_cost_discount": 0.05,      // 예: T1 압축기 비용 5% 할인
  "bonus.e_rate_small": 0.03,
  // ... (economy-designer가 결정하고 유지하는 키-값 맵)

  // 연구 노드 비용
  "cost.A1": 10,
  "cost.A2": 25,
  // ...

  // 연구 노드 효과 수치
  "effect.A1.mult": 1.15,
  "effect.A3.cascade_coeff": 0.01,
  // ...

  // 도감 완성도 파라미터 (economy.md §7.1 확정)
  "codex.completion_denominator": 76,
  "codex.holographic_coeff": 0.35,
  "codex.holographic_cap": 0.35,

  // 오프라인 파라미터 (economy.md §3 확정)
  "offline.cap_h": 24,
  "offline.modifier": 0.65,
  "offline.tamper_clamp_h": 48
}
```

**콘텐츠 파일(`particles/*.json`, `research/*.json`)이 할 수 있는 것:**
- `bonus_ref: "bonus.t1_cost_discount"` — economy_params의 키를 *참조*하는 것
- 보너스의 *종류*(어떤 자원·메커니즘에 영향)를 `unlock_bonus_type`으로 서술

**콘텐츠 파일이 절대 하지 않는 것:**
- 수치를 직접 하드코딩. 예: `"bonus": 0.15` — 이렇게 쓰면 빌드 검증 FAIL
- economy 검증 없이 배율에 영향하는 새 필드 추가

**요약표:**

| 결정 사항 | 소유자 | 위치 |
|---|---|---|
| 입자 어떤 보너스를 주는가 (종류) | content-designer | `particles/*.json` |
| 그 보너스의 수치가 얼마인가 | economy-designer | `economy_params.json` |
| 연구 노드 어떤 효과인가 (종류) | content-designer | `research/*.json` |
| 그 효과의 수치가 얼마인가 | economy-designer | `economy_params.json` |
| 해금 조건 (무슨 상태에서 해금) | content-designer | `particles/*.json`, `research/*.json` |
| 층 정의 (스케일·decade) | content-designer + systems | `layers/layer_definitions.json` |
| production_mult 경계 | economy-designer | economy.md §7 + `economy_params.json` |

---

## 2. 콘텐츠 저작 워크플로

### 2-A. 새 입자 추가 단계 (디자이너 코드 없이)

아래 4단계는 game-programmer의 코드를 건드리지 않는다.

```
[1. 물리 데이터 확인 — content-designer]
    실제 입자: 공식 PDG (Particle Data Group) 값 참조
      - mass_eV, charge, spin 세 값은 PDG 기준으로만 기재
      - scale_m은 해당 입자의 대표 크기 (상호작용 반경 또는 측정 상한)
    상상 입자: codex.md §1 내부 논리 체계(프리온 위상, 끈 진동수 등)에 따름
      - 실제 이론(끈이론·루프양자중력·홀로그래픽 원리)의 용어 차용 OK
      - 내부 설정 체계에 어긋나면 REJECT (예: 프리온층 입자에 스핀 네트워크 속성 부여 불가)

[2. 스키마 채우기 — content-designer]
    해당 층 JSON 파일에 엔트리 추가
      - id: 전체 고유 확인 (_index.json 조회)
      - locale_key: "particle.{id}" 형식으로 자동
      - bonus_ref: economy_params.json 기존 키 중 선택 또는 economy와 협의 후 신규 키 요청
      - content_pass, focus_layer: 해당 컷 기준 표기
      - discoverable: LEGENDARY면 false, 나머지 true
      - flavor_brief: narrative에게 전달할 방향 한 줄

[3. 체인 업데이트 — 각 담당자 순서대로]

    economy-designer:
      - economy_params.json에 bonus_ref 키·수치 추가
      - production_mult 경계 검증 (가드레일 체크 — economy.md §7.2.3)
      - 필요하면 밸런스 시뮬 재실행

    narrative-designer:
      - flavor_brief를 받아 최종 플레이버 텍스트 작성
      - ko.json에 particle.{id}.name, particle.{id}.flavor 키 추가
      - 보이스 체크 (냉정하되 발견 앞 경이 — narrative.md §2)

    localization(번역):
      - ko.json 확정 후 en.json에 영어 추가
      - 물리 용어: localization-plan §4-A 용어집 준수
      - 상상 입자: §4-C 고유 이름 표기 준수

[4. 검증 — content-designer + qa-balancer]
    §4 검증 체계 실행 (데이터 무결성 → 밸런스 → 현지화 키)
    PASS 후 PR 머지
```

### 2-B. 새 연구 노드 추가 단계

```
[1. 효과 설계 — content-designer + systems-designer]
    effect_type: 어떤 메커니즘·자원에 영향하는지 명시
    production_mult 상수곱 여부 확인
      → 상수곱이면 economy §3.4 30% 가드레일 위험 → economy와 반드시 협의
      → C안(체인 내부/조건부/이벤트 트리클)이면 가드레일 밖 → content가 단독 추가 가능

[2. 선행조건·게이팅 — content-designer]
    prerequisites: 기존 노드 ID 목록에서 선택 (_index.json 검증)
    gate_layer: 1~11 층 번호
    gate_condition: 텍스트 조건 (게임 로직이 파싱)
    milestone_warning: economy.md §2.3 마일스톤 경고 해당 여부 표기

[3. 비용·효과 수치 — economy-designer]
    cost_D → economy_params.json 키 추가
    effect_value → economy_params.json 키 추가 + 밸런스 검증
    "2회차 즉시 재구매 ≥5노드" 체크 (GDD §13)

[4. 텍스트·검증]
    narrative: research.{id}.name, research.{id}.tooltip ko.json 추가
    localization: en.json 추가
    §4 검증 실행
```

### 2-C. economy→content→narrative→localization 체인 순서

이 순서는 의존 방향이다. 역방향 수정은 체인 전체를 다시 돌린다.

```
┌──────────────┐
│   economy    │  파라미터 수치 확정 (economy_params.json)
└──────┬───────┘
       │ bonus_ref 키 공급
┌──────▼───────┐
│   content    │  스키마 완성 (particles/*.json, research/*.json)
└──────┬───────┘
       │ flavor_brief, locale_key 공급
┌──────▼───────┐
│   narrative  │  플레이버 텍스트 작성 (ko.json 키 채움)
└──────┬───────┘
       │ ko.json 확정
┌──────▼───────┐
│ localization │  영어 번역 (en.json 채움)
└──────────────┘
```

**역방향 수정 규칙:**
- narrative가 입자의 `scale_m`을 수정하고 싶으면 content 단계로 돌아가야 한다 (물리 데이터는 content 소관).
- economy가 `bonus_ref` 키를 삭제하면 content 파일의 참조가 끊긴다 → §4-A 무결성 검사가 잡아낸다.
- content가 `locale_key`를 바꾸면 ko.json·en.json의 해당 키가 orphan이 된다 → §4-C 검사가 잡아낸다.

---

## 3. 업데이트 콘텐츠 추가 — 라이브 파이프라인

scope-mvp §5 C1: 재하강 심화 콘텐츠 (~18입자 + ~12노드)는 출시 후 추가된다. 이 섹션은 그 라이브 콘텐츠 추가의 안전한 절차를 정의한다.

### 3-A. 세이브 호환 — 신규 입자가 기존 세이브에 안전한 이유

tech-architecture §1.3의 세이브 마이그레이션 전략과 §1.1의 집합 기반 저장이 이 안전을 보장한다.

**왜 안전한가:**

| 원칙 | 설명 |
|---|---|
| 집합 기반 저장 | 세이브의 `codex` 네임스페이스는 "발견된 ID의 집합"이다. 87개 boolean 배열이 아니다. 신규 입자 ID는 집합에 없으면 그냥 "미발견"이다. |
| 누락 필드 = 기본값 | tech-architecture §1.3: 새 기능 추가로 필드가 늘면 `validate` 단계에서 기본값 주입. 버전 올릴 필요 없음. |
| ID 집합 불변 원칙 | 기존 입자 `id`를 절대 변경하지 않는다. 삭제하지 않는다. 추가만 한다. |

**추가 시 세이브 호환 체크리스트:**

```
[ ] 신규 입자 id가 기존 _index.json에 없음 (중복 없음)
[ ] 신규 입자 id가 이미 배포된 버전의 세이브에 등장하지 않음
[ ] 기존 입자의 id, layer, discoverable 필드 변경 없음
[ ] economy_params.json 신규 키 추가만, 기존 키 삭제/수정 없음
    (기존 키 수정이 필요하면 반드시 버전 마이그레이션 작성)
[ ] tech-architecture §1.3 마이그레이션 함수 검토:
    - 수치 단위 변경이 없으면 마이그레이션 불필요
    - 키 이름 변경, 구조 변경이 있으면 migrate_vN_to_vN+1 함수 작성
```

**금지 행위 (세이브 깨짐 유발):**

```
❌ 기존 입자 id 변경   (예: "up_quark" → "quark_up")
❌ 기존 입자 layer 변경 (층 이동)
❌ economy_params.json 기존 키 삭제 (참조 끊김)
❌ 기존 연구 노드 id 변경
❌ discoverable 필드를 false→true로 변경 (분모 76 변동)
```

### 3-B. 버전 게이팅 — 언제 해금하는가

라이브 콘텐츠는 클라이언트 버전 코드로 게이팅한다.

```jsonc
// 입자 스키마 추가 필드 (라이브 콘텐츠)
{
  "version_added": "v1.1-c1",    // 어느 빌드 버전부터 활성
  "content_pass": "c1",          // 어느 콘텐츠 패스에 속하는가
  "focus_layer": 6               // 재하강 심화: 어느 집중 서브층 소속
}
```

게임 로직 흐름:

```
로드 시:
  particle 데이터 로드
  → version_added > CURRENT_VERSION인 입자는 UI 목록에서 숨김
  → 발견 판정 대상에서도 제외 (discoverable이어도 버전 미달이면 미발견 처리)

업데이트 배포 후:
  CURRENT_VERSION 갱신
  → 신규 입자가 자동으로 발견 가능 상태로 전환
  → 기존 세이브에 seamless 추가 (위 §3-A 보장)
```

**집중 서브층 심화 콘텐츠 (scope-mvp C1) 해금 로직:**

```
재하강 회차 시작 시:
  집중 서브층 선택 (6개 중 1개 — systems §2-K)
  → 선택된 focus_layer와 일치하는 c1 입자·노드만 해당 회차에 해금
  → 다른 focus_layer의 c1 콘텐츠는 비선택 회차에서 숨김
```

이 구조는 심화 콘텐츠 18입자가 한 회차에 전부 노출되지 않고, 집중 서브층마다 2~3개씩 순차 공개되도록 한다.

### 3-C. 밸런스 재검증 — 신규 콘텐츠 추가 시

새 입자·노드는 경제 수치에 영향한다. 추가 후 반드시 qa-balancer를 통과해야 한다.

**재검증 트리거 조건:**

| 추가 유형 | 재검증 필요 여부 | 검증 범위 |
|---|---|---|
| COMMON/UNCOMMON 입자 추가 | 선택적 | 해당 층 도감 완성도 곡선만 확인 |
| RARE/EPIC 입자 추가 | 필수 | 도감 보너스 기여 + production_mult 경계 |
| LEGENDARY 입자 추가 | 필수 | discoverable 분모 변경 없음 확인 + holographic_mult 상한 체크 |
| 연구 노드 추가 (C안 효과) | 선택적 | 해당 가지 depth 내 비용 곡선 확인 |
| 연구 노드 추가 (production_mult 직접) | 필수 | economy.md §7.2 30% 가드레일 재시뮬 |
| 집중 서브층 심화 콘텐츠 (c1) | 필수 | 재하강 페이싱 재검증 (redescent_diff.py 기반) |

**qa-balancer 재검증 체크리스트 (라이브 콘텐츠):**

```
[ ] holographic_mult 상한 ≤ ×1.35 유지 (economy.md §7.1)
[ ] 신규 보너스 포함 후 dec26 벽 도달 시간 변화 ≤ ±20% (가드레일)
[ ] 집중 서브층 체류 시간 ≥ 4h 유지 (economy.md §1.2a)
[ ] D_total magnitude 변화: holo_factor=0.008 가정 범위 내 확인
[ ] 2회차 즉시 재구매 ≥5노드 기준 충족 (GDD §13)
[ ] production_mult 경계: research_mult ≈ 1.0 (C안 채택 노드) 유지
```

---

## 4. 콘텐츠 검증 체계

### 4-A. 데이터 무결성 검사

**빌드 타임 또는 CI에서 실행 (코드리뷰 게이트):**

```
[검사 1] ID 고유성
  _index.json의 모든 particle id가 전체 particles/*.json에 걸쳐 고유한지 확인
  _index.json의 모든 node id가 전체 research/*.json에 걸쳐 고유한지 확인

[검사 2] 필수 필드 누락
  모든 입자 엔트리에 §1-B 스키마 필수 필드 존재 확인:
    id, name, name_ko, layer, decade, real, charge, spin, rarity,
    unlock_condition, discoverable, locale_key, version_added, content_pass

[검사 3] bonus_ref 유효성
  bonus_ref 값이 null이거나 economy_params.json에 존재하는 키인지 확인
  economy_params.json에 없는 키를 참조하면 FAIL

[검사 4] 연구 노드 선행조건
  prerequisites 배열의 모든 node_id가 _index.json에 존재하는지 확인
  순환 선행조건 없는지 위상 정렬 검사

[검사 5] discoverable 분모
  discoverable: true인 입자 수 = 76 (v1.0 기준) 또는 추가된 c1 입자 포함 시 업데이트 수
  LEGENDARY 11개가 모두 discoverable: false인지 확인

[검사 6] 실제 입자 물리 필드 범위
  real: true 입자의 charge 값이 PDG 허용 범위 내 (−2 ~ +2 e)
  spin 값이 0, 0.5, 1, 1.5, 2 중 하나
  mass_eV가 null이 아닌 경우 숫자 파싱 가능한 문자열인지 확인

[검사 7] locale_key 형식
  locale_key === "particle." + id (입자)
  locale_key === "research." + id (노드)
  형식이 어긋나면 FAIL

[검사 8] content_pass·focus_layer 정합
  content_pass === "c1"인 입자는 focus_layer가 null이 아님
  content_pass === "mvp"인 입자는 focus_layer === null
```

### 4-B. 밸런스 검사 (economy/qa-balancer 주도)

content-designer가 트리거하고 economy-designer가 확정한다.

```
[검사 B1] 도감 완성도 보너스 궤적
  신규 입자 추가 후 holographic_mult = 0.35 × (collected/76)² 계산
  완주 시 상한 ≤ 0.35 확인 (codex.md §0 확정)
  → FAIL 조건: 분모 76이 변경되거나 LEGENDARY 분류 변경으로 상한 초과

[검사 B2] 연구 노드 비용 곡선
  신규 노드 cost_D가 economy_params.json에 등록됐는지 확인
  가지 내 depth별 비용 단조 증가 확인 (얕은 노드가 더 비싸지면 WARN)

[검사 B3] production_mult 경계 (production_mult 직접 영향 노드만)
  A13·B8·B12는 C안(체인 내부/조건부/이벤트 트리클) 유지 확인
  overlap_cap_note가 null이 아닌 노드의 실효 배율이 ×1.30 미만인지 확인

[검사 B4] 집중 서브층 심화 입자 페이싱 (c1 추가 시)
  focus_layer별 심화 입자 수 2~3개 이내 확인
  focus_layer별 심화 연구 노드 수 2개 이내 확인 (GDD §9 "~18입자+~12노드" 총량 내)
```

### 4-C. 현지화 키 누락 검사

**localization-plan §1-B 기준:**

```
[검사 C1] ko.json 완전성
  모든 입자 locale_key에 대응하는 ko.json 키 존재 확인:
    particle.{id}.name
    particle.{id}.flavor
  모든 연구 노드 locale_key에 대응하는 ko.json 키 존재 확인:
    research.{id}.name
    research.{id}.tooltip

[검사 C2] en.json 완전성 (v1.0 이후 필수)
  수직 슬라이스 단계: VS 범위 입자·노드만 en.json 확인
  v1.0 이전: 전체 확인

[검사 C3] 고아 키 탐지
  ko.json에 있는 particle.* 키 중 _index.json에 id가 없는 것
  → 삭제된 입자의 잔류 번역 키. WARN 처리 (즉시 삭제 또는 보관)

[검사 C4] 용어집 일관성 (자동화 어려움 — 수동 감수)
  실제 입자 영어 이름이 localization-plan §4-A 용어집과 일치하는지
  상상 입자 영어 이름이 §4-C와 일치하는지
  UI 카피가 §4-D와 일치하는지
```

---

## 5. 콘텐츠 버전 관리·데이터 마이그레이션

### 5-A. 콘텐츠 버전과 세이브 버전의 관계

| 변경 유형 | 세이브 버전 올림 필요 | 마이그레이션 함수 필요 | 비고 |
|---|---|---|---|
| 신규 입자 추가 (id 신규) | 없음 | 없음 | §3-A: 집합 기반 저장이 자동 흡수 |
| 신규 연구 노드 추가 (id 신규) | 없음 | 없음 | 동일 |
| 기존 입자 flavor_brief 수정 | 없음 | 없음 | 플레이버는 저장 안 함 |
| 기존 입자 unlock_condition 수정 | 없음 | 없음 | 조건만 바뀜, 발견 여부 보존 |
| 기존 입자 unlock_bonus_type 변경 | 없음 | 없음 | 보너스는 재계산 파생값 |
| economy_params.json 수치 수정 | 없음 | 없음 | 파생 캐시 무효화만 |
| 기존 입자 id 변경 | 필수 | 필수 (id 매핑 재지정) | 절대 금지 원칙 — 하지 않는다 |
| discoverable: true→false | 필수 | 필수 (completion 재계산) | 분모 변경 — 하지 않는다 |
| economy_params.json 기존 키 삭제 | 필수 | 필수 (참조 수정) | 연쇄 영향 검토 필수 |
| Decimal 직렬화 포맷 변경 | 필수 | 필수 (수치 재파싱) | tech-architecture §1.3 |

### 5-B. 마이그레이션 함수 작성 규칙 (tech-architecture §1.3 준수)

```
// 규칙 1: 단방향 체인. migrate_v1_to_v2, migrate_v2_to_v3 ... 순차 적용
// 규칙 2: 한 번 작성한 마이그레이션 함수는 영원히 보존 (삭제 금지)
// 규칙 3: 마이그레이션 실패 시 원본을 .corrupt.bak으로 보존하고 사용자에게 알림
// 규칙 4: 콘텐츠 변경으로 마이그레이션이 필요한 경우 content-designer가 함수 초안 작성
//         tech-architect가 검토 후 확정
```

### 5-C. 데이터 파일 자체의 버전 관리

`data/` 디렉토리는 게임 소스코드 저장소에 포함된다. 모든 변경은 git으로 추적된다.

```
커밋 컨벤션:
  feat(content): add {입자 수}개 입자 - L{층}
  feat(content): add research node {id}
  fix(content): correct mass_eV for {id}
  fix(locale): add missing ko.json keys for {id}
  chore(economy): update economy_params.json {키 목록}

PR 요구사항:
  [ ] §4 검증 체계 통과 (CI 자동화)
  [ ] content-designer 리뷰
  [ ] economy-designer 리뷰 (bonus_ref·cost 변경 시)
  [ ] narrative-designer 리뷰 (flavor_brief 변경 시)
  [ ] qa-balancer 승인 (밸런스 영향 변경 시)
```

---

## 6. 단계별 콘텐츠 로드맵

scope-mvp §6 4단계 게이트와 콘텐츠 파이프라인 연결.

| 단계 | 입자 | 연구 노드 | 파이프라인 작업 |
|---|---|---|---|
| **프로토타입** | ~20개 (L1~L2 전체 + L5 핵심 + L6 프리온 일부) | A 가지 일부 (A1~A4) | `data/` 구조 초기 설정, 스키마 확정, economy_params.json 초안, ko.json 키 체계 구축 |
| **수직 슬라이스** | ~30개 (L1~L2 전체 + L6 전체 + L5 나머지) | A+C 가지 (24노드) | VS 범위 locale_key en.json 첫 번역 발주, §4 자동화 CI 연결 |
| **v1.0** | 87개 전체 | 52노드 핵심 | 전체 ko.json 완성, en.json 2차 번역, content_pass="mvp" 전부, §4 검증 전체 통과 |
| **출시 후 C1** | +18개 (집중 서브층 심화) | +12노드 (D가지 확장) | content_pass="c1" 파일 추가, 세이브 호환 체크, 밸런스 재검증, en.json 추가 번역 |

---

## 7. 담당 경계 요약

| 작업 | 주도 | 협의 | 도구·파일 |
|---|---|---|---|
| 입자 스키마 설계·채우기 | content-designer | systems (상상 입자 내부 논리) | `particles/*.json`, `_index.json` |
| 연구 노드 설계·채우기 | content-designer | systems (효과 유형), economy (production_mult 경계) | `research/*.json`, `_index.json` |
| 경제 수치 | economy-designer | content (어떤 보너스인가) | `economy_params.json` |
| 플레이버 텍스트 | narrative-designer | content (flavor_brief 방향) | `data/locale/ko.json` |
| 영어 번역 | 외부 번역가 + narrative 감수 | localization-plan §3 | `data/locale/en.json` |
| 데이터 무결성 검사 | content-designer (CI 구성) | tech-architect | `§4-A` 자동화 스크립트 |
| 밸런스 검사 | economy-designer + qa-balancer | content | `§4-B`, economy sim 스크립트 |
| 현지화 키 검사 | narrative-designer | content, localization | `§4-C` 자동화 스크립트 |
| 세이브 마이그레이션 | content-designer (초안) + tech-architect (확정) | — | `src/core/save/` 마이그레이션 함수 |

---

## 8. 관련 문서

- `codex.md` §1 — 입자 엔트리 기본 스키마 (본 문서 §1-B의 base)
- `research-tree.md` §1 — 연구 노드 기본 스키마 (본 문서 §1-C의 base)
- `tech-architecture.md` §4.4 — `data/` 텍스트·데이터 분리 원칙 / §1.3 세이브 마이그레이션
- `economy.md` §7 — 수치 가드레일 (holographic_mult, production_mult 경계)
- `scope-mvp.md` §4·§5 — v1.0 IN / 출시 후 컷 (content_pass 분류 기준)
- `localization-plan.md` §1 i18n 구조, §4 용어집 — locale_key 체계, 번역 품질 기준
- `systems.md` §2 — 층별 메커니즘 (상상 입자 내부 논리의 소스)
- `narrative.md` §2 — 보이스 바이블 (플레이버 텍스트 작성 기준)

---

*본 문서는 "어떻게 콘텐츠를 데이터로 관리하고, 누가 무엇을 소유하며, 라이브에서 어떻게 안전하게 늘리는가"를 정의한다. 콘텐츠 추가는 코드 없이 데이터 파일만으로 완결되며, 모든 변경은 §4 검증 → PR → 배포 체인을 통과한다.*
