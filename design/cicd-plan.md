# CI/CD 파이프라인 계획 (cicd-plan v0.1)

- 작성일: 2026-06-26 / game-programmer
- 입력: `design/tech-architecture.md` §4(게임 루프)·§5(패키징)·§7(R1~R9 리스크), `design/scope-mvp.md`(4단계 게이트), `design/roadmap.md`(F-게이트·마일스톤), `design/risk-register.md`(PR1~PR8).
- 상태: **계획서 v0.1. 실제 YAML/스크립트/코드 없음.** 이 문서는 "무엇을·왜·어떤 순서로 자동화하는가"의 설계 문서다. 구현 코드는 각 단계 착수 시 별도 작성.
- 범위: Git 워크플로 / CI 자동 검사 / 빌드 파이프라인 / 배포·릴리스 / 솔로 현실과 점진 자동화.

---

## 0. 이 문서를 읽는 법 (목적과 경계)

CI/CD(Continuous Integration / Continuous Delivery)는 "코드가 바뀔 때마다 자동으로 검사하고, 필요하면 자동으로 내보내는" 파이프라인이다. 인디 솔로 개발에서 이 파이프라인은 **팀의 규율과 시간을 대신한다** — 실수를 사람이 잡는 게 아니라 자동화가 잡는다.

단, **과한 인프라는 번아웃(PR2)과 스코프 크립(PR1)의 한 형태**다. 이 계획은 "완벽한 DevOps"가 아니라 "소규모 솔로 팀이 현실적으로 쓸 수 있는 최소 자동화부터 시작해 단계적으로 확장"을 목표로 한다.

**무엇을 자동화할지 결정 원칙**: "이걸 손으로 하면 실수가 나는가? 실수가 나면 얼마나 아픈가?" 아픔이 크면 자동화, 아픔이 작으면 나중으로.

---

## 1. Git 워크플로

### 1.1 브랜칭 전략

솔로·소규모 팀에 맞는 단순 2-트랙 전략을 택한다. 복잡한 GitFlow는 과잉.

| 브랜치 | 역할 | 규칙 |
|---|---|---|
| **`main`** | 항상 돌아가는 안정 브랜치. 배포 원본. | 직접 push 금지. PR(또는 squash merge)로만 합류. 태그가 여기서 붙음. |
| **`feature/<짧은 이름>`** | 기능 단위 작업 브랜치. | main에서 분기, 작업 후 main으로 PR. 완료 후 삭제. |

- **`dev` / `develop` 브랜치는 두지 않는다.** 솔로 팀에서 main + feature 이상은 오버헤드.
- **핫픽스**: 긴급 수정도 `hotfix/<설명>` 브랜치에서 main으로 PR. 직접 main push 금지.
- **실험적 작업**: `experiment/<설명>` — 검증 전 아이디어. merge 보장 없음, main에 영향 0.

### 1.2 커밋 규율

**Conventional Commits** 형식을 채택한다. 자동화 도구(CHANGELOG 생성, 버전 범프)와 연동 가능하고, 이력이 읽힌다.

```
<타입>(<범위>): <한 줄 요약>

[본문 — 선택. 왜 변경했나]
[BREAKING CHANGE: — 있으면 필수]
```

| 타입 | 쓰는 때 |
|---|---|
| `feat` | 새 기능 (economy 수식 구현, 새 층 메커니즘 등) |
| `fix` | 버그 수정 |
| `perf` | 성능 개선 (Decimal 연산 최적화 등) |
| `refactor` | 동작 변화 없는 구조 개선 |
| `data` | `data/` 수치 업데이트 (입자 스탯, 비용 파라미터 등) |
| `test` | 테스트 추가·수정 |
| `docs` | 문서만 변경 |
| `chore` | 빌드·도구·의존성 관리 |

- **범위(scope)**: `chain`, `save`, `prestige`, `codex`, `ui`, `platform` 등 tech-arch §4.4 모듈명 사용.
- **한 커밋 = 한 논리 단위.** "여러 기능을 한 번에" 커밋은 회귀 추적을 어렵게 한다.
- **`data/` 변경은 `data` 타입으로 분리.** 로직 변경과 섞이면 밸런스 회귀를 발견하기 어렵다.

### 1.3 태깅·버전 관리 (Semantic Versioning)

**SemVer `MAJOR.MINOR.PATCH`**를 사용한다.

| 올리는 경우 | 버전 부분 | 예 |
|---|---|---|
| 세이브 스키마 구조 변경·마이그레이션 필요 / 게임플레이 대규모 변경 | `MAJOR` | 1.0.0 → 2.0.0 |
| 새 기능 추가 (새 층, 새 메커니즘, 도감 확장) | `MINOR` | 1.0.0 → 1.1.0 |
| 버그 수정, 데이터 밸런스 패치 | `PATCH` | 1.0.0 → 1.0.1 |

- **`MAJOR.MINOR.PATCH-alpha.N` / `-beta.N`**: 프로토타입·슬라이스 단계는 `0.x.x`(정거장 1~2), v1.0은 Steam EA 진입 기준.
- **태그는 `main`에만 붙인다.** `git tag v1.0.0` 후 배포 트리거.
- **세이브 스키마 버전은 SemVer와 별개.** tech-arch §1.3이 정한 단방향 체인(`schema_version` 정수)이 세이브 마이그레이션을 제어한다. SemVer MAJOR가 바뀌어도 schema_version은 독립적으로 관리(세이브 호환성이 게임 버전과 무관하게 보장되어야 하기 때문).

---

## 2. CI — 푸시 시 자동 검사

### 2.1 도구 방향: GitHub Actions (무료 티어)

| 선택 | 근거 |
|---|---|
| **GitHub Actions** | 무료 티어로 public repo 무제한 / private repo 월 2,000 분. 솔로 인디 스케일에 충분. YAML 워크플로 파일이 `.github/workflows/` 에 있어 버전 관리됨. |
| Vite + TypeScript + Vitest 생태계와 궁합 | npm/pnpm 기반 스크립트를 그대로 실행 가능. 별도 빌드 시스템 없이도 CI 구성 가능. |

- **GitHub Actions 무료 한계 주시**: private repo면 월 2,000분. 빌드가 느려지면 캐싱(node_modules, pnpm store)으로 최적화 먼저. 한계 임박 시 Gitea Actions / Forgejo Actions 로컬 러너 대안.
- **GitHub Actions 대신 Forgejo CI**: 팀이 이미 Forgejo를 사용하고 있다면 Forgejo Actions(Gitea Actions 호환)로 동일 YAML을 사용 가능. 무료 자체 호스팅.

### 2.2 CI 파이프라인 단계 (순서)

모든 `main` push와 PR에 대해 아래 단계를 **순서대로** 실행한다.

```
Push / PR 오픈
  │
  ▼
[Job 1] 의존성 설치
  pnpm install (캐시 활용)
  │
  ▼
[Job 2] 정적 분석 (빠름 — 즉시 피드백)
  ├── TypeScript typecheck (tsc --noEmit)
  │     tech-arch §2.2 Decimal 경계 타입 오류 잡음
  └── ESLint
        커스텀 룰: 게임 수치에 +/*/Math.pow/parseFloat/Number() 직접 사용 금지
        (tech-arch §2.2 금지 패턴 — 코드리뷰 게이트를 lint로 자동화)
  │
  ▼
[Job 3] 단위·통합 테스트 (Vitest)
  실패 시 빌드 중단 — test-strategy.md §1 우선순위 순서로 실행
  │
  ▼
[Job 4] 빌드 검증
  Vite build (에러 없이 번들 생성되는지)
  빌드 산출물 크기 확인 (예상 밖 비대화 감지)
  │
  ▼
결과 리포트 (PR 코멘트 / 슬랙·이메일 알림)
```

### 2.3 ESLint 커스텀 룰 방향

tech-arch §2.2가 명시한 "게임수치에 native 연산 금지"는 코드리뷰만으로는 놓치기 쉽다. ESLint 커스텀 룰로 자동화한다:

- **탐지 대상**: 게임 수치(`E`, `C`, `D_current`, `QF` 등 도메인 변수)에 `+`, `*`, `Math.pow`, `Number()`, `parseFloat()` 직접 적용.
- **허용 예외**: `bought`(압축기 보유 개수, native 정수), `dt`·타이머·배열 인덱스, UI 좌표. 예외는 `// eslint-disable -- gameCount: native-ok` 주석으로 명시.
- **초기 구현**: `no-restricted-syntax` + 커스텀 선택자로 시작. 오탐이 너무 많으면 커스텀 플러그인으로 정제.

### 2.4 CI 실패 정책

- **Job 2(타입체크·lint) 실패** = PR merge 차단. 즉각 수정.
- **Job 3(테스트) 실패** = PR merge 차단. 실패 테스트 수정 또는 테스트 자체의 버그임을 증명해야 merge.
- **Job 4(빌드) 실패** = PR merge 차단.
- **솔로 팀 현실**: "CI 고치기 전에 merge해야 할 긴급 상황"은 있다. 이 경우 `[HOTFIX]` 태그를 커밋에 붙이고, 다음 커밋에서 반드시 CI 수정. **CI 무시 커밋이 3회 이상 연속이면 스코프 크립·번아웃 조기경보(risk PR1·PR2)**.

---

## 3. 빌드 파이프라인

### 3.1 환경 분리

| 환경 | 목적 | 트리거 |
|---|---|---|
| **`dev`** | 개발·HMR. 최적화 없음, 소스맵 풀. | 로컬 `pnpm dev` |
| **`test`** | CI 테스트 실행 환경. prod 조건에 가깝게. | CI 자동 |
| **`prod`** | 배포용. 트리쉐이킹·최소화·소스맵 없음. | 릴리스 태그 / 수동 |

- **환경별 분기**: Vite `import.meta.env.MODE` 또는 `import.meta.env.DEV/PROD`. 텔레메트리 수집은 `prod`에서만 활성화(개발 중 노이즈 방지).
- **`platform/` 어댑터 주입 시점**: `dev`/`prod` 공통 빌드 → `platform/` 레이어가 빌드 타깃(웹/Steam)에 맞는 StorageAdapter를 주입(tech-arch §1.6·§5.3). 웹 배포와 Steam 패키징이 같은 빌드 산출물을 공유.

### 3.2 Vite 빌드 → 웹 번들

```
pnpm build
  → dist/ (HTML/JS/CSS 정적 번들)
     ├── index.html
     ├── assets/[hash].js (청크 분할)
     └── assets/[hash].css
```

- **청크 전략**: `core/`(게임 로직) / `data/`(입자·연구·층 데이터) / `ui/`(Svelte 컴포넌트) / `render/`(파티클) 분리. 데이터 청크를 별도로 분리하면 밸런스 패치 시 로직 재다운로드 없이 데이터 청크만 갱신.
- **`data/` 데이터 파일**: JSON 또는 TypeScript 상수. Vite HMR이 이 파일만 교체해 밸런스 조정 중 전체 리로드 없이 수치 변경 확인(tech-arch §4.4 핵심 이점).
- **break_eternity.js**: ESM 빌드가 있으면 직접 import, 없으면 bundler가 CJS를 변환. 번들 크기 확인(몇 KB 수준).

### 3.3 NW.js 패키징 (Steam 빌드)

> **⚠ v0.3 SUPERSEDED — Tauri 전환.** 아래 절차는 NW.js 기준(v0.2). 패키징이 **Tauri v2 + steamworks-rs**로 바뀌어(GDD §11 / tech-arch §5.1) 실제 빌드 경로는 `tauri build`(WebView2 래핑 + steamworks-rs 플러그인 + 위젯 창 설정)로 **재기술 예정**. NW.js 특정 단계(package.nw·nwjs-sdk 합본·~150MB 런타임·오버레이 검증)는 무효 — 새 전제는 저발열·소형(~10MB)·오버레이 제외.

tech-arch §5.3 빌드 파이프라인을 구현 관점으로 구체화한다.

```
[1단계] Vite build → dist/ (웹 번들, 3.2와 동일)

[2단계] NW.js 패키지 구성
  dist/ 내용을 package.nw(ZIP) 또는 그대로 배치
  package.nw/package.json에 NW.js 진입점·권한 설정

[3단계] steamworks.js 포함
  npm 패키지로 설치된 steamworks.js 바이너리를 패키지에 포함
  → 네이티브 컴파일 불필요(tech-arch §5.2)

[4단계] NW.js 런타임 합본
  대상 플랫폼별 NW.js 런타임 다운로드·합본
  Windows: nw.exe + chromium 런타임 (~150MB)
  (Mac/Linux: 각 플랫폼 런타임 — 추후 추가)

[5단계] 검증
  패키지 실행 테스트 (Steam 오버레이·Cloud·업적 연결 확인)
  파일 크기 확인 (~150MB 예상, tech-arch §5.1)

[최종] 배포 대기 산출물
  MicroIdle_v1.x.x_win.zip (또는 설치 패키지)
```

- **자동화 범위**: 1~3단계는 npm script로 자동화 가능. 4~5단계는 NW.js 버전 고정이 전제(semver 고정 권장). **초기에는 반자동 허용** — 릴리스 태그 push → CI가 1~3단계 실행, 4~5단계는 로컬에서 수동 검증 후 업로드.
- **`nwjc` 바이트코드**: tech-arch §5.3이 "기본 생략"으로 결정. 소스 노출이 문제가 되는 시점에 추가 결정.

---

## 4. 배포·릴리스

### 4.1 단계별 배포 채널

로드맵 4단계에 맞춰 배포 채널을 단계적으로 추가한다.

| 로드맵 단계 | 배포 채널 | 주요 목적 |
|---|---|---|
| **정거장 1 (프로토타입)** | 로컬 파일 / 팀 내부 링크 | 코어 루프 재미 확인. 외부 공개 불필요. |
| **정거장 2 (수직 슬라이스)** | **itch.io (웹 빌드)** | 소규모 플레이테스터에 공유. 위시리스트 깔때기 시작. |
| **정거장 3 준비** | **Steam 스토어 페이지 개설** | 위시리스트 축적. Next Fest 등록(launch-plan §6). |
| **정거장 3 완료** | **Steam EA / v1.0 출시** | Tauri 빌드 steamcmd 업로드. |
| **출시 후** | Steam 업데이트 (same depot) | 라이브 콘텐츠 패치. |

### 4.2 itch.io 웹 배포 (정거장 2부터)

- **배포 대상**: Vite 빌드 `dist/` 정적 번들. itch.io HTML 게임으로 그대로 업로드.
- **배포 방법**: `butler push dist/ <user/game>:web --userversion <버전>` (itch.io 공식 CLI 도구 `butler`). CI에 통합 가능(자동 배포 토큰 Secret으로 관리).
- **브랜치 분리**: itch.io의 채널(channel) 기능으로 `stable` / `beta` 채널 분리. 플레이테스터는 `stable`, 내부 테스트는 `beta`.
- **웹 빌드 한계**: localStorage 5MB 한계(tech-arch §1.5)가 세이브 크기를 결정. itch.io 단계에서 세이브 크기를 측정해 Steam 이전에 문제 발견.

### 4.3 Steam 업로드 (정거장 3)

- **방법**: `steamcmd` + Steamworks SDK `SteamPipeFileListGenerator`. Steamworks 파트너 계정 필요(App ID, Depot ID 설정).
- **자동화 방향**: 릴리스 태그 push → CI가 Tauri 빌드 + 번들 준비 → `steamcmd +login ... +run_app_build ...` 실행. **단, Steam 계정 자격증명(username, password, Steam Guard)을 CI Secrets에 넣는 것은 보안 위험.** 초기에는 CI가 번들까지 준비하고 steamcmd 업로드는 **수동**으로 시작. 안정화 후 자동화 검토.
- **Steam Cloud 연동**: Tauri fs 플러그인이 Steam Cloud 경로에 직접 쓰므로 steamcmd에서 별도 설정 불필요. `Steamworks 파트너 포털 > App > Cloud` 설정(경로·용량)만 맞추면 자동.
- **브랜치 구분**: Steam의 "Default" 브랜치 = EA/v1.0 안정 버전. "beta" 브랜치 = 테스트 빌드(Steam 패스워드 보호 채널 활용).

### 4.4 버전 태깅·릴리스 노트

- **릴리스 절차**:
  1. `feature/` PR merge → `main` 안정 확인 (CI 초록).
  2. `CHANGELOG.md` 업데이트 (Conventional Commits에서 자동 초안 생성 가능).
  3. `git tag v<버전>` → push → GitHub Releases (또는 Forgejo Releases) 드래프트.
  4. 릴리스 노트: 플레이어 관점 요약(추가된 것·고쳐진 것·알려진 문제).
  5. itch.io/Steam 업로드 트리거.
- **세이브 호환성 고지**: 세이브 스키마 버전이 올라가면 릴리스 노트에 "세이브 마이그레이션 있음 — 자동 처리됨" 명시. 구버전 세이브가 깨질 위험이 있으면 (이론상 없어야 하지만) 경고 + `.corrupt.bak` 안내.
- **롤백 절차**: 심각한 세이브 손상 버그 발생 시 — Steam 이전 빌드 분기로 되돌리기(Steam 브랜치 기능) + 패치 노트 긴급 업데이트. 코드 롤백은 `git revert` (재작성 금지).

---

## 5. 솔로 현실과 점진 자동화

### 5.1 초기 최소 자동화 (정거장 1)

F-게이트(roadmap §1-A) 달성 전까지는 CI 설정 자체에 시간을 쓰지 않는다. **코어 루프가 도는 것이 먼저.**

**정거장 1에서 갖출 최소 자동화:**

| 항목 | 방법 | 이유 |
|---|---|---|
| TypeScript 타입 체크 | `pnpm run typecheck` 로컬에서 습관적 실행 | Decimal 경계 오류를 즉시 잡음. CI 없어도 로컬 실행으로 충분. |
| 단위 테스트 (핵심 수식) | Vitest 로컬 실행 | 경제 수식 회귀 방지. CI 없어도 실행 가능. |
| Git 커밋 훅 | Husky + lint-staged | push 전 lint·typecheck 자동. GitHub Actions보다 설정 빠름. |

**GitHub Actions는 정거장 2 진입 시 추가.** 슬라이스 이후 코드가 안정화되면 CI 실패가 노이즈보다 신호가 된다.

### 5.2 점진 확장 계획

| 정거장 | 추가 자동화 | 근거 |
|---|---|---|
| **2 (슬라이스)** | GitHub Actions CI (typecheck + test + build). itch.io `butler` 자동 배포. | 외부 플레이테스터에 배포하려면 재현 가능한 빌드가 필요. |
| **3 (v1.0 준비)** | 성능 예산 체크 (번들 크기 한계 설정). 세이브 마이그레이션 회귀 테스트 CI 포함. Steam 번들 준비 자동화. | 출시 품질 게이트. 실수가 사용자에게 가기 전에 잡아야. |
| **출시 후** | Steam 자동 배포 (자격증명 안전하게 해결 후). 릴리스 노트 자동 초안 생성. | 라이브 패치 빈도가 올라가면 수동 배포가 병목. |

### 5.3 과한 인프라 경계

**하지 말아야 할 것 (솔로 팀 기준):**

- **Kubernetes / Docker 컨테이너화**: 정적 웹 게임에 서버 인프라는 과잉. Tauri 데스크톱 앱이므로 서버 배포가 없다.
- **블루-그린 배포 / 카나리 릴리스**: Steam 브랜치(beta/default)가 충분한 채널 분리 제공.
- **자체 CI 서버 (Jenkins/GitLab CI) 즉시 구축**: GitHub Actions 무료 티어로 정거장 3까지 충분. 필요 시 Forgejo Actions 자체 러너로 전환.
- **모노레포 툴링 (Turborepo/Nx)**: 단일 게임 프로젝트에는 불필요.
- **CI 설정에 1주 이상 투자**: CI 작동 안 해도 게임은 만들 수 있다. CI가 게임을 만드는 게 아니다.

---

## 6. 요약 — 4줄

1. **Git 워크플로**: `main`(안정)+`feature/*`(작업) 2-트랙, Conventional Commits, SemVer 태깅. 세이브 스키마 버전은 SemVer와 독립.
2. **CI(GitHub Actions)**: typecheck → ESLint(native 연산 금지 게이트) → Vitest → Vite build. 정거장 1은 로컬 훅으로 시작, 정거장 2부터 Actions 추가.
3. **빌드**: Vite `dist/` 정적 번들이 웹(itch.io)·데스크톱(Tauri) 공통 원본. `data/` 수치 파일은 HMR·청크 분리로 밸런스 이터레이션을 빠르게.
4. **배포**: 정거장 1=로컬, 2=itch.io butler 자동, 3=Steam steamcmd 반자동→자동. 릴리스 태그 + 세이브 호환성 고지 규칙 엄수.
