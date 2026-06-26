<script lang="ts">
  /**
   * OfflineModal — 오프라인 복귀 (ui-flow §10). 우주적 현미경 재구성(2단계): 카드+라인아이콘 →
   *  **복귀 로그**. 테두리 없는 획득 행(자원=색 글자 글리프, generic 아이콘 F4 폐기) · 효율 게이지 →
   *  헤더 한 줄로 강등 · 탈채도 공허 팔레트. 단방향(§4.1): offline 스냅샷만 읽고 닫기는 onDismiss 위임.
   */
  import type { OfflineSnapshot } from '../game';
  import { formatNumber, formatDuration } from '../core/format';

  export let offline: OfflineSnapshot;
  /** 확인(모달 닫기) 위임 — 부모가 game.dismissOffline 호출. */
  export let onDismiss: () => void;

  $: effPct = Math.round(offline.modifier * 100);
  $: isPrestigeBonus = offline.modifier >= 1;

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onDismiss();
  }
</script>

<svelte:window on:keydown={onKey} />

<div class="om-backdrop">
  <button class="om-scrim" aria-label="닫기" on:click={onDismiss}></button>
  <section class="om-modal" role="dialog" aria-modal="true" aria-label="오프라인 복귀">
    <header class="om-head">
      <span class="om-title">오프라인 압축 진행</span>
      <span class="om-elapsed">{formatDuration(offline.rawSeconds)} 동안 압축이 진행됐습니다.</span>
      <span class="om-eff"
        >유효 환산 {formatDuration(offline.effectiveSeconds)} · 효율 <span class="om-eff-pct"
          >{effPct}%</span
        > (×{offline.modifier.toFixed(2)})</span>
    </header>

    <!-- 획득 = 테두리 없는 로그 행. 자원 = 색 글자 글리프(E 금·C 청·D 보라). -->
    <ul class="om-gains" role="list">
      <li class="om-gain">
        <span class="om-sym res-energy">E</span>
        <span class="om-g-name">압축 에너지</span>
        <span class="om-g-val">+{formatNumber(offline.dE)}</span>
      </li>
      <li class="om-gain">
        <span class="om-sym res-depth">C</span>
        <span class="om-g-name">압축 깊이</span>
        <span class="om-g-val">+{formatNumber(offline.dC)}</span>
      </li>
      {#if offline.dD.gt(0)}
        <li class="om-gain">
          <span class="om-sym res-data">D</span>
          <span class="om-g-name">발견 데이터</span>
          <span class="om-g-val">+{formatNumber(offline.dD)}</span>
        </li>
      {/if}
    </ul>

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
  .om-scrim {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    background: color-mix(in srgb, #020407 66%, transparent);
    backdrop-filter: blur(3px);
    cursor: default;
  }
  /* 컨테이너 — 카드 테두리 폐기, 부드러운 공허 패널. 탈채도 토큰 remap(§7-C#2). */
  .om-modal {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 360px;
    background: color-mix(in srgb, #0a1014 92%, transparent);
    border-radius: 14px;
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 0 60px rgba(0, 0, 0, 0.7);
    --canvas-layer: #0b1016;
    --surface: #121a22;
    --border: #1c2733;
    --foreground: #e2eef4;
    --foreground-sub: #8ba0ad;
    --foreground-dim: #4b5d69;
    --qf: #a8c4b6;
    --energy: #d9b86a;
    --depth: #7a9fc0;
    --data: #9a8fc0;
  }
  .om-head {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-bottom: 10px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
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
    color: var(--foreground-dim);
  }
  .om-eff-pct {
    color: var(--qf);
  }

  /* 획득 로그 행 — 테두리 0. [글자] 이름 … 값. */
  .om-gains {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .om-gain {
    display: grid;
    grid-template-columns: 18px 1fr auto;
    align-items: baseline;
    gap: 10px;
    padding: 7px 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
  }
  .om-gain:last-child {
    border-bottom: none;
  }
  .om-sym {
    font-family: var(--font-numeric);
    font-size: var(--text-label-md);
    font-weight: 500;
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
  }
  .om-note.bonus {
    color: var(--qf);
    opacity: 1;
  }

  /* 확인 = 조용한 발광 알약(QF 톤). */
  .om-confirm {
    align-self: stretch;
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--qf);
    background: color-mix(in srgb, var(--qf) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--qf) 40%, transparent);
    border-radius: 999px;
    padding: 10px;
    min-height: 42px;
    cursor: pointer;
    transition:
      box-shadow 0.25s ease,
      background 0.25s ease;
  }
  .om-confirm:hover {
    background: color-mix(in srgb, var(--qf) 14%, transparent);
    box-shadow: 0 0 16px color-mix(in srgb, var(--qf) 30%, transparent);
  }
  .om-confirm:active {
    transform: scale(var(--motion-click-scale, 0.97));
  }
</style>
