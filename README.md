# Micro Idle

> 분자에서 시작해 플랑크 길이까지 내려가며 미지의 입자를 발견하는 방치형 인크리멘탈.
> 웹(itch.io) + PC(Steam) 단일 코드베이스. **작아짐 = 강해짐.**

이 저장소는 게임 **코드**와 `design/` **설계 문서**를 함께 보관한다. 설계는 단일 진실
소스(`design/GDD.md` 외)이며, 코드는 그 설계를 충실히 구현한다.

현재 상태: **정거장2(수직 슬라이스) — "우주적 현미경" 피벗 / 이관 2단계 + 사운드 1차 + 설정 + 기록 + 관측 목표 완료.**
다크 대시보드(3패널·탭·게이지·체인 테이블)를 폐기하고 **다이제틱 공허 게임판**으로 재구성:
풀스크린 캔버스에 11개 distinct 세계 + 중심 코어 + 8 궤도 껍질(체인) + 떠다니는 입자, 능동
메커니즘 4종(수동 압축·오비탈 공명·위상 겹침·진동 하모닉스)을 전부 게임판에서 직접 만진다.
코어 루프(8단 체인·상전이·11층·도감·연구·오프라인)·경제·밸런스는 구현·검증 완료.
절차적 WebAudio 사운드(에셋 0, `src/core/audio/`) — SFX 1차 + 층별 앰비언트 2차(웜↔쿨 아크), 설정 콘솔
(사운드·앰비언트·모션·표기법·세이브 export/import/초기화), 기록(누적 통계)·관측 목표(업적 26개, 순수 인정형)
패널, 관측 안내(도움말)·키보드(스페이스=압축)를 추가. FTUE 힌트를 액션 신호 기반으로 정합.
방향 SSOT = [`design/cosmic-direction.md`](design/cosmic-direction.md).

---

## 실행법

전제: Node.js 18+ (개발 환경 검증: Node 22 / npm 10).

```bash
npm install      # 의존성 설치 (svelte, break_eternity.js, lz-string, vite, typescript ...)
npm run dev      # Vite 개발 서버 (HMR). 브라우저에서 표시되는 주소 열기
```

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | Vite 개발 서버 + HMR |
| `npm run build` | `svelte-check`(타입검사) 후 프로덕션 번들(`dist/`) |
| `npm run build:fast` | 타입검사 생략 빌드 |
| `npm run check` | `svelte-check` 타입검사만 |
| `npm test` | vitest — F게이트·코어 수식 단위 테스트 |

빌드 산출물(`dist/`)은 상대 경로(`base: './'`)라 itch.io 정적 호스팅과 Tauri
(WebView2) 데스크톱 래핑 양쪽에 그대로 올라간다(tech-architecture §5.3 "공통 정적 번들").

---

## ★ F게이트 4종 (roadmap §1-A "1일차 고정")

나중에 추가하면 이미 쌓인 세이브·코드를 깨야 하는 4가지 기초. 스캐폴딩 단계에서
**최소 동작까지** 구현해 박아두었다(집의 기초공사).

| # | F게이트 | 구현 위치 | 상태 |
|---|---|---|---|
| **F1** | 세이브 봉투 `{version, data, checksum}` + 단방향 마이그레이션 + 백업 폴백 | `src/core/save/` | 동작 (봉투·체크섬·마이그레이션 디스패치·export/import) |
| **F2** | StorageAdapter 추상화 (`read/write/exists/backup`) + LocalStorageAdapter | `src/core/save/adapters/` | 동작 (웹 localStorage UTF16 압축; Steam fs는 M3.7) |
| **F3** | 고정 timestep 게임 루프 (tick 로직 / render 표현 분리 + 누산기 + catch-up 상한) | `src/core/loop/` | 동작 (`GameLoop` + `Scheduler`) |
| **F4** | break_eternity `Decimal` 단일 진입점 + native 연산 금지 경계 | `src/core/bignum/` | 동작 (`D()`/`add`/`mul`/`pow10`… + 직렬화 헬퍼) |

**왜 1일차인가** (tech-architecture §1.2·§7):
- F1: 나중에 `version`을 추가하면 그 전 세이브는 마이그레이션 불가 → 영영 못 읽음.
- F2: 인터페이스로 감싸야 Steam(fs) 이식 시 게임 코드 0줄 수정.
- F3: economy 시뮬이 dt 결정적 가정 → 나중에 바꾸면 검증된 페이싱이 실제에서 안 맞음.
- F4: break_infinity로 시작하면 재하강 누적 `lifetime_C`가 한계 돌파 → 교체 마이그레이션 비용.

검증: `npm test`가 F게이트 라운드트립·체크섬 편집 탐지·루프 결정성·오프라인 48h
클램프·코어 수식(dec/r/cost/production_mult = GDD/economy 확정값)을 확인한다.

---

## 구조 개요 (tech-architecture §4.4)

```
src/
  main.ts            # 엔트리: tokens.css 주입 + Svelte 마운트
  App.svelte         # 헬로 셸 화면 (표시 전용, 단방향 구독)
  game.ts            # 부트스트랩: F게이트 4종을 묶어 "구조가 돈다" 증명
  core/
    state/           # 중앙 단일 상태 + 스키마 타입 (§1.1)
    loop/            # F3: 고정 timestep tick/render + 스케줄러 (§4.1·4.2)
    bignum/          # F4: break_eternity Decimal 단일 진입점 (§2)
    format/          # Decimal → 표시 문자열 (과학/공학/극소 표기, §2.3)
    save/            # F1: 봉투·직렬화·체크섬·마이그레이션 (§1)
      adapters/      #   F2: localStorage / (indexeddb / filesystem 후속) (§1.6)
    offline/         # 오프라인 계산기 (48h 탬퍼 클램프, §3)
    chain/           # 8단 체인 + r/dec/cost/production_mult 파생 (economy §1·§2)
    prestige/        # 상전이·QF·빅 크런치·재하강 (스텁, §systems)
    layers/          # 층 진입 판정 (스텁)
      mechanics/     #   층별 메커니즘 (LayerMechanic 인터페이스, §3.4)
    codex/           # 입자 도감 (스텁)
    research/        # 연구 트리 (스텁)
    events/          # 이벤트 버스 (§4.3)
    audio/           # M2.4: 절차적 WebAudio 사운드(에셋 0, 이벤트 버스 구독)
    achievements/    # 관측 목표(업적) 판정 — 영속 상태 파생, 순수 인정형
  data/              # 데이터 주도: 코어 경제 상수 (입자/연구 JSON은 후속)
  ui/                # tokens.css + Svelte UI + stores(prefs·reduced-motion) + Settings/Stats/Achievements/Help 뷰
  render/            # 우주적 현미경 렌더(11 세계 + 공허 게임판 BoardRenderer)
  platform/          # 웹 vs Tauri/Steam 격리 (§5.2)
```

**원칙:**
- 게임 루프(tick, 결정적 로직)와 표현(render, rAF)을 완전 분리(§4.1).
- 모든 게임 수치는 `Decimal`. native `+`·`*`·`Math.pow` 금지 — `bignum` API만(§2.2).
- 수치는 코드가 아니라 `data/`에 (밸런스 조정에 로직을 안 건드림).
- 파생값(비용·생산·dec·r)은 저장하지 않고 로드 후 재계산(§1.1).

---

## design/ 문서 링크

| 문서 | 내용 |
|---|---|
| [`design/GDD.md`](design/GDD.md) | 게임 디자인 단일 진실 소스 |
| [`design/tech-architecture.md`](design/tech-architecture.md) | 세이브·BigNumber·오프라인·루프·패키징 구조 (이 코드의 기준) |
| [`design/tech-spec.md`](design/tech-spec.md) | 기술 결정 요약 시트 |
| [`design/scope-mvp.md`](design/scope-mvp.md) | 4단계 게이트 (프로토타입 → 슬라이스 → v1.0 → 출시 후) |
| [`design/roadmap.md`](design/roadmap.md) | 제작 순서·마일스톤 (F게이트 = §1-A) |
| [`design/DESIGN.md`](design/DESIGN.md) | 디자인 토큰 (tokens.css의 출처) |
| [`design/economy.md`](design/economy.md) | 수식·비용·프레스티지 (코어 상수의 출처) |

---

*이관 2단계 완료. 다음: 정거장2 졸업(사운드·내러티브 보이스·게임필 정합) → 정거장3 6 미지층 전체 확장. roadmap 참조.*
