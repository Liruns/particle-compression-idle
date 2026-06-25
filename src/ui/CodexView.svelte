<script lang="ts">
  /**
   * CodexView — 도감 화면 (SCR-03, ui-flow §4). M1.3: 알려진 물리 57입자.
   *  좌: 층별 완성도 사이드. 우: 발견/미발견 입자 카드 그리드(층 섹션별).
   *  미발견 카드는 마스킹(이름 ██ / ???). 발견 시 이름·플레이버·물리값 노출.
   *  홀로그래픽 배율은 표시 전용(M1.3 생산 미적용 — 정보층 L10에서만, economy §7.2.3).
   */
  import type { GameSnapshot } from '../game';
  import { KNOWN_LAYERS } from '../core/layers';
  import { particlesByLayer, type Particle } from '../data/particles';
  import { holographicMultiplier } from '../core/codex';

  export let codex: GameSnapshot['codex'];

  /** 등급 → 한 글자 뱃지(ui-flow §4-B). */
  const rarityBadge: Record<Particle['rarity'], string> = {
    COMMON: '알',
    UNCOMMON: '알',
    RARE: '가',
    EPIC: '가',
    LEGENDARY: '전',
  };

  // 현재 선택된 층(사이드 클릭). 기본 = 첫 발견이 있는 층 또는 분자층.
  let selectedLayer = 1;

  $: discovered = codex.discovered;
  $: completionByLayer = new Map(codex.layerCompletions.map((c) => [c.layerIndex, c]));
  $: holoMult = holographicMultiplier(discovered);
  $: selectedParticles = particlesByLayer(selectedLayer);

  function pct(layerIndex: number): number {
    const c = completionByLayer.get(layerIndex);
    return c && c.total > 0 ? Math.round((c.collected / c.total) * 100) : 0;
  }
</script>

<div class="codex">
  <header class="cx-top">
    <span class="cx-title">입자 도감</span>
    <span class="cx-count"
      >수집 {codex.collected}/{codex.denominator}
      <span class="dim">· 완성도 {Math.round(codex.completion * 100)}%</span></span>
  </header>

  <div class="cx-body">
    <!-- 좌: 층별 완성도 사이드 -->
    <nav class="cx-side" aria-label="층 목록">
      <span class="cx-side-head">알려진 물리</span>
      {#each KNOWN_LAYERS as l (l.index)}
        {@const c = completionByLayer.get(l.index)}
        <button
          class="cx-layer-btn"
          class:active={selectedLayer === l.index}
          on:click={() => (selectedLayer = l.index)}>
          <span class="cx-layer-dot" style="--dot: var(--layer-{l.slug}-accent)"></span>
          <span class="cx-layer-name">{l.nameKo}</span>
          <span class="cx-layer-frac">{c?.collected ?? 0}/{c?.total ?? l.particleCount}</span>
        </button>
      {/each}

      <div class="cx-holo">
        <span class="cx-holo-label">홀로그래픽 배율</span>
        <span class="cx-holo-val">×{holoMult.toFixed(3)}</span>
        <span class="cx-holo-note dim">완주 시 ×1.350 (정보층에서 적용)</span>
      </div>
    </nav>

    <!-- 우: 선택 층 입자 카드 그리드 -->
    <section class="cx-grid-wrap">
      <h3 class="cx-section-title">
        {KNOWN_LAYERS.find((l) => l.index === selectedLayer)?.nameKo}
        <span class="dim">— {pct(selectedLayer)}%</span>
      </h3>
      <div class="cx-grid">
        {#each selectedParticles as p (p.id)}
          {@const found = discovered.has(p.id)}
          <article class="cx-card" class:found class:legendary={p.rarity === 'LEGENDARY'}>
            <div class="cx-card-head">
              <span class="cx-badge">{rarityBadge[p.rarity]}</span>
              <span class="cx-pname">{found ? p.nameKo : '██████'}</span>
            </div>
            {#if found}
              <p class="cx-flavor">{p.flavorKo}</p>
              <div class="cx-phys">
                {#if p.charge !== null}<span>q {p.charge > 0 ? '+' : ''}{p.charge}</span>{/if}
                {#if p.spin !== null}<span>s {p.spin}</span>{/if}
                <span class="cx-scale">{p.scaleM} m</span>
              </div>
            {:else}
              <p class="cx-flavor dim">???</p>
              <div class="cx-phys dim"><span>dec {p.unlockDec} 도달 시</span></div>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .codex {
    width: 100%;
    max-width: 720px;
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
    padding: var(--space-base);
  }
  .cx-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--border);
  }
  .cx-title {
    font-family: var(--font-label);
    font-size: var(--text-label-lg);
    color: var(--foreground);
  }
  .cx-count {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--foreground);
  }
  .dim {
    color: var(--foreground-dim);
  }

  .cx-body {
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: var(--space-md);
    margin-top: var(--space-base);
  }
  @media (max-width: 560px) {
    .cx-body {
      grid-template-columns: 1fr;
    }
  }

  .cx-side {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  .cx-side-head {
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
    font-family: var(--font-label);
    margin-bottom: var(--space-xs);
  }
  .cx-layer-btn {
    display: grid;
    grid-template-columns: 10px 1fr auto;
    align-items: center;
    gap: var(--space-sm);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--rounded-sm);
    padding: 5px var(--space-sm);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-label);
  }
  .cx-layer-btn:hover {
    background: var(--surface);
  }
  .cx-layer-btn.active {
    border-color: var(--border);
    background: var(--surface);
  }
  .cx-layer-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--rounded-full);
    background: var(--dot, var(--foreground-sub));
  }
  .cx-layer-name {
    font-size: var(--text-label-md);
    color: var(--foreground-sub);
  }
  .cx-layer-btn.active .cx-layer-name {
    color: var(--foreground);
  }
  .cx-layer-frac {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
  }

  .cx-holo {
    margin-top: var(--space-md);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cx-holo-label {
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
  }
  .cx-holo-val {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--qf);
  }
  .cx-holo-note {
    font-size: var(--text-label-sm);
  }

  .cx-section-title {
    margin: 0 0 var(--space-sm);
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    font-weight: 500;
    color: var(--layer-accent);
  }
  .cx-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--space-sm);
  }
  .cx-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
    padding: var(--space-sm);
    opacity: 0.35;
    transition: opacity var(--motion-codex-reveal) ease-out;
  }
  .cx-card.found {
    opacity: 1;
  }
  .cx-card.found.legendary {
    border-color: var(--legendary);
  }
  .cx-card-head {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-bottom: var(--space-xs);
  }
  .cx-badge {
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
    padding: 0 4px;
    flex-shrink: 0;
  }
  .cx-card.found.legendary .cx-badge {
    color: var(--legendary);
    border-color: var(--legendary);
  }
  .cx-pname {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cx-flavor {
    margin: 0 0 var(--space-xs);
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    line-height: 1.45;
  }
  .cx-phys {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
  }
  .cx-scale {
    color: var(--depth);
  }
</style>
