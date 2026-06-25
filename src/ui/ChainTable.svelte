<script lang="ts">
  /**
   * ChainTable — 8단 압축기 체인 테이블. (ui-flow §2-D)
   * 티어별: 생산율 · 보유 수 · 다음 비용 · 구매 버튼(×1/×10/×100/Max).
   * 단방향: 스냅샷(tiers)을 받아 표시만, 구매는 onBuy 콜백으로 위임(§4.1).
   *
   * DESIGN game-ui.chain-table: 해금 1.0 / 미해금 0.25 opacity. 토큰·폰트 적용.
   */
  import type { TierSnapshot, BuyMode } from '../game';
  import { formatNumber } from '../core/format';

  export let tiers: TierSnapshot[] = [];
  /** 구매 위임. (tier 1-기반, mode) */
  export let onBuy: (tier: number, mode: BuyMode) => void;

  /** 현재 선택된 대량구매 모드(전 티어 공통, ui-flow §2-D 버튼군). */
  let mode: BuyMode = 1;
  const modes: { id: BuyMode; label: string }[] = [
    { id: 1, label: '×1' },
    { id: 10, label: '×10' },
    { id: 100, label: '×100' },
    { id: 'max', label: 'Max' },
  ];

  // 최적 티어(다음 1개가 가장 싼 해금 티어)에 ▶ 표시 (ux-flow §2-D / FTUE 넛지3).
  $: bestTier = (() => {
    let best = -1;
    let bestCost: import('break_eternity.js').default | null = null;
    for (const t of tiers) {
      if (!t.unlocked) continue;
      if (bestCost === null || t.nextCost.lt(bestCost)) {
        bestCost = t.nextCost;
        best = t.tier;
      }
    }
    return best;
  })();
</script>

<div class="chain">
  <div class="chain-head">
    <span class="title">압축기 체인</span>
    <div class="modes" role="group" aria-label="구매 수량">
      {#each modes as m}
        <button
          class="mode-btn"
          class:active={mode === m.id}
          on:click={() => (mode = m.id)}>{m.label}</button>
      {/each}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="c-tier">T#</th>
        <th class="c-rate">생산율</th>
        <th class="c-owned">보유</th>
        <th class="c-cost">다음 비용</th>
        <th class="c-buy"></th>
      </tr>
    </thead>
    <tbody>
      {#each tiers as t (t.tier)}
        <tr class:locked={!t.unlocked}>
          <td class="c-tier">
            T{t.tier}{#if t.tier === bestTier}<span class="best" title="최적 구매 티어">▶</span>{/if}
          </td>
          <td class="c-rate">
            {#if t.owned.gt(0)}+{formatNumber(t.rate, 2)}{:else}—{/if}
          </td>
          <td class="c-owned">{formatNumber(t.owned, 0)}</td>
          <td class="c-cost" class:poor={!t.affordable && t.unlocked}>
            {formatNumber(t.nextCost, 2)} E
          </td>
          <td class="c-buy">
            {#if t.unlocked}
              <button
                class="buy"
                class:dim={!t.affordable}
                disabled={!t.affordable}
                on:click={() => onBuy(t.tier, mode)}>구매</button>
            {:else}
              <span class="lock">잠금</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .chain {
    width: 100%;
    max-width: 460px;
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
    padding: var(--space-base);
  }
  .chain-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-sm);
  }
  .title {
    font-size: var(--text-label-md);
    color: var(--foreground-sub);
    font-family: var(--font-label);
  }
  .modes {
    display: flex;
    gap: var(--space-xs);
  }
  .mode-btn {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
    padding: 3px 8px;
    cursor: pointer;
  }
  .mode-btn.active {
    color: var(--primary);
    border-color: var(--primary);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-numeric);
  }
  th {
    text-align: right;
    font-family: var(--font-label);
    font-weight: 400;
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
    padding: 2px var(--space-sm);
    border-bottom: 1px solid var(--border);
  }
  th.c-tier {
    text-align: left;
  }
  td {
    text-align: right;
    font-size: var(--text-num-md);
    color: var(--foreground);
    padding: var(--space-xs) var(--space-sm);
    white-space: nowrap;
  }
  td.c-tier {
    text-align: left;
    color: var(--foreground-sub);
  }
  tr.locked {
    opacity: 0.25;
  }
  .best {
    color: var(--primary);
    margin-left: 4px;
  }
  .c-cost.poor {
    color: var(--col-reset);
  }
  .c-owned {
    color: var(--depth);
  }

  .buy {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
    padding: 4px 10px;
    min-height: 28px;
    cursor: pointer;
  }
  .buy:not(.dim):hover {
    border-color: var(--primary);
  }
  .buy.dim {
    opacity: 0.4;
    cursor: default;
  }
  .lock {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
  }
</style>
