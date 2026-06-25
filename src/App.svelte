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
  import { particleById } from './data/particles';
  import { layerEntryBeat } from './data/narrative';
  import ChainTable from './ui/ChainTable.svelte';
  import LayerCard from './ui/LayerCard.svelte';
  import CodexView from './ui/CodexView.svelte';
  import ResonanceWidget from './ui/ResonanceWidget.svelte';
  import Toast from './ui/Toast.svelte';

  let snap: GameSnapshot | null = null;
  let game: Game | null = null;
  let unsub: (() => void) | null = null;
  const busUnsubs: (() => void)[] = [];
  let toast: Toast;

  /** 현재 탭. */
  type Tab = 'compress' | 'codex';
  let tab: Tab = 'compress';

  const loadLabel: Record<GameSnapshot['loadKind'], string> = {
    fresh: '새 게임',
    loaded: '세이브 로드됨',
    recovered: '백업에서 복구됨',
    corrupt: '세이브 손상 — 새로 시작',
  };

  onMount(async () => {
    game = new Game();
    unsub = game.subscribe((s) => (snap = s));
    installUnloadSave(game);

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

    await game.start();
    if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
  });

  onDestroy(() => {
    unsub?.();
    for (const u of busUnsubs) u();
    if (compressPulseTimer) clearTimeout(compressPulseTimer);
    game?.dispose();
  });

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
  function onBuy(tier: number, mode: BuyMode) {
    game?.buy(tier, mode);
  }
  async function onSave() {
    await game?.persist();
  }

  // r 게이지 중심 글로우 반경: dec 클수록 확대(3→14px, DESIGN glow.core).
  $: glowRadius = snap ? Math.min(14, 3 + snap.dec * 0.42) : 3;
  // 도감 탭은 첫 발견 후 등장(FTUE). 발견 시 압축 탭에 배지.
  $: showCodexTab = snap?.ftue.showCodexTab ?? false;
  $: codexCount = snap?.codex.collected ?? 0;
</script>

<Toast bind:this={toast} />

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
      {#if showCodexTab}
        <button class="tab" class:active={tab === 'codex'} on:click={() => (tab = 'codex')}>
          도감{#if codexCount > 0}<span class="tab-badge">{codexCount}</span>{/if}
        </button>
      {/if}
    </nav>

    {#if tab === 'compress'}
      <!-- r 게이지: "작아짐=강해짐". r은 작아지고 dec/숫자는 커진다. -->
      <section class="gauge">
        <div class="r-core" style="--r-glow: {glowRadius}px"></div>
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

      <!-- 메커니즘 위젯(원자층 L2 오비탈 공명, M1.4). active=false면 위젯 자체가 숨음. -->
      <ResonanceWidget resonance={snap.resonance} onClick={onResonanceClick} />

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
    {:else if tab === 'codex'}
      <CodexView codex={snap.codex} />
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
  /* 다크 베이스 — DESIGN.md --canvas. tokens.css가 :root 변수 공급. */
  main {
    min-height: 100vh;
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

  /* r 게이지: 중심 글로우(--col-glow-core), dec 커질수록 반경 확대(DESIGN glow.core). */
  .gauge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
  }
  .r-core {
    width: 16px;
    height: 16px;
    border-radius: var(--rounded-full);
    background: var(--layer-accent);
    box-shadow: 0 0 var(--r-glow, 8px) var(--layer-glow, var(--col-glow-core));
    transition:
      box-shadow var(--motion-click-glow) ease-out,
      background var(--motion-layer-accent-shift) ease-out;
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
