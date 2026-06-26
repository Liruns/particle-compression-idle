<script lang="ts">
  /**
   * App.svelte — 다이제틱 공허 게임판 셸 (이관 2단계, cosmic-direction §3·§4).
   *  대시보드(3패널·탭·게이지·체인 테이블)를 폐기하고(§3-A), 화면을 두 레이어로 재구성한다:
   *   ① 풀스크린 게임 캔버스 — WorldRenderer(세계 배경) + BoardRenderer(중심 코어·8 궤도 껍질·세포).
   *   ② 공허에 뜬 희미한 DOM 주석 — 자원 성표(테두리·카드 0), r·층, 힌트, 결속모드, 가장자리 디바이스 노드.
   *
   *  관조 ↔ 개입(§3-B): 평소엔 입자가 떠다니는 것을 지켜보고(관조), 손을 뻗을 때 만진다(개입):
   *   - 세포 만지기 = 압축·흡수(능동, §4 수동 압축) → game.manualCompress().
   *   - 껍질 클릭 = 결속(구매) → game.buy(tier, mode) (E 비용 — 실제 경제 불변).
   *   - 가장자리 노드(연구·도감·상전이·메커니즘) = 잠든 빛 → 부르면 bloom 오버레이(기존 뷰 재사용).
   *
   *  ★표현만, 로직 0줄(§6·§7-C): 모든 game 호출은 기존 API 그대로. 경제·수식·밸런스 불변.
   *   FTUE 점진 공개·점등 조건·오프라인 복귀 요약(정보 로직 §7-C#3)을 공허 모델로 보존.
   *  ★단방향(§4.1): snapshot 구독→표시. board는 히트테스트만 돌려주고 game 호출은 여기서.
   */
  import { onMount, onDestroy } from 'svelte';
  import { Game, installUnloadSave, type GameSnapshot, type BuyMode } from './game';
  import { formatNumber, formatRadius } from './core/format';
  import { bus } from './core/events';
  import { CanvasRenderer } from './render';
  import type { BoardInput, BoardShell } from './render/board';
  import { reducedMotion } from './ui/stores/reduced-motion';
  import { particleById } from './data/particles';
  import { layerEntryBeat } from './data/narrative';
  import CodexView from './ui/CodexView.svelte';
  import ResearchView from './ui/ResearchView.svelte';
  import PrestigeView from './ui/PrestigeView.svelte';
  import ResonanceWidget from './ui/ResonanceWidget.svelte';
  import PhaseWidget from './ui/PhaseWidget.svelte';
  import HarmonicsWidget from './ui/HarmonicsWidget.svelte';
  import OfflineModal from './ui/OfflineModal.svelte';
  import Toast from './ui/Toast.svelte';
  import type { PhaseState } from './core/layers/mechanics';

  let snap: GameSnapshot | null = null;
  let game: Game | null = null;
  let unsub: (() => void) | null = null;
  const busUnsubs: (() => void)[] = [];
  let toast: Toast;

  // 풀스크린 게임 캔버스(세계 배경 + 전경 게임판). 글로우 게이지 캔버스는 폐기(null) — 게이지=코어로 대체.
  let bgCanvas: HTMLCanvasElement | null = null;
  let renderer: CanvasRenderer | null = null;
  let lastSlug = '';
  let rmUnsub: (() => void) | null = null;
  let bgResizeObserver: ResizeObserver | null = null;
  let onWindowResize: (() => void) | null = null;

  /** 결속(구매) 수량 모드 — 공허 좌상단 셀렉터. */
  let buyMode: BuyMode = 1;
  const buyModes: { id: BuyMode; label: string }[] = [
    { id: 1, label: '×1' },
    { id: 10, label: '×10' },
    { id: 100, label: '×100' },
    { id: 'max', label: '최대' },
  ];

  /** 부른 디바이스(개입 bloom 오버레이). null=관조. */
  type Panel = 'research' | 'codex' | 'prestige' | 'mech';
  let activePanel: Panel | null = null;

  /** 포인터 드래그(누른 채 쓸어담기) 상태. */
  let pointerDown = false;

  /** 현재 층 발광색(QF 성표 = 층색 §3-C). pushRender에서 갱신. */
  let layerRgb = '159,184,154';

  onMount(async () => {
    game = new Game();
    unsub = game.subscribe((s) => {
      snap = s;
      pushRender(s);
    });
    installUnloadSave(game);

    setupRenderer();
    rmUnsub = reducedMotion.subscribe((v) => renderer?.setReducedMotion(v));

    if (import.meta.env.DEV) {
      (window as unknown as { forceLayer: (slug: string) => void }).forceLayer = (slug: string) => {
        document.documentElement.setAttribute('data-layer', slug);
        renderer?.onLayerChange(slug);
        lastSlug = slug;
      };
    }

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
    rmUnsub?.();
    bgResizeObserver?.disconnect();
    if (onWindowResize) window.removeEventListener('resize', onWindowResize);
    renderer?.dispose();
    game?.dispose();
  });

  // --- 렌더러 와이어링 ----------------------------------------------------------
  function setupRenderer(): void {
    if (!bgCanvas) return;
    // 게이지 글로우 캔버스 폐기 → null(세계 위 전경 게임판이 한 캔버스에 합성).
    renderer = new CanvasRenderer({ bgCanvas, glowCanvas: null, rootEl: document.documentElement });
    renderer.setReducedMotion($reducedMotion);
    if (snap) {
      lastSlug = snap.layer.slug;
      renderer.onLayerChange(snap.layer.slug);
      pushRender(snap);
    }
    if (typeof ResizeObserver !== 'undefined') {
      bgResizeObserver?.disconnect();
      bgResizeObserver = new ResizeObserver(() => renderer?.resize());
      bgResizeObserver.observe(bgCanvas);
    }
    if (typeof window !== 'undefined' && !onWindowResize) {
      onWindowResize = () => renderer?.resize();
      window.addEventListener('resize', onWindowResize);
    }
  }

  /** snapshot → 렌더러(읽기전용 파생). 층 변화 감지 + 게임판 입력 주입 + draw. */
  function pushRender(s: GameSnapshot): void {
    if (!renderer) return;
    if (s.layer.slug !== lastSlug) {
      lastSlug = s.layer.slug;
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
    renderer.gameBoard.setInput(buildBoardInput(s));
    layerRgb = renderer.layerColorRGB;
    renderer.draw();
  }

  /** snapshot → BoardInput(읽기전용 파생). Decimal→number/string 환산은 여기 경계에서만(V2-8). */
  function buildBoardInput(s: GameSnapshot): BoardInput {
    // 체인 미공개(FTUE)면 껍질 없음 — 관조(코어+세포)만.
    if (!s.ftue.showChain) {
      return { shells: [], decadeProgress: s.layer.decadeProgress, energyLabel: formatNumber(s.E, 2) };
    }
    // 최적(가장 싼 다음 구매) 티어 — 부름 강조.
    let bestTier = -1;
    let bestCost: import('break_eternity.js').default | null = null;
    for (const t of s.tiers) {
      if (!t.unlocked) continue;
      if (bestCost === null || t.nextCost.lt(bestCost)) {
        bestCost = t.nextCost;
        bestTier = t.tier;
      }
    }
    const shells: BoardShell[] = [];
    for (const t of s.tiers) {
      if (!t.unlocked) continue;
      const producing = t.owned.gt(0);
      shells.push({
        tier: t.tier,
        ownedLog10: producing ? t.owned.log10().toNumber() : -1,
        bought: t.bought,
        unlocked: true,
        affordable: t.affordable,
        producing,
        best: t.tier === bestTier,
        nameKo: `T${t.tier} 압축기`,
        costLabel: `결속 −${formatNumber(t.nextCost, 2)} E`,
        rateLabel: producing
          ? `보유 ${formatNumber(t.owned, 0)} · +${formatNumber(t.rate, 2)}/s`
          : '미가동',
      });
    }
    return { shells, decadeProgress: s.layer.decadeProgress, energyLabel: formatNumber(s.E, 2) };
  }

  // --- 포인터 상호작용(공허에 손 뻗기) ------------------------------------------
  function canvasXY(e: PointerEvent): { x: number; y: number } {
    const rect = bgCanvas!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: PointerEvent): void {
    if (!renderer || !game || !snap || e.button !== 0) return;
    pointerDown = true;
    const { x, y } = canvasXY(e);
    renderer.gameBoard.setPointer(x, y);
    const hit = renderer.gameBoard.activate();
    if (hit.kind === 'cell') doCompress();
    else if (hit.kind === 'shell') doBind(hit.tier);
  }
  function onPointerMove(e: PointerEvent): void {
    if (!renderer) return;
    const { x, y } = canvasXY(e);
    renderer.gameBoard.setPointer(x, y);
    if (pointerDown && game) {
      // 드래그 쓸어담기 — 지나간 float 세포만큼 압축·흡수(연속 손맛).
      const n = renderer.gameBoard.dragAbsorb(x, y);
      for (let i = 0; i < n; i++) doCompress();
    }
  }
  function endPointer(): void {
    pointerDown = false;
  }
  function onPointerLeave(): void {
    pointerDown = false;
    renderer?.gameBoard.clearPointer();
  }

  /** 세포 흡수 = 수동 압축(실제 게임). 획득 E를 중심 떠오르는 수치로 피드백. */
  function doCompress(): void {
    if (!game || !snap) return;
    const before = snap.E;
    game.manualCompress(); // 동기 notify → snap 갱신
    const gained = snap.E.sub(before);
    if (gained.gt(0)) renderer?.gameBoard.spawnCenterText(`+${formatNumber(gained, 2)} E`, '217,184,106');
  }
  /** 껍질 결속 = 압축기 구매(실제 게임, E 비용). 성공 수만큼 결속 비행 피드백. */
  function doBind(tier: number): void {
    if (!game) return;
    const count = game.buy(tier, buyMode);
    if (count > 0) renderer?.gameBoard.onBind(tier, count);
  }

  // --- 디바이스 노드(개입 bloom) -----------------------------------------------
  function openPanel(p: Panel): void {
    activePanel = activePanel === p ? null : p;
  }
  function closePanel(): void {
    activePanel = null;
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && activePanel) closePanel();
    else if (e.key === '1') buyMode = 1;
    else if (e.key === '2') buyMode = 10;
    else if (e.key === '3') buyMode = 100;
    else if (e.key === '4' || e.key.toLowerCase() === 'm') buyMode = 'max';
  }

  // --- game 위임(오버레이 뷰) ---------------------------------------------------
  function onBuyResearch(nodeId: string) {
    game?.buyResearch(nodeId);
  }
  function onResonanceClick() {
    game?.clickResonance();
  }
  function onPhasePin(state: PhaseState) {
    game?.pinPhase(state);
  }
  function onPhaseUnpin() {
    game?.unpinPhase();
  }
  function onDismissOffline() {
    game?.dismissOffline();
  }
  async function onSave() {
    await game?.persist();
  }
  function onPrestige() {
    const result = game?.executePrestige();
    if (result) closePanel(); // 실행 성공 → 관조로 복귀(새 층 하강).
  }
  function onPrestigeContinue() {
    closePanel();
  }

  // --- 파생(FTUE 점진 공개·점등 — 정보 로직 보존 §7-C#3) ------------------------
  $: showCodexNode = snap?.ftue.showCodexTab ?? false;
  $: codexCount = snap?.codex.collected ?? 0;
  $: showResearchNode = snap?.ftue.showResearchTab ?? false;
  $: showPrestigeNode = snap?.prestige.available ?? false;
  $: prestigeFirst = (snap?.prestige.available && snap?.prestige.isFirst) ?? false;
  $: mechActive =
    (snap?.resonance.active || snap?.phase.active || snap?.harmonics.active) ?? false;
  // 노드가 사라졌는데 그 패널이 열려 있으면 닫음(점등 해소·로드 직후 방어).
  $: if (activePanel === 'prestige' && !showPrestigeNode) activePanel = null;
  $: if (activePanel === 'research' && !showResearchNode) activePanel = null;
  $: if (activePanel === 'mech' && !mechActive) activePanel = null;
  // QF 성표는 층 발광색을 따른다(§3-C). data-layer는 :root에 이미 반영(pushRender).
  $: qfStyle = `color: rgba(${layerRgb}, 0.82);`;
</script>

<svelte:window on:keydown={onKeydown} on:pointerup={endPointer} on:blur={endPointer} />

<Toast bind:this={toast} />

<!-- 풀스크린 게임 캔버스 — 세계 배경 + 전경 게임판. 포인터=만지기 표면(공허가 곧 게임판 §3). -->
<canvas
  class="game-canvas"
  bind:this={bgCanvas}
  on:pointerdown={onPointerDown}
  on:pointermove={onPointerMove}
  on:pointerleave={onPointerLeave}
  aria-label="공허 게임판 — 떠다니는 물질을 만져 압축, 궤도 껍질을 눌러 결속"
></canvas>

<!-- 오프라인 복귀 모달(ui-flow §10, 정보 로직 보존). -->
{#if snap?.offline}
  <OfflineModal offline={snap.offline} onDismiss={onDismissOffline} />
{/if}

{#if snap}
  <!-- 공허에 뜬 희미한 주석층(테두리·카드·배경 0 — §3-A·§3-B). pointer-events는 상호작용 요소만. -->
  <div class="annot-layer" aria-hidden={activePanel ? 'true' : 'false'}>
    <!-- 좌상단: 결속(구매) 수량 모드. -->
    <div class="annot buymode">
      <span class="bm-label">결속</span>
      {#each buyModes as m}
        <button class="bm" class:on={buyMode === m.id} on:click={() => (buyMode = m.id)}
          >{m.label}</button>
      {/each}
    </div>

    <!-- 우상단: 자원 성표(E·C·D·QF·배율). 발견 전(0)이면 흐릿. -->
    <div class="annot resources">
      <div class="res res-e">
        <span class="r-sym">E</span><span class="r-val">{formatNumber(snap.E, 2)}</span>
        <span class="r-rate">{#if snap.rateC.gt(0)}+{formatNumber(snap.rateC, 2)}/s{/if}</span>
      </div>
      <div class="res res-c">
        <span class="r-sym">C</span><span class="r-val">{formatNumber(snap.C, 2)}</span>
        <span class="r-rate">{#if snap.rateC.gt(0)}+{formatNumber(snap.rateC, 2)}/s{/if}</span>
      </div>
      {#if snap.ftue.showResourceD}
        <div class="res res-d">
          <span class="r-sym">D</span><span class="r-val">{formatNumber(snap.D, 2)}</span>
          <span class="r-rate">발견</span>
        </div>
      {/if}
      {#if snap.QF.gt(0)}
        <div class="res res-qf" style={qfStyle}>
          <span class="r-sym">QF</span><span class="r-val">{formatNumber(snap.QF)}</span>
          <span class="r-rate">영구</span>
        </div>
      {/if}
      <div class="res res-mult">
        <span class="r-sym">배율</span><span class="r-val">×{formatNumber(snap.mult, 3)}</span>
      </div>
    </div>

    <!-- 좌하단: r(반경) + 층 — 성표 주석. 작아질수록 더 광막(작음=숭고 §2-A). -->
    <div class="annot vitals">
      <div class="v-r">r = <span class="v-num">{formatRadius(snap.r)}</span></div>
      <div class="v-layer">{snap.layer.nameKo} · dec {snap.dec.toFixed(2)}</div>
    </div>

    <!-- 우하단: 힌트(FTUE) + 속삭임. -->
    <div class="annot whisper">
      {#if snap.ftue.hint}<div class="hint">{snap.ftue.hint}</div>{/if}
      <div class="murmur">물질 속으로, 영원히 천천히 떨어진다.</div>
    </div>

    <!-- 하단 중앙: 잠든 디바이스 노드(개입). 부르면 bloom. (§3-B 가장자리 발광 노드) -->
    <div class="dock">
      {#if mechActive}
        <button class="node" class:on={activePanel === 'mech'} on:click={() => openPanel('mech')}
          >메커니즘</button>
      {/if}
      {#if showResearchNode}
        <button class="node" class:on={activePanel === 'research'} on:click={() => openPanel('research')}
          >연구</button>
      {/if}
      {#if showCodexNode}
        <button class="node" class:on={activePanel === 'codex'} on:click={() => openPanel('codex')}>
          도감{#if codexCount > 0}<span class="badge">{codexCount}</span>{/if}
        </button>
      {/if}
      {#if showPrestigeNode}
        <button
          class="node node-prestige"
          class:on={activePanel === 'prestige'}
          class:first={prestigeFirst}
          on:click={() => openPanel('prestige')}>{prestigeFirst ? '미지 진입' : '상전이'}</button>
      {/if}
      <button class="node node-quiet" on:click={onSave} title="저장">저장</button>
    </div>
  </div>

  <!-- 개입 bloom 오버레이 — 디바이스가 피어난다. 배경 클릭/Esc로 물러남(recede §3-B). -->
  {#if activePanel}
    <div
      class="bloom-backdrop"
      role="button"
      tabindex="-1"
      aria-label="닫기"
      on:click={closePanel}
      on:keydown={(e) => e.key === 'Enter' && closePanel()}>
    </div>
    <div class="bloom-panel" role="dialog" aria-modal="true">
      <button class="bloom-close" on:click={closePanel} aria-label="닫기">✕</button>
      <div class="bloom-body">
        {#if activePanel === 'research'}
          <ResearchView research={snap.research} dCurrent={snap.D} onBuy={onBuyResearch} />
        {:else if activePanel === 'codex'}
          <CodexView codex={snap.codex} />
        {:else if activePanel === 'prestige'}
          <PrestigeView prestige={snap.prestige} onPrestige={onPrestige} onContinue={onPrestigeContinue} />
        {:else if activePanel === 'mech'}
          <div class="mech-stack">
            <ResonanceWidget resonance={snap.resonance} onClick={onResonanceClick} />
            <PhaseWidget phase={snap.phase} onPin={onPhasePin} onUnpin={onPhaseUnpin} />
            <HarmonicsWidget harmonics={snap.harmonics} />
          </div>
        {/if}
      </div>
    </div>
  {/if}
{:else}
  <p class="booting">초기화 중…</p>
{/if}

<style>
  /* 페이지 = 순흑 공허(art §2-B: 화면 90%는 어둠). 캔버스가 그 위에 세계+빛을 그린다. */
  :global(body) {
    margin: 0;
    background: #000;
    overflow: hidden;
    color: #e0eef4;
  }

  /* 풀스크린 게임 캔버스 — 만질 표면. (세계+전경 한 파이프라인) */
  .game-canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    display: block;
    z-index: 0;
    touch-action: none; /* 포인터 드래그(쓸어담기)에서 스크롤/줌 가로채기 방지 */
    cursor: default;
  }

  /* 공허에 뜬 주석층 — 테두리/카드/배경 0. 어둠 위 발광 텍스트만(§3-A 폐기·§3-B 성표). */
  .annot-layer {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none; /* 기본 비차단 — 상호작용 요소만 auto */
    font-family: var(--font-numeric, 'IBM Plex Mono', ui-monospace, monospace);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }
  .annot {
    position: fixed;
    text-shadow: 0 0 12px rgba(0, 0, 0, 0.92);
  }

  /* 좌상단 결속 모드. */
  .buymode {
    left: 22px;
    top: 16px;
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 12px;
    pointer-events: auto;
  }
  .bm-label {
    color: rgba(150, 166, 174, 0.55);
    margin-right: 6px;
    letter-spacing: 0.06em;
  }
  .bm {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 5px;
    font: inherit;
    color: rgba(150, 166, 174, 0.5);
    transition: color 0.3s ease;
  }
  .bm.on {
    color: rgba(217, 184, 106, 0.92);
  } /* E 금빛 = 활성 */

  /* 우상단 자원 성표 — 세로. 각자 탈채도색(§3-C 단일 악센트 해체). */
  .resources {
    right: 24px;
    top: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    text-align: right;
  }
  .res {
    display: flex;
    align-items: baseline;
    gap: 7px;
    line-height: 1.1;
  }
  .res .r-sym {
    font-size: 11px;
    opacity: 0.62;
    letter-spacing: 0.06em;
  }
  .res .r-val {
    font-size: 15px;
    min-width: 0;
  }
  .res .r-rate {
    font-size: 10px;
    opacity: 0.5;
    min-width: 56px;
  }
  .res-e {
    color: rgba(217, 184, 106, 0.86);
  } /* #d9b86a 식은 금 */
  .res-c {
    color: rgba(122, 159, 192, 0.86);
  } /* #7a9fc0 차분한 청 */
  .res-d {
    color: rgba(154, 143, 192, 0.86);
  } /* #9a8fc0 흐린 보라 */
  .res-qf {
    color: rgba(159, 184, 154, 0.82);
  } /* 층색 — inline style이 덮어씀 */
  .res-mult {
    color: rgba(200, 214, 220, 0.7);
  }

  /* 좌하단 r·층 성표. */
  .vitals {
    left: 26px;
    bottom: 22px;
    line-height: 1.7;
  }
  .v-r {
    font-size: 15px;
    color: rgba(224, 238, 244, 0.5);
  }
  .v-r .v-num {
    color: rgba(236, 246, 250, 0.78);
  }
  .v-layer {
    font-size: 12px;
    color: rgba(174, 188, 194, 0.55);
    transition: color 1s ease;
  }

  /* 우하단 힌트·속삭임. */
  .whisper {
    right: 24px;
    bottom: 20px;
    text-align: right;
    line-height: 1.7;
    max-width: 46vw;
  }
  .whisper .hint {
    font-size: 12px;
    color: rgba(150, 168, 178, 0.7);
    font-family: var(--font-narrative, 'IBM Plex Sans KR', sans-serif);
    margin-bottom: 6px;
  }
  .whisper .murmur {
    font-size: 11px;
    color: rgba(110, 126, 134, 0.42);
    font-family: var(--font-narrative, 'IBM Plex Sans KR', sans-serif);
  }

  /* 하단 중앙 디바이스 독 — 잠든 빛. hover/on에서 피어남. */
  .dock {
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    pointer-events: auto;
    position: fixed;
  }
  .node {
    background: none;
    border: none;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    letter-spacing: 0.05em;
    padding: 7px 13px;
    color: rgba(150, 166, 174, 0.5);
    border-radius: 999px;
    transition:
      color 0.4s ease,
      text-shadow 0.4s ease;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .node:hover {
    color: rgba(210, 224, 230, 0.85);
    text-shadow: 0 0 10px rgba(160, 190, 210, 0.45);
  }
  .node.on {
    color: rgba(228, 240, 246, 0.95);
    text-shadow: 0 0 14px rgba(160, 200, 220, 0.6);
  }
  .node-quiet {
    color: rgba(120, 134, 142, 0.38);
  }
  .node-prestige.first {
    color: rgba(138, 127, 208, 0.9);
    animation: node-pulse 1.6s ease-in-out infinite;
  }
  @keyframes node-pulse {
    0%,
    100% {
      text-shadow: 0 0 0 transparent;
      opacity: 0.7;
    }
    50% {
      text-shadow: 0 0 12px rgba(138, 127, 208, 0.7);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .node-prestige.first {
      animation: none;
      opacity: 1;
    }
  }
  .badge {
    font-size: 10px;
    color: #0a0e0c;
    background: rgba(154, 143, 192, 0.9);
    border-radius: 999px;
    padding: 0 5px;
    min-width: 15px;
    text-align: center;
  }

  /* 개입 bloom 오버레이 — 어둠이 깊어지고 디바이스가 피어난다. */
  .bloom-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9;
    background: rgba(2, 4, 7, 0.62);
    backdrop-filter: blur(3px);
    border: none;
    cursor: default;
    animation: bloom-fade 0.3s ease-out;
  }
  .bloom-panel {
    position: fixed;
    z-index: 10;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, 92vw);
    max-height: 86vh;
    overflow-y: auto;
    padding: 18px;
    background: color-mix(in srgb, #0a1014 88%, transparent);
    border-radius: 14px;
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.7);
    animation: bloom-rise 0.32s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes bloom-fade {
    from {
      opacity: 0;
    }
  }
  @keyframes bloom-rise {
    from {
      opacity: 0;
      transform: translate(-50%, -46%) scale(0.97);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bloom-backdrop,
    .bloom-panel {
      animation: none;
    }
  }
  .bloom-close {
    position: absolute;
    right: 12px;
    top: 10px;
    z-index: 1;
    background: none;
    border: none;
    color: rgba(180, 196, 206, 0.6);
    font-size: 15px;
    cursor: pointer;
    padding: 4px 8px;
  }
  .bloom-close:hover {
    color: rgba(228, 240, 246, 0.95);
  }
  .mech-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .booting {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(150, 166, 174, 0.6);
    font-family: var(--font-narrative, 'IBM Plex Sans KR', sans-serif);
  }
</style>
