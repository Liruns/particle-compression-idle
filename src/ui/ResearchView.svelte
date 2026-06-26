<script lang="ts">
  /**
   * ResearchView — 연구 화면 (SCR-02, ui-flow §3). M1.7 A가지 체인증폭 2노드(A1·A2).
   *  상단 바: D 보유. 노드 카드: 효과·D 비용·구매 버튼. 상태별(구매가능/D부족/완료/잠금).
   *  D 소비 로직은 부모(game.buyResearch) 위임 — 단방향(§4.1). 구매하면 다음 tick부터 효과 반영.
   *
   *  연구 효과 = 체인 내부 배율(C안, research_mult≈1.0). 노드 카드는 economy 정합 — 전역 곱 아님.
   */
  import type { GameSnapshot } from '../game';
  import { formatNumber } from '../core/format';
  import Icon from './icons/Icon.svelte';

  export let research: GameSnapshot['research'];
  /** 현재 D 보유(상단 바 표시). */
  export let dCurrent: import('../core/bignum').Decimal;
  /** 노드 구매 위임(부모가 game.buyResearch 호출). */
  export let onBuy: (nodeId: string) => void;
</script>

<section class="research">
  <header class="rs-top">
    <span class="rs-title">연구 — 체인 증폭</span>
    <span class="rs-d">
      <span class="rs-d-icon"><Icon name="data" size={14} /></span>
      D 보유 {formatNumber(dCurrent)}
    </span>
  </header>

  <p class="rs-branch">
    A. 체인 증폭
    <span class="dim">— {research.branchProgress[0]}/{research.branchProgress[1]}</span>
  </p>

  <div class="rs-nodes">
    {#each research.nodes as node (node.id)}
      <article
        class="rs-card"
        class:purchased={node.purchased}
        class:locked={!node.unlocked && !node.purchased}>
        <div class="rs-card-head">
          <span class="rs-name">{node.nameKo}</span>
          {#if node.purchased}<span class="rs-check" aria-hidden="true">✓</span>{/if}
        </div>
        <p class="rs-effect">{node.effectKo}</p>
        <p class="rs-flavor">{node.flavorKo}</p>
        <div class="rs-foot">
          {#if node.purchased}
            <span class="rs-cost done">구매됨</span>
            <button class="rs-buy done" disabled>완료</button>
          {:else if !node.unlocked}
            <span class="rs-cost lock"
              >선행: {node.prereqNamesKo.join(', ') || '—'}</span>
            <button class="rs-buy lock" disabled>잠금</button>
          {:else}
            <span class="rs-cost" class:short={!node.affordable}>{node.costD} D</span>
            <button
              class="rs-buy"
              class:active={node.affordable}
              disabled={!node.affordable}
              on:click={() => onBuy(node.id)}>구매</button>
          {/if}
        </div>
      </article>
    {/each}
  </div>

  <p class="rs-note">
    체인 증폭은 특정 티어 생산만 강화합니다. 발견 데이터 D로 영구 구매 — 상전이·재하강에 보존됩니다.
  </p>
</section>

<style>
  /* 폭은 부모(CENTER 패널)가 결정 — max-width 해방(ux §P0-1). 노드 그리드가 횡으로 확장. */
  .research {
    width: 100%;
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
    padding: var(--space-base);
  }
  .rs-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--border);
  }
  .rs-title {
    font-family: var(--font-label);
    font-size: var(--text-label-lg);
    color: var(--foreground);
  }
  .rs-d {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--data);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }
  .rs-d-icon {
    color: var(--data);
  }
  .dim {
    color: var(--foreground-dim);
  }

  .rs-branch {
    margin: var(--space-base) 0 var(--space-sm);
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--layer-accent);
  }

  .rs-nodes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-sm);
  }
  .rs-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
    padding: var(--space-sm) var(--space-base);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  .rs-card.purchased {
    opacity: 0.6;
    border-color: color-mix(in srgb, var(--col-keep, #27ae60) 40%, var(--border));
  }
  .rs-card.locked {
    opacity: 0.45;
  }
  .rs-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-xs);
  }
  .rs-name {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--foreground);
  }
  .rs-check {
    color: var(--col-keep, #27ae60);
    font-size: var(--text-label-md);
  }
  .rs-effect {
    margin: 0;
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--primary);
  }
  .rs-flavor {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    line-height: 1.45;
  }
  .rs-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    margin-top: var(--space-xs);
  }
  .rs-cost {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--data);
  }
  .rs-cost.short {
    color: var(--col-reset, #c0392b);
  }
  .rs-cost.lock,
  .rs-cost.done {
    color: var(--foreground-dim);
    font-family: var(--font-label);
  }
  .rs-buy {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
    padding: 6px 14px;
    min-height: 32px;
    cursor: not-allowed;
  }
  .rs-buy.active {
    color: var(--data);
    border-color: var(--data);
    cursor: pointer;
  }
  .rs-buy.active:hover {
    box-shadow: 0 0 6px color-mix(in srgb, var(--data) 40%, transparent);
  }
  .rs-buy.active:active {
    transform: scale(var(--motion-click-scale));
  }

  .rs-note {
    margin: var(--space-base) 0 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.75;
    line-height: 1.5;
  }
</style>
