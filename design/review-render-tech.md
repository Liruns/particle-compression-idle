# 독립 기술 리뷰: `design/m2-render-plan.md`

- 리뷰어: tech-architect (독립 리뷰 — 본 계획서를 작성하지 않음)
- 리뷰일: 2026-06-26
- 대상: 정거장2 첫 비주얼 슬라이스 렌더 레이어 구현 계획(r 게이지 글로우 + L1 헤이즈 + L1/L6 앰비언트 파티클)
- 대조한 계약·코드: `src/render/index.ts`(Renderer 계약), `src/core/loop/index.ts`(GameLoop), `src/game.ts`(snapshot/notify/render 와이어링), `src/App.svelte`(생명주기), `src/core/state/index.ts`(getState 싱글톤), `src/core/loop/scheduler.ts`, `src/ui/tokens.css`(글로우·모션 토큰·reduced-motion 예고), `design/tech-architecture.md` §4.1·§5.2·§6.1·§6.3·§6.4·§4.4·§2.2

---

## 판정: **APPROVE-WITH-CHANGES**

와이어링 (B) 채택, Canvas2D 선택, 풀링·읽기전용·데이터주도 방향은 건전하고 계약·격리·결정성 원칙과 정합한다. **BLOCKER 없음.** 단, 계획서가 근거로 든 두 전제가 코드와 어긋나 착수 전 문서 수정이 필요하다(아래 MAJOR 3건). 모두 설계 방향 전환이 아니라 계획서 명문화로 닫힌다.

핵심 모순 2가지:
1. "snapshot은 이미 매 프레임 호출되므로 별도 폴링 불필요"는 맞지만, 그렇기 때문에 **App의 두 번째 rAF가 더해지면 snapshot이 프레임당 2회 생성**될 함정이 있고 계획서는 이 합성 비용을 다루지 않았다(M1).
2. "GC 0"을 예산으로 내걸었으나 **snapshot() 자체가 이미 매 프레임 수십 개 객체를 할당**한다 — 렌더 풀링만으로는 앱 전체 GC 0이 성립하지 않는다(M2).

---

## 코드 대조로 검증한 사실

- `render: () => this.notify()` (game.ts:291) → `notify()` (game.ts:1125-1127) → `snapshot()` (game.ts:918) : snapshot이 이미 **rAF마다** 생성된다.
- `snapshot()`은 가벼운 읽기가 아니다 — 매 호출 8-티어 루프(`tierCost`×8, `tierProductionRate`×8), `productionMult` 3회+, `composeOwned`, `previewPrestige`(Decimal 다수), `chainTierMultipliers`를 돈다. 또한 **최상위 객체 + tiers 배열 + 8 TierSnapshot + resonance/phase/harmonics/prestige/research/ftue/layer/codex 객체**를 매 프레임 새로 할당한다.
- `getState()` (state:219)는 **공유 가변 싱글톤**이고, `snapshot()`은 `discovered` Set(game.ts:950, 1068)과 Decimal 필드(C, rateC, r, mult)를 **복사 없이 live 참조**로 내보낸다 → 렌더의 읽기전용은 타입이 아니라 규율로만 보장.
- GameLoop(loop:105-140)는 `document.hidden`을 **전혀 보지 않는다** — 백그라운드 스로틀 + `MAX_CATCHUP_SECONDS=5`(loop:114) 초과분을 `onOverflow`(game.ts:294 → applyOverflowOffline)로 오프라인 흡수하는 것이 설계(tech §6.4).
- break_eternity: `log10()`은 Decimal 메서드(bignum:48), `.toNumber()` 존재 → `rateCLog10` 파생은 §2.2(게임수치 native 금지) 위반 아님(표현용 파생 number).
- tokens.css 토큰 모두 실재 확인: `--col-glow-core` #3ecf8e(26), `--glow-core-radius-{min,mid,max}` 3/8/14px(131-133), `--glow-layer-ambient` 24px(134), `--motion-ambient-pulse` 4000ms(189), `--motion-particle-fade-{out,in}`(166-167), data-layer 슬러그(263+), `--layer-mol-accent` #8bc34a / `--layer-prn-accent` #7c4dff. **tokens.css:251이 파티클 reduced-motion을 `$reducedMotion` 스토어로 명시 예고** — 계획서 주장 정확.

---

## 발견사항

### [MAJOR] M1 — 와이어링 (B): 두 rAF의 snapshot 생성이 프레임당 2회로 중복될 수 있다 (§2.1·§2.2·§9.2)
계획서 §2.2 "중요 관찰"은 정확하다(notify가 이미 rAF마다 snapshot 생성). 그런데 §9.2는 App subscribe 콜백에 `renderer.setSnapshot(s)`를 추가하면서 **동시에** App이 **자체 rAF**로 `draw()`를 돈다(§2.1-B). 함정:
- App rAF가 `game.snapshot()`을 직접 부르거나, notify와 draw가 별도 rAF 콜백이라 브라우저가 다른 프레임에 배치하면 → snapshot이 프레임당 1회 더 생성(2회)되거나, notify의 snapshot이 렌더에 안 쓰이고 App이 또 도는 **이중 구동**.
- snapshot 1회는 측정상 무시 가능하지 않다(위 부하 참조). 2회는 더더욱.

**권장 수정(계획서 명문화):**
1. App 자체 rAF 신설을 **기각**하고, App **subscribe 콜백(프레임당 1회, GameLoop notify가 구동)** 안에서 `renderer.setSnapshot(s); renderer.draw()` 연달아 호출. snapshot 단일 소스=notify, draw는 소비만.
2. 효과: rAF 1개 → snapshot 1회/프레임, draw 시점=snapshot 시점(tearing 0), dispose 표면 축소(App rAF cancel 불필요). Game 무오염(notify는 누가 구독했는지 모름) → platform 격리 100% 유지. 파티클/헤이즈/맥동은 렌더러 내부 `performance.now()` 자체 적분(§2.3 그대로).
3. 향후 게이지 위치 alpha 보간이 **실제로** 필요해지면 그때 App rAF(또는 A식 단일 루프)로 승격 — 옵션 보존.
4. 계약 위반 아님: `draw(alpha)`를 GameLoop 밖에서 부르는 것은 "읽기전용" 본질을 지키는 한 합법. 단 `index.ts:19` 주석("GameLoop render 콜백에서 호출")을 "표현 레이어에서 호출(호출자 무관, 읽기전용)"로 갱신해 코드 주석과 의도를 정합.

### [MAJOR] M2 — "GC 0" 성능 예산이 기존 snapshot 할당과 모순된다 (§8 성능 예산표)
§8은 "GC 스파이크 0 — 풀링으로 프레임 중 할당 금지"를 건다. 그러나 `snapshot()`이 렌더 도입 **전부터** 매 프레임 수십 객체를 할당한다(본 슬라이스 범위 밖, game.ts 로직). 렌더가 풀링으로 할당 0을 달성해도 **앱 전체 GC 0은 거짓 명제**다. 구현자가 문자대로 받으면 Minor GC를 "내 렌더 버그"로 오인하거나 "GC 보임=위반"으로 오리포트.

**권장 수정:** 예산을 정확히 재정의 — **"렌더 레이어는 프레임당 추가 힙 할당 0(파티클·gradient·타일 사전할당/재사용). snapshot() 기존 할당은 본 슬라이스 범위 밖이며, 렌더가 그것을 증가시키지 않음을 측정 기준으로 한다."** §8 측정 방법의 "GC 스파이크 0 확인"을 **"렌더 도입 전후 GC 빈도·크기 비교(증가분 0)"**로 변경. (snapshot 매 프레임 할당 최적화는 별도 백로그 — 본 리뷰 범위 아님.)

### [MAJOR] M3 — `document.hidden` 스킵이 GameLoop catch-up/overflow와 종속(이중/누락 위험) (§7.3 vs loop §6.4)
§7.3은 App rAF에서 `document.hidden`이면 draw 스킵 + 파티클 시간 적분 정지(복귀 시 dt 클램프)를 둔다. 자체는 옳다. 그러나 **GameLoop는 `document.hidden`을 안 봄** — 스로틀 + `MAX_CATCHUP_SECONDS` overflow → 오프라인이 설계(tech §6.4). 의존 누락:
- M1에서 "subscribe 콜백 내 draw" 변형을 택하면 App rAF가 없으므로 **§7.3 명시적 visibility 스킵 지점이 사라진다.** draw가 notify에 묶이고, GameLoop가 백그라운드에서 스로틀되면 draw도 자연히 멈춘다(별도 스킵 불필요).
- 즉 §7.3 구현은 **M1의 와이어링 선택에 종속**인데 계획서가 이를 다루지 않았다.

**권장 수정:**
1. subscribe-콜백-draw 채택 시 §7.3 명시적 `document.hidden` 스킵·`visibilitychange` 재개 로직 **삭제**(GameLoop 스로틀이 자동 처리). 렌더러 내부 파티클 dt 클램프(예 `dt=min(realDt,0.1)`)만 유지 → dispose 표면 1개 감소.
2. App rAF 변형 유지 시: App rAF의 dt 클램프는 **순수 시각용**이며 게임시간(GameLoop 소유)과 무관함을 명시. **오프라인 흡수는 전적으로 GameLoop+overflow 책임, 렌더는 오프라인/시간 보정에 일절 불관여(읽기전용)**를 §7.3에 한 줄 못박아라.

### [MINOR] M4 — snapshot이 live Set·live Decimal 참조를 노출 — 읽기전용은 규율로만 보장 (§3·§8)
`snapshot()`은 `discovered`(game.ts:950, 1068)를 복사 없이 live Set으로, Decimal 필드도 live 인스턴스 참조로 내보낸다. 렌더러가 실수로 `snap.discovered.add()` 하면 결정성·세이브 오염(Decimal은 break_eternity가 대부분 새 인스턴스 반환이라 사고 가능성 낮으나 Set은 진짜 위험).
**권장 수정:** 본 슬라이스 렌더러는 `dec`(number)·`rateCLog10`(number)·`rateCPositive`(boolean)·`layer.slug`(string)만 읽는다 — Set·Decimal 비접근. 이를 §3·§9.2에 명시("렌더러는 number/boolean/string 파생만 읽음 — Set·Decimal 직접 접근 금지"). §10-7에 "렌더러 코드에 `snap.discovered`/`snap.C`/`.add(`/`.mul(` 직접 접근 없음을 grep 확인" 추가.

### [MINOR] M5 — `rateCLog10` 매 프레임 `log10().toNumber()` 비용·조건부 계산 (§5.5·§9.2)
break_eternity `log10()`은 native보다 수배 느림. 계획은 매 프레임 무조건 추가. `rateCPositive` 게이트로 회피는 §5.5 예시(`rateC.gt(0) ? log10().toNumber() : 0`)가 맞다(프레임당 gt 1회 + 양수 시 log10 1회). 결정성·§2.2 경계 통과(표현용 파생 number는 native 금지 대상 외, 세이브 비대상).
**권장 수정:** "log10 1회/프레임 — 측정 확인, 초과 시 강등" 명시. **`rateCLog10`을 everySecond 스케줄러/N프레임마다 갱신하는 LOD 옵션**을 §5.5에 열어둬라(파티클 속도는 초 단위 갱신으로 충분, log10이 초당 1회로 하락).

### [MINOR] M6 — DPI/리사이즈 엣지 누락 (§2.4)
1. **게이지 글로우 캔버스 0-size**: 탭 전환(compress→codex)·`canvasReady`/FTUE 분기로 `display:none`이면 ResizeObserver가 0×0 보고 → `createRadialGradient(...,0,...)`에 NaN/0 반경 → throw/빈 그리기. **width/height ≤ 0이면 draw 스킵, 백버퍼 재할당 안 함** 가드 명시.
2. **dpr 변경 시 오프스크린 타일**: 모니터 이동 dpr 1→2면 메인은 setTransform 스케일되나 타일 비트맵은 저해상도 → 헤이즈 흐려짐. **헤이즈는 의도적 저주파라 타일 dpr 비의존(재생성 불필요)**으로 명시.
3. **글로우 캔버스 dpr**: 글로우는 선명해야 하므로 dpr 변경 시 **글로우 백버퍼 재할당 필요**(타일과 다른 정책) — 구분 명시.
4. **dispose 목록에 `matchMedia(resolution)` 리스너 추가**(현재 reduced-motion matchMedia만 언급).

### [NIT] M7 — L6 강제 진입 dev 훅이 메커니즘 활성 상태와 불일치 (§5.4·§10-2)
dev `onLayerChange('prn')` 강제는 렌더만 prn 전환, 상태는 분자(currentIndex=1) 유지(의도대로 로직 무관). 단 §5.4 L6 파티클이 `snap.phase.state` 변화를 재생성 신호로 쓰는데 강제 prn에선 phase 비활성(state 기본 고정) → **색 온도 대비는 검증되나 위상 기반 운동/재생성은 검증 불가**. §10-2에 한계 명시(색 대비만 조기 검증, 위상 운동은 실제 L6 도달 후) 또는 dev훅에서 phase.state 순환 스텁 추가. 마케팅 핵심(art §453)은 색 대비라 현 범위로 충분 — 한 줄 한계 명시면 족함.

### [NIT] M8 — `.r-core` 폴백 전략이 SSR/no-JS와 무관 (§3.4)
앱은 Svelte CSR 단일 페이지(App.svelte onMount에서 전부 구동, line 273 "초기화 중…")라 **no-JS 폴백은 애초에 성립 불가**. `.r-core` 폴백의 실제 의미는 "`getContext('2d')` null 시 DOM 점 유지"뿐. §3.4를 "JS 비활성 점진 향상"이 아니라 **"캔버스 컨텍스트 획득 실패 폴백"**으로 정정.

---

## 열린 질문 답변 (계획서 §10 중 tech-architect 대상)

### Q1 [와이어링 A/B] → **(B) 채택 지지. 단 "App 자체 rAF 신설"은 기각하고 "subscribe 콜백 내 draw"를 기본으로.**
platform 격리(Game이 캔버스 무지) 우선순위는 전적으로 옳다. (A)는 jsdom 테스트·데스크톱(Tauri)에서 Game에 렌더러 분기를 강제하고 "Game=순수 로직" 경계를 깬다 → 기각 정당. rAF 1개 절약이 그 결합을 정당화 못 함.

그러나 (B)를 "App이 자체 rAF를 또 돌린다"로 고정하지 마라. snapshot 생성이 이미 GameLoop rAF(notify)에 묶여 있으므로 App의 두 번째 rAF는 (a) 보간 가치가 이 슬라이스에 없고(§2.3 스스로 인정), (b) snapshot/draw 시점 분리로 tearing·이중 snapshot 함정(M1)을 연다.
**권장 형태: App subscribe 콜백(프레임당 1회, notify가 구동)에서 `renderer.setSnapshot(s); renderer.draw()` 호출.**
- Game 무오염 유지(notify는 구독자 무지) → platform 격리 100%.
- rAF 1개 → snapshot 1회/프레임, draw 시점=snapshot 시점(tearing 0), dispose 표면 축소.
- 파티클/헤이즈/맥동은 렌더러 내부 `performance.now()` 자체 적분(§2.3 그대로) → notify가 rAF 빈도라 부드러움 유지.
- alpha 보간이 실제 필요해지면 그때 App rAF/단일 루프로 승격 — 옵션 보존.
- 계약 위반 아님(`index.ts:19` 주석만 "표현 레이어에서 호출"로 갱신).

### Q4 [layer-visuals 위치] → **`src/render/layer-visuals.ts` (render/ 분리) 채택. data/ 통일은 기각.**
tech §4.4 "수치는 data/"의 대상은 **로직 수치**(입자·연구·비용 — economy/content/systems가 확정하고 game-programmer가 로직 수정 없이 주입). `LayerVisual`(tileColorToken·driftPxPerSec·sizeRange·density·spawnPattern)은 **표현 파라미터**이고:
- 소비자가 렌더러 단독(로직 절대 비참조) → data/에 두면 로직↔표현 경계가 흐려짐.
- 색을 토큰 키 문자열로 두고 런타임 getComputedStyle 해석(§1.2)하는 구조는 tokens.css(표현 진실) 종속 → render/ 소속 자연스러움.
- art-direction이 튜닝하는 값이지 economy가 아니다.

**경계 규칙 명시 권장**: tech-architecture.md §4.4에 "data/=tick이 읽는 수치, render/layer-visuals.ts=표현만 읽는 파라미터(로직 절대 비참조)" 한 줄 추가. slug 키는 `core/layers`·tokens.css와 동일 집합 재사용(mol/atom/.../plk) — 별도 슬러그 신설 금지, 기존 import.

### Q9 [WebGL 승격 트리거] → **수용 가능. 처음부터 추상화는 YAGNI.**
"차기 L9/L11이 2D로 60fps 미달이 **프로파일로 증명되면** 그 층만 WebGL 분리, 2종 공존" 전략은 기술적으로 건전하다:
- 본 슬라이스 부하(≤120 파티클·헤이즈 1·글로우 1)는 2D로 60fps 압도적 여유 — WebGL 추상화는 셰이더/컨텍스트로스트/이식(Tauri WebView2 드라이버) 복잡도만 추가(tech §6.3 "단순함이 안정성", §5.1 WebView 단일 컨텍스트 정합).
- 컨텍스트 로스트 복구는 방치형 장시간 구동의 실질 리스크 — 필요해질 때만 비용 지불이 옳다.
- 캔버스 레이어가 이미 z-stack 분리(§2.4)되어 특정 층 한 레이어만 WebGL 교체 가능 — 공존에 아키텍처 장벽 없음.

**조건 2개를 §10-9에 못박을 것:**
1. **`Renderer` 계약은 렌더기술 무관 유지**(이미 그러함: draw/onLayerChange/dispose는 2D/WebGL 공통). 승격이 계약 비간섭 → 승격 비용이 "레이어 1개 교체"에 국한.
2. **`layer-visuals.ts` config는 렌더기술 중립**(density·speedBase·shape는 2D/WebGL 동일 의미). shape를 'circle'/'arc' 추상 enum으로(§5.2 이미 그러함), 기술이 자기 방식으로 해석. Canvas2D 전용 가정(arc() 파라미터 등) 박지 말 것. → 승격 시 config 재작성 0.

처음부터 백엔드 추상화 레이어를 세우는 것은 YAGNI — `Renderer` 계약 + 기술중립 config 두 가지면 차기 분리 비용이 충분히 낮다.

---

## 착수 전 고칠 핵심 (4건 — 전부 문서 수정으로 닫힘, 방향 전환 아님)

1. **[M1] 와이어링을 "subscribe 콜백 내 `setSnapshot+draw`"로 확정** — App 자체 rAF 신설을 기본에서 제거(보간 필요 시로 연기). snapshot 단일 소스=GameLoop notify, draw는 소비만. `index.ts:19` 계약 주석을 "표현 레이어에서 호출(읽기전용)"로 갱신. → snapshot 이중 생성·tearing 차단.
2. **[M2] "GC 0" 예산을 "렌더 레이어 추가 할당 0(snapshot 기존 할당은 범위 밖, 렌더가 증가 안 시킴)"으로 재정의** — §8 측정 기준을 "렌더 전후 GC 증가분 0"으로 변경.
3. **[M3] `document.hidden` 스킵을 와이어링 선택에 종속시켜 정리** — subscribe-콜백-draw면 명시적 visibility 스킵 불필요(GameLoop 스로틀이 처리), 렌더러 내부 dt 클램프만. 오프라인 흡수는 GameLoop+overflow 전담, 렌더는 시간 보정 불관여를 §7.3에 명문화.
4. **[M4+M6] 읽기전용 규율·DPI 엣지 명시** — (a) 렌더러는 snapshot에서 number/boolean/string 파생만 읽음(Set·Decimal 직접 접근 금지) + §10-7 grep 검증 추가; (b) 게이지 캔버스 0-size 가드, dpr별 타일(흐려도 무방)/글로우(재할당 필요) 정책 구분, dispose에 `matchMedia(resolution)` 추가.

나머지(M5 log10 LOD, M7 dev훅 한계, M8 폴백 표현)는 착수 중 반영 가능한 MINOR/NIT.

**결정성·세이브 최종 판정**: game.ts 변경은 `snapshot()`에 순수 파생 number/boolean 2개 추가뿐 — `tick()`·세이브 직렬화·`advance()` 경로 비간섭이므로 결정성·세이브 round-trip 불변이 코드상 성립(§10-7 검증 계획 타당). 단 M4(렌더러의 live Set/Decimal 비접근)가 지켜지는 한에서만 보장되므로 M4를 필수에 포함.
