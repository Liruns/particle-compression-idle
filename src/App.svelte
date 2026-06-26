<script lang="ts">
  /**
   * App.svelte — 메인 셸 (디자인 오버홀: 반응형 3패널 + 계측기 타이포·아이콘). (ux/visual-overhaul-plan)
   *  레이아웃: >=1080 3패널(LEFT 자원상주 / CENTER 게이지·체인 / RIGHT 메커니즘·층) / 720–1079 2컬럼 / <720 단일+하단탭바.
   *  상주/탭 분리(ux §P0-3): 자원·층·메커니즘은 패널 상주, 탭 {#if}는 CENTER 콘텐츠만 교체.
   *  표시 전용(읽기 전용 스냅샷 구독, §4.1 단방향).
   *
   *  ★렌더 레이어 불변(가드레일): (a)배경 fx 캔버스(fixed,z-1) (b)게이지 글로우 캔버스(.gauge 내)
   *    (c)onMount setupRenderer (d)subscribe 콜백서 pushRender→setSnapshot+draw (e)slug 변화 onLayerChange
   *    (f)onDestroy dispose (g)$reducedMotion 구독 (h)dev forceLayer — 8개 모두 유지. 레이아웃만 재구조.
   */
  import { onMount, onDestroy } from 'svelte';
  import { Game, installUnloadSave, type GameSnapshot, type BuyMode } from './game';
  import { formatNumber, formatRadius } from './core/format';
  import { bus } from './core/events';
  import { CanvasRenderer } from './render';
  import { reducedMotion } from './ui/stores/reduced-motion';
  import { particleById } from './data/particles';
  import { layerEntryBeat } from './data/narrative';
  import ChainTable from './ui/ChainTable.svelte';
  import LayerCard from './ui/LayerCard.svelte';
  import CodexView from './ui/CodexView.svelte';
  import ResonanceWidget from './ui/ResonanceWidget.svelte';
  import PhaseWidget from './ui/PhaseWidget.svelte';
  import HarmonicsWidget from './ui/HarmonicsWidget.svelte';
  import PrestigeView from './ui/PrestigeView.svelte';
  import ResearchView from './ui/ResearchView.svelte';
  import RightPanelStatus from './ui/RightPanelStatus.svelte';
  import OfflineModal from './ui/OfflineModal.svelte';
  import Toast from './ui/Toast.svelte';
  import Icon from './ui/icons/Icon.svelte';
  import type { PhaseState } from './core/layers/mechanics';

  let snap: GameSnapshot | null = null;
  let game: Game | null = null;
  let unsub: (() => void) | null = null;
  const busUnsubs: (() => void)[] = [];
  let toast: Toast;

  // 캔버스 렌더 레이어(m2-render-plan v0.2). 배경 fx(헤이즈·파티클) + 게이지 글로우 2장.
  //  표현 전담 — snapshot 파생만 읽음(읽기 전용 §4.1). App 자체 rAF 없음(subscribe 콜백서 draw, V2-4).
  let bgCanvas: HTMLCanvasElement | null = null;
  let glowCanvas: HTMLCanvasElement | null = null;
  let renderer: CanvasRenderer | null = null;
  let canvasReady = false;
  let lastSlug = '';
  let rmUnsub: (() => void) | null = null;
  let bgResizeObserver: ResizeObserver | null = null;
  let glowResizeObserver: ResizeObserver | null = null;
  /** window resize 핸들러(반응형 게이지 백버퍼 추적 보강 — ResizeObserver 지연/미전달 대비). */
  let onWindowResize: (() => void) | null = null;
  /** 현재 렌더러에 붙은 글로우 캔버스(중복 재생성 방지 — 동일 참조면 재구성 안 함). */
  let attachedGlowCanvas: HTMLCanvasElement | null = null;

  /** 현재 탭. */
  type Tab = 'compress' | 'research' | 'codex' | 'prestige';
  let tab: Tab = 'compress';

  const loadLabel: Record<GameSnapshot['loadKind'], string> = {
    fresh: '새 게임',
    loaded: '세이브 로드됨',
    recovered: '백업에서 복구됨',
    corrupt: '세이브 손상 — 새로 시작',
  };

  onMount(async () => {
    game = new Game();
    // 구독: snapshot 보관(DOM 반응성) + 렌더러 푸시·draw(V2-4 — subscribe가 rAF마다 구동).
    unsub = game.subscribe((s) => {
      snap = s;
      pushRender(s);
    });
    installUnloadSave(game);

    // 배경 fx 렌더러 생성(배경 캔버스는 항상 존재). 게이지 글로우 캔버스는 압축 탭에서만 →
    //   바인딩되면 attachGlowCanvas로 합류(reactive 블록). reduced-motion 스토어 구독.
    setupRenderer();
    rmUnsub = reducedMotion.subscribe((v) => renderer?.setReducedMotion(v));

    // dev: L6 색 온도 대비 조기 검증 훅(프로덕션 제거). window.forceLayer('prn')로 렌더만 전환.
    if (import.meta.env.DEV) {
      (window as unknown as { forceLayer: (slug: string) => void }).forceLayer = (slug: string) => {
        document.documentElement.setAttribute('data-layer', slug);
        renderer?.onLayerChange(slug);
        lastSlug = slug;
      };
    }

    // 이벤트 버스 → 토스트(발견·층 진입 비트). start() 전에 등록해 부팅 발견도 포착.
    busUnsubs.push(
      bus.on('codexDiscover', ({ particleId }) => {
        const p = particleById(particleId);
        if (!p) return;
        const kind = p.rarity === 'LEGENDARY' ? 'legendary' : 'discover';
        toast?.push(kind, [`${p.nameKo} — 도감에 기록됨`]);
      }),
    );
    busUnsubs.push(
      bus.on('layerEnter', ({ layer }) => {
        const beat = layerEntryBeat(layer);
        if (beat) toast?.push('beat', beat.lines);
      }),
    );
    // 상전이 비트(M1.5): 실행 로그 1줄 + 진입 비트(첫 상전이는 2줄). narrative §5-B.
    busUnsubs.push(
      bus.on('prestige_beat', ({ execLine, beatLines, isFirst }) => {
        const lines = beatLines.length > 0 ? [execLine, ...beatLines] : [execLine];
        toast?.push(isFirst ? 'legendary' : 'beat', lines);
      }),
    );

    await game.start();
    if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
  });

  onDestroy(() => {
    unsub?.();
    for (const u of busUnsubs) u();
    if (compressPulseTimer) clearTimeout(compressPulseTimer);
    rmUnsub?.();
    bgResizeObserver?.disconnect();
    glowResizeObserver?.disconnect();
    if (onWindowResize) window.removeEventListener('resize', onWindowResize);
    renderer?.dispose();
    game?.dispose();
  });

  // --- 캔버스 렌더 와이어링(m2-render-plan v0.2) -------------------------------------
  /** 렌더러 생성(배경 캔버스 기준). 글로우 캔버스는 합류 시 재생성. getContext 성공 시 canvasReady. */
  function setupRenderer(): void {
    if (!bgCanvas) return;
    renderer = new CanvasRenderer({
      bgCanvas,
      glowCanvas, // 압축 탭이 아니면 null — 이후 attach에서 재생성
      rootEl: document.documentElement,
    });
    attachedGlowCanvas = glowCanvas; // 초기 바인딩 기록(reactive 재구성 중복 방지)
    canvasReady = renderer.ready;
    renderer.setReducedMotion($reducedMotion);
    // 현재 층 즉시 반영(부팅 슬러그).
    if (snap) {
      lastSlug = snap.layer.slug;
      renderer.onLayerChange(snap.layer.slug);
    }
    // 배경 리사이즈 관찰.
    if (typeof ResizeObserver !== 'undefined') {
      bgResizeObserver?.disconnect();
      bgResizeObserver = new ResizeObserver(() => renderer?.resize());
      bgResizeObserver.observe(bgCanvas);
      // 글로우 캔버스도 마운트 시점에 이미 바인딩돼 있으면(기본 압축 탭) 여기서 관찰 시작.
      //   ★P0-3 가드레일1: 게이지가 반응형(clamp/aspect-ratio)으로 커지면 초기 1회 resize()는
      //    레이아웃 정착 전 작은 값을 잴 수 있다 → 관찰자가 정착 후 백버퍼를 재할당해야 글로우가
      //    확대된 박스에 맞는다. (attachGlowCanvas는 초기 동일참조면 early-return하므로 여기서 보강.)
      glowResizeObserver?.disconnect();
      if (glowCanvas) {
        glowResizeObserver = new ResizeObserver(() => renderer?.resize());
        glowResizeObserver.observe(glowCanvas);
      }
    }
    // window resize 보강(반응형 게이지): 뷰포트 변화 시 ResizeObserver 전달이 지연돼도
    //   백버퍼가 박스를 추적하도록 직접 resize(). 1회 등록(중복 방지).
    if (typeof window !== 'undefined' && !onWindowResize) {
      onWindowResize = () => renderer?.resize();
      window.addEventListener('resize', onWindowResize);
    }
  }

  /** 글로우 캔버스가 바인딩/해제될 때 렌더러를 재구성(게이지 자리 등장·소멸). 참조 변화 시에만. */
  function attachGlowCanvas(el: HTMLCanvasElement | null): void {
    if (!bgCanvas || el === attachedGlowCanvas) return;
    attachedGlowCanvas = el;
    renderer?.dispose();
    renderer = new CanvasRenderer({ bgCanvas, glowCanvas: el, rootEl: document.documentElement });
    canvasReady = renderer.ready;
    renderer.setReducedMotion($reducedMotion);
    if (snap) {
      lastSlug = snap.layer.slug;
      renderer.onLayerChange(snap.layer.slug);
    }
    if (typeof ResizeObserver !== 'undefined') {
      glowResizeObserver?.disconnect();
      if (el) {
        glowResizeObserver = new ResizeObserver(() => renderer?.resize());
        glowResizeObserver.observe(el);
      }
    }
  }

  /** snapshot → 렌더러 입력(읽기 전용 파생만). 층 변화 감지 + draw. */
  function pushRender(s: GameSnapshot): void {
    if (!renderer) return;
    if (s.layer.slug !== lastSlug) {
      lastSlug = s.layer.slug;
      // 색 캐시 재읽기 전 :root data-layer를 동기 갱신(reactive 블록보다 먼저 — 구 색 읽기 방지).
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-layer', s.layer.slug);
      }
      renderer.onLayerChange(s.layer.slug);
    }
    renderer.setSnapshot({
      dec: s.dec,
      rateCPositive: s.rateCPositive,
      rateCLog10: s.rateCLog10,
      layer: { slug: s.layer.slug },
      phaseState: s.phase.active ? s.phase.state : '',
    });
    renderer.draw();
  }

  // 글로우 캔버스 바인딩 변화 감지(압축 탭 진입/이탈 → 게이지 캔버스 등장/소멸).
  $: if (renderer && glowCanvas !== undefined) attachGlowCanvas(glowCanvas);

  // 수동 압축 주스(DESIGN §5): 클릭 시 글로우 버스트 1회(+2px/200ms). scale는 button:active로.
  let compressPulse = false;
  let compressPulseTimer: ReturnType<typeof setTimeout> | null = null;
  function onCompress() {
    game?.manualCompress();
    compressPulse = true;
    if (compressPulseTimer) clearTimeout(compressPulseTimer);
    compressPulseTimer = setTimeout(() => (compressPulse = false), 200);
  }
  function onResonanceClick() {
    game?.clickResonance();
  }
  // 위상 겹침(프리온층, M1.6): 상태 고정(E 소모) / 해제(무료).
  function onPhasePin(state: PhaseState) {
    game?.pinPhase(state);
  }
  function onPhaseUnpin() {
    game?.unpinPhase();
  }
  function onBuy(tier: number, mode: BuyMode) {
    game?.buy(tier, mode);
  }
  // 연구 노드 구매(M1.7): D 소비 → 체인 티어 배율 효과(C안).
  function onBuyResearch(nodeId: string) {
    game?.buyResearch(nodeId);
  }
  // 오프라인 모달 확인(M1.7): 모달 소거.
  function onDismissOffline() {
    game?.dismissOffline();
  }
  async function onSave() {
    await game?.persist();
  }
  // 상전이 실행(M1.5): QF 획득·리셋·부스트 + 메인 복귀(새 미지 서브층 런 시작).
  function onPrestige() {
    const result = game?.executePrestige();
    if (result) tab = 'compress'; // 실행 성공 → 압축 메인으로(새 층).
  }
  function onPrestigeContinue() {
    tab = 'compress'; // "압축 계속" — 더 큰 QF 위해 더 압축(상전이 탭 점등 유지).
  }

  // r 게이지 중심 글로우 반경: dec 클수록 확대(3→14px, DESIGN glow.core).
  $: glowRadius = snap ? Math.min(14, 3 + snap.dec * 0.42) : 3;
  // 층 토큰을 :root(documentElement)에도 반영 → body 배경(--layer-bg) + 캔버스 색 캐시(getComputedStyle)
  //   가 현재 층 값으로 갱신된다(tokens.css [data-layer]는 미스코프 속성 셀렉터 — :root에도 매칭).
  //   dev forceLayer는 직접 documentElement를 세팅하므로 snap 미존재 시엔 건드리지 않음.
  $: if (typeof document !== 'undefined' && snap) {
    document.documentElement.setAttribute('data-layer', snap.layer.slug);
  }
  // 도감 탭은 첫 발견 후 등장(FTUE). 발견 시 압축 탭에 배지.
  $: showCodexTab = snap?.ftue.showCodexTab ?? false;
  $: codexCount = snap?.codex.collected ?? 0;
  // 연구 탭은 첫 D 획득 + 원자층 후 등장(FTUE, M1.7).
  $: showResearchTab = snap?.ftue.showResearchTab ?? false;
  // 연구 탭이 사라졌는데 머물러 있으면 압축 메인으로 폴백(방어).
  $: if (!showResearchTab && tab === 'research') tab = 'compress';
  // 상전이 탭(M1.5): 미지 6벽 도달 시만 점등(알려진 물리 비점등, ui-flow §1-C·GDD §15).
  $: showPrestigeTab = snap?.prestige.available ?? false;
  $: prestigeFirst = (snap?.prestige.available && snap?.prestige.isFirst) ?? false;
  // 상전이 탭이 사라졌는데 그 탭에 머물러 있으면 압축 메인으로 폴백(점등 해소·로드 직후 방어).
  $: if (!showPrestigeTab && tab === 'prestige') tab = 'compress';

  // decade 진행 바(ux §P1-3): 정규화 진행도·양끝 라벨은 snapshot 읽기전용 파생(game.ts deriveDecadeProgress).
  //   현재 층 enterDec→다음 층 enterDec 구간(known층 decadeRange 단일점 문제 회피). 로직 불변.
  $: decProgress = snap?.layer.decadeProgress ?? 0;
  $: decStart = snap?.layer.decadeBarRange[0] ?? 0;
  $: decEnd = snap?.layer.decadeBarRange[1] ?? 1;
  // 진행 바 세그먼트(5칸, 계측 톤). 채워진 칸 수(최소 진행 시 1칸 — "시작했다" 신호).
  const DEC_SEGMENTS = 5;
  $: decFilled = decProgress > 0 ? Math.max(1, Math.round(decProgress * DEC_SEGMENTS)) : 0;
</script>

<Toast bind:this={toast} />

<!-- 배경 fx 캔버스(m2-render-plan §2-4): <main> 뒤 전역 레이어. 헤이즈+앰비언트 파티클.
     z-index:-1·pointer-events:none — 콘텐츠 박스 뒤·여백에서만 비침(art z-스택 결정). -->
<canvas class="bg-fx" bind:this={bgCanvas} aria-hidden="true"></canvas>

<!-- 오프라인 복귀 모달(M1.7, ui-flow §10). 로드 시 elapsed>60s면 표시. -->
{#if snap?.offline}
  <OfflineModal offline={snap.offline} onDismiss={onDismissOffline} />
{/if}

<main data-layer={snap?.layer.slug ?? 'mol'}>
  <!-- 상단 상태바(visual §4-D / ux §P1-6): 소형 로고 + 탭 + 측정 컨텍스트(층·dec). -->
  <header class="topbar">
    <span class="logo">Micro Idle</span>

    {#if snap}
      <!-- 탭바: 데스크톱 상단 / 모바일 하단 고정(CSS). 압축 / 연구 / 도감 / 상전이(점진 등장). -->
      <nav class="tabs" aria-label="화면">
        <button class="tab" class:active={tab === 'compress'} on:click={() => (tab = 'compress')}
          >압축</button>
        {#if showResearchTab}
          <button class="tab" class:active={tab === 'research'} on:click={() => (tab = 'research')}
            >연구</button>
        {/if}
        {#if showCodexTab}
          <button class="tab" class:active={tab === 'codex'} on:click={() => (tab = 'codex')}>
            도감{#if codexCount > 0}<span class="tab-badge">{codexCount}</span>{/if}
          </button>
        {/if}
        {#if showPrestigeTab}
          <button
            class="tab tab-prestige"
            class:active={tab === 'prestige'}
            class:first-glow={prestigeFirst}
            on:click={() => (tab = 'prestige')}>
            {prestigeFirst ? '미지 진입' : '상전이'}<span class="pt-dot" class:on={prestigeFirst}
              ><Icon name="phase" size={11} label="상전이 준비" /></span>
          </button>
        {/if}
      </nav>

      <!-- 헤드라인 수치 상주(P0-5, AD/Paperclips 원칙): 어느 탭에 가도 r·층·dec가 보인다.
           상태바 우측 = 측정 컨텍스트. r 값을 헤드라인급으로, 층·dec를 컨텍스트로. -->
      <span class="ctx">
        <span class="ctx-head">
          <span class="ctx-head-label">r</span>
          <span class="ctx-head-val">{formatRadius(snap.r)}</span>
        </span>
        <span class="ctx-meta">
          <span class="ctx-layer">{snap.layer.nameKo}</span>
          <span class="ctx-sep" aria-hidden="true">·</span>
          <span class="ctx-dec"><span class="ctx-dec-label">dec</span> {snap.dec.toFixed(2)}</span>
        </span>
      </span>

      <!-- 저장: 상단바 아이콘으로 축소(P0-4 — 우측 패널 하단 콘텐츠에 자리 양보). -->
      <button class="btn-save-icon" on:click={onSave} title="저장" aria-label="저장">
        <Icon name="save" size={15} />
      </button>
    {/if}
  </header>

  {#if snap}
    <!-- 반응형 3패널 셸(ux §2-2): LEFT 자원상주 / CENTER 탭콘텐츠 / RIGHT 메커니즘·층. -->
    <div class="shell">
      <!-- ───── LEFT: 자원 원장(모든 탭 상주, P0-1: 카드→원장 행) ─────
           Kittens/Exponential식 컴팩트 원장 — 카드 테두리·그림자 제거, 얇은 구분선만.
           행: [아이콘] 기호·이름 … 값 / +생산율. "위젯 4개"가 아니라 "계기 원장 하나". -->
      <aside class="panel-left">
        <section class="ledger" aria-label="자원">
          <div class="lg-row lg-depth">
            <span class="lg-icon"><Icon name="depth" size={15} /></span>
            <span class="lg-name">압축 깊이 <b>C</b></span>
            <span class="lg-val">{formatNumber(snap.C)}</span>
            <span class="lg-rate"
              >{#if snap.rateC.gt(0)}+{formatNumber(snap.rateC, 2)}<span class="u">/s</span>{/if}</span>
          </div>
          <div class="lg-row lg-energy">
            <span class="lg-icon"><Icon name="energy" size={15} /></span>
            <span class="lg-name">압축 에너지 <b>E</b></span>
            <span class="lg-val">{formatNumber(snap.E)}</span>
            <span class="lg-rate"
              >{#if snap.rateC.gt(0)}+{formatNumber(snap.rateC, 2)}<span class="u">/s</span>{/if}</span>
          </div>
          {#if snap.ftue.showResourceD}
            <div class="lg-row lg-data">
              <span class="lg-icon"><Icon name="data" size={15} /></span>
              <span class="lg-name">발견 데이터 <b>D</b></span>
              <span class="lg-val">{formatNumber(snap.D)}</span>
              <span class="lg-rate dim">공명 산출</span>
            </div>
          {/if}
          {#if snap.QF.gt(0)}
            <div class="lg-row lg-qf">
              <span class="lg-icon"><Icon name="qf" size={15} /></span>
              <span class="lg-name">양자 거품 <b>QF</b></span>
              <span class="lg-val">{formatNumber(snap.QF)}</span>
              <span class="lg-rate dim">영구 보존</span>
            </div>
          {/if}
          <!-- 배율: 원장에 자연 연결되는 마무리 행(구분선 위, 강조 톤). -->
          <div class="lg-row lg-mult">
            <span class="lg-icon"><Icon name="mult" size={15} /></span>
            <span class="lg-name">생산 배율</span>
            <span class="lg-val mult">×{formatNumber(snap.mult, 3)}</span>
            <span class="lg-rate"></span>
          </div>
        </section>

        <footer class="status">
          <span>{loadLabel[snap.loadKind]}</span>
          <span class="dim">· 누적 틱 {snap.totalTicks.toLocaleString()}</span>
        </footer>
      </aside>

      <!-- ───── CENTER: 탭 콘텐츠(압축=게이지·체인 / 그 외=뷰 교체) ───── -->
      <section class="panel-center">
        {#if tab === 'compress'}
          <!-- r 게이지: "작아짐=강해짐". r은 작아지고 dec/숫자는 커진다. (P0-3: 포컬로 확대)
               게이지를 중앙 컬럼 폭의 70~80%까지 키우고, 좌우 2열 미니 리드아웃을 박아 "계기 패널"화.
               ★가드레일1: 글로우 캔버스는 core-wrap을 100% 채우므로 wrap 확대 시 ResizeObserver→resize()로
                백버퍼 재할당, rFrame=min(cx,cy)-margin이 자동으로 커진다(렌더러 코드 불변). -->
          <section class="gauge">
            <div class="gauge-stage">
              <!-- 좌 리드아웃(Exponential식): C 값 / 생산율. -->
              <div class="readout-col left">
                <div class="ro">
                  <span class="ro-lbl">C</span>
                  <span class="ro-val">{formatNumber(snap.C)}</span>
                  <span class="ro-sub"
                    >{#if snap.rateC.gt(0)}+{formatNumber(snap.rateC, 2)}/s{:else}—{/if}</span>
                </div>
              </div>

              <!-- 게이지 본체+글로우 캔버스(m2-render-plan V2-1). 준비 전엔 DOM 점 폴백. -->
              <div class="gauge-core-wrap">
                <canvas class="gauge-glow" bind:this={glowCanvas} aria-hidden="true"></canvas>
                <div class="r-core" class:hidden={canvasReady} style="--r-glow: {glowRadius}px"></div>
              </div>

              <!-- 우 리드아웃: 배율 / dec. -->
              <div class="readout-col right">
                <div class="ro">
                  <span class="ro-lbl">배율</span>
                  <span class="ro-val">×{formatNumber(snap.mult, 3)}</span>
                  <span class="ro-sub">dec {snap.dec.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <!-- r 값(게이지 직하, 화면 최대 수치 num-display). -->
            <div class="r-readout">
              <span class="r-label">반경 r</span>
              <span class="r-value">{formatRadius(snap.r)}</span>
            </div>

            <!-- decade 진행 바(ux §P1-3): dec N ──[■■■□□]── dec N+1. 층 내 진행감. -->
            <div class="dec-bar" aria-label="decade 진행" role="progressbar"
                 aria-valuenow={Math.round(decProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span class="dec-end">dec {decStart}</span>
              <span class="dec-track">
                {#each Array(DEC_SEGMENTS) as _, i}
                  <span class="dec-seg" class:fill={i < decFilled}></span>
                {/each}
              </span>
              <span class="dec-end">dec {decEnd}</span>
            </div>
            <div class="dec-readout">
              <span class="dec-label">dec</span>
              <span class="dec-value">{snap.dec.toFixed(3)}</span>
            </div>
          </section>

          <!-- [압축] 버튼을 게이지 직하로(ux §P1-1: 게이지→버튼 동선 단축, 자원 위). -->
          <section class="actions">
            <button class="btn-compress" class:pulse={compressPulse} on:click={onCompress}>
              <Icon name="compress" size={16} /> 압축
            </button>
          </section>

          {#if snap.ftue.hint}
            <p class="ftue-hint">{snap.ftue.hint}</p>
          {/if}

          <!-- 모바일에서만: 메커니즘 위젯·층 카드를 체인 앞에 인라인(데스크톱은 RIGHT 패널). -->
          <div class="mech-inline">
            <LayerCard layer={snap.layer} showMechanism={snap.ftue.showMechanismSlot} />
            <ResonanceWidget resonance={snap.resonance} onClick={onResonanceClick} />
            <PhaseWidget phase={snap.phase} onPin={onPhasePin} onUnpin={onPhaseUnpin} />
            <HarmonicsWidget harmonics={snap.harmonics} />
          </div>

          {#if snap.ftue.showChain}
            <ChainTable tiers={snap.tiers} {onBuy} />
          {/if}

          <!-- 모바일에서만: 우측 패널 상태 요약(도감·연구·상전이 힌트)을 체인 아래 인라인.
               데스크톱은 RIGHT 패널이 담당(.status-inline 숨김 — 중복 방지). -->
          <div class="status-inline">
            <RightPanelStatus
              codex={snap.codex}
              research={snap.research}
              prestige={snap.prestige}
              showCodex={showCodexTab} />
          </div>
        {:else if tab === 'research'}
          <ResearchView research={snap.research} dCurrent={snap.D} onBuy={onBuyResearch} />
        {:else if tab === 'codex'}
          <CodexView codex={snap.codex} />
        {:else if tab === 'prestige'}
          <PrestigeView
            prestige={snap.prestige}
            onPrestige={onPrestige}
            onContinue={onPrestigeContinue} />
        {/if}
      </section>

      <!-- ───── RIGHT: 메커니즘 + 층 컨텍스트 + 상태 요약(데스크톱 상주) ─────
           P0-4(D3 해결): 빈 하단을 ui-flow §2-A 콘텐츠로 채움 — 층카드·메커니즘 아래에
           도감 미니진행·연구 1줄·상전이 힌트·"더 작은 것이 있다." 앵커. 저장은 상단바 아이콘으로 이전. -->
      <aside class="panel-right">
        <LayerCard layer={snap.layer} showMechanism={snap.ftue.showMechanismSlot} />
        <!-- 메커니즘 위젯(층마다 다름, ui-flow §2-E). active=false면 위젯 자체가 숨음. -->
        <ResonanceWidget resonance={snap.resonance} onClick={onResonanceClick} />
        <PhaseWidget phase={snap.phase} onPin={onPhasePin} onUnpin={onPhaseUnpin} />
        <HarmonicsWidget harmonics={snap.harmonics} />
        <!-- 하단 콘텐츠 — 빈 공간 해소(D3). -->
        <RightPanelStatus
          codex={snap.codex}
          research={snap.research}
          prestige={snap.prestige}
          showCodex={showCodexTab} />
      </aside>
    </div>
  {:else}
    <p class="booting">초기화 중…</p>
  {/if}
</main>

<style>
  /* 페이지 딥다크 베이스(art z-스택 §10-3: main 딥다크 솔리드 유지를 페이지 base로 구현).
     층 배경 틴트(--layer-bg)를 body에 두고, main은 투명 → 배경 fx 캔버스(z-1)가 그 위로 비친다.
     헤이즈는 카드(--canvas-layer 자체 배경) 뒤·여백에서만 보임 → 가독성 보호. */
  :global(body) {
    margin: 0;
    background: var(--layer-bg, var(--canvas));
    transition: background var(--motion-layer-bg-fade) ease-out;
  }

  /* 배경 fx 캔버스(m2-render-plan §2-4): <main> 뒤 전역. 헤이즈·앰비언트 파티클(투명 base 위). */
  .bg-fx {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    pointer-events: none;
    display: block;
  }

  /* 다크 베이스는 body가 공급(위). main은 투명 — 배경 fx가 비치게. */
  main {
    min-height: 100vh;
    position: relative; /* 콘텐츠는 배경 fx(z-1) 위 */
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    /* 층 배경 틴트(layer-bg) — data-layer가 교체. 전환은 부드럽게. */
    background: var(--layer-bg, var(--canvas));
    color: var(--foreground);
    font-family: var(--font-label);
    transition: background var(--motion-layer-bg-fade) ease-out;
  }

  /* ───── 상단 상태바(visual §4-D) ───── */
  .topbar {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--canvas-layer) 60%, transparent);
  }
  /* 로고: sans 500 + 자간(visual §2-B: mono 빼서 코드처럼 안 보이게). */
  .logo {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    font-weight: 500;
    letter-spacing: 0.06em;
    color: var(--foreground-sub);
    white-space: nowrap;
  }
  /* 헤드라인 수치 상주(P0-5): r 값(헤드라인급) 위 + 층·dec(컨텍스트) 아래, 우측 정렬 2단. */
  .ctx {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    white-space: nowrap;
    line-height: 1.15;
  }
  .ctx-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-xs);
  }
  .ctx-head-label {
    font-size: var(--text-label-xs);
    color: var(--foreground-sub);
    letter-spacing: 0.08em;
  }
  .ctx-head-val {
    font-family: var(--font-numeric);
    font-size: var(--text-num-lg);
    font-weight: 500;
    color: var(--primary);
  }
  .ctx-meta {
    display: flex;
    align-items: baseline;
    gap: var(--space-xs);
  }
  .ctx-layer {
    font-size: var(--text-label-sm);
    color: var(--layer-accent);
    font-family: var(--font-narrative);
    letter-spacing: 0.03em;
    transition: color var(--motion-layer-accent-shift) ease-out;
  }
  .ctx-sep {
    color: var(--foreground-dim);
  }
  .ctx-dec {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--foreground-sub);
  }
  .ctx-dec-label {
    font-size: var(--text-label-xs);
    color: var(--foreground-sub);
    letter-spacing: 0.08em;
  }
  /* 저장 아이콘 버튼(상단바, P0-4). 작은 정사각 — 콘텐츠는 우측 패널로. */
  .btn-save-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    margin-left: var(--space-sm);
    color: var(--foreground-sub);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
    cursor: pointer;
    transition:
      color var(--motion-fade-cross) ease-out,
      border-color var(--motion-fade-cross) ease-out;
  }
  .btn-save-icon:hover {
    color: var(--foreground);
    border-color: var(--foreground-sub);
  }
  .btn-save-icon:active {
    transform: scale(var(--motion-click-scale));
  }

  /* ───── 탭바 ───── */
  .tabs {
    display: flex;
    gap: var(--space-xs);
  }
  .tab {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    font-weight: 500;
    color: var(--foreground-sub);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .tab.active {
    color: var(--layer-accent);
    border-bottom-color: var(--layer-accent);
  }
  .tab-badge {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--canvas);
    background: var(--data);
    border-radius: var(--rounded-full);
    padding: 0 5px;
    min-width: 16px;
    text-align: center;
  }

  /* 상전이 탭 점등 도트(ui-flow §1-C): QF 녹 위상 아이콘. 첫 상전이는 글로우 펄스(1.5s). */
  .tab-prestige .pt-dot {
    color: var(--qf);
    margin-left: 4px;
    display: inline-flex;
    align-items: center;
  }
  .tab-prestige.first-glow {
    color: var(--qf);
  }
  .tab-prestige.first-glow .pt-dot.on {
    animation: pt-glow 1.5s ease-in-out infinite;
    border-radius: var(--rounded-full);
  }
  @keyframes pt-glow {
    0%,
    100% {
      opacity: 0.5;
      filter: drop-shadow(0 0 0 transparent);
    }
    50% {
      opacity: 1;
      filter: drop-shadow(0 0 4px var(--qf));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tab-prestige.first-glow .pt-dot.on {
      animation: none;
      opacity: 1;
    }
  }

  /* ═════ 반응형 셸 그리드(ux §2-2~2-4) ═════
     기본(모바일 <720): 1컬럼. CENTER 먼저, LEFT(자원) 다음, RIGHT는 압축 본문에 인라인(아래서 숨김). */
  .shell {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-areas:
      'center'
      'left';
    gap: var(--space-md);
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-md) var(--space-md) var(--space-xxl);
  }
  .panel-left {
    grid-area: left;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    min-width: 0;
  }
  .panel-center {
    grid-area: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    min-width: 0;
  }
  .panel-right {
    grid-area: right;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    min-width: 0;
  }
  /* 패널 직속 자식이 고정폭 트랙(200/240px)을 넘지 않게 — flex min-width:auto 오버플로 차단.
     (panel-right 자식은 전부 Svelte 컴포넌트(자체 width:100%/max-width 보유) → 별도 가드 불필요.) */
  .panel-left > *,
  .panel-center > * {
    min-width: 0;
    max-width: 100%;
  }
  /* 모바일: RIGHT 패널(데스크톱 메커니즘 상주) 숨김 — 대신 압축 본문 .mech-inline 사용. */
  .panel-right {
    display: none;
  }
  .mech-inline {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    width: 100%;
  }
  /* 모바일: 우측 패널 상태 요약을 압축 본문에 인라인(데스크톱은 RIGHT가 담당, 아래서 숨김). */
  .status-inline {
    display: block;
    width: 100%;
  }

  /* 중간(720–1079, ux §2-4): 2컬럼 — CENTER + RIGHT. 자원(LEFT)은 CENTER 위로(자리 절약). */
  @media (min-width: 720px) {
    .shell {
      grid-template-columns: minmax(0, 1fr) 240px;
      grid-template-areas:
        'left   right'
        'center right';
      padding: var(--space-lg) var(--space-lg) var(--space-xxl);
    }
    .panel-left {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-start;
    }
    .panel-left .ledger {
      flex: 1;
      min-width: 240px;
    }
    .panel-left .status {
      flex-basis: 100%;
    }
    .panel-right {
      display: flex;
    }
    /* 메커니즘은 RIGHT로 — 압축 본문 인라인 숨김(중복 방지). */
    .mech-inline {
      display: none;
    }
    /* 상태 요약 인라인도 숨김 — RIGHT 패널이 담당(중복 방지). */
    .status-inline {
      display: none;
    }
  }

  /* 데스크톱(>=1080, ux §2-2): 3패널 LEFT/CENTER/RIGHT. CENTER 최대폭 캡은 셸이 1회. */
  @media (min-width: 1080px) {
    .shell {
      grid-template-columns: 200px minmax(0, 1fr) 240px;
      grid-template-areas: 'left center right';
      gap: var(--space-lg);
      max-width: 1280px;
      margin: 0 auto;
    }
    .panel-left {
      flex-direction: column;
      flex-wrap: nowrap; /* mid-mode wrap 해제 — column+wrap+고정높이면 status가 2번째 컬럼으로 새는 버그 */
      align-items: stretch;
    }
    /* 데스크톱: 자원 원장은 자연 높이로 상단 정렬(mid-mode flex:1 그로우 해제). */
    .panel-left .ledger {
      min-width: 0;
      flex: 0 0 auto;
    }
    /* CENTER 콘텐츠 과확산 방지(초광폭에서 게이지·체인이 너무 안 퍼지게). */
    .panel-center {
      max-width: 720px;
      width: 100%;
      margin: 0 auto;
    }
  }

  /* ───── r 게이지(P0-3: 포컬로 확대) ───── */
  .gauge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-sm) var(--space-sm);
    width: 100%;
  }
  /* 게이지 무대: 좌 리드아웃 · 큰 게이지 · 우 리드아웃 한 행. 게이지가 가용 폭 대부분 점유. */
  .gauge-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    width: 100%;
  }
  /* 게이지 캔버스 래퍼: 본체+글로우 캔버스가 점유하는 정사각 영역.
     ★P0-3: 고정 132px → 무대 폭의 ~72%(중앙 컬럼 가용폭 70~80%), 정사각, 상·하한 클램프.
     ★가드레일1: 글로우 캔버스는 inset:0/100%로 이 박스를 가득 채우므로, 박스가 커지면
      ResizeObserver→CanvasRenderer.resize()가 백버퍼를 새 크기로 재할당하고
      rFrame=min(cx,cy)-margin이 자동 확대된다(렌더러 코드 불변 — 글로우·동심원·dec호 동반 확대). */
  .gauge-core-wrap {
    position: relative;
    flex: 0 0 auto;
    /* 게이지 직경 = 무대(≈중앙 컬럼) 가용폭의 ~50%(응집 우선 — 게이지+압축+체인을 한 화면에).
       하한 180(모바일 가독), 상한 300(체인을 폴드 안으로). aspect-ratio로 정사각 유지. */
    width: clamp(180px, 50%, 300px);
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .gauge-glow {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
  }
  /* 좌우 미니 리드아웃(Exponential식 계기 패널). 게이지 양옆, 좁게. */
  .readout-col {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
  }
  .readout-col.left {
    justify-content: flex-end;
    text-align: right;
  }
  .readout-col.right {
    justify-content: flex-start;
    text-align: left;
  }
  .ro {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .ro-lbl {
    font-family: var(--font-label);
    font-size: var(--text-label-xs);
    color: var(--foreground-sub);
    letter-spacing: 0.06em;
  }
  .ro-val {
    font-family: var(--font-numeric);
    font-size: var(--text-num-lg);
    font-weight: 500;
    color: var(--foreground);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ro-sub {
    font-family: var(--font-numeric);
    font-size: var(--text-label-xs);
    color: var(--foreground-sub);
    white-space: nowrap;
  }
  .r-core {
    width: 16px;
    height: 16px;
    border-radius: var(--rounded-full);
    background: var(--layer-accent);
    box-shadow: 0 0 var(--r-glow, 8px) var(--layer-glow, var(--col-glow-core));
    transition:
      box-shadow var(--motion-click-glow) ease-out,
      background var(--motion-layer-accent-shift) ease-out,
      opacity var(--motion-fade-cross) ease-out;
  }
  .r-core.hidden {
    opacity: 0;
  }
  /* r readout — r 값이 화면 최대 수치(num-display 34/500, visual §2-B). */
  .r-readout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-family: var(--font-numeric);
  }
  .r-label {
    color: var(--foreground-sub);
    font-size: var(--text-label-xs);
    letter-spacing: 0.08em;
  }
  .r-value {
    color: var(--primary);
    font-size: var(--text-num-display);
    font-weight: 500;
    line-height: 1.1;
  }

  /* decade 진행 바(ux §P1-3) — 게이지 직하. dec N ──[■■■□□]── dec N+1. */
  .dec-bar {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    max-width: 280px;
    margin-top: var(--space-xs);
  }
  .dec-end {
    font-family: var(--font-numeric);
    font-size: var(--text-label-xs);
    color: var(--foreground-sub);
    white-space: nowrap;
  }
  .dec-track {
    flex: 1;
    display: flex;
    gap: 3px;
  }
  .dec-seg {
    flex: 1;
    height: 6px;
    border-radius: var(--rounded-sm);
    background: var(--surface);
    border: 1px solid var(--border);
    transition: background var(--motion-fade-cross) ease-out;
  }
  .dec-seg.fill {
    background: var(--layer-accent);
    border-color: var(--layer-accent);
    box-shadow: 0 0 5px var(--layer-glow, var(--col-glow-core));
  }
  .dec-readout {
    display: flex;
    gap: var(--space-sm);
    align-items: baseline;
    font-family: var(--font-numeric);
  }
  .dec-label {
    color: var(--foreground-sub);
    font-size: var(--text-label-xs);
    letter-spacing: 0.08em;
  }
  .dec-value {
    color: var(--foreground);
    font-size: var(--text-num-md);
  }

  /* ───── 자원 원장(P0-1: 카드→원장 행) ─────
     Kittens/Exponential식 컴팩트 원장 — 카드 박스/그림자 제거, 행 사이 얇은 구분선만.
     하나의 컨테이너(좌측 accent 띠로 현재 층 컨텍스트)에 행을 촘촘히. "계기 원장 하나". */
  .ledger {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: color-mix(in srgb, var(--canvas-layer) 70%, transparent);
    border: 1px solid var(--border);
    border-left: 2px solid color-mix(in srgb, var(--layer-accent) 35%, var(--border));
    border-radius: var(--rounded-md);
    padding: 2px var(--space-sm);
  }
  /* 원장 행: [아이콘] 이름(가변) … 값(우정렬) / +율. 얇은 구분선(마지막 제외). */
  .lg-row {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    grid-template-areas:
      'icon name val'
      'icon name rate';
    align-items: center;
    column-gap: var(--space-sm);
    row-gap: 0;
    padding: var(--space-xs) 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  }
  .lg-row:last-child {
    border-bottom: none;
  }
  .lg-icon {
    grid-area: icon;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* 이름 — 작게 저채도. 기호(b)는 강조. 넘치면 말줄임. */
  .lg-name {
    grid-area: name;
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    align-self: center;
  }
  .lg-name b {
    color: var(--foreground);
    font-weight: 600;
  }
  /* 값 — 우측, num-lg(원장 밀도에 맞춰 xl→lg). 값이 이름을 압도하되 컴팩트. tnum. */
  .lg-val {
    grid-area: val;
    justify-self: end;
    font-family: var(--font-numeric);
    font-size: var(--text-num-lg);
    font-weight: 500;
    color: var(--foreground);
    line-height: 1.1;
  }
  .lg-val.mult {
    color: var(--layer-accent);
  }
  /* 생산율 — 값 아래 우측, 작게. 0이면 비어 레이아웃 유지. */
  .lg-rate {
    grid-area: rate;
    justify-self: end;
    font-family: var(--font-numeric);
    font-size: var(--text-label-xs);
    color: var(--foreground-sub);
    min-height: 12px;
    line-height: 1;
  }
  .lg-rate .u {
    color: var(--foreground-dim);
  }
  .lg-rate.dim {
    color: var(--foreground-dim);
  }
  .lg-depth .lg-icon {
    color: var(--depth);
  }
  .lg-energy .lg-icon {
    color: var(--energy);
  }
  .lg-data .lg-icon {
    color: var(--data);
  }
  .lg-qf .lg-icon {
    color: var(--qf);
  }
  .lg-mult .lg-icon {
    color: var(--foreground-sub);
  }

  /* ───── 액션 ───── */
  .actions {
    display: flex;
    gap: var(--space-base);
    width: 100%;
    justify-content: center;
  }
  .btn-compress {
    font-family: var(--font-label);
    font-weight: 500;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
    padding: 12px 24px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-xs);
    border-color: var(--layer-accent);
    color: var(--layer-accent);
    min-width: 160px;
    min-height: 48px;
    font-size: var(--text-label-lg);
    /* 클릭 글로우 버스트(DESIGN §5: +2px/200ms). pulse 클래스가 켜질 때만. */
    box-shadow: 0 0 0 transparent;
    transition:
      transform var(--motion-click-duration) ease-out,
      box-shadow var(--motion-click-glow) ease-out;
  }
  .btn-compress:active {
    transform: scale(var(--motion-click-scale));
  }
  .btn-compress.pulse {
    box-shadow: 0 0 8px var(--layer-glow, var(--col-glow-core));
  }

  .ftue-hint {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.8;
    text-align: center;
    max-width: 460px;
  }

  /* ───── 상태 footer(LEFT 하단 상주) ───── */
  .status {
    text-align: center;
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
    font-family: var(--font-narrative);
  }
  .dim {
    color: var(--foreground-dim);
  }
  .booting {
    color: var(--foreground-sub);
    font-family: var(--font-narrative);
    text-align: center;
    padding: var(--space-xxl);
  }

  /* ═════ 모바일 하단 탭바(ux §P0-4): <720px에서 탭바를 하단 고정(thumb zone). ═════
     데스크톱은 상단 상태바 안 유지. 모바일은 상태바에서 탭을 떼 화면 하단에 고정. */
  @media (max-width: 719px) {
    .tabs {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      justify-content: space-around;
      gap: 0;
      background: color-mix(in srgb, var(--canvas-layer) 96%, transparent);
      border-top: 1px solid var(--border);
      padding: 0 var(--space-xs);
      backdrop-filter: blur(8px);
    }
    .tab {
      flex: 1;
      justify-content: center;
      min-height: 48px;
      border-bottom: none;
      border-top: 2px solid transparent;
    }
    .tab.active {
      border-bottom: none;
      border-top-color: var(--layer-accent);
    }
    /* 하단 탭바가 콘텐츠 마지막을 가리지 않게 셸 하단 여백 확보. */
    .shell {
      padding-bottom: calc(48px + var(--space-lg));
    }
    /* 상태바: 탭이 빠졌으므로 로고 + 컨텍스트 + 저장 아이콘. */
    .topbar {
      justify-content: space-between;
    }
    /* 좁은 화면에서 로고가 헤드라인 수치 자리를 뺏지 않게 축소(헤드라인 r 우선). */
    .logo {
      font-size: var(--text-label-sm);
    }
    /* 게이지 좌우 미니 리드아웃은 모바일에서 숨김(폭 부족 — C는 좌측 원장, dec는 게이지 직하에 이미 있음).
       게이지는 단일 컬럼 폭을 더 써서 포컬 유지(study P0-3, 모바일 단일 컬럼에서도 큰 게이지). */
    .readout-col {
      display: none;
    }
    .gauge-core-wrap {
      width: clamp(170px, 70vw, 300px);
    }
  }
</style>
