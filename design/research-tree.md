# 연구 트리 (Research Tree) — 노드 데이터 v0.1

- 작성: content-designer
- 기준: systems.md §3 (4대 가지 구조) / economy.md §5.3 / GDD §10
- 상태: 토폴로지·효과·선행조건 확정 / 비용 수치 = [ECONOMY] / 플레이버 = [FLAVOR]
- 작성일: 2026-06-25

---

<!-- [지시 3 — 표기 정합]
  연구 트리의 gate_layer·gate_condition은 서사 층 번호(L1~L11)를 사용한다.
  이는 서사 스케일 레이어이며, 실제 게임플레이 상전이 장벽(압축 벽)은 economy 벽 스케줄을 따른다(dec19~26 대역).
  "첫 상전이 완료" 조건(C 가지 해금 등)은 economy 기준 dec19 벽 돌파(4.3h 앵커)를 가리킨다.
  출처: director-review.md §2.1·§2.5·[지시 3-1]
-->

## 0. 개요

| 가지 | 코드 | 노드 수 | 목적 |
|---|---|---|---|
| A. 체인 증폭 | CHAIN | 14 | 8단 체인 기본 배율 직접 강화 |
| B. 시너지 엔진 | SYNERGY | 12 | 층별 메커니즘 간 상호작용 강화 |
| C. 자동화 확장 | AUTO | 10 | 방치 효율 + 새 메커니즘 자동화 |
| D. 위상 심화 | PHASE | 16 | 각 층 메커니즘 심화·변형 |
| **합계** | | **52** | |

**트리 구조 요약:**
```
[연구 트리 루트]
      │
      ├── A. CHAIN (14노드) — 원자층 진입 시 자동 해금
      ├── B. SYNERGY (12노드) — 핵층 진입 + D 누적 시 해금
      ├── C. AUTO (10노드) — 첫 상전이 완료 시 해금
      └── D. PHASE (16노드) — 층 진입마다 1~2개 자동 추가
```

---

## 1. 노드 스키마

```jsonc
{
  "id": "string",                 // 코드 식별자
  "branch": "CHAIN|SYNERGY|AUTO|PHASE",
  "name": "string",
  "name_ko": "string",
  "depth": number,                // 가지 내 깊이 (1 = 루트 바로 아래)
  "effect_type": "string",        // 효과 종류 (구체적 메커니즘·자원·티어 명시)
  "effect_value": "[ECONOMY]",    // 수치 (economy-designer 위임)
  "prerequisites": ["node_id"],   // 선행 노드 (빈 배열 = 가지 루트)
  "gate_layer": number,           // 최소 층 번호 (1~11)
  "gate_condition": "string",     // 추가 조건 (층 진입 외)
  "cost_D": "[ECONOMY]",          // D 비용
  "milestone_warning": boolean,   // economy.md §2.3 마일스톤 경고 해당 여부
  "flavor_brief": "string"        // 플레이버 방향
}
```

---

## 2. A. 체인 증폭 Branch (CHAIN)

**목적:** 8단 체인의 티어별 배율, 연속 강화, 로그 저항 감소.
**해금:** 원자층(L2) 진입 즉시 자동 해금.

### 트리 토폴로지

```
CHAIN_ROOT (L2 자동해금)
│
├── A1: T1 강화 (depth 1)
│   ├── A3: T1·T2 연속 강화 (depth 2)
│   │   └── A7: 하위 체인 시너지 (depth 3)
│   │       └── A12: 체인 공명 (depth 4) ──────── [EPIC]
│   └── A4: T2 강화 (depth 2)
│       └── A8: T2·T3 연속 강화 (depth 3)
│
├── A2: T5-T8 고위 강화 (depth 1, L3 게이팅)
│   ├── A5: T7 강화 (depth 2)
│   │   └── A9: 고위 체인 시너지 (depth 3)
│   │       └── A13: 전체 티어 연쇄 (depth 4) ── [EPIC]
│   └── A6: T8 강화 (depth 2)
│       └── A10: 상위-하위 연결 (depth 3)
│
├── A11: 로그 저항 감소 α-1 (depth 2, L5 쿼크층 게이팅)
│   └── A14: 로그 저항 감소 α-2 (depth 3)
│
└── 마일스톤: A_MILE_1 (depth 1) ⚠️ 마일스톤 경고
```

### 노드 데이터

```json
[
  {
    "id": "A1",
    "branch": "CHAIN",
    "name": "T1 Amplifier",
    "name_ko": "T1 증폭기",
    "depth": 1,
    "effect_type": "Tier-1 압축기 생산 배율 × [ECONOMY]",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 2,
    "gate_condition": "원자층 진입 (자동 해금)",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "체인의 기초를 강화한다. 첫 번째 단이 강해질수록 모든 것이 강해진다."
  },
  {
    "id": "A2",
    "branch": "CHAIN",
    "name": "High-Tier Amplifier",
    "name_ko": "고위 티어 증폭",
    "depth": 1,
    "effect_type": "Tier-5~8 압축기 생산 배율 × [ECONOMY] (4개 티어 동시)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 3,
    "gate_condition": "핵층(L3) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "체인의 정점을 밀어올린다. 높은 곳이 강해지면 아래도 따라온다."
  },
  {
    "id": "A3",
    "branch": "CHAIN",
    "name": "T1-T2 Cascade",
    "name_ko": "T1-T2 연속 강화",
    "depth": 2,
    "effect_type": "T1 보유 수에 비례하여 T2 생산 배율 추가 상승 (연속 강화 공식: T2_mult += T1_count × [ECONOMY])",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A1"],
    "gate_layer": 2,
    "gate_condition": "A1 구매 후 T1 압축기 [ECONOMY]개 이상 보유",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "아래가 쌓이면 위가 더 빨리 돌아간다."
  },
  {
    "id": "A4",
    "branch": "CHAIN",
    "name": "T2 Amplifier",
    "name_ko": "T2 증폭기",
    "depth": 2,
    "effect_type": "Tier-2 압축기 생산 배율 × [ECONOMY]",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A1"],
    "gate_layer": 2,
    "gate_condition": "A1 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "두 번째 단. 체인의 무게 중심이 바뀌기 시작한다."
  },
  {
    "id": "A5",
    "branch": "CHAIN",
    "name": "T7 Amplifier",
    "name_ko": "T7 증폭기",
    "depth": 2,
    "effect_type": "Tier-7 압축기 생산 배율 × [ECONOMY]",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A2"],
    "gate_layer": 3,
    "gate_condition": "A2 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "가장 희귀한 티어. 한 번의 구매가 전체 체인을 뒤흔든다."
  },
  {
    "id": "A6",
    "branch": "CHAIN",
    "name": "T8 Amplifier",
    "name_ko": "T8 증폭기",
    "depth": 2,
    "effect_type": "Tier-8 압축기 생산 배율 × [ECONOMY]",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A2"],
    "gate_layer": 4,
    "gate_condition": "A2 구매 + 핵자층(L4) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "최상단 압축기. 이것 하나가 하위 7단을 먹여 살린다."
  },
  {
    "id": "A7",
    "branch": "CHAIN",
    "name": "Lower Chain Synergy",
    "name_ko": "하위 체인 시너지",
    "depth": 3,
    "effect_type": "T1-T4 각 티어의 생산이 합산될 때 추가 배율 (체인 공식: sum_lower × [ECONOMY] 추가 C로 전환)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A3"],
    "gate_layer": 2,
    "gate_condition": "A3 구매 + T1 압축기 [ECONOMY]개 이상",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "낮은 곳이 함께 돌아갈 때 시너지가 터진다."
  },
  {
    "id": "A8",
    "branch": "CHAIN",
    "name": "T2-T3 Cascade",
    "name_ko": "T2-T3 연속 강화",
    "depth": 3,
    "effect_type": "T2 보유 수에 비례하여 T3 생산 배율 추가 상승",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A4"],
    "gate_layer": 3,
    "gate_condition": "A4 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "연쇄가 이어진다. T2가 T3를 밀어올리고, T3가 T4를 끌어당긴다."
  },
  {
    "id": "A9",
    "branch": "CHAIN",
    "name": "High Chain Synergy",
    "name_ko": "고위 체인 시너지",
    "depth": 3,
    "effect_type": "T5-T8 각 티어의 생산이 합산될 때 추가 배율",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A5"],
    "gate_layer": 4,
    "gate_condition": "A5 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "정점이 맞물릴 때 진짜 폭발이 일어난다."
  },
  {
    "id": "A10",
    "branch": "CHAIN",
    "name": "Top-Bottom Link",
    "name_ko": "상위-하위 연결",
    "depth": 3,
    "effect_type": "T8 생산량이 T1 생산에 [ECONOMY]% 추가 기여 (역방향 연결 — 꼭대기가 바닥을 먹인다)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A6"],
    "gate_layer": 5,
    "gate_condition": "A6 구매 + 쿼크층(L5) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "가장 작은 것과 가장 큰 것이 연결된다. 체인이 순환한다."
  },
  {
    "id": "A11",
    "branch": "CHAIN",
    "name": "Alpha Reduction I",
    "name_ko": "로그 저항 감소 I",
    "depth": 2,
    "effect_type": "GDD §7 로그 계수 α를 영구 감소 (α = 0.65 → α − [ECONOMY]). r 감소 속도 항구적으로 빨라짐",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 5,
    "gate_condition": "쿼크층(L5) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "압축 저항의 근원을 건드린다. 작아지기가 조금 덜 힘들어진다."
  },
  {
    "id": "A12",
    "branch": "CHAIN",
    "name": "Chain Resonance",
    "name_ko": "체인 공명",
    "depth": 4,
    "effect_type": "8단 체인 전체가 매 [ECONOMY]초마다 짧은 공명 상태 진입 — 공명 중 전 티어 생산 × [ECONOMY] (systems §2-A 공명 메커니즘과 별개의 체인 자체 공명)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A7"],
    "gate_layer": 5,
    "gate_condition": "A7 구매 + A3 구매 + 쿼크층(L5) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "체인 전체가 동기화될 때, 생산의 물결이 동시에 쏟아진다."
  },
  {
    "id": "A13",
    "branch": "CHAIN",
    "name": "Full-Chain Cascade",
    "name_ko": "전체 티어 연쇄",
    "depth": 4,
    "effect_type": "모든 티어 연속 강화 활성화 — Tk 보유 수에 비례하여 Tk+1 배율 추가 (T1→T8 전체 적용, 각 티어 계수 [ECONOMY])",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A9"],
    "gate_layer": 6,
    "gate_condition": "A9 구매 + A5 구매 + 프리온층(L6) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "overlap_cap_note": "중첩 상한 = economy 후속 패스 확정 대기. A13+B8+B12+도감(×1.5)+QF부스트(×3) 동시 곱 시 dec26 벽 30% 미만 단축 유지 여부 재시뮬 필요. [director-review §3.4]",
    "flavor_brief": "연쇄가 완성됐다. 모든 티어가 서로를 먹여 살린다."
  },
  {
    "id": "A14",
    "branch": "CHAIN",
    "name": "Alpha Reduction II",
    "name_ko": "로그 저항 감소 II",
    "depth": 3,
    "effect_type": "α를 추가 감소 (A11의 감소폭 × [ECONOMY]배 추가)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["A11"],
    "gate_layer": 7,
    "gate_condition": "A11 구매 + 끈층(L7) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "저항이 한 겹 더 벗겨진다. 작아짐이 강해짐으로 수렴한다."
  }
]
```

> ⚠️ **마일스톤 경고 (economy.md §2.3):** A 가지에는 의도적으로 강한 마일스톤 배율 노드를 포함하지 않았다. "25/50/100/200개 → ×2/×3/×5/×7" 형태의 마일스톤은 dec26 벽을 붕괴시킴. 마일스톤을 쓸 경우 ×1.1@50 수준의 플레이버 보너스로 제한하거나 벽 스케줄을 +1~2 decade 상향 보정해야 함. economy-designer 협의 필수.

---

## 3. B. 시너지 엔진 Branch (SYNERGY)

**목적:** 층별 메커니즘끼리의 상호작용 강화. 여러 시스템이 동시에 돌아갈 때 보상.
**해금:** 핵층(L3) 진입 + D 누적 [ECONOMY] 도달.

### 트리 토폴로지

```
SYNERGY_ROOT (L3 + D 누적 시 해금)
│
├── B1: 공명-핵력 시너지 (depth 1, L3)
│   ├── B4: 공명-색전하 연결 (depth 2, L4)
│   │   └── B8: 3중 메커니즘 시너지 (depth 3, L5) ── [EPIC]
│   └── B5: 공명 D 증폭 (depth 2, L3)
│
├── B2: 색전하-하모닉 연결 (depth 1, L7)
│   ├── B6: 위상-하모닉 공명 (depth 2, L7)
│   │   └── B9: 하모닉-스핀 연결 (depth 3, L8)
│   └── B7: 하모닉 V 가속 (depth 2, L7)
│
├── B3: 위상-요동 안정화 (depth 1, L9)
│   ├── B10: 요동-홀로그래픽 연결 (depth 2, L10)
│   │   └── B12: 완전 시너지 (depth 3, L10) ────── [LEGENDARY]
│   └── B11: 응집-QF 트리클 (depth 2, L9)
│
└── SYNERGY 공통: 홀로그래픽 증폭 (B_HOLO, depth 2, L10)
    → 도감 항목 수에 따라 모든 시너지 효과 추가 배율
```

### 노드 데이터

```json
[
  {
    "id": "B1",
    "branch": "SYNERGY",
    "name": "Resonance-Nuclear Synergy",
    "name_ko": "공명-핵력 시너지",
    "depth": 1,
    "effect_type": "오비탈 공명(§2-A) 발동 시 핵력 게이지(§2-B) 추가 충전 [ECONOMY]% — 두 메커니즘이 연결됨",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 3,
    "gate_condition": "핵층(L3) 진입 + D 누적 [ECONOMY]",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "전자가 껍질을 바꿀 때, 핵도 반응한다."
  },
  {
    "id": "B2",
    "branch": "SYNERGY",
    "name": "Color-Harmonic Link",
    "name_ko": "색전하-하모닉 연결",
    "depth": 1,
    "effect_type": "삼원합일(§2-C) 완성 시 진동 에너지 V(§2-F) 추가 충전 [ECONOMY] — 색 균형이 끈을 진동시킴",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 7,
    "gate_condition": "끈층(L7) 진입 + D 누적 [ECONOMY]",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "색전하의 완벽한 균형이 끈의 진동을 촉발한다."
  },
  {
    "id": "B3",
    "branch": "SYNERGY",
    "name": "Phase-Fluctuation Stabilizer",
    "name_ko": "위상-요동 안정화",
    "depth": 1,
    "effect_type": "응집(Coherent) 위상 상태(§2-E)에서 불확정 요동(§2-H) 하한 상승 [ECONOMY]% — 안정된 위상이 거품을 억제",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 9,
    "gate_condition": "거품층(L9) 진입 + D 누적 [ECONOMY]",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "응집된 위상이 양자 거품의 난동을 억제한다."
  },
  {
    "id": "B4",
    "branch": "SYNERGY",
    "name": "Resonance-Color Bridge",
    "name_ko": "공명-색전하 연결",
    "depth": 2,
    "effect_type": "오비탈 공명 배율이 삼원합일 균형 비율에 추가 곱해짐 (balance_ratio가 높을수록 공명 배율 증가)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["B1"],
    "gate_layer": 4,
    "gate_condition": "B1 구매 + 핵자층(L4) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "원자 껍질의 진동이 쿼크의 색을 균형 잡는 데 도움을 준다."
  },
  {
    "id": "B5",
    "branch": "SYNERGY",
    "name": "Resonance D Amplifier",
    "name_ko": "공명 D 증폭",
    "depth": 2,
    "effect_type": "오비탈 공명 클릭 성공 시 D 획득량 × [ECONOMY] (공명 = 발견의 가속기)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["B1"],
    "gate_layer": 3,
    "gate_condition": "B1 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "공명 성공이 연구 데이터를 쏟아낸다."
  },
  {
    "id": "B6",
    "branch": "SYNERGY",
    "name": "Phase-Harmonic Resonance",
    "name_ko": "위상-하모닉 공명",
    "depth": 2,
    "effect_type": "공명(Resonant) 위상 상태에서 하모닉 공명 발동 시 V 충전 속도 × [ECONOMY]",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["B2"],
    "gate_layer": 7,
    "gate_condition": "B2 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "두 종류의 공명이 같은 주파수로 만날 때."
  },
  {
    "id": "B7",
    "branch": "SYNERGY",
    "name": "Harmonic V Accelerator",
    "name_ko": "하모닉 V 가속",
    "depth": 2,
    "effect_type": "하모닉 공명(§2-F) 발동 직후 [ECONOMY]초간 V 충전 속도 × [ECONOMY] (공명 연쇄 촉진)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["B2"],
    "gate_layer": 7,
    "gate_condition": "B2 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "공명이 다음 공명을 빠르게 부른다."
  },
  {
    "id": "B8",
    "branch": "SYNERGY",
    "name": "Triple Mechanism Synergy",
    "name_ko": "3중 메커니즘 시너지",
    "depth": 3,
    "effect_type": "공명(§2-A) + 핵력 게이지(§2-B) + 삼원합일(§2-C) 세 메커니즘이 동시에 활성 상태일 때 체인 전체 × [ECONOMY] 보너스 (조건: 공명 배율 활성 + 게이지 50% 이상 + 균형 임계값 달성)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["B4"],
    "gate_layer": 5,
    "gate_condition": "B4 구매 + 쿼크층(L5) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "overlap_cap_note": "중첩 상한 = economy 후속 패스 확정 대기. A13+B8+B12+힉스+도감(×1.5) 동시 곱 복리 시뮬 필요. [director-review §3.4]",
    "flavor_brief": "세 힘이 동시에 충족될 때 — 압축 실험실이 폭발한다."
  },
  {
    "id": "B9",
    "branch": "SYNERGY",
    "name": "Harmonic-Spin Link",
    "name_ko": "하모닉-스핀 연결",
    "depth": 3,
    "effect_type": "하모닉 공명(§2-F) 발동 시 스핀 네트워크(§2-G) 노드 자동 에너지 보충 — 스핀 노드 연결 E 비용 [ECONOMY]% 환급",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["B6"],
    "gate_layer": 8,
    "gate_condition": "B6 구매 + 루프층(L8) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "끈의 진동이 시공간 그래프를 재충전한다."
  },
  {
    "id": "B10",
    "branch": "SYNERGY",
    "name": "Fluctuation-Holographic Link",
    "name_ko": "요동-홀로그래픽 연결",
    "depth": 2,
    "effect_type": "요동 이벤트 발생 시 D_total에 [ECONOMY] 추가 기여 — 불확정성이 정보로 전환됨",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["B3"],
    "gate_layer": 10,
    "gate_condition": "B3 구매 + 정보층(L10) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "요동은 노이즈가 아니다. 그것도 정보다."
  },
  {
    "id": "B11",
    "branch": "SYNERGY",
    "name": "Coherent-QF Trickle",
    "name_ko": "응집 QF 트리클",
    "depth": 2,
    "effect_type": "응집(Coherent) 위상 상태 유지 중 QF 트리클 + [ECONOMY]/초 추가",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["B3"],
    "gate_layer": 9,
    "gate_condition": "B3 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "완전한 응집 — 혼돈 없이 쌓이는 힘."
  },
  {
    "id": "B12",
    "branch": "SYNERGY",
    "name": "Universal Synergy",
    "name_ko": "완전 시너지",
    "depth": 3,
    "effect_type": "B 가지 모든 시너지 효과 배율 × [ECONOMY] 추가 (홀로그래픽 완성도 × 모든 시너지 효과) — 조건: 도감 수집 80% 이상",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["B10"],
    "gate_layer": 10,
    "gate_condition": "B10 구매 + 도감 수집 80% 이상",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "overlap_cap_note": "중첩 상한 = economy 후속 패스 확정 대기. B 가지 전체 배율 추가 × A13 전체 연쇄 × 도감(×1.5) 동시 곱 시 base_rate=0.25 race 안전성 재시뮬 필요. [director-review §3.4]",
    "flavor_brief": "모든 메커니즘이 하나로 연결됐을 때, 전체는 부분의 합보다 크다."
  },
  {
    "id": "B_HOLO",
    "branch": "SYNERGY",
    "name": "Holographic Amplification",
    "name_ko": "홀로그래픽 증폭",
    "depth": 2,
    "effect_type": "도감 수집 입자 수에 비례하여 B 가지 모든 시너지 효과 추가 배율 (codex_count × [ECONOMY] 추가 배율 — 수집형 보상)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 10,
    "gate_condition": "정보층(L10) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "overlap_cap_note": "중첩 상한 = economy 후속 패스 확정 대기. codex 완성도 보너스(+0.5× 상한, codex.md §0)와 B_HOLO 시너지 배율의 이중 기여를 합산 시뮬 필요. [director-review §3.2·§3.4]",
    "flavor_brief": "기록한 것들이 살아 돌아온다. 도감은 비어있지 않았다."
  }
]
```

---

## 4. C. 자동화 확장 Branch (AUTO)

**목적:** 방치 효율 향상. 능동 개입 메커니즘을 자동화.
**해금:** 첫 상전이(층 간 이동) 완료 시 해금.
**원칙 (systems §3-2-C):** 수동 30~50회 능동 개입 후 해금. 너무 빠른 자동화는 개입 동기를 제거.

### 트리 토폴로지

```
AUTO_ROOT (첫 상전이 완료 시 해금)
│
├── C1: 오비탈 자동 클릭 (depth 1, L2 + 50회 이상 수동)
│   ├── C3: 자동 클릭 가속 (depth 2)
│   │   └── C7: 공명 슬롯 예측 (depth 3)
│   └── C4: E 비용 자동화 (depth 2)
│
├── C2: 위상 자동 고정 (depth 1, L6)
│   ├── C5: 최적 위상 분석 (depth 2)
│   │   └── C8: 위상 전략 AI (depth 3) ──────── [EPIC]
│   └── C6: 위상 전환 E 절감 (depth 2)
│
├── C9: 네트워크 자동 확장 (depth 1, L8)
│   └── C10: 오프라인 효율 강화 (depth 2)
│
└── AUTO 공통 원칙: 층 진입 후 [ECONOMY]분 이후에만 해금 가능
```

### 노드 데이터

```json
[
  {
    "id": "C1",
    "branch": "AUTO",
    "name": "Auto-Orbital Click",
    "name_ko": "오비탈 자동 클릭",
    "depth": 1,
    "effect_type": "오비탈 공명 슬롯을 자동으로 클릭 (인터벌 [ECONOMY]초 — 수동 클릭 대비 70% 효율 의도)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 2,
    "gate_condition": "원자층(L2) 진입 후 [ECONOMY]분 경과 + 공명 슬롯 수동 클릭 50회 이상 + 첫 상전이 완료",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "손을 놔도 전자는 계속 뛴다. 하지만 직접 누를 때보다는 조금 느리게."
  },
  {
    "id": "C2",
    "branch": "AUTO",
    "name": "Auto Phase Lock",
    "name_ko": "위상 자동 고정",
    "depth": 1,
    "effect_type": "현재 자원 상황에 따라 최적 위상 상태(§2-E)를 자동 선택·고정 (D 부족 시 분산, C 우선 시 응집, QF 축적 시 공명 — 기본 로직)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 6,
    "gate_condition": "프리온층(L6) 진입 후 [ECONOMY]분 경과 + 위상 수동 고정 30회 이상 + 첫 상전이 완료",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "이제 위상이 스스로 최선을 고른다. 당신은 더 깊은 결정에 집중하면 된다."
  },
  {
    "id": "C3",
    "branch": "AUTO",
    "name": "Auto-Click Interval Reduction",
    "name_ko": "자동 클릭 가속",
    "depth": 2,
    "effect_type": "오비탈 자동 클릭 인터벌 [ECONOMY]% 단축 (수동 클릭과의 효율 격차 축소)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["C1"],
    "gate_layer": 2,
    "gate_condition": "C1 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "자동화가 더 빨라진다. 하지만 직접 누르는 것만큼은 아니다."
  },
  {
    "id": "C4",
    "branch": "AUTO",
    "name": "Auto E Optimizer",
    "name_ko": "E 비용 자동 최적화",
    "depth": 2,
    "effect_type": "공명 슬롯 유지 E 비용 자동 절감 [ECONOMY]% (방치 시 E 소모 부담 감소)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["C1"],
    "gate_layer": 3,
    "gate_condition": "C1 구매 + 핵층(L3) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "자동화는 에너지를 아낀다. 적을수록 더 오래 돌아간다."
  },
  {
    "id": "C5",
    "branch": "AUTO",
    "name": "Phase Optimizer",
    "name_ko": "최적 위상 분석",
    "depth": 2,
    "effect_type": "위상 자동 고정 로직 고도화 — 다음 [ECONOMY]분간의 C·D·QF 예측에 따라 선제적 위상 전환 (단순 현재 상태 기반 → 미래 예측 기반)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["C2"],
    "gate_layer": 6,
    "gate_condition": "C2 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "자동화가 예측하기 시작한다. 미래를 아는 자는 현재를 최적화한다."
  },
  {
    "id": "C6",
    "branch": "AUTO",
    "name": "Phase Transition Cost Reduction",
    "name_ko": "위상 전환 E 절감",
    "depth": 2,
    "effect_type": "위상 고정 유지 E 소모 [ECONOMY]% 감소 (더 오래 한 위상에 머무를 수 있음)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["C2"],
    "gate_layer": 6,
    "gate_condition": "C2 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "고정이 쉬워졌다. 위상이 흔들리지 않는다."
  },
  {
    "id": "C7",
    "branch": "AUTO",
    "name": "Orbital Slot Prediction",
    "name_ko": "공명 슬롯 예측",
    "depth": 3,
    "effect_type": "다음 공명 슬롯 출현 [ECONOMY]초 전 UI 미리 표시 — 능동 클릭 타이밍 개선 보조 (자동화를 보완하는 정보 제공)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["C3"],
    "gate_layer": 4,
    "gate_condition": "C3 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "전자가 어디 나타날지 예측할 수 있다. 양자역학이 허락하는 한에서."
  },
  {
    "id": "C8",
    "branch": "AUTO",
    "name": "Phase Strategy Engine",
    "name_ko": "위상 전략 엔진",
    "depth": 3,
    "effect_type": "위상 자동 고정을 플레이어가 전략 프리셋으로 커스터마이즈 (3종 프리셋: 체인 우선/D 우선/QF 우선) — 자동화 위에 전략층 추가",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["C5"],
    "gate_layer": 7,
    "gate_condition": "C5 구매 + 끈층(L7) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "자동화에 방향을 부여한다. 이제 기계가 당신의 전략을 실행한다."
  },
  {
    "id": "C9",
    "branch": "AUTO",
    "name": "Auto Network Expansion",
    "name_ko": "네트워크 자동 확장",
    "depth": 1,
    "effect_type": "스핀 네트워크(§2-G) 노드를 자동으로 추가 (인터벌 [ECONOMY]초 — 느린 속도, 플레이어 수동 최적화의 보조)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 8,
    "gate_condition": "루프층(L8) 진입 후 [ECONOMY]분 경과 + 스핀 노드 수동 구매 30회 이상",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "그래프가 스스로 자란다. 하지만 최선의 구조는 여전히 손으로 만든다."
  },
  {
    "id": "C10",
    "branch": "AUTO",
    "name": "Offline Efficiency Boost",
    "name_ko": "오프라인 효율 강화",
    "depth": 2,
    "effect_type": "오프라인 modifier 상승 (economy §3.1: 기본 0.65 → [ECONOMY]로 상향) — 방치 플레이어 보상",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["C9"],
    "gate_layer": 8,
    "gate_condition": "C9 구매 + 2회 이상 상전이 완료",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "자리를 비워도 실험실은 돌아간다. 더 효율적으로."
  }
]
```

---

## 5. D. 위상 심화 Branch (PHASE)

**목적:** 각 층의 고유 메커니즘을 심화·변형. 층 진입 시 자동으로 노드 추가.
**해금:** 층 진입 시 해당 층의 위상 심화 노드 1~2개 자동 해금 (발견의 느낌).

### 트리 토폴로지

```
PHASE_ROOT (층별 자동 해금)
│
├── [L2] D_A: 오비탈 슬롯 확장 (depth 1)
│   └── D_A2: 슬롯 질 향상 (depth 2)
│
├── [L3] D_B: 핵 과충전 (depth 1)
│   └── D_B2: 게이지 공명 연장 (depth 2)
│
├── [L4] D_C: 색 전문화 (depth 1)
│   └── D_C2: 색 전문 자원 해금 (depth 2) ── [EPIC]
│
├── [L5] D_D: 점근 자유 고정 (depth 1)
│   └── D_D2: AF 마일스톤 임계값 감소 (depth 2)
│
├── [L6] D_E: 위상 전문화 (depth 1, 3종 선택)
│   ├── D_E_COH: 응집 전문 (depth 2)
│   ├── D_E_DIS: 분산 전문 (depth 2)
│   └── D_E_RES: 공명 전문 (depth 2)
│
├── [L7] D_F: 하모닉 고정 (depth 1)
│   └── D_F2: 하모닉 스케줄 커스터마이즈 (depth 2)
│
├── [L8] D_G: 스핀 구조 잠금 (depth 1)
│   └── D_G2: 네트워크 복잡 토폴로지 보너스 (depth 2)
│
├── [L9] D_H: 요동 패턴 기억 (depth 1)
│   └── D_H2: 요동 예측 활용 (depth 2)
│
└── [L10-L11] D_I: D_lifetime 영구 증폭 (depth 1)
    └── D_I2: 빅 크런치 보상 증폭 (depth 2) ── [LEGENDARY]
```

### 노드 데이터

```json
[
  {
    "id": "D_A",
    "branch": "PHASE",
    "name": "Orbital Slot Expansion",
    "name_ko": "오비탈 슬롯 확장",
    "depth": 1,
    "effect_type": "동시 오비탈 공명 슬롯 수 + [ECONOMY] (기본 3개 → 최대 [ECONOMY]개)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 2,
    "gate_condition": "원자층(L2) 진입 시 자동 해금",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "더 많은 전자가 동시에 뛸 수 있다."
  },
  {
    "id": "D_A2",
    "branch": "PHASE",
    "name": "Slot Quality Upgrade",
    "name_ko": "슬롯 질 향상",
    "depth": 2,
    "effect_type": "공명 슬롯 유효 시간 연장 [ECONOMY]초 + 슬롯 성공 시 D 획득 보너스 × [ECONOMY]",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_A"],
    "gate_layer": 2,
    "gate_condition": "D_A 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "슬롯이 더 오래 열린다. 클릭할 시간이 생긴다."
  },
  {
    "id": "D_B",
    "branch": "PHASE",
    "name": "Nuclear Overcharge",
    "name_ko": "핵 과충전",
    "depth": 1,
    "effect_type": "핵력 게이지(§2-B) 만충 전 80% 시점에서 부분 방출 가능 — 소량 C 생산 스파이크 + 게이지 80%→[ECONOMY]% 로 감소 (완전 방출 대비 [ECONOMY]% 효율)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 3,
    "gate_condition": "핵층(L3) 진입 시 자동 해금",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "완전히 충전될 때까지 기다리지 않아도 된다. 전략적 타협."
  },
  {
    "id": "D_B2",
    "branch": "PHASE",
    "name": "Gauge Resonance Extension",
    "name_ko": "게이지 공명 연장",
    "depth": 2,
    "effect_type": "핵결합 이벤트 C 생산 스파이크 지속 시간 × [ECONOMY]배 연장",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_B"],
    "gate_layer": 3,
    "gate_condition": "D_B 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "폭발이 더 오래 지속된다. 핵결합의 여운."
  },
  {
    "id": "D_C",
    "branch": "PHASE",
    "name": "Color Specialization",
    "name_ko": "색 전문화",
    "depth": 1,
    "effect_type": "삼원합일(§2-C) 완성 시 추가 '색 전문 자원' 생성 해금 — 적/청/녹 중 지정 색에 특화된 보너스 선택 가능",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 4,
    "gate_condition": "핵자층(L4) 진입 시 자동 해금",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "균형만이 답이 아니다. 한 색에 집중하면 다른 것을 얻는다."
  },
  {
    "id": "D_C2",
    "branch": "PHASE",
    "name": "Color Resource Unlock",
    "name_ko": "색 전문 자원 해금",
    "depth": 2,
    "effect_type": "지정 색 전문 자원이 쌓일 때마다 해당 색 관련 체인 티어 추가 배율 (예: 적 전문화 → T1·T3 배율 증가, 청 → T2·T4, 녹 → T5·T6 — 연결은 [ECONOMY]에서 확정)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_C"],
    "gate_layer": 4,
    "gate_condition": "D_C 구매 + 삼원합일 [ECONOMY]회 완성",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "색전하가 새로운 자원이 됐다. 균형 대신 전문화."
  },
  {
    "id": "D_D",
    "branch": "PHASE",
    "name": "Asymptotic Freedom Lock",
    "name_ko": "점근 자유 고정",
    "depth": 1,
    "effect_type": "점근 자유 가속(§2-D) 지속 시간 영구 증가 [ECONOMY]초 — 마일스톤마다 쌓임",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 5,
    "gate_condition": "쿼크층(L5) 진입 시 자동 해금",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "자유가 더 오래 지속된다. 쿼크는 잠깐 더 해방된다."
  },
  {
    "id": "D_D2",
    "branch": "PHASE",
    "name": "AF Milestone Threshold Reduction",
    "name_ko": "AF 마일스톤 임계값 감소",
    "depth": 2,
    "effect_type": "점근 자유 발동 C 임계값 [ECONOMY]% 감소 — 더 낮은 C에서 AF 발동",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_D"],
    "gate_layer": 5,
    "gate_condition": "D_D 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "자유는 더 일찍 온다."
  },
  {
    "id": "D_E",
    "branch": "PHASE",
    "name": "Phase Specialization (3-way)",
    "name_ko": "위상 전문화 (선택)",
    "depth": 1,
    "effect_type": "프리온층(§2-E) 위상 전문화 방향 선택 해금 — 응집/분산/공명 중 하나를 '주 위상'으로 지정. 주 위상 배율 × [ECONOMY] 대신 다른 두 위상 배율 소폭 감소 (전문화 트레이드오프)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 6,
    "gate_condition": "프리온층(L6) 진입 시 자동 해금",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "세 상태 중 하나를 선택하라. 전문가는 만능이 될 수 없다."
  },
  {
    "id": "D_E_COH",
    "branch": "PHASE",
    "name": "Coherent Mastery",
    "name_ko": "응집 전문",
    "depth": 2,
    "effect_type": "응집 상태 체인 배율 최대치 × [ECONOMY] / 응집 → 분산 전환 쿨다운 증가 (전환 페널티 — 응집에 집중 유도)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_E"],
    "gate_layer": 6,
    "gate_condition": "D_E 구매 + 응집 전문화 선택",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "체인 몬스터의 길. 요동 없이, 흔들림 없이, 그저 압축."
  },
  {
    "id": "D_E_DIS",
    "branch": "PHASE",
    "name": "Dispersed Mastery",
    "name_ko": "분산 전문",
    "depth": 2,
    "effect_type": "분산 상태 D 생산 최대치 × [ECONOMY] / 분산 → 응집 전환 쿨다운 증가",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_E"],
    "gate_layer": 6,
    "gate_condition": "D_E 구매 + 분산 전문화 선택",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "연구 러셔의 길. 모든 것을 퍼뜨려 더 많이 발견한다."
  },
  {
    "id": "D_E_RES",
    "branch": "PHASE",
    "name": "Resonant Mastery",
    "name_ko": "공명 전문",
    "depth": 2,
    "effect_type": "공명 상태 QF 트리클 × [ECONOMY] / 공명 상태 강제 전환 불가 (자동 순환 패널티 — 공명 유지 비용 없이 잠금)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_E"],
    "gate_layer": 6,
    "gate_condition": "D_E 구매 + 공명 전문화 선택",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "QF 축적가의 길. 느리게, 하지만 영원히 쌓인다."
  },
  {
    "id": "D_F",
    "branch": "PHASE",
    "name": "Harmonic Lock",
    "name_ko": "하모닉 고정",
    "depth": 1,
    "effect_type": "특정 티어의 하모닉 공명 우선도 증가 [ECONOMY]% — 해당 티어가 더 자주 공명 (하모닉 스케줄 조작)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 7,
    "gate_condition": "끈층(L7) 진입 시 자동 해금",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "원하는 티어를 골라 진동시킨다. 끈이론이 전략이 된다."
  },
  {
    "id": "D_F2",
    "branch": "PHASE",
    "name": "Harmonic Schedule Customization",
    "name_ko": "하모닉 스케줄 커스터마이즈",
    "depth": 2,
    "effect_type": "하모닉 공명 순서를 플레이어가 직접 재배열 가능 — 최대 [ECONOMY]개 티어 고정 (나머지는 자동 순환)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_F"],
    "gate_layer": 7,
    "gate_condition": "D_F 구매",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "진동의 악보를 다시 쓴다."
  },
  {
    "id": "D_G",
    "branch": "PHASE",
    "name": "Spin Network Preservation",
    "name_ko": "스핀 구조 잠금",
    "depth": 1,
    "effect_type": "상전이 후 스핀 네트워크(§2-G) 부분 보존 — 노드 수의 [ECONOMY]% 유지 (엣지는 모두 리셋)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 8,
    "gate_condition": "루프층(L8) 진입 시 자동 해금",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "리셋해도 그래프의 흔적이 남는다."
  },
  {
    "id": "D_G2",
    "branch": "PHASE",
    "name": "Complex Topology Bonus",
    "name_ko": "복잡 토폴로지 보너스",
    "depth": 2,
    "effect_type": "스핀 네트워크 복합 토폴로지(루프+트리) 달성 시 모든 배율 보너스 × [ECONOMY]배 추가 (단순 토폴로지 대비 복잡성 보상)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_G"],
    "gate_layer": 8,
    "gate_condition": "D_G 구매 + 복합 토폴로지 1회 달성",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "단순함을 넘어선 자에게 주어지는 보상."
  },
  {
    "id": "D_H",
    "branch": "PHASE",
    "name": "Fluctuation Pattern Memory",
    "name_ko": "요동 패턴 기억",
    "depth": 1,
    "effect_type": "이전 요동 이벤트 기록 — 최근 [ECONOMY]회 요동의 평균/분산 UI 표시 + 다음 요동 예측 힌트 제공",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 9,
    "gate_condition": "거품층(L9) 진입 시 자동 해금",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "불확정성에도 패턴이 있다. 아니, 있는 것처럼 보인다."
  },
  {
    "id": "D_H2",
    "branch": "PHASE",
    "name": "Fluctuation Prediction Utilization",
    "name_ko": "요동 예측 활용",
    "depth": 2,
    "effect_type": "요동 예측 힌트를 실제 배율로 전환 — 예측한 티어에 사전 업그레이드 투자 시 해당 요동 배율 × [ECONOMY] 추가 (개입 보상)",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_H"],
    "gate_layer": 9,
    "gate_condition": "D_H 구매 + 요동 이벤트 [ECONOMY]회 기록",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "혼돈을 이용하는 자가 혼돈을 지배한다."
  },
  {
    "id": "D_I",
    "branch": "PHASE",
    "name": "D-Lifetime Permanent Amplifier",
    "name_ko": "D 평생 누적 영구 증폭",
    "depth": 1,
    "effect_type": "D_lifetime 보존율 영구 증가 [ECONOMY]% — 상전이 후 더 많은 D가 다음 런으로 이월됨 (홀로그래픽 배율 연결)",
    "effect_value": "[ECONOMY]",
    "prerequisites": [],
    "gate_layer": 10,
    "gate_condition": "정보층(L10) 진입 시 자동 해금",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "발견은 사라지지 않는다. 정보는 영원하다."
  },
  {
    "id": "D_I2",
    "branch": "PHASE",
    "name": "Big Crunch Reward Amplifier",
    "name_ko": "빅 크런치 보상 증폭",
    "depth": 2,
    "effect_type": "빅 크런치(§2-J) 최종 QF 계산 공식에 도감 완성도 가중치 추가 (final_QF × (1 + codex_completion × [ECONOMY])) — 컬렉터 최종 보상 극대화",
    "effect_value": "[ECONOMY]",
    "prerequisites": ["D_I"],
    "gate_layer": 11,
    "gate_condition": "D_I 구매 + 플랑크층(L11) 진입",
    "cost_D": "[ECONOMY]",
    "milestone_warning": false,
    "flavor_brief": "모든 것을 기록한 자에게, 우주의 붕괴가 가장 큰 선물을 준다."
  }
]
```

---

## 6. D 게이팅 전체 규칙

```
// D 획득 경로 (systems §3-3)
D += particle_discovery_bonus       // 입자 발견 (일회성, 큰 값)
D += compression_depth_trickle      // 압축 깊이 비례 상시 생산
D += resonance_event_bonus          // 공명·게이지·삼원합일 이벤트

// 가지별 해금 조건
branch_CHAIN:    원자층(L2) 진입 즉시 자동 해금
branch_SYNERGY:  핵층(L3) 진입 + D 누적 [ECONOMY] 이상
branch_AUTO:     첫 상전이 완료 후 해금
branch_PHASE:    층 진입 시 해당 층 노드 자동 추가

// 노드 비용 구조
node_cost = base_D × branch_factor × depth_in_branch   // [ECONOMY]
// A 가지: base 낮음 (체인 직접 강화 → 빠른 접근)
// B 가지: base 중간 (시너지 = 여러 시스템 필요)
// C 가지: base 높음 (자동화 = 방치 프리미엄)
// D 가지: base 중간~높음 (층별 심화 = 진행 필요)
```

---

## 7. 층 진행과 연구 트리 맞물림

```
층 진입 →
    D_PHASE 노드 자동 해금 (발견의 느낌)
    해당 층 도감 LEGENDARY 엔트리 해금 조건 충족 단계 시작

새 입자 발견 →
    D 큰 보너스 → 연구 속도 순간 가속
    해당 층 도감 완성도 상승

상전이 완료 →
    연구 유지 (리셋 없음)
    새 층 노드 D 필요 → 자연스러운 목표 이동
    C_AUTO 가지 해금 (첫 상전이 시)

빅 크런치 →
    연구 트리 완전 유지 (모든 런에서 보존)
    D_I2 보상이 빅 크런치 QF에 반영
```

---

## 8. economy / narrative 조율 필요 항목

### economy-designer 협의 필요

| 항목 | 내용 | 우선도 |
|---|---|---|
| A13 전체 티어 연쇄 | 모든 티어 동시 연속 강화 → production_mult race 재검증 필요 | 높음 |
| B8 3중 메커니즘 시너지 | 세 메커니즘 동시 활성 → 배율 중첩 여부 확인 | 높음 |
| B12 완전 시너지 | B 가지 전체 배율 추가 → base_rate 하향 필요 가능성 | 높음 |
| C10 오프라인 효율 | modifier 상향 → 오프라인 캘린더 재검증 (economy §3.1) | 중간 |
| D_C2 색 전문 자원 | 새 자원이 체인 티어 배율로 전환 → 추가 자원의 mult 영향 | 중간 |
| D_I2 빅 크런치 보상 | final_QF에 codex_completion 가중치 → 엔드게임 QF 폭발 가능성 | 중간 |

### narrative-designer 협의 필요

| 항목 | 내용 |
|---|---|
| 모든 노드 flavor_brief | [FLAVOR] 태그 → 실제 플레이버 텍스트 작성 필요 |
| D_E 위상 전문화 선택 | 플레이어 정체성 결정 노드 — 보이스 강화 필요 |
| D_I2 빅 크런치 텍스트 | 엔딩 노드 — 서사적 무게감 필요 |

---

*비용 수치 = [ECONOMY] / 플레이버 = [FLAVOR] (담당 디자이너 위임)*
