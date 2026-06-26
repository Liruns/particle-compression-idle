# 비주얼 정밀 감사 + 개선안 (visual-overhaul-plan.md v1.0)

- 작성: art-director (타이포·아이콘·색·대비·폴리시 레인)
- 기준 픽셀: `station2-fresh-L1-mol.png`(L1 분자, 실제 헤이즈/파티클 有), `station2-after-L1.png`(L2 원자, 헤이즈/파티클 無), `station2-baseline-L1.png`(L1), `station2-force-prn.png`(렌더만 prn, DOM은 atom)
- 코드: `src/App.svelte`, `src/ui/{ChainTable,LayerCard,CodexView,ResonanceWidget,...}.svelte`, `src/ui/tokens.css`, `src/main.ts`, `index.html`, `src/render/layer-visuals.ts`
- 의도 문서: `design/art-direction.md`, `design/DESIGN.md`
- 메커니즘 불변. 표현(타이포·아이콘·색·대비·폴리시)만 다룬다.
- 레인 분리: 레이아웃·IA·반응형 = ux-designer / 렌더 구현 = graphics-programmer / **타이포·아이콘·색·대비 토큰 = 이 문서**.

---

## 0. 한 줄 진단

**의도 문서(art-direction.md / DESIGN.md)는 훌륭하다. 문제는 "토큰을 만들어 놓고 실제 화면에서 위계로 쓰지 않은 것"이다.** 폰트는 로드됐지만 본문이 전부 한 크기(13px)·한 웨이트(400)로 평평하다. 아이콘은 7종 서로 다른 출처의 유니코드 글리프라 베이스라인·두께·메타포가 다 따로 논다. 그리고 owner가 실제로 보고 화낸 화면(L2 원자층)은 **배경 fx가 코드상 `null`이라 죽은 검은 보이드 위에 박스만 떠 있다.** "계측기 미학"이라는 컨셉이 픽셀에 0% 도달했다.

---

## 1. 비판적 감사 (스크린샷 근거)

### 1-A. 가장 치명적 — "L2는 디자인이 구현 안 된 빈 껍데기다"

`station2-after-L1.png`(원자층)을 보면: 헤더 아래 전부 **순수 검정 보이드**. 게이지 동심원도 거의 안 보이고, 카드 3장이 허공에 떠 있다. owner가 "디자인이 존나 구리다"고 한 바로 그 화면이다.

근거(`src/render/layer-visuals.ts:133`):
```
atom: { haze: null, particles: null, glowBlend: 'add', bg: null }
```
L1(mol)만 haze+particles 실값이고 **atom/nuc/ncl/qrk/str/lp/fm/inf/plk 9층 전부 스텁(전부 null)**. 즉 게임 시간의 대부분을 보내는 원자층 이후가 전부 빈 배경이다. art-direction §2-3은 각 층에 고유 질감을 약속했지만 픽셀엔 없다.

→ 이건 타이포/아이콘 이전에 **"빈 화면" 문제**다. owner 불만의 절반은 여기서 온다. (구현은 graphics-programmer 레인이지만, "최소 앰비언트 폴백" 방향은 이 문서 §4에서 지정한다.)

### 1-B. 타이포그래피 — 위계가 없다 (전부 13px/400)

DESIGN.md는 8단 타입스케일(`num-xl 20` … `narr-sm 11`)을 정의했다. 그런데 실제 렌더된 화면에서 **수치·라벨·내러티브가 거의 다 13px, weight 400으로 보인다.** 위계가 시각적으로 죽었다.

구체 결함:
1. **자원 행이 평평하다** (`station2-after-L1.png` C/E/D 행). `.res-val`=13px(num-md)/400, `.res-name`=11px(label-sm), 아이콘=13px. 값(62652.98)과 이름(압축 깊이 C)의 크기 차가 2px뿐 → **무엇이 주인공인지 안 보인다.** "62652.98"은 이 게임의 핵심 수치인데 ChainTable 셀값과 같은 13px다. 계측기라면 측정값이 압도적으로 커야 한다.
2. **r 값이 안 크다.** r value = `num-lg(16px)`. r은 이 게임의 주인공 수치("작아질수록 강해진다")인데 16px라 자원값·dec와 위계가 안 선다. art §6-B 후킹 샷이 "숫자와 빛이 말한다"고 했는데 숫자가 안 크다.
3. **mono/sans 혼용이 무의미하게 섞였다.** 헤더 `Micro Idle`은 num-xl(20px/500) — 토큰상 numeric(mono)인데 H1에 mono를 쓰면 로고가 코드처럼 보인다(스크린샷에서 'Micro Idle'이 어정쩡). 반대로 `layer-tag`(원자층 · dec 1.05)는 narrative(mono) — 적절. 규칙이 "수치=mono"인데 **로고·섹션 타이틀에까지 mono가 새어든 곳 vs 안 새어든 곳이 일관 없다.**
4. **숫자에 tabular-nums 미적용.** `index.html`엔 base font-feature-settings 없음. JetBrains/Plex Mono는 기본 monospaced지만, 자원값이 1~2초마다 갱신되며 자리가 출렁이는지 보장이 없다(방치형은 가만히 둬도 수치가 도는 화면 — 흔들리면 싸구려로 보인다). `font-feature-settings: "tnum" 1` 강제 필요.
5. **`index.html`에 base 타이포 설정이 전무.** `<body>`에 font-family·line-height·-webkit-font-smoothing 없음. `h1`도 main 안에서만 스타일. OS/브라우저 기본 폰트가 Korean 글리프에 새어들 여지. → 전역 base 레이어 필요.
6. **Korean(라벨)과 Latin(수치)의 시각 크기 불균형.** label은 Inter/IBM Plex Sans인데 한글은 시스템 fallback(Inter엔 한글 없음)으로 빠진다. 스크린샷의 한글("압축 깊이", "오비탈 공명")은 Inter가 아니라 OS 기본 한글 폰트로 렌더 중 → **라벨 한글이 디자인 의도(산세리프 계측 라벨)와 다른 폰트.** 이게 "폰트 쓰는 느낌이 별로"의 직접 원인 중 하나다. 한글 웹폰트(Pretendard/IBM Plex Sans KR 등) 미지정 = 치명적 누락.

### 1-C. 아이코노그래피 — 7종 글리프 동물원

자원/탭/액션 아이콘이 **출처가 다 다른 유니코드 글리프**다. `App.svelte`·`OfflineModal`·`ResearchView`·`ChainTable`·`CodexView`에서 확인:

| 용도 | 글리프 | 유니코드 블록 | 문제 |
|---|---|---|---|
| 압축 깊이 C | `◎` U+25CE | Geometric Shapes | 폰트마다 굵기·여백 제각각 |
| 에너지 E | `⚡` U+26A1 | Misc Symbols | **이모지 폴백 위험** — 컬러 이모지로 렌더되면 팔레트 박살(스크린샷의 ⚡가 그 징후) |
| 데이터 D | `▣` U+25A3 | Geometric Shapes | ◎와 메타포 무관(왜 사각? 왜 원?) |
| QF | `◆` U+25C6 | Geometric Shapes | 다이아 — 의미 임의 |
| 배율 | `×` U+00D7 | Latin-1 | 곱셈기호를 "아이콘"으로 — 헤더 폭만큼만 차지 |
| 최적 티어 | `▶` U+25B6 | 컬러 이모지 폴백 위험 |
| 상전이 탭 | `●` U+25CF | 그냥 점 |

핵심 문제 5가지:
1. **베이스라인·옵티컬 사이즈가 다 다르다.** `◎`(원, 중앙)·`▣`(사각, 베이스라인 근처)·`⚡`(키 큰 이모지)가 한 행에 13px로 놓이면 수직 정렬이 미세하게 다 어긋난다. `.res-icon{text-align:center}`만 있고 line-height·옵티컬 정렬 보정 없음.
2. **이모지 폴백.** `⚡`·`▶`는 OS(Win11 Segoe UI Emoji)에서 **풀컬러 이모지**로 빠질 수 있다. 스크린샷의 노란 ⚡가 정확히 그것 — 팔레트 토큰(`--energy #f5c842`)을 무시하고 OS 이모지 색으로 칠해진다. 계측기 미학에 컬러 이모지는 즉사.
3. **메타포 0.** ◎=깊이? ▣=데이터? ◆=거품? 임의 매핑이라 학습이 안 되고, 무엇보다 **"실험 기기"로 안 읽힌다.** 계측기/검출기엔 게이지·파형·격자·결정 같은 도상 언어가 있는데 기하 글리프엔 없다.
4. **두께(stroke weight)가 폰트 의존**이라 통제 불가. 아이콘 시스템의 기본은 일정한 stroke. 유니코드는 폰트 메이커가 정한 두께라 우리 손을 떠난다.
5. **DESIGN.md `layer-icons`(⬡◎⬤△▲≈~…)도 같은 문제를 11층으로 확장 예약.** 지금 고치지 않으면 부채가 11배가 된다.

### 1-D. 대비·여백·카드 처리

1. **카드 변별력 약함.** `.res`·`.chain`·`.layer-card` 전부 `bg:--canvas-layer(#0e1418)` + `border:1px --border(#1e2c38)`. 검정 배경(#080b0e)과 카드(#0e1418)의 명도차가 너무 작아(거의 1단계) **카드 경계가 테두리에만 의존.** L2 보이드 배경에선 카드가 "떠 있다"기보다 "선으로 그린 칸"처럼 보인다. surface 단계가 안 쓰여 깊이가 없다.
2. **여백 리듬이 균질.** `main{gap:--space-lg(24px)}`로 모든 섹션이 같은 간격. 게이지(주인공)와 자원/체인(보조) 사이에 위계적 여백 차이가 없어 **"중요도 지도"가 안 그려진다.**
3. **헤더가 약하다.** `Micro Idle`(20px) + layer-tag(11px). 스크린샷에서 헤더가 본문보다 안 무겁다. 계측기라면 상단에 "측정 컨텍스트(층·dec·스케일)"가 또렷한 상태바여야 하는데 지금은 그냥 가운데 정렬 제목.
4. **`station2-after-L1.png` 체인 테이블**: T1~T8 행 높이/패딩이 좁고(`td padding 4px 8px`), 잠금 행(opacity 0.25)이 너무 흐려 "여기 뭔가 있다"는 기대조차 안 생긴다. 잠금=정보 0이 아니라 "예고"여야 한다.

### 1-E. 헤이즈 가시성

art-direction §2-3은 L1 헤이즈 alpha `0.04~0.06`. 코드(`layer-visuals.ts:97`)는 `[0.04, 0.08]`. owner 진단은 "avgA≈8.2/255"(≈0.032 평균). `station2-fresh-L1-mol.png`(L1)에선 상단/여백에 황록 기운이 **아주 약하게** 보이긴 한다 — 하지만 카드 뒤는 `--canvas-layer` 솔리드라 가려지고, 화면 중앙은 게이지뿐이라 헤이즈가 닿는 면적 자체가 적다. 결과적으로 "거의 안 보임"이 맞다. 그리고 **L2부터는 haze=null이라 아예 0.** 가시성 튜닝 이전에 "존재 자체"가 없는 게 더 큰 문제.

---

## 2. 타이포그래피 시스템 수정

목표: **"측정값은 압도적으로 크고 mono, 라벨은 작고 차분한 sans, 내러티브는 mono로 기록처럼"** — 위계가 한눈에 보이게.

### 2-A. 즉시: 전역 base 레이어 + 한글 폰트 (P0)

현재 `index.html`엔 base 타이포가 없다. `tokens.css`에 전역 base를 추가한다.

**(1) 한글 폰트 추가** — 가장 큰 체감 개선. 라벨/한글 본문이 OS fallback으로 빠지는 걸 막는다.
- 권장: **Pretendard** (모던 한글 산세리프, 계측 라벨에 적합, Inter와 메트릭 유사) 또는 **IBM Plex Sans KR**(Plex 패밀리 정합성 ↑).
- mono 한글은 사실상 선택지가 적음 → 내러티브 한글은 산세리프 KR로 두고 **Latin/숫자만 mono**가 현실적(혼식 조판). 단 "수치는 항상 mono"는 숫자가 Latin이므로 그대로 지켜짐.
- `@fontsource/pretendard` 또는 self-host. main.ts에 import 추가.

**(2) tokens.css에 base 추가:**
```css
:root {
  /* 폰트 패밀리에 한글 fallback 명시 */
  --font-numeric:   'JetBrains Mono', 'IBM Plex Mono', 'Pretendard', monospace;
  --font-label:     'Inter', 'Pretendard', 'IBM Plex Sans', sans-serif;
  --font-narrative: 'IBM Plex Mono', 'JetBrains Mono', 'Pretendard', monospace;
}
:global(html) {
  font-feature-settings: "tnum" 1, "lnum" 1;   /* 자릿수 고정 — 방치 갱신 시 출렁임 0 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
:global(body) {
  font-family: var(--font-label);
  line-height: 1.4;
  color: var(--foreground);
}
```
→ `font-feature-settings: "tnum"`는 모든 수치 갱신의 자리 흔들림을 잡는 **싸구려감 제거의 핵심 한 줄**.

### 2-B. 타입스케일 재조정 (위계를 벌린다) (P0)

현 `tokens.css` `--text-*`를 다음으로 교체. **변경 핵심: 측정 주인공(r, 자원값)을 키우고, 라벨을 더 낮춰 대비를 만든다.**

| 토큰 | 현재 | → 신규 | weight | 용도 | 근거 |
|---|---|---|---|---|---|
| `--text-num-display` | (신설) | **34px** | 500 | r 값(게이지 주인공) | r이 압도해야 후킹 샷이 산다 |
| `--text-num-xl` | 20px | **24px** | 500 | 자원 현재값(C/E), 헤더 수치 | 값이 라벨보다 확실히 큼 |
| `--text-num-lg` | 16px | 16px | 400 | dec 보조 수치, QF/D 값 | 유지 |
| `--text-num-md` | 13px | 13px | 400 | 생산율·비용·체인 셀 | 유지(보조는 작게) |
| `--text-label-lg` | 15px | 15px | 500 | 입자 이름·섹션 타이틀 | 유지 |
| `--text-label-md` | 13px | 13px | 500→**500** | 버튼·탭(현 400) | 탭/버튼은 살짝 굵게 |
| `--text-label-sm` | 11px | 11px | 400 | 자원 이름·뱃지·헤더 라벨 | 유지(라벨은 작게) |
| `--text-label-xs` | (신설) | **10px** | 500 | overline/유닛 캡션(tracking 0.08em 대문자류) | 계측 라벨 톤 |
| `--text-narr-md` | 12px | 12px | 400 | 내러티브 비트·플레이버 | 유지 |
| `--text-narr-sm` | 11px | 11px | 400 | 고정 문구 | 유지 |

추가 규칙:
- **로고 `h1 "Micro Idle"`는 numeric(mono)에서 빼고 label(sans) 500 + letter-spacing 0.06em**으로. 로고가 코드처럼 안 보이게. (또는 별도 `--font-display`로 분리. 간단히는 label 패밀리 재사용.)
- **자원 값은 `num-xl(24/500)`, 자원 이름은 `label-sm(11/400, --foreground-sub)`** → 값:이름 = 24:11. 지금 13:11에서 위계가 2배 이상 벌어진다.
- **r 값은 `num-display(34/500)`.** "반경 r" 라벨은 `label-xs(10, 대문자감)`. → r이 화면에서 가장 큰 수치가 된다.

### 2-C. "계측기/과학 문서" 느낌을 실제로 내는 규칙 (P1)

토큰만으로는 안 되고 **조판 규칙**이 톤을 만든다:
1. **유닛/메타 라벨은 overline 스타일.** "반경 r", "dec", "메커니즘", "T#" 같은 라벨은 `label-xs` + `letter-spacing 0.08em` + `--foreground-sub`. 대문자 강제는 한글에 안 통하므로 **자간+소형+저채도**로 "계기판 캡션" 느낌을 낸다.
2. **수치는 우정렬·고정폭.** 자원값·체인값은 `text-align:right` + `tnum`. 이미 일부 right지만 자원값(`.res-val`)도 우정렬 격자에 고정.
3. **구분선은 1px hairline `--border`**, 단 카드 내부 섹션 구분은 `--border` 50% 알파로 더 얇게(계측 패널의 미세 격자감).
4. **단위는 값과 분리·저채도.** "8.912×10⁻¹¹ **m**"의 m, "+440.68**/s**"의 /s를 `--foreground-sub` `label-xs`로 묶어 값 본체와 분리 → 데이터시트처럼 읽힘.
5. **숫자 포맷의 과학표기 위첨자**(현 `formatRadius`의 `×10⁻¹¹`)는 유지하되, 지수부를 `--foreground-sub`로 살짝 낮춰 가수부(8.912)가 주인공이 되게.

---

## 3. 아이콘 시스템 (핵심)

### 3-A. 방향 한 줄

**유니코드 글리프 7종을 폐기하고, 24×24 그리드·1.75px 균일 stroke·라운드 조인의 "계측기 라인 아이콘" 세트(인라인 SVG 컴포넌트)로 교체한다. `currentColor` 상속으로 팔레트 토큰이 그대로 색을 지배한다.**

### 3-B. 구현 방식 — 인라인 SVG 컴포넌트 (아이콘 폰트 아님)

선택: **인라인 SVG Svelte 컴포넌트** (`<Icon name="energy" />`). 아이콘 폰트 대비 장점:
- `stroke="currentColor"` → 자원 토큰(`--energy` 등)이 색을 100% 통제. **이모지 폴백 영구 제거.**
- 픽셀 스내핑·옵티컬 정렬을 viewBox로 통제 → 베이스라인 동물원 종결.
- 트리셰이킹·번들 작음(7~12개 패스). 외부 의존 0(오프라인 게임 정합).
- aria 통제 쉬움.

구조 제안:
```
src/ui/icons/
  Icon.svelte          # <svg viewBox=0 0 24 24 ... ><slot/></svg> 래퍼 (size·stroke·aria)
  paths.ts             # name → path d (또는 개별 .svelte)
```
`Icon.svelte` 골격:
```svelte
<script lang="ts">
  export let name: string;
  export let size = 16;
  export let label = '';            // 있으면 img+aria-label, 없으면 aria-hidden
  import { ICON_PATHS } from './paths';
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.75"
     stroke-linecap="round" stroke-linejoin="round"
     role={label ? 'img' : undefined} aria-label={label || undefined}
     aria-hidden={label ? undefined : true}>
  {@html ICON_PATHS[name]}
</svg>
```
색은 부모가 지정: `<span class="res-icon" style="color:var(--energy)"><Icon name="energy"/></span>` — 기존 `.res-energy .res-icon{color:--energy}` 패턴 그대로 작동.

### 3-C. 아이콘 세트 — 과학적 메타포 (1차: 자원·액션·탭 12개)

상투("⚡=번개")를 버리고 **실제 측정/물리 도상**으로:

| 키 | 용도 | 메타포(계측기 언어) | 형태 스펙 |
|---|---|---|---|
| `depth` (C) | 압축 깊이 | **아래로 수렴하는 깊이 눈금** — 위→아래로 좁아지는 3선 + 하강 화살촉 | 동심 수렴, ◎ 대체 |
| `energy` (E) | 압축 에너지 | **포텐셜 우물** — U자 곡선 + 바닥 점(에너지 최저) 또는 다이어그램형 번개(직선 2절 폴리라인, 이모지 아님) | 직선 stroke만, 컬러 이모지 불가 |
| `data` (D) | 발견 데이터 | **샘플 점이 찍힌 산점도 격자** — 2×2 미세 격자 + 점 1 | ▣ 대체, "데이터=측정점" |
| `qf` (QF) | 양자 거품 | **요동 결정(결맞음 격자)** — 작은 육각/마름모 + 내부 점(진공 요동) | ◆ 대체, 거품=요동 |
| `mult` (×) | 생산 배율 | **곱셈 게이지** — 작은 ×를 원이 감싼(증폭 다이얼) | × 단독 대신 다이얼 |
| `best` | 최적 티어 | **타깃 캐럿** — 가는 ▷ 또는 조준 캐럿 | ▶(이모지) 제거 |
| `phase` | 상전이 탭 | **상태 전이 노드** — 점 + 발산 링 1 (위상 점등) | ● 제거, 펄스는 CSS |
| `compress` | 압축 액션 | **수렴 화살(안쪽으로)** — 양쪽에서 중심으로 ▸◂ | 버튼 보조 아이콘(선택) |
| `codex` | 도감 탭 | **카드 격자** — 2×3 미세 카드 | 탭 텍스트 보조 |
| `research` | 연구 탭 | **노드 트리** — 점 3 연결선 | 탭 텍스트 보조 |
| `save` | 저장 | **디스크/스냅샷 프레임** — 모서리 마커 4 | 텍스트 보조 |
| `lock` | 잠금 티어 | **가는 자물쇠 윤곽** | "잠금" 텍스트 보조 |

원칙:
- **전부 stroke-only, fill 금지** (계측 라인워크 톤 통일). 채움이 필요한 점은 작은 원 stroke로.
- **24 그리드에서 16/2px 마진**, 시각 무게 균등화(원형은 살짝 크게, 사각은 살짝 작게 — 옵티컬 보정).
- **stroke-width 1.75 고정.** 작은 사이즈(14px)에서도 1.75 유지(스케일 시 자동 가늘어짐 방지를 위해 `vector-effect:non-scaling-stroke` 옵션).

### 3-D. 층 아이콘(11층) — 2차 (P2)

DESIGN.md `layer-icons`(⬡◎⬤△▲≈~∥▪) 역시 같은 세트로 SVG화. 각 층의 **물리 도상**(분자=육각결합, 원자=오비탈 껍질, 핵=밀집 핵, 쿼크=점근선, 프리온=간섭마디, 끈=사인, 루프=스핀격자, 거품=요동버블, 정보=홀로격자, 플랑크=픽셀)을 16px 라인 글리프로. 도감 사이드·층 카드·탭에 재사용. **지금 1차 세트 컴포넌트 구조를 잡아두면 11층 확장은 path 추가만으로 끝난다.**

### 3-E. 접근성

- 의미 없는 장식 아이콘(자원 행처럼 텍스트 라벨이 옆에 있음): `aria-hidden="true"`.
- 단독 의미 아이콘(있다면): `role="img" aria-label="..."`.
- 색 단독 의존 금지(이미 DESIGN.md 이중 인코딩 원칙) — 아이콘은 형태로도 구분되므로 색맹 모드와 정합.

---

## 4. 비주얼 폴리시

### 4-A. 헤이즈 가시성 — 알파보다 "면적과 대비" (graphics-programmer 협의)

문제는 알파 수치가 아니라 **닿는 면적이 작고(중앙 게이지뿐) L2+엔 아예 없음**.
1. **모든 층에 최소 앰비언트 폴백을 켠다.** `layer-visuals.ts`의 atom~plk 스텁에 **최소 vignette bg**라도 즉시 부여(파티클·풀 헤이즈는 차기, 하지만 "검은 보이드"는 지금 끝낸다). 예: 각 층 `bg: { kind:'vignette', colorToken:'--layer-{slug}-accent', alpha: 0.02~0.03 }`. prn이 이미 vignette 0.025로 검증됨 → 그 패턴을 9층에 복제.
2. **헤이즈 가시성은 알파 상향(0.08→0.10)보다 "저주파 대비"로.** 평탄한 0.03이 아니라 octave를 살려 명암 폭(min 0.02, peak 0.10)을 키우면 평균 알파는 그대로여도 "보인다"는 체감이 산다. art §2-3 방향과 일치.
3. **헤이즈를 게이지 주변에 집중.** 화면 중앙(게이지 뒤)에 radial 가중 → 주인공 주변이 살아있게. 카드 뒤는 어차피 `--canvas-layer`가 가리므로 가독성은 보호됨.
4. 단, **카드 가독성 보호선 유지**: 헤이즈는 `z-index:-1`로 카드 뒤·여백에서만(현 구조 OK). 수치 위로 절대 안 올라옴.

### 4-B. 카드/대비/깊이 (P1)

1. **surface 단계를 실제로 쓴다.** 카드 배경을 `--canvas-layer(#0e1418)`로 두되, **내부 값 영역**(자원값·체인 헤더)에 `--surface(#141c23)` 미세 차등 또는 `--canvas-layer`+1px inset 하이라이트(top: `rgba(255,255,255,0.03)`)로 "패널 위 디스플레이" 깊이를. 한 단계 명도차를 추가해 박스가 "떠 보이게".
2. **카드 left-accent 통일.** `LayerCard`·`ResonanceWidget`은 `border-left:2px --layer-accent`로 층색 띠가 있는데 `.res`·`.chain`엔 없음. **자원/체인 카드에도 옅은 좌측 띠(1px, accent 40%)** 또는 상단 hairline accent로 "현재 층 컨텍스트"를 카드마다 미세 반복 → 화면 통일성·층 정체성 강화(필러 ④).
3. **잠금 행을 0.25→0.4**로 올리고 비용/티어는 보이되 "구매" 버튼만 흐리게. 잠금=예고(기대감). 너무 흐리면 "죽은 칸".

### 4-C. 여백 위계 (P1, ux-designer와 경계 — 값만 제안)

- 게이지 섹션 위아래 여백을 `--space-xl(32)`로 키워 주인공을 고립·강조. 자원/체인 등 보조 묶음은 내부 `--space-sm(8)`로 촘촘히 → "주인공은 숨 쉬고, 데이터는 밀집"의 계측 리듬. (배치는 ux 레인이므로 **간격 토큰 값 제안만**, 적용 위치는 ux와 협의.)

### 4-D. 헤더를 "측정 상태바"로 (P1)

`Micro Idle`(로고) + `층·dec`만 있는 현 헤더를, **층·dec·스케일(m)·생산율을 담은 얇은 상태 스트립**으로. 계측 장비의 상단 상태바 톤. (정보 배치는 ux 레인 — 이 문서는 "톤·타이포"만: 로고는 label 500, 상태값은 mono num-md, 라벨은 label-xs 저채도.)

---

## 5. 우선순위 실행목록

### P0 — 즉시 (체감 최대, 위험 최소, 대부분 토큰/CSS)

- [ ] **P0-1 한글 폰트 추가** — Pretendard(또는 IBM Plex Sans KR) self-host import(`main.ts`) + `--font-*` fallback에 추가(`tokens.css`/`DESIGN.md`). *라벨 한글이 디자인 폰트로 렌더되는 즉각 변화.* (graphics/programmer 협조: 패키지 설치)
- [ ] **P0-2 전역 base 레이어** — `tokens.css`에 `html{font-feature-settings:"tnum" 1; -webkit-font-smoothing} body{font-family:--font-label; line-height:1.4}`. *수치 출렁임 제거 + 폰트 일관.*
- [ ] **P0-3 타입스케일 위계 복원** — `--text-num-display(34)` 신설, `--text-num-xl 20→24`, `--text-label-xs(10)` 신설. 자원값=num-xl/500, r값=num-display, 라벨=label-sm/xs. (`tokens.css` + `App.svelte`/`ChainTable` 클래스 매핑)
- [ ] **P0-4 이모지 폴백 차단(긴급)** — 최소한 `⚡`·`▶`를 stroke SVG로 우선 교체(컬러 이모지 박살 방지). 나머지 글리프는 P1에서 일괄. *팔레트 보호.*
- [ ] **P0-5 "검은 보이드" 응급 폴백** — `layer-visuals.ts` atom~plk 스텁에 vignette bg(accent, 0.02~0.03) 부여(prn 패턴 복제). *owner가 보는 L2 화면이 즉시 "세계"가 됨.* (graphics-programmer 레인 — 방향 본 문서, 구현 협의)

### P1 — 다음 (아이콘 본체 + 폴리시)

- [ ] **P1-1 인라인 SVG 아이콘 시스템 구축** — `src/ui/icons/Icon.svelte` + `paths.ts`. 1차 12키(§3-C). `currentColor` 상속.
- [ ] **P1-2 전 글리프 교체** — `App.svelte`(◎⚡▣◆×)·`OfflineModal`(⚡◎▣)·`ResearchView`(▣)·`ChainTable`(▶)·App 탭(●)을 `<Icon>`로. aria 정리.
- [ ] **P1-3 아이콘 정렬 보정** — 자원 행 아이콘 셀 옵티컬 센터·size 16 통일, line-height 정렬.
- [ ] **P1-4 카드 깊이·통일** — surface 차등/inset 하이라이트, 자원·체인 카드 좌측 accent 띠, 잠금 행 0.4.
- [ ] **P1-5 계측 조판 규칙** — overline 라벨(label-xs 자간), 단위 분리·저채도, 우정렬 격자, 지수부 저채도.
- [ ] **P1-6 헤더 상태바 톤** — 로고 sans 500, 상태값 mono. (배치는 ux 협의)

### P2 — 이후 (확장·완성)

- [ ] **P2-1 11층 아이콘 SVG화** — DESIGN `layer-icons` → 라인 글리프 세트(도감·탭·카드 재사용).
- [ ] **P2-2 층별 헤이즈/파티클 본구현** — atom~plk 풀 비주얼(art §2-3). graphics-programmer 주도, 본 문서 무드 스펙 기준.
- [ ] **P2-3 헤이즈 저주파 대비·radial 가중** — §4-A.
- [ ] **P2-4 도감 카드 등급 비주얼 위계** — art §4-B(reveal wipe·전설 맥동) 정합 점검.

---

## 6. ux-designer / graphics-programmer 경계 (겹침 명시)

| 항목 | 이 문서(art) | ux-designer | graphics-programmer |
|---|---|---|---|
| 타입스케일·웨이트·자간 토큰 | **결정** | 적용 위치(어느 텍스트가 어느 토큰) 협의 | — |
| 한글 폰트 선정 | **결정** | — | 패키지 설치 |
| 아이콘 메타포·스타일·stroke | **결정** | 어느 자리에 놓을지 | 컴포넌트 코드(가능) |
| 색·대비·헤이즈 알파 | **결정** | — | 렌더 구현 |
| 카드 깊이(명도/inset) | **결정(톤)** | 레이아웃·반응형 | — |
| 여백 위계 | 값 **제안** | **결정(배치·IA)** | — |
| 헤더 상태바 | 톤·타이포 | **정보 배치·IA** | — |
| 층별 배경 fx 본구현 | 무드 스펙 | — | **구현** |

---

## 부록 A. 변경 파일 맵 (구현자 참조)

- `src/ui/tokens.css` — `--font-*` fallback(한글), `--text-num-display`/`--text-label-xs` 신설, num-xl 24, html/body base 블록.
- `design/DESIGN.md` — 토큰 원천 동기화(typography.family·scale, base 규칙). *tokens.css와 1:1 유지.*
- `src/main.ts` — 한글 폰트 import 추가.
- `src/ui/icons/{Icon.svelte,paths.ts}` — 신규 아이콘 시스템.
- `src/App.svelte` — `.res-val`/`.r-value` 타입 클래스 매핑, 글리프 5종 → `<Icon>`, 탭 ● → Icon, 카드 깊이 CSS, h1 폰트.
- `src/ui/ChainTable.svelte` — ▶ → Icon, 잠금 행 opacity, 셀 타이포·우정렬.
- `src/ui/OfflineModal.svelte` — ⚡◎▣ → Icon.
- `src/ui/ResearchView.svelte` — ▣ → Icon, 탭 아이콘.
- `src/ui/CodexView.svelte` — 카드 등급 뱃지·타이포 점검(P2).
- `src/render/layer-visuals.ts` — atom~plk vignette 응급 폴백(graphics-programmer 협의).

## 부록 B. 검증 방법

- P0 적용 후 `station2-after-L1.png`(원자층) 재촬영 → "검은 보이드"가 사라지고 자원값이 라벨을 압도하는지 픽셀 확인.
- 자원값 1~2초 갱신 중 자리 흔들림 0 확인(tnum).
- `⚡`가 단색(--energy)으로 렌더되는지(이모지 아님) 확인.
- visual-qa 레인에 회귀 스크린샷 기준 등록.
