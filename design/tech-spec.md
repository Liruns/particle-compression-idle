# 기술 사양서 (tech-spec v0.1)

- 작성일: 2026-06-26 / tech-architect
- 상태: **요구사항 시트.** 한눈에 보는 *결정 목록*이다. 각 결정의 **근거·구조·인터페이스는 `tech-architecture.md`가 보유**하며, 본 문서는 그 결정을 표로 압축하고 §링크로 가리킨다(중복 금지).
- 역할 분리: `tech-architecture.md` = "왜·어떻게(구조)" / **본 문서 = "무엇을(스펙 시트)"** / `account-sync-recovery.md` = "계정·동기화·복구". 셋이 짝.
- 이 문서가 정하지 않는 것: 코드·함수 시그니처, 수치 파라미터(economy), UI 레이아웃(ux), 비주얼/셰이더(graphics-programmer).

---

## 0. 한 줄 요약

> 웹(itch.io) + PC(Steam) 단일 코드베이스. **TypeScript + Svelte + Vite** 빌드, **break_eternity.js**로 천문학적 수치, **lz-string**으로 세이브 압축, **Tauri v2 + steamworks-rs**로 Steam 패키징(+데스크탑 위젯). 전용 게임엔진 없음(커스텀 고정-timestep 루프 + Canvas2D/WebGL).

---

## 1. 플랫폼 매트릭스

| 항목 | 사양 | 비고 |
|---|---|---|
| **1차 타깃** | PC Windows (Steam) + 데스크탑 위젯 | 출시 본진. Tauri 패키징(§4) |
| **웹 타깃** | 브라우저 (itch.io / galaxy.click) | 프로토타입·플레이테스트 채널, 중간 배포. Steam 이전의 위시리스트 깔때기(GDD §2) |
| **Mac / Linux** | 여지 남김 (1차 범위 밖) | Tauri가 3-OS 빌드 지원(WebView는 플랫폼별 상이) → 코드 분기 없이 향후 확장. v1.0은 Windows만 검증 |
| **지원 브라우저** | Chromium 기반(Chrome/Edge/Brave 등) 최신 2버전 | 데스크톱은 Tauri WebView2(Windows=Edge/Chromium 기반)라 웹과 거동 근사. **Firefox/Safari는 best-effort**(웹 빌드 한정, 1차 보증 대상 아님). Mac/Linux WebView(WebKit 계열)는 v1.0 범위 밖 |
| **최소 사양(목표)** | 듀얼코어 CPU / RAM 4GB / 통합 그래픽 / 디스크 ~300MB | 방치형이라 GPU 부하 낮음. 메모리 안정성이 사양보다 중요(장시간 구동, tech-arch §6.1) |
| **해상도** | 1280×720 이상, DPI 스케일 대응 | 단일 창 UI. 풀스크린/창모드 (graphics-programmer·ux 상세) |
| **온라인 요구** | **없음(오프라인 단독 동작)** | 계정·로그인 서버 불필요(→ `account-sync-recovery.md`). Steam 연동은 *있으면 좋은* 부가(업적·클라우드·오버레이)이지 *필수 의존* 아님 |

---

## 2. 언어 / 프레임워크 / 빌드

| 레이어 | 선택 | 한 줄 근거 | 근거 위치 |
|---|---|---|---|
| **언어** | **TypeScript** | 큰 수 연산·세이브 스키마 컴파일타임 검증, Decimal 경계(§2) 타입 강제 | tech-arch §0, GDD §11 |
| **UI 프레임워크** | **Svelte** | 컴파일타임 반응성, 매 틱 대량 갱신에 유리, 번들 ~1.6kb. 상태→화면 단방향(tech-arch §4.1) | GDD §11 |
| **빌드 도구** | **Vite** | Svelte/TS 네이티브 + 즉각 HMR(밸런싱 이터레이션 직결) | GDD §11 |
| **웹 빌드 타깃** | Vite build → 정적 번들(HTML/JS/CSS) | 웹·데스크톱 **공통 산출물**. 분기는 `platform/` 어댑터 주입만 | tech-arch §5.3 |
| **데스크톱 빌드 타깃** | 정적 번들 → Tauri(WebView2) 래핑 + steamworks-rs → 실행파일 | 같은 번들을 Tauri로 감쌈. 게임 로직 0줄 수정 | tech-arch §5.3 |
| **게임 엔진** | **없음(커스텀)** | 전용 엔진 불필요. 고정-timestep tick 누산기 자작(tech-arch §4.1). Unity/Godot 등 도입 안 함 | tech-arch §4 |

---

## 3. 핵심 라이브러리 (확정)

| 라이브러리 | 용도 | 핵심 제약 / 주의 | 근거 위치 |
|---|---|---|---|
| **break_eternity.js** (`Decimal`) | 모든 게임 수치(E·C·lifetime_C·QF·생산/비용·배율). native float 전면 금지 | JSON 직렬화 안 됨 → `.toString()`/`new Decimal()`. 정확 정수 카운팅엔 native 병행(§5). 패키지명에 점 포함 | tech-arch §2 |
| **lz-string** | 세이브 페이로드 압축 | 인코딩 1종 통일(매체별 UTF16/Base64, **혼용 금지** → 복호화 실패). 세이브 봉투 `{version,data,checksum}` | tech-arch §1.2·§1.4 |
| **steamworks-rs** | Steam 연동(업적·플레이어 정보·Cloud 훅; 오버레이 불요) | Rust 크레이트, Tauri 커맨드로 노출. 연동 코드는 `platform/`에 격리(웹 빌드=no-op) | tech-arch §5.2 |
| **Tauri v2** (런타임/패키저) | 데스크톱 패키징. Tauri fs 플러그인으로 Steam Cloud 경로 세이브 | 시스템 WebView2 재사용 → 번들 ~10MB·저발열. 에셋 실행파일 번들 — 접근성 우선이라 난독화 기본 생략 | tech-arch §5.1 |

> **확정 라이브러리 한 줄**: 큰 수 = **break_eternity.js** · 압축 = **lz-string** · 패키징 = **Tauri v2 + steamworks-rs**(v0.3 전환, NW.js SUPERSEDED). GDD §11 / research 갱신 반영. 본 시트는 *목록*, 구조는 tech-arch.

### 보조 / 데이터 주도
- **게임 데이터(입자 87·연구 52·층 11·경제 파라미터)는 코드 아닌 JSON**(`data/`, AD `secret-formula` 선례). 스키마·필드 사전은 `data-spec.md`. 로직 수정 없이 economy/content가 수치 주입(Vite HMR 밸런싱). (tech-arch §4.4)

---

## 4. 렌더링 사양

| 항목 | 사양 | 책임 |
|---|---|---|
| **렌더 엔진** | 전용 엔진 없음. `requestAnimationFrame` 기반 커스텀 render 루프 | tech-arch §4.1 (로직 tick과 **완전 분리**) |
| **드로잉 백엔드** | **Canvas2D 우선, WebGL 필요 시**(다수 파티클·스케일 줌) | graphics-programmer 소관(구체 선택·셰이더) |
| **파티클 시스템** | 입자 비주얼·압축 피드백·스케일 전환 VFX | graphics-programmer. **객체 풀링 전제**(누수·GC 스파이크 방지, tech-arch §6.1·§6.3) |
| **로직↔렌더 계약** | render는 tick 상태를 **읽기 전용**으로만 받음(단방향). 파티클 수는 *표현 파라미터*이지 게임 상태 아님 → 줄여도 진행 불변 | tech-arch §6.3 |
| **표시 포맷** | `Decimal → 사람이 읽는 문자열`은 **format 모듈** 전담(과학/공학/접두사/극소 표기). 갱신은 저빈도(everySecond급) | tech-arch §2.3·§6.2 |
| **목표 성능** | 렌더 60fps 지향. **단, render가 느려도 로직(tick)은 정확**(고정 timestep) | tech-arch §4.1·§6 |

---

## 5. 수치 타입 경계 (핵심 철칙)

> **게임의 "수치적 진실"은 전부 `Decimal`. native `number`는 오버플로 위험이 0인 곳에서만.** (상세 tech-arch §2.2)

| 분류 | 타입 | 대표 예 |
|---|---|---|
| **Decimal 필수 (native 절대 금지)** | `Decimal` | `E`, `C`, `D_current`, `D_lifetime`, `lifetime_C`, `QF`, 8단 체인 생산/비용, 모든 배율 곱(`production_mult`·`holographic_mult`), `dec`/`r` |
| **native number 허용** | `number` | 압축기 보유 개수(정수 카운트), 도전과제/통계 **정확 카운터**, `dt`/타이머/프레임, UI 좌표, 배열 인덱스, 설정값 |
| **금지 패턴(코드리뷰 게이트)** | — | 게임수치에 `+`·`*`·`Math.pow`·`parseFloat`·`Number()` 직접 사용 금지. 반드시 Decimal 메서드. (game-programmer 린트 강제) |

---

## 6. 세이브 사양 (요약 — 상세 tech-arch §1)

| 항목 | 사양 | 근거 위치 |
|---|---|---|
| **봉투 포맷** | `{ version, data, checksum }` (version은 평문 바깥, 1일차 고정) | tech-arch §1.2 |
| **페이로드** | 평문 JSON → lz-string 압축(암호화 안 함) | tech-arch §1.2·§1.4 |
| **저장 매체** | 웹=localStorage(+IndexedDB fallback) / Steam=`fs`(Steam Cloud 경로) | tech-arch §1.5 |
| **추상화** | StorageAdapter(read/write/exists/backup) — 게임 코드는 매체·인코딩 모름 | tech-arch §1.6 |
| **마이그레이션** | 단방향 체인(v→v+1 순차), 함수 영구 보존, 누락 필드는 validate 기본값 | tech-arch §1.3 |
| **무결성·변조** | checksum(편집 탐지) + lastSave 이중기록 최댓값(시계조작) + 48h 탬퍼 클램프 | tech-arch §1.7 |
| **백업** | 롤링 백업 2~3세대 + 원자적 쓰기 + 수동 export/import(Base64) | tech-arch §1.8 |

> **계정·동기화·복구의 사용자 관점 결정·플로우는 `account-sync-recovery.md`** (본 표는 기술 메커니즘만).

---

## 7. 패키징 / 빌드 파이프라인 (요약 — 상세 tech-arch §5)

```
개발:  Vite dev + HMR
          │  (공통 정적 번들 1개)
빌드:  Vite build ──┬── 웹 배포(itch.io / galaxy.click)
                    └── 데스크톱: 번들 → Tauri(WebView2) + steamworks-rs
                              └── Steam 업로드(steamcmd / Steamworks SDK)
```

| 결정 | 값 | 기각 대안 | 근거 위치 |
|---|---|---|---|
| **패키저** | **Tauri v2 + steamworks-rs** (v0.3, NW.js→전환) | NW.js/Electron(오버레이 확보되나 상시구동 발열·크기) | tech-arch §5.1 |
| **Steam 연동 경계** | `platform/`에 격리, 추상 인터페이스. 웹 빌드=no-op | greenworks(C++ 컴파일 의존) 기각 | tech-arch §5.2 |
| **소스 보호** | 기본 생략(접근성 우선). Tauri 실행파일 번들(평문 ZIP보다 나음), 필요 시 난독화(후속) | — | tech-arch §5.3 |

---

## 8. 성능 예산 (요약 — 상세 tech-arch §6)

| 부하 | 목표 | 핵심 대책 | 근거 위치 |
|---|---|---|---|
| 장시간 구동(수 주) | 메모리 안정(누수 0), 진행 정확 | 구독 해제 규율·풀링·무한배열 금지·autoSave 안전벨트 | tech-arch §6.1 |
| dec40+ 큰 수 연산 | 매 틱 Decimal 연산 최소 | 파생값 캐시+무효화, 닫힌형 공식(while-루프 금지), 표시 저빈도 | tech-arch §6.2 |
| 다수 입자 렌더 | 60fps, 로직 영향 0 | 객체 풀링, render 자율 LOD/스킵(로직 불변) | tech-arch §6.3 |
| 탭 백그라운드/복귀 | CPU 안 씀, 일관 처리 | 백그라운드=짧은 오프라인으로 수렴(§3 공식·48h 클램프 동일 적용) | tech-arch §6.4 |

---

## 9. 모듈 / 폴더 구조 (요약 — 상세 tech-arch §4.4)

```
src/core/{ state, loop, bignum, format, save/adapters, offline,
           chain, prestige, layers/mechanics, codex, research, events }
src/{ data, ui, render, platform }
```
- **`data/` 분리** = 데이터 주도(수치는 economy/content, `data-spec.md`).
- **`mechanics/` 자기완결** = 각 모듈이 serialize/idleBaseline/이벤트 책임 → "한 층=한 새로움"을 모듈 추가만으로 확장.
- **`platform/` 분기** = 웹 vs Tauri(WebView) / Steam 인터페이스 격리.

---

## 10. 요약 (핵심 4줄)

1. **스택**: TypeScript + Svelte + Vite. 게임엔진 없음(커스텀 고정-timestep tick / render 분리), 렌더는 Canvas2D/WebGL(graphics-programmer).
2. **라이브러리**: break_eternity.js(큰 수, native float 금지) · lz-string(세이브 압축) · Tauri v2 + steamworks-rs(Steam 패키징; 위젯 도입·오버레이 철회로 v0.3 NW.js에서 전환).
3. **빌드 1벌, 타깃 2개**: Vite 정적 번들 하나가 웹(itch.io)과 데스크톱(Tauri)에 공통 투입 — 분기는 `platform/` 어댑터뿐(이식성의 구조적 근거).
4. **근거는 tech-architecture.md, 본 시트는 결정 목록** — 상세 구조/인터페이스는 §링크로 가리킨다. 계정·동기화·복구는 `account-sync-recovery.md`.

---

## 11. 관련 문서
- 구조·근거: `tech-architecture.md`(전 항목 §링크 대상)
- 짝 문서: `account-sync-recovery.md`(계정·동기화·복구)
- 데이터: `data-spec.md`(스키마·필드 사전), `data/`(JSON)
- 기준: `GDD.md` §11, `scope-mvp.md`, `research/libraries-infra.md`
- 인계: game-programmer(구현), graphics-programmer(§4 렌더), economy/content(`data/` 수치)
