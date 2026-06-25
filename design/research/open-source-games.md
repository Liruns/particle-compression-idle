# 오픈소스 인크리멘탈/방치형 게임 레퍼런스 리서치

> 목적: '물질 압축 → 분자→원자→원자핵→쿼크→플랑크' 방치형/장기 인크리멘탈 게임의 코드 아키텍처 레퍼런스 확보
> 코어 구조: 8단 생산기 체인(Antimatter Dimensions 골격) + 프레스티지(상전이) + 입자 도감
> 조사일: 2026-06-25

---

## 1. Repo별 현황표

| 이름 | GitHub URL | 별점 | 기술스택 | 한줄 핵심 |
|---|---|---|---|---|
| **Antimatter Dimensions** | https://github.com/IvarK/AntimatterDimensionsSourceCode | ~345 | Vue.js + JavaScript (JS 58%, Vue 35%, CSS 7%) / MIT | 우리 게임 구조의 직접 골격 — 8단 Dimension 체인, Infinity/Eternity/Reality 3층 프레스티지, pako 압축 세이브 |
| **Synergism** | https://github.com/Pseudo-Corp/SynergismOfficial | ~369 | TypeScript (82%) + Electron, NodeJS≥24 | 순수 TS 인크리멘탈, 다층 프레스티지(Prestige→Transcend→Reincarnate→Singularity), Electron PC 빌드 포함 |
| **Evolve Idle** | https://github.com/pmotschmann/Evolve | ~1,200 | JavaScript (97%) + Web Worker, LESS | 별점 1위 오픈소스 인크리멘탈 — Web Worker 분리 게임루프, LZ-string 세이브, modular src/ 27파일 |
| **Trimps** | https://github.com/Trimps/Trimps.github.io | ~278 | Vanilla JS (76%) + HTML / GPL-2.0 | 장기 방치형, lz-string.js + decimal.min.js 조합, Playfab 클라우드 세이브 |
| **The Modding Tree** | https://github.com/Acamaeda/The-Modding-Tree | ~122 (포크 1,700) | JavaScript (90%) | `addLayer()` 선언형 프레스티지 레이어 정의, 1,700개 포크가 검증한 프레스티지 설계 표준 |
| **Profectus** | https://github.com/profectus-engine/Profectus | ~34 | TypeScript (80%) + Vue 3 + Vite + Vitest | The Modding Tree의 TS/Vue3 현대화판 — 인크리멘탈 전용 엔진, NaN 감지, Saves Manager 내장 |
| **break_infinity.js** | https://github.com/Patashu/break_infinity.js | ~243 | TypeScript (96%) | 인크리멘탈용 BigNumber 라이브러리 — decimal.js 대비 최대 442배 빠름, AD 4.5배 성능 향상 사례, 1e(9e15)까지 |
| **break_eternity.js** | https://github.com/Patashu/break_eternity.js | ~196 | JavaScript | break_infinity.js 후속 — 10^^1e308까지 표현(쿼크·플랑크 극미세 스케일 적합), tetration 지원 |
| **Industry Idle** | https://github.com/fishpondstudio/IndustryIdle | ~354 | TypeScript (96%) + Cocos Creator 2.4.x / GPL-3.0 | 팩토리 생산 체인 + 오프라인 수익 + 프레스티지, TS 기반 PC/모바일 배포 사례 |
| **Kittens Game** | https://bitbucket.org/bloodrizer/kitten-game (미러: https://github.com/Stevie-O/kitten-game) | — (Bitbucket 원본) | Vanilla JS | 장기 복잡 방치형 교과서, 리소스 의존 그래프 설계 참고 |
| **level13** | https://github.com/nroutasuo/level13 | ~260 | JavaScript | 인크리멘탈 텍스트 어드벤처, 엔티티/컴포넌트 구조 참고 |
| **progress-knight** | https://github.com/ihtasham42/progress-knight | ~172 | JavaScript | 단순 방치형, 미니멀 게임루프/세이브 구조(입문 레퍼런스) |

---

## 2. 우리 게임(8단 체인 + 프레스티지 + 도감)에 직접 적용할 점

### 생산 체인 (8단 — 분자→원자→원자핵→쿼크→플랑크)
- **[Antimatter Dimensions]** `tick()` 내부 `for (let tier = maxTierProduced; tier >= 1; --tier)` 역순 루프 — 상위 티어부터 순차 계산해 `Tier8→Tier7→…→Tier1→최종 자원` 흐름을 구현. Tier1만 `produceCurrency(Currency.antimatter, diff)`로 최종 자원을 직접 생산하고, 나머지는 `produceDimensions(다음티어, diff/10)`로 상위 티어를 증식. 이 구조를 그대로 복사해 우리의 "압축 에너지" 생산으로 치환.
- **[Antimatter Dimensions]** `AntimatterDimensionState` 클래스(`extends DimensionState`)의 속성 세트(`amount`, `bought`, `multiplier`, `productionPerSecond`, `cost`, `costScale`, `isAffordable`, `continuumValue`)가 우리 `ParticleDimensionState`의 직접 템플릿. 8개 인스턴스를 `AntimatterDimension(tier)` 팩토리 함수로 접근하는 패턴.
- **[Industry Idle]** 자원이 체인으로 연결되는 팩토리형 생산을 TypeScript로 구현한 사례 — 생산 의존 그래프 설계 참고.

### 게임 루프 (tick / requestAnimationFrame)
- **[Evolve]** Web Worker로 게임 루프를 메인 스레드에서 분리(`new Worker("evolve/evolve.js")`)해 UI 프리징 방지. `fastLoop`/`midLoop`/`longLoop` 3단 루프를 `loopTick` 나눗셈으로 분기 실행하고, catch-up 시뮬레이션 상한을 두어 랙 보상 폭주를 방지. `time_multiplier` 기반 오프라인 누락 틱 보상 로직 내장 — 방치형 필수 요소.
- **[Antimatter Dimensions]** `src/core/intervals.js`에서 `gameLoop` / `save` / `checkCloudSave` / `checkEverySecond` / `checkForUpdates`를 독립 인터벌 객체(IIFE 팩토리, `setInterval` 래핑, `start/stop/restart/isStarted`)로 분리 관리. 게임 로직·자동저장·클라우드 싱크 주기를 각각 제어. `Config.ticksPerSecond` 기반 프레임 업데이트.

### 프레스티지 (상전이 — 분자→원자→원자핵→쿼크)
- **[The Modding Tree]** `addLayer("p", { name, symbol, color, position, row, requires, resource, baseResource, baseAmount(), type:"normal", exponent, gainMult(), gainExp(), hotkeys, layerShown(), startData() })` 선언형 API가 핵심. 우리 상전이 단계 각각을 레이어 선언 하나씩으로 정의하면 확장이 단순. `requires`(해금 임계값) + `exponent`(보상 스케일) + `gainMult/gainExp`(보너스) 조합으로 프레스티지 수식 표현. 1,700개 포크가 검증한 설계.
- **[Antimatter Dimensions]** `src/core/big-crunch.js` — 프레스티지(Big Crunch) 구현. `bigCrunchResetRequest()` → 조건 체크 → 애니메이션 → `bigCrunchReset()`. **보존**(replicanti 등 업그레이드 조건부)과 **리셋**(dimboost, galaxy, antimatter, Infinity Dimensions)을 명확히 구분. `gainedInfinityPoints()`로 프레스티지 화폐 계산, `player.partInfinityPoint`로 소수 진행 추적. 2·3차 상전이는 `eternity.js` / `reality.js` 참고.
- **[Synergism]** `Reset.ts`의 `player.prestigePoints = player.prestigePoints.add(gain)` 누적 패턴. 멀티플라이어 계산 순서(`multiplier *= achievementReward; multiplier *= 1 + 0.05 * challengeBonus; ...`)와 상위 리셋 티어(Transcension/Reincarnation/Ascension/Singularity)가 하위 티어를 리셋하며 각자 영구 화폐를 생성하는 다층 구조 — 우리 다단 상전이의 TS 레퍼런스.

### 세이브 시스템
- **[Antimatter Dimensions]** `src/core/storage/serializer.js`의 `GameSaveSerializer` — **pako(zlib)** 압축 기반 6단계 파이프라인: ① JSON→UTF-8 바이트, ② `pako.deflate`, ③ 바이트→저코드포인트 문자, ④ `btoa()` Base64, ⑤ 문제 문자 치환(`+`→`0b`, `/`→`0c`, `=`→`0a`), ⑥ 버전 마커(`"AAB"`)+종료 마커 프레이밍. JSON 변환 시 `Infinity`→문자열, `Set`→`Array` 특수 처리. 버전 마커로 구버전 세이브 backward-compatible 디코딩. `storage/index.js`는 serializer/storage/cloud-saving 3모듈로 분리.
- **[Evolve]** `save.setItem('evolved', LZString.compressToUTF16(JSON.stringify(global)))` — 단 한 줄 세이브. 프로토타입 단계의 가장 빠른 시작 방법. `convertVersion()` 기반 버전 마이그레이션 분기로 데이터 구조 진화 대응. → 초기엔 LZ-string, 이후 AD식 pako로 마이그레이션하는 2단계 전략 권장.
- **[Trimps]** `lz-string.js`(압축) + `decimal.min.js`(BigNumber) + Playfab(클라우드 세이브) 조합.

### BigNumber (큰 수 처리)
- **[break_infinity.js]** decimal.js 대체, 속도 최우선(기본 연산 2.5–2.9배, 복잡 연산 121–442배 빠름). 1e308 초과 ~ 1e(9e15)까지. 분자→원자 초기 단계 적합. TypeScript 작성.
- **[break_eternity.js]** break_infinity.js 후속, tetration으로 10^^1e308까지(및 극소 10^-(10^^1e308)). `pow`/`root`/`slog`/`tetrate`/`factorial` 지원. **원자핵→쿼크→플랑크 길이 극미세 스케일에 적합** — 우리처럼 "점점 작아지는" 컨셉은 극소 표현이 가능한 이쪽이 핵심. `x.times(y).plus(z).floor()` 체이닝 API.
- **권장**: 처음부터 `break_eternity.js`를 채택하거나, 초기 break_infinity.js → 심화 단계 break_eternity.js 교체. Trimps/Synergism은 Decimal 계열을 일관 사용.

### 입자 도감 (발견 기록 / unlock)
- **[Antimatter Dimensions]** `src/core/achievements/` — 달성 조건을 조건 함수로 등록하고 상태 플래그로 추적하는 패턴. 우리 입자 도감 항목을 "발견 조건 함수 + 설명 + 보상 배열" 오브젝트로 선언하면 unlock 판정·UI 표시·보상 적용이 일원화됨. `secret-formula/` 폴더처럼 게임 데이터(도감 정의)를 로직과 분리해 데이터 주도 설계로 관리.

### UI 렌더링
- **[Antimatter Dimensions]** Vue.js 컴포넌트(`src/components/`)로 렌더링, `src/core/ui.js`/`ui.init.js`/`tabs.js`/`modal.js`/`notify.js` 분리. 게임 상태를 Vue 반응형으로 바인딩하되 무거운 tick 계산은 core에서 처리하고 캐시(`cache.js`)로 UI 갱신 비용 절감.
- **[Profectus]** Vue 3 + Vite 기반 인크리멘탈 전용 컴포넌트 + 동적 레이어 생성 + NaN 감지 + Saves Manager 내장 — 신규 프로젝트 스캐폴딩 시 그대로 출발점으로 사용 가능.

### 상태 관리 / 폴더 구조
- **[Antimatter Dimensions]** `src/core/` 하위를 기능별 디렉터리로 분리: `dimensions/`, `autobuyers/`, `automator/`, `celestials/`, `glyphs/`, `time-studies/`, `achievements/`, `secret-formula/`, `storage/`, `game-mechanics/`. 단일 파일: `player.js`(상태), `globals.js`, `currency.js`, `format.js`, `math.js`, `event-hub.js`, `intervals.js`. → 우리 폴더 구조의 직접 청사진.
- **[Evolve]** 중앙 `global` 객체 단일 상태 컨테이너(`resource`/`tech`/`city`/`space`/`civic`/`race`/`stats`). 직접 mutation + `convertVersion()` 마이그레이션 + setter 함수(`setGlobal` 등). `soft_reset()`(시드·트레잇·프레스티지 자원 보존) vs `hard_reset()`(전체 초기화) 분리.

### TypeScript + Electron Steam 배포
- **[Synergism]** `electron/` 폴더 분리, NodeJS≥24 빌드, `src/steam/` 폴더에 Steam API 연동 코드 포함 — 웹 프로토타입을 Electron으로 감싸 Steam 배포하는 경로를 실제로 검증한 사례. ESLint/stylelint/dprint 코드 품질 도구 체인.
- **[Industry Idle]** Cocos Creator 기반 TS로 PC/모바일 동시 배포한 또 다른 사례(엔진 의존이 있어 우리 웹 우선 전략과는 거리 있음, 참고용).

---

## 3. 추천 1순위 레퍼런스 Repo

### Antimatter Dimensions — `IvarK/AntimatterDimensionsSourceCode`

**이유:**
1. 우리 게임의 핵심 구조("8단 생산기 체인 + 다층 프레스티지")가 이 게임의 아키텍처 그 자체다. 구현 대상과 참고 대상이 사실상 동일.
2. 필요한 모든 레이어가 실제 코드로 구현되어 있음:
   - `src/core/dimensions/antimatter-dimension.js` — 8단 체인 State 클래스 + 역순 생산 루프
   - `src/core/big-crunch.js` — 1차 프레스티지(보존/리셋 분리, 화폐 계산)
   - `src/core/eternity.js`, `src/core/reality.js` — 2·3차 상전이(우리 다단 상전이 모델)
   - `src/core/storage/serializer.js` — pako 압축 세이브 직렬화
   - `src/core/achievements/`, `src/core/secret-formula/` — 도감/데이터 주도 설계
   - `src/core/intervals.js` — 게임 루프 인터벌 관리
3. Vue.js + JavaScript 스택이라 HTML/JS/TS 프로토타입에서 직접 발췌·포팅 가능.
4. MIT 라이선스, 12,000+ 커밋의 대규모 프로덕션 코드 — 챌린지 시스템, NaN 방지, 오프라인 진행, 세이브 버전 마이그레이션 등 엣지 케이스까지 선례 확보 가능.

**2순위 보완 레퍼런스:**
- **Synergism** (`Pseudo-Corp/SynergismOfficial`) — TypeScript 현대화 코드베이스 + 다층 프레스티지(`Reset.ts`) + Electron/Steam 배포 패턴. 우리가 TS로 작성하고 Steam을 목표로 하므로 직접적.
- **The Modding Tree** (`Acamaeda/The-Modding-Tree`) — 프레스티지 레이어 선언형 설계(`addLayer` API) 전용 참고. 상전이 단계를 데이터로 선언하는 방식의 표준.
- **Profectus** (`profectus-engine/Profectus`) — TS + Vue3 + Vite 스캐폴딩. 신규 프로젝트 시작 템플릿(NaN 감지/Saves Manager 기본 제공).
- **break_eternity.js** (`Patashu/break_eternity.js`) — "점점 작아지는" 극미세 스케일 표현이 가능한 BigNumber 라이브러리. 우리 컨셉상 사실상 채택 확정 후보.
