<script lang="ts">
  /**
   * ResearchView — 연구 트리(PoE 패시브 트리 방식). 리스트가 아니라 **공간 그래프**:
   *  중앙 연구 코어에서 세 가지(만지기·데이터/공명·티어)가 방사, 간선이 선행 관계를 그린다.
   *  상태는 빛으로 — 기록됨=가지색 발광, 해금(인접)=링 맥동(다음 목표 유혹), 잠금=흐림.
   *  호버/포커스 = PoE식 툴팁 카드. 구매 위임(game.buyResearch) — 로직·경제·세이브 0 터치
   *  (좌표 pos는 data의 표현 전용 필드, 해금 규칙은 기존 선행 그래프 그대로).
   */
  import type { GameSnapshot } from '../game';
  import { formatNumber } from '../core/format';
  import { RESEARCH_NODES, researchNodeById, type ResearchNode } from '../data/research';

  export let research: GameSnapshot['research'];
  /** 현재 D 보유. */
  export let dCurrent: import('../core/bignum').Decimal;
  /** 노드 구매 위임(부모가 game.buyResearch 호출). */
  export let onBuy: (nodeId: string) => void;

  type SnapNode = GameSnapshot['research']['nodes'][number];

  /** 시작점(연구 코어) — 노드 아님. 루트 간선이 여기서 뻗는다(항상 "기록됨" 취급). */
  const CORE = { x: 50, y: 58 };

  /** 간선(정적 — 선행 그래프 + 코어→루트). */
  const EDGES = RESEARCH_NODES.flatMap((n) =>
    n.prerequisites.length === 0
      ? [{ fromId: '__core', toId: n.id, from: CORE, to: n.pos }]
      : n.prerequisites.map((p) => ({ fromId: p, toId: n.id, from: researchNodeById(p)!.pos, to: n.pos })),
  );

  $: snapById = new Map<string, SnapNode>(research.nodes.map((n) => [n.id, n]));

  /** 간선 상태: lit=양끝 기록됨 / open=선행 기록·다음 해금(다음 걸음 안내) / dim. */
  function edgeState(map: Map<string, SnapNode>, fromId: string, toId: string): 'lit' | 'open' | 'dim' {
    const to = map.get(toId);
    const fromPurchased = fromId === '__core' ? true : (map.get(fromId)?.purchased ?? false);
    if (!to) return 'dim';
    if (fromPurchased && to.purchased) return 'lit';
    if (fromPurchased && to.unlocked) return 'open';
    return 'dim';
  }

  /** 노드 크기 계급(PoE: 소형/주목/키스톤). */
  function nodeRadius(n: ResearchNode): number {
    if (n.effect.kind === 'auto_resonance') return 5.2; // 키스톤(플레이 방식 변경)
    if (n.effect.kind === 'tier_mult' || n.effect.kind === 'resonance_combo_max') return 3.9; // 주목
    return 3.1; // 소형
  }
  /** 가지 색(발광). */
  function branchColor(n: ResearchNode): string {
    if (n.effect.kind === 'auto_resonance') return 'var(--qf, #7ec8c0)';
    if (n.branch === 'CHAIN') return 'var(--energy, #d9b86a)';
    return 'var(--data, #9a8fc0)';
  }

  /** 호버/포커스 툴팁. */
  let hoverId: string | null = null;
  $: hoverDef = hoverId ? researchNodeById(hoverId) : undefined;
  $: hoverSnap = hoverId ? snapById.get(hoverId) : undefined;
  /** 툴팁 배치 — 위쪽 노드는 아래로 뒤집기(패널 밖 잘림 방지). */
  $: tipBelow = (hoverDef?.pos.y ?? 50) < 34;

  function tryBuy(node: SnapNode): void {
    if (node.purchased || !node.unlocked || !node.affordable) return;
    onBuy(node.id);
  }
  function onNodeKey(e: KeyboardEvent, node: SnapNode): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tryBuy(node);
    }
  }
</script>

<section class="research">
  <header class="rs-top">
    <span class="rs-title">연구소</span>
    <span class="rs-meta">
      <span class="rs-count">{research.branchProgress[0]}/{research.branchProgress[1]}</span>
      <span class="rs-d"><span class="rs-d-sym">D</span> {formatNumber(dCurrent)}</span>
    </span>
  </header>

  <div class="rs-tree">
    <svg viewBox="0 0 100 100" role="group" aria-label="연구 트리 — 코어에서 뻗는 노드를 눌러 연구">
      <!-- 간선(선행 관계). 기록된 길=밝음, 다음 걸음=중간, 먼 길=흐림. -->
      {#each EDGES as e (e.fromId + '>' + e.toId)}
        <line
          class="rs-edge {edgeState(snapById, e.fromId, e.toId)}"
          x1={e.from.x}
          y1={e.from.y}
          x2={e.to.x}
          y2={e.to.y} />
      {/each}

      <!-- 시작점: 연구 코어(항상 점등 — 트리의 심장). -->
      <g class="rs-core" aria-hidden="true">
        <circle cx={CORE.x} cy={CORE.y} r="4.6" class="core-halo" />
        <circle cx={CORE.x} cy={CORE.y} r="2.2" class="core-dot" />
      </g>

      <!-- 노드: 기록됨=채움 발광 / 해금=링 맥동(구매가능시 가지색) / 잠금=흐림. -->
      {#each RESEARCH_NODES as def (def.id)}
        {@const node = snapById.get(def.id)}
        {#if node}
          {@const r = nodeRadius(def)}
          {@const col = branchColor(def)}
          {@const buyable = node.unlocked && !node.purchased && node.affordable}
          <g
            class="rs-node"
            class:purchased={node.purchased}
            class:open={node.unlocked && !node.purchased}
            class:buyable
            class:locked={!node.unlocked && !node.purchased}
            style="--nc: {col};"
            role="button"
            aria-label="{def.nameKo} — {node.purchased ? '기록됨' : node.unlocked ? `연구 −${def.costD} D` : '잠금'}"
            aria-disabled={!buyable}
            tabindex={node.unlocked && !node.purchased ? 0 : -1}
            on:click={() => tryBuy(node)}
            on:keydown={(e) => onNodeKey(e, node)}
            on:pointerenter={() => (hoverId = def.id)}
            on:pointerleave={() => (hoverId = null)}
            on:focus={() => (hoverId = def.id)}
            on:blur={() => (hoverId = null)}>
            <circle class="n-hit" cx={def.pos.x} cy={def.pos.y} r={r + 3.2} />
            <circle class="n-halo" cx={def.pos.x} cy={def.pos.y} r={r + 2.2} />
            <circle class="n-ring" cx={def.pos.x} cy={def.pos.y} {r} />
            <circle class="n-fill" cx={def.pos.x} cy={def.pos.y} r={Math.max(1.1, r - 1.4)} />
          </g>
        {/if}
      {/each}
    </svg>

    <!-- PoE식 호버 카드 — 노드 좌표에 떠서 이름·효과·비용/상태·플레이버. -->
    {#if hoverDef && hoverSnap}
      <div
        class="rs-tip"
        class:below={tipBelow}
        style="left: {hoverDef.pos.x}%; top: {hoverDef.pos.y}%;"
        aria-hidden="true">
        <span class="tip-name">{hoverDef.nameKo}{#if hoverSnap.purchased}<span class="tip-check"> ✓</span>{/if}</span>
        <span class="tip-effect">{hoverDef.effectKo}</span>
        {#if hoverSnap.purchased}
          <span class="tip-state done">기록됨</span>
        {:else if !hoverSnap.unlocked}
          <span class="tip-state lock">잠금 — 선행: {hoverSnap.prereqNamesKo.join(', ') || '—'}</span>
        {:else}
          <span class="tip-state" class:can={hoverSnap.affordable}>연구 −{hoverDef.costD} D{hoverSnap.affordable ? '' : ' (부족)'}</span>
        {/if}
        <span class="tip-flavor">{hoverDef.flavorKo}</span>
      </div>
    {/if}
  </div>

  <p class="rs-note">
    발견(도감)이 연구 데이터 D를 준다. 코어에서 이어진 노드만 연구 가능 — 산 노드가 다음 길을 연다.
    상전이·재하강에 보존됩니다.
  </p>
</section>

<style>
  .research {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
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
  .rs-meta {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  .rs-count {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
  }
  .rs-d {
    font-family: var(--font-numeric);
    font-size: var(--text-label-md);
    color: var(--data);
  }
  .rs-d-sym {
    opacity: 0.7;
  }

  /* 트리 캔버스 — 정사각 유지(좌표계 보존), 어두운 심연 위 빛. */
  .rs-tree {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    max-height: min(62vh, 480px);
  }
  .rs-tree svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* 간선 — 길 자체가 진행 표시. */
  .rs-edge {
    stroke: rgba(150, 166, 174, 0.14);
    stroke-width: 0.45;
  }
  .rs-edge.open {
    stroke: rgba(180, 196, 214, 0.38);
    stroke-width: 0.55;
  }
  .rs-edge.lit {
    stroke: color-mix(in srgb, var(--data, #9a8fc0) 75%, white 10%);
    stroke-width: 0.7;
    filter: drop-shadow(0 0 1px color-mix(in srgb, var(--data, #9a8fc0) 60%, transparent));
  }

  /* 코어. */
  .core-halo {
    fill: color-mix(in srgb, var(--data, #9a8fc0) 16%, transparent);
  }
  .core-dot {
    fill: color-mix(in srgb, var(--data, #9a8fc0) 85%, white 15%);
  }

  /* 노드 — 상태는 빛(테두리/카드 0). */
  .rs-node {
    cursor: default;
    outline: none;
  }
  .n-hit {
    fill: transparent; /* 히트 영역 확장(작은 노드도 누르기 쉽게) */
  }
  .n-halo {
    fill: transparent;
    transition: fill 0.25s ease;
  }
  .n-ring {
    fill: rgba(8, 11, 14, 0.85);
    stroke: rgba(150, 166, 174, 0.3);
    stroke-width: 0.5;
    transition: stroke 0.25s ease;
  }
  .n-fill {
    fill: transparent;
    transition: fill 0.25s ease;
  }
  /* 잠금 — 물러남. */
  .rs-node.locked .n-ring {
    stroke: rgba(150, 166, 174, 0.14);
  }
  /* 해금(인접) — 링이 깨어남. 구매가능이면 가지색 맥동(다음 걸음 유혹). */
  .rs-node.open {
    cursor: pointer;
  }
  .rs-node.open .n-ring {
    stroke: rgba(200, 214, 224, 0.55);
  }
  .rs-node.buyable .n-ring {
    stroke: var(--nc);
    animation: node-pulse 2.2s ease-in-out infinite;
  }
  .rs-node.buyable .n-halo {
    fill: color-mix(in srgb, var(--nc) 10%, transparent);
  }
  /* 기록됨 — 채움 발광(내 빌드의 일부). */
  .rs-node.purchased .n-fill {
    fill: color-mix(in srgb, var(--nc) 80%, white 8%);
  }
  .rs-node.purchased .n-ring {
    stroke: color-mix(in srgb, var(--nc) 65%, transparent);
  }
  .rs-node.purchased .n-halo {
    fill: color-mix(in srgb, var(--nc) 13%, transparent);
  }
  .rs-node:focus-visible .n-ring {
    stroke: white;
    stroke-width: 0.8;
  }
  @keyframes node-pulse {
    0%,
    100% {
      stroke-width: 0.5;
      opacity: 1;
    }
    50% {
      stroke-width: 1;
      opacity: 0.75;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rs-node.buyable .n-ring {
      animation: none;
    }
  }

  /* PoE식 호버 카드 — 노드 위(위쪽 노드는 아래로). */
  .rs-tip {
    position: absolute;
    transform: translate(-50%, calc(-100% - 12px));
    min-width: 170px;
    max-width: 230px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 9px 11px;
    background: color-mix(in srgb, #0a1014 92%, transparent);
    border-radius: 9px;
    box-shadow: 0 0 24px rgba(0, 0, 0, 0.65);
    pointer-events: none;
    z-index: 3;
  }
  .rs-tip.below {
    transform: translate(-50%, 14px);
  }
  .tip-name {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--foreground);
  }
  .tip-check {
    color: var(--col-keep);
  }
  .tip-effect {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--primary);
  }
  .tip-state {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
  }
  .tip-state.can {
    color: var(--data);
  }
  .tip-state.done {
    color: var(--col-keep);
  }
  .tip-state.lock {
    color: var(--foreground-dim);
  }
  .tip-flavor {
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    line-height: 1.45;
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
