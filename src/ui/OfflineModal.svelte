<script lang="ts">
  /**
   * OfflineModal — 오프라인 복귀 모달 (SCR-06, ui-flow §10). M1.7.
   *  로드 시 elapsed>60s면 표시. 자리비움 시간·유효 온라인 환산(×modifier)·획득 자원(E/C/D).
   *  카운트업 없음 — 최종 증가량 즉시 표시(§10-B). Escape/확인으로 닫기(부모가 dismiss).
   *
   *  단방향(§4.1): offline 스냅샷만 읽고, 닫기는 onDismiss 콜백 위임.
   */
  import type { OfflineSnapshot } from '../game';
  import { formatNumber, formatDuration } from '../core/format';
  import Icon from './icons/Icon.svelte';

  export let offline: OfflineSnapshot;
  /** 확인(모달 닫기) 위임 — 부모가 game.dismissOffline 호출. */
  export let onDismiss: () => void;

  // 효율 퍼센트(modifier 0.65→65% / 1.0→100% 상전이 직후).
  $: effPct = Math.round(offline.modifier * 100);
  $: isPrestigeBonus = offline.modifier >= 1;

  // Escape로 닫기(ui-flow §10-B).
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onDismiss();
  }
</script>

<svelte:window on:keydown={onKey} />

<div class="om-backdrop">
  <!-- 배경 클릭으로 닫기: 접근성 위해 투명 버튼(모달 뒤 전체 덮음). -->
  <button class="om-scrim" aria-label="닫기" on:click={onDismiss}></button>
  <section class="om-modal" role="dialog" aria-modal="true" aria-label="오프라인 복귀">
    <header class="om-head">
      <span class="om-title">오프라인 압축 진행</span>
      <span class="om-elapsed">{formatDuration(offline.rawSeconds)} 동안 압축이 진행됐습니다.</span>
      <span class="om-eff dim">
        유효 온라인 환산: {formatDuration(offline.effectiveSeconds)} (×{offline.modifier.toFixed(2)})
      </span>
    </header>

    <div class="om-eff-bar">
      <span class="om-eff-label">오프라인 효율</span>
      <span class="om-eff-pct">{effPct}%</span>
    </div>

    <div class="om-gains">
      <div class="om-gain">
        <span class="om-g-icon res-energy"><Icon name="energy" /></span>
        <span class="om-g-name">압축 에너지 E</span>
        <span class="om-g-val">+{formatNumber(offline.dE)}</span>
      </div>
      <div class="om-gain">
        <span class="om-g-icon res-depth"><Icon name="depth" /></span>
        <span class="om-g-name">압축 깊이 C</span>
        <span class="om-g-val">+{formatNumber(offline.dC)}</span>
      </div>
      {#if offline.dD.gt(0)}
        <div class="om-gain">
          <span class="om-g-icon res-data"><Icon name="data" /></span>
          <span class="om-g-name">발견 데이터 D</span>
          <span class="om-g-val">+{formatNumber(offline.dD)}</span>
        </div>
      {/if}
    </div>

    {#if isPrestigeBonus}
      <p class="om-note bonus">복귀 보너스 활성 — 생산 효율 100%.</p>
    {:else if offline.cappedHit}
      <p class="om-note">24시간 상한 도달 — 이후 진행은 적용되지 않았습니다.</p>
    {:else}
      <p class="om-note">메커니즘은 방치 기본 효율로 오프라인에 적용됩니다.</p>
    {/if}

    <button class="om-confirm" on:click={onDismiss}>확인</button>
  </section>
</div>

<style>
  .om-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: var(--space-md);
  }
  /* 전체 덮는 투명 클릭 영역(배경 클릭 = 닫기). 모달은 z-index로 위에. */
  .om-scrim {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    background: color-mix(in srgb, #000 65%, transparent);
    cursor: default;
  }
  .om-modal {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 380px;
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-base);
    box-shadow: 0 8px 32px color-mix(in srgb, #000 50%, transparent);
  }
  .om-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--border);
  }
  .om-title {
    font-family: var(--font-label);
    font-size: var(--text-label-lg);
    color: var(--foreground);
  }
  .om-elapsed {
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
  }
  .om-eff {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
  }
  .dim {
    color: var(--foreground-dim);
  }

  .om-eff-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xs) var(--space-sm);
    background: var(--surface);
    border-radius: var(--rounded-sm);
  }
  .om-eff-label {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }
  .om-eff-pct {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--qf);
  }

  .om-gains {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .om-gain {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-base);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
  }
  .om-g-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .res-energy {
    color: var(--energy);
  }
  .res-depth {
    color: var(--depth);
  }
  .res-data {
    color: var(--data);
  }
  .om-g-name {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }
  .om-g-val {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--foreground);
  }

  .om-note {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.85;
    text-align: center;
  }
  .om-note.bonus {
    color: var(--qf);
    opacity: 1;
  }

  .om-confirm {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--layer-accent);
    background: var(--surface);
    border: 1px solid var(--layer-accent);
    border-radius: var(--rounded-md);
    padding: 12px 24px;
    min-height: 44px;
    cursor: pointer;
    transition: transform var(--motion-click-duration) ease-out;
  }
  .om-confirm:active {
    transform: scale(var(--motion-click-scale));
  }
</style>
