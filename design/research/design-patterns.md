# 인크리멘탈/방치형 게임 디자인·밸런싱 이론 리서치

> 순수 방치형/장기(하드코어) 인크리멘탈 게임 설계를 위한 디자인 패턴·공식 모음.
> 8단 생산기 체인 + 프레스티지(상전이) + 로그 스케일 진행 구조 대상.
> 조사 도구: WebSearch / WebFetch. 모든 공식·수치는 원본 글에서 인용, 출처 URL 명시.

---

## 1. 주제별 정리

### 1-A. 비용 곡선 (Cost Curves)

**핵심 원칙**
- 표준 비용 곡선은 **지수 성장**. 비용=지수 / 생산=선형·다항의 비대칭이 자연스러운 진행 벽(progression wall)을 만든다.
- 지수는 어떤 다항도 결국 추월한다 → 비용이 생산을 따라잡는 시점을 "밸런싱"으로 조절하는 것이 핵심.
- 멀티플라이어 0.01 차이도 20번째 업그레이드쯤이면 거대한 차이로 복리 누적됨 → 작은 값도 신중히.

**핵심 공식·수치**
```
cost(n) = base_cost × growth_rate^n          // n = 현재 보유 수
```
- 업계 표준 growth_rate "sweet spot" = **1.07 ~ 1.15**
  - Clicker Heroes 영웅 35종: 1.07
  - Cookie Clicker 빌딩: 1.15
  - AdVenture Capitalist 10개 사업: 1.07~1.15 (사업별 상이)
  - Steam's Monster: 2.5까지 (가파른 예외)

AdVenture Capitalist 실측값 (Earth):

| 생산기 | 기본 비용 | multiplier | 기본 수익 | 사이클 |
|--------|----------|-----------|---------|--------|
| Lemonade Stand | $4 | 1.07 | $1 | 0.6s |
| Newspaper | $60 | 1.15 | $60 | 3s |
| Car Wash | $720 | 1.14 | $540 | 6s |
| Pizza | $8,640 | 1.13 | $4,320 | 12s |
| Donut Shop | $103,680 | 1.12 | $51,840 | 24s |

> 패턴: **하위 티어일수록 높은 multiplier(1.07~1.15), 상위 티어일수록 낮은 multiplier(1.12~1.13)** + 긴 사이클. 계층 간 달성 체감을 균등화.

대량 구매 공식:
```
n개 한꺼번에 살 때 총비용:
  total_cost = b × r^k × (r^n − 1) / (r − 1)

현재 통화로 살 수 있는 최대 수:
  max = floor( log_r( c(r−1) / (b·r^k) + 1 ) )

  b=기본비용, r=성장률, k=현재 보유 수, c=보유 통화
```

소프트캡 패턴 (임계값 초과 시 분수 지수 적용):
```
1차 소프트캡:  effective  = threshold  × (raw  / threshold )^0.5
2차 소프트캡:  effective2 = threshold2 × (prev / threshold2)^exponent2
```
- 진행에 따라 소프트캡이 늦게 시작 / 약해짐 / 제거되도록 업그레이드로 조절 가능.
- Incremental Mass Rewritten: 메인 자원에 8단계 소프트캡 중첩(`Softcap^n`), 후반 Hex로 해제.

**출처**
- The Math of Idle Games, Part I — https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
- Numbers Getting Bigger (Envato Tuts+) — https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a
- Balancing Tips: Idle Idol — https://www.gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol
- IdleFramework 리서치 문서 — https://github.com/ac2522/IdleFramework/blob/main/IDLE_GAME_MECHANICS_RESEARCH.md
- Incremental-Limits (소프트캡 카탈로그) — https://github.com/Reinhardt-C/Incremental-Limits

---

### 1-B. 생산 곡선 (Production Curves)

**핵심 원칙**
- 생산은 **선형·다항**으로 두고 비용은 지수로 → 투자 대비 회수 간극이 점점 벌어져 자연스러운 감속.
- 인컴 레이트는 티어당 약 1/3씩만 증가시키는 식의 완만한 증가가 권장됨(Cookie Clicker 사례).
- 생산기는 두 숫자를 가짐: **총 보유 수**(자동 생성 포함)와 **(괄호 안) 구매 수량**. 부스트·비용은 보통 "구매 수량" 기준 → 수십억 자동 생성에도 하위 티어가 의미를 유지.

**핵심 공식·수치**

완전 생산 공식:
```
final_production = base_production
    × ∏(multiplicative_upgrades)
    × (1 + Σ(percentage_upgrades))
    × (1 + prestige_bonus)
    + Σ(additive_upgrades)
```

8단 파생 생산기 체인 (Derivative / Nested Generator):
```
Gen-N → Gen-(N−1) → ... → Gen-1 → 통화

성장 수열: 1, t, t²/2, t³/6, t⁴/24, ... , t^n/n!
극한:      Σ (t^n / n!) = e^t   (지수 성장에 접근)
```
> 체인이 깊을수록 지수에 근접하지만 **무한 티어가 아니면 도달 불가** → 지수 비용이 결국 따라잡아 프레스티지를 강제. 8단이면 충분한 성장 폭 + 자연스러운 벽을 동시에 확보.

티어 부스트 시스템 (Derivative Clicker 실측):
- 수동 구매한 Tier-1 빌딩 1개당 모든 Tier-1 생산 **+0.05%**.
- 비용은 총 보유 수가 아닌 **구매 수량** 기준 계산.

마일스톤 멀티플라이어 임계값 (AdVenture Capitalist):
```
보유 수: 25 / 50 / 100 / 200 / 300 / 400 / 500
배율:    ×2 / ×3 /  ×5 /  ×7 /  ×9 /  ×11
```
> 멀티플라이어 임계값을 조작하면 **시점마다 가장 가치 있는 생산기가 바뀌어** 플레이가 다양해지고 구 콘텐츠가 무의미해지지 않음.

최적 구매 순서 / 진행 스파이크 탐지:
```
time_A_first = cost_A/nps + cost_B/(nps + rate_A)
time_B_first = cost_B/nps + cost_A/(nps + rate_B)
// 더 작은 값 쪽을 먼저 구매하는 것이 최적
```

**출처**
- The Math of Idle Games, Part II — https://www.gamedeveloper.com/game-platforms/the-math-of-idle-games-part-ii
- Numbers Getting Bigger (Envato Tuts+) — https://code.tutsplus.com/numbers-getting-bigger-the-design-and-math-of-incremental-games--cms-24023a
- Math — the backbone of Idle Games (Medium) — https://medvescekmurovec.medium.com/math-the-backbone-of-idle-games-part-1-f46b54706cf1
- IdleFramework 리서치 문서 — https://github.com/ac2522/IdleFramework/blob/main/IDLE_GAME_MECHANICS_RESEARCH.md

---

### 1-C. 프레스티지 / 상전이 레이어 (Prestige / Ascension)

**핵심 원칙**
- 프레스티지 = 현재 진행을 리셋하는 대신 **리셋 간 유지되는 영구 통화**를 획득하는 핵심 진행 루프.
- 대부분 **분수 지수(제곱근·세제곱근)** 사용, 로그 함수는 드묾(Clicker Heroes만 사실상 로그형).
- 통화 계산 기준 2분류: **누적(lifetime)** vs **현재 런(since-reset)** — 이 차이가 리셋 행동을 좌우.
- 진행을 의도적으로 "울퉁불퉁"하게(빠른 구간/느린 구간 교차) — 멀티플라이어와 통화 획득 속도의 상호작용으로 단조로운 감속 방지.
- 부스트가 콘텐츠/목표 증가 속도를 초과하면 의미 붕괴 → 레이어 추가 시 **새 목표를 함께 도입**(Realm Grinder: Abdication→Reincarnation→Ascension 3단).

**핵심 공식·수치**

영구 통화 획득 공식 (게임별 실측):

| 게임 | 기반 | 공식 | 통화 2배 위해 필요 |
|------|------|------|------------------|
| AdVenture Capitalist | 누적 수익 | `p = 150 × sqrt(c_L / 1e15)` | ≈ 3~4× 이전 수익 |
| Cookie Clicker | 누적 수익 | `p = (c_L / 1e12)^(1/3)` | ≈ 8× 이전 수익 |
| Realm Grinder | 최대 보유량 | `p = (sqrt(1 + 8·c_M/1e12) − 1) / 2` | ≈ 4× 이전 최대 |
| Egg, Inc. | 현재 런 수익만 | `Δp = (c_R / 1e6)^0.14` | ≈ 128× (독립 이벤트) |
| Reactor Incremental | min(전력,방열) | `(min / 1e12)^0.60206` | — |
| 범용 패턴 | 누적 수익 | `prestige = earnings^e × mult` (e = 0.5~0.8) | 지수에 비례 |

영구 부스트 적용:
```
// AdVenture Capitalist Angel 보너스
angel_bonus = 1 + angel_count × 0.02            // 천사 1개당 +2%

// Cookie Clicker Prestige
prestige_level = floor((lifetime / 1e12)^(1/3))
multiplier     = 1 + prestige_level × 0.01      // 레벨당 +1%

// Profectus(Modding Tree) 최소 구현 패턴
formula: x => x.div(10).sqrt()                  // 포인트 ÷ 10 후 제곱근
```

리셋 타이밍 휴리스틱:
- **수학적 최적**: 프레스티지 통화를 2배로 늘릴 수 있을 때 리셋.
- **UX 신호**: 현재(피크) 속도 대비 10~20% 감속이 느껴지는 시점.
- **실용 규칙**: "다음 의미 있는 업그레이드까지 걸리는 시간 > 리셋 후 그 지점 재도달 시간"이면 리셋. 첫 기회에 바로 리셋하지 말 것.
- 레이어 보너스 배율이 현재 생산의 2~3×를 넘으면 리셋 권장, 1.5× 미만이면 계속 진행.

**출처**
- The Math of Idle Games, Part III (프레스티지 루프) — https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii
- Prestige Mechanic (Profectus / Modding Tree) — https://moddingtree.com/guide/recipes/prestige
- IdleFramework 리서치 문서 — https://github.com/ac2522/IdleFramework/blob/main/IDLE_GAME_MECHANICS_RESEARCH.md
- Incremental game (Wikipedia) — https://en.wikipedia.org/wiki/Incremental_game

---

### 1-D. 페이싱 · 오프라인 밸런스 (Pacing & Offline)

**핵심 원칙**
- 비용 성장이 보상 성장을 앞서야 진행이 자연 감속. 감속은 급격한 절벽이 아니라 점진적으로.
- 순수 방치형은 **세션이 짧고(평균 8분) 잦은** 구조 + 메타 시스템으로 장기 유지.
- 자동화 해금 타이밍이 핵심: 너무 일찍 = 무관심, 너무 늦게 = 이탈. "노력해서 얻은" 느낌을 줄 것.
- 60% 진행은 방치 / 40% 진행은 능동 참여 비율(60/40 룰)이 접근성·보상 균형점.

**핵심 공식·수치**

세션 설계 3단계 아치:

| 단계 | 기간 | 설계 목표 |
|------|------|---------|
| Hook | 0~30분 | 즉각 보상, 가시적 숫자 상승 |
| Habit | 1~7일 | 하루 1~2회 의미 있는 체크인 |
| Hobby | 수주~수개월 | 깊은 전략·프레스티지 레이어 |

- 권장 체크인 주기: **30분 ~ 2시간**.
- 방치형 평균 세션 길이: **8분**, Stickiness(DAU/MAU) **18%** (vs 일반 하이퍼캐주얼 10.5%).

루프 중첩 타이머 (접속 빈도별 플레이어 포섭):
```
짧은 루프:  cap = 20분   (자주 접속)
중간 루프:  cap = 5시간  (하루 1~2회)
긴 루프:    cap = 2일    (가끔 접속)
```

오프라인 보상 공식:
```
offline_earnings = rate_at_disconnect × min(elapsed_sec, max_cap) × offline_modifier
```

| 게임/관행 | 시간 캡 | modifier |
|----------|--------|---------|
| 모바일 일반 | 24시간 (일일 로그인 유도) | 0.5 ~ 0.75 |
| Melvor Idle | 18시간 | — |
| Clicker Heroes | 캡 없음 (DPS 한계가 자연 캡) | — |
| Idle Online Universe | — | 0.90 |

- delta-time 기반: 마지막 세션 타임스탬프와 현재 시각 차이 × 초당 생산. **시계 조작에 취약** → 서버 타임스탬프 검증 / 최대 delta 제한 필수.

리텐션 벤치마크:

| 지표 | 모바일 평균(2024) | 방치형 목표 | 우수 기준 |
|------|-----------------|----------|---------|
| D1 | 26~28% | 35~40% | 45%+ |
| D7 | ~8% | 10~15% | 20%+ |
| D30 | <3% | 5~10% | 10%+ |

**출처**
- Idle Games Best Practices (GridInc) — https://gridinc.co.za/blog/idle-games-best-practices
- Idle Game Design Principles (Eric Guan) — https://ericguan.substack.com/p/idle-game-design-principles
- GameAnalytics — How to Make an Idle Game — https://www.gameanalytics.com/blog/how-to-make-an-idle-game-adjust
- Offline Progression in Clicker Heroes — https://blog.clickerheroes.com/offline-progression-in-clicker-heroes/
- Offline Progression (Melvor Idle Wiki) — https://wiki.melvoridle.com/w/Offline_Progression

---

## 2. 우리 게임(상전이 수식·오프라인 밸런스)에 바로 적용할 점

**상전이 영구 부스트 수식**
- 제곱근(e=0.5) 기반으로 시작: `상전이통화 = floor(C × sqrt(누적자원 / D))`. C·D는 **첫 상전이 타이밍이 4~6시간 플레이 후**가 되도록 역산.
- 영구 부스트: `production_mult = 1 + prestige_count × base_rate`. base_rate는 **10~20회 상전이 시 2~3× 생산** 달성이 되도록 조정.
- 제곱근 곡선에서 통화 2배는 ≈ 3~4× 더 벌어야 함 → "적당한 재도전 유인" 균형점. 더 가파르게 하려면 세제곱근(e≈0.33, 2배에 8× 필요).
- 로그 스케일 반경(0을 향해 작아짐)과 연동: 상전이 통화를 반경 감소 폭에 직접 매핑하면 "상전이=상(phase) 점프" 메타포가 수식적으로 일관됨.

**8단 생산기 체인**
- cost multiplier는 **하위 티어 > 상위 티어** 역순 배치: Tier-1 = 1.15 → Tier-8 = 1.07~1.10.
- 마일스톤(25/50/100/200개 보유)마다 ×2~×5 생산 배수 도입 → 진행 속도 변동성 확보, 어느 티어를 살지 시점마다 바뀌게.
- 8단 `t^n/n!` 체인 성장이 지수 비용에 따라잡히는 시점이 곧 자연스러운 상전이 벽 → 별도 하드 게이트 없이 페이싱 가능.
- "총 보유 수 / (구매 수량)" 이중 표기 도입 → 자동 생성이 폭증해도 하위 티어 수동 구매가 부스트로 의미 유지.

**오프라인 밸런스**
- 시간 캡: **24시간** 고정(일일 접속 유도). 순수 하드코어 지향이면 48시간까지 고려 가능.
- offline_modifier: **0.6 ~ 0.75**(온라인의 60~75%). 단, **상전이 직후 첫 런은 modifier = 1.0**으로 풀어 복귀 임팩트 강화.
- 무한 방치 방지: 캡에 더해 `log(1 + t)` 비례 추가 보너스로 장시간 오프라인의 한계 수익을 자연 감쇠.
- 시계 조작 방어: 최대 delta 제한 + (가능하면) 서버 타임스탬프 검증 필수.

**페이싱**
- "다음 상전이까지" 목표 시간: 30분(초반) → 2시간(중반) → 8시간(후반) 점증.
- 수식보다 **"자릿수 앵커(10 → 1K → 1M → 1T)"를 먼저 정하고 비용을 역산** — Idle Idol 팀 검증 기법. 수학적으로 완벽하지 않아도 체감 페이스 컨트롤이 훨씬 정밀해짐.
- 진행을 의도적으로 불규칙하게(빠른 구간/느린 구간 교차) 설계 — 단조로운 감속보다 참여도가 높음.
- 자동화 해금은 "노력해서 얻은" 위치에 배치(60/40 룰 참고), 순수 방치형이라도 초반엔 능동 입력 여지를 남길 것.

---

## 3. 추천 심화 읽을거리

1. **The Math of Idle Games, Part I** — 비용/생산 곡선 수학 기초, 대량 구매 공식 원본
   https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
2. **The Math of Idle Games, Part III** — 프레스티지 루프 4개 게임(AdCap·Cookie·Realm Grinder·Egg Inc.) 실측 공식 비교
   https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii
3. **The Math of Idle Games, Part II** — 파생 생산기 체인 수학(테일러 급수 → 지수 접근), 8단 체인 설계 직결
   https://www.gamedeveloper.com/game-platforms/the-math-of-idle-games-part-ii
4. **GDC Europe 2016: Quest for Progress (Anthony Pecorella)** — 방치형 디자인 권위 GDC 강연 + 스프레드시트 모델 공개
   https://archive.org/details/GDCEU2016Pecorella
5. **Balancing Tips: How We Managed Math on Idle Idol** — 실전 밸런싱 실패·성공 사례, "자릿수 앵커" 수동 오버라이드 기법
   https://www.gamedeveloper.com/design/balancing-tips-how-we-managed-math-on-idle-idol
