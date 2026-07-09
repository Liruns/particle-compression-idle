# 정거장2 첫 비주얼 슬라이스 — 렌더 구현 계획서 (m2-render-plan v0.2)

- 작성: graphics-programmer (v0.1) → 메인 (v0.2 리뷰 반영 개정)
- 작성일: 2026-06-26
- 상태: **계획서 v0.2 (독립 리뷰 2건 반영·착수 게이트 통과). 코드 미구현.**
- 리뷰: `design/review-render-tech.md`(tech-architect, APPROVE-WITH-CHANGES) + `design/review-render-art.md`(art-director, REVISE). **★아래 §v0.2 섹션이 v0.1 본문과 충돌 시 우선한다.** v0.1 본문은 맥락·근거로 유지.
- 기준 문서: `design/art-direction.md`(§453 슬라이스 순서·§3-A·§4-A·§5-A·§5-C·§7), `design/tech-architecture.md`(§4.1·§6.1·§6.3·§6.4), `design/DESIGN.md`(game-ui.particles·reduced-motion), `src/ui/tokens.css`(팔레트·모션·글로우 토큰), `src/render/index.ts`(`Renderer` 계약), `src/game.ts`(`GameSnapshot`·`subscribe`), `src/App.svelte`(셸·`.r-core`).
- 범위: art-direction §453이 지정한 **첫 비주얼 슬라이스 3개** — (1) r 게이지 글로우 역설, (2) L1 분자층 배경 헤이즈, (3) L1+L6 앰비언트 파티클. L2~L5·L7~L11은 **데이터 구조만** 확장 가능하게 두고 구현은 차기.
- **철칙**: 데이터 주도 / 읽기전용 렌더 계약(상태 불변) / 60fps / 기존 tokens.css 재사용 / 기존 설계 문서와 충돌 시 명시(임의 덮어쓰기 금지).

---

## 0. 핵심 결정 요약 (TL;DR)

| 영역 | 결정 | 한 줄 근거 |
|---|---|---|
| **렌더 기술** | **Canvas2D** (`radialGradient` 글로우 + 2D 파티클). WebGL 안 씀 | 동시 입자 ≤120·헤이즈 1장·글로우 1개 → 2D로 60fps 충분. WebGL은 컨텍스트·셰이더·이식 복잡도만 추가 (art §7 "60fps 보장 조건"·tech §6.3) |
| **구동·와이어링** | **(B) App.svelte가 canvas+렌더러 소유, 자체 rAF로 `draw()`, 최신 snapshot 읽음** | Game을 순수 로직(캔버스/DOM 무지)으로 유지 = platform 격리(tech §5.2·§4.4). rAF 2개의 비용은 무시 가능 |
| **캔버스 마운트** | `<main>` 뒤 `position:fixed` 전역 배경 레이어 1장(헤이즈+파티클) + 게이지 자리 인라인 캔버스 1장(글로우) | 배경은 화면 전체, 글로우는 게이지 박스에 정밀 정렬. 레이어 분리(tech §6.3) |
| **글로우 ↔ DOM** | **기존 `.r-core` DOM 점은 캔버스 글로우로 대체**(DOM은 0-size 앵커/폴백만) | 16px box-shadow 점이 마케팅 약점(art §6-B). 캔버스 radialGradient가 진짜 글로우 |
| **배경 헤이즈** | 오프스크린 타일(value-noise 사전계산) → 메인에 2회 타일 드리프트 | 절차적 매 프레임 노이즈는 비쌈. 사전계산 1회 + 변환만 (tech §6.2) |
| **파티클** | 사전할당 객체 풀(고정 배열, GC 0) + 층별 config 데이터 주도 | 누수·GC 스파이크 0(tech §6.1·§6.3). L2~L11은 config 추가만 |
| **reduced-motion** | JS `matchMedia` → `$reducedMotion` Svelte 스토어 신설(파티클 속도 ≤10%·맥동·드리프트 정지). 캔버스는 CSS 미디어쿼리가 안 닿으므로 JS로 분기 | tokens.css는 DOM만 커버. DESIGN.md §846·tokens.css §251이 `$reducedMotion` 스토어를 명시 예고 |
| **백그라운드** | `document.hidden`이면 rAF에서 draw 스킵(파티클 정지) | 배터리·발열(tech §6.4). 로직은 game.ts가 이미 오프라인 경로로 흡수 — 렌더는 그릴 것만 안 그림 |
| **성능 측정** | dev 전용 FPS 카운터(rAF delta EMA) + Chrome Performance 프로파일 + 파티클 수 HUD | 60fps·GC 스파이크 0을 증거로 (tech §6.3) |

---

## 1. 렌더 기술: Canvas2D vs WebGL

### 1.1 결정: **Canvas2D**

이 슬라이스의 렌더 부하를 정량화하면:

| 요소 | 동시 객체 수 | 프레임당 연산 |
|---|---|---|
| r 게이지 글로우 | 1 (radialGradient) | gradient 1회 생성(또는 캐시) + fillRect 1~2회 |
| L1 배경 헤이즈 | 1 (사전계산 타일) | drawImage 2~3회 (타일 드리프트) |
| L1 앰비언트 파티클 | 중밀도 ≈ 40~70 | 파티클당 arc+fill 1회 |
| L6 간섭 파면 아크 | 저밀도 ≈ 10~20 | 아크당 stroke 1회 |
| **합계 (최악 L1)** | **≈ 75 draw call** | 60fps에서 충분 |

Canvas2D는 수백 개의 단순 `arc`/`fillRect`/`drawImage`를 60fps로 그릴 수 있다. 우리 상한(§8: 총 ≤120)은 그 한참 아래다.

**WebGL을 쓰지 않는 이유:**
- 글로우 = `radialGradient`는 Canvas2D 네이티브. WebGL fragment shader로 같은 falloff를 내려면 셰이더·프로그램·유니폼 보일러플레이트가 필요한데, **객체 1개**를 위해 그 복잡도는 과투자.
- 파티클 ≤120는 GPU 인스턴싱이 필요한 규모가 아니다(인스턴싱은 수천~수만에서 의미).
- WebGL 컨텍스트는 컨텍스트 로스트(탭 백그라운드·GPU 리셋) 복구 처리, 이식(Tauri WebView2) 시 드라이버 변수가 늘어난다. 방치형 장시간 구동에서 **단순함이 안정성**.
- art §7이 "60fps 보장 조건"을 협의 항목으로 명시 → 2D로 보장되면 WebGL 불요.

**WebGL로 승격할 미래 트리거(지금 아님):** 동시 파티클이 수천을 넘는 층(예: L11 픽셀 붕괴 화면 해체, L9 거품 대량 생성·소멸)이 60fps를 2D로 못 지키는 것이 **프로파일로 증명되면** 그 층만 WebGL 레이어로 분리. 현재 슬라이스(L1/L6)는 해당 없음. → §10 열린 질문.

### 1.2 색 토큰 읽기: getComputedStyle vs JS 상수 미러

캔버스는 CSS 변수를 직접 못 읽는다(`fillStyle = 'var(--x)'` 불가). 두 방법:

- **(택1) `getComputedStyle` 1회 캐시 + 층 전환 시 갱신.** `onLayerChange(slug)`에서 `getComputedStyle(rootEl).getPropertyValue('--layer-accent')` 등을 읽어 hex 문자열로 캐시. 색맹 모드(`[data-colorblind]`)·런타임 토큰 변경이 **자동 반영**된다(tokens.css가 진실). 비용은 층 전환 시 ~10회 read뿐(매 프레임 아님).
- (기각) JS 상수 미러: tokens.css 값을 TS에 복붙 → 단일 진실 깨짐(색맹 모드·토큰 수정이 캔버스에 반영 안 됨). DESIGN.md §625가 "파티클 색도 자동 반영"을 명시 → **getComputedStyle 채택**이 그 의도와 일치.

읽을 토큰(층별, `onLayerChange`에서 캐시): `--layer-accent`, `--layer-glow`, `--layer-bg`, `--col-glow-core`, 그리고 글로우 falloff에 쓸 알파 변형(아래 §3). 파티클 색에 알파를 입히려면 hex→rgba 변환 헬퍼가 필요(파싱은 `#rrggbb` → `rgba(r,g,b,a)`).

---

## 2. 구동·와이어링 아키텍처 (가장 중요)

### 2.1 후보 비교

**(A) GameLoop의 render 콜백 확장** — `game.ts`에서 `render: (alpha) => { this.notify(); this.renderer?.draw(alpha); }`.

- 장점: 단일 rAF(GameLoop가 이미 rAF 구동). 계약 문자 그대로(`draw(alpha)`가 GameLoop render에서 호출).
- 단점: **Game이 캔버스를 알게 된다.** game.ts는 현재 "순수 로직, DOM/캔버스 무지"(§4.4 platform 격리). Renderer를 주입하려면 Game 생성자/필드가 표현 레이어를 참조 → platform 경계 오염. 데스크톱(Tauri)·테스트(jsdom, 캔버스 없음)에서 Game을 띄우면 렌더러 분기 필요.
- 결정성 영향: 없음(draw는 읽기전용). 단 구조적 결합이 생긴다.

**(B) App.svelte가 canvas+렌더러 소유, 자체 rAF** — App.svelte `onMount`에서 canvas 생성·`CanvasRenderer` 인스턴스화·자체 `requestAnimationFrame` 루프로 `renderer.draw()`. 최신 snapshot은 기존 `subscribe`로 받아 렌더러에 푸시(`renderer.setSnapshot(snap)`).

- 장점: **Game은 순수 로직 그대로**(캔버스 0 참조). platform 격리 유지(tech §5.2·§4.4). 캔버스는 표현 레이어(App.svelte)에만 존재 → 테스트/헤드리스에서 Game 무영향. 계약(`Renderer`)도 그대로 구현(draw/onLayerChange/dispose) — 호출자가 GameLoop가 아니라 App일 뿐, 계약은 "누가 부르든 읽기전용"이 본질.
- 단점: rAF 2개(GameLoop 1 + App 렌더 1). 그러나 둘 다 rAF라 브라우저가 동일 vsync에 모음 → 실질 비용 무시 가능. `alpha` 보간은 App rAF가 자체 계산하거나 생략(방치형 앰비언트는 보간 불필요 — §2.3).
- 결정성: 영향 0(렌더는 상태 안 건드림).

### 2.2 결정: **(B) 채택**

근거 우선순위: **platform 격리(tech §5.2 "웹 우선 개발이 Steam 의존으로 오염되지 않게") > rAF 1개 절약.** Game이 캔버스를 참조하는 순간, jsdom 테스트·데스크톱(Tauri)·헤드리스 검증에서 분기가 필요해지고, "Game은 순수 로직"이라는 현 아키텍처의 깔끔한 경계가 깨진다. (B)는 그 경계를 지키면서 `Renderer` 계약을 100% 만족한다. rAF 2개는 측정상 무의미(둘 다 동일 프레임에 배치).

**중요 관찰**: `game.subscribe(fn)`는 현재 `notify()`를 통해 **이미 rAF 빈도로** Svelte에 스냅샷을 푸시한다(`render: ()=>this.notify()`). 즉 App은 이미 매 프레임 최신 snapshot을 받는다. 렌더러는 그 snapshot을 참조만 하면 된다. 별도 폴링 불필요.

### 2.3 alpha 보간 처리

GameLoop는 `render(accumulator/TICK_DT)`로 alpha를 주지만 현재 `()=>this.notify()`가 이를 버린다. (B)에서 App의 rAF는 GameLoop와 별개이므로 alpha를 GameLoop에서 못 받는다. **이 슬라이스는 alpha 보간이 불필요**하다:

- 글로우 반경은 `snap.dec`(20fps로 갱신, ease는 CSS 아닌 렌더러 자체 lerp로 부드럽게 — §3.3)에서 온다. dec는 초당 미세 증가라 20fps 스텝이 시각적으로 안 튄다.
- 파티클·헤이즈는 **자체 시간 기반 애니메이션**(렌더러 내부 `performance.now()` delta로 위치 적분) — 로직 tick과 무관한 앰비언트 모션(art §5-C "파티클은 항상 움직인다"). tick 보간이 필요 없다.

→ `draw(alpha)` 시그니처는 계약대로 유지하되, App rAF는 `draw(1)` 또는 `draw(0)`로 호출(이 슬라이스는 alpha 미사용). 향후 게이지 위치 보간이 필요해지면 App rAF가 자체 accumulator로 alpha를 계산하거나, (A)식 단일 루프로 리팩터하는 선택지를 남긴다. → §10 열린 질문.

### 2.4 캔버스 마운트·소유권·리사이즈

**레이어 2장 분리**(tech §6.3 "배경/메인 UI/오버레이 분리"):

1. **배경 캔버스** (`canvas.bg-fx`): `position:fixed; inset:0; z-index:-1; pointer-events:none`. `<main>` **뒤**(아래 레이어). 화면 전체. 헤이즈 + 앰비언트 파티클. `<main>`의 `background: var(--layer-bg)`는 반투명/유지 — 캔버스가 그 위에 헤이즈를 얹는 게 아니라, 캔버스가 가장 뒤이고 main 배경이 살짝 비치게 하거나, main 배경을 `transparent`로 바꾸고 캔버스가 base+haze를 모두 그림. **권장**: main 배경 유지(딥 다크 base), 배경 캔버스는 그 위(여전히 z-1이지만 main 콘텐츠 박스는 배경색 없는 영역이 많아 캔버스가 비침). → 정확한 z 스택은 §10 열린 질문(art-director·ux 확인).
2. **글로우 캔버스** (`canvas.gauge-glow`): `.gauge` 섹션 내부, `.r-core` 자리. `position:absolute` 중앙 정렬, 게이지 박스 크기(예: 120×120 CSS px). `.r-core` DOM은 0-size 앵커 또는 `display:none` 폴백(§3.4).

**소유권**: App.svelte `onMount`에서 두 canvas의 2D context를 얻어 `CanvasRenderer`에 주입. `onDestroy`에서 `renderer.dispose()`(rAF 취소·풀 해제·리스너 제거 — tech §6.1 누수 방지).

**리사이즈·DPI**: `ResizeObserver`(배경=window resize, 글로우=게이지 박스) + `devicePixelRatio`. 각 캔버스의 `width/height`(백버퍼)는 `CSS크기 × dpr`, `style.width/height`는 CSS크기, context를 `setTransform(dpr,0,0,dpr,0,0)`로 스케일 → 레티나에서 글로우·파티클이 선명. dpr 변경(모니터 이동)도 ResizeObserver/`matchMedia(resolution)`로 재설정. 백버퍼 재할당은 리사이즈 시에만(매 프레임 아님).

---

## 3. r 게이지 글로우 (마케팅 심장)

art §3-A·§6-B, tokens.css `--glow-core-radius-{min/mid/max}`(3/8/14px)·`--glow-layer-ambient`(24px).

### 3.1 radialGradient 구성 (코어 + falloff)

글로우 캔버스 중심 `(cx,cy)`에 두 겹:

- **코어**: `createRadialGradient(cx,cy,0, cx,cy,coreR)` — stop0 = 글로우색 알파 1.0, stop1 = 알파 0. `coreR` = dec 매핑 반경(§3.2). 가장 밝은 중심.
- **앰비언트 falloff(글로우 헤일로)**: `createRadialGradient(cx,cy,0, cx,cy,ambientR)` — stop0 = 글로우색 알파 ~0.35, stop0.4 = 알파 ~0.12, stop1 = 알파 0. `ambientR` = `coreR × 비율 + --glow-layer-ambient`(부드러운 넓은 산란). 코어보다 크고 약함.

합성: `globalCompositeOperation='lighter'`(가산 혼합)로 falloff→코어 순서로 그리면 중심이 포화되며 빛나는 느낌. 배경이 어두울수록(깊은 층) 가산 글로우가 더 도드라짐 = art §2-0 "깊을수록 중심은 더 강하고 날카롭게"와 일치.

색: 기본 `--col-glow-core`(#3ecf8e)에 **층 악센트 10~20% 블렌딩**(art §3-A). `onLayerChange`에서 `mix(glowCore, layerAccent, 0.15)`를 계산해 캐시(hex 보간). L1은 황록, L6은 심자주 쪽으로 살짝 물든 코어.

### 3.2 dec → 반경 매핑

현재 App.svelte: `glowRadius = Math.min(14, 3 + dec*0.42)`(코어 3→14px). 이를 렌더러로 이관하되 토큰과 정합:

- `coreR(dec)` = `clamp(GLOW_MIN + dec × k, GLOW_MIN, GLOW_MAX)` where GLOW_MIN=3, GLOW_MAX=14(토큰값), k≈0.42(현 값 유지 — dec26에서 max 도달). art §3-A "3→8→14px" 3단을 연속 매핑으로 흡수(8px는 중간 dec에서 자연 통과).
- 캔버스는 CSS px → 백버퍼 px = `coreR × dpr`로 그림.
- 입력은 `snap.dec`(이미 native number, BigNumber 변환 불요 — **글로우는 안전**).

### 3.3 4s 맥동 (생산 중일 때만)

art §5-C·tokens.css `--motion-ambient-pulse`(4000ms): 자동 압축 중(생산률>0)이면 글로우가 4s 주기로 미세 맥동.

- 조건: `snap.rateC.gt(0)`(생산 중). Decimal 비교는 snapshot이 이미 제공(`rateC`는 Decimal, `.gt(0)`은 game.ts가 안전 처리 — 렌더러는 boolean만 받게 snapshot에 파생 추가 권장, §9).
- 맥동: `pulse = 1 + PULSE_AMP × sin(2π × t / 4000)`, PULSE_AMP≈0.06(미세). `coreR`와 falloff 알파에 곱. t = 렌더러 내부 시간.
- **dec 스텝 부드럽게**: dec가 20fps로 갱신돼 글로우가 계단지지 않게, 렌더러가 표시 반경을 `displayR += (targetR - displayR) × lerpK`로 매 프레임 추격(시간상수 ~150ms, art §3-A "200ms ease-out"과 정합). 클릭 시 +2px 버스트(art §5-B)는 차기(이 슬라이스는 앰비언트 글로우까지).

### 3.4 기존 DOM `.r-core`와의 관계

**대체.** 16px box-shadow 점이 마케팅 약점(과제 명시). 글로우 캔버스가 그 자리를 차지하고 `.r-core` DOM은:
- 폴백: 캔버스 미지원/JS 비활성 시 최소 점이라도 보이게 `display` 유지하되 글로우 캔버스가 위에 그려져 가림. 또는 캔버스 마운트 성공 시 `.r-core` `opacity:0`.
- 권장: App.svelte에서 `canvasReady` 플래그 → ready면 `.r-core` 숨김, 아니면 기존 DOM 점 유지(점진적 향상). → §9 변경표.

---

## 4. L1 배경 헤이즈

art §2-3(L1 Perlin·투명도 0.04~0.06·황록·드리프트 ≤0.3px/s), tech §6.2(Decimal 연산 최소·사전계산).

### 4.1 노이즈 생성 방식: 사전계산 오프스크린 타일

- **부팅 시 1회**: 오프스크린 캔버스(예: 256×256)에 **value noise**(또는 간단한 다중옥타브 가산) 생성 → 황록(`--layer-mol-accent` 계열) 저주파 헤이즈. 알파 0.04~0.06. ImageData 픽셀 채우기 1회(절차적 매 프레임 금지).
- value noise를 택하는 이유: Perlin 정식 구현은 그래디언트 테이블·보간으로 코드량↑. **저주파 헤이즈는 value noise + 가우시안 블러(또는 큰 셀 보간)로 시각적으로 동일**. 정밀한 Perlin이 필요하면 차기(art §2-3은 "방향 스펙"이라 명시).
- 타일링: 256 타일을 화면에 2~4회 반복(`drawImage` 평행이동). 이음매는 타일을 토로이달(wrap) 노이즈로 생성하면 안 보임.

### 4.2 드리프트

- 매 프레임 `offset += DRIFT × dt`, DRIFT ≤ 0.3px/s(art §2-3). 타일을 `drawImage(tile, offsetX, offsetY)` + wrap으로 무한 스크롤. **백버퍼 재생성 없음** — 변환만(저비용).
- 드리프트 속도를 살짝 `rateC`에 비례시킬지(art §5-C "속도 ∝ C생산률")는 헤이즈엔 과할 수 있어 **고정 저속** 권장(파티클이 rateC 매핑을 담당, §5.5). → 열린 질문.

### 4.3 성능 예산 내 구현

- 매 프레임: `drawImage` 2~4회 + `globalAlpha` 설정. GC 0(타일·오프셋은 사전할당). dec/층과 무관한 순수 앰비언트.
- 데이터 주도: 헤이즈 파라미터(타일색 토큰키·알파·드리프트·옥타브)를 층 비주얼 config(§6)에 둠. L1만 헤이즈, L6는 다른 배경(위상 간섭은 차기 — 이 슬라이스 L6는 파티클만, §5.6).

---

## 5. 파티클 시스템

art §4-A(층별 표)·§5-A(절제)·§5-C(속도∝rateC·페이드), tech §6.1(풀링·GC 0)·§6.3(수=표현 파라미터).

### 5.1 객체 풀 설계 (사전할당·재사용·GC 0)

- **고정 크기 풀**: 부팅 시 `MAX_PARTICLES`(§8, 예 128)개의 Particle 객체를 배열에 사전할당. 각 Particle = `{x,y,vx,vy,size,age,life,active,kind,...}`(전부 number 필드, 객체 형태 고정 → V8 hidden class 안정).
- **활성/비활성 플래그**: 스폰 = 비활성 슬롯을 찾아 필드 재설정(새 객체 생성 금지). 소멸 = `active=false`(객체 버리지 않음). → **할당/해제로 인한 GC 0**(tech §6.1).
- 업데이트: 활성 파티클만 `x+=vx*dt; age+=dt; alpha=fade(age,life)`. 죽으면 비활성화 후 스폰 예산 내 재생성.
- 렌더: 활성 파티클을 형태별로 그림(원=arc+fill, 아크=arc+stroke).

### 5.2 층별 config (데이터 주도)

`src/render/layer-visuals.ts`(또는 `data/`)에 층 slug별 비주얼 config. **L2~L11 추가 = 데이터 추가**(코드 수정 0):

```
LayerVisual {
  haze?: { tileColorToken, alpha:[min,max], driftPxPerSec, octaves } | null
  particles: {
    shape: 'circle' | 'arc' | ...   // DESIGN game-ui.particles와 1:1
    sizeRange: [min, max]           // px
    density: number                 // 목표 동시 활성 수(중밀도/저밀도 → 숫자)
    speedBase: number               // px/s 기준(rateC 매핑 전)
    lifeRange: [min, max]           // s, 페이드 소멸
    fade: 'opacity' | 'regen'       // 소멸 방식
    colorToken: '--layer-accent'    // 색(글로우는 별도)
    spawnPattern: 'brownian' | 'interference-arc'
  }
}
```

이 슬라이스는 **mol·prn 두 엔트리만 채움**. 나머지 9층은 빈 스텁(또는 mol 복제)로 두되 구조는 완비 → 차기 슬라이스가 표만 채움. (DESIGN.md `game-ui.particles`가 이미 11층 스펙을 줬으므로 그 값을 config로 옮기면 됨.)

### 5.3 L1 분자 파티클 (art §4-A)

- 형태: 부드러운 원형(arc+fill, 가장자리 부드럽게 = radialGradient fill 또는 블러). 크기 3~6px.
- 운동: **브라운 운동** — 느린 무작위 보행(`vx,vy`에 작은 무작위 가속 주기 적용 + 감쇠). 중밀도(≈40~70 동시).
- 소멸: 페이드(age/life로 알파 0 수렴 후 비활성·재스폰). 화면 가장자리에서도 페이드.
- 색: `--layer-mol-accent`(#8bc34a) 저알파. 황록 "온기".

### 5.4 L6 프리온 파티클 (art §4-A·§453 온도 대비)

- 형태: **간섭 파면 아크**(arc+stroke, 가변 길이·반경). 저밀도(≈10~20).
- 운동: 위상 속도로 천천히 이동·확장. **위상 전환 시 재생성**(art §4-A "fade: regen") — `snap.phase.state`(coherent/dispersed/resonant) 변화나 `phase_cycled` 이벤트를 신호로 아크 무리를 새로 스폰(차기엔 이벤트 구독, 이 슬라이스는 snapshot.phase.state 변화 감지로 충분).
- 색: `--layer-prn-accent`(#7c4dff) 심자주 "냉기". → **L1 황록 ↔ L6 심자주 온도 대비를 조기 검증**(art §453의 핵심 목적).

L6는 상전이로만 진입(정상 플레이에선 한참 뒤)이라, **검증용으로 dev에서 `data-layer`/snapshot.layer.slug를 prn으로 강제**하는 경로가 필요(§10 검증). `onLayerChange('prn')` 호출 + config 적용으로 렌더만 전환(로직 무관).

### 5.5 속도 ∝ rateC 매핑 (art §5-C)

- 파티클 속도 = `speedBase × speedFactor(rateC)`. `speedFactor`는 rateC를 **로그 압축**해 1.0~~2.0 범위로(생산률이 천문학적으로 커져도 속도가 폭주하지 않게). 방치 중 생산이 빠를수록 화면이 살짝 더 활발 = "방치도 살아있음".
- **BigNumber 안전 변환**: `rateC`는 Decimal. native 연산 금지(tech §2.2). 변환은 **snapshot 경계에서** game.ts가 안전 헬퍼로 `number`를 파생해 제공하는 게 이상적(§9). 예: `rateCLog10: number = rateC.gt(0) ? rateC.log10().toNumber() : 0`(log10은 Decimal 메서드, 결과만 number). 렌더러는 그 number만 받아 `speedFactor = clamp(1 + rateCLog10 × 0.05, 1, 2)` 같은 native 계산(작은 수 영역이라 안전). → 렌더러가 Decimal을 만지지 않게 한다.

### 5.6 이 슬라이스 L6 배경

L6 위상 간섭 **배경 무늬**(art §2-3)는 차기. 이 슬라이스 L6는 **파티클(간섭 아크)만** + base 딥 다크(`--layer-prn-bg`). 온도 대비 검증엔 파티클 색만으로 충분(art §453은 파티클을 명시).

---

## 6. 층 비주얼 config 구조 (데이터 주도)

§5.2의 `LayerVisual`을 **단일 데이터 테이블**로. 프로젝트 원칙 "수치는 data/에"(tech §4.4 `data/` 분리).

- 위치: `src/render/layer-visuals.ts` (렌더 전용 표현 파라미터라 `src/render/` 아래가 적절. game `data/`는 로직 수치 — 표현은 분리). → 위치는 열린 질문(§10): `data/`로 통일 vs `render/` 표현 분리.
- 형태: `Record<slug, LayerVisual>`. slug는 기존 tokens.css/layers.ts와 동일(mol/atom/.../plk). 색은 토큰**키**(문자열)로 두고 런타임에 getComputedStyle로 해석 → 색맹/토큰 변경 자동 반영(§1.2).
- 11층 모두 키 존재(빈 값 허용), mol·prn만 실값. 차기 슬라이스는 이 표의 행을 채우는 PR.
- `onLayerChange(slug)`가 이 표에서 config를 골라 활성 헤이즈·파티클 파라미터를 교체(art §3-B "파티클 리셋": 이전 페이드아웃 0.3s·새 페이드인 0.5s — tokens `--motion-particle-fade-*`).

---

## 7. reduced-motion·접근성

DESIGN.md §846·§634, tokens.css §230~254(이미 DOM 모션 토큰 오버라이드 + "파티클: graphics-programmer가 `$reducedMotion` 스토어 참조" 명시 예고).

### 7.1 `$reducedMotion` Svelte 스토어 신설

- **현재 없음**(grep 확인: tokens.css·widget의 CSS 미디어쿼리만 존재, JS 스토어 미존재). tokens.css §251·DESIGN §846이 `$reducedMotion` 스토어를 **명시적으로 예고** → 이 슬라이스가 그 스토어를 만든다.
- 위치: `src/ui/stores/reduced-motion.ts`(또는 `src/render/`). `matchMedia('(prefers-reduced-motion: reduce)')` → readable store. 변경 리스너로 런타임 토글도 반영.
- 캔버스에 CSS 미디어쿼리가 안 닿으므로(캔버스는 비트맵) **JS로 분기 필수**.

### 7.2 reduced-motion 시 렌더 동작

- 파티클 속도 **≤10% 또는 정지**(DESIGN §634·art §5-C). 권장: 정지(속도 0) + 위치 고정, 또는 speedBase×0.1.
- 글로우 4s 맥동 **제거**(정적 글로우 — tokens `--motion-ambient-pulse:0ms`와 의미 일치). 렌더러는 PULSE_AMP=0.
- 헤이즈 드리프트 **정지**(DRIFT=0).
- dec→반경 lerp 추격은 유지(정보 전달, 깜빡임 아님) 또는 즉시 반영. → 권장: 즉시(계단 허용, 모션 최소).
- 렌더러는 `reducedMotion` boolean을 App에서 주입(`renderer.setReducedMotion(bool)`), 스토어 변경 시 갱신.

### 7.3 document.hidden 백그라운드 스킵

- App rAF 콜백 진입 시 `if (document.visibilityState === 'hidden') return;`(draw 스킵). 파티클 시간 적분도 멈춤(복귀 시 점프 방지: 복귀 프레임에서 dt를 클램프). tech §6.4 "백그라운드=오프라인"은 **로직**을 game.ts가 흡수 — 렌더는 단지 안 그림(CPU·배터리 절약). 복귀 시 `visibilitychange`로 rAF 재개.

### 7.4 색맹 모드

§1.2 getComputedStyle 채택으로 `[data-colorblind]` 변경이 캔버스 색에 **자동 반영**(DESIGN §625 의도). 별도 처리 불요 — 단 `onLayerChange` 또는 colorblind 변경 시 색 캐시 재읽기 필요(MutationObserver on `documentElement[data-colorblind]` 또는 설정 변경 시 명시 호출). → 열린 질문(트리거 방법).

---

## 8. 성능 예산

tech §6.1(누수·GC 0)·§6.2(Decimal 최소)·§6.3(LOD·스킵 자율)·§6.4(백그라운드).

| 항목 | 예산/목표 |
|---|---|
| 프레임율 | **60fps**(16.7ms/frame) 데스크톱. 저사양 폴백 시 30fps 허용(파티클 density↓) |
| 동시 파티클 상한 | **MAX_PARTICLES = 128**(풀 크기). L1 중밀도 ≈40~70, L6 ≈10~20 → 상한 여유 |
| GC 스파이크 | **0** — 풀링으로 프레임 중 할당 금지. gradient는 dec 변할 때만 재생성(또는 매 프레임 1개는 허용 범위) |
| Decimal 연산(렌더) | **0** — 렌더러는 Decimal을 만지지 않음. rateC는 snapshot이 number로 파생 제공(§5.5·§9) |
| 메모리 | 풀+타일 사전할당 후 안정(누수 0). dispose에서 전부 해제 |
| 백버퍼 재할당 | 리사이즈/DPI 변경 시에만(매 프레임 아님) |

**LOD·스킵(렌더 자율, 로직 영향 0 — tech §6.3):**
- `document.hidden` → 전체 스킵(§7.3).
- 저사양 감지(연속 프레임 dt가 임계 초과 N회) → density 동적 하향(파티클 수↓) 또는 헤이즈 타일 반복↓. 로직 불변(파티클 수 = 표현 파라미터).
- (차기) FPS가 지속 미달이면 단계적 LOD. 이 슬라이스는 상한이 낮아 거의 불필요.

**측정 방법:**
- dev 전용 FPS HUD: rAF delta의 EMA를 화면 모서리에 표시(`import.meta.env.DEV`). 활성 파티클 수도 표시.
- Chrome DevTools Performance: 20초 녹화 → Frames 레인에서 60fps 유지·long task 없음·GC(Major/Minor) 스파이크 0 확인.
- Memory: 수 분 구동 후 heap snapshot 비교(누수 0 — 풀 크기 일정).
- L1·L6 각각 측정(L1이 파티클 더 많아 최악).

---

## 9. 파일 구조 — 신규/변경

### 9.1 신규 파일 (`src/render/` 아래)

| 파일 | 책임 |
|---|---|
| `src/render/CanvasRenderer.ts` | `Renderer` 계약 구현체. 두 캔버스 context 소유, `draw()`에서 헤이즈·파티클·글로우 합성. `onLayerChange(slug)`로 config 교체·색 캐시 갱신. `dispose()` 정리. `setSnapshot()`·`setReducedMotion()` 주입 API |
| `src/render/glow.ts` | 글로우 radialGradient 구성·dec→반경 매핑·맥동·lerp 추격(순수 함수 + 작은 상태). 캔버스 context를 받아 그림 |
| `src/render/particles.ts` | 객체 풀·Particle 타입·스폰/업데이트/소멸·형태별 draw. 브라운/간섭아크 패턴 |
| `src/render/haze.ts` | 오프스크린 value-noise 타일 사전계산 + 드리프트 타일링 draw |
| `src/render/layer-visuals.ts` | 층 slug별 `LayerVisual` 데이터 테이블(mol·prn 실값, 나머지 스텁). **데이터 주도** |
| `src/render/color.ts` | getComputedStyle 색 읽기 캐시 + hex↔rgba + mix(블렌딩) 헬퍼 |
| `src/ui/stores/reduced-motion.ts` | `$reducedMotion` readable store(matchMedia). DESIGN §846 예고분 |

(파일 분해는 구현 재량 — `glow/particles/haze`를 CanvasRenderer 내부 모듈로 합쳐도 됨. 핵심은 layer-visuals 데이터 분리.)

### 9.2 변경 파일 (최소 침습)

| 파일 | 변경 | 침습도 |
|---|---|---|
| `src/App.svelte` | (1) `onMount`에서 배경 canvas·글로우 canvas 생성·`CanvasRenderer` 인스턴스화·자체 rAF 루프 시작. (2) 기존 `subscribe` 콜백에서 `renderer.setSnapshot(s)` 추가 호출. (3) `$reducedMotion` 구독→`renderer.setReducedMotion`. (4) 층 변화 감지(`$: if slug 바뀜 → renderer.onLayerChange(slug)`). (5) `.r-core`를 `canvasReady`면 숨김. (6) `<canvas class="bg-fx">` 마크업 + `.gauge` 내 글로우 canvas. (7) `onDestroy`에서 `renderer.dispose()`·rAF 취소 | 중 — 표현 레이어만. 로직 0 |
| `src/game.ts` | **`snapshot()`에 number 파생 2개 추가**(렌더러가 Decimal 안 만지게): `rateCPositive: boolean`(rateC>0, 맥동 조건)·`rateCLog10: number`(속도 매핑). `GameSnapshot` 인터페이스에 필드 추가. **로직·기존 필드 불변**. (B 채택이므로 render 콜백 와이어링은 **안 건드림** — `()=>this.notify()` 그대로) | 소 — 읽기전용 파생 추가만 |
| `src/render/index.ts` | `CanvasRenderer` re-export 추가(계약 `Renderer`는 유지) | 소 |

**game.ts render 콜백(289~295행)은 (B)에서 변경하지 않는다** — 이게 (B)의 핵심 이점(Game 무오염). snapshot에 파생 number 2개만 더한다.

---

## 10. 검증 계획

dev 서버 `localhost:5174` 가동 중 전제. 착수 후:

1. **L1 스크린샷**: 분자층(초기 상태). 글로우 코어+falloff가 보이는지, 황록 헤이즈 드리프트, 브라운 파티클. baseline(`station2-baseline-L1.png`)과 before/after 비교. → visual-qa로 넘김.
2. **L6 스크린샷**: dev에서 `window.game` 또는 강제 `onLayerChange('prn')`로 prn 렌더 전환 → 심자주 간섭 아크. **L1 황록 ↔ L6 심자주 온도 대비**가 한눈에 드러나는지(art §453 핵심). 두 샷 나란히.
3. **FPS 측정**: dev FPS HUD로 L1·L6 각각 60fps 확인. Chrome Performance 20초 녹화 → 60fps·long task 0·GC 스파이크 0 캡처.
4. **reduced-motion**: OS/DevTools rendering 탭에서 `prefers-reduced-motion: reduce` 강제 → 파티클 정지·맥동 제거·드리프트 정지 확인.
5. **백그라운드**: 탭 전환 후 복귀 → 파티클 점프 없음·CPU 0(백그라운드 중) 확인.
6. **콘솔 에러 0**: 부팅~층 전환~리사이즈~DPI 변경 무에러.
7. **세이브/로직 무영향 증명**: 렌더 도입 전후로 `window.game.advance(N)` 결정성 동일·세이브 round-trip 동일·snapshot 수치 동일(렌더는 상태 안 건드림 — tech §6.3). game.ts 변경이 읽기전용 파생뿐임을 코드 리뷰로 확인.
8. **DPI**: devicePixelRatio 1·2에서 글로우·파티클 선명도(블러 없음) 확인.

---

## 11. 기존 설계와의 충돌·정합 메모

- **충돌 없음(정합)**: 렌더 기술(Canvas2D)·풀링·읽기전용·데이터 주도·tokens 재사용은 art §7·tech §6.3과 일치. art §3-A가 "Canvas2D radialGradient vs WebGL 협의"를 남겼고 본 계획이 **Canvas2D로 확정**(근거 §1).
- **glow 반경 매핑**: App.svelte의 `Math.min(14, 3+dec*0.42)`를 토큰값(3/14)과 정합되게 렌더러로 이관. 기존 공식 유지(밸런스 영향 0).
- **L6 배경 무늬**: art §2-3는 L6 위상 간섭 배경을 명시하나 이 슬라이스는 **파티클만**(art §453이 "L1+L6 파티클"을 지정, 배경은 L1만). 충돌 아님 — 범위 분할. 배경 무늬는 차기.
- **alpha 보간**: GameLoop는 alpha를 제공하나 (B)+앰비언트 특성상 이 슬라이스는 미사용(§2.3). 계약 `draw(alpha)`는 유지. 향후 게이지 위치 보간 필요 시 재논의.
- **reduced-motion 스토어**: tokens.css §251·DESIGN §846이 예고한 `$reducedMotion`을 본 슬라이스가 신설(예고의 이행 — 충돌 아님).

---

## 열린 질문 / 리뷰어가 봐줄 지점

1. **[와이어링 A/B] — tech-architect 핵심 결정.** (B) App 소유·rAF 2개·Game 무오염 vs (A) GameLoop 단일 rAF·Game이 Renderer 참조. 본 계획은 **platform 격리 우선으로 (B)** 권장. rAF 1개 절약(A)이 그 결합을 정당화하는가? 특히 데스크톱(Tauri)/테스트 관점에서.
2. **[글로우 DOM 대체] — art-director.** `.r-core` 16px DOM 점을 캔버스 글로우로 **대체**(권장) vs 캔버스를 DOM 뒤/위에 겹쳐 보강. 대체 시 JS 비활성 폴백(점진적 향상)을 어디까지 보장?
3. **[배경 캔버스 z-스택] — ux-designer·art-director.** 배경 캔버스를 `<main>` 뒤(z-1)로 두고 main 콘텐츠 박스(카드·체인) 사이로 헤이즈가 비치게 할지, 아니면 main 배경을 transparent로 하고 캔버스가 base+haze 전담할지. 카드 가독성(art §1-A "빛이 정보, 배경은 침묵") 영향.
4. **[layer-visuals 위치] — tech-architect.** `src/render/layer-visuals.ts`(표현 분리) vs `src/data/`(수치 일원화). 표현 파라미터는 로직 수치와 성격이 달라 render 분리를 권장하나, "수치는 data/" 원칙과의 절충.
5. **[헤이즈 드리프트 ∝ rateC] — art-director.** 헤이즈 드리프트를 생산률에 비례시킬지(art §5-C 모션∝C) vs 고정 저속(파티클이 rateC 담당). 과하면 산만.
6. **[L6 검증 강제 경로] — 메인.** L6는 상전이로만 진입 → dev에서 `onLayerChange('prn')` 강제 렌더 전환으로 온도 대비를 조기 검증하는 임시 훅이 필요. 프로덕션 빌드에서 제거되는 dev-only 경로로 둘지.
7. **[색맹 변경 반영 트리거] — 미정.** getComputedStyle 색 캐시를 `[data-colorblind]` 변경 시 어떻게 재읽기할지(MutationObserver vs 설정 변경 명시 호출). 이 슬라이스에 색맹 토글 UI는 없으나 구조는 대비.
8. **[value noise vs Perlin] — art-director.** L1 헤이즈를 value noise+블러로 근사(권장, 코드 경량) vs 정식 Perlin. art §2-3가 "방향 스펙"이라 근사 허용으로 읽었는데 질감 차이가 마케팅에 유의미한지.
9. **[WebGL 승격 트리거] — tech-architect.** 차기 L9 거품/L11 픽셀 붕괴가 2D로 60fps 미달이 프로파일로 드러나면 그 층만 WebGL 분리 — 이 분기 전략이 수용 가능한지(레이어 두 종류 공존).

---

# §v0.2 — 리뷰 반영 개정 (확정·우선) {#v0-2}

> 근거: `design/review-render-tech.md`(APPROVE-WITH-CHANGES) + `design/review-render-art.md`(REVISE). 아키텍처(Canvas2D·(B)격리·풀링·데이터주도·getComputedStyle·$reducedMotion·백그라운드)는 **양 리뷰 만장일치 "지킬 것" — 불변.** 아래는 must-fix 7 + MINOR 반영. **충돌 시 이 섹션이 v0.1 본문보다 우선.**

## V2-1. 게이지 = 본체 + 글로우 (art BLOCKER 1·2) — §3 전면 대체

이 슬라이스 제목이 "r 게이지 글로우 역설"인데 v0.1은 **글로우만** 그렸다(게이지 본체 누락). 게이지 캔버스는 **3요소**(ux.md §2-A, DESIGN game-ui.gauge)를 그린다. **착수 전 `design/ux.md` §2-A + `design/DESIGN.md` game-ui.gauge 블록을 직접 읽고 토큰값 확정.**

**(a) 동심원 4개 (구조)** — `concentric-count:4`, `concentric-opacity:[0.15,0.12,0.10,0.08]`(DESIGN game-ui.gauge). 바깥 원부터 dec 진행에 따라 순차 페이드아웃 → 깊어질수록 안쪽 원만 남음(art §3-A "남은 원이 줄어든다"). 반경 = 게이지 프레임 등간격(예 0.9/0.7/0.5/0.3 × R_frame). 색 = `--foreground-dim` 또는 층 악센트 저알파, `source-over`. **줄어드는 동심원이 역설의 나머지 절반.**

**(b) 외곽 dec 진행 링** — `outer-ring-thickness:4px`. 호 길이 = 층 내 진행 비율(dec 소수부 또는 층 decadeRange 내 위치)에 비례, 12시 시작 시계방향. 색 = 층 악센트. "층 안에서 얼마나 압축했나".

**(c) 중심 글로우 — 코어/헤일로 2매핑 분리** (v0.1 단일 매핑 폐기):
- **코어(sharp·날카로움)**: `createRadialGradient(cx,cy,0,...,coreR)`. `coreR = clamp(3 + dec·k, 3, 14)`px (토큰 GLOW_MIN/MAX 3/14, art §3-A "3→8→14"). 4s 맥동은 **코어 반경·알파에만**.
- **헤일로(fill·채움)**: 별도 gradient. **`haloR = R_frame × haloRatio(dec)`** — 게이지 프레임 비례(고정 +24px 가산 **폐기**). `haloRatio`: dec0 ≈0.2 → dec_max ≈0.95(프레임 거의 채움). 이게 art §6-B "글로우가 게이지를 거의 채움" + "작아질수록 강해짐" 역설. 넓은 헤일로엔 맥동 미적용(또는 진폭 0.03, art §5-A).
- **R_frame = 파라미터(상수 아님)**: 기본 게이지 박스 + GIF 모드(다른 UI 최소화·중앙 확대, art §6-B)에서 키우면 헤일로 비례 확장.

## V2-2. 글로우 합성 층별 분기 (art MAJOR 3)

`globalCompositeOperation`을 **층 온도로 분기** — layer-visuals에 `glowBlend:'add'|'normal'` 필드(데이터 주도):
- **따뜻색(L1 mol·L2 atom·L3 nuc)** → `'add'`(`lighter`). 인광 그린 등 채택 룩(art §1-A).
- **차가운 단색(L6 prn·L7 str·L8 lp·L9 fm·L10 inf·L11 plk)** → `'normal'`(`source-over`) + 낮은 알파 + 작고 날카로운 코어. ★art §1-A가 명시 거부한 "보라 글로우 네온" 차단, art §2-1 "어둡고 날카로운 광점"·§2-2 "차갑고 날카로운 단색" 구현. L6 헤일로는 채도↓(심자주를 회색 방향)·코어 반경 더 작게.
- 이번 슬라이스: mol=`'add'`, prn=`'normal'`. (L4 탈색~L5 전환 구간은 차기 config 판단.)

## V2-3. L6 최소 차가운 배경 (art MAJOR 4)

L6를 base 딥다크만 두면 온도 대비가 "헤이즈 유/무" 비대칭 → §453 검증 반쪽. 헤이즈와 **동급 비용**으로 L6에 차가운 처리 1개: 심자주(`--layer-prn-accent`) 극저알파(0.02~0.03) 미세 비네팅 **또는** 매우 느린 마디선 1~2개(위상 간섭 암시). 풀 위상간섭 배경은 차기. layer-visuals prn `bg` 항목으로 데이터화.

## V2-4. 와이어링 = subscribe 콜백 내 draw (tech MAJOR M1) — §2.1·§2.2·§9.2 대체

"App 자체 rAF 신설" **폐기**. **기존 App `subscribe(s => …)` 콜백 안에서** `renderer.setSnapshot(s); renderer.draw();` 연달아 호출. 근거: `subscribe`는 `notify()`(=GameLoop render 콜백, rAF마다)로 이미 프레임당 1회 구동 → **snapshot 단일 소스·draw 시점=snapshot 시점(tearing 0)·rAF 1개·dispose 표면 축소·Game 무오염(platform 격리 유지)**. 파티클·헤이즈·맥동은 렌더러 내부 `performance.now()` delta 자체 적분. `src/render/index.ts:19` 계약 주석 → "표현 레이어에서 호출(호출자 무관·읽기전용)"로 갱신. (alpha 보간 실제 필요 시 App rAF 승격 옵션 보존.)

## V2-5. "GC 0" 예산 재정의 (tech MAJOR M2) — §8

"앱 GC 0"은 거짓(snapshot()이 렌더 도입 전부터 매 프레임 수십 객체 할당). → **"렌더 레이어는 프레임당 추가 힙 할당 0(파티클·gradient·타일 사전할당/재사용). snapshot 기존 할당은 본 슬라이스 범위 밖."** §8 측정 = "렌더 on/off GC 빈도·크기 **증가분 0**". gradient는 dec 변화 시에만 재생성(또는 프레임당 ≤2 허용 — 측정).

## V2-6. visibility 스킵 정리 (tech MAJOR M3) — §7.3

V2-4(subscribe-콜백-draw)에선 명시적 `document.hidden` 스킵·`visibilitychange` 재개 **불필요**(GameLoop 백그라운드 스로틀이 draw도 자동 정지) → §7.3에서 삭제. **렌더러 내부 파티클 dt 클램프(`dt=min(realDt,0.1)`)만 유지**(복귀 점프 방지). 오프라인 흡수는 GameLoop+overflow 전담·렌더는 시간 보정 불관여 — §7.3 명문화.

## V2-7. MINOR/NIT 반영

- **읽기전용 규율(tech M4)**: 렌더러는 snapshot에서 `dec`(number)·`rateCLog10`(number)·`rateCPositive`(bool)·`layer.slug`(string)만 읽음. live `discovered`(Set)·Decimal(C/rateC/r/mult) **직접 접근 금지**. §10 검증에 grep 추가 — 렌더러 코드에 `snap.discovered`·`.add(`·`snap.C`·`.mul(` 부재 확인.
- **rateCLog10 LOD(tech M5)**: `rateCPositive ? rateC.log10().toNumber() : 0`. log10 1회/프레임 — 측정 후 초과 시 everySecond/N프레임 갱신으로 강등(파티클 속도는 초 단위 충분).
- **DPI/리사이즈(tech M6)**: 게이지 캔버스 width/height≤0(탭 전환·display:none)면 draw 스킵·백버퍼 재할당 안 함(NaN 반경 throw 방지). 헤이즈 타일=dpr 비의존(저주파라 흐려도 무방), 글로우=dpr 변경 시 백버퍼 재할당. dispose에 `matchMedia(resolution)` 리스너 추가.
- **헤이즈(art M5)**: 알파 0.04~0.08 + **토로이달 wrap 필수 + 최소 2옥타브**(이음매·격자 비침 방지). 안 보이면 알파 대신 저주파 명암 대비↑(카드 가독성 보호). 드리프트 고정 저속 — **rateC 비례 폐기**(파티클이 rateC 신호 담당, art §5-C·§10-5).
- **맥동(art M6)**: 4s 맥동은 코어에만(넓은 헤일로 제외 또는 진폭 0.03). 화면 전체 펄럭임 방지(art §5-A).
- **`.r-core` 폴백(tech M8·art NIT7)**: 16px 점 유지 + 캔버스 컨텍스트 획득 성공 시 `opacity:0`(0-size 앵커 금지). 폴백 의미 = "no-JS"가 아니라 "`getContext('2d')` 실패".
- **L6 dev 검증 훅(tech M7)**: 강제 `onLayerChange('prn')`는 **색 온도 대비만** 조기 검증(위상 기반 운동/재생성은 실제 L6 도달 후) — 한계 명시. dev-only 경로(프로덕션 제거).

## V2-8. game.ts snapshot 파생 추가 (확정·읽기전용)

`snapshot()`에 파생 2개만 추가(로직·기존 필드·세이브·결정성 **불변**): `rateCPositive:boolean`(=`rateC.gt(0)`), `rateCLog10:number`(=`rateCPositive ? rateC.log10().toNumber() : 0`). `GameSnapshot` 인터페이스에 필드 추가. **render 콜백(`()=>this.notify()`)·tick·세이브 직렬화 무변경.**

## 열린 질문 처리 (§10 → 리뷰 답변으로 종결)

- §10-1 와이어링 → **(B)+subscribe-draw**(tech Q1). §10-4 layer-visuals 위치 → **`src/render/layer-visuals.ts`**(render 분리, tech Q4). §10-9 WebGL → **YAGNI, `Renderer` 계약·config 기술중립 유지**(tech Q9).
- §10-2 글로우 DOM 대체 → **대체(게이지 본체 포함 조건)**(art). §10-3 z-스택 → **main 딥다크 솔리드 유지 + 캔버스 z-1, 헤이즈는 카드 뒤·여백에서만**(art). §10-5 헤이즈 드리프트∝rateC → **기각·고정 저속**(art). §10-8 value noise → **승인(토로이달 wrap + 2옥타브 조건)**(art).
- §10-6 L6 강제 진입 dev 훅 → dev-only 경로로 채택(V2-7).
- §10-7 색맹 변경 트리거 → 이 슬라이스 색맹 토글 UI 없음. getComputedStyle 캐시를 `onLayerChange` 시 재읽기로 충분(차기 토글 추가 시 명시 호출).

## 착수 게이트 — 리뷰 반영 매트릭스

| 리뷰 발견 | 반영 위치 | 상태 |
|---|---|---|
| art BLOCKER1 (14px 글로우) | V2-1(c) 코어/헤일로 2매핑·프레임 비례 | ✅ |
| art BLOCKER2 (게이지 본체 누락) | V2-1(a)(b) 동심원4+외곽링 | ✅ |
| art MAJOR3 (가산 글로우=네온) | V2-2 glowBlend 층별 분기 | ✅ |
| art MAJOR4 (L6 배경 비대칭) | V2-3 L6 최소 차가운 배경 | ✅ |
| tech M1 (와이어링 이중 snapshot) | V2-4 subscribe-draw | ✅ |
| tech M2 (GC 0 거짓) | V2-5 예산 재정의 | ✅ |
| tech M3 (visibility 종속) | V2-6 스킵 정리 | ✅ |
| tech M4·M5·M6·M7·M8 / art M5·M6·NIT7 | V2-7 | ✅ |

**지킬 것(불변)**: Canvas2D / (B) App 소유·격리 / 객체 풀 GC 0 / 데이터주도 `render/layer-visuals.ts` / getComputedStyle 색 단일화 / `$reducedMotion` 스토어 신설(`src/ui/stores/reduced-motion.ts`, DESIGN §846 이행) / 백그라운드 스킵(V2-6대로 정리).
