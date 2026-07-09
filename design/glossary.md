# 용어집 (Glossary v0.1)

- 작성: 2026-06-26
- 목적: 모든 설계·기술·프로덕션 문서에 흩어진 용어를 **한곳에 정의**한다. 신규 합류자·문외한·번역가가 어떤 문서를 읽다가도 이 파일 하나로 용어를 확인할 수 있게 하는 **단일 참조점**이다.
- 범위: `GDD.md`, `economy.md`, `systems.md`, `codex.md`, `tech-architecture.md`, `scope-mvp.md`, `roadmap.md`, `localization-plan.md` 등에서 추출.
- 정합 규칙: **한↔영 병기는 `localization-plan.md` §4 용어집을 단일 진실 소스로 따른다.** 실제 물리 용어는 표준 영문 표기를 쓴다(임의 번역 금지). 게임 고유 조어(Redescent, Virteon, Planckton 등)는 영문 표기를 그대로 유지한다.
- 표기: 각 용어 = **한 줄 정의 + (해당 시) 출처 문서 §**. 수식·수치는 해당 문서가 단일 진실 소스이며, 여기서는 의미만 요약한다.

> 본 문서는 정의를 모으는 참조 문서다. 수식의 확정값·검증은 항상 출처 문서(특히 `economy.md`)가 우선한다.

---

## 0. 빠른 색인 (카테고리)

1. [게임 개념](#1-게임-개념-game-concepts)
2. [경제·수식](#2-경제수식-economy--formulas)
3. [기술](#3-기술-technical)
4. [프로덕션·필러](#4-프로덕션필러-production--pillars)
5. [입자 도감 용어](#5-입자-도감-용어-codex-terms)
6. [약어 풀이표](#6-약어-풀이표-abbreviations)
7. [가나다 색인](#7-가나다-색인)

---

## 1. 게임 개념 (Game Concepts)

| 한국어 | 영어 | 정의 | 출처 |
|---|---|---|---|
| **압축 / 압축 깊이** | Compression / Compression Depth (`C`) | 물질을 더 작게 누르는 코어 행위·자원. `C`는 천문학적으로 커지되 화면엔 반경 `r`만 보인다("작아짐=강해짐"의 구현). | GDD §5, eco §1 |
| **반경** | radius (`r`) | 현재 압축 대상의 크기(m). `r = r₀·10^(−dec)`, r₀=1e-9 m(분자). 작아지는 쪽이 진행 방향. | GDD §7, eco §1 |
| **decade / dec** | decade | 압축 진행을 로그로 측정한 단위. `dec = α·log₁₀(C+1)`, α=0.65. dec0(분자)~**dec26(플랑크, 캡)**. | GDD §7, eco §2.2 |
| **상전이 (PT)** | Phase Transition | 미지 서브층 경계(게임플레이 벽)에 도달해 현재 런을 리셋하고 QF를 얻으며 다음 서브층으로 넘어가는 프레스티지. **총 7회**(미지 6벽 + 빅 크런치). | GDD §9, sys §5 |
| **빅 크런치** | Big Crunch | 플랑크(dec26) 도달 시 발동하는 최종 프레스티지(PT7). 최종 QF 폭발 → dec0 재시작. **엔딩이 아니라 재하강 루프의 입구.** | GDD §9, sys §2-J |
| **재하강** | Redescent | 빅 크런치 후 lifetime_C·QF를 유지한 채 dec0부터 다시 내려가는 반복 메타 루프. 멀티위크 리텐션의 엔진. ("re-descent"로 쓰지 않음) | eco §4.4, sys §2-K |
| **양자 거품 (QF)** | Quantum Foam | 상전이로 얻는 영구 통화. 영구 생산 배율의 원천. `lifetime_C` 단일 모델로 산출. | GDD §5, eco §1.1 |
| **lifetime_C** | lifetime_C | 모든 런에 걸쳐 누적된 압축 깊이 `C`(AdCap식). QF 산출의 기준이며 재하강 간 보존된다. | GDD §5, eco §1.1 |
| **압축기 8단 체인 (T1~T8)** | 8-Tier Compressor Chain | 코어 엔진. Tier k가 Tier k−1을 생산, T1이 `C`를 생산하는 자기증식 구조(Antimatter Dimensions 골격). | GDD §6 |
| **압축 에너지** | Compression Energy (`E`) | 압축기 체인이 생산하는 자원. 압축기·자동화·연구 구매에 사용. | GDD §5 |
| **발견 데이터 (D)** | Discovery Data | 새 입자 발견·메커니즘 이벤트로 얻는 자원. 연구 트리 구매에 사용. `D_current`(현재 런) / `D_lifetime`(누적) 구분. | GDD §5, sys §3-3 |
| **도감 완성도** | Codex Completion | 수집한 입자 비율(0~1). `collected_discoverable / 76`. 홀로그래픽 배율의 입력. | codex §13-3, eco §7.1 |
| **홀로그래픽 배율** | Holographic Multiplier (`holographic_mult`) | 정보층(L10) 메커니즘. 도감 완성도²·0.35 + D항으로 구성, 생산에 곱해짐(상한 ≤×1.35). | sys §2-I, eco §7.2.3 |
| **집중 서브층** | Focus Sub-Layer | 재하강 2회차+에서 6개 미지 서브층 중 1개를 골라 심화 입자·노드를 해금하는 회차별 선택. 재하강 정성 차별화의 핵심. | sys §2-K, eco §7.5 |
| **층 (레이어)** | Layer | 스케일 한 칸. 총 11층(알려진 물리 5 + 미지 6). "층 진입 ≠ 상전이". | sys §1-2 |
| **알려진 물리 5층** | Known-Physics Layers | 분자·원자·핵·핵자·쿼크(dec0~9 + 쿼크 꼬리 dec9~19). **상전이 없는 온보딩** 구간. | GDD §9, sys §5-1 |
| **미지 서브층 6개** | Unknown Sub-Layers | 프리온·끈·루프·거품·정보·플랑크. 상전이와 1:1 대응, 각 체류 ≥4h. | sys §1-2 |
| **재하강 차별화** | Redescent Differentiation | 재하강이 매 회차 다른 결로 느껴지게 하는 설계. = 회전 집중 서브층(정성) + 방치/개입 분리. | eco §7.5, sys §2-K |
| **서사 스케일 / 게임플레이 벽** | Narrative Scale / Gameplay Wall | 도감·내러티브 표기용 측정 스케일(1e-19 등)과 실제 압축 장벽(dec19~26)은 **별개 좌표계**. | GDD §9, sys §1-1 |
| **코어 루프** | Core Loop | 초(압축 클릭)→분(체인·연구 구매)→시간(상전이) 단위로 중첩되는 게임의 주기 구조. | GDD §4 |
| **층별 메커니즘** | Per-Layer Mechanic | "한 층=한 새로움" 원칙으로 각 층에 1개씩 부여되는 고유 시스템(아래 목록). | sys §2 |
| ─ 오비탈 공명 | Orbital Resonance | 원자층(L2). 슬롯 클릭으로 단기 체인 배율 + D 획득. | sys §2-A |
| ─ 핵력 게이지 | Nuclear Force Gauge | 핵층(L3). 게이지 만충 시 핵결합 이벤트(C 스파이크). | sys §2-B |
| ─ 색전하 삼원합일 | Color Charge Trinity | 핵자층(L4). 3색전하(Cr/Cg/Cb) 균형 → 하드론 합성 보너스. | sys §2-C |
| ─ 점근 자유 가속 | Asymptotic Freedom Burst | 쿼크층(L5). α 계수를 일시 낮춰 r 감소를 가속(로그 저항 역전). | sys §2-D |
| ─ 위상 겹침 | Phase Overlap / Superposition | 프리온층(L6). 응집/분산/공명 상태 전환으로 자원 우선순위 선택. | sys §2-E |
| ─ 진동 하모닉스 | Vibrational Harmonics | 끈층(L7). 진동 에너지 V 누적 → 특정 티어 공명 폭발. | sys §2-F |
| ─ 스핀 네트워크 | Spin Network | 루프층(L8). 노드·엣지 토폴로지를 직접 설계해 배율 유형 결정. | sys §2-G |
| ─ 불확정 요동 | Quantum Fluctuation | 거품층(L9). 랜덤 요동 이벤트(하향 요동 존재, 장기 평균 양). | sys §2-H |
| ─ 홀로그래픽 인코딩 | Holographic Encoding | 정보층(L10). 누적 D·도감 완성도가 생산 효율에 직결. | sys §2-I |
| ─ 시공간 픽셀 붕괴 | Spacetime Pixel Collapse | 플랑크층(L11). r이 플랑크 길이에 닿으면 빅 크런치 발동. | sys §2-J |

---

## 2. 경제·수식 (Economy & Formulas)

> 모든 수치의 단일 진실 소스 = `economy.md`. 아래는 의미 요약이며 확정값은 출처를 따른다.

| 용어 | 정의 | 출처 |
|---|---|---|
| **base_rate** | 영구 생산 부스트 계수. `production_mult = 1 + base_rate·log₁₀(1+QF_total)`, **base_rate=0.25**(race 안전 구간, 0.5는 붕괴). | eco §1.1 |
| **production_mult** | 전체 생산에 곱해지는 종합 배율. = (1 + base_rate·log₁₀(1+QF)) × holographic_mult × research_mult. | eco §7.2.6 |
| **QF_total / QF_gain** | `QF_total = floor(K·(lifetime_C/D_norm)^0.5)`, K=1, D_norm=1e26, e=0.5(제곱근). QF_gain = QF_total − QF_claimed. | eco §1.1 |
| **K (QF 계수)** | QF 산출 선형 계수. 기본 1.0. **베켄슈타인 홀론 해금 시 1.05**(빅 크런치 QF +5%). | eco §7.4 |
| **D_norm** | QF 정규화 상수 = 1e26. lifetime_C를 QF로 환산하는 분모. | eco §1.1 |
| **base_k** | 압축기 티어 비용 계수. `base_k = 10^(1 + 1.3·k)`. (GDD 구판 10^(1+2k)에서 하향 확정.) | eco §2.1 |
| **growth_k** | 티어 비용 성장률. `growth_k = 2.2 − (0.4/7)·(k−1)` = T1 2.2 … T8 1.8 내림차순. | eco §2.1 |
| **cost_k(n)** | 압축기 k의 n번째 비용 = `base_k · growth_k^n`. | eco §2.1 |
| **곡선 B** | 도감 보너스 램프 곡선 = `bonus(c) = 0.35·c²`(후반 가중, 제곱). 완주 c=1.0 → +0.35×. 선형·로그 대비 중반 헤드룸 최대. | eco §7.1, codex §13-3 |
| **codex_bonus_factor** | 도감 곡선 B의 계수 = **0.35**. 완성도 1.0에서 holographic_mult에 +0.35× 기여. 미세조정 밴드 0.32~0.35. | eco §7.1 |
| **holo_factor** | 홀로그래픽 D항 계수 = **0.008**. `D항 = log₁₀(D_total+1)·holo_factor`(기여 상한 +5.8%). D_total ≲ 1e7 가정. | eco §7.2.3 |
| **codex항 / D항** | holographic_mult의 두 서브풀. codex항(곡선 B, ≤+0.35×) + D항(holo_factor, ≤+5.8%). 별도 서브예산. | eco §7.2.3 |
| **research_mult** | 연구 시너지 배율. C안 채택으로 **≈1.0**(A13/B8/B12를 production_mult 상수곱 밖으로 분리). | eco §7.2.1 |
| **6벽 (WALLS)** | 미지 서브층 6개의 게임플레이 벽 = `WALLS = [19, 21.5, 23, 24.5, 25.5, 26]`(후반 가중, 각 체류 ≥4h). | eco §0, §1.2 |
| **상전이 7회** | 6벽(PT1~PT6) + 빅 크런치(PT7). decade는 dec26에서 캡. | eco §1.2 |
| **30% 가드레일** | 도감·연구 배율이 dec26 벽을 단축하는 한도. 전체 추가곱 H < ×1.4286(= −30%). 곡선 B 완주 −25.9%로 충족. | eco §7.2.3 |
| **마일스톤 배율(금지)** | 25/50/100/200→×2/×3/×5/×7은 dec26 벽 **−72% 파괴, 사용 금지.** 플레이버 ×1.1 이하로 대체. | eco §2.3 |
| **오프라인 공식** | `effective = capped × modifier × long_idle_bonus`. CAP=24h, modifier=0.65(상전이 직후 1.0), 48h 탬퍼 클램프, LB=0.5. | eco §3.1 |
| **탬퍼 클램프** | 시계조작 방어. `elapsed = min(now − last_save, 48h)` 하드 상한. 시계를 +1년 돌려도 최대 48h(유효 ~18h)만 지급. | eco §3.3 |
| **베켄슈타인 K (홀론)** | 베켄슈타인 엔트로피(S=A/4) 테마의 빅 크런치 QF 계수 상향(K 1.0→1.05). holographic 풀과 분리. | eco §7.4 |
| **D 보존율** | 빅 크런치 시 `D_current` 50% 이월 / `D_lifetime` 100% 보존. 회차 곡선 `[-,.65,.50,.40,.40,.38,.35]`. | eco §7.3 |
| **negative result (재하강)** | "비용 감소로 방치 캘린더 단축" = **불가능**. 방치 캘린더는 오프라인 캡·체크인 케이던스가 지배(~5.8일 고정). | eco §7.5.1 |
| **Race (레이스)** | 부스트 vs 인플레의 경쟁. 런 시간이 매 상전이 단조 증가하면 안전, 단축되면 붕괴(붕괴 시 벽 무력화). | eco §1.3 |

---

## 3. 기술 (Technical)

> 단일 진실 소스 = `tech-architecture.md`.

| 용어 | 정의 | 출처 |
|---|---|---|
| **F게이트 (F-Gate)** | 프로토타입 1일차에 코드 골격에 박는 4대 토대: F1 세이브 봉투 / F2 StorageAdapter / F3 고정 timestep / F4 break_eternity 경계. 나중 도입 비용이 큼. | roadmap §1-A |
| **세이브 봉투 (envelope)** | 최상위 3-필드 저장 포맷 `{ version, data, checksum }`. version은 평문(즉시 읽힘), data는 lz-string 압축, checksum은 변조·손상 탐지. | tech §1.2 |
| **StorageAdapter** | 저장소 추상화 레이어. read/write/exists/backup 인터페이스. 어댑터 3종(LocalStorage/IndexedDB/FileSystem)이 동일 인터페이스 구현 → 웹↔Steam 이식 시 게임 코드 0줄 수정. | tech §1.6 |
| **마이그레이션** | 세이브 버전 단방향 체인 변환(`migrate_v1_to_v2` …). 로드 시 순차 적용. 함수는 영원히 보존, 실패 시 `*.corrupt.bak` 보존(침묵 삭제 금지). | tech §1.3 |
| **체크섬** | 봉투의 무결성 값. 보안용이 아니라 **우연한 손상 검출 + 캐주얼 편집 억제 + 클라우드 충돌 판정**용. | tech §1.2 |
| **tick / render 분리** | 로직(tick, 고정 dt, 결정적)과 표현(render, requestAnimationFrame, 가변)을 독립 루프로 분리. 프레임드랍이 진행속도를 바꾸지 않음. | tech §4.1 |
| **고정 timestep / 누산기** | 경과시간을 모아 고정 dt 단위로 tick 0~N회 실행(catch-up). economy 시뮬(dt=1~2s)과 정합 → 검증 페이싱 재현. catch-up 상한 초과분은 오프라인 경로로. | tech §4.1 |
| **break_eternity.js** | 채택된 BigNumber 라이브러리(`Decimal`). 테트레이션(10^^1e308)~극소(10^-…) 표현. native float 게임수치 전면 금지. | tech §2.1 |
| **Decimal 경계** | 게임 "수치적 진실"(E·C·lifetime_C·QF·비용·배율)은 모두 Decimal. native number는 보유 개수·정확 카운터·타이머·UI 좌표만. | tech §2.2 |
| **data/ (데이터 주도)** | 입자 87·연구 노드 52·층·비용 파라미터를 코드가 아닌 데이터로 분리. economy/content 수치를 로직 수정 없이 주입·튜닝(Vite HMR). | tech §4.4 |
| **이벤트 버스 (event-hub)** | "상전이 발생"·"입자 발견"·"층 진입" 도메인 이벤트 발행/구독. 도감·내러티브·사운드·VFX가 tick 코드를 오염시키지 않게 분리. | tech §4.3 |
| **파생 캐시 (저장 안 함)** | 비용·생산량·dec·r·holographic_mult 등은 전부 파생값 → 저장 금지, 로드 후 재계산. | tech §1.1 |
| **lastSave 이중 기록** | 시계 무결성. last_save를 파일·Steam Cloud 양쪽에 기록하고 **최댓값** 채택(가장 보수적 = elapsed 최소). | tech §1.7 |
| **미니 시뮬 (정밀 모드)** | 오프라인 유효시간을 ≤1000 서브틱으로 분할 재생(복리 일부 반영). Web Worker 오프로드. 기본은 일괄 지급. | tech §3.1 |
| **Tauri v2 + steamworks-rs** | 패키징 스택(v0.3 — NW.js에서 전환). 시스템 WebView2 → 저발열·소형·투명/프레임리스 위젯 창. Steam 오버레이 철회(#6196 불요)로 Tauri 기각 사유 소멸, steamworks-rs(Rust)로 업적·클라우드. | tech §5.1 |
| **format 모듈** | Decimal→표시 문자열 전담(과학·접두사·극소 표기). 계산과 표시 완전 분리. | tech §2.3 |
| **platform/ 격리** | Steam API를 추상 인터페이스로만 호출, 웹 빌드에선 no-op. Steam 이식이 게임 로직을 안 건드림. | tech §5.2 |

---

## 4. 프로덕션·필러 (Production & Pillars)

> 단일 진실 소스 = `scope-mvp.md`, `roadmap.md`.

| 용어 | 정의 | 출처 |
|---|---|---|
| **4필러 (디자인 필러)** | 절대 안 어기는 4원칙: ① 작아짐=강해짐 / ② 테마=메커니즘 / ③ 방치도·개입도 보상 / ④ 한 층=한 새로움. | GDD §3 |
| **P1~P5 (절대 보호)** | 모든 단계에서 타협 불가한 코어. P1 작아짐=강해짐 화면 역설 / P2 테마=메커니즘 / P3 방치·개입 보상 / P4 한 층=한 새로움 / P5 온보딩→첫 빅 크런치 코어 경험. | scope §1-1 |
| **MVP** | Minimum Viable Product. = v1.0. 온보딩~첫 빅 크런치~재하강 안착까지 4필러가 끝까지 작동하는 최소 완성 게임. | scope §9 |
| **정거장 1~4** | 제작 로드맵의 4단계: ① 프로토타입("재미있나") / ② 수직 슬라이스("팔리겠나", 스토어 GIF) / ③ v1.0 Steam("완성") / ④ 출시 후("키운다"). | roadmap §0 |
| **프로토타입 (정거장 1)** | 코어 루프 재미 검증. 못생겨도 됨. 체인+수식+온보딩+첫 상전이+미지 1~2층+오프라인+세이브. 졸업: "한 판 더 하고 싶다". | scope §2 |
| **수직 슬라이스 (VS)** | Vertical Slice. 한 구간(온보딩~첫 상전이)을 아트·사운드·게임필까지 완성. 스토어 GIF·트레일러 클립 산출. | scope §3 |
| **Hook / Habit / Hobby** | 리텐션 3단 아치: Hook 0–30분(온보딩) / Habit 1–6일(첫 빅 크런치까지) / Hobby 수 주(재하강 루프 반복). | GDD §8 |
| **FTUE** | First-Time User Experience. 첫 5분 온보딩. 텍스트 벽 없이 점진 공개(압축 클릭→자동화→공명→첫 D→첫 상전이). | GDD §15, ux §3 |
| **EA** | Early Access. Steam 앞서 해보기 출시 형태(중간 배포 채널 itch.io/galaxy.click 포함). | GDD §2, launch |
| **게임필 / 주스** | Game Feel / Juice. 숫자 카운트업·글로우·마이크로 애니메이션 등 "만지면 기분 좋은" 표현 레이어. | scope §3 |
| **60/40 룰** | 방치 60%(자동 체인+기본 공명) + 능동 40%(공명 클릭·타이밍·전략). 능동은 의무 아님(100% 방치도 도달 가능). | sys §4-3 |
| **컷 (스코프 컷)** | "안 할 것을 정하는 칼". 양(量)을 미루되 질(質)은 안 미룸. 미루는 것은 버리는 것이 아니라 순서를 정하는 것. | scope §0 |
| **DoD (완성 정의)** | Definition of Done. 각 정거장의 졸업 기준(예: v1.0 = 4필러 끊김 없음 + 출시 품질 게이트 통과). | roadmap §3-B |
| **GRAC** | 게임물관리위원회. 한국 게임물 등급분류 기관. 자체등급분류사업자 등록 등 출시 전 법적 게이트. | biz-legal §3 |

---

## 5. 입자 도감 용어 (Codex Terms)

> 단일 진실 소스 = `codex.md`. 총 **87 엔트리**(UI 표시) / **76 수집 대상**(completion 분모, LEGENDARY 11 제외).

| 용어 | 정의 | 출처 |
|---|---|---|
| **입자 도감** | Particle Codex. 압축으로 발견하는 입자 수집 시스템. 실제 57(분자~쿼크) + 상상 30(프리온~플랑크). | codex §0 |
| **희귀도** | Rarity. COMMON / UNCOMMON / RARE / EPIC / LEGENDARY. LEGENDARY 11개는 완성 보너스 겸 자동 해금. | codex §13-2 |
| **완성 보너스 엔트리** | 층 도감 100% 달성 시 자동 해금되는 LEGENDARY 엔트리(11개). completion 분모(76)에서 제외. | codex §13-1 |
| **unlock_bonus** | 입자 발견 시 부여되는 보너스. 3분류만 허용: 메커니즘 배율 / 자원 트리클 / 층 진입 보너스. | codex §13-4 |
| **프리온 (Preon)** | L6 상상 입자. 쿼크 하위 구성자 가설. P⁺/P⁻/P⁰ 세 위상 타입. | codex §7 |
| **개방끈 / 폐쇄끈** | Open / Closed String. L7. 끈이론 진동 모드(폐쇄끈 스핀2 = 중력자). | codex §8 |
| **스핀 폼** | Spin Foam. L8. 시공간 한 조각의 이력(루프 양자중력). | codex §9 |
| **버추온 (Virteon)** | L9 상상 입자(고유 조어, "virtuality"). 가상 입자 쌍, 양/음 요동. | codex §10 |
| **홀론 (Holon)** | L10. 정보 1비트의 입자화("It from Bit"). 수집할수록 홀로그래픽 배율 상승. | codex §11 |
| **베켄슈타인 홀론** | Bekenstein Holon. L10 EPIC. 해금 시 빅 크런치 QF 계수 K 1.0→1.05. | codex §11 |
| **플랑크온 (Planckton)** | L11 상상 입자(고유 조어). 시공간 최소 픽셀. 붕괴 = 빅 크런치. | codex §12 |
| **힉스 보손** | Higgs Boson. L5 EPIC 실제 입자. "전 티어 배율" 보너스는 production_mult 상수곱 금지 → codex 풀 흡수. (연구트리 "힉스 노드"는 미존재.) | codex §6, eco §7.2.5 |

---

## 6. 약어 풀이표 (Abbreviations)

| 약어 | 전체 (영어) | 한국어 / 의미 | 비고 |
|---|---|---|---|
| **C** | Compression Depth | 압축 깊이 | 코어 자원(내부 통화) |
| **E** | Compression Energy | 압축 에너지 | 체인 생산 자원 |
| **D** | Discovery Data | 발견 데이터 | 연구 통화. D_current/D_lifetime |
| **QF** | Quantum Foam | 양자 거품 | 영구 프레스티지 통화 |
| **r** | radius | 반경 | 화면에 보이는 크기(작아짐) |
| **dec** | decade | 데케이드 | 압축 진행 단위(dec0~26) |
| **PT** | Phase Transition | 상전이 | PT1~PT7(빅 크런치 포함) |
| **PT7** | — | 빅 크런치 | 최종 프레스티지 |
| **T1~T8** | Tier 1~8 | 압축기 8단 | 체인 티어 |
| **WALLS** | — | 6벽 스케줄 | [19,21.5,23,24.5,25.5,26] |
| **LQG** | Loop Quantum Gravity | 루프 양자중력 | L8 설계 체계 |
| **MVP** | Minimum Viable Product | 최소 기능 제품 | = v1.0 |
| **FTUE** | First-Time User Experience | 첫 사용자 경험 | 첫 5분 온보딩 |
| **EA** | Early Access | 앞서 해보기 | Steam 출시 형태 |
| **VS** | Vertical Slice | 수직 슬라이스 | 정거장 2 |
| **DoD** | Definition of Done | 완성 정의 | 졸업 기준 |
| **GDD** | Game Design Document | 게임 디자인 문서 | 단일 진실 소스 |
| **TDD** | Test-Driven Development | 테스트 주도 개발 | 엔지니어링 문서군 |
| **GRAC** | Game Rating and Administration Committee | 게임물관리위원회 | 한국 등급분류 |
| **W-8BEN** | — | 미국 원천징수 조약 서식 | 미제출 시 30% 원천징수 |
| **HMR** | Hot Module Replacement | 핫 모듈 교체 | Vite 개발 편의 |
| **VFX** | Visual Effects | 시각 효과 | graphics-programmer |
| **SFX** | Sound Effects | 효과음 | audio-designer |
| **UX / UI** | User Experience / Interface | 사용자 경험 / 인터페이스 | ux-designer |
| **D1 / D7 / D30** | Day-1/7/30 Retention | 1·7·30일 리텐션 | D7이 키스톤 지표 |
| **DAU / MAU** | Daily/Monthly Active Users | 일·월 활성 사용자 | analytics |
| **i18n** | internationalization | 국제화/현지화 | 한+영 동시 출시 |
| **AdCap / AD** | Adventure Capitalist / Antimatter Dimensions | (레퍼런스 게임) | lifetime 모델·코드 골격 |
| **rAF** | requestAnimationFrame | (렌더 루프 API) | render 구동 |
| **dt** | delta time | 시간 증분 | 고정 timestep 단위 |
| **TL;DR** | Too Long; Didn't Read | 요약 | 문서 머리 요약 |

---

## 7. 가나다 색인

**ㄱ** 게임필(§4) · 게임플레이 벽(§1) · 곡선 B(§2) · 고정 timestep(§3) · 그로스(growth_k)(§2)
**ㄴ** 누산기(§3)
**ㄷ** 도감 완성도(§1) · 데이터 주도(§3) · decade/dec(§1·§6)
**ㄹ** 레이스(Race)(§2) · 루프 양자중력(LQG)(§5·§6)
**ㅁ** 마이그레이션(§3) · 마일스톤 배율(§2) · 미니 시뮬(§3) · 미지 서브층(§1)
**ㅂ** 반경(r)(§1) · 발견 데이터(D)(§1) · 베켄슈타인 K/홀론(§2·§5) · 버추온(§5) · 빅 크런치(§1)
**ㅅ** 상전이(PT)(§1) · 색전하 삼원합일(§1) · 서사 스케일(§1) · 세이브 봉투(§3) · 수직 슬라이스(§4) · 스핀 네트워크/폼(§1·§5) · 시공간 픽셀 붕괴(§1)
**ㅇ** 압축/압축 깊이(C)(§1) · 압축 에너지(E)(§1) · 압축기 8단 체인(§1) · 양자 거품(QF)(§1) · 오비탈 공명(§1) · 오프라인 공식(§2) · 위상 겹침(§1) · 이벤트 버스(§3) · 입자 도감(§5)
**ㅈ** 재하강(§1) · 재하강 차별화(§1) · 점근 자유 가속(§1) · 정거장 1~4(§4) · 주스(§4) · 진동 하모닉스(§1) · 집중 서브층(§1)
**ㅊ** 체크섬(§3) · 층(§1) · 30% 가드레일(§2)
**ㅋ** 코어 루프(§1) · 컷(§4)
**ㅌ** 탬퍼 클램프(§2)
**ㅍ** 파생 캐시(§3) · 프리온(§5) · 플랑크온(§5) · 필러(4필러)(§4)
**ㅎ** 핵력 게이지(§1) · 홀로그래픽 배율/인코딩(§1) · 홀론(§5) · 희귀도(§5) · 힉스 보손(§5)
**A-Z** base_rate(§2) · base_k(§2) · break_eternity.js(§3) · codex_bonus_factor(§2) · D 보존율(§2) · Decimal 경계(§3) · F게이트(§3) · format 모듈(§3) · holo_factor(§2) · K(§2) · lifetime_C(§1) · negative result(§2) · production_mult(§2) · P1~P5(§4) · research_mult(§2) · StorageAdapter(§3) · Tauri v2 + steamworks-rs(§3) · tick/render(§3) · WALLS(§2)

---

## 8. 출처 문서 약칭

| 약칭 | 문서 |
|---|---|
| GDD | `design/GDD.md` (단일 진실 소스) |
| eco | `design/economy.md` (수식·시뮬·페이싱) |
| sys | `design/systems.md` (메커니즘·층·상전이) |
| codex | `design/codex.md` (입자 도감) |
| tech | `design/tech-architecture.md` (세이브·BigNumber·패키징) |
| scope | `design/scope-mvp.md` (MVP·4단계 게이트) |
| roadmap | `design/roadmap.md` (4정거장 제작 순서) |
| biz-legal | `design/business-legal-checklist.md` (GRAC·W-8BEN) |
| (한↔영 정합) | `design/localization-plan.md` §4 (용어집 단일 진실 소스) |

---

**총 용어 수: 약 128개** (게임 개념 31 [핵심 21 + 층별 메커니즘 10] + 경제·수식 23 + 기술 17 + 프로덕션·필러 14 + 도감 12 + 약어 31). 약어표는 다른 섹션과 일부 중복(C·QF·dec 등)되며, 중복 제외 시 고유 용어 약 100개.
