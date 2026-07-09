<script lang="ts">
  /**
   * ResearchView — 연구 (ui-flow §3). 우주적 현미경 재구성(2단계): 카드 그리드 → **연구 로그**.
   *  패널 크롬 제거(bloom-panel이 컨테이너) · 노드=테두리 없는 2줄 엔트리(효과·플레이버·비용/구매).
   *  상태는 빛으로(구매가능=밝음/완료=물러남+✓/잠금=흐림). 구매 위임(game.buyResearch) — 로직 불변.
   */
  import type { GameSnapshot } from '../game';
  import { formatNumber } from '../core/format';

  export let research: GameSnapshot['research'];
  /** 현재 D 보유. */
  export let dCurrent: import('../core/bignum').Decimal;
  /** 노드 구매 위임(부모가 game.buyResearch 호출). */
  export let onBuy: (nodeId: string) => void;
</script>

<section class="research">
  <header class="rs-top">
    <span class="rs-title">연구소</span>
    <span class="rs-d"><span class="rs-d-sym">D</span> 보유 {formatNumber(dCurrent)}</span>
  </header>

  <p class="rs-branch">
    관측 노드<span class="dim"> · {research.branchProgress[0]}/{research.branchProgress[1]}</span>
  </p>

  <ul class="rs-nodes" role="list">
    {#each research.nodes as node (node.id)}
      <li
        class="rs-node"
        class:purchased={node.purchased}
        class:locked={!node.unlocked && !node.purchased}>
        <span class="rs-name">{node.nameKo}{#if node.purchased}<span class="rs-check"> ✓</span>{/if}</span>
        <span class="rs-effect">{node.effectKo}</span>
        <span class="rs-flavor">{node.flavorKo}</span>
        <span class="rs-action">
          {#if node.purchased}
            <span class="rs-state done">기록됨</span>
          {:else if !node.unlocked}
            <span class="rs-state lock">잠금</span>
            <span class="rs-prereq">선행 {node.prereqNamesKo.join(', ') || '—'}</span>
          {:else}
            <button
              class="rs-buy"
              class:active={node.affordable}
              disabled={!node.affordable}
              on:click={() => onBuy(node.id)}>연구 −{node.costD} D</button>
          {/if}
        </span>
      </li>
    {/each}
  </ul>

  <p class="rs-note">
    발견(도감)이 연구 데이터 D를 준다. D로 노드를 영구 언락 — 만지기 파워·데이터 획득·티어 증폭.
    상전이·재하강에 보존됩니다.
  </p>
</section>

<style>
  /* 컨테이너 크롬 0 — bloom-panel이 프레임. */
  .research {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .rs-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .rs-title {
    font-family: var(--font-label);
    font-size: var(--text-label-lg);
    color: var(--foreground);
  }
  .rs-d {
    font-family: var(--font-numeric);
    font-size: var(--text-label-md);
    color: var(--data);
  }
  .rs-d-sym {
    opacity: 0.7;
  }
  .dim {
    color: var(--foreground-dim);
  }

  .rs-branch {
    margin: 0;
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--layer-accent);
    padding-bottom: 6px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  }

  /* 노드 = 2줄 엔트리(테두리 0). [이름] [효과] … [액션] / 둘째 줄 플레이버. */
  .rs-nodes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .rs-node {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      'name action'
      'effect action'
      'flavor action';
    align-items: baseline;
    column-gap: 14px;
    row-gap: 3px;
    padding: 12px 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
  }
  .rs-node:last-of-type {
    border-bottom: none;
  }
  .rs-node.purchased {
    opacity: 0.55;
  }
  .rs-node.locked {
    opacity: 0.5;
  }
  .rs-name {
    grid-area: name;
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--foreground);
  }
  .rs-check {
    color: var(--col-keep);
  }
  .rs-effect {
    grid-area: effect;
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--primary);
  }
  .rs-flavor {
    grid-area: flavor;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    line-height: 1.45;
  }
  .rs-action {
    grid-area: action;
    align-self: center;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    text-align: right;
  }
  .rs-state {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
  }
  .rs-state.done {
    color: var(--col-keep);
  }
  .rs-state.lock {
    color: var(--foreground-dim);
  }
  .rs-prereq {
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-dim);
    max-width: 130px;
  }
  /* 구매 = 조용한 텍스트 버튼(카드 버튼 폐기). 가능=데이터 보라 발광, 불가=흐림. */
  .rs-buy {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
    background: none;
    border: none;
    padding: 4px 2px;
    cursor: not-allowed;
    white-space: nowrap;
    transition: color 0.2s ease, text-shadow 0.2s ease;
  }
  .rs-buy.active {
    color: var(--data);
    cursor: pointer;
  }
  .rs-buy.active:hover {
    text-shadow: 0 0 10px color-mix(in srgb, var(--data) 55%, transparent);
  }
  .rs-buy.active:active {
    transform: scale(var(--motion-click-scale, 0.97));
  }

  .rs-note {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.7;
    line-height: 1.5;
  }
</style>
