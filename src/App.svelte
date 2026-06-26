<script lang="ts">
  /**
   * App.svelte — 메인 셸 (M1.3: 압축 + 도감 탭 + 층 진입 + FTUE 점진 공개). (ui-flow §2·§4·§7)
   *  - 탭바: 압축 / 도감(첫 발견 후 등장). FTUE에 따라 점진 노출(정보 과부하 관리).
   *  - data-layer: 현재 층 slug → DESIGN 팔레트 토큰 전환(분자 황록 → … → 쿼크 백색).
   *  - 층 카드(우측): 현재 층 이름·dec 범위·메커니즘 이름(M1.4 풀 구현).
   *  - 토스트: 입자 발견 + 층 진입 비트(narrative §4) — 이벤트 버스 구독.
   *  - 표시 전용(읽기 전용 스냅샷 구독, §4.1 단방향).
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
  import OfflineModal from './ui/OfflineModal.svelte';
  import Toast from './ui/Toast.svelte';
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
  <header>
    <h1>Micro Idle</h1>
    {#if snap}
      <span class="layer-tag">{snap.layer.nameKo} · dec {snap.dec.toFixed(2)}</span>
    {/if}
  </header>

  {#if snap}
    <!-- 탭바: 압축 / 도감(점진 등장) -->
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
          {prestigeFirst ? '미지 진입' : '상전이'}<span class="pt-dot" aria-hidden="true">●</span>
        </button>
      {/if}
    </nav>

    {#if tab === 'compress'}
      <!-- r 게이지: "작아짐=강해짐". r은 작아지고 dec/숫자는 커진다. -->
      <section class="gauge">
        <!-- 게이지 본체+글로우는 캔버스(m2-render-plan V2-1). 캔버스 준비 전엔 DOM 점 폴백. -->
        <div class="gauge-core-wrap">
          <canvas class="gauge-glow" bind:this={glowCanvas} aria-hidden="true"></canvas>
          <div class="r-core" class:hidden={canvasReady} style="--r-glow: {glowRadius}px"></div>
        </div>
        <div class="r-readout">
          <span class="r-label">반경 r</span>
          <span class="r-value">{formatRadius(snap.r)}</span>
        </div>
        <div class="dec-readout">
          <span class="dec-label">dec</span>
          <span class="dec-value">{snap.dec.toFixed(3)}</span>
        </div>
      </section>

      <!-- 현재 층 카드(우측 패널 역할 — 모바일 단일 컬럼에선 게이지 아래) -->
      <LayerCard layer={snap.layer} showMechanism={snap.ftue.showMechanismSlot} />

      <!-- 메커니즘 위젯(층마다 다름, ui-flow §2-E). active=false면 위젯 자체가 숨음. -->
      <!-- 원자~쿼크: 오비탈 공명(M1.4). -->
      <ResonanceWidget resonance={snap.resonance} onClick={onResonanceClick} />
      <!-- 프리온층: 위상 겹침(M1.6 — 미지 첫 메커니즘). -->
      <PhaseWidget phase={snap.phase} onPin={onPhasePin} onUnpin={onPhaseUnpin} />
      <!-- 끈층: 진동 하모닉스(M1.6). -->
      <HarmonicsWidget harmonics={snap.harmonics} />

      <!-- 자원(전부 Decimal, format으로 표시) -->
      <section class="resources">
        <div class="res res-depth">
          <span class="res-icon">◎</span>
          <span class="res-name">압축 깊이 C</span>
          <span class="res-val">{formatNumber(snap.C)}</span>
          {#if snap.rateC.gt(0)}<span class="res-rate">+{formatNumber(snap.rateC, 2)}/s</span>{/if}
        </div>
        <div class="res res-energy">
          <span class="res-icon">⚡</span>
          <span class="res-name">압축 에너지 E</span>
          <span class="res-val">{formatNumber(snap.E)}</span>
          {#if snap.rateC.gt(0)}<span class="res-rate">+{formatNumber(snap.rateC, 2)}/s</span>{/if}
        </div>
        {#if snap.ftue.showResourceD}
          <div class="res res-data">
            <span class="res-icon">▣</span>
            <span class="res-name">발견 데이터 D</span>
            <span class="res-val">{formatNumber(snap.D)}</span>
            <span class="res-rate dim">공명 산출</span>
          </div>
        {/if}
        {#if snap.QF.gt(0)}
          <div class="res res-qf">
            <span class="res-icon">◆</span>
            <span class="res-name">양자 거품 QF</span>
            <span class="res-val">{formatNumber(snap.QF)}</span>
            <span class="res-rate dim">영구 보존</span>
          </div>
        {/if}
        <div class="res res-mult">
          <span class="res-icon">×</span>
          <span class="res-name">생산 배율</span>
          <span class="res-val">{formatNumber(snap.mult, 3)}</span>
        </div>
      </section>

      <section class="actions">
        <button class="btn-compress" class:pulse={compressPulse} on:click={onCompress}>압축</button>
        <button class="btn-save" on:click={onSave}>저장</button>
      </section>

      {#if snap.ftue.hint}
        <p class="ftue-hint">{snap.ftue.hint}</p>
      {/if}

      {#if snap.ftue.showChain}
        <ChainTable tiers={snap.tiers} {onBuy} />
      {/if}
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

    <footer>
      <span>{loadLabel[snap.loadKind]}</span>
      <span class="dim">· 누적 틱 {snap.totalTicks.toLocaleString()}</span>
      <p class="whisper">더 작은 것이 있다.</p>
    </footer>
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
    align-items: center;
    gap: var(--space-lg);
    padding: var(--space-xl) var(--space-md) var(--space-xxl);
    /* 층 배경 틴트(layer-bg) — data-layer가 교체. 전환은 부드럽게. */
    background: var(--layer-bg, var(--canvas));
    color: var(--foreground);
    font-family: var(--font-label);
    transition: background var(--motion-layer-bg-fade) ease-out;
  }

  header {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  h1 {
    margin: 0;
    font-size: var(--text-num-xl);
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--foreground);
  }
  .layer-tag {
    font-size: var(--text-label-sm);
    color: var(--layer-accent);
    font-family: var(--font-narrative);
    letter-spacing: 0.03em;
    transition: color var(--motion-layer-accent-shift) ease-out;
  }

  /* 탭바 */
  .tabs {
    display: flex;
    gap: var(--space-xs);
    border-bottom: 1px solid var(--border);
    width: 100%;
    max-width: 460px;
    justify-content: center;
  }
  .tab {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
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

  /* 상전이 탭 점등 도트(ui-flow §1-C): ● QF 녹. 첫 상전이는 글로우 펄스(1.5s, ui-flow §8-B). */
  .tab-prestige .pt-dot {
    color: var(--qf);
    margin-left: 4px;
    font-size: 0.7em;
    vertical-align: middle;
  }
  .tab-prestige.first-glow {
    color: var(--qf);
  }
  .tab-prestige.first-glow .pt-dot {
    animation: pt-glow 1.5s ease-in-out infinite;
  }
  @keyframes pt-glow {
    0%,
    100% {
      opacity: 0.5;
      text-shadow: 0 0 2px transparent;
    }
    50% {
      opacity: 1;
      text-shadow: 0 0 8px var(--qf);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tab-prestige.first-glow .pt-dot {
      animation: none;
      opacity: 1;
    }
  }

  /* r 게이지: 중심 글로우(--col-glow-core), dec 커질수록 반경 확대(DESIGN glow.core). */
  .gauge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
  }
  /* 게이지 캔버스 래퍼: 본체+글로우 캔버스가 점유하는 정사각 영역. ux §2-A 원형 게이지 박스. */
  .gauge-core-wrap {
    position: relative;
    width: 132px;
    height: 132px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* 게이지 글로우 캔버스: 래퍼 전체. CSS 크기=백버퍼는 렌더러가 dpr로 스케일. */
  .gauge-glow {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
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
  /* 캔버스 준비(getContext 성공) 시 DOM 점 숨김 — 캔버스 글로우가 대체(폴백은 no-getContext, V2-7 M8). */
  .r-core.hidden {
    opacity: 0;
  }
  .r-readout,
  .dec-readout {
    display: flex;
    gap: var(--space-sm);
    align-items: baseline;
    font-family: var(--font-numeric);
  }
  .r-label,
  .dec-label {
    color: var(--foreground-sub);
    font-size: var(--text-label-sm);
  }
  .r-value {
    color: var(--primary);
    font-size: var(--text-num-lg);
  }
  .dec-value {
    color: var(--foreground);
    font-size: var(--text-num-md);
  }

  .resources {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-sm);
    width: 100%;
    max-width: 460px;
  }
  .res {
    display: grid;
    grid-template-columns: 24px 1fr auto auto;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-base);
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
  }
  .res-icon {
    text-align: center;
    font-size: var(--text-num-md);
  }
  .res-name {
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }
  .res-val {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--foreground);
  }
  .res-rate {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
    min-width: 64px;
    text-align: right;
  }
  .res-rate.dim {
    color: var(--foreground-dim);
  }
  .res-depth .res-icon {
    color: var(--depth);
  }
  .res-energy .res-icon {
    color: var(--energy);
  }
  .res-data .res-icon {
    color: var(--data);
  }
  .res-qf .res-icon {
    color: var(--qf);
  }
  .res-mult .res-icon {
    color: var(--foreground-sub);
  }

  .actions {
    display: flex;
    gap: var(--space-base);
  }
  button {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--foreground);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
    padding: 12px 24px;
    cursor: pointer;
    transition: transform var(--motion-click-duration) ease-out;
  }
  button:active {
    transform: scale(var(--motion-click-scale));
  }
  .btn-compress {
    border-color: var(--layer-accent);
    color: var(--layer-accent);
    min-width: 96px;
    min-height: 44px;
    /* 클릭 글로우 버스트(DESIGN §5: +2px/200ms). pulse 클래스가 켜질 때만. */
    box-shadow: 0 0 0 transparent;
    transition:
      transform var(--motion-click-duration) ease-out,
      box-shadow var(--motion-click-glow) ease-out;
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

  footer {
    text-align: center;
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
    font-family: var(--font-narrative);
  }
  .dim {
    color: var(--foreground-dim);
  }
  .whisper {
    margin-top: var(--space-md);
    opacity: 0.45;
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
  }
  .booting {
    color: var(--foreground-sub);
    font-family: var(--font-narrative);
  }
</style>
