# 에셋 파이프라인 문서 (asset-pipeline.md v0.1)

- 작성: graphics-programmer
- 입력: `asset-list.md` v1.0 / `tech-architecture.md` v0.1 §4.4·§6 / `art-direction.md` v0.1 / `audio-design.md` v0.1
- 상태: 계획 문서. 코드 없음. graphics-programmer 구현 기준 문서.
- 작성일: 2026-06-26
- 경계: **무엇을 만드나** = asset-list. **어떻게 관리·최적화·빌드에 넣나** = 이 문서.

---

## 0. 한 줄 요약

> 에셋은 **절차생성 코드(최대)**, **오디오 스트리밍 파일(중간)**, **JSON 데이터(content-pipeline)** 세 범주로 나뉜다. 스프라이트·비트맵 에셋은 원칙적으로 없다. 빌드 크기 90%는 NW.js 런타임이며, 게임 에셋은 수십 MB 이내를 목표로 한다.

---

## 1. 에셋 종류와 포맷 결정

### 1-A. 비주얼: 무엇이 에셋이고 무엇이 코드 생성인가

art-direction "계측기 미학(Instrument Aesthetic)"은 절차적 글로우·노이즈·파형을 미학의 핵심으로 삼는다. 결론: **비주얼의 대부분은 런타임 절차생성이며 파일 에셋이 아니다.**

#### 절차생성 (파일 없음, 코드로 구현)

| 항목 | 구현 방식 | 근거 |
|---|---|---|
| 층별 배경 질감 11종 (VA-01~VA-11) | Canvas2D / WebGL 런타임 렌더 | Perlin noise, 동심원 패턴, 간섭 무늬 등은 파라미터화된 수식 — 파일로 저장하면 해상도 종속적이고 파라미터 튜닝이 불가능 |
| r 게이지 글로우 (VU-01) | Canvas2D `radialGradient` 또는 WebGL fragment shader | 게이지 값(Decimal)에서 실시간 파생. 파일로 저장할 대상이 없음 |
| 앰비언트 파티클 11층 × 파티클 로직 (VP-01~VP-11) | Canvas2D 오브젝트 풀 | 각 파티클은 위치·속도·수명 파라미터로 정의 — 스프라이트 불필요 |
| 인터랙티브 파티클 (VP-12~VP-13) | 동상 | 동상 |
| 스케일 전환 VFX (VX-01~VX-08) | Canvas2D overlay + CSS transition | 플래시·링·페이드는 코드 |
| UI 애니메이션 (scale, shake, fade, float text) | CSS animation / Svelte transition | Svelte 컴파일 단계에서 처리 |
| 도감 카드 reveal wipe (VC-05) | CSS `clip-path` animation | 파일 불필요 |
| 전설 카드 맥동 테두리 (VC-04) | CSS animation | 동상 |

#### 파일 에셋이 될 수 있는 비주얼

| 항목 | 현재 판단 | 조건 |
|---|---|---|
| 폰트 파일 (JetBrains Mono, IBM Plex Mono, Inter) | **파일 필요** | `.woff2` 포맷. 라이선스 확인(OFL — 재배포 가능). 빌드에 포함 |
| 파비콘 / 앱 아이콘 (Steam 스토어, NW.js 윈도우 아이콘) | **파일 필요** | `PNG` 다중 크기. 절차생성 불가 |
| 스토어 GIF·스크린샷 (VM-01~VM-05) | **파일 필요(마케팅 전용)** | 게임 런타임과 무관. 게임 번들에 포함 안 함 |
| Svelte 컴포넌트 내 인라인 SVG 아이콘 | 코드 인라인 권장 | 별도 `.svg` 파일로 관리하되 Vite에서 컴포넌트로 import (`?component` or `?raw`) |

**결론: 비주얼 에셋 파일은 폰트·아이콘·마케팅 이미지 외 없다. 나머지 전부 절차생성.**

---

### 1-B. 오디오: 포맷·압축·루프 전략

audio-design §6-3과 tech-architecture §6.1의 교차점.

#### 앰비언트 루프 (11층 × 스템 2~4개 = 25~35 파일)

| 항목 | 결정 | 근거 |
|---|---|---|
| 코덱 | **OGG Vorbis q6~q8** | 심리스 루프 시 루프 포인트 샘플 정확 지원. MP3는 루프 갭 문제. AAC는 Web Audio API에서 루프 갭 이슈 있음. Vorbis가 방치형 루프의 표준 |
| 샘플레이트 | 48kHz | 웹·Steam 동일 타깃 |
| 비트뎁스 | 납품 24bit → 인코딩 16bit equivalent | 스토리지 vs 품질. 앰비언트는 다이내믹 폭이 작아 16bit로 충분 |
| 루프 구조 | intro stem (4~8s) + loop stem (60~120s) 분리 | audio-design §6-1. 1회차·집중층은 intro 재생 후 loop, 이후 회차는 loop 직행 |
| 스트리밍 여부 | **루프 스트리밍** — 전곡 decode 후 메모리 상주 금지 | tech-architecture §6.1. 수 주 구동 시 앰비언트 풀 메모리 적재 = 누수 위험. AudioContext `createMediaElementSource` + `loop=true` 사용. SFX만 버퍼 풀링 |
| 레이어 수 | 층당 2~4 스템 (베이스 드론 / 텍스처 / 모션 / 액센트) | audio-design §6-1. 런타임 믹스로 적응형 레이어링(§3-2) 구현 |

#### SFX 변주 풀 (v1.0 총 ~100 파일)

| 항목 | 결정 | 근거 |
|---|---|---|
| 코덱 | **OGG Vorbis** (60ms 이하 초단발은 WAV 허용) | 짧은 SFX는 decode 비용이 상대적으로 작음. WAV는 decode-to-buffer로 즉시 재생 |
| 버퍼링 | **decode 후 AudioBuffer 풀링** — 재사용 | 생성·소멸 반복 금지. `AudioBufferSourceNode`는 1회용이므로 버퍼만 풀링하고 노드는 생성 |
| 변주 관리 | 풀당 배열 인덱스 라운드로빈 + ±피치 랜덤 | audio-design §4-1. `playbackRate`로 ±3% 피치 변주 — 파일 복제 없이 변주 |
| Voice cap | 동시 발음 16개 상한 | 초과 시 가장 이른 보이스 gain fade + disconnect |
| 디바운스 | 자동 이벤트 최소 간격 80ms | audio-design §4-2 |

---

### 1-C. 데이터 (JSON): content-pipeline 소관

**이 문서의 범위가 아니다.** 단, 경계를 명확히 한다.

`src/data/` 안의 모든 JSON은 content-designer가 정의하고, economy-designer가 수치를 채우며, game-programmer가 런타임에 로드한다. graphics-programmer는 해당 데이터를 **읽기 전용으로 소비**하며 직접 편집하지 않는다.

- `particles.json` — 입자 도감 87종 (id·layer·rarity·unlock_condition·unlock_bonus_type 등)
- `research.json` — 연구 노드 52개
- `layers.json` — 층 정의·악센트 컬러·파티클 파라미터

`layers.json`의 파티클 파라미터(크기·속도·밀도·소멸 방식)는 graphics-programmer와 content-designer가 공동으로 형식을 정의하되, **수치 결정권은 art-direction 기반 graphics-programmer, 레이어 구조 결정권은 tech-architect**. 실제 수치 튜닝은 구현 후 visual-qa와 협의한다.

---

## 2. 폴더 구조와 네이밍 컨벤션

tech-architecture §4.4 `src/` 구조에 에셋 경로를 매핑한다.

```
C:\game\
  src/
    render/                   # graphics-programmer 영역 (tech-arch §4.4)
      particles/
        ParticlePool.ts       # 오브젝트 풀 (추후 구현)
        LayerParticles.ts     # 층별 파티클 로직
      background/
        LayerBackground.ts    # 층별 배경 질감 렌더러
      vfx/
        TransitionVFX.ts      # 층 전환·상전이 VFX
        BigCrunchVFX.ts       # 빅 크런치 시퀀스
      gauge/
        RadiusGauge.ts        # r 게이지 글로우
      audio/
        AudioEngine.ts        # Web Audio 래퍼·믹서
        SfxPool.ts            # SFX 변주 풀·라운드로빈
        AmbientPlayer.ts      # 스템 크로스페이드·스트리밍
    data/                     # content-pipeline 소관 (읽기 전용)
      particles.json
      research.json
      layers.json
  assets/                     # 실제 파일 에셋 (바이너리·미디어)
    fonts/
      JetBrainsMono-Regular.woff2
      JetBrainsMono-Bold.woff2
      IBMPlexMono-Regular.woff2
      IBMPlexSans-Regular.woff2
      Inter-Regular.woff2
      Inter-Medium.woff2
    audio/
      ambient/
        l01_molecular/
          l01_intro.ogg
          l01_base_drone.ogg
          l01_texture.ogg
          l01_motion.ogg
          l01_accent.ogg        # 레이어 수는 층별로 2~4개
        l02_atomic/
          l02_intro.ogg
          l02_base.ogg
          l02_texture.ogg
          l02_motion.ogg
        ...
        l06_preon/
          l06_intro.ogg
          l06_base.ogg
          l06_texture.ogg
        ...
        l11_planck/
          l11_intro.ogg
          l11_base.ogg
          l11_apex.ogg
      sfx/
        click/
          sfx_click_01.ogg
          sfx_click_02.ogg
          ...
          sfx_click_12.ogg
        buy/
          sfx_buy_t1_a.ogg
          sfx_buy_t1_b.ogg
          ...
          sfx_buy_t8_b.ogg
          sfx_buy_unlock_a.ogg  # 최초 해금 웜업 라이즈
          sfx_buy_unlock_b.ogg
          sfx_buy_unlock_c.ogg
          sfx_buy_unlock_d.ogg
        discover/
          sfx_discover_known_01.ogg ... sfx_discover_known_04.ogg
          sfx_discover_hypo_01.ogg  ... sfx_discover_hypo_04.ogg
          sfx_discover_unknown_01.ogg ... sfx_discover_unknown_04.ogg
          sfx_discover_legendary_01.ogg ... sfx_discover_legendary_03.ogg
        phase/
          sfx_phase_preon_a.ogg
          sfx_phase_preon_b.ogg
          sfx_phase_string_a.ogg
          sfx_phase_string_b.ogg
          sfx_phase_loop_a.ogg
          sfx_phase_loop_b.ogg
          sfx_phase_foam_a.ogg
          sfx_phase_foam_b.ogg
          sfx_phase_info_a.ogg
          sfx_phase_info_b.ogg
          sfx_phase_planck_a.ogg
          sfx_phase_planck_b.ogg
        bigcrunch/
          sfx_bc_planck_sinedown.ogg
          sfx_bc_qf_impact.ogg
          sfx_bc_runstart_a.ogg   # 1회차 풀버전
          sfx_bc_runstart_b.ogg   # 2회차 단축판
          sfx_bc_runstart_c.ogg   # 3회차+ 최소판
        misc/
          sfx_buy_blocked_01.ogg ... sfx_buy_blocked_04.ogg
          sfx_gauge_full_01.ogg  ... sfx_gauge_full_04.ogg
          sfx_fluctuation_up_01.ogg ... sfx_fluctuation_up_03.ogg
          sfx_fluctuation_dn_01.ogg ... sfx_fluctuation_dn_03.ogg
          sfx_research_buy_01.ogg ... sfx_research_buy_04.ogg
          sfx_offline_return_a.ogg
          sfx_offline_return_b.ogg
        l2_resonance/
          sfx_resonance_01.ogg ... sfx_resonance_06.ogg
    icons/
      app-icon-16.png
      app-icon-32.png
      app-icon-128.png
      app-icon-256.png
      favicon.ico
  assets-source/              # 소스 에셋 (빌드 산출 아님, .gitignore 제외 선택)
    fonts-src/                # 원본 TTF/OTF (woff2 변환 전)
    audio-src/                # 원본 고음질 WAV/AIFF + 프로젝트 파일 (DAW .als/.logicx)
    icons-src/                # 원본 고해상도 PNG/SVG
    licenses/                 # 구매 에셋 라이선스 원문 파일 (§6)
  design/
    asset-pipeline.md         # 이 문서
    asset-list.md
    ...
  marketing/                  # 게임 번들 외부 — 스토어 GIF·스크린샷 (VM-01~VM-05)
    gifs/
    screenshots/
    trailer/
```

### 네이밍 컨벤션 규칙

| 패턴 | 형식 | 예 |
|---|---|---|
| 앰비언트 파일 | `l{NN}_{role}.ogg` | `l01_base_drone.ogg`, `l06_intro.ogg` |
| SFX 변주 | `sfx_{event}_{variant}.ogg` | `sfx_click_07.ogg`, `sfx_buy_t3_b.ogg` |
| 분류별 발견음 | `sfx_discover_{tier}_{NN}.ogg` | `sfx_discover_legendary_01.ogg` |
| 상전이 | `sfx_phase_{layername}_{ab}.ogg` | `sfx_phase_preon_a.ogg` |
| 폰트 | `{FamilyName}-{Weight}.woff2` | `JetBrainsMono-Bold.woff2` |
| 아이콘 | `app-icon-{size}.png` | `app-icon-256.png` |

**소문자·하이픈(kebab-case) 고정.** 공백·대문자·특수문자 금지(NW.js fs 경로 일관성).

---

## 3. 소스 에셋 vs 빌드 산출 에셋 분리

| 디렉터리 | 역할 | Git 관리 | 빌드 포함 |
|---|---|---|---|
| `assets-source/` | 원본 고음질 파일, DAW 프로젝트, 원본 이미지. 작업 소스. | 선택적 (LFS 권장, 파일 크기 주의) | **아니오** — 배포판에 들어가지 않음 |
| `assets/` | 빌드 최적화된 실제 사용 파일. Vite가 처리하는 대상. | 예 (최적화된 바이너리) | **예** |
| `src/data/` | JSON 데이터. 소스이자 산출물. | 예 | **예** (Vite가 번들·해시 처리) |
| `marketing/` | 스토어 GIF·스크린샷. 게임 런타임과 무관. | 선택적 | **아니오** |

### 소스→산출 변환 워크플로 (수동, 빌드 자동화 대상 아님)

```
audio-src/*.wav (48kHz 24bit)
  → ffmpeg -i input.wav -c:a libvorbis -q:a 7 output.ogg
  → assets/audio/...

fonts-src/*.ttf
  → pyftsubset / fonttools woff2 변환
  → assets/fonts/*.woff2

icons-src/app-icon-1024.png
  → imagemagick resize 16/32/128/256
  → assets/icons/*.png
```

변환 스크립트는 `scripts/convert-assets.sh` (또는 PowerShell 동급)로 문서화한다. Vite 빌드 프로세스에 통합하지 않는다 — 에셋 변환은 드문 이벤트이므로 수동 실행으로 충분하다.

---

## 4. 최적화

### 4-A. "텍스처 아틀라스" — 해당 없음

이 프로젝트에는 스프라이트 시트·텍스처 아틀라스가 필요하지 않다. 비주얼 에셋이 절차생성이기 때문이다. Canvas2D는 드로우콜 최적화보다 오브젝트 풀링과 재계산 최소화가 우선이다.

Canvas2D `offscreenCanvas`는 활용한다:
- 층별 배경 질감: 변화 없을 때 offscreenCanvas에 캐시 → 매 프레임 `drawImage`로 복사(재계산 없음)
- Perlin noise 배경: 새 층 진입 시 한 번 생성 → offscreenCanvas에 저장 → 드리프트는 translate만 적용

### 4-B. 오디오 압축·스트리밍

| 최적화 항목 | 방법 | 목표 |
|---|---|---|
| 앰비언트 용량 | OGG q6 (앰비언트 다이내믹 폭 작음) | 60s 스테레오 스템 1개 ≈ 1.5~3MB → 25~35개 총 ≈ 50~80MB |
| SFX 용량 | OGG q5~q6, 모노 | 100개 평균 ~100ms → 총 ≈ 5~10MB |
| 스트리밍 | `<audio>` element + `createMediaElementSource` | 앰비언트 파일을 전부 메모리에 decode하지 않음 |
| 스트리밍 단점 | seek 정확도 낮음, 루프 갭 가능 | 루프 포인트에서 2번째 `<audio>` 요소를 준비해두는 "ping-pong" 방식으로 갭 방지 |
| SFX 버퍼 | decode 후 `AudioBuffer` 재사용 | `decodeAudioData` 1회 → 풀에 보관. 노드는 매 재생마다 생성(`createBufferSource`)·연결·즉시 disconnect |
| 지연 로딩 | 현재 층·다음 층만 앰비언트 pre-load | 11층 전체를 동시에 스트림하지 않음. 층 진입 직전(상전이 5초 전) 다음 층 앰비언트 사전 로드 |

### 4-C. 번들 크기 (Vite 에셋 처리)

Vite 기본 설정:
- `assets/` 내 파일: `vite.config.ts`에서 `publicDir: 'assets'`로 지정 → 해시 없이 그대로 복사
- `src/data/*.json`: Vite가 import 시 번들에 포함·트리쉐이킹

**폰트 최적화:**
- `pyftsubset`으로 실제 사용 글리프만 포함 (과학 표기에 사용되는 문자 집합 + 한글 자주 쓰는 조합). 전체 폰트는 3~5MB → 서브셋 후 300~800KB
- 단, 한글 입자 이름이 전체 범위를 쓴다면 서브셋 효과 제한적 — 실제 사용 후 판단

**음원 지연 로딩:**
- SFX는 앱 시작 시 전부 `fetch` + `decodeAudioData` → 완료 후 "준비됨" 플래그
- 앰비언트는 층별 진입 시 스트리밍 시작 (앱 시작 시 전부 로드 금지)
- L1 분자층 앰비언트만 앱 시작 시 사전 로드 (첫 화면)

### 4-D. 층별 에셋 지연 로딩 전략

| 시점 | 로드 대상 |
|---|---|
| 앱 최초 시작 | L1 앰비언트 (base_drone + texture), 모든 SFX 버퍼 풀 |
| L1 진입 완료 후 | L2 앰비언트 사전 페치 시작 (백그라운드) |
| Lk 진입 시 | L(k+1) 앰비언트 사전 페치, L(k-1) 앰비언트 메모리 해제 (스트리밍이므로 audio element 일시정지·src 해제) |
| 상전이 가능(QF 충족) | 해당 미지 서브층 앰비언트 사전 페치 |

---

## 5. 빌드 통합

### 5-A. Vite 에셋 처리

tech-architecture §5.3 빌드 파이프라인과 정합.

```
# vite.config.ts 핵심 설정 (방향, 실제 구현은 game-programmer)
{
  publicDir: 'assets',           // assets/ → dist/ 그대로 복사 (해시 없음)
  build: {
    assetsDir: 'static',
    rollupOptions: {
      // JSON 데이터: 번들에 포함 (용량 작음)
      // 오디오: publicDir을 통해 dist/audio/... 로 복사
    }
  }
}
```

**해시 전략:**
- 폰트 + 소규모 에셋: Vite 기본 해시(`[hash]` suffix) — 캐시 무효화 자동
- 오디오 파일: `publicDir`로 처리 — 해시 없음, 경로 고정. 업데이트 시 파일명에 버전 suffix 수동 부여 (`l01_base_drone_v2.ogg`) 후 코드 참조 변경. 이는 오디오 파일이 드물게 바뀌는 에셋이기 때문이다.

### 5-B. NW.js 패키지 포함 방식

tech-architecture §5.3 패키징 구조 기반.

```
[Vite build 산출] dist/
  index.html
  static/           (JS·CSS 번들, 해시됨)
  fonts/            (폰트 파일)
  audio/            (앰비언트 스템·SFX)
  icons/            (앱 아이콘 제외, 런타임 사용 아이콘)

[NW.js 패키지] package.nw/
  ├── dist/         (위 Vite 산출물 전체)
  ├── package.json  (NW.js 진입점 설정)
  └── node_modules/ (steamworks.js 등 Node 모듈)

[설치 패키지]
  nwjs-sdk/        (NW.js 런타임 ~150MB)
  game.exe         (NW.js 실행파일)
```

**오디오 파일 경로 주의:** NW.js 환경에서 `fetch('audio/...')` 는 `file://` 프로토콜 기반으로 동작한다. `new URL('./audio/ambient/l01_molecular/l01_base_drone.ogg', import.meta.url)` 패턴을 사용하여 빌드 타깃에 무관한 경로 해석을 보장한다.

### 5-C. 개발 환경 핫 리로드

Vite HMR은 JS/CSS에만 동작한다. 오디오·폰트 변경 시:
1. `assets/audio/` 파일 교체
2. 브라우저 강제 새로고침 (Ctrl+Shift+R)
3. `AudioEngine.ts`가 SFX를 앱 시작 시 일괄 decode하므로 새로고침 없이는 새 파일이 반영 안 됨 — 개발 시 단일 파일 핫스왑 헬퍼(`reloadSfx(key)`)를 개발 모드에서만 노출

---

## 6. 데이터 주도 콘텐츠와 렌더 에셋의 경계

tech-architecture §4.4 `data/` 분리 원칙을 에셋 관점에서 명확히 한다.

### 6-A. content-pipeline 소관 (`src/data/`)

| 항목 | 파일 | 수정 주체 |
|---|---|---|
| 입자 정의 87종 | `particles.json` | content-designer, economy-designer |
| 연구 노드 52종 | `research.json` | content-designer, economy-designer |
| 층 정의 (이름·악센트 컬러·벽 조건) | `layers.json` | content-designer (악센트 컬러는 art-direction §2-1에서 확정됨) |
| 층별 파티클 파라미터 | `layers.json` 내 `particles` 블록 | **형식: graphics-programmer** / **수치: graphics-programmer + art-direction 협의** |

`layers.json` 파티클 블록 예시 (형식 방향):
```json
{
  "id": "l01_molecular",
  "accentColor": "#8bc34a",
  "particles": {
    "ambient": {
      "shape": "circle",
      "sizeMin": 3,
      "sizeMax": 6,
      "densityTarget": 40,
      "speedMin": 0.1,
      "speedMax": 0.5,
      "motion": "brownian",
      "fadeOut": "opacity"
    }
  }
}
```

이 파라미터 스키마를 graphics-programmer가 정의하고, art-direction과 visual-qa 검증 후 수치를 확정한다.

### 6-B. 렌더 에셋 소관 (`assets/`, `src/render/`)

| 항목 | 위치 | 수정 주체 |
|---|---|---|
| 오디오 파일 | `assets/audio/` | audio-designer (제작), graphics-programmer (로드·재생 코드) |
| 폰트 파일 | `assets/fonts/` | graphics-programmer (서브셋·통합) |
| 앱 아이콘 | `assets/icons/` | art-director (디자인), graphics-programmer (다중 크기 처리) |
| 렌더 로직 | `src/render/` | graphics-programmer 전담 |

### 6-C. 경계 위반 패턴 (금지)

- graphics-programmer가 `src/data/*.json`의 경제 수치·입자 정의를 직접 수정 → **금지**. 렌더 파라미터만 수정.
- game-programmer·content-designer가 `src/render/` 렌더 로직을 수정 → **원칙적 금지**. 인터페이스(이벤트 버스 이벤트 타입, 상태 타입)만 공유.
- 렌더 코드가 `Decimal` 원시값으로 산술 연산 → **금지**. tech-architecture §2.2. format 모듈을 통해 문자열로만 받거나, 표시용 `number`(유한 범위)로 변환 후 렌더.

---

## 7. 구매 에셋 관리 (라이선스·출처 트래킹)

asset-list §5 "리스크 상위 5" 중 오디오가 가장 큰 리스크다. DIY + 에셋 구매 혼합 전략에 따라 라이선스를 체계적으로 관리한다.

### 7-A. 에셋 출처 분류

| 분류 | 예 | 관리 방식 |
|---|---|---|
| **자체 제작 (DIY)** | audio-designer가 직접 제작한 앰비언트·SFX | 저작권 귀속 명확. 별도 추적 불필요 |
| **위탁 제작 (commissioned)** | 외주 사운드 디자이너에게 발주 | 계약서에 "전체 권리 양도(work-for-hire)" 또는 "독점 라이선스" 명시 필수 |
| **구매 에셋 (licensed)** | 사운드 팩·폰트·아이콘 구매 | 아래 `ASSET_REGISTRY.md` 항목으로 추적 |
| **오픈소스·공개 도메인** | OFL 폰트, CC0 SFX | 라이선스 원문 보존. OFL은 소스 폰트 포함 의무 확인 |

### 7-B. ASSET_REGISTRY.md 유지 (의무)

`assets-source/licenses/ASSET_REGISTRY.md` 파일을 생성·유지한다. 구매·외주·오픈소스 에셋 하나당 한 행.

```markdown
# 에셋 레지스트리

| 에셋 ID | 파일명 | 출처 | 라이선스 유형 | 구매일 / 만료 | 상업 사용 | 재배포 | 라이선스 원문 |
|---|---|---|---|---|---|---|---|
| F-001 | JetBrainsMono-*.woff2 | JetBrains / GitHub | OFL 1.1 | — | O | O(원문 동봉) | licenses/ofl-jetbrainsmono.txt |
| F-002 | IBMPlexMono-*.woff2 | IBM / GitHub | OFL 1.1 | — | O | O | licenses/ofl-ibmplexmono.txt |
| F-003 | Inter-*.woff2 | Rasmus Andersson | OFL 1.1 | — | O | O | licenses/ofl-inter.txt |
| A-001 | (예: sfx_buy_t1_a.ogg) | (예: 외주 John Doe) | Work-for-hire | 2026-07-01 | O | X | licenses/contract-johndoe.pdf |
```

**필드 설명:**
- `상업 사용`: Steam 판매에 사용 가능 여부
- `재배포`: 게임 번들 포함 시 라이선스 파일 동봉 의무 여부
- 라이선스 원문 파일은 `assets-source/licenses/` 에 저장

### 7-C. OFL 폰트 특이사항

JetBrains Mono / IBM Plex / Inter 모두 OFL(SIL Open Font License) 1.1 하에 배포된다.
- 상업 사용 허용
- 게임 번들에 포함 허용
- **폰트 파일 자체를 단독 판매 금지** (게임과 함께 배포는 허용)
- 라이선스 원문 동봉 의무: `dist/` 에 포함하거나 설정 화면에서 접근 가능하게 만든다

### 7-D. 구매 에셋 온보딩 절차

구매/외주 에셋을 `assets/`에 추가할 때:
1. `ASSET_REGISTRY.md`에 즉시 등록
2. `assets-source/licenses/`에 라이선스 원문 복사
3. 게임 내 크레딧(설정 탭 하단 "크레딧")에 출처 반영 계획 확인
4. Steam 스토어 "제3자 소프트웨어 고지" 섹션 업데이트 필요 여부 판단

---

## 8. 퍼포먼스 예산 (tech-architecture §6.3 준수)

tech-architecture §6는 "graphics-programmer가 구체 수치를 확정"한다고 명시한다. 이 섹션이 그 확정이다.

### 8-A. 60fps 예산 분배 (1프레임 = 16.67ms @ 60fps)

방치형 특성상 실제 연산 부하는 틱(game-programmer)과 렌더(graphics-programmer)가 경쟁한다. tech-architecture §4.1 원칙: render는 tick 결과를 읽기만 한다.

| 예산 항목 | 목표 | 비고 |
|---|---|---|
| 총 프레임 예산 | 16.67ms | 60fps 타깃 |
| tick 연산 (game-programmer) | ≤ 2ms | Decimal 연산 캐시 전제 |
| 파티클 업데이트·렌더 | ≤ 8ms | 동시 파티클 상한에 종속 |
| 배경 질감 렌더 | ≤ 2ms | offscreenCanvas 캐시 전제, 드리프트만 매 프레임 |
| UI / Svelte 리렌더 | ≤ 2ms | everySecond 스케줄러로 억제 |
| 기타 (VFX 전환 중) | ≤ 2ms | 전환 이펙트는 짧은 기간 |
| 헤드룸 | ≥ 0.67ms | 예측 불가 스파이크 흡수 |

### 8-B. 파티클 동시 수 상한

| 층 | 앰비언트 파티클 상한 | 인터랙티브 동시 상한 | 합계 상한 |
|---|---|---|---|
| L1 분자 | 60개 | 12개 (클릭 버스트 × 2) | 72개 |
| L2 원자 | 50개 | 12개 | 62개 |
| L3~L5 | 40개 | 12개 | 52개 |
| L6 프리온 | 30개 | 12개 | 42개 |
| L7~L11 | 20개 | 12개 | 32개 |

층이 깊을수록 파티클이 줄어드는 것은 art-direction(미니멀)과 성능 예산이 자연스럽게 일치한다.

**LOD 단계 (저사양·백그라운드):**

| 단계 | 트리거 | 조치 |
|---|---|---|
| LOD-0 (정상) | 프레임타임 < 14ms | 위 상한 그대로 |
| LOD-1 (경감) | 14ms ≤ 프레임타임 < 20ms | 앰비언트 파티클 50% 감소 |
| LOD-2 (최소) | 프레임타임 ≥ 20ms 또는 백그라운드 탭 | 앰비언트 파티클 90% 감소, 인터랙티브만 유지 |
| 백그라운드 | app.blur 이벤트 | rAF 스로틀(requestAnimationFrame 대신 setTimeout 1fps) + LOD-2 |

tech-architecture §6.4: 백그라운드는 오프라인 경로로 수렴. 렌더는 거의 멈춰도 tick이 정확히 돌아가면 된다.

### 8-C. 메모리 예산

| 항목 | 목표 | 비고 |
|---|---|---|
| SFX AudioBuffer 풀 | ≤ 30MB | ~100파일 × 평균 ~100ms × 48kHz × 2채널 × 4byte → 약 4MB. 여유 크게 있음 |
| 앰비언트 스트리밍 | ≤ 10MB (동시 2층 버퍼) | `<audio>` element 스트리밍. 디코딩은 코덱 레벨에서 처리 |
| offscreenCanvas 캐시 | ≤ 5MB | 층당 1920×1080 RGBA = 8MB. 현재 층만 유지 |
| 파티클 오브젝트 풀 | ≤ 5MB | 오브젝트 재사용. 신규 할당 0 (풀이 준비된 후) |
| **렌더 총계** | **≤ 50MB** | tech-architecture §6.1 "메모리 누수 0"과 함께 수 주 안정 목표 |

---

## 9. 미구현·미결정 항목 (graphics-programmer 후속)

| # | 항목 | 상태 | 담당 |
|---|---|---|---|
| G1 | r 게이지 글로우: Canvas2D `radialGradient` vs WebGL fragment shader 최종 결정 | 미결 | graphics-programmer (성능 프로파일 후 결정) |
| G2 | 층별 배경 캐시 무효화 조건 정의 (C 값 변화 시 Perlin noise 시드 재계산 여부) | 미결 | graphics-programmer + art-director |
| G3 | Web Audio API 래퍼 라이브러리 선정 (Howler.js vs Tone.js vs 직접 구현) | 미결 | graphics-programmer (voice cap·크로스페이드·루프 지원 필수) |
| G4 | 색전하 삼원색 파티클(L4) 삼체 시뮬 성능 실측 | 미실측 | graphics-programmer |
| G5 | `layers.json` 파티클 파라미터 블록 스키마 최종 확정 | 미결 | graphics-programmer + content-designer |
| G6 | 폰트 서브셋 범위 확정 (한글 글리프 포함 범위) | 미결 | graphics-programmer + narrative-designer |
| G7 | 앰비언트 스트리밍 ping-pong 루프 갭 처리 검증 (Web Audio API 브라우저별 차이) | 미검증 | graphics-programmer |
| G8 | NW.js에서 `file://` 경로로 `fetch('audio/...')` 동작 검증 | 미검증 | graphics-programmer + game-programmer |

---

## 10. 관련 문서

- `design/asset-list.md` — 무엇을 몇 개 만드는지 (이 문서의 입력)
- `design/tech-architecture.md` §4.4 (폴더 구조), §6 (성능 예산)
- `design/art-direction.md` §4-A (파티클 방향), §7 (graphics-programmer 협의 항목)
- `design/audio-design.md` §5 (트리거 인터페이스), §6-3 (기술 포맷 스펙)
- `src/render/` — 구현 코드 (미구현)
- `assets-source/licenses/ASSET_REGISTRY.md` — 에셋 레지스트리 (미생성, 에셋 첫 구매 시 생성)
