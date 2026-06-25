# 현지화 계획 (localization-plan v0.1)

- 작성: narrative-designer
- 기준: `GDD.md` v0.3 / `narrative.md` v0.2 / `codex.md` v0.1 / `tech-architecture.md` v0.1 §4.4 / `ux.md` v0.1 / `asset-list.md` v0.1
- 상태: 구조·인벤토리·워크플로·용어집·톤 이식 방향 확정 초안
- 출시 언어: **한국어(기준) + 영어(동시 출시)**. 추가 언어(중국어 등)는 출시 후 — 구조는 막지 않게.
- 작성일: 2026-06-26

---

## 0. 왜 1일차인가

현지화 구조를 나중에 도입하면 두 가지 비용이 발생한다.

첫째, 이미 코드에 하드코딩된 한국어 문자열을 수백 곳에서 찾아내 키 체계로 교체해야 한다. 이는 버그 위험을 동반한 리팩토링이다.

둘째, 용어집이 없는 상태로 영어 번역을 발주하면 "Preon"이 문서마다 달리 표기되거나, 한국어의 "양자 거품"이 영어에서 "quantum foam"과 "quantum bubble" 사이에서 흔들린다. 텍스트가 확정되기 전에 구조와 용어집부터 잠가야 나중 수정 비용이 0에 수렴한다.

**tech-architecture §4.4 `data/` 텍스트 분리 원칙 직결**: 입자 도감·연구 노드·UI 카피가 이미 `data/` 디렉토리에서 로직과 분리된 구조로 설계되어 있다. 현지화는 이 분리를 그대로 언어 축으로 확장하면 된다. 별도 공수가 아니라 설계 방향의 자연스러운 연장이다.

---

## 1. i18n 구조

### 1-A. 키 기반 string table 원칙

**코드 어디에도 표시 문자열을 하드코딩하지 않는다.** 화면에 보이는 모든 텍스트 — 버튼 레이블, 자원 이름, 입자 플레이버, 층 진입 비트, 상전이 메시지, 토스트, 툴팁 — 는 키로 참조한다.

```
// 금지
button.text = "압축";

// 허용
button.text = t("ui.button.compress");
```

`t(key)` 함수가 현재 언어 파일에서 값을 조회한다. 언어가 없거나 키가 누락되면 한국어(기준 언어)로 폴백한다.

### 1-B. 파일 구조

```
data/
  locale/
    ko.json        ← 기준 언어 (한국어). 항상 완전해야 함.
    en.json        ← 영어. 누락 키 = ko 폴백.
    _template.json ← 추가 언어 진입점 (빈 구조)
```

`ko.json`이 단일 진실 소스다. 새 텍스트가 추가될 때마다 반드시 `ko.json`에 먼저 키와 값을 등록하고, 이후 번역 패스에서 `en.json`을 채운다.

### 1-C. 키 네임스페이스 규칙

```
ui.*          버튼, 탭, 레이블, 툴팁, 상태 표시
layer.*       층 이름, 층 설명, 층 진입 비트 (11개)
prestige.*    상전이 메시지 (7개), 빅 크런치 시퀀스
log.*         시그니처 로그 (6개), 재하강 안내
particle.*    입자 이름 + 플레이버 텍스트 (87개)
research.*    연구 노드 이름 + 툴팁 (52개)
offscreen.*   오프라인 복귀 모달 텍스트
ftue.*        FTUE 온보딩 텍스트 (첫 5분)
redescent.*   재하강 선택 UI, 집중 서브층 카드 (6개)
toast.*       마일스톤 토스트 카피
codex.*       도감 UI 텍스트 (완성도 바, 섹션 레이블 등)
```

### 1-D. 변수 삽입 형식

숫자·고유명사가 들어가는 자리는 플레이스홀더로 표시한다.

```json
// ko.json
"prestige.transition.execute": "압축 초기화.\n양자 거품 +{qf_gained} 적립.\n{layer_name} 진입."

// en.json
"prestige.transition.execute": "Compression reset.\nQuantum Foam +{qf_gained} accumulated.\nEntering {layer_name}."
```

`{변수명}` 형식으로 통일한다. 언어마다 어순이 달라도 플레이스홀더가 자유롭게 재배치 가능하다.

### 1-E. 복수형 처리

한국어는 복수형이 없고 영어는 있다. 필요 시 다음 두 키를 쌍으로 정의한다.

```json
"toast.particle_discovered.singular": "{particle_name} — recorded in the Codex.",
"toast.particle_discovered.plural":  "{count} particles recorded."
```

현재 텍스트 규모에서 복수형이 필요한 케이스는 소수이므로 개별 처리가 충분하다.

### 1-F. 추가 언어 확장 여지

`ko.json` / `en.json` 이외 언어는 `_template.json`(키만 있고 값이 빈 파일)을 복사해 시작한다. i18n 로더는 언어 코드를 인자로 받아 파일을 동적으로 로드하므로 파일 하나 추가로 신규 언어가 지원된다. 코드 변경 없음.

---

## 2. 번역 대상 인벤토리

`asset-list.md` §3-C 기준, 텍스트 자산 약 170개 조각의 카테고리별 분류와 예상 단어 수.

### 2-A. 카테고리별 인벤토리

| 카테고리 | 수량 | 한국어 추정 단어 수 | 영어 추정 단어 수 | 비고 |
|---|---|---|---|---|
| **입자 플레이버 (particle.*)** | 87개 (LEGENDARY 11 포함) | ~700 단어 | ~850 단어 | 각 1~2문장. 영어가 한국어보다 20~30% 길어짐. |
| **층 진입 비트 (layer.*)** | 11개 | ~150 단어 | ~180 단어 | 3문장 이내. 가장 톤 이식이 어려운 구간. |
| **상전이 메시지 (prestige.*)** | 7개 + 빅 크런치 시퀀스 | ~120 단어 | ~150 단어 | 빅 크런치 시퀀스는 3단계 분리. |
| **시그니처 로그 (log.*)** | 6개 | ~60 단어 | ~70 단어 | `[LOG]` 접두사 포함. |
| **UI 카피 (ui.*)** | ~35개 항목 | ~80 단어 | ~100 단어 | 버튼·탭·상태 표시. 극도로 짧음. |
| **FTUE 온보딩 (ftue.*)** | ~10개 단계 | ~80 단어 | ~100 단어 | 첫 5분. 단계별 1문장. |
| **오프라인 복귀 모달 (offscreen.*)** | 1세트 (3~4 변형) | ~60 단어 | ~75 단어 | 시간대별 변형 포함. |
| **토스트 (toast.*)** | ~8개 | ~40 단어 | ~50 단어 | 2초 표시. 가장 짧은 단위. |
| **재하강 카드 (redescent.*)** | 6개 (서브층 선택) | ~60 단어 | ~75 단어 | V1 단계. |
| **연구 노드 이름 (research.name.*)** | 52개 이름 | ~80 단어 | ~100 단어 | 기능 암시하는 간결한 명사. |
| **연구 노드 툴팁 (research.tooltip.*)** | 52개 1문장 | ~200 단어 | ~250 단어 | "~한다." 1문장 고정. |
| **도감 UI 텍스트 (codex.*)** | ~15개 항목 | ~40 단어 | ~50 단어 | 섹션 레이블, 완성도 바 등. |

**총계: 약 1,670 단어(한국어) / 약 2,050 단어(영어)**

실제 번역 발주 기준은 영어 단어 수 기준으로 산출한다 (~2,050 단어). 영어 전문 번역 시장 단가 적용 시 소규모 인디 예산 내에서 처리 가능한 분량이다.

### 2-B. 단계별 번역 우선순위

| 단계 | 번역 필요 항목 | 영어 단어 수 감 |
|---|---|---|
| **수직 슬라이스(VS)** | UI 카피 전량 + FTUE + 오프라인 모달 + L1·L2·L6 입자 플레이버 (~30개) + 층 비트 5개(분자~쿼크) + 첫 상전이 메시지 | ~650 단어 |
| **v1.0 Steam** | 나머지 전량 (나머지 입자 ~57개 + 나머지 층 비트 6개 + 상전이 6개 + 연구 노드 전량 + 재하강 카드) | +~1,400 단어 |
| **POST** | 집중 서브층 심화 입자 ~18개 + 심화 노드 ~12개 플레이버 | +~400 단어 추정 |

---

## 3. 영어 번역 워크플로

### 3-A. 번역 접근 방법 선택

이 게임의 번역은 일반 게임 현지화와 다른 두 가지 난점이 있다.

1. **입자 물리 전문 용어의 정확성**: 표준 모델 입자의 영문 명칭은 정해져 있다. "업 쿼크(up quark)", "강한 핵력(strong nuclear force)" 같은 용어를 임의로 번역하면 게임의 신뢰가 무너진다.

2. **보이스 이식**: 한국어의 "냉정하고 정확하되 발견 앞에서는 경이를 숨기지 않는다"는 톤이 영어에서도 살아야 한다. 이것은 직역이 아니라 **톤 번역**이다. §5에서 별도로 다룬다.

**권장 방식: 과학 게임 경험 있는 전문 번역가 + 감수 패스**

| 옵션 | 비용 | 품질 | 권장 여부 |
|---|---|---|---|
| 전문 번역가 (과학/게임 겸) | 중상 | 높음 | **1순위** |
| 기계번역(DeepL 등) + 감수 | 낮음 | 용어 정확도 리스크 있음 | VS 단계 임시로만 |
| 일반 게임 번역가 | 중 | 물리 용어 오류 가능성 | 물리 감수 병행 시 가능 |

**핵심**: 번역가 브리핑 시 §4 용어집과 §5 보이스 가이드를 함께 전달해야 한다. 용어집 없이 발주하면 "Preon"이 문서마다 달라지고, 보이스 가이드 없이 발주하면 영어 플레이버가 홍보 카피처럼 변한다.

### 3-B. 번역 시점

```
[수직 슬라이스 완성]
       │
       ▼
[VS 텍스트 확정 (~650 단어)]  ← 이 시점에 첫 번역 발주
       │
       ▼
[번역가 + 물리 감수 패스]  (약 2주 소요 예상)
       │
       ▼
[v1.0 빌드 직전 — 나머지 텍스트 확정]  ← 2차 발주 (+~1,400 단어)
       │
       ▼
[번역 + 인게임 검증]  (레이아웃 깨짐 점검 포함 — §6)
```

**"텍스트 확정 이후 발주" 원칙**: 번역 중에 원문이 바뀌면 재번역 비용이 발생한다. 각 단계에서 텍스트가 잠긴(locked) 뒤에 번역을 시작한다.

### 3-C. 검수 프로세스

1. **물리 용어 검수**: 실제 입자 물리 용어(§4-A)가 표준 영문 표기를 따르는지 확인. 번역가가 물리 배경이 없으면 이 단계가 필수.
2. **보이스 검수**: §5 영어 보이스 원칙을 기준으로 문장 하나씩 점검. 특히 AI 슬롭 패턴(§5-C) 필터링.
3. **인게임 레이아웃 검수**: §6 폰트·레이아웃 점검 항목과 함께 실제 빌드에서 확인.

---

## 4. 용어집 (Glossary)

이 용어집은 한국어와 영어가 **동일한 개념을 항상 동일한 단어로** 가리키는 것을 보장한다. 번역가에게 필수 제공 자료다.

### 4-A. 실제 입자 물리 용어 — 표준 표기 고정

알려진 물리 용어는 표준 영문 표기를 따른다. 임의 번역 금지.

| 한국어 | 영어 | 비고 |
|---|---|---|
| 쿼크 | quark | 6종: up / down / strange / charm / bottom / top |
| 업 쿼크 | up quark | |
| 다운 쿼크 | down quark | |
| 이상 쿼크 | strange quark | "낯선 맛" = strangeness (-1) |
| 맵시 쿼크 | charm quark | |
| 바닥 쿼크 | bottom quark | |
| 탑 쿼크 | top quark | |
| 렙톤 | lepton | |
| 전자 | electron | |
| 뮤온 | muon | |
| 타우 렙톤 | tau lepton | |
| 전자 중성미자 | electron neutrino | |
| 뮤온 중성미자 | muon neutrino | |
| 타우 중성미자 | tau neutrino | |
| 보손 | boson | |
| 광자 | photon | |
| 글루온 | gluon | |
| W 보손 | W boson | |
| Z 보손 | Z boson | |
| 힉스 보손 | Higgs boson | |
| 양성자 | proton | |
| 중성자 | neutron | |
| 핵자 | nucleon | |
| 하드론 | hadron | |
| 바리온 | baryon | |
| 메손 | meson | |
| 파이온 | pion | |
| 강한 핵력 | strong nuclear force | "강력"도 병행 가능 |
| 약한 핵력 | weak nuclear force | "약력"도 병행 가능 |
| 색전하 | color charge | |
| 점근 자유 | asymptotic freedom | |
| 표준모형 | Standard Model | 항상 대문자 |
| 핵결합 에너지 | nuclear binding energy | |
| 쿼크-글루온 플라즈마 | quark-gluon plasma | |
| 플랑크 길이 | Planck length | |
| 불확정성 원리 | uncertainty principle | |
| 핵이성질체 | nuclear isomer | |

### 4-B. 게임 고유 자원·시스템 용어

게임 내 자원과 시스템 이름. 영어판에서 동일하게 유지한다.

| 한국어 | 영어 | 약칭 | 비고 |
|---|---|---|---|
| 압축 에너지 | Compression Energy | E | |
| 압축 깊이 | Compression Depth | C | |
| 발견 데이터 | Discovery Data | D | |
| 양자 거품 | Quantum Foam | QF | "quantum foam"은 실제 물리 용어이기도 함 — 일관 사용 |
| 반경 | radius | r | 소문자. 과학 표기 그대로 |
| 압축기 | Compressor | — | "Tier-k Compressor" 형식 |
| 상전이 | Phase Transition | PT | 탭 이름으로도 사용 |
| 빅 크런치 | Big Crunch | — | 우주론 용어에서 차용. 대문자 고정 |
| 재하강 | Redescent | — | 게임 고유 조어. "re-descent"로 쓰지 않음 |
| 도감 | Codex | — | |
| 연구 트리 | Research Tree | — | |
| 집중 서브층 | Focus Sub-Layer | — | 재하강 회차별 선택 서브층 |
| 오비탈 공명 | Orbital Resonance | — | L2 메커니즘 |
| 핵력 게이지 | Nuclear Force Gauge | — | L3 메커니즘 |
| 색전하 삼원합일 | Color Charge Trinity | — | L4 메커니즘. "Tricolor Fusion"은 금지 |
| 위상 겹침 | Phase Overlap | — | L6 메커니즘 |
| 진동 하모닉스 | Vibrational Harmonics | — | L7 메커니즘 |
| 스핀 네트워크 | Spin Network | — | L8 메커니즘. 루프 양자중력 용어 그대로 |
| 불확정 요동 | Quantum Fluctuation | — | L9 메커니즘 |
| 홀로그래픽 인코딩 | Holographic Encoding | — | L10 메커니즘 |
| 시공간 픽셀 붕괴 | Spacetime Pixel Collapse | — | L11 메커니즘. 게임 고유 표현 |

### 4-C. 상상 입자 — 게임 고유 이름

미지 영역(쿼크 아래) 상상 입자. 이름은 고유 조어이므로 번역하지 않고 영문 표기를 그대로 사용한다. 단, 영어 플레이버에서 이름의 뉘앙스가 자연스럽게 전달되는지 확인이 필요하다.

| 한국어 이름 | 영어 이름 | 층 | 어원 |
|---|---|---|---|
| 프리온 | Preon | L6 | "pre-quark"에서. 실제 이론 용어와 동일. |
| 양위상 프리온 | P⁺ (Positive-Phase Preon) | L6 | |
| 음위상 프리온 | P⁻ (Negative-Phase Preon) | L6 | |
| 중립위상 프리온 | P⁰ (Neutral-Phase Preon) | L6 | |
| 위상 진공 | Phase Vacuum | L6 | |
| 위상 매듭 | Phase Knot | L6 | |
| 개방끈 | Open String | L7 | 끈이론 표준 용어 |
| 폐쇄끈 | Closed String | L7 | 끈이론 표준 용어 |
| 타키온 끈 모드 | Tachyon String Mode | L7 | |
| D-브레인 | D-brane | L7 | 끈이론 표준 용어 |
| 중력자 끈 모드 | Graviton String Mode | L7 | |
| 스핀 포말 | Spin Foam | L8 | 루프 양자중력 용어 |
| 버추온 | Virteon | L9 | 게임 고유 조어. "virtuality"에서. |
| 베켄슈타인 홀론 | Bekenstein Holon | L10 | 베켄슈타인 엔트로피에서. |
| 플랑크온 | Planckton | L11 | 게임 고유 조어. |

### 4-D. UI 카피 — 고정 번역

버튼과 탭 이름은 이후 혼용 방지를 위해 여기서 고정한다.

| 한국어 | 영어 |
|---|---|
| 압축 (버튼) | Compress |
| 압축 중 | Compressing |
| 다음 층으로 | Next Layer |
| 미지 영역으로 | Into the Unknown |
| 압축 계속 | Continue |
| 압축 (탭) | Compression |
| 연구 (탭) | Research |
| 도감 (탭) | Codex |
| 상전이 (탭) | Phase |
| 설정 (탭) | Settings |
| 미지 진입 (탭 레이블 변경 시) | Unknown ● |
| 더 작은 것이 있다. | There is something smaller. |
| 재하강 | Redescent |
| 재압축 | Recompression |
| 이전 런 완료. 양자 거품 +{N} 적립. | Run complete. Quantum Foam +{N} accumulated. |
| 새 압축 시퀀스 준비. | New compression sequence ready. |
| 양자 거품 {N} 누적 | Quantum Foam: {N} accumulated |
| 이전 관측: 유지 | Previous observations: retained |
| 붕괴가 아니다. | This is not collapse. |
| 재압축이다. | This is recompression. |
| 다시 내려간다. | Descending again. |
| 계속 내려간다. | Continuing the descent. |

---

## 5. 톤 이식 — 영어 보이스 가이드

이 섹션이 이 문서에서 가장 중요하고 가장 어려운 부분이다. 한국어 보이스의 정수를 영어로 옮기는 것은 단어 대 단어 번역으로 불가능하다. 번역가가 이해해야 할 것은 문장이 아니라 **말하는 태도**다.

### 5-A. 보이스 한 줄 정의 (영어판)

**"The Compression Log: precise and dispassionate — but in the presence of discovery, wonder is not concealed."**

이것은 한국어 원문의 번역이 아니라, 영어 독자에게 같은 **질감**으로 도달하는 재표현이다.

### 5-B. 영어 보이스의 네 가지 원칙

**원칙 1: 과학 문서 스타일, 단 단독으로 서지 않는다**

영어 플레이버는 논문 초록처럼 읽혀야 하지만, 절대 건조하기만 해서는 안 된다. 정확한 수치를 먼저 말하고, 마지막 문장에서 그 수치가 무엇을 의미하는지 — 한 단어 또는 짧은 구절로 — 열어놓는다.

```
// 이렇게
"Mass: 9.389×10⁸ eV/c². The pillar at the center of every nucleus."

// 이렇게 하지 않음
"The proton — the amazing cornerstone of atomic structure!"
```

**원칙 2: 수동태 사용 금지, 단 주어를 과대하게 키우지 않음**

영어 과학 문체에는 수동태가 많지만, 이 게임의 텍스트는 능동태를 선호한다. 단, 주어는 연구소장(Director)이 아니라 **입자 자체**, **측정값**, **현상**이다.

```
// 이렇게
"The strong force binds these together. The energy cost is 99% of the proton's mass."

// 이렇게 하지 않음
"You observe the strong force binding these quarks."
// 이렇게도 하지 않음
"These quarks are bound by the strong force." (수동태)
```

**원칙 3: 감탄사 없음. 느낌표는 빅 크런치 한 번을 위해 아껴둔다**

한국어 원칙과 동일하게 적용된다. "Amazing", "Incredible", "Fascinating" — 단독으로 쓰이는 강조 형용사는 모두 금지한다.

**원칙 4: 미지 영역에서는 불확실성을 문장 구조로 드러낸다**

알려진 입자: 직설법. 수치는 사실이다.
가설 입자: "proposed", "predicted", "if this exists" — 가능성 조건부.
미지 입자: "observed", "readings suggest", "analysis ongoing" — 측정값이지 결론이 아님.

```
// 미지 입자 (금지)
"This particle proves the existence of sub-quark structure."

// 미지 입자 (허용)
"Readings consistent with a sub-quark structure. The Standard Model did not predict this."
```

### 5-C. 영어판 AI 슬롭 금지 목록

한국어 `narrative.md` §2-D의 영어 대응 목록. 아래 표현이 번역문에 등장하면 재번역을 요청한다.

| 금지 영어 표현 | 이유 |
|---|---|
| "breathtaking", "awe-inspiring", "mind-blowing" | 단독 형용사 감탄 — 보이스 위반 |
| "the secrets of the universe" | 모호한 미스터리 흘리기 |
| "journey", "adventure", "explore" | 이 게임은 실험이다 |
| "unlock the mysteries" | 직접 보여준다. 서술하지 않는다 |
| "incredible discovery" | 단독 강조 형용사 |
| "pushes the boundaries of science" | 홍보 카피 어조 |
| "you have discovered" | 2인칭 직접 호명 — 연구소장은 관찰자, 서술 대상이 아님 |
| 느낌표 남용 | 빅 크런치 외 금지 |

### 5-D. 영어 예시 — 보이스 비교 대조

한국어 exemplar(narrative.md §3)의 영어 변환 예시. 직역이 아닌 톤 이식의 실례.

---

**[전자 / Electron]**

한국어 원문:
> 질량 0.511 MeV/c². 원자를 원자이게 하는 껍질. 오비탈에만 존재하며 그 사이는 없다. 있거나, 없거나.

영어 톤 이식:
> Mass: 0.511 MeV/c². The shell that makes an atom what it is. It exists in orbitals — and nowhere in between. Present or absent. Nothing else.

---

**[양성자 / Proton]**

한국어 원문:
> uud — 업쿼크 둘, 다운쿼크 하나. 강력이 이것을 묶는 데 소비하는 에너지가 양성자 질량의 99%를 차지한다. 내부는 거의 비어있다. 무게의 대부분은 힘이다.

영어 톤 이식:
> uud — two up quarks, one down. The energy spent binding them accounts for 99% of the proton's mass. Inside: mostly empty. Most of the weight is the force.

---

**[프리온-플러스 (P+)]**

한국어 원문:
> 쿼크의 하위 구성 요소로 제안된 세 가지 중 하나. 위상 응집 상태에서만 측정 가능하다. 스탠다드 모델은 이 존재를 예측하지 않는다. 데이터는 존재를 암시한다.

영어 톤 이식:
> One of three proposed sub-quark constituents. Observable only in phase-coherent states. The Standard Model does not predict this. The data suggests otherwise.

---

**[빅 크런치 "재압축이다." 시퀀스]**

한국어 원문:
> 붕괴가 아니다. / 재압축이다.

영어 톤 이식:
> This is not collapse. / This is recompression.

*노트: 이 두 문장은 직역에 가깝다. 한국어의 간결함이 영어에서도 그대로 작동한다. "This is not the end — this is a new beginning!"처럼 늘리지 말 것.*

---

**[층 진입 비트 — 쿼크층 / Quark Layer]**

한국어 원문:
> 쿼크 스케줄 진입. 1×10⁻¹⁸ m.
> 표준 모델이 예측하는 마지막 구조물이 여기다.
> 이 이하는 아직 아무것도 측정된 적 없다.

영어 톤 이식:
> Quark scale. 1×10⁻¹⁸ m.
> The last structure the Standard Model predicted.
> Below this — nothing has ever been measured.

*노트: "이 이하는 아직 아무것도 측정된 적 없다"의 직역 "Nothing below this has ever been measured"보다 "Below this — nothing has ever been measured"가 리듬이 맞고 단절감을 더 잘 전달한다. 어순 조정은 톤 이식의 핵심.*

---

### 5-E. 번역가 브리핑 자료 패키지

번역 발주 시 번역가에게 전달할 자료 목록. 이것 없이는 발주하지 않는다.

1. 본 섹션 §5 전체 (영어 보이스 가이드)
2. §4 용어집 전체 (4-A~4-D)
3. `narrative.md` §3 exemplar 8개 + §5-D 영어 변환 예시 (기준 샘플)
4. 금지 표현 목록 (§5-C)
5. 각 텍스트 카테고리의 맥락 메모 (입자 플레이버 = 도감 발견 시 표시, 층 비트 = 스케일 진입 순간, 상전이 = 게임플레이 장벽 도달 등)

---

## 6. 폰트·레이아웃

### 6-A. 한글과 라틴 공존 원칙

한국어(기준)와 영어를 동시에 지원하므로, 폰트는 한글 글리프와 라틴 글리프를 모두 포함하거나, 한글 폰트와 라틴 폰트가 자연스럽게 매칭되어야 한다.

**권장 조합**:

```
모노스페이스 (게임 로그·수치·플레이버 텍스트):
  한국어: "IBM Plex Mono KR" 또는 "D2Coding"
  영어:   "IBM Plex Mono"
  → IBM Plex Mono 패밀리는 한글·라틴 메트릭이 동일해 레이아웃 안정.

UI 레이블 (버튼·탭):
  한국어: "Noto Sans KR"
  영어:   "Noto Sans"
  → Google Fonts. 레이아웃 호환성 최고. 번들 크기 주의 — 서브셋 필수.

수치 표시 (과학 표기 r·E·C):
  "IBM Plex Mono" (영어 전용 가능 — 수치에 한글 없음)
```

**폰트 번들 전략**: NW.js 패키징 시 전체 한글 폰트를 포함하면 수십 MB가 증가한다. 사용 글자 기준 서브셋을 빌드 파이프라인에 추가해 필요한 글리프만 포함한다.

### 6-B. 영어가 한국어보다 길어지는 구간

영어 텍스트는 한국어보다 약 20~40% 길다. 다음 구간에서 레이아웃 깨짐 위험이 높다.

| 위험 구간 | 한국어 예 | 영어 예 | 대응 |
|---|---|---|---|
| 버튼 레이블 | `압축 계속` (4자) | `Continue` (8자) | 버튼 min-width 여유 설정 |
| 탭 이름 | `상전이` (3자) | `Phase` (5자) | 탭 폭 가변 처리 |
| 층 진입 비트 | 3줄 이내 | 3줄 초과 가능 | 텍스트 컨테이너 최대 줄 수 제한 + 스크롤 또는 폰트 축소 |
| 입자 플레이버 | 1~2줄 | 2~3줄 가능 | 도감 카드 높이 가변 처리 |
| 상전이 메시지 | 짧은 행 단위 | 행 길이 증가 | 중앙 정렬 → 좌측 정렬 전환 검토 |
| 오프라인 복귀 모달 | ~40자/행 | ~55자/행 | 모달 폭 여유 또는 줄 바꿈 조정 |

**원칙**: UI 레이아웃은 영어 기준 최대 길이를 수용할 수 있게 설계한다. 한국어는 짧아서 여백이 생기므로 문제없다.

### 6-C. 레이아웃 검수 체크리스트

번역 후 인게임 확인 항목. game-programmer 또는 QA가 실행.

```
[ ] 버튼 레이블 잘림 없음 (모든 상태)
[ ] 탭 이름 전체 표시 (활성·비활성)
[ ] 층 진입 비트 텍스트 컨테이너 이탈 없음
[ ] 도감 카드 플레이버 텍스트 overflow 없음
[ ] 상전이 화면 메시지 레이아웃 정상
[ ] 오프라인 복귀 모달 텍스트 잘림 없음
[ ] 시그니처 로그 (`[LOG]` 포함) 1줄 내 표시
[ ] 토스트 2초 표시 시 레이아웃 안정
[ ] r 게이지 아래 수치 표시 (`3.81×10⁻¹¹ m`) 레이아웃 안정
[ ] 빅 크런치 시퀀스 텍스트 순차 등장 타이밍 정상
```

---

## 7. 추가 언어 진입 여지

v1.0 출시 후 중국어(간체)·일본어 등 추가가 논의될 경우 대비.

**지금 막지 않는 조치 (설계 단계)**:

1. `data/locale/` 구조가 언어 코드 파일 추가로만 확장된다. 코드 수정 없음.
2. 폰트 스택에 CJK 공통 처리 고려: "IBM Plex Mono KR"의 경우 일본어·중국어 글리프는 포함되지 않으므로, 추가 언어 시 CJK 폰트 추가 필요 — 사전 인지.
3. 텍스트 컨테이너가 언어별 길이 변화를 수용할 수 있게 가변 높이로 설계.

**지금 결정하지 않는 것**: 중국어 번역의 실제 발주 시점, 간체·번체 선택, 현지 마케팅 전략 — 출시 후 판매 데이터 기반으로 결정한다. 구조가 막지 않으면 충분하다.

---

## 8. 현지화 담당·의존 체인

| 작업 | 담당 | 선행 조건 | 시점 |
|---|---|---|---|
| i18n 로더 구현 (`t(key)` 함수, 폴백 로직) | game-programmer | `ko.json` 스키마 확정 | 프로토타입 |
| `ko.json` 초기 키 구조 설정 | game-programmer + narrative-designer | 본 문서 §1 확정 | 프로토타입 |
| 입자 플레이버 한국어 완성 | narrative-designer | `codex.md` 87입자 데이터 확정 | VS~V1 |
| 연구 노드 툴팁 한국어 완성 | narrative-designer | `research-tree.md` 52노드 확정 | V1 |
| 용어집·브리핑 패키지 준비 | narrative-designer | 텍스트 확정 시점 | VS 졸업 직후 |
| 영어 번역 발주 (1차 ~650 단어) | — | VS 텍스트 확정 + 용어집 | VS 졸업 직후 |
| 영어 번역 물리 감수 | — (외부 또는 팀 내) | 1차 번역 완성 | V1 빌드 직전 |
| 영어 번역 발주 (2차 ~1,400 단어) | — | V1 텍스트 확정 | V1 빌드 2~3주 전 |
| 인게임 레이아웃 검수 | game-programmer + QA | 영어 텍스트 인게임 적용 | V1 QA 패스 |
| 폰트 서브셋 빌드 파이프라인 | game-programmer | 최종 사용 글자 확정 | V1 빌드 |

---

## 9. 관련 문서

- `narrative.md` §2 (보이스 바이블), §3 (플레이버 exemplar), §5 (UI 카피)
- `codex.md` (87입자 데이터 — 플레이버 텍스트 대상)
- `research-tree.md` (52노드 — 이름·툴팁 대상)
- `tech-architecture.md` §4.4 (`data/` 텍스트 분리 구조)
- `ux.md` §5 (상전이·FTUE·오프라인 카피 확정 기준)
- `asset-list.md` §3-C (내러티브 텍스트 에셋 목록 — CN-01~CN-08)
