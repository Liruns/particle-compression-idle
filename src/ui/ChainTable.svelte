<script lang="ts">
  /**
   * ChainTable — 8단 압축기 체인. (ui-flow §2-D / layout-visual-study §3 P0-2: AD 행 패턴)
   *  AD(Antimatter Dimensions) 행 레이아웃 이식:
   *   - 비용을 구매 버튼 *안으로*([구매 · 438 E] 한 클릭 타깃, D6 해결).
   *   - 버튼 색 = 상태: 구매가능=녹(keep)/E부족=암적(reset)/잠금=회색(D4 해결).
   *   - 행 배경 틴트: 보유>0/활성=옅은 층악센트 밴드, 잠금=거의 투명(D2 위계).
   *   - 행간 압축: 8행이 듬성→촘촘한 한 덩어리 리스트.
   *  단방향: 스냅샷(tiers)을 받아 표시만, 구매는 onBuy 콜백 위임(§4.1). 로직 불변.
   */
  import type { TierSnapshot, BuyMode } from '../game';
  import { formatNumber } from '../core/format';
  import Icon from './icons/Icon.svelte';

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

  <!-- AD 행 리스트(테이블→행 div). 행: [T# 배율(좌)] [보유·생산율(중)] [비용 박힌 구매 버튼(우)]. -->
  <ul class="rows" role="list">
    {#each tiers as t (t.tier)}
      {@const active = t.unlocked && t.owned.gt(0)}
      <li
        class="row"
        class:locked={!t.unlocked}
        class:active
        class:best={t.tier === bestTier}>
        <!-- 좌: 티어 식별 + 최적 배지 -->
        <span class="r-id">
          <span class="r-tier">T{t.tier}</span>
          {#if t.tier === bestTier}<span class="r-best" title="최적 구매 티어"
              ><Icon name="best" size={12} label="최적 구매 티어" /></span>{/if}
        </span>

        <!-- 중: 보유 수(큰) + 생산율(작은, 라이브 피드백) -->
        <span class="r-stat">
          <span class="r-owned">{formatNumber(t.owned, 0)}</span>
          <span class="r-rate">
            {#if t.owned.gt(0)}+{formatNumber(t.rate, 2)}<span class="r-rate-u">/s</span>{:else}<span
                class="r-rate-dim">—</span>{/if}
          </span>
        </span>

        <!-- 우: 비용 박힌 구매 버튼(색=상태) / 잠금 -->
        {#if t.unlocked}
          <button
            class="r-buy"
            class:afford={t.affordable}
            class:poor={!t.affordable}
            disabled={!t.affordable}
            on:click={() => onBuy(t.tier, mode)}
            title={t.affordable ? '' : `E 부족 — ${formatNumber(t.nextCost, 2)} E 필요`}>
            <span class="r-buy-lbl">구매</span>
            <span class="r-buy-cost">{formatNumber(t.nextCost, 2)} E</span>
          </button>
        {:else}
          <span class="r-lock">
            <span class="r-lock-lbl">잠금</span>
            <span class="r-lock-cost">{formatNumber(t.nextCost, 2)} E</span>
          </span>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  /* 폭은 부모 그리드 셀이 결정. 좌측 accent 띠로 현재 층 컨텍스트(visual §4-B). */
  .chain {
    width: 100%;
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-left: 2px solid color-mix(in srgb, var(--layer-accent) 40%, var(--border));
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
    gap: var(--space-sm); /* 터치 간격(ux §P0-5) */
  }
  /* 대량구매 모드 버튼 — min-height 32px(AA 24 충족 + 권장). */
  .mode-btn {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    font-weight: 500;
    color: var(--foreground-sub);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
    padding: 4px 10px;
    min-height: 32px;
    cursor: pointer;
  }
  .mode-btn.active {
    color: var(--primary);
    border-color: var(--primary);
  }

  /* ── AD 행 리스트(촘촘한 한 덩어리, D2) ── */
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px; /* 행간 압축 — 8행이 한 덩어리 */
  }
  /* 행: 좌 식별 / 중 stat(가변) / 우 버튼. 그리드로 정렬 안정. */
  .row {
    display: grid;
    grid-template-columns: minmax(34px, auto) 1fr minmax(0, auto);
    align-items: center;
    column-gap: var(--space-sm);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--rounded-sm);
    /* 행 배경 틴트(AD): 기본은 거의 투명, 활성/잠금은 아래서 분기. */
    background: color-mix(in srgb, var(--layer-accent) 2%, transparent);
    border: 1px solid transparent;
    transition:
      background var(--motion-fade-cross) ease-out,
      border-color var(--motion-fade-cross) ease-out;
  }
  /* 활성 티어(보유>0): 옅은 층악센트 밴드(opacity ~0.05) + 좌측 라인. */
  .row.active {
    background: color-mix(in srgb, var(--layer-accent) 6%, transparent);
    border-color: color-mix(in srgb, var(--layer-accent) 14%, transparent);
  }
  /* 잠금 행: 배경 거의 투명 + 톤 다운(예고로만 보이되 밀집). */
  .row.locked {
    background: color-mix(in srgb, var(--foreground-dim) 4%, transparent);
    opacity: 0.5;
  }
  /* 최적 구매 티어: accent 좌측 강조(스캔 유도). */
  .row.best:not(.locked) {
    border-color: color-mix(in srgb, var(--layer-accent) 30%, transparent);
  }

  /* 좌: 티어 식별 */
  .r-id {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-width: 0;
  }
  .r-tier {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--foreground-sub);
  }
  .row.active .r-tier {
    color: var(--layer-accent);
  }
  .r-best {
    color: var(--primary);
    display: inline-flex;
    vertical-align: middle;
  }

  /* 중: 보유(큰) + 생산율(작은). 우정렬로 수치 라인 정돈. */
  .r-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.1;
    min-width: 0;
  }
  .r-owned {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--depth);
  }
  .r-rate {
    font-family: var(--font-numeric);
    font-size: var(--text-label-xs);
    color: var(--foreground-sub);
  }
  .r-rate-u {
    color: var(--foreground-dim);
  }
  .r-rate-dim {
    color: var(--foreground-dim);
  }

  /* 우: 비용 박힌 구매 버튼(색=상태). 버튼 안 2단(레이블/비용) — AD 패턴. */
  .r-buy {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    line-height: 1.15;
    min-height: 40px;
    min-width: 96px;
    padding: 3px 10px;
    border-radius: var(--rounded-sm);
    border: 1px solid;
    font-family: var(--font-label);
    cursor: pointer;
    transition:
      background var(--motion-purchase-tint) ease-out,
      border-color var(--motion-fade-cross) ease-out;
  }
  .r-buy-lbl {
    font-size: var(--text-label-sm);
    font-weight: 500;
  }
  .r-buy-cost {
    font-family: var(--font-numeric);
    font-size: var(--text-label-xs);
  }
  /* 구매 가능 = 녹(keep 계열). 채워진 느낌으로 "지금 누를 것" 신호. */
  .r-buy.afford {
    color: var(--col-keep);
    border-color: color-mix(in srgb, var(--col-keep) 55%, var(--border));
    background: color-mix(in srgb, var(--col-keep) 12%, transparent);
  }
  .r-buy.afford:hover {
    border-color: var(--col-keep);
    background: color-mix(in srgb, var(--col-keep) 20%, transparent);
  }
  .r-buy.afford:active {
    transform: scale(var(--motion-purchase-scale));
  }
  /* E 부족 = 암적(reset 계열). 비활성이지만 비용은 읽히게(목표 제시). */
  .r-buy.poor {
    color: color-mix(in srgb, var(--col-reset) 80%, var(--foreground-sub));
    border-color: color-mix(in srgb, var(--col-reset) 35%, var(--border));
    background: color-mix(in srgb, var(--col-reset) 7%, transparent);
    cursor: not-allowed;
  }
  .r-buy.poor .r-buy-cost {
    color: var(--col-reset);
  }

  /* 잠금 = 회색(클릭 불가). 비용은 흐리게 예고. */
  .r-lock {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.15;
    min-height: 40px;
    min-width: 96px;
    padding: 3px 10px;
    border-radius: var(--rounded-sm);
    border: 1px solid var(--border);
  }
  .r-lock-lbl {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
  }
  .r-lock-cost {
    font-family: var(--font-numeric);
    font-size: var(--text-label-xs);
    color: var(--foreground-dim);
  }
</style>
