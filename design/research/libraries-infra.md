# 방치형 / 인크리멘탈 게임 — 핵심 라이브러리·인프라·툴체인 리서치

> 프로젝트: 순수 방치형/장기 인크리멘탈 게임 (물질 압축 → 미립자 세계).
> 웹(HTML/JS/TS) 프로토타입 → PC Steam 출시. 내부 수치 1e1000+, 오프라인 진행이 핵심.
> 조사일: 2026-06-25

---

## 1. 큰 수(BigNumber) 처리 라이브러리

| 라이브러리 / 툴 | URL | 핵심 | 권장도 |
|---|---|---|---|
| decimal.js | https://www.npmjs.com/package/decimal.js | 임의 정밀도 BigDecimal. 정확도 최우선이나 느림. 인크리멘탈에는 과한 정밀도+낮은 속도 | 게임엔 비권장 |
| break_infinity.js | https://github.com/Patashu/break_infinity.js | 1e308~1e(9e15) 범위, mantissa+exponent 구조. decimal.js 대비 **4.5배 빠름**(Antimatter Dimensions 실측). 최신 v2.2.0(3년 전, 유지보수 모드) | ★★★★ (중간 규모) |
| **break_eternity.js** | https://github.com/Patashu/break_eternity.js | **10^^1e308(테트레이션)** 까지, 아래로 10^-(10^^1e308). break_infinity.js의 0.5~2배 속도. **break_infinity.js / decimal.js와 API 호환 드롭인** | ★★★★★ (본 게임 권장) |
| OmegaNum.js | https://github.com/Naruyoko/OmegaNum.js | 10{1000}9e15(펜테이션+, 구글로지 수준). 매우 느림, 벤치마크 미공개. 개발자 본인이 "Incremental Unlimited 급 아니면 쓰지 말라" 명시 | ★★ (일반 게임엔 과잉) |

**선택 가이드**
- "물질 압축 → 미립자" 구조는 기하급수 이후 **테트레이션 구간 진입 가능** → `break_eternity.js` 적합.
- API 호환이므로 초기 프로토타입은 가벼운 `break_infinity.js`로 시작 후 한계 도달 시 드롭인 교체 가능.
- OmegaNum은 게임이 진짜로 펜테이션 이상(예: Incremental Unlimited)으로 가지 않는 한 불필요.
- 설치명 주의: `npm i break_eternity.js` (패키지명에 점 포함).

---

## 2. 인크리멘탈 게임 프레임워크 / 엔진 / 보일러플레이트

| 라이브러리 / 툴 | URL | 핵심 | 권장도 |
|---|---|---|---|
| Profectus | https://github.com/profectus-engine/Profectus | Vue 3 + TypeScript + Vite. The Modding Tree 후속. 동적 레이어 생성, 업그레이드, 세이브 매니저, NaN 감지 내장. ★34(소규모), 문서 moddingtree.com | ★★★ (빠른 프로토타입) |
| Incremental Game Template (IGT) | https://123ishatest.github.io/igt-docs/ | TypeScript + ESLint + Jest. Currency/Settings/Save/Upgrade/Statistics/Requirement/Achievement 모듈. 렌더링 프레임워크 무관(부분 채용 가능) | ★★★ (라이브러리로 활용) |
| incremental-game-engine-js | https://github.com/Aldo111/incremental-game-engine-js | jQuery 기반. Feature 클래스 주입형 게임 루프. 구식, 비활성 | ★ |
| (참고) incremental-game 토픽 | https://github.com/topics/incremental-game | 360개 repo 중 188개 JS. Evolve(★1.2k), level13(★260), progress-knight(★172) 등 게임 사례 다수 — 전용 엔진보다 개별 구현이 일반적 | — |

**결론: 직접 구축 권장.**
성숙한 인크리멘탈 전용 엔진은 사실상 없음. Profectus가 가장 근접하나 ★34 소규모 + Vue 3 종속. 인크리멘탈 코어 루프(틱·자원·업그레이드·prestige)는 단순하므로, 장기 프로젝트·Steam 출시 목표라면 프레임워크 제약을 떠안기보다 코어를 직접 설계하는 편이 유리. IGT의 모듈 설계는 참고 가치 있음.

---

## 3. 오프라인 진행(offline progress) 구현 패턴

| 패턴 | URL / 출처 | 핵심 | 권장도 |
|---|---|---|---|
| 단순 델타 곱셈 | https://www.geekextreme.com/idle-games-offline-progression-math/ | `gained = rate × (now - lastSave)`. 마지막 세이브 timestamp와 현재 시각 차를 초당 생산량에 곱함. 백그라운드 시뮬레이션 아님 | ★★★ (기본 구조) |
| 틱 배치 시뮬레이션 | https://antimatter-dimensions.fandom.com/wiki/Offline_Progress | 오프라인 시간을 N틱으로 분할 재생(AD: 1000틱 설정+1시간 오프라인 → 틱당 3.6초). **틱당 1일 상한** 적용 | ★★★★ (정확, CPU 주의) |
| 지수 감소 소프트 캡 | https://steamcommunity.com/app/1371630/discussions/ | 첫 1시간 100%, 이후 지수 감소로 최대 24시간 인정(약 28시간 오프라인 시 24h 도달). 복귀 유인 유지 | ★★★★ |
| 서버 타임스탬프 검증 | (Steam Cloud 시간) | 로컬 `Date.now()` 클록 조작 방지. 순수 오프라인 게임엔 과잉이나 Steam 환경 방어용 | ★★ |

**권장 구현**
- `lastSave = Date.now()` 저장 → 귀환 시 `elapsed = Math.min(Date.now() - lastSave, MAX_OFFLINE_MS)`.
- 이를 500~1000개 서브틱으로 분할해 복리/구매 타이밍 반영, 단순 곱셈보다 정확.
- 틱 배치는 메인 스레드 블록킹 위험 → **Web Worker로 오프로드** 또는 틱 수 상한.
- 클록 치팅은 Steam 환경에서는 치명도 낮음(접근성 우선 장르).

---

## 4. 세이브 / 로드

| 라이브러리 / 툴 | URL | 핵심 | 권장도 |
|---|---|---|---|
| localStorage + JSON | (브라우저 내장) | 가장 단순. 문자열만 저장 → `JSON.stringify/parse` 필수. ~5MB 한계 | ★★★ (기본) |
| lz-string | https://www.npmjs.com/package/lz-string | localStorage 대용량 저장용 압축. **최대 85% 절감**(6.4MB→1MB 실측). `compressToBase64`(URL 안전) / `compressToUTF16`(localStorage 효율적) | ★★★★ (필수 병행) |
| IndexedDB | (브라우저 내장) | 수 GB, 비동기, 바이너리 저장. iOS Safari에서 localStorage 대비 50MB+ | ★★★ (웹 fallback) |
| fs (Tauri fs 플러그인) | (Rust/plugin) | PC 게임 세이브를 파일로. Steam Cloud 동기화 경로에 직접 쓰기. localStorage 대체 | ★★★★★ (Steam 출시 시) |
| Steam Cloud | https://partner.steamgames.com/doc/features/cloud | 계정당 ~100MB 자동 싱크, 크로스 PC. 데스크톱 런타임(Tauri fs)에서 파일 경로 통해 연동 | ★★★★ (Steam 출시 필수) |

**패턴**
1. 웹 프로토타입: `JSON → lz-string(Base64) → localStorage`.
2. Steam 출시: `JSON → lz-string → fs.writeFile(steamCloudPath)` + Steam Cloud 자동 싱크.
3. 세이브 포맷에 **버전 필드 필수**: `{ version: 1, data: {...} }` (마이그레이션 대비).
4. IndexedDB는 웹 빌드에서 localStorage 용량 초과 시 fallback.

---

## 5. 웹게임 → Steam 패키징

### 5-1. 데스크톱 래퍼

| 라이브러리 / 툴 | URL | 핵심 | 권장도 |
|---|---|---|---|
| NW.js | https://nwjs.io | Chromium 내장(~80–150MB), 메모리 ~150MB. **Steam 오버레이 작동**. 프론트/백 분리 불필요, Node.js API 직접 사용. Steam 게임 5700+ 사용 | ★★★ (오버레이 필수 시) |
| Electron | https://www.electronjs.org | Chromium+Node 내장(~100–150MB), 메모리 ~150–300MB. Steam 오버레이 작동. 생태계 최대(주 166만 다운로드). IPC 브리지로 프론트/백 분리 필요 | ★★★★ |
| **Tauri v2** | https://tauri.app | 네이티브 WebView2+Rust(~5–10MB), 메모리 ~30–50MB, **저발열**(Chromium 미번들). Steam 오버레이 미지원(#6196 — WebView2 그래픽 후킹 차단)이나 **위젯/방치형은 오버레이 불요**. 투명·프레임리스·always-on-top·skipTaskbar 네이티브 창 제어 | ★★★★★ (v0.3 채택 — 위젯) |

### 5-2. Steamworks 연동

| 라이브러리 / 툴 | URL | 핵심 | 권장도 |
|---|---|---|---|
| **steamworks.js** | https://github.com/ceifa/steamworks.js | Rust 구현(★615). `npm i steamworks.js`만으로 사용, **컴파일 불필요**. 업적·플레이어 정보·오버레이 지원. Electron/NW.js 전용(Tauri 바인딩 없음) | ★★★★★ |
| greenworks | https://github.com/greenheartgames/greenworks | 원조(Game Dev Tycoon 제작사). C++ 애드온, 컴파일러 의존. 안정적·프로덕션 사용 다수지만 유지보수 수동적 | ★★★ |
| steamworks-ffi-node | https://dev.to/arty_prof/steamworks-ffi-node-a-steamworks-sdk-library-for-javascript-game-frameworks-15h1 | FFI 방식, **컴파일 불필요**, 포괄적 API 커버리지, TS 지원, 활발한 개발 | ★★★★ |
| **steamworks-rs** | https://github.com/Noxime/steamworks-rs | Rust 크레이트. Steamworks SDK 바인딩(업적·클라우드·플레이어). **Tauri에서 유일 실용 경로**(steamworks.js는 Tauri 미지원). 오버레이는 WebView2 제약으로 불가 | ★★★★★ (Tauri 채택) |

**결론(v0.3 갱신):** 위젯 모드 도입 + Steam 오버레이 요구 철회로 **Tauri v2 + steamworks-rs** 채택. (v0.2까지는 NW.js+steamworks.js — 오버레이 확보가 목적이었으나 요구가 철회됨.) Tauri: 저발열·소형·네이티브 창 제어가 상시구동 위젯에 결정적. steamworks-rs로 업적·클라우드(오버레이만 불가, 이제 불요). *오버레이가 필수로 복귀하면 NW.js 재검토.*

---

## 6. 추천 렌더링 / 빌드 / 언어 스택

| 레이어 | 후보 | 권장 | 핵심 근거 |
|---|---|---|---|
| 렌더링/UI | Vanilla / Vue 3 / Svelte / React / Pixi.js | **Svelte (+SvelteKit)** | 컴파일 타임 반응성(VirtualDOM 없음), Hello World 번들 ~1.6kb(React 40kb·Vue 20kb 대비). CapitalFish 등 인크리멘탈 실사례. Vite 내장 |
| 수치 | break_infinity / break_eternity / OmegaNum | **break_eternity.js** | 테트레이션까지 커버, break_infinity.js와 드롭인 호환, TS 타입 제공 |
| 빌드 | Webpack / Rollup / Vite | **Vite** | Svelte/Vue/TS 네이티브, HMR 즉각 반영 → 밸런싱 이터레이션 빠름 |
| 세이브 | localStorage / IndexedDB / fs | **lz-string + fs(Tauri)** | 압축 후 Steam Cloud 경로 직접 쓰기 |
| Steam 패키징 | NW.js / Electron / Tauri | **Tauri v2** (v0.3 — NW.js에서 전환) | 저발열·소형·위젯 창 제어. 오버레이 철회로 기각 사유 소멸 |
| Steamworks | steamworks.js / steamworks-rs | **steamworks-rs** | Rust 크레이트, 업적·클라우드(오버레이 불요) |
| 언어 | JS / TS | **TypeScript** | break_eternity.js·Profectus 타입 제공, 대형 수 연산 버그 방지 |

---

## "우리 게임 권장 스택" (한 문단)

**렌더링은 Svelte**를 선택한다 — 컴파일 타임 반응성 덕분에 매 틱 수백 개 DOM 업데이트에도 런타임 VirtualDOM 오버헤드가 없고, 번들이 ~1.6kb로 패키지 크기에 거의 기여하지 않는다. **수치는 break_eternity.js** — 물질 압축 게임은 시간이 지나면 반드시 e표기(1e308)를 뚫을 것이므로 테트레이션(10^^1e308)까지 지원하는 이 라이브러리가 필수이며, break_infinity.js와 API가 동일해 초기 프로토타입은 가벼운 쪽으로 시작해도 드롭인 업그레이드가 가능하다. **빌드는 Vite** — Svelte + TS 네이티브 지원과 즉각적인 HMR로 게임 밸런싱 이터레이션이 잦은 이 장르에 결정적이다. **Steam 패키징은 Tauri v2 + steamworks-rs**(v0.3 전환, NW.js SUPERSEDED) — 데스크탑 위젯 모드 도입 + Steam 오버레이 요구 철회로, Tauri의 시스템 WebView2 기반 저발열·소형·투명/프레임리스 네이티브 창이 상시구동 위젯에 결정적이 됐다. 게임 로직은 전부 WebView JS에 두고 Rust는 창 셸+steamworks-rs 브리지만 담당한다. 세이브는 lz-string으로 압축한 뒤 Tauri fs 플러그인으로 Steam Cloud 동기화 경로(예: `%APPDATA%/..`)에 직접 기록해 크로스 PC 싱크를 얻는다. 언어는 처음부터 **TypeScript**로 — break_eternity.js의 `Decimal` 타입과 세이브 스키마를 컴파일 타임에 검증해 천문학적 수치 연산의 버그를 예방한다.

---

## 주의할 함정 (Gotcha)

- **break_eternity.js 직렬화:** `Decimal` 인스턴스는 `JSON.stringify/parse`로 복원되지 않음. 저장 시 `.toString()`, 로드 시 `new Decimal(str)` 명시 필요. 세이브 전체에 `toJSON` 커스터마이징 권장.
- **Tauri + Steam 오버레이 = 불가:** Steam 오버레이가 WebView2 아키텍처와 근본 충돌(#6196 "not planned" 영구). **단 오버레이가 불필요한 제품(위젯/방치형)이면 Tauri 채택 OK** — v0.3이 이 경로. 오버레이가 필수면 NW.js/Electron.
- **소스 코드 노출:** NW.js 기본 패키징은 JS 소스가 `package.nw`(ZIP)에 평문 노출. Tauri는 프론트 에셋을 실행파일에 번들해 상대적으로 낫지만 완전 보호는 아님 — 인크리멘탈은 접근성 우선이라 보통 난독화 생략.
- **localStorage 격리:** 웹 브라우저 localStorage와 데스크톱(Tauri WebView) localStorage는 별개 저장소 → 웹↔데스크톱 세이브 이전 불가. **초기부터 `fs` 기반 세이브 설계 권장.**
- **오프라인 클록 조작:** 클라이언트 `Date.now()`만 믿으면 시스템 시간 조작으로 무한 자원 획득 가능. lastSave를 세이브 파일과 Steam Cloud 양쪽에 기록해 **최솟값 취하는 방어 로직** 권장.
- **오프라인 틱 배치 CPU 스파이크:** 복귀 시 수천 틱을 메인 스레드에서 동기 처리하면 UI 블록킹. **Web Worker로 오프로드** 또는 틱 수를 500~1000개로 제한.
- **lz-string 인코딩 혼용 금지:** `compressToBase64()`와 `compressToUTF16()`은 혼용 시 복호화 실패. 한 방식으로 통일.
- **패키지명 오타 주의:** `npm i break_eternity.js` — 패키지명에 점(.) 포함. (Steam 연동은 npm이 아닌 Rust 크레이트 `steamworks-rs`.)
- **steamworks.js는 Tauri 미지원(→ steamworks-rs):** steamworks.js는 Electron/NW.js 전용. Tauri에서 Steam API는 **steamworks-rs(Rust 크레이트)**를 Tauri 커맨드/플러그인으로 노출해 사용한다(Rust 공수 발생 — v0.3 수용).
- **세이브 포맷 버전 필드:** 초기부터 `{ version, data }` 구조로 마이그레이션 경로 확보 필수. 수치 표현 방식 변경 시 구 세이브 호환성이 깨짐.
- **break_infinity.js 정밀도 한계:** mantissa가 double(약 17자리)이라 정확도가 아닌 magnitude 우선. 정확한 정수 카운팅이 필요한 구간엔 부적합 — 게임 자원엔 무방하나 도전과제 카운터 등엔 일반 정수 병행.
