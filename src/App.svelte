<script lang="ts">
  /**
   * App.svelte — 압축 메인 화면 (SCR-01, M1.2 코어 루프). (ui-flow §2)
   *  - r 게이지: "작아짐=강해짐" — r 작아지고 dec/숫자 커짐, 글로우 반경 dec 따라 확대(DESIGN glow.core).
   *  - 자원 readout(E/C/D/QF) + 생산율(dC/dt).
   *  - 8단 체인 테이블(구매 ×1/×10/×100/Max) + 수동 압축.
   *  - 표시 전용(읽기 전용 스냅샷 구독, §4.1 단방향). 포맷은 format 모듈.
   */
  import { onMount, onDestroy } from 'svelte';
  import { Game, installUnloadSave, type GameSnapshot, type BuyMode } from './game';
  import { formatNumber, formatRadius } from './core/format';
  import ChainTable from './ui/ChainTable.svelte';

  let snap: GameSnapshot | null = null;
  let game: Game | null = null;
  let unsub: (() => void) | null = null;

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
    await game.start();
    // 개발 전용: 콘솔/프리뷰에서 결정적 advance·구매를 구동하기 위한 핸들(프로덕션 미노출).
    if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;
  });

  onDestroy(() => {
    unsub?.();
    game?.dispose();
  });

  function onCompress() {
    game?.manualCompress();
  }
  function onBuy(tier: number, mode: BuyMode) {
    game?.buy(tier, mode);
  }
  async function onSave() {
    await game?.persist();
  }

  // r 게이지 중심 글로우 반경: dec 클수록 확대(3→14px, DESIGN glow.core).
  $: glowRadius = snap ? Math.min(14, 3 + snap.dec * 0.42) : 3;
</script>

<main data-layer="mol">
  <header>
    <h1>Micro Idle</h1>
    <p class="sub">압축 — 작아질수록 강해진다</p>
  </header>

  {#if snap}
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
      <button class="btn-compress" on:click={onCompress}>압축</button>
      <button class="btn-save" on:click={onSave}>저장</button>
    </section>

    <ChainTable tiers={snap.tiers} {onBuy} />

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
    background: var(--canvas);
    color: var(--foreground);
    font-family: var(--font-label);
  }

  header {
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: var(--text-num-xl);
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--foreground);
  }
  .sub {
    margin: var(--space-xs) 0 0;
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
    font-family: var(--font-narrative);
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
    background: var(--col-glow-core);
    box-shadow: 0 0 var(--r-glow, 8px) var(--col-glow-core);
    transition: box-shadow var(--motion-click-glow) ease-out;
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
    border-color: var(--primary);
    color: var(--primary);
    min-width: 96px;
    min-height: 44px;
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
