<script lang="ts">
  /**
   * CodexView — 도감 화면 (SCR-03, ui-flow §4). M1.3 알려진 물리 57 + M1.6 미지 프리온/끈 13.
   *  좌: 층별 완성도 사이드(알려진 물리 + 도달한 미지 서브층). 우: 입자 카드 그리드(층 섹션별).
   *  미발견 카드는 마스킹(이름 ██ / ???). 발견 시 이름·플레이버·물리값 노출.
   *  미지 입자는 발견 조건이 메커니즘(위상 상태·하모닉 공명)이라 미발견 힌트가 그 조건을 보여준다.
   *  홀로그래픽 배율은 표시 전용(생산 미적용 — 정보층 L10에서만, economy §7.2.3).
   */
  import type { GameSnapshot } from '../game';
  import { LAYERS } from '../core/layers';
  import { particlesByLayer, type Particle } from '../data/particles';
  import { holographicMultiplier, layerCompletion } from '../core/codex';

  export let codex: GameSnapshot['codex'];

  /** 등급 → 한 글자 뱃지(ui-flow §4-B). */
  const rarityBadge: Record<Particle['rarity'], string> = {
    COMMON: '알',
    UNCOMMON: '알',
    RARE: '가',
    EPIC: '가',
    LEGENDARY: '전',
  };

  // 현재 선택된 층(사이드 클릭). 기본 = 분자층.
  let selectedLayer = 1;

  $: discovered = codex.discovered;
  $: holoMult = holographicMultiplier(discovered);
  $: selectedParticles = particlesByLayer(selectedLayer);

  // 표시할 층: 알려진 물리(L1~L5) + 도달한 미지 서브층(L6+). 미도달 미지층은 숨김(스포일러 방지).
  $: visibleLayers = LAYERS.filter((l) => l.kind === 'known' || l.index <= codex.maxLayerReached);
  // 알려진 물리는 codex 스냅샷의 완성 현황, 미지는 즉석 계산(스냅샷은 알려진 물리만 담음).
  $: completionByLayer = new Map(
    visibleLayers.map((l) => {
      const known = codex.layerCompletions.find((c) => c.layerIndex === l.index);
      return [l.index, known ?? layerCompletion(l.index, discovered)];
    }),
  );

  function pct(layerIndex: number): number {
    const c = completionByLayer.get(layerIndex);
    return c && c.total > 0 ? Math.round((c.collected / c.total) * 100) : 0;
  }

  function layerName(layerIndex: number): string {
    return LAYERS.find((l) => l.index === layerIndex)?.nameKo ?? '';
  }

  /** 미발견 입자의 힌트: 미지층은 메커니즘 조건, 알려진 물리는 dec 도달. */
  function lockHint(p: Particle): string {
    if (p.layer <= 5) return `dec ${p.unlockDec} 도달 시`;
    const g = p.mechGate;
    if (!g) return '???';
    switch (g.kind) {
      case 'phase': {
        const ko = g.state === 'coherent' ? '응집' : g.state === 'dispersed' ? '분산' : '공명';
        return `위상 ${ko} ${g.seconds}초 유지`;
      }
      case 'harmonic':
        return `하모닉 공명 ${g.resonances}회`;
      case 'decade':
        return `dec ${g.dec} 도달 시`;
      case 'layerComplete':
        return '층 도감 완성 시';
    }
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
    <!-- 좌: 층별 완성도 사이드(알려진 물리 + 도달한 미지 서브층) -->
    <nav class="cx-side" aria-label="층 목록">
      {#each visibleLayers as l (l.index)}
        {@const c = completionByLayer.get(l.index)}
        {#if l.index === 1}<span class="cx-side-head">알려진 물리</span>{/if}
        {#if l.index === 6}<span class="cx-side-head cx-side-unknown">미지 영역</span>{/if}
        <button
          class="cx-layer-btn"
          class:active={selectedLayer === l.index}
          class:unknown={l.kind === 'unknown'}
          on:click={() => (selectedLayer = l.index)}>
          <span class="cx-layer-dot" style="--dot: var(--layer-{l.slug}-accent)"></span>
          <span class="cx-layer-name">{l.nameKo}</span>
          <span class="cx-layer-frac">{c?.collected ?? 0}/{c?.total ?? l.particleCount}</span>
        </button>
      {/each}

      <div class="cx-holo">
        <span class="cx-holo-label">홀로그래픽 배율</span>
        <!-- 완성도 바(ui-flow §4-C): 발견 discoverable / 76. -->
        <div class="cx-holo-bar" role="progressbar" aria-valuenow={codex.collected} aria-valuemax={codex.denominator}>
          <div class="cx-holo-fill" style="width: {Math.round(codex.completion * 100)}%"></div>
        </div>
        <span class="cx-holo-frac dim">{codex.collected}/{codex.denominator} ({Math.round(codex.completion * 100)}%)</span>
        <span class="cx-holo-val">×{holoMult.toFixed(3)}</span>
        <span class="cx-holo-note dim">완주 시 ×1.350 (정보층에서 적용)</span>
      </div>
    </nav>

    <!-- 우: 선택 층 입자 카드 그리드 -->
    <section class="cx-grid-wrap">
      <h3 class="cx-section-title">
        {layerName(selectedLayer)}
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
              <div class="cx-phys dim"><span>{lockHint(p)}</span></div>
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
  /* 미지 영역 구분 헤더 — 자주 톤(알려진 물리에서 미지로의 경계 신호). */
  .cx-side-unknown {
    margin-top: var(--space-sm);
    color: var(--layer-prn-accent);
    opacity: 0.85;
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
  /* 완성도 바(ui-flow §4-C): QF 녹 채움. 곡선 B(c²) 시각화는 단순 선형 진행률로 표시. */
  .cx-holo-bar {
    height: 6px;
    background: var(--surface);
    border-radius: var(--rounded-full);
    overflow: hidden;
    margin: 2px 0;
  }
  .cx-holo-fill {
    height: 100%;
    background: var(--qf);
    border-radius: var(--rounded-full);
    transition: width var(--motion-codex-reveal, 0.4s) ease-out;
  }
  .cx-holo-frac {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
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
