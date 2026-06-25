<script lang="ts">
  /**
   * LayerCard — 현재 층 카드 (ui-flow §2 RIGHT PANEL 층 카드).
   *  층명(양언어) + decade 범위 + 메커니즘 이름 + 스케일. data-layer 악센트 토큰을 따른다.
   *  M1.3: 메커니즘은 이름만(자리 표시). 풀 메커니즘 위젯은 M1.4.
   */
  import type { LayerSnapshot } from '../game';

  export let layer: LayerSnapshot;
  /** FTUE: 메커니즘 위젯 자리 노출 여부(원자층+). */
  export let showMechanism = false;

  $: decRange = `dec ${layer.decadeRange[0]}${
    layer.decadeRange[1] !== layer.decadeRange[0] ? `–${layer.decadeRange[1]}` : ''
  }`;
</script>

<aside class="layer-card">
  <div class="lc-head">
    <span class="lc-name-ko">{layer.nameKo}</span>
    <span class="lc-name-en">{layer.nameEn}</span>
  </div>
  <div class="lc-meta">
    <span class="lc-scale">{layer.scaleM} m</span>
    <span class="lc-dec">{decRange}</span>
  </div>

  {#if showMechanism}
    <div class="lc-mech">
      <span class="lc-mech-label">메커니즘</span>
      <span class="lc-mech-name">{layer.mechanismNameKo}</span>
      <span class="lc-mech-soon">곧</span>
    </div>
  {/if}

  {#if layer.nearBoundary}
    <p class="lc-boundary">알려진 입자 경계 근접</p>
  {/if}
</aside>

<style>
  .layer-card {
    width: 100%;
    max-width: 460px;
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-left: 2px solid var(--layer-accent);
    border-radius: var(--rounded-md);
    padding: var(--space-base);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .lc-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }
  .lc-name-ko {
    font-family: var(--font-label);
    font-size: var(--text-label-lg);
    color: var(--layer-accent);
    font-weight: 500;
  }
  .lc-name-en {
    font-family: var(--font-narrative);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
    letter-spacing: 0.04em;
  }
  .lc-meta {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
  }
  .lc-scale {
    color: var(--foreground);
  }
  .lc-dec {
    color: var(--foreground-sub);
  }
  .lc-mech {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding-top: var(--space-sm);
    border-top: 1px solid var(--border);
  }
  .lc-mech-label {
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
    font-family: var(--font-label);
  }
  .lc-mech-name {
    font-size: var(--text-label-md);
    color: var(--foreground-sub);
    flex: 1;
  }
  .lc-mech-soon {
    font-size: var(--text-label-sm);
    color: var(--layer-accent);
    opacity: 0.6;
    border: 1px solid var(--layer-accent);
    border-radius: var(--rounded-sm);
    padding: 1px 5px;
  }
  .lc-boundary {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.75;
  }
</style>
