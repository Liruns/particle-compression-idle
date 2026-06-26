---
# 형식 참조: kwakseongjae/oh-my-design DESIGN.md(웹) → 게임 적응
#
# ============================================================================
# ⚠️ 색상 팔레트 SUPERSEDED — "우주적 현미경" 피벗 (2026-06-26)
# ----------------------------------------------------------------------------
# 아래 `colors`·`layer-palette`·`colorblind-palette`의 **색상 토큰은 피벗되었다.**
# 현 권위: art-direction-cosmic.md §2 (cosmic-direction.md §2-B 요약).
#
# 무엇이 바뀌나:
#  - 단일 브랜드색 `#3ecf8e`(primary/qf/col-glow-core) = 폐기. 이 게임에 하나의
#    브랜드 컬러는 없다 — 층마다 다른 빛이 있을 뿐(art-cosmic §2-A).
#  - 층별 accent(8bc34a/26c6da/7c4dff 등 쨍한 순색) = 전부 탈채도 발광색으로 교체.
#    예) mol 8bc34a → 9fb89a, atom 26c6da → 7fb0b8, prn 7c4dff → 8a7fd0 …
#    11층 색온도 아크(따뜻→차가움→무색)는 art-cosmic §2-C 표가 권위값.
#  - 자원색도 각자 탈채도 발광체: E #d9b86a / C #7a9fc0 / D #9a8fc0 /
#    QF = 현재 층 색을 따라감(고정색 없음). art-cosmic §2-D.
#  - 발광 규칙: 채도 35~70%, 광원에서만(reflective 아님), near-black 공허 +
#    radial vignette. 균일 플랫 다크 배경/네온 box-shadow 금지(art-cosmic §7 F8·F9).
#
# 색맹 보정 팔레트(colorblind-palette)는 새 탈채도 hex 기준으로 재매핑 필요
#   (accessibility §1-C, art-cosmic §11). 아래 구 값은 구 순색 기준이라 무효.
#
# ★ 비색상 토큰(typography scale, spacing, motion, z-index 등)은 유효하되,
#   typography family(JetBrains/Inter/IBM Plex)는 art-cosmic §3-B로 피벗
#   (Public Sans/Atkinson + Spline Sans Mono + Newsreader). §130 family 참조.
#
# 이력 보존을 위해 구 토큰은 삭제하지 않는다. 신규 화면 색은 art-cosmic §2가 권위.
# ============================================================================

tokens:
  colors:
    # ⚠️ 색상 토큰 SUPERSEDED → art-direction-cosmic.md §2 (위 배너). 구 값=비주얼 회귀 before.
    # --- 베이스 시맨틱 ---
    canvas:           "#080b0e"   # 최외곽 배경 (배경 딥)
    canvas-layer:     "#0e1418"   # 패널·카드 기본 (배경 레이어)
    surface:          "#141c23"   # 인풋·버튼 표면
    border:           "#1e2c38"   # 구분선·프레임
    foreground:       "#e8eef3"   # 주요 수치·라벨 (텍스트 강조)
    foreground-sub:   "#7a8f9e"   # 설명·보조 정보 (텍스트 보조)
    foreground-dim:   "#3d5162"   # 미해금·비활성 (텍스트 희미, 접근성 예외 — 비활성 의도적 저대비)

    # --- 자원/기능 시맨틱 색 ---  ⚠️ 단일 #3ecf8e 편재 = 폐기. 자원별 탈채도 발광색 → art-cosmic §2-D
    primary:          "#3ecf8e"   # SUPERSEDED: 단일 브랜드색 폐기 → 층별 발광(art-cosmic §2-C). 구 r코어/QF/강조
    energy:           "#f5c842"   # 압축 에너지 E ⚡
    depth:            "#5b9bd5"   # 압축 깊이 C ◎
    data:             "#9b72cf"   # 발견 데이터 D ▣
    qf:               "#3ecf8e"   # 양자 거품 QF ◆ (primary와 동일, 별칭)
    reset:            "#c0392b"   # 리셋 뱃지·E 부족 경고
    keep:             "#27ae60"   # 보존 뱃지
    partial:          "#e67e22"   # 부분 이월 뱃지
    legendary:        "#f5c842"   # 전설 입자 테두리·플래시 (energy와 동일, 별칭)

    # --- 특수 이벤트 ---
    bigcrunch-flash:  "#ffffff"   # QF 폭발 화이트 플래시·링
    bigcrunch-bg:     "#000000"   # 빅 크런치 PLANCK_HIT / BLACKOUT 배경

    # --- 층별 팔레트 시스템 (11층 — 하단 layer-palette 섹션에 상세) ---
    # layer-{slug}-accent / layer-{slug}-glow / layer-{slug}-bg 패턴

  # --- 층별 팔레트 시스템 (11층) ⭐ ---
  # ⚠️ SUPERSEDED: 아래 쨍한 순색 accent = 전부 탈채도 발광색으로 교체. 색온도 아크(따뜻→차가움→무색)
  #    권위값 = art-direction-cosmic.md §2-C 표. (mol 8bc34a→9fb89a, atom 26c6da→7fb0b8, prn 7c4dff→8a7fd0 …)
  layer-palette:
    # L1 분자층 (Molecular)
    protostar:
      slug:   "mol"
      accent: "#8bc34a"    # 분자 황록
      glow:   "#6ea832"    # 글로우 (accent 10% 어둡게)
      bg:     "#0a0e09"    # 층 배경 (canvas에 황록 1% 틴트)

    # L2 원자층 (Atomic)
    atomic:
      slug:   "atom"
      accent: "#26c6da"    # 오비탈 청록
      glow:   "#1aa8ba"
      bg:     "#090d0e"    # canvas에 청록 1% 틴트

    # L3 핵층 (Nuclear)
    nuclear:
      slug:   "nuc"
      accent: "#ff7043"    # 핵력 주황
      glow:   "#e05a2b"
      bg:     "#0e0a08"    # canvas에 주황 1% 틴트

    # L4 핵자층 (Nucleon) — 삼원색 세트
    nucleon:
      slug:   "ncl"
      accent-r: "#e040fb"  # 색전하 마젠타
      accent-g: "#40c4ff"  # 색전하 청
      accent-b: "#69f0ae"  # 색전하 녹
      glow:   "#b030d0"    # 마젠타 기준 글로우
      bg:     "#0d090e"

    # L5 쿼크층 (Quark)
    quark:
      slug:   "qrk"
      accent: "#f0f4f8"    # 점근 자유 백색
      glow:   "#d8dfe6"
      bg:     "#080b0e"    # 거의 순수 canvas (극미니멀)

    # L6 프리온층 (Preon) — 첫 미지 서브층
    preon:
      slug:   "prn"
      accent: "#7c4dff"    # 위상 심자주
      glow:   "#6030e0"
      bg:     "#09080e"    # canvas에 자주 1% 틴트

    # L7 끈층 (String)
    string:
      slug:   "str"
      accent: "#ff4081"    # 진동 적외
      glow:   "#e02060"
      bg:     "#0e080a"

    # L8 루프층 (Loop)
    loop:
      slug:   "lp"
      accent: "#3d5afe"    # 격자 남색
      glow:   "#2a3fd0"
      bg:     "#08090e"

    # L9 거품층 (Foam)
    foam:
      slug:   "fm"
      accent: "#eceff1"    # 요동 은백
      glow:   "#ccd0d2"
      bg:     "#09090a"    # 거의 canvas (저조도)

    # L10 정보층 (Information)
    info:
      slug:   "inf"
      accent: "#00e5ff"    # 홀로그래픽 청백
      glow:   "#00c0d8"
      bg:     "#08090e"    # canvas에 청백 미세 틴트

    # L11 플랑크층 (Planck)
    planck:
      slug:   "plk"
      accent: "#ffffff"    # 시공간 순백
      glow:   "#e0e0e0"
      bg:     "#070a0d"    # canvas보다 한 단계 더 어둡게

  # --- 색맹 보정 팔레트 대안 (accessibility.md §1-C) ---
  colorblind-palette:
    protanopia:
      mol-accent:  "#c8b400"   # 황록 → 황금
      nuc-accent:  "#e6a800"   # 주황 → 황색
      str-accent:  "#b8b8ff"   # 적핑크 → 연보라
    deuteranopia:
      mol-accent:  "#d4b800"   # 황록 → 황
      ncl-accent-b: "#e0c040"  # 녹 → 황색
      nuc-accent:  "#e89000"   # 주황 → 진황
    tritanopia:
      atom-accent: "#00b377"   # 청록 → 녹 계열
      prn-accent:  "#c0392b"   # 심자주 → 진적
      lp-accent:   "#8e44ad"   # 남색 → 보라
      inf-accent:  "#16a085"   # 청백 → 청록

  typography:
    # ⚠️ family SUPERSEDED → art-cosmic §3-B (안전한 삼종 = AI 중앙값 신호). scale/spacing은 유효.
    family:
      numeric:   "'JetBrains Mono', 'IBM Plex Mono', monospace"   # SUPERSEDED → 'Spline Sans Mono'(art-cosmic §3-B)
      label:     "'Inter', 'IBM Plex Sans', sans-serif"             # SUPERSEDED → 'Public Sans'/'Atkinson Hyperlegible'
      narrative: "'IBM Plex Mono', 'JetBrains Mono', monospace"    # SUPERSEDED → 'Newsreader'/'Source Serif 4'(세리프)

    scale:
      # 수치 (numeric family 사용)
      num-xl:
        size: "20px"
        weight: "500"
        lineHeight: "1.2"
        tracking: "0"
        use: "r 값 대형 표시, 층 헤더 수치"
      num-lg:
        size: "16px"
        weight: "400"
        lineHeight: "1.3"
        tracking: "0"
        use: "자원 현재값 (E/C/D/QF)"
      num-md:
        size: "13px"
        weight: "400"
        lineHeight: "1.4"
        tracking: "0"
        use: "생산율, 비용, 보조 수치"

      # 레이블 (label family 사용)
      label-lg:
        size: "15px"
        weight: "500"
        lineHeight: "1.4"
        tracking: "0.01em"
        use: "입자 이름 (도감 카드 제목)"
      label-md:
        size: "13px"
        weight: "400"
        lineHeight: "1.4"
        tracking: "0.01em"
        use: "버튼 텍스트, 탭 라벨"
      label-sm:
        size: "11px"
        weight: "400"
        lineHeight: "1.5"
        tracking: "0.02em"
        use: "도감 뱃지 텍스트, 툴팁, 보조 라벨"

      # 내러티브 (narrative family 사용)
      narr-md:
        size: "12px"
        weight: "400"
        lineHeight: "1.6"
        tracking: "0.01em"
        use: "층 진입 비트, 시그니처 로그, 상전이 메시지"
      narr-sm:
        size: "11px"
        weight: "400"
        lineHeight: "1.5"
        tracking: "0.02em"
        use: "'더 작은 것이 있다.' 고정 문구 (opacity 0.45)"

    principles:
      - "수치는 항상 numeric(mono). 자리 이동 없이 읽힌다."
      - "내러티브도 mono. 연구 로그처럼. 게임이 아니라 기록처럼."
      - "대문자·이탤릭·장식 폰트 없음."
      - "과학 표기 강제: 1.616×10⁻³⁵ 형식. 원시 float 금지."
      - "층 이름 두 언어 병기: 프리온층 — Preon."

  spacing:
    xs:      "4px"
    sm:      "8px"
    base:    "12px"
    md:      "16px"
    lg:      "24px"
    xl:      "32px"
    xxl:     "48px"
    panel:   "160px"     # LEFT PANEL 최소폭
    panel-r: "180px"     # RIGHT PANEL 최소폭
    center-min: "300px"  # CENTER 최소폭

  rounded:
    sm:   "2px"    # 뱃지, 소형 버튼
    md:   "4px"    # 카드, 게이지 프레임
    lg:   "8px"    # 모달, 위젯 컨테이너
    full: "9999px" # 원형(공명 슬롯, 파티클)

  # --- shadow → glow (빛이 곧 정보, art-direction §1) ---
  glow:
    core:
      radius-min: "3px"
      radius-mid: "8px"
      radius-max: "14px"
      color: "var(--col-glow-core)"        # #3ecf8e
      transition: "200ms ease-out"
      use: "r 게이지 중심 글로우 — r 감소 시 반경 확대"

    layer-ambient:
      radius: "24px"
      opacity: "0.12"
      use: "층 악센트 컬러의 앰비언트 헤이즈. canvas 위 미세 광량."

    card-legendary:
      radius: "6px"
      color: "var(--legendary)"            # #f5c842
      pulse: "2s ease-in-out infinite"
      use: "전설 입자 카드 맥동 테두리 글로우"

    card-unknown:
      radius: "4px"
      color: "var(--layer-accent)"          # 현재 층 악센트 컬러
      use: "미지 입자 카드 발광 테두리"

    focus-ring:
      style: "2px solid var(--layer-accent)"
      offset: "2px"
      use: "키보드 포커스 링 (층별 악센트 컬러, accessibility §4-B)"

  # --- 모션/타이밍 토큰 ⭐ ---
  motion:
    # 클릭 피드백
    click-button:
      scale:    "0.97"
      duration: "60ms"
      easing:   "ease-out"
      use:      "[압축] 버튼 스쿼시 (0.97→1.0, 60ms)"

    click-glow:
      expand:   "+2px"
      duration: "200ms"
      easing:   "ease-out"
      use:      "클릭 시 r 게이지 중심 글로우 순간 확장 → 복귀"

    click-float:
      duration: "800ms"
      easing:   "ease-out"
      use:      "E 획득량 float text (층 악센트 컬러, 위로 이동하며 opacity 1→0)"

    # 구매 피드백
    purchase-button:
      scale:    "0.95"
      duration: "80ms"
      easing:   "ease-out"
      use:      "구매 버튼 스쿼시 (0.95→1.0, 80ms)"

    purchase-tint:
      opacity:  "0.08"
      duration: "400ms"
      easing:   "ease-out"
      use:      "구매 시 티어 행 배경 틴트 (층 악센트 컬러, 400ms fade)"

    purchase-unlock:
      from:     "0.25"
      to:       "1.0"
      duration: "400ms"
      use:      "미해금→해금 첫 구매 페이드인"

    # 발견 피드백
    codex-reveal:
      duration: "800ms"
      direction: "top-to-bottom"
      property:  "clip-path"
      use:       "도감 카드 발견 wipe (마스킹 0.8s 위→아래 걷힘)"

    legendary-flash:
      opacity:  "0.08"
      duration: "1000ms"
      color:    "var(--legendary)"   # #f5c842
      use:      "전설 입자 발견 시 황금 플래시"

    # 층 전환 (알려진 물리 5층 — 무상전이)
    layer-bg-fade:
      duration: "300ms"
      use:      "층 배경 질감 페이드아웃"

    layer-gauge-burst:
      scale:    "1.20"
      duration: "200ms"
      use:      "r 게이지 120% 팽창 후 새 층 스케일로 수축"

    layer-accent-shift:
      duration: "500ms"
      easing:   "linear"
      use:      "층 악센트 컬러 전환 (0.5s 선형, 갑작스럽지 않되 명확)"

    layer-card-slide:
      duration: "200ms"
      direction: "bottom-up"
      use:       "우측 패널 층 카드 슬라이드인"

    widget-slide:
      duration: "300ms"
      direction: "right-in"
      use:       "새 메커니즘 위젯 슬라이드인"

    particle-transition:
      fade-out: "300ms"
      fade-in:  "500ms"
      use:      "층 전환 시 파티클 교체"

    # 상전이 (미지 서브층 — 무게 있는 전환)
    phase-desaturate:
      duration: "500ms"
      use:      "첫 상전이 전 화면 탈색 (알려진 물리의 색 소거)"

    phase-flash-normal:
      opacity:  "0.15"
      duration: "50ms"
      color:    "var(--bigcrunch-flash)"   # #ffffff
      use:      "일반 상전이 화이트 플래시"

    phase-flash-first:
      opacity:  "0.30"
      duration: "50ms"
      color:    "var(--bigcrunch-flash)"
      use:      "첫 상전이 화이트 플래시 (강도 2배)"

    phase-accent-fade:
      duration: "800ms"
      use:      "첫 상전이 후 프리온 악센트 컬러 스며드는 fade-in"

    phase-gauge-expand:
      duration: "400ms"
      use:      "상전이 r 게이지 폭발 팽창 (전체 영역 채움)"

    phase-gauge-appear:
      duration: "300ms"
      use:      "새 층 r 게이지 fade-in 재등장"

    phase-qf-counter:
      duration: "600ms"
      type:     "fade-cross"
      use:      "QF 수치 fade-cross 증가 (이전값 fade-out + 새값 fade-in)"

    phase-qf-icon:
      scale:    "1.2"
      duration: "300ms"
      use:      "QF ◆ 아이콘 1.0→1.2→1.0 펄스"

    # 빅 크런치 전용
    bigcrunch-ring:
      radius-to: "800px"
      duration:  "400ms"
      easing:    "linear"
      thickness: "2px"
      opacity:   "1 → 0"
      use:       "QF 폭발 흰 링 방사 (중심→800px 반경)"

    bigcrunch-flash:
      opacity:  "0.12"
      duration: "150ms"
      color:    "var(--bigcrunch-flash)"
      use:      "QF 폭발 화면 전체 플래시"

    bigcrunch-blackout:
      duration: "3000ms"
      use:      "BLACKOUT — 완전 검정 3초 (음악·SFX 페이드아웃과 동기)"

    bigcrunch-runstart:
      duration: "500ms"
      from:     "var(--bigcrunch-bg)"   # #000000
      to:       "var(--canvas)"          # #080b0e
      use:      "RUN_START 배경 페이드인"

    text-reveal:
      duration: "200ms"
      per-line:  "200ms"
      use:       "빅 크런치 텍스트 한 줄씩 opacity 0→1 등장"

    # 앰비언트 모션 (방치 상태의 살아있음)
    ambient-glow-pulse:
      duration: "4000ms"
      easing:   "ease-in-out"
      type:     "infinite"
      use:       "방치 시 r 게이지 글로우 느린 맥동 (자동 압축 중)"

    ambient-tab-pulse:
      duration: "1500ms"
      easing:   "ease-in-out"
      type:     "infinite"
      use:       "첫 상전이 탭 점등 글로우 펄스 (1회차 한정)"

    # 기타 UI
    fade-cross:
      duration: "200ms"
      use:       "생산율 수치 교체 fade-cross"

    toast-slide:
      duration: "300ms"
      direction: "bottom-up"
      display:   "2000ms"
      use:       "토스트 슬라이드인 (2s 표시)"

    modal-slide:
      duration: "300ms"
      direction: "bottom-up"
      use:       "오프라인 복귀 모달 슬라이드업"

    button-error-shake:
      offset:   "3px"
      cycles:   "2"
      duration: "150ms"
      use:       "E 부족 구매 버튼 shake + 테두리 --col-reset"

  # --- 게임 UI 전용 토큰 ---
  game-ui:
    # r 게이지
    gauge:
      outer-ring-thickness: "4px"
      concentric-count:     "4"     # 동심원 최대 개수 (층 깊어질수록 감소)
      concentric-opacity:   ["0.15", "0.12", "0.10", "0.08"]
      decade-bar-height:    "4px"

    # 수치 표기
    number-format:
      scientific:  "N.NN×10^exp"    # 기본 (r값, 극소·극대)
      engineering: "N.NNe+exp"      # 자원 표시용
      prefix:      "K/M/G/T"        # 옵션 (설정에서 전환)
      min-digits:  "3"              # 유효 자릿수

    # 체인 테이블
    chain-table:
      tier-unlocked-opacity:  "1.0"
      tier-locked-opacity:    "0.25"
      tier-unlock-transition: "400ms"

    # 도감 카드 등급 (형태 이중 인코딩 — accessibility §1-B)
    codex-card:
      known:
        border:     "1px solid var(--border)"
        badge-bg:   "var(--surface)"
        badge-text: "알"
      hypothesis:
        border:     "2px solid var(--depth)"
        badge-bg:   "var(--depth)"
        badge-text: "가"
      unknown:
        border:     "1px solid var(--layer-accent)"
        border-glow: "var(--glow-card-unknown)"
        badge-bg:   "var(--layer-accent)"
        badge-text: "미"
      legendary:
        border:     "2px solid var(--legendary)"
        border-glow: "var(--glow-card-legendary)"
        badge-bg:   "var(--legendary)"
        badge-text: "전"
        pulse:      "2s ease-in-out infinite"
      undiscovered:
        opacity:    "0.30"
        mask:       "██████"

    # 층 아이콘 기호 (형태 이중 인코딩 — accessibility §1-B)
    layer-icons:
      mol:  "⬡"    # 분자층
      atom: "◎"    # 원자층
      nuc:  "⬤"    # 핵층
      ncl:  "△▲"  # 핵자층
      qrk:  "─"    # 쿼크층
      prn:  "≈"    # 프리온층
      str:  "~"    # 끈층
      lp:   "⬡⬡"  # 루프층
      fm:   "○"    # 거품층
      inf:  "∥"    # 정보층
      plk:  "▪"    # 플랑크층

    # 파티클 스펙 (층별 앰비언트 파티클 — art-direction §4-A)
    particles:
      mol:  { shape: "circle",       size: "3-6px",   density: "medium",   speed: "slow",   fade: "opacity" }
      atom: { shape: "circle+trail", size: "2-4px",   density: "medium",   speed: "orbital", fade: "orbit" }
      nuc:  { shape: "cluster-dot",  size: "2-3px",   density: "high",     speed: "vibrate", fade: "absorb" }
      ncl:  { shape: "triangle-rgb", size: "4px",     density: "low",      speed: "3body",  fade: "merge" }
      qrk:  { shape: "linear-stroke", size: "1x8px", density: "low",      speed: "fast",   fade: "edge" }
      prn:  { shape: "phase-arc",    size: "variable", density: "low",     speed: "phase",  fade: "regen" }
      str:  { shape: "sine-segment", size: "1x12px",  density: "low",      speed: "sine",   fade: "converge" }
      lp:   { shape: "grid-node",    size: "3px",     density: "grid",     speed: "pulse",  fade: "edge-emit" }
      fm:   { shape: "bubble",       size: "2-8px",   density: "random",   speed: "random", fade: "natural 0.3-2s" }
      inf:  { shape: "h-stream",     size: "1x20px",  density: "medium",   speed: "fast-h", fade: "right-edge" }
      plk:  { shape: "pixel-frag",   size: "1-2px",   density: "high",     speed: "near-zero", fade: "pixel-decay" }

    # 상태 색 (게임 진행 상태)
    states:
      locked:
        opacity: "0.25"
        color:   "var(--foreground-dim)"
      unlocked:
        opacity: "1.0"
        color:   "var(--foreground)"
      active:
        color:   "var(--primary)"          # #3ecf8e
      discovered:
        opacity: "1.0"
        border:  "var(--layer-accent)"
      undiscovered:
        opacity: "0.30"
        color:   "var(--foreground-dim)"
      focus-sublayer:
        color:   "var(--primary)"          # #3ecf8e (집중 서브층 진입 시 배지)
      phase-ready:
        color:   "var(--layer-accent)"     # 상전이 준비 탭 점
      phase-first:
        color:   "var(--prn-accent)"       # #7c4dff (첫 상전이)
      phase-bigcrunch:
        color:   "var(--bigcrunch-flash)"  # #ffffff

  components:
    # 압축 메인 버튼
    button-compress:
      type:    "primary action"
      min-size: "44x44px"
      bg:      "var(--surface)"
      fg:      "var(--foreground)"
      radius:  "var(--rounded-md)"
      padding: "12px 24px"
      font:    "label-md"
      use:     "[압축] 핵심 버튼 — 44px 최소 보장"

    # 구매 버튼 (체인 테이블 행)
    button-buy:
      type:    "secondary action"
      min-h:   "32px"
      bg:      "var(--surface)"
      fg:      "var(--foreground)"
      radius:  "var(--rounded-sm)"
      padding: "4px 8px"
      font:    "label-sm"
      use:     "압축기 구매 버튼 — 행 전체 너비"

    # 도감 카드
    card-codex:
      type:    "game card"
      bg:      "var(--canvas-layer)"
      fg:      "var(--foreground)"
      radius:  "var(--rounded-md)"
      padding: "var(--base)"
      font:    "label-lg"
      use:     "입자 도감 카드 — 등급별 테두리 차등 (game-ui.codex-card)"

    # 위젯 컨테이너 (메커니즘)
    widget-container:
      type:    "game widget"
      bg:      "var(--canvas-layer)"
      fg:      "var(--foreground)"
      radius:  "var(--rounded-lg)"
      padding: "var(--md)"
      font:    "narr-md"
      use:     "층별 메커니즘 위젯 (오비탈·핵력·색전하 등)"

    # 토스트
    toast:
      type:    "notification"
      bg:      "var(--surface)"
      fg:      "var(--foreground)"
      border:  "1px solid var(--layer-accent)"
      radius:  "var(--rounded-md)"
      padding: "var(--sm) var(--md)"
      font:    "narr-md"
      use:     "발견·이벤트 토스트 (층 악센트 컬러 테두리)"

    # 뱃지 (리셋/보존/이월)
    badge-reset:
      bg:   "var(--reset)"
      fg:   "#ffffff"
      font: "label-sm"
      text: "리셋"
      use:  "상전이 매트릭스 리셋 뱃지"

    badge-keep:
      bg:   "var(--keep)"
      fg:   "#ffffff"
      font: "label-sm"
      text: "보존"
      use:  "상전이 매트릭스 보존 뱃지"

    badge-partial:
      bg:   "var(--partial)"
      fg:   "#ffffff"
      font: "label-sm"
      text: "50% 이월"
      use:  "상전이 매트릭스 부분 이월 뱃지"

  accessibility:
    # 색맹 이중 인코딩 원칙 (accessibility.md §1-B)
    dual-encoding:
      - "층 구분: 악센트 컬러 + layer-icons 기호 + 텍스트 라벨 병기"
      - "자원 구분: E⚡·C◎·D▣·QF◆ 색 + 기호 (이미 이중)"
      - "핵자층 색전하: 수치(%) + R/G/B 라벨 (색 단독 금지)"
      - "상전이 탭 점등: 색점 + '상전이 준비' 텍스트 레이블 변경"
      - "도감 카드 등급: 테두리 형태(단일/이중/발광/맥동) + 뱃지 텍스트(알/가/미/전)"
      - "리셋/보존 뱃지: 컬러 + 텍스트 라벨 내장 (색 단독 금지)"
      - "QF 미니 차트: 현재●실선/예측○점선 (색 + 형태)"

    # CSS 색맹 모드 적용 방식
    colorblind-attr:
      protanopia:   "[data-colorblind='protanopia']"
      deuteranopia: "[data-colorblind='deuteranopia']"
      tritanopia:   "[data-colorblind='tritanopia']"
      note: "루트 요소에 속성 적용 시 layer accent 변수 교체 — 파티클 색도 자동 반영"

    # 감소 모션 (accessibility.md §2-B)
    reduced-motion:
      selector: "@media (prefers-reduced-motion: reduce)"
      overrides:
        - "층 전환: 즉시 전환 (페이드·스케일 없음)"
        - "상전이 플래시: 제거 → 새 층 악센트 컬러 즉시"
        - "빅 크런치 플래시: 제거 → 링 정적 표시 후 페이드"
        - "앰비언트 파티클: 속도 10% 이하 또는 정지"
        - "r 게이지 맥동: 정적 글로우"
        - "reveal wipe: 즉시 reveal"
        - "구매 버튼 스쿼시: scale 대신 opacity 잠깐 감소"
        - "전설 카드 맥동: 정적 금 테두리 + ★ 아이콘"
        - "QF 카운터: 즉시 전환"

    # WCAG AA 명도 대비 (accessibility.md §3-B)
    contrast:
      foreground-on-canvas:    "13.5:1"   # #e8eef3 on #0a0c0f — AAA
      foreground-sub-on-canvas: "4.9:1"   # #7a8f9e — AA
      foreground-dim-on-canvas: "2.1:1"   # #3d5162 — 비활성 의도적 예외
      note: "층별 악센트 on 배경 AA 통과 검증 필요 (구현 후 실제 렌더 측정)"

    # 클릭 타깃 최소 크기 (accessibility.md §4-A)
    click-targets:
      compress-button:   "44x44px"   # 핵심 반복 액션
      orbital-slot:      "36px"      # 원형, 44px 권장
      tier-row:          "32px"      # 행 전체 너비
      phase-toggle:      "32x32px"
      tab-height:        "44px"

    # 접근성 예외 명시
    exceptions:
      - "--foreground-dim (#3d5162): 미해금·비활성 요소. 대비 2.1:1 의도적. 읽기 금지가 디자인 의도."
      - "스핀 네트워크(L8) 캔버스: 마우스 전용. 설정 탭에 명시."

---

## 1. 비주얼 테마 & 분위기

### 아트 스타일 한 줄

**"실험 기록의 미학 (Instrument Aesthetic)"** — 연구 기기와 측정 도구의 화면 언어. 정밀하고 냉정하되, 발견 앞에서 경이를 숨기지 않는다.

### 거부하는 룩

- 네온 사이버펑크 (파란 그리드 + 보라 글로우 + 핑크 아우트라인) — 상투어.
- 우주적 장엄함 (성운·별·황금 행성) — 이 게임은 위를 보지 않는다. 아래로.
- 귀여운 인크리멘탈 (파스텔·둥근 아이콘) — 냉정한 연구소장 보이스와 불일치.

### 채택하는 룩

- 계측기 그린 / 실험실 다크 베이스: 어두운 배경에서 데이터를 읽는 오실로스코프.
- 물리적 광량: 각 층의 빛은 실제 물리 현상에 근거 (분산광·강한 결합 에너지·진공 붕괴).
- 과학 문서 타이포그래피: 모노스페이스가 수치, 산세리프가 레이블.

---

## 2. 색 팔레트 & 역할

### 베이스 팔레트

| 역할 | 변수 | Hex | 용도 |
|---|---|---|---|
| 배경 딥 | `--canvas` | `#080b0e` | 최외곽 배경, 가장 어두운 기저 |
| 배경 레이어 | `--canvas-layer` | `#0e1418` | 패널·카드 기본 |
| 표면 | `--surface` | `#141c23` | 인풋·버튼 표면 |
| 테두리 | `--border` | `#1e2c38` | 구분선·프레임 |
| 텍스트 강조 | `--foreground` | `#e8eef3` | 주요 수치·라벨 (대비 13.5:1) |
| 텍스트 보조 | `--foreground-sub` | `#7a8f9e` | 설명·보조 정보 (대비 4.9:1) |
| 텍스트 희미 | `--foreground-dim` | `#3d5162` | 미해금·비활성 (의도적 저대비) |

### 자원 컬러

| 자원 | 변수 | Hex | 아이콘 |
|---|---|---|---|
| 압축 에너지 E | `--energy` | `#f5c842` | ⚡ |
| 압축 깊이 C | `--depth` | `#5b9bd5` | ◎ |
| 발견 데이터 D | `--data` | `#9b72cf` | ▣ |
| 양자 거품 QF | `--qf` / `--primary` | `#3ecf8e` | ◆ |

### 기능 컬러

| 역할 | 변수 | Hex |
|---|---|---|
| r 게이지 코어 글로우 | `--col-glow-core` / `--primary` | `#3ecf8e` |
| 리셋 뱃지·E 부족 경고 | `--reset` | `#c0392b` |
| 보존 뱃지 | `--keep` | `#27ae60` |
| 부분 이월 뱃지 | `--partial` | `#e67e22` |
| 전설 입자·황금 플래시 | `--legendary` | `#f5c842` |
| 빅 크런치 플래시/링 | `--bigcrunch-flash` | `#ffffff` |
| 빅 크런치 배경 | `--bigcrunch-bg` | `#000000` |

### 층별 악센트 — 색온도 아크

깊을수록 배경은 어두워지고, 중심 글로우는 더 강하고 날카로워진다.

| # | 층 | 악센트 변수 | Hex | 색온도 | 연상 |
|---|---|---|---|---|---|
| L1 | 분자층 | `--layer-mol-accent` | `#8bc34a` | 따뜻 (황록) | 유기물·온기 |
| L2 | 원자층 | `--layer-atom-accent` | `#26c6da` | 따뜻 (청록) | 보어 모델·침착함 |
| L3 | 핵층 | `--layer-nuc-accent` | `#ff7043` | 따뜻 (주황) | 에너지 집중·압력 |
| L4 | 핵자층 | `--layer-ncl-accent-{r/g/b}` | `#e040fb`/`#40c4ff`/`#69f0ae` | 화려함→탈색 경계 | 색전하 화합 |
| L5 | 쿼크층 | `--layer-qrk-accent` | `#f0f4f8` | 탈색 (백색) | 점근 자유·공허 |
| L6 | 프리온층 | `--layer-prn-accent` | `#7c4dff` | 차가움 (자주) | 미지 첫 문턱 |
| L7 | 끈층 | `--layer-str-accent` | `#ff4081` | 차가움 (적외) | 진동·하모닉스 |
| L8 | 루프층 | `--layer-lp-accent` | `#3d5afe` | 차가움 (남색) | 공간의 이산성 |
| L9 | 거품층 | `--layer-fm-accent` | `#eceff1` | 차가움 (은백) | 불확정성·요동 |
| L10 | 정보층 | `--layer-inf-accent` | `#00e5ff` | 차가움 (청백) | 홀로그래픽·경계 |
| L11 | 플랑크층 | `--layer-plk-accent` | `#ffffff` | 순백 (色 소멸) | 시공간 픽셀·끝 |

**색온도 아크**: 분자→핵 = 따뜻한 색계 / 핵자→쿼크 = 삼원색→탈색 / 프리온 이하 = 차갑고 날카로운 단색 / 플랑크 = 순백(모든 색의 합산·종결).

---

## 3. 타이포그래피

### 서체 시스템

| 역할 | 서체 | 변수 |
|---|---|---|
| 수치 (numeric) | JetBrains Mono / IBM Plex Mono | `--font-numeric` |
| 레이블 | Inter / IBM Plex Sans | `--font-label` |
| 내러티브·로그 | IBM Plex Mono | `--font-narrative` |

### 타입 스케일

| 토큰 | 크기 | 굵기 | 용도 |
|---|---|---|---|
| `num-xl` | 20px | 500 | r 값 대형 표시 |
| `num-lg` | 16px | 400 | 자원 현재값 |
| `num-md` | 13px | 400 | 생산율·비용 |
| `label-lg` | 15px | 500 | 입자 이름 |
| `label-md` | 13px | 400 | 버튼·탭 |
| `label-sm` | 11px | 400 | 뱃지·툴팁 |
| `narr-md` | 12px | 400 | 층 비트·시그니처 로그 |
| `narr-sm` | 11px | 400 | 고정 문구 (opacity 0.45) |

### 타이포 원칙

- 수치는 항상 numeric(mono). 자리 이동 없이 읽힌다.
- 내러티브 텍스트도 mono. 연구 로그처럼 보인다. 게임이 아니라 기록처럼.
- 대문자·이탤릭·장식 폰트 없음.
- 과학 표기 강제: `1.616×10⁻³⁵ m` 형식.
- 층 이름 두 언어 병기: `프리온층 — Preon`.

---

## 4. 글로우 (Glow) 시스템

빛이 곧 정보. shadow 개념 없음 — 모든 깊이는 글로우로 표현한다.

| 글로우 | 반경 | 컬러 | 용도 |
|---|---|---|---|
| r 게이지 코어 | 3→8→14px | `--primary` (#3ecf8e) | r 감소 시 반경 확대 (200ms ease-out) |
| 층 앰비언트 헤이즈 | 24px | 층 악센트 (opacity 0.12) | canvas 위 미세 광량 |
| 카드 미지 입자 | 4px | 층 악센트 | 발광 테두리 |
| 카드 전설 입자 | 6px | `--legendary` (#f5c842) | 2s 맥동 |
| 키보드 포커스 링 | 2px solid, offset 2px | 층 악센트 | 접근성 포커스 시각화 |

**글로우 블렌딩**: 코어 글로우는 `--col-glow-core`(#3ecf8e) 베이스에 층별 악센트 컬러를 10~20% 블렌딩. 깊을수록 코어는 더 강하고 날카로워진다.

---

## 5. 모션 & 타이밍 — 주스(Juice) 가이드

### 핵심 원칙

이 게임의 주스는 **절제된 정밀함**이다. 모든 피드백은 정보를 담거나, 물리 현상을 시각화하거나, 없어야 한다.

**금지**: 별 폭발·코인 분수·무지개 파티클·화면 셰이크(층 메커니즘 무의미한 과장).  
**허용**: 미세 진동(스쿼시), 단색 플래시(최대 0.15 opacity, 최대 0.2s), 수치 팝업, 아이콘 펄스.  
**예외**: 빅 크런치(1회차 한정 최정점 연출).

### 행동별 피드백 요약

| 이벤트 | 시각 토큰 | 지속 |
|---|---|---|
| [압축] 클릭 | `--motion-click-button` (0.97 scale, 60ms) + 글로우 +2px (200ms) | 60~200ms |
| 구매 | `--motion-purchase-button` (0.95 scale, 80ms) + 행 틴트 (0.08, 400ms) | 80~400ms |
| 발견 (일반) | `--motion-codex-reveal` (clip-path, 800ms) | 800ms |
| 발견 (전설) | reveal wipe + `--motion-legendary-flash` (금 플래시, 1s) | 800ms + 1s |
| 층 전환 | bg fade (300ms) + gauge burst (200ms) + accent shift (500ms) | ~500ms |
| 상전이 일반 | 플래시 0.15/50ms + QF counter (600ms) | ~600ms |
| 상전이 첫 번째 | 탈색 (500ms) + 플래시 0.30/50ms + accent fade (800ms) | ~800ms |
| 빅 크런치 링 | ring 800px/400ms + flash 0.12/150ms + BLACKOUT 3000ms | ~4s |
| 오프라인 모달 | `--motion-modal-slide` (bottom-up, 300ms) | 300ms |

### 앰비언트 모션 (방치 상태의 살아있음)

- r 게이지 글로우: 4초 주기 느린 맥동 (`--motion-ambient-glow-pulse`).
- 배경 파티클: 항상 움직임. 속도는 C 생산률에 비례.
- 자원 수치: 1~2초 주기 부드러운 갱신 (급격한 점프 없음).

---

## 6. 브랜드 철학

### Voice (narrative.md §2 준수)

"압축의 로그: 냉정하고 정확하되, 발견 앞에서는 경이를 숨기지 않는다."

- 수치와 과학 용어가 먼저. 감탄사 없음.
- 느낌표는 빅 크런치 단 한 번을 위해 아낀다 — 실제로는 쓰지 않는다.
- 판타지 어휘 금지. 계측기·실험 보고 어휘 사용.

### 상태별 비주얼 어조

| 구간 | 색온도 | 광량 | 텍스트 어조 |
|---|---|---|---|
| 알려진 물리 (L1~L5) | 따뜻 | 넓고 고른 | 침착하고 확신에 차 있음 |
| 미지 첫 문턱 (L6) | 차가워짐 | 어둡고 날카로운 점 | 목소리가 낮아짐 |
| 미지 심화 (L7~L10) | 차갑고 단색 | 글로우 강화, 배경 축소 | 기록만. 확신하지 않음. |
| 플랑크 (L11) | 순백 | 최대 밀도·최소 반경 | 말이 줄어든다. 멈춘다. |

---

## CSS Custom Properties Export

> graphics-programmer: CSS var 직접 사용. Svelte UI = CSS var, Canvas/WebGL = 동일 값 JS 참조.  
> 색맹 모드 적용: `document.documentElement.dataset.colorblind = 'protanopia'` 등으로 루트 속성 교체.  
> 감소 모션: `@media (prefers-reduced-motion: reduce)` 분기 적용 + `$reducedMotion` Svelte 스토어 연동.

```css
/* ============================================================
   Micro Idle — Design Tokens (CSS Custom Properties)
   Source: design/DESIGN.md
   Target: game canvas root element (:root)
   Generated: 2026-06-26 (art-director)
   ============================================================ */

:root {
  /* --- 베이스 팔레트 --- */
  --canvas:          #080b0e;
  --canvas-layer:    #0e1418;
  --surface:         #141c23;
  --border:          #1e2c38;
  --foreground:      #e8eef3;
  --foreground-sub:  #7a8f9e;
  --foreground-dim:  #3d5162;

  /* --- 자원 컬러 --- */
  --energy:          #f5c842;
  --depth:           #5b9bd5;
  --data:            #9b72cf;
  --qf:              #3ecf8e;
  --primary:         #3ecf8e;   /* alias: --qf, r 게이지 코어, 집중 서브층 강조 */

  /* --- 기능 컬러 --- */
  --col-glow-core:   #3ecf8e;   /* r 게이지 중심 글로우 */
  --col-energy:      #f5c842;
  --col-depth:       #5b9bd5;
  --col-data:        #9b72cf;
  --col-qf:          #3ecf8e;
  --col-reset:       #c0392b;
  --col-keep:        #27ae60;
  --col-partial:     #e67e22;
  --legendary:       #f5c842;
  --bigcrunch-flash: #ffffff;
  --bigcrunch-bg:    #000000;

  /* --- 층별 팔레트 (11층 × accent/glow/bg) --- */
  /* L1 분자층 */
  --layer-mol-accent: #8bc34a;
  --layer-mol-glow:   #6ea832;
  --layer-mol-bg:     #0a0e09;

  /* L2 원자층 */
  --layer-atom-accent: #26c6da;
  --layer-atom-glow:   #1aa8ba;
  --layer-atom-bg:     #090d0e;

  /* L3 핵층 */
  --layer-nuc-accent: #ff7043;
  --layer-nuc-glow:   #e05a2b;
  --layer-nuc-bg:     #0e0a08;

  /* L4 핵자층 (삼원색 세트) */
  --layer-ncl-accent-r: #e040fb;
  --layer-ncl-accent-g: #40c4ff;
  --layer-ncl-accent-b: #69f0ae;
  --layer-ncl-glow:     #b030d0;
  --layer-ncl-bg:       #0d090e;

  /* L5 쿼크층 */
  --layer-qrk-accent: #f0f4f8;
  --layer-qrk-glow:   #d8dfe6;
  --layer-qrk-bg:     #080b0e;   /* 극미니멀 — canvas와 동일 */

  /* L6 프리온층 */
  --layer-prn-accent: #7c4dff;
  --layer-prn-glow:   #6030e0;
  --layer-prn-bg:     #09080e;

  /* L7 끈층 */
  --layer-str-accent: #ff4081;
  --layer-str-glow:   #e02060;
  --layer-str-bg:     #0e080a;

  /* L8 루프층 */
  --layer-lp-accent:  #3d5afe;
  --layer-lp-glow:    #2a3fd0;
  --layer-lp-bg:      #08090e;

  /* L9 거품층 */
  --layer-fm-accent:  #eceff1;
  --layer-fm-glow:    #ccd0d2;
  --layer-fm-bg:      #09090a;

  /* L10 정보층 */
  --layer-inf-accent: #00e5ff;
  --layer-inf-glow:   #00c0d8;
  --layer-inf-bg:     #08090e;

  /* L11 플랑크층 */
  --layer-plk-accent: #ffffff;
  --layer-plk-glow:   #e0e0e0;
  --layer-plk-bg:     #070a0d;

  /* --- 런타임 현재 층 (game-programmer가 층 전환 시 교체) --- */
  --layer-accent: var(--layer-mol-accent);   /* 현재 층 악센트 (초기=분자층) */
  --layer-glow:   var(--layer-mol-glow);
  --layer-bg:     var(--layer-mol-bg);

  /* --- 타이포그래피 --- */
  /* 한글 fallback 추가(visual-overhaul §2-A): IBM Plex Sans KR self-host(@fontsource). */
  --font-numeric:   'JetBrains Mono', 'IBM Plex Mono', 'IBM Plex Sans KR', monospace;
  --font-label:     'Inter', 'IBM Plex Sans KR', 'IBM Plex Sans', sans-serif;
  --font-narrative: 'IBM Plex Mono', 'JetBrains Mono', 'IBM Plex Sans KR', monospace;

  /* 타입스케일 위계(visual-overhaul §2-B): r·자원값을 키우고 라벨을 낮춰 대비. */
  --text-num-display: 34px;   /* r 값(게이지 주인공) */
  --text-num-xl:    24px;     /* 자원 현재값(C/E) — 20→24 */
  --text-num-lg:    16px;
  --text-num-md:    13px;
  --text-label-lg:  15px;
  --text-label-md:  13px;
  --text-label-sm:  11px;
  --text-label-xs:  10px;     /* overline/유닛 캡션 */
  --text-narr-md:   12px;
  --text-narr-sm:   11px;

  /* --- 반응형 브레이크포인트(ux-overhaul §2-1) --- */
  --bp-narrow: 720px;
  --bp-wide:   1080px;

  /* --- 스페이싱 --- */
  --space-xs:    4px;
  --space-sm:    8px;
  --space-base:  12px;
  --space-md:    16px;
  --space-lg:    24px;
  --space-xl:    32px;
  --space-xxl:   48px;

  /* --- 라운드 --- */
  --rounded-sm:   2px;
  --rounded-md:   4px;
  --rounded-lg:   8px;
  --rounded-full: 9999px;

  /* --- 글로우 --- */
  --glow-core-radius-min: 3px;
  --glow-core-radius-mid: 8px;
  --glow-core-radius-max: 14px;
  --glow-layer-ambient:   24px;

  /* --- 모션 토큰 --- */
  /* 클릭 */
  --motion-click-scale:    0.97;
  --motion-click-duration: 60ms;
  --motion-click-glow:     200ms;
  --motion-click-float:    800ms;

  /* 구매 */
  --motion-purchase-scale:    0.95;
  --motion-purchase-duration: 80ms;
  --motion-purchase-tint:     400ms;
  --motion-purchase-unlock:   400ms;

  /* 발견 */
  --motion-codex-reveal:      800ms;
  --motion-legendary-flash:   1000ms;

  /* 층 전환 (알려진 물리) */
  --motion-layer-bg-fade:     300ms;
  --motion-layer-gauge-burst: 200ms;
  --motion-layer-accent-shift:500ms;
  --motion-layer-card-slide:  200ms;
  --motion-widget-slide:      300ms;
  --motion-particle-fade-out: 300ms;
  --motion-particle-fade-in:  500ms;

  /* 상전이 */
  --motion-phase-desaturate:  500ms;
  --motion-phase-flash-normal-opacity: 0.15;
  --motion-phase-flash-first-opacity:  0.30;
  --motion-phase-flash-duration: 50ms;
  --motion-phase-accent-fade: 800ms;
  --motion-phase-gauge-expand:400ms;
  --motion-phase-gauge-appear:300ms;
  --motion-phase-qf-counter:  600ms;
  --motion-phase-qf-icon:     300ms;

  /* 빅 크런치 */
  --motion-bigcrunch-ring:    400ms;
  --motion-bigcrunch-flash-opacity: 0.12;
  --motion-bigcrunch-flash:   150ms;
  --motion-bigcrunch-blackout:3000ms;
  --motion-bigcrunch-runstart:500ms;
  --motion-text-reveal:       200ms;

  /* 앰비언트 */
  --motion-ambient-pulse:     4000ms;
  --motion-ambient-tab-pulse: 1500ms;

  /* UI */
  --motion-fade-cross:     200ms;
  --motion-toast-slide:    300ms;
  --motion-modal-slide:    300ms;
  --motion-error-shake:    150ms;
}


/* ============================================================
   색맹 보정 모드 (accessibility.md §1-C)
   적용: document.documentElement.dataset.colorblind = '...'
   ============================================================ */

[data-colorblind="protanopia"] {
  --layer-mol-accent: #c8b400;
  --layer-nuc-accent: #e6a800;
  --layer-str-accent: #b8b8ff;
}

[data-colorblind="deuteranopia"] {
  --layer-mol-accent:   #d4b800;
  --layer-ncl-accent-b: #e0c040;
  --layer-nuc-accent:   #e89000;
}

[data-colorblind="tritanopia"] {
  --layer-atom-accent: #00b377;
  --layer-prn-accent:  #c0392b;
  --layer-lp-accent:   #8e44ad;
  --layer-inf-accent:  #16a085;
}


/* ============================================================
   감소 모션 (accessibility.md §2-B)
   시스템 감지 자동 적용 — 설정 토글보다 우선
   ============================================================ */

@media (prefers-reduced-motion: reduce) {
  :root {
    /* 모션 토큰 오버라이드 */
    --motion-click-scale:    1.0;       /* 스쿼시 없음 */
    --motion-purchase-scale: 1.0;
    --motion-layer-bg-fade:  0ms;       /* 즉시 전환 */
    --motion-layer-gauge-burst: 0ms;
    --motion-layer-accent-shift: 0ms;
    --motion-phase-desaturate: 0ms;
    --motion-phase-flash-normal-opacity: 0;   /* 플래시 제거 */
    --motion-phase-flash-first-opacity:  0;
    --motion-bigcrunch-flash-opacity: 0;
    --motion-codex-reveal:   0ms;       /* 즉시 reveal */
    --motion-phase-qf-counter: 0ms;
    --motion-ambient-pulse:  0ms;       /* 정적 글로우 */
    --motion-ambient-tab-pulse: 0ms;
  }
  /* 파티클: 속도 10% 이하 또는 정지 — graphics-programmer: $reducedMotion 스토어 참조 */
  /* 전설 카드 맥동: 정적 테두리로 대체 */
  .card-legendary { animation: none; }
}


/* ============================================================
   런타임 층 전환 유틸 (game-programmer 참조)
   JS: document.documentElement.style.setProperty('--layer-accent', '#7c4dff')
   또는 data-layer 속성으로 일괄 교체
   ============================================================ */

[data-layer="mol"] {
  --layer-accent: var(--layer-mol-accent);
  --layer-glow:   var(--layer-mol-glow);
  --layer-bg:     var(--layer-mol-bg);
}
[data-layer="atom"] {
  --layer-accent: var(--layer-atom-accent);
  --layer-glow:   var(--layer-atom-glow);
  --layer-bg:     var(--layer-atom-bg);
}
[data-layer="nuc"] {
  --layer-accent: var(--layer-nuc-accent);
  --layer-glow:   var(--layer-nuc-glow);
  --layer-bg:     var(--layer-nuc-bg);
}
[data-layer="ncl"] {
  --layer-accent: var(--layer-ncl-accent-r);   /* 삼원색: R을 기본, G/B는 별도 참조 */
  --layer-glow:   var(--layer-ncl-glow);
  --layer-bg:     var(--layer-ncl-bg);
}
[data-layer="qrk"] {
  --layer-accent: var(--layer-qrk-accent);
  --layer-glow:   var(--layer-qrk-glow);
  --layer-bg:     var(--layer-qrk-bg);
}
[data-layer="prn"] {
  --layer-accent: var(--layer-prn-accent);
  --layer-glow:   var(--layer-prn-glow);
  --layer-bg:     var(--layer-prn-bg);
}
[data-layer="str"] {
  --layer-accent: var(--layer-str-accent);
  --layer-glow:   var(--layer-str-glow);
  --layer-bg:     var(--layer-str-bg);
}
[data-layer="lp"] {
  --layer-accent: var(--layer-lp-accent);
  --layer-glow:   var(--layer-lp-glow);
  --layer-bg:     var(--layer-lp-bg);
}
[data-layer="fm"] {
  --layer-accent: var(--layer-fm-accent);
  --layer-glow:   var(--layer-fm-glow);
  --layer-bg:     var(--layer-fm-bg);
}
[data-layer="inf"] {
  --layer-accent: var(--layer-inf-accent);
  --layer-glow:   var(--layer-inf-glow);
  --layer-bg:     var(--layer-inf-bg);
}
[data-layer="plk"] {
  --layer-accent: var(--layer-plk-accent);
  --layer-glow:   var(--layer-plk-glow);
  --layer-bg:     var(--layer-plk-bg);
}
```

---

*WebGL/Canvas 참조 방법: JS에서 `getComputedStyle(document.documentElement).getPropertyValue('--layer-accent').trim()` 으로 동일 값 읽기. 파티클 색·글로우 색 등 Canvas/WebGL에서 쓰는 모든 색은 이 변수에서 파생.*
