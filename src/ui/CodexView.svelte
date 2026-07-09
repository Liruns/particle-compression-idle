<script lang="ts">
  /**
   * CodexView — 입자 도감 (ui-flow §4). 우주적 현미경 재구성(2단계): 대시보드(사이드바+카드그리드+게이지)
   *  → **표본 카탈로그**. 패널 크롬 제거(bloom-panel이 컨테이너) · 층=가로 탭 · 입자=테두리 없는 표본 행
   *  (발견=밝음/미발견=물러난 마스킹, 위계는 빛으로 §3-C). 홀로그래픽 배율은 헤더 한 줄로 강등(게이지 폐기).
   *  로직 불변 — 표시·구성만.
   */
  import type { GameSnapshot } from '../game';
  import { LAYERS } from '../core/layers';
  import { particlesByLayer, type Particle } from '../data/particles';
  import { holographicMultiplier, layerCompletion } from '../core/codex';
  import { formatScale, formatPercent, formatMultiplier } from '../core/format';

  export let codex: GameSnapshot['codex'];

  /** 등급 → 한 글자 표식(흔/희/전 — 흔함·희귀·전설). */
  const rarityBadge: Record<Particle['rarity'], string> = {
    COMMON: '흔',
    UNCOMMON: '흔',
    RARE: '희',
    EPIC: '희',
    LEGENDARY: '전',
  };
  /** 등급 → 전체 이름(뱃지 title 툴팁). */
  const rarityKo: Record<Particle['rarity'], string> = {
    COMMON: '흔함',
    UNCOMMON: '드묾',
    RARE: '희귀',
    EPIC: '영웅',
    LEGENDARY: '전설',
  };

  let selectedLayer = 1;

  $: discovered = codex.discovered;
  $: holoMult = holographicMultiplier(discovered);
  $: selectedParticles = particlesByLayer(selectedLayer);

  $: visibleLayers = LAYERS.filter((l) => l.kind === 'known' || l.index <= codex.maxLayerReached);
  $: completionByLayer = new Map(
    visibleLayers.map((l) => {
      const known = codex.layerCompletions.find((c) => c.layerIndex === l.index);
      return [l.index, known ?? layerCompletion(l.index, discovered)];
    }),
  );

  function pct(layerIndex: number): string {
    const c = completionByLayer.get(layerIndex);
    return c && c.total > 0 ? formatPercent(c.collected / c.total) : '0%';
  }
  function layerName(layerIndex: number): string {
    return LAYERS.find((l) => l.index === layerIndex)?.nameKo ?? '';
  }
  function lockHint(p: Particle): string {
    if (p.layer <= 5) return `dec ${p.unlockDec} 도달 시 기록`;
    const g = p.mechGate;
    if (!g) return '???';
    switch (g.kind) {
      case 'phase': {
        const ko = g.state === 'coherent' ? '응집' : g.state === 'dispersed' ? '분산' : '공명';
        return `위상 ${ko} ${g.seconds}초 유지 시`;
      }
      case 'harmonic':
        return `하모닉 공명 ${g.resonances}회 시`;
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
    <span class="cx-meta">
      <span class="cx-count">{codex.collected}<span class="slash">/</span>{codex.denominator}</span>
      <span class="dot">·</span>
      <span class="cx-pct">{formatPercent(codex.completion)}</span>
      <span class="dot">·</span>
      <span class="cx-holo" title="홀로그래픽 배율 — 정보층에서 적용 (완주 시 ×1.350)"
        >홀로 {formatMultiplier(holoMult, 3)}</span>
    </span>
  </header>

  <!-- 층 = 가로 탭(좌 사이드바 폐기). 미지 영역은 자보라 톤. -->
  <nav class="cx-tabs" aria-label="층 선택">
    {#each visibleLayers as l (l.index)}
      {@const c = completionByLayer.get(l.index)}
      <button
        class="cx-tab"
        class:active={selectedLayer === l.index}
        class:unknown={l.kind === 'unknown'}
        class:done={(c?.total ?? 0) > 0 && c?.collected === c?.total}
        on:click={() => (selectedLayer = l.index)}>
        {l.nameKo}<span class="cx-tab-frac">{c?.collected ?? 0}/{c?.total ?? l.particleCount}</span>
      </button>
    {/each}
  </nav>

  <div class="cx-layerhead">
    {layerName(selectedLayer)}<span class="dim"> · {pct(selectedLayer)}</span>
  </div>

  <!-- 입자 = 테두리 없는 표본 행(카드 폐기). 발견=밝음, 미발견=물러난 마스킹. -->
  <ul class="cx-list" role="list">
    {#each selectedParticles as p (p.id)}
      {@const found = discovered.has(p.id)}
      <li class="cx-row" class:found class:legendary={found && p.rarity === 'LEGENDARY'}>
        <span class="cx-badge" title={rarityKo[p.rarity]}>{rarityBadge[p.rarity]}</span>
        <span class="cx-name">{found ? p.nameKo : '██████'}</span>
        <span class="cx-phys">
          {#if found}
            {#if p.charge !== null}<span>q{p.charge > 0 ? '+' : ''}{p.charge}</span>{/if}
            {#if p.spin !== null}<span>s{p.spin}</span>{/if}
            <span class="cx-scale">{formatScale(p.scaleM)}</span>
          {/if}
        </span>
        <span class="cx-flavor">{found ? p.flavorKo : lockHint(p)}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  /* 컨테이너 크롬 0 — bloom-panel이 프레임. 표본 카탈로그처럼 조용히. */
  .codex {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cx-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .cx-title {
    font-family: var(--font-label);
    font-size: var(--text-label-lg);
    color: var(--foreground);
    letter-spacing: 0.01em;
  }
  .cx-meta {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }
  .cx-count {
    color: var(--foreground);
  }
  .cx-count .slash {
    color: var(--foreground-dim);
    margin: 0 1px;
  }
  .cx-holo {
    color: var(--qf);
  }
  .cx-meta .dot {
    color: var(--foreground-dim);
  }
  .dim {
    color: var(--foreground-dim);
  }

  /* 가로 층 탭 — 텍스트만, 활성=밝음·완성=옅은 청록·미지=자보라. */
  .cx-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 4px;
    padding-bottom: 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  }
  .cx-tab {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
    padding: 4px 8px;
    border-radius: 999px;
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    transition: color 0.25s ease;
  }
  .cx-tab:hover {
    color: var(--foreground-sub);
  }
  .cx-tab.active {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 7%, transparent);
  }
  .cx-tab.done {
    color: var(--qf);
  }
  .cx-tab.unknown {
    color: color-mix(in srgb, var(--layer-prn-accent) 70%, var(--foreground-dim));
  }
  .cx-tab.unknown.active {
    color: var(--layer-prn-accent);
  }
  .cx-tab-frac {
    font-family: var(--font-numeric);
    font-size: 10px;
    opacity: 0.7;
  }

  .cx-layerhead {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--layer-accent);
  }

  /* 표본 행 — 2줄 엔트리(테두리 0). [표식] 이름 … 물리값 / 두 번째 줄 플레이버. */
  .cx-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .cx-row {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    grid-template-areas:
      'badge name phys'
      'badge flavor flavor';
    align-items: baseline;
    column-gap: 10px;
    row-gap: 1px;
    padding: 8px 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
    opacity: 0.4; /* 미발견 = 물러남 */
    transition: opacity var(--motion-codex-reveal, 0.4s) ease-out;
  }
  .cx-row.found {
    opacity: 1;
  }
  .cx-row:last-child {
    border-bottom: none;
  }
  .cx-badge {
    grid-area: badge;
    font-family: var(--font-numeric);
    font-size: 10px;
    color: var(--foreground-dim);
    align-self: center;
  }
  .cx-row.found .cx-badge {
    color: var(--foreground-sub);
  }
  .cx-row.legendary .cx-badge {
    color: var(--legendary);
  }
  .cx-name {
    grid-area: name;
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cx-row.legendary .cx-name {
    color: var(--legendary);
  }
  .cx-phys {
    grid-area: phys;
    display: flex;
    gap: 8px;
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
    white-space: nowrap;
  }
  .cx-scale {
    color: var(--depth);
  }
  .cx-flavor {
    grid-area: flavor;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    line-height: 1.4;
  }
  .cx-row:not(.found) .cx-flavor {
    color: var(--foreground-dim);
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
  }
</style>
