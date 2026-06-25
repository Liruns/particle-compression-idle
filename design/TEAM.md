# 게임 개발 팀 — 에이전트 & 스킬 가이드

`C:\game` 프로젝트의 전용 AI 개발 팀. 모든 구성원은 `design/GDD.md`를 단일 진실 소스로 읽는다.

## 에이전트 (`.claude/agents/`) — 10명

### 설계 라인
| 에이전트 | 역할 | 모델 | 언제 호출 |
|---|---|---|---|
| `game-director` | 비전·일관성·최종 결정 | opus | 큰 방향 결정, 산출물 검토, 충돌 중재 |
| `systems-designer` | 메커니즘·코어루프·층 | sonnet | 새 시스템/메커니즘 설계 |
| `economy-designer` | 수식·밸런싱·시뮬 | opus | 숫자/공식/페이싱 |
| `narrative-designer` | 세계관·플레이버·톤 | sonnet | 스토리/카피/입자 설명 |
| `ux-designer` | 화면·정보설계·온보딩 | sonnet | UI 흐름/와이어프레임 |

### 구현·검증 라인
| 에이전트 | 역할 | 모델 | 언제 호출 |
|---|---|---|---|
| `tech-architect` | 아키텍처·세이브·BigNumber·Steam | opus | 기술 결정 |
| `game-programmer` | 구현(TS/웹) | sonnet | 코드 작성 |
| `content-designer` | 입자 도감·연구 데이터 | sonnet | 콘텐츠 데이터 |
| `qa-balancer` | 밸런스 검증·플레이테스트 | sonnet | 검증 패스(작성자와 분리) |
| `reference-researcher` | 외부 레퍼런스 리서치 | sonnet | GitHub/문서 조사 |

## 스킬 (`.claude/skills/`) — 7개
| 스킬 | 기능 |
|---|---|
| `balance-sim` | 경제·페이싱 시뮬레이션(python) |
| `particle-codex` | 입자 도감 데이터 생성(실제 물리+상상) |
| `incremental-patterns` | 인크리멘탈 디자인 패턴·공식 레퍼런스 |
| `gdd-sync` | 결정사항을 GDD에 동기화 |
| `playtest-sim` | 자동 플레이테스트로 밸런스 검증 |
| `ui-mockup` | UI 화면 목업 생성 |
| `steam-ship` | 웹→Steam 패키징·출시 |

## 협업 흐름 (전형적)
1. `game-director`가 목표·스코프 확정
2. `systems-designer`가 메커니즘 → `economy-designer`가 수식·시뮬(`balance-sim`)
3. `narrative`/`content`가 살을 붙이고, `ux-designer`가 화면화(`ui-mockup`)
4. `tech-architect`가 구조 → `game-programmer`가 구현
5. `qa-balancer`가 검증(`playtest-sim`, 작성자와 분리된 패스)
6. 결정마다 `gdd-sync`로 GDD 갱신
7. 막히면 `reference-researcher`가 외부 답 조달

## 원칙
- 단일 진실 소스: `design/GDD.md`
- 작성과 검증은 분리(self-approve 금지)
- 모든 수치는 시뮬로 검증
- 외부 레퍼런스는 `design/research/`에 축적
