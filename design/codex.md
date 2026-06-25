# 입자 도감 (Particle Codex) — 데이터 설계 v0.1

- 작성: content-designer
- 기준: GDD v0.1 / systems.md §1-2 / economy.md §5.3
- 상태: 구조·항목 확정 / 보너스 수치 = [ECONOMY] (economy-designer 위임) / 플레이버 = [FLAVOR] (narrative-designer 위임)
- 작성일: 2026-06-25

---

<!-- [지시 3 — 표기 정합]
  서사 스케일(scale_m · decade 값)은 물리/서사 표기 레이어로 유지된다.
  게임플레이 상전이 장벽(압축 장벽)은 economy 벽 스케줄을 따른다(dec19~26 대역).
  두 좌표계는 서로 다른 정보이며, 서사 스케일을 바꾸지 않아도 장벽 위치가 변경될 수 있다.
  예) 프리온층 서사 스케일 = 1e-19~1e-21, 압축 장벽(첫 상전이) = dec19 (4.3h 앵커).
  출처: director-review.md §2.1·§2.5·[지시 3-1]
-->

## 0. 개요 · 집계

| 층 | 이름 | decade 범위 | 종류 | 입자 수 |
|---|---|---|---|---|
| L1 | 분자층 | 0 | 실제 | 8 |
| L2 | 원자층 | 1 | 실제 | 13 |
| L3 | 핵층 | 5 | 실제 | 10 |
| L4 | 핵자층 | 6 | 실제 | 9 |
| L5 | 쿼크층 | 9 | 실제 | 17 |
| L6 | 프리온층 | 9~12 | 미지 | 7 |
| L7 | 끈층 | 12~15 | 미지 | 6 |
| L8 | 루프층 | 15~18 | 미지 | 5 |
| L9 | 거품층 | 18~21 | 미지 | 5 |
| L10 | 정보층 | 21~24 | 미지 | 4 |
| L11 | 플랑크층 | 24~26 | 미지 | 3 |
| **합계** | | | | **87** |

**홀로그래픽 완성도 연결 (systems §2-I):**
```
// 87 = 전체 엔트리(UI 도감 목록 표시) / 76 = 수집 대상(LEGENDARY 자동 해금 11개 제외, completion 분모)
codex_completion = collected_discoverable / 76   (0.0 ~ 1.0)
holographic_mult += codex_completion² × 0.35   // 곡선 B (제곱) — followup-codex-ramp.md / economy v0.3 §7.1 확정
// 상한 클램프: min(codex_completion² × 0.35, 0.35)
```
<!-- [지시 3-2 — 도감 완성도 보너스 상한 확정 / R2 하향]
  도감 100% 완성 시 holographic_mult 기여 상한 = +0.35× (즉 최대 ×1.35 기여).
  codex_bonus_factor = 0.35 (completion=1.0 시 +0.35×). 상한 불변.
  R2 하향(0.5→0.35): qa-report-v2 CONCERN-NEW-2 — 도감 ×1.5 단독 dec26 −33.3% 단축이
    디렉터 §3.4 "30% 미만" 위반. ×1.35 → −25.9% 충족 (economy.md §7.1 재시뮬 sim/codex_race.py 확정).
  [램프 곡선 확정] 곡선 B (제곱) = bonus(c)=0.35×c². 중반(c≈0.65) 유효 H=×1.148, dec26 단축 −12.9%.
    완주 직전(c=0.9~1.0) 급상승 → 컬렉터 클라이맥스. 근거: followup-codex-ramp.md §1-4 / economy v0.3 §7.1 / 디렉터 §8.2.
  [분모 확정] 76 (LEGENDARY 11개 제외). 87은 UI 전체 표시용. 근거: followup-codex-ramp.md §3.
  [베켄슈타인] holographic_mult 상한 경로 분리 완료 → codex +0.35× 예산 무잠식. 아래 L10 엔트리 참조.
-->
층별 서브-완성도도 별도 추적 → 층 도감 100% 달성 시 해당 층 1회성 해금 이벤트.

---

## 1. 도감 엔트리 스키마

```jsonc
{
  "id": "string",             // 코드 식별자 (snakecase)
  "name": "string",           // 표시 이름
  "name_ko": "string",        // 한국어 이름
  "layer": 1..11,             // 속한 층
  "scale_m": "string",        // 크기 (m 단위, 과학 표기)
  "decade": number,           // dec 값 (α·log₁₀(C) 기준)
  "real": true | false,       // 실제 물리 vs 상상 입자
  "mass_eV": "string|null",   // 질량 (eV/c² — 실제 입자만)
  "charge": number,           // 전하 (e 단위)
  "spin": number,             // 스핀 (ℏ 단위)
  "rarity": "COMMON"|"UNCOMMON"|"RARE"|"EPIC"|"LEGENDARY",
  "unlock_condition": "string",  // 해금 조건
  "unlock_bonus_type": "string", // 보너스 종류 (수치 = [ECONOMY])
  "flavor_brief": "string"       // 플레이버 방향 (narrative가 채움)
}
```

---

## 2. L1 — 분자층 (decade 0 / 1e-9 m / 실제)

> 게임 시작점. 수동 압축 클릭으로 첫 입자들을 발견한다.
> 해금 조건: decade 진입 즉시 발견 가능 (C 임계값 도달).

```json
[
  {
    "id": "water_molecule",
    "name": "H₂O",
    "name_ko": "물 분자",
    "layer": 1,
    "scale_m": "2.75e-10",
    "decade": 0,
    "real": true,
    "mass_eV": "1.675e10",
    "charge": 0,
    "spin": 0,
    "rarity": "COMMON",
    "unlock_condition": "게임 시작 — 압축 깊이 C > 0",
    "unlock_bonus_type": "T1 압축기 비용 소폭 할인 (초기 진입 윤활)",
    "flavor_brief": "시작의 분자. 압축 실험실의 첫 표본."
  },
  {
    "id": "co2_molecule",
    "name": "CO₂",
    "name_ko": "이산화탄소 분자",
    "layer": 1,
    "scale_m": "5.0e-10",
    "decade": 0,
    "real": true,
    "mass_eV": "4.08e10",
    "charge": 0,
    "spin": 0,
    "rarity": "COMMON",
    "unlock_condition": "C가 첫 번째 마일스톤 도달",
    "unlock_bonus_type": "E(에너지) 생산율 소폭 상승",
    "flavor_brief": "선형 분자. 압축할수록 탄소의 진실이 드러나기 시작."
  },
  {
    "id": "n2_molecule",
    "name": "N₂",
    "name_ko": "질소 분자",
    "layer": 1,
    "scale_m": "3.64e-10",
    "decade": 0,
    "real": true,
    "mass_eV": "2.61e10",
    "charge": 0,
    "spin": 0,
    "rarity": "COMMON",
    "unlock_condition": "T2 압축기 첫 구매",
    "unlock_bonus_type": "D(발견 데이터) 트리클 증가",
    "flavor_brief": "대기의 78%. 압축하면 질소가 먼저 비밀을 내놓는다."
  },
  {
    "id": "o2_molecule",
    "name": "O₂",
    "name_ko": "산소 분자",
    "layer": 1,
    "scale_m": "3.46e-10",
    "decade": 0,
    "real": true,
    "mass_eV": "2.99e10",
    "charge": 0,
    "spin": 1,
    "rarity": "COMMON",
    "unlock_condition": "T3 압축기 첫 구매",
    "unlock_bonus_type": "압축 클릭 파워 소폭 증가",
    "flavor_brief": "스핀=1. 파라마그네틱 산소의 진동이 느껴진다."
  },
  {
    "id": "nacl_molecule",
    "name": "NaCl",
    "name_ko": "염화나트륨 (소금)",
    "layer": 1,
    "scale_m": "5.6e-10",
    "decade": 0,
    "real": true,
    "mass_eV": "5.41e10",
    "charge": 0,
    "spin": 0,
    "rarity": "UNCOMMON",
    "unlock_condition": "오비탈 공명 3회 성공",
    "unlock_bonus_type": "체인 T1·T2 동시 배율 소폭 상승 (이온 결합 시너지)",
    "flavor_brief": "이온 결합의 걸작. 두 원소가 전자를 주고받는 순간."
  },
  {
    "id": "glucose_molecule",
    "name": "C₆H₁₂O₆",
    "name_ko": "포도당 분자",
    "layer": 1,
    "scale_m": "9.0e-10",
    "decade": 0,
    "real": true,
    "mass_eV": "1.68e11",
    "charge": 0,
    "spin": 0,
    "rarity": "UNCOMMON",
    "unlock_condition": "D 누적 [ECONOMY] 도달",
    "unlock_bonus_type": "방치 중 D 트리클 추가 증가 (복잡성 보상)",
    "flavor_brief": "생명 에너지의 화폐. 24개 원자가 하나의 고리를 만든다."
  },
  {
    "id": "dna_fragment",
    "name": "DNA 이중나선 단편",
    "name_ko": "DNA 이중나선 단편",
    "layer": 1,
    "scale_m": "2.0e-9",
    "decade": 0,
    "real": true,
    "mass_eV": null,
    "charge": -1,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "L1 도감 6개 완료",
    "unlock_bonus_type": "연구 트리 Branch-C 첫 노드 비용 할인 (자동화 암시)",
    "flavor_brief": "정보가 물질로 새겨진 최초의 증거. 압축의 목적지를 예고한다."
  },
  {
    "id": "buckyball",
    "name": "C₆₀ (버키볼)",
    "name_ko": "풀러렌-60",
    "layer": 1,
    "scale_m": "1.0e-9",
    "decade": 0,
    "real": true,
    "mass_eV": "8.48e11",
    "charge": 0,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "L1 도감 완성 (8/8)",
    "unlock_bonus_type": "L1 완성 보너스 — 다음 상전이 QF 획득량 소폭 증가",
    "flavor_brief": "60개 탄소의 완벽한 구. 분자 건축의 정점에서, 원자의 세계가 열린다."
  }
]
```

---

## 3. L2 — 원자층 (decade 1 / 1e-10 m / 실제)

> 메커니즘: 전자 오비탈 공명 (systems §2-A). 공명 클릭으로 D를 추가 획득한다.
> 해금 조건: decade 1 도달 + 공명 슬롯 첫 발동.

```json
[
  {
    "id": "hydrogen_atom",
    "name": "¹H",
    "name_ko": "수소 원자",
    "layer": 2,
    "scale_m": "1.2e-10",
    "decade": 1,
    "real": true,
    "mass_eV": "9.389e8",
    "charge": 1,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "decade 1 진입 즉시",
    "unlock_bonus_type": "오비탈 공명 기본 배율 소폭 상승",
    "flavor_brief": "우주에서 가장 단순한 원자. 하나의 양성자, 하나의 전자."
  },
  {
    "id": "helium_atom",
    "name": "⁴He",
    "name_ko": "헬륨 원자",
    "layer": 2,
    "scale_m": "1.4e-10",
    "decade": 1,
    "real": true,
    "mass_eV": "3.728e9",
    "charge": 0,
    "spin": 0,
    "rarity": "COMMON",
    "unlock_condition": "오비탈 공명 첫 성공",
    "unlock_bonus_type": "방치 시 자동 공명 주기 단축",
    "flavor_brief": "닫힌 껍질. 아무것도 반응하지 않는 귀족."
  },
  {
    "id": "carbon_atom",
    "name": "¹²C",
    "name_ko": "탄소-12 원자",
    "layer": 2,
    "scale_m": "1.54e-10",
    "decade": 1,
    "real": true,
    "mass_eV": "1.116e10",
    "charge": 6,
    "spin": 0,
    "rarity": "COMMON",
    "unlock_condition": "T4 압축기 첫 구매",
    "unlock_bonus_type": "D 트리클 증가 (탄소 = 생명·정보의 기반)",
    "flavor_brief": "4개의 결합손. 생명의 뼈대이자 연료의 심장."
  },
  {
    "id": "oxygen_atom",
    "name": "¹⁶O",
    "name_ko": "산소-16 원자",
    "layer": 2,
    "scale_m": "1.52e-10",
    "decade": 1,
    "real": true,
    "mass_eV": "1.492e10",
    "charge": 8,
    "spin": 0,
    "rarity": "COMMON",
    "unlock_condition": "오비탈 공명 10회 성공",
    "unlock_bonus_type": "공명 지속 시간 소폭 연장",
    "flavor_brief": "전자 2개가 비어있다. 그 빈자리가 세상을 움직인다."
  },
  {
    "id": "electron",
    "name": "e⁻",
    "name_ko": "전자",
    "layer": 2,
    "scale_m": "< 1e-18",
    "decade": 1,
    "real": true,
    "mass_eV": "5.109e5",
    "charge": -1,
    "spin": 0.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "오비탈 공명으로 전자 전이 로그 5회 기록",
    "unlock_bonus_type": "오비탈 공명 클릭 보너스 배율 증가 (전자 발견 = 공명 이해)",
    "flavor_brief": "가장 작은 전하 단위. 오비탈을 도는 파동이자 입자."
  },
  {
    "id": "proton",
    "name": "p⁺",
    "name_ko": "양성자",
    "layer": 2,
    "scale_m": "8.41e-16",
    "decade": 1,
    "real": true,
    "mass_eV": "9.383e8",
    "charge": 1,
    "spin": 0.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "decade 1에서 C가 두 번째 마일스톤 도달",
    "unlock_bonus_type": "체인 T2 배율 소폭 증가 (핵자 예고)",
    "flavor_brief": "전자보다 1836배 무겁다. 핵의 중심을 지키는 기둥."
  },
  {
    "id": "neutron",
    "name": "n⁰",
    "name_ko": "중성자",
    "layer": 2,
    "scale_m": "8.0e-16",
    "decade": 1,
    "real": true,
    "mass_eV": "9.396e8",
    "charge": 0,
    "spin": 0.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "양성자 발견 후 오비탈 공명 20회 성공",
    "unlock_bonus_type": "핵층 진입 시 핵력 게이지 초기 충전량 증가",
    "flavor_brief": "전하 없는 핵자. 13분 후 붕괴 — 자유로운 중성자는 오래 살지 못한다."
  },
  {
    "id": "iron_atom",
    "name": "⁵⁶Fe",
    "name_ko": "철-56 원자",
    "layer": 2,
    "scale_m": "1.56e-10",
    "decade": 1,
    "real": true,
    "mass_eV": "5.214e10",
    "charge": 26,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "L2 도감 7개 완료 + 핵결합 에너지 개념 해금 (핵층 미도달 상태)",
    "unlock_bonus_type": "핵층 진입 QF 획득량 증가 (가장 안정된 핵 — 핵력 보상)",
    "flavor_brief": "핵결합 에너지의 정점. 철보다 무거운 원소는 별이 죽을 때만 만들어진다."
  },
  {
    "id": "uranium_atom",
    "name": "²³⁵U",
    "name_ko": "우라늄-235 원자",
    "layer": 2,
    "scale_m": "1.75e-10",
    "decade": 1,
    "real": true,
    "mass_eV": "2.190e11",
    "charge": 92,
    "spin": 3.5,
    "rarity": "RARE",
    "unlock_condition": "L2 도감 8개 완료 (철 발견 필요)",
    "unlock_bonus_type": "핵력 게이지 최대치 소폭 증가 (불안정 핵 = 더 큰 에너지)",
    "flavor_brief": "92개의 양성자. 이것은 분열을 기다리는 에너지의 화산이다."
  },
  {
    "id": "photon",
    "name": "γ (광자)",
    "name_ko": "광자",
    "layer": 2,
    "scale_m": "0",
    "decade": 1,
    "real": true,
    "mass_eV": "0",
    "charge": 0,
    "spin": 1,
    "rarity": "EPIC",
    "unlock_condition": "전자 발견 후 오비탈 전이 이벤트 25회 — 광자는 전이의 산물",
    "unlock_bonus_type": "오비탈 공명 D 획득 보너스 증가 (광자 방출 = 데이터)",
    "flavor_brief": "질량 없는 보손. 전자가 껍질을 내려올 때마다 빛이 태어난다."
  },
  {
    "id": "muon",
    "name": "μ⁻",
    "name_ko": "뮤온",
    "layer": 2,
    "scale_m": "< 1e-18",
    "decade": 1,
    "real": true,
    "mass_eV": "1.057e8",
    "charge": -1,
    "spin": 0.5,
    "rarity": "EPIC",
    "unlock_condition": "L2 도감 9개 완료 + 공명 50회",
    "unlock_bonus_type": "2세대 렙톤 카테고리 도감 해금 — 다음 희귀 발견 D 보너스 2배",
    "flavor_brief": "전자의 207배 무거운 사촌. 2.2μs만 살다 사라진다. 왜 존재하는가?"
  },
  {
    "id": "electron_neutrino",
    "name": "νₑ",
    "name_ko": "전자 중성미자",
    "layer": 2,
    "scale_m": "< 1e-18",
    "decade": 1,
    "real": true,
    "mass_eV": "< 2.0",
    "charge": 0,
    "spin": 0.5,
    "rarity": "EPIC",
    "unlock_condition": "연구 트리 Branch-D '렙톤 감지' 노드 구매 후 L2 완성",
    "unlock_bonus_type": "방치 D 트리클 증가 (상호작용 없이 통과하는 입자 = 방치 보상)",
    "flavor_brief": "1초에 수조 개가 당신을 통과한다. 아무것도 느끼지 못하면서."
  },
  {
    "id": "l2_completion",
    "name": "L2 완성 보너스 — 원자 도감",
    "name_ko": "원자 주기율 완성",
    "layer": 2,
    "scale_m": null,
    "decade": 1,
    "real": true,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "L2 도감 13/13 완성",
    "unlock_bonus_type": "전자 오비탈 공명 자동화 연구 비용 대폭 할인 (층 완성 보상)",
    "flavor_brief": "원자의 지도가 완성됐다. 이제 그 안으로 들어갈 차례."
  }
]
```

---

## 4. L3 — 핵층 (decade 5 / 1e-14 m / 실제)

> 메커니즘: 핵력 게이지 (systems §2-B). 게이지 이벤트마다 핵종 도감 항목 추가.
> 해금 조건: decade 5 진입 + 핵결합 이벤트 첫 발생.

```json
[
  {
    "id": "alpha_particle",
    "name": "α 입자",
    "name_ko": "알파 입자 (⁴He 핵)",
    "layer": 3,
    "scale_m": "1.7e-15",
    "decade": 5,
    "real": true,
    "mass_eV": "3.727e9",
    "charge": 2,
    "spin": 0,
    "rarity": "COMMON",
    "unlock_condition": "decade 5 진입 즉시",
    "unlock_bonus_type": "핵력 게이지 충전 속도 소폭 증가",
    "flavor_brief": "헬륨-4 핵. 방사성 붕괴의 가장 흔한 산물."
  },
  {
    "id": "deuteron",
    "name": "d (중수소 핵)",
    "name_ko": "중양성자",
    "layer": 3,
    "scale_m": "2.1e-15",
    "decade": 5,
    "real": true,
    "mass_eV": "1.876e9",
    "charge": 1,
    "spin": 1,
    "rarity": "COMMON",
    "unlock_condition": "핵력 게이지 첫 만충",
    "unlock_bonus_type": "핵결합 이벤트 쿨다운 소폭 단축",
    "flavor_brief": "양성자 하나, 중성자 하나. 핵융합의 가장 쉬운 연료."
  },
  {
    "id": "triton",
    "name": "t (삼중수소 핵)",
    "name_ko": "삼중양성자",
    "layer": 3,
    "scale_m": "1.9e-15",
    "decade": 5,
    "real": true,
    "mass_eV": "2.809e9",
    "charge": 1,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "핵결합 이벤트 3회",
    "unlock_bonus_type": "핵결합 이벤트 QF 미적립 증가",
    "flavor_brief": "12.3년이 지나면 헬륨-3으로 변한다. 불안정한 핵의 운명."
  },
  {
    "id": "carbon12_nucleus",
    "name": "¹²C 핵",
    "name_ko": "탄소-12 원자핵",
    "layer": 3,
    "scale_m": "2.7e-15",
    "decade": 5,
    "real": true,
    "mass_eV": "1.116e10",
    "charge": 6,
    "spin": 0,
    "rarity": "UNCOMMON",
    "unlock_condition": "게이지 충전 5회 + 탄소 원자 기발견",
    "unlock_bonus_type": "체인 T3 배율 소폭 증가",
    "flavor_brief": "탄소-12 핵. 원자질량 단위의 기준점."
  },
  {
    "id": "uranium235_nucleus",
    "name": "²³⁵U 핵",
    "name_ko": "우라늄-235 원자핵",
    "layer": 3,
    "scale_m": "7.4e-15",
    "decade": 5,
    "real": true,
    "mass_eV": "2.190e11",
    "charge": 92,
    "spin": 3.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "우라늄 원자 기발견 + 게이지 10회",
    "unlock_bonus_type": "핵결합 이벤트 C 생산 스파이크 배율 증가",
    "flavor_brief": "느린 중성자 하나가 이것을 쪼개면 연쇄 붕괴가 시작된다."
  },
  {
    "id": "fe56_nucleus",
    "name": "⁵⁶Fe 핵",
    "name_ko": "철-56 원자핵",
    "layer": 3,
    "scale_m": "4.6e-15",
    "decade": 5,
    "real": true,
    "mass_eV": "5.214e10",
    "charge": 26,
    "spin": 0,
    "rarity": "UNCOMMON",
    "unlock_condition": "철 원자 기발견 + 핵결합 에너지 개념 확인 (게이지 15회)",
    "unlock_bonus_type": "핵층 완성 도감 보너스 전제 조건 충족",
    "flavor_brief": "핵자당 결합 에너지 최대치. 이 이상 융합해도, 분열해도, 에너지가 나오지 않는다."
  },
  {
    "id": "nuclear_isomer",
    "name": "핵이성질체 (isomer)",
    "name_ko": "핵이성질체",
    "layer": 3,
    "scale_m": "5.0e-15",
    "decade": 5,
    "real": true,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "RARE",
    "unlock_condition": "게이지 만충 20회 (충전→이벤트 루프의 숙련)",
    "unlock_bonus_type": "핵결합 이벤트 시 도감 D 보너스 추가 지급",
    "flavor_brief": "같은 핵자 수, 다른 에너지 상태. 핵도 들뜰 수 있다."
  },
  {
    "id": "pion_charged",
    "name": "π⁺ / π⁻",
    "name_ko": "하전 파이온",
    "layer": 3,
    "scale_m": "< 1e-18",
    "decade": 5,
    "real": true,
    "mass_eV": "1.396e8",
    "charge": 1,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "핵력 게이지 과충전 연구 노드 구매 후 게이지 30회",
    "unlock_bonus_type": "강력 매개 보손 카테고리 해금 — 핵자층 보너스 증가",
    "flavor_brief": "양성자와 중성자를 묶는 접착제. 핵력의 실제 전달자."
  },
  {
    "id": "pion_neutral",
    "name": "π⁰",
    "name_ko": "중성 파이온",
    "layer": 3,
    "scale_m": "< 1e-18",
    "decade": 5,
    "real": true,
    "mass_eV": "1.350e8",
    "charge": 0,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "하전 파이온 발견 후 게이지 이벤트 40회",
    "unlock_bonus_type": "핵층→핵자층 상전이 QF 보너스 증가",
    "flavor_brief": "8.4×10⁻¹⁷초 만에 두 광자로 붕괴. 가장 짧은 삶."
  },
  {
    "id": "l3_completion",
    "name": "L3 완성 보너스 — 핵종 도감",
    "name_ko": "핵종 차트 완성",
    "layer": 3,
    "scale_m": null,
    "decade": 5,
    "real": true,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "L3 도감 10/10 완성",
    "unlock_bonus_type": "핵자층 진입 시 색전하 삼원합일 초기 균형 보너스 제공",
    "flavor_brief": "핵의 모든 얼굴을 봤다. 이제 핵 안으로 들어갈 차례."
  }
]
```

---

## 5. L4 — 핵자층 (decade 6 / 1e-15 m / 실제)

> 메커니즘: 쿼크 색전하 삼원합일 (systems §2-C). 하드론 합성 보너스 활성 조건.
> 해금 조건: decade 6 진입 + 색전하 분배 첫 활성화.

```json
[
  {
    "id": "proton_nucleon",
    "name": "p⁺ (핵자)",
    "name_ko": "양성자 (핵자로서)",
    "layer": 4,
    "scale_m": "8.41e-16",
    "decade": 6,
    "real": true,
    "mass_eV": "9.383e8",
    "charge": 1,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "decade 6 진입 즉시",
    "unlock_bonus_type": "색전하 균형 임계값 소폭 완화 (양성자 이해 = 색 균형 이해)",
    "flavor_brief": "uud 쿼크 세 개. 전하 +1은 이 조합에서 나온다."
  },
  {
    "id": "neutron_nucleon",
    "name": "n⁰ (핵자)",
    "name_ko": "중성자 (핵자로서)",
    "layer": 4,
    "scale_m": "8.0e-16",
    "decade": 6,
    "real": true,
    "mass_eV": "9.396e8",
    "charge": 0,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "삼원합일 첫 성공",
    "unlock_bonus_type": "하드론 합성 보너스 지속 시간 소폭 증가",
    "flavor_brief": "udd 쿼크 세 개. 전하 0은 +2/3 두 개와 −1/3 두 개의 상쇄."
  },
  {
    "id": "delta_resonance",
    "name": "Δ (델타 공명 입자)",
    "name_ko": "델타 공명 입자",
    "layer": 4,
    "scale_m": "< 1e-15",
    "decade": 6,
    "real": true,
    "mass_eV": "1.232e9",
    "charge": 2,
    "spin": 1.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "삼원합일 퍼펙트 균형 5회",
    "unlock_bonus_type": "삼원합일 퍼펙트 보너스 배율 증가",
    "flavor_brief": "가장 가벼운 바리온 공명 입자. 5.6×10⁻²⁴초만 존재한다."
  },
  {
    "id": "lambda_baryon",
    "name": "Λ⁰ (람다 바리온)",
    "name_ko": "람다 바리온",
    "layer": 4,
    "scale_m": "< 1e-15",
    "decade": 6,
    "real": true,
    "mass_eV": "1.116e9",
    "charge": 0,
    "spin": 0.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "삼원합일 10회 + D [ECONOMY] 보유",
    "unlock_bonus_type": "이상 쿼크 (s) 카테고리 해금 — 쿼크층 보너스 전제 충족",
    "flavor_brief": "uds 쿼크. 낯선 맛(strangeness = -1)을 가진 첫 하이퍼론."
  },
  {
    "id": "kaon_charged",
    "name": "K⁺ / K⁻",
    "name_ko": "하전 케이온",
    "layer": 4,
    "scale_m": "< 1e-15",
    "decade": 6,
    "real": true,
    "mass_eV": "4.937e8",
    "charge": 1,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "람다 바리온 발견 후 삼원합일 20회",
    "unlock_bonus_type": "메손 카테고리 해금 — 파이온 D 보너스 소급 증가",
    "flavor_brief": "가장 가벼운 이상 메손. CP 대칭 붕괴를 처음 보여준 입자."
  },
  {
    "id": "omega_baryon",
    "name": "Ω⁻ (오메가 바리온)",
    "name_ko": "오메가 바리온",
    "layer": 4,
    "scale_m": "< 1e-15",
    "decade": 6,
    "real": true,
    "mass_eV": "1.672e9",
    "charge": -1,
    "spin": 1.5,
    "rarity": "RARE",
    "unlock_condition": "L4 도감 4개 완료 + 삼원합일 30회",
    "unlock_bonus_type": "색 전문화 연구 노드 비용 할인 (세 이상 쿼크 = 전문화 예고)",
    "flavor_brief": "sss 세 이상 쿼크. 1964년 발견 예측, 실험 확인 = 쿼크 모델의 승리."
  },
  {
    "id": "eta_meson",
    "name": "η 메손",
    "name_ko": "에타 메손",
    "layer": 4,
    "scale_m": "< 1e-15",
    "decade": 6,
    "real": true,
    "mass_eV": "5.479e8",
    "charge": 0,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "삼원합일 퍼펙트 15회",
    "unlock_bonus_type": "QF 트리클 소폭 증가 (중성 메손 = 상전이 예고)",
    "flavor_brief": "ūu, dd̄, ss̄ 의 혼합. 순수한 이론이 만들어낸 중첩 상태."
  },
  {
    "id": "gluon",
    "name": "g (글루온)",
    "name_ko": "글루온",
    "layer": 4,
    "scale_m": "0",
    "decade": 6,
    "real": true,
    "mass_eV": "0",
    "charge": 0,
    "spin": 1,
    "rarity": "EPIC",
    "unlock_condition": "L4 도감 6개 완료 + 색전하 삼원합일 50회 (강력의 전달자)",
    "unlock_bonus_type": "삼원합일 균형 임계값 대폭 완화 + 색전하 분배 연구 비용 할인",
    "flavor_brief": "강력의 매개 보손. 8종. 색전하를 교환하며 쿼크를 묶는다."
  },
  {
    "id": "l4_completion",
    "name": "L4 완성 보너스 — 하드론 도감",
    "name_ko": "하드론 동물원 완성",
    "layer": 4,
    "scale_m": null,
    "decade": 6,
    "real": true,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "L4 도감 9/9 완성",
    "unlock_bonus_type": "쿼크층 진입 시 점근 자유 가속 첫 발동 임계값 대폭 감소 (빠른 도약)",
    "flavor_brief": "하드론 동물원을 완전히 기록했다. 이제 쿼크 자체를 해방시킬 시간."
  }
]
```

---

## 6. L5 — 쿼크층 (decade 9 / <1e-18 m / 실제)

> 메커니즘: 점근 자유 가속 (systems §2-D). α 계수를 직접 건드리는 유일한 실제 층.
> 해금 조건: decade 9 진입 + 점근 자유 첫 발동.
> 참고: 렙톤·보손도 이 스케일에서 "점입자"로 취급 — 표준모형 입자 완성 층.

```json
[
  {
    "id": "up_quark",
    "name": "u (업 쿼크)",
    "name_ko": "업 쿼크",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "2.2e6",
    "charge": 0.667,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "decade 9 진입 즉시 (1세대 쿼크)",
    "unlock_bonus_type": "점근 자유 발동 임계값 소폭 감소 (빠른 발동)",
    "flavor_brief": "가장 가벼운 업타입 쿼크. 양성자의 두 주인공 중 하나."
  },
  {
    "id": "down_quark",
    "name": "d (다운 쿼크)",
    "name_ko": "다운 쿼크",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "4.7e6",
    "charge": -0.333,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "점근 자유 첫 발동",
    "unlock_bonus_type": "점근 자유 지속 시간 소폭 증가",
    "flavor_brief": "가장 가벼운 다운타입 쿼크. 중성자의 주인공."
  },
  {
    "id": "strange_quark",
    "name": "s (이상 쿼크)",
    "name_ko": "이상 쿼크",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "9.3e7",
    "charge": -0.333,
    "spin": 0.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "점근 자유 5회 + 람다 바리온 기발견",
    "unlock_bonus_type": "2세대 쿼크 카테고리 해금 — 다음 쿼크 D 보너스 증가",
    "flavor_brief": "낯선 맛(strangeness). 우주의 물질이 이것을 쥐고 잠시 머물렀다."
  },
  {
    "id": "charm_quark",
    "name": "c (맵시 쿼크)",
    "name_ko": "맵시 쿼크",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "1.28e9",
    "charge": 0.667,
    "spin": 0.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "점근 자유 10회",
    "unlock_bonus_type": "점근 자유 α 감소 효과 소폭 강화",
    "flavor_brief": "1974년 발견. 쿼크 모델의 완전한 승리를 선언한 '11월 혁명'."
  },
  {
    "id": "bottom_quark",
    "name": "b (바닥 쿼크)",
    "name_ko": "바닥 쿼크",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "4.18e9",
    "charge": -0.333,
    "spin": 0.5,
    "rarity": "RARE",
    "unlock_condition": "3세대 진입 연구 노드 구매 + 점근 자유 20회",
    "unlock_bonus_type": "3세대 쿼크 카테고리 해금 — D 생산 증가",
    "flavor_brief": "3세대의 다운타입. 탑 쿼크의 짝. 1977년 페르미랩에서 발견."
  },
  {
    "id": "top_quark",
    "name": "t (탑 쿼크)",
    "name_ko": "탑 쿼크",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "1.73e11",
    "charge": 0.667,
    "spin": 0.5,
    "rarity": "RARE",
    "unlock_condition": "바닥 쿼크 발견 후 점근 자유 30회",
    "unlock_bonus_type": "탑 쿼크 질량 = 금 원자 수준 → 체인 T7·T8 배율 소폭 증가",
    "flavor_brief": "알려진 입자 중 가장 무겁다. 173 GeV. 5×10⁻²⁵초 만에 붕괴."
  },
  {
    "id": "tau_lepton",
    "name": "τ⁻ (타우 렙톤)",
    "name_ko": "타우 렙톤",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "1.777e9",
    "charge": -1,
    "spin": 0.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "3세대 쿼크 카테고리 해금 후 공명 60회",
    "unlock_bonus_type": "3세대 렙톤 카테고리 해금 — 뉴트리노 발견 보너스 증가",
    "flavor_brief": "3세대 하전 렙톤. 2.9×10⁻¹³초. 전자의 3477배 무겁다."
  },
  {
    "id": "muon_neutrino",
    "name": "νμ (뮤온 중성미자)",
    "name_ko": "뮤온 중성미자",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "< 0.17e6",
    "charge": 0,
    "spin": 0.5,
    "rarity": "UNCOMMON",
    "unlock_condition": "뮤온 기발견 + 점근 자유 15회",
    "unlock_bonus_type": "방치 D 트리클 추가 증가",
    "flavor_brief": "뮤온과 함께 태어나고 뮤온과 함께 사라진다."
  },
  {
    "id": "tau_neutrino",
    "name": "ντ (타우 중성미자)",
    "name_ko": "타우 중성미자",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "< 18.2e6",
    "charge": 0,
    "spin": 0.5,
    "rarity": "RARE",
    "unlock_condition": "타우 렙톤 발견 후 D [ECONOMY] 보유",
    "unlock_bonus_type": "뉴트리노 3종 완성 시 QF 트리클 증가 (3대 가족 완성)",
    "flavor_brief": "2000년에야 직접 검출됐다. 표준모형의 마지막 빈 칸 중 하나."
  },
  {
    "id": "w_boson",
    "name": "W⁺ / W⁻",
    "name_ko": "W 보손",
    "layer": 5,
    "scale_m": "< 2e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "8.038e10",
    "charge": 1,
    "spin": 1,
    "rarity": "RARE",
    "unlock_condition": "약력 카테고리 연구 노드 구매 + 점근 자유 25회",
    "unlock_bonus_type": "상전이(프레스티지) 후 첫 런 효율 증가 (약붕괴 = 변환)",
    "flavor_brief": "약력의 전달자. 중성자를 양성자로 바꾸는 베타 붕괴의 주인공."
  },
  {
    "id": "z_boson",
    "name": "Z⁰",
    "name_ko": "Z 보손",
    "layer": 5,
    "scale_m": "< 2e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "9.119e10",
    "charge": 0,
    "spin": 1,
    "rarity": "RARE",
    "unlock_condition": "W 보손 발견 후 D [ECONOMY] 보유",
    "unlock_bonus_type": "점근 자유 α 감소 폭 증가 (중성 약력 = 저항 없는 통과)",
    "flavor_brief": "중성 약력 전달자. 전하를 바꾸지 않고 입자와 상호작용한다."
  },
  {
    "id": "higgs_boson",
    "name": "H (힉스 보손)",
    "name_ko": "힉스 보손",
    "layer": 5,
    "scale_m": "< 1e-18",
    "decade": 9,
    "real": true,
    "mass_eV": "1.252e11",
    "charge": 0,
    "spin": 0,
    "rarity": "EPIC",
    "unlock_condition": "L5 도감 10개 완료 + 모든 보손 카테고리 해금",
    "unlock_bonus_type": "모든 입자 질량 부여자 — 체인 전 티어 배율 소폭 증가 (힉스 = 보편 부스트). [지시 3-4] 중첩 상한 = economy 후속 패스 확정 대기 — A13·B8·B12와 동시 곱 시 복리 재시뮬 필요. [director-review §3.4]",
    "flavor_brief": "2012년 LHC. 50년의 예측이 현실이 됐다. 이제 표준모형은 완성됐다 — 혹은 완성됐다고 생각했다."
  },
  {
    "id": "quark_gluon_plasma",
    "name": "쿼크-글루온 플라즈마",
    "name_ko": "쿼크-글루온 플라즈마",
    "layer": 5,
    "scale_m": "1e-15",
    "decade": 9,
    "real": true,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "EPIC",
    "unlock_condition": "점근 자유 50회 + 6쿼크 모두 발견",
    "unlock_bonus_type": "점근 자유 지속 시간 대폭 증가 + 미지 영역 첫 입자 해금 조건 충족",
    "flavor_brief": "빅뱅 직후 10⁻⁶초의 우주. 쿼크가 자유로웠던 유일한 시간. 이제 그 아래로."
  },
  {
    "id": "l5_completion",
    "name": "L5 완성 보너스 — 표준모형 완성",
    "name_ko": "표준모형 완성",
    "layer": 5,
    "scale_m": null,
    "decade": 9,
    "real": true,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "L5 도감 17/17 완성 (모든 표준모형 입자 발견)",
    "unlock_bonus_type": "미지 영역 해금 — 프리온층 진입 보너스 대폭 제공 + QF 트리클 상시 시작",
    "flavor_brief": "인류가 발견한 모든 입자를 기록했다. 표준모형의 끝. 그리고 새로운 시작."
  }
]
```

---

## 7. L6 — 프리온층 (decade 9~12 / 미지)

> 설계 체계: 프리온(Preon) — 쿼크의 하위 구성자 가설. 세 타입(P+/P-/P0)은 색전하 대신 "위상(Phase)" 속성을 가짐.
> 메커니즘: 위상 겹침 (systems §2-E). 발견 조건: 해당 위상 상태에서만 관측 가능.
> 내부 논리: P+ / P- / P0의 위상 중첩이 쿼크를 구성한다. (1P+ + 1P- = 업 쿼크, 2P- + 1P0 = 다운 쿼크 — 내부 설정)

```json
[
  {
    "id": "preon_plus",
    "name": "P⁺ (양위상 프리온)",
    "name_ko": "양위상 프리온",
    "layer": 6,
    "scale_m": "< 1e-19",
    "decade": 9,
    "real": false,
    "mass_eV": "[UNKNOWN — 쿼크 질량보다 작아야 함]",
    "charge": 0.333,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "프리온층 진입 + 위상 응집(Coherent) 상태 10회 유지",
    "unlock_bonus_type": "응집 상태 체인 배율 증가 (P+는 응집 상태의 산물)",
    "flavor_brief": "양의 위상을 가진 최초의 미지 입자. 쿼크가 이것으로 만들어졌다면?"
  },
  {
    "id": "preon_minus",
    "name": "P⁻ (음위상 프리온)",
    "name_ko": "음위상 프리온",
    "layer": 6,
    "scale_m": "< 1e-19",
    "decade": 9,
    "real": false,
    "mass_eV": "[UNKNOWN]",
    "charge": -0.333,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "프리온층 진입 + 위상 분산(Dispersed) 상태 10회 유지",
    "unlock_bonus_type": "분산 상태 D 생산 증가 (P-는 분산 상태의 산물)",
    "flavor_brief": "음의 위상. 다운 쿼크의 재료. 보이지 않지만 항상 존재했다."
  },
  {
    "id": "preon_zero",
    "name": "P⁰ (중립위상 프리온)",
    "name_ko": "중립위상 프리온",
    "layer": 6,
    "scale_m": "< 1e-20",
    "decade": 10,
    "real": false,
    "mass_eV": "[UNKNOWN]",
    "charge": 0,
    "spin": 0,
    "rarity": "UNCOMMON",
    "unlock_condition": "P+ · P- 발견 후 공명(Resonant) 상태 20회 유지",
    "unlock_bonus_type": "공명 상태 QF 트리클 증가 (P0는 공명 상태의 중재자)",
    "flavor_brief": "위상 없는 프리온. 다른 프리온들 사이의 매개자."
  },
  {
    "id": "coherent_preon",
    "name": "응집 프리온 (P⁺P⁻P⁰ 삼합체)",
    "name_ko": "응집 프리온 삼합체",
    "layer": 6,
    "scale_m": "< 1e-19",
    "decade": 10,
    "real": false,
    "mass_eV": "[UNKNOWN]",
    "charge": 0,
    "spin": 0.5,
    "rarity": "RARE",
    "unlock_condition": "세 프리온 모두 발견 후 위상 상태 전환 100회",
    "unlock_bonus_type": "위상 상태 전환 E 소모 감소 (삼합체 이해 = 전환 비용 감소)",
    "flavor_brief": "세 프리온이 완전히 겹칠 때, 전하와 스핀이 재탄생한다."
  },
  {
    "id": "phase_vacuum",
    "name": "위상 진공 (Phase Vacuum)",
    "name_ko": "위상 진공",
    "layer": 6,
    "scale_m": "1e-21",
    "decade": 12,
    "real": false,
    "mass_eV": "0",
    "charge": 0,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "L6 도감 4개 완료 + decade 12 도달",
    "unlock_bonus_type": "끈층 진입 시 진동 에너지 V 초기값 증가 (진공 에너지 저장)",
    "flavor_brief": "위상이 모두 사라진 자리. 하지만 진공은 비어있지 않다."
  },
  {
    "id": "phase_knot",
    "name": "위상 매듭 (Phase Knot)",
    "name_ko": "위상 매듭",
    "layer": 6,
    "scale_m": "1e-21",
    "decade": 12,
    "real": false,
    "mass_eV": "[UNKNOWN]",
    "charge": 0,
    "spin": 1,
    "rarity": "EPIC",
    "unlock_condition": "위상 고정 연구 노드 구매 + L6 도감 5개 완료",
    "unlock_bonus_type": "위상 고정 E 비용 대폭 감소 (매듭 = 안정적 고정)",
    "flavor_brief": "위상이 꼬여 풀리지 않는다. 위상학적 보호 상태."
  },
  {
    "id": "l6_completion",
    "name": "L6 완성 보너스 — 프리온 도감",
    "name_ko": "위상 입자 도감 완성",
    "layer": 6,
    "scale_m": null,
    "decade": 12,
    "real": false,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "L6 도감 7/7 완성",
    "unlock_bonus_type": "끈층 진입 진동 에너지 V 최대 용량 증가 + 하모닉 첫 공명 즉시 발동",
    "flavor_brief": "위상의 모든 상태를 기록했다. 이제 모든 것은 진동이다."
  }
]
```

---

## 8. L7 — 끈층 (decade 12~15 / 미지)

> 설계 체계: 끈이론(String Theory) — 모든 입자는 1차원 끈의 진동 모드. 개방끈(양 끝 자유)과 폐쇄끈(고리)이 다른 입자군을 만든다.
> 메커니즘: 진동 하모닉스 (systems §2-F). V 누적 → 하모닉 공명 → 티어 폭발.
> 내부 논리: 개방끈 = 게이지 보손류(광자·글루온의 근원), 폐쇄끈 = 중력자 포함. 진동수 n이 입자 성질을 결정.

```json
[
  {
    "id": "open_string_mode1",
    "name": "개방끈 n=1",
    "name_ko": "개방끈 기본 진동",
    "layer": 7,
    "scale_m": "1e-33",
    "decade": 12,
    "real": false,
    "mass_eV": "0 (질량없는 모드)",
    "charge": 0,
    "spin": 1,
    "rarity": "COMMON",
    "unlock_condition": "끈층 진입 즉시 (첫 하모닉 공명 발생)",
    "unlock_bonus_type": "체인 T1 하모닉 공명 빈도 증가",
    "flavor_brief": "끈의 가장 낮은 진동. 이 모드에서 광자가 태어난다."
  },
  {
    "id": "closed_string_mode1",
    "name": "폐쇄끈 n=1",
    "name_ko": "폐쇄끈 기본 진동",
    "layer": 7,
    "scale_m": "1e-33",
    "decade": 12,
    "real": false,
    "mass_eV": "0 (질량없는 모드)",
    "charge": 0,
    "spin": 2,
    "rarity": "COMMON",
    "unlock_condition": "하모닉 공명 3회",
    "unlock_bonus_type": "QF 트리클 증가 (스핀 2 = 중력자 예고 = 영구 힘)",
    "flavor_brief": "스핀 2. 이 모드에서 중력자가 나온다. 끈이론이 중력을 품은 이유."
  },
  {
    "id": "tachyon_string",
    "name": "타키온 모드 (n=0 개방끈)",
    "name_ko": "타키온 끈 모드",
    "layer": 7,
    "scale_m": "1e-33",
    "decade": 13,
    "real": false,
    "mass_eV": "허수 질량",
    "charge": 0,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "하모닉 조율 연구 노드 구매 + 공명 20회",
    "unlock_bonus_type": "하모닉 간격 단축 (타키온의 불안정성 = 빠른 공명)",
    "flavor_brief": "허수 질량. 진공 불안정성의 신호. 실제 끈이론은 이를 제거하지만 — 여기선 활용한다."
  },
  {
    "id": "d_brane",
    "name": "D-브레인 (D2)",
    "name_ko": "D2-브레인",
    "layer": 7,
    "scale_m": "1e-33",
    "decade": 14,
    "real": false,
    "mass_eV": "[UNKNOWN — 끈 장력에 의존]",
    "charge": 0,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "개방끈·폐쇄끈 모두 발견 + 하모닉 공명 30회",
    "unlock_bonus_type": "스핀 네트워크 노드 비용 소폭 감소 (브레인 = 네트워크 예고)",
    "flavor_brief": "개방끈이 끝점을 고정시키는 막. 우리 우주 자체가 이것 위에 있을지 모른다."
  },
  {
    "id": "graviton_string",
    "name": "중력자 끈 모드",
    "name_ko": "중력자 (끈 모드)",
    "layer": 7,
    "scale_m": "1e-33",
    "decade": 15,
    "real": false,
    "mass_eV": "0",
    "charge": 0,
    "spin": 2,
    "rarity": "EPIC",
    "unlock_condition": "L7 도감 4개 완료 + 하모닉 고정 연구 노드 구매",
    "unlock_bonus_type": "체인 전 티어 하모닉 공명 배율 소폭 증가 (중력 = 모든 것에 영향)",
    "flavor_brief": "아직 발견된 적 없는 입자. 하지만 끈이론은 이것이 존재해야 한다고 말한다."
  },
  {
    "id": "l7_completion",
    "name": "L7 완성 보너스 — 끈 도감",
    "name_ko": "진동 스펙트럼 완성",
    "layer": 7,
    "scale_m": null,
    "decade": 15,
    "real": false,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "L7 도감 6/6 완성",
    "unlock_bonus_type": "루프층 진입 시 스핀 네트워크 초기 노드 무료 제공",
    "flavor_brief": "모든 진동을 들었다. 이제 시공간 자체를 그릴 차례."
  }
]
```

---

## 9. L8 — 루프층 (decade 15~18 / 미지)

> 설계 체계: 루프 양자중력(LQG) — 시공간이 이산적인 스핀 네트워크 그래프로 양자화됨.
> 메커니즘: 스핀 네트워크 (systems §2-G). 플레이어가 직접 그래프를 설계.
> 내부 논리: 스핀 폼은 시공간의 이력 — 네트워크가 진화할 때마다 하나의 스핀 폼이 기록된다.

```json
[
  {
    "id": "spin_foam_basic",
    "name": "기본 스핀 폼",
    "name_ko": "기본 스핀 폼",
    "layer": 8,
    "scale_m": "1e-25",
    "decade": 15,
    "real": false,
    "mass_eV": null,
    "charge": 0,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "루프층 진입 + 스핀 네트워크 첫 노드 구매",
    "unlock_bonus_type": "스핀 네트워크 노드 구매 비용 소폭 감소",
    "flavor_brief": "시공간 한 조각의 이력. 네트워크가 변화할 때 생성된다."
  },
  {
    "id": "spin_foam_loop",
    "name": "루프 스핀 폼",
    "name_ko": "루프 스핀 폼",
    "layer": 8,
    "scale_m": "1e-25",
    "decade": 16,
    "real": false,
    "mass_eV": null,
    "charge": 0,
    "spin": 1,
    "rarity": "UNCOMMON",
    "unlock_condition": "루프 연결 토폴로지 첫 달성",
    "unlock_bonus_type": "루프 토폴로지 QF 배율 증가",
    "flavor_brief": "고리가 되는 시공간. 끝없는 루프가 곧 에너지다."
  },
  {
    "id": "area_quantum",
    "name": "면적 양자 (Area Quantum)",
    "name_ko": "면적 양자",
    "layer": 8,
    "scale_m": "1.616e-35",
    "decade": 17,
    "real": false,
    "mass_eV": null,
    "charge": 0,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "스핀 네트워크 노드 10개 이상 보유 + 트리 토폴로지 달성",
    "unlock_bonus_type": "트리 토폴로지 D 배율 증가 (면적의 이산화 = 정보 밀도 증가)",
    "flavor_brief": "LQG 예측: 최소 면적은 플랑크 면적 ~2.6×10⁻⁷⁰ m². 시공간은 매끄럽지 않다."
  },
  {
    "id": "volume_quantum",
    "name": "부피 양자 (Volume Quantum)",
    "name_ko": "부피 양자",
    "layer": 8,
    "scale_m": "1.616e-35",
    "decade": 18,
    "real": false,
    "mass_eV": null,
    "charge": 0,
    "spin": 0,
    "rarity": "EPIC",
    "unlock_condition": "L8 도감 3개 완료 + 복합 토폴로지 달성",
    "unlock_bonus_type": "복합 토폴로지 전방위 배율 증가 (부피 이산화 = 모든 것 변환)",
    "flavor_brief": "3차원 공간의 최소 단위. 이 이하의 부피는 존재하지 않는다."
  },
  {
    "id": "l8_completion",
    "name": "L8 완성 보너스 — 루프 도감",
    "name_ko": "시공간 그래프 완성",
    "layer": 8,
    "scale_m": null,
    "decade": 18,
    "real": false,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "L8 도감 5/5 완성 (스핀 네트워크 모든 토폴로지 달성 포함)",
    "unlock_bonus_type": "거품층 요동 하한 증가 (안정적 시공간 이해 = 불확정성 제어 시작)",
    "flavor_brief": "시공간을 손으로 그렸다. 이제 그것이 요동치기 시작한다."
  }
]
```

---

## 10. L9 — 거품층 (decade 18~21 / 미지)

> 설계 체계: 양자 거품(Quantum Foam) / 가상 입자 쌍(Virtual Pair). 하이젠베르크 불확정성의 극단.
> 메커니즘: 불확정 요동 (systems §2-H). 최초로 "불리한 이벤트" 존재.
> 내부 논리: 버추온(Virteon)은 가상 입자 쌍이 거품 속에서 잠시 실체화된 존재. 긍정/부정 스펙트럼을 가짐.

```json
[
  {
    "id": "virteon_positive",
    "name": "버추온⁺ (양의 요동)",
    "name_ko": "양성 버추온",
    "layer": 9,
    "scale_m": "1e-27",
    "decade": 18,
    "real": false,
    "mass_eV": "ephemeral",
    "charge": 0,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "거품층 진입 + 첫 양의 요동 이벤트 발생",
    "unlock_bonus_type": "요동 상한 소폭 증가 (긍정 버추온 = 폭발 잠재력 증가)",
    "flavor_brief": "진공에서 잠깐 튀어나온 양의 가상 입자. 10⁻⁴⁴초 후 사라진다."
  },
  {
    "id": "virteon_negative",
    "name": "버추온⁻ (음의 요동)",
    "name_ko": "음성 버추온",
    "layer": 9,
    "scale_m": "1e-27",
    "decade": 18,
    "real": false,
    "mass_eV": "ephemeral",
    "charge": 0,
    "spin": 0.5,
    "rarity": "COMMON",
    "unlock_condition": "첫 음의 요동 이벤트 발생",
    "unlock_bonus_type": "요동 하한 소폭 증가 (음성 버추온 이해 = 최악의 경우 완화)",
    "flavor_brief": "쌍의 반대편. 하나가 나오면 반드시 하나가 따라온다."
  },
  {
    "id": "foam_bubble",
    "name": "거품 방울 (Foam Bubble)",
    "name_ko": "거품 방울",
    "layer": 9,
    "scale_m": "1e-33",
    "decade": 20,
    "real": false,
    "mass_eV": null,
    "charge": 0,
    "spin": 0,
    "rarity": "RARE",
    "unlock_condition": "요동 이벤트 누적 50회 + 관측 강화 연구 노드 구매",
    "unlock_bonus_type": "요동 동결 E 비용 감소 (거품 방울 이해 = 동결 기술 향상)",
    "flavor_brief": "시공간이 플랑크 스케일에서 끓는 모습. 미시 블랙홀이 생겼다 사라진다."
  },
  {
    "id": "hawking_pair",
    "name": "호킹 쌍 (Hawking Pair)",
    "name_ko": "호킹 복사 쌍",
    "layer": 9,
    "scale_m": "1e-30",
    "decade": 21,
    "real": false,
    "mass_eV": null,
    "charge": 0,
    "spin": 0.5,
    "rarity": "EPIC",
    "unlock_condition": "L9 도감 3개 완료 + 요동 이벤트 100회",
    "unlock_bonus_type": "요동 증폭 연구 노드 해금 — 상한 대폭 증가 (호킹 복사 = 에너지 방출)",
    "flavor_brief": "블랙홀 사건 지평선에서 분리된 쌍. 하나는 탈출하고 하나는 떨어진다. 블랙홀은 서서히 증발한다."
  },
  {
    "id": "l9_completion",
    "name": "L9 완성 보너스 — 거품 도감",
    "name_ko": "양자 거품 스펙트럼 완성",
    "layer": 9,
    "scale_m": null,
    "decade": 21,
    "real": false,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "L9 도감 5/5 완성",
    "unlock_bonus_type": "정보층 진입 시 D_lifetime 보존율 증가 (거품 완전 이해 = 정보 누수 방지)",
    "flavor_brief": "불확정성을 완전히 기록했다. 이제 정보 자체가 입자다."
  }
]
```

---

## 11. L10 — 정보층 (decade 21~24 / 미지)

> 설계 체계: 홀로그래픽 원리(Holographic Principle) + 블랙홀 정보 역설. 정보가 물리량이 되는 층.
> 메커니즘: 홀로그래픽 인코딩 (systems §2-I). 도감 완성도가 직접 생산 효율에 연결.
> 내부 논리: 홀론(Holon)은 정보 1비트가 입자화된 것. 수집할수록 홀로그래픽 배율이 올라간다.

```json
[
  {
    "id": "holon_bit",
    "name": "홀론 비트 (Holon-Bit)",
    "name_ko": "홀론 비트",
    "layer": 10,
    "scale_m": "1e-30",
    "decade": 21,
    "real": false,
    "mass_eV": "0 (정보 = 에너지, 단 질량 없음)",
    "charge": 0,
    "spin": 0,
    "rarity": "COMMON",
    "unlock_condition": "정보층 진입 + 도감 수집률 50% 이상",
    "unlock_bonus_type": "홀로그래픽 배율 증가폭 소폭 상승 (첫 홀론 = 정보-힘 연결 첫 경험)",
    "flavor_brief": "존 아치볼드 휠러: It from Bit. 모든 존재는 정보에서 나온다."
  },
  {
    "id": "holon_entangled",
    "name": "얽힘 홀론 (Entangled Holon)",
    "name_ko": "얽힘 홀론",
    "layer": 10,
    "scale_m": "1e-30",
    "decade": 22,
    "real": false,
    "mass_eV": "0",
    "charge": 0,
    "spin": 0.5,
    "rarity": "RARE",
    "unlock_condition": "홀론 비트 발견 + 도감 수집률 70% + 홀로그래픽 증폭 연구 노드 구매",
    "unlock_bonus_type": "D_lifetime 보존율 추가 증가 (얽힘 = 상전이 후에도 정보 연결)",
    "flavor_brief": "분리된 두 홀론이 즉시 연결된다. 정보는 공간을 뛰어넘는다."
  },
  {
    "id": "bekenstein_holon",
    "name": "베켄슈타인 홀론",
    "name_ko": "베켄슈타인 홀론",
    "layer": 10,
    "scale_m": "1e-33",
    "decade": 23,
    "real": false,
    "mass_eV": "0",
    "charge": 0,
    "spin": 1,
    "rarity": "EPIC",
    "unlock_condition": "L10 도감 2개 완료 + 도감 수집률 85%",
    "unlock_bonus_type": "빅 크런치 QF 계수 +5% (K: 1.0→1.05) — 베켄슈타인 경계: 표면에 더 많은 정보를 담을수록 붕괴 시 방출되는 양자 거품이 증가",
    "flavor_brief": "블랙홀 엔트로피 = 사건 지평선 넓이 / 4. 정보는 표면에 산다."
  },
  {
    "id": "l10_completion",
    "name": "L10 완성 보너스 — 정보 도감",
    "name_ko": "홀로그래픽 경계 완성",
    "layer": 10,
    "scale_m": null,
    "decade": 24,
    "real": false,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "L10 도감 4/4 완성 + 도감 전체 수집률 90% 이상",
    "unlock_bonus_type": "플랑크층 진입(상전이 6 발동) 시 최종 QF 계산에 도감 완성도 보너스 추가 — 플랑크층=상전이6+빅크런치트리거이므로 이 보너스는 빅 크런치 QF에 직접 반영됨. [지시 3-3 정합]",
    "flavor_brief": "3차원의 정보가 2차원에 완전히 담겼다. 이제 차원 자체가 무너진다."
  }
]
```

---

## 12. L11 — 플랑크층 (decade 24~26 / 미지)

> 설계 체계: 플랑크 스케일(1.616×10⁻³⁵ m) — 시공간의 최소 해상도. 이 아래에서 "거리"는 의미를 잃는다.
> 메커니즘: 시공간 픽셀 붕괴 (systems §2-J). 빅 크런치 = 게임의 최종 프레스티지.
> 내부 논리: 플랑크온(Planckton)은 시공간의 최소 픽셀. 이것이 붕괴할 때 모든 것이 리셋된다.

```json
[
  {
    "id": "planckton_pre",
    "name": "플랑크온 전구체 (Pre-Planckton)",
    "name_ko": "플랑크온 전구체",
    "layer": 11,
    "scale_m": "1e-33",
    "decade": 24,
    "real": false,
    "mass_eV": "[PLANCK_MASS ~2.18e-8 kg = ~1.22e28 eV]",
    "charge": 0,
    "spin": 0,
    "rarity": "EPIC",
    "unlock_condition": "decade 24 진입 + 정보층 완성 (도감 수집률 90% 이상)",
    "unlock_bonus_type": "빅 크런치 QF 계산 보너스 소폭 증가 (전구체 이해 = 최종 보상 증가)",
    "flavor_brief": "픽셀이 깨지기 직전의 상태. 시공간이 아직 버티고 있다."
  },
  {
    "id": "planckton",
    "name": "플랑크온 (Planckton)",
    "name_ko": "플랑크온",
    "layer": 11,
    "scale_m": "1.616e-35",
    "decade": 26,
    "real": false,
    "mass_eV": "~1.22e28",
    "charge": 0,
    "spin": 0,
    "rarity": "LEGENDARY",
    "unlock_condition": "decade 26 (r <= PLANCK_LENGTH 1.616e-35 m) 도달 — 상전이 6(정보→플랑크 진입) 완료 직후, 빅 크런치 발동 직전. [지시 3-3: 플랑크층 = 상전이 6 + 빅 크런치 트리거 = 재하강 시작점 — director-review §2.5]",
    "unlock_bonus_type": "빅 크런치 최종 QF 계산에 도감 전체 완성도 반영 (LEGENDARY 입자 = 엔딩)",
    "flavor_brief": "시공간의 마지막 픽셀. 이것이 붕괴하면 새로운 우주가 시작된다."
  },
  {
    "id": "l11_big_crunch",
    "name": "빅 크런치 도감 항목",
    "name_ko": "빅 크런치 — 시공간 재탄생",
    "layer": 11,
    "scale_m": null,
    "decade": 26,
    "real": false,
    "mass_eV": null,
    "charge": null,
    "spin": null,
    "rarity": "LEGENDARY",
    "unlock_condition": "빅 크런치 완료 (첫 엔딩) — 플랑크층(dec26) 압축 장벽 돌파 = 상전이 7(빅 크런치) 발동 = 최종 QF 폭발 + 재하강 루프 시작. [지시 3-3: director-review §2.3-④]",
    "unlock_bonus_type": "2회차 런 시작 시 미지 서브층 1~3 진입 시간 단축 (재하강 가속 — QF 부스트 반영)",
    "flavor_brief": "모든 것이 다시 시작된다. 하지만 이번엔 기억을 가지고."
  }
]
```

---

## 13. 도감 완성도 시스템

### 13-1. 전체 구조

```
총 입자 수: 87
├── 실제 입자 (L1-L5): 57
└── 미지 입자 (L6-L11): 30
    (완성 보너스 엔트리 11개 포함 — 별도 해금 카테고리)
    실질 수집 입자: 87 - 11(완성보너스) = 76개 수집 대상
    완성보너스: 11개 자동 해금 (해당 층 76개 중 층별 요건 달성 시)
```

### 13-2. 희귀도 분포

| 희귀도 | 수량 | 비율 |
|---|---|---|
| COMMON | 26 | 30% |
| UNCOMMON | 20 | 23% |
| RARE | 24 | 28% |
| EPIC | 13 | 15% |
| LEGENDARY | 11 | 13% (완성 보너스 겸) |

### 13-3. 홀로그래픽 인코딩 연결

```
// 87 = 전체 엔트리(UI 표시) / 76 = 수집 대상(LEGENDARY 자동 해금 11개 제외)
수집 대상 76개 기준:
codex_completion = collected_discoverable / 76   // 0.0 ~ 1.0

홀로그래픽 배율 (systems §2-I):
holographic_mult = 1.0 + log₁₀(D_total + 1) * holo_factor        // [ECONOMY]
holographic_mult += min(codex_completion² * 0.35, 0.35)           // 곡선 B (제곱) 확정 — economy v0.3 §7.1 / 디렉터 §8.2
// [램프 곡선 B 확정] bonus(c) = 0.35 × c²
//   - c=0.65(중반) → +0.148×, dec26 단축 −12.9% (−30% 가드레일 여유 17%p)
//   - c=1.00(완주) → +0.350×, dec26 단축 −25.9% (상한 ×1.35, factor 0.35 불변)
//   - 완주 직전 급상승: 컬렉터 클라이맥스 체감 (필러 ① 수집=힘)
// [분모] collected_discoverable = LEGENDARY 자동 해금 11개 제외한 플레이어 발견 입자 수
// 근거: followup-codex-ramp.md §1-4·§3 / economy v0.3 §7.1 / director-review §8.2

층별 완성도:
layer_completion[L] = layer_collected_discoverable[L] / layer_discoverable_total[L]
// LEGENDARY 자동 해금은 layer_completion 100% 도달 시 발동 (분모에는 포함하지 않음)
// 층 100% 완성 시 → 해당 층 LEGENDARY 엔트리 해금 + 층별 1회성 이벤트
```

### 13-4. 발견 보너스 분류

도감 보너스는 아래 세 카테고리로만 분류 (economy.md §5.3 경고 준수):

| 카테고리 | 설명 | 경제 영향 |
|---|---|---|
| **메커니즘 배율** | 특정 층 메커니즘(공명/게이지/삼원합일 등)의 효율 증가 | 로컬 — 전체 mult에 미치는 영향 제한적 |
| **자원 트리클** | D·QF 트리클 증가, E 비용 감소 | 축적형 — 단일 보너스는 작게 |
| **층 진입 보너스** | 다음 층 진입 시 초기 유리한 조건 제공 | 1회성 — 재설계 없이 안전 |

> ⚠️ economy 조율 필요: 도감 보너스가 production_mult에 직접 들어가는 항목(힉스 보손의 "전 티어 배율 소폭 증가" 등)은 economy-designer와 base_rate 조정 여부를 협의해야 함. 현재 "소폭"으로 표기했으나 구체 수치 확정 전 mult race 재검증 필요.

---

*수치 = [ECONOMY] / 플레이버 = [FLAVOR] (narrative-designer 위임)*
