<script lang="ts">
  /**
   * HarmonicsWidget — 진동 하모닉스 위젯 (끈층 L7, ui-flow §2-E / systems §2-F). M1.6.
   *  위상 겹침(상태 선택)·오비탈 공명(타이밍 클릭)과 또 다른 결: **수동 없음 — 예측 게임**.
   *  진동 에너지 V가 차오르고, 임계마다 8단 체인의 한 티어가 순환적으로 폭발(공명)한다.
   *  "다음 공명 티어가 무엇인가"를 미리 보고 그 티어에 투자하는 전술(systems §2-F).
   *
   *  비주얼: V 에너지 바(다음 공명까지) + 8티어 도트 행(다음 공명 티어 강조 + 현재 폭발 티어 글로우).
   *  따뜻한 자홍(--layer-str-accent #ff4081) — 끈층 토큰.
   *
   *  단방향(§4.1): 표시는 snapshot.harmonics만(조작 없음 — 자동 진행).
   */
  import type { HarmonicsSnapshot } from '../game';

  export let harmonics: HarmonicsSnapshot;

  const TIERS = [1, 2, 3, 4, 5, 6, 7, 8];
  $: bursting = new Set(harmonics.burstingTiers);
</script>

{#if harmonics.active}
  <div class="harm">
    <div class="hm-head">
      <span class="hm-title">진동 하모닉스</span>
      <span class="hm-count">공명 {harmonics.totalResonances}</span>
    </div>

    <!-- V 에너지 바 — 다음 공명까지 충전. -->
    <div class="hm-vbar" aria-label="진동 에너지">
      <span class="hm-vfill" style="--p: {harmonics.chargeProgress}"></span>
    </div>

    <!-- 8티어 도트 — 다음 공명 티어 강조 + 현재 폭발 글로우. -->
    <div class="hm-tiers" role="group" aria-label="공명 스케줄">
      {#each TIERS as t (t)}
        <span
          class="hm-dot"
          class:next={t === harmonics.nextTier}
          class:burst={bursting.has(t)}
          title={t === harmonics.nextTier ? `다음 공명: T${t}` : `T${t}`}>
          {t}
        </span>
      {/each}
    </div>

    <p class="hm-hint">
      다음 공명 — <strong>T{harmonics.nextTier}</strong> 폭발 예정
    </p>
  </div>
{/if}

<style>
  .harm {
    width: 100%;
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-left: 2px solid var(--layer-accent);
    border-radius: var(--rounded-md);
    padding: var(--space-base);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .hm-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .hm-title {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--layer-accent);
  }
  .hm-count {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
  }

  /* V 에너지 바 — 가로 충전. */
  .hm-vbar {
    width: 100%;
    height: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-full);
    overflow: hidden;
  }
  .hm-vfill {
    display: block;
    height: 100%;
    width: calc(var(--p, 0) * 100%);
    background: var(--layer-accent);
    opacity: 0.85;
    transition: width 120ms linear;
  }

  /* 8티어 도트 행. */
  .hm-tiers {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: var(--space-xs);
  }
  .hm-dot {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    min-height: 26px;
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
    transition:
      border-color var(--motion-click-glow) ease-out,
      box-shadow var(--motion-click-glow) ease-out;
  }
  /* 다음 공명 티어 — 악센트 테두리(예측 강조). */
  .hm-dot.next {
    border-color: var(--layer-accent);
    color: var(--layer-accent);
  }
  /* 현재 폭발 티어 — 글로우 펄스. */
  .hm-dot.burst {
    border-color: var(--layer-accent);
    color: var(--canvas);
    background: var(--layer-accent);
    box-shadow: 0 0 10px var(--layer-glow, var(--col-glow-core));
    animation: hm-pulse var(--motion-resonance-pulse, 900ms) ease-in-out infinite;
  }

  .hm-hint {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.85;
    text-align: center;
  }
  .hm-hint strong {
    color: var(--layer-accent);
  }

  @keyframes hm-pulse {
    0%,
    100% {
      box-shadow: 0 0 6px var(--layer-glow, var(--col-glow-core));
    }
    50% {
      box-shadow: 0 0 14px var(--layer-glow, var(--col-glow-core));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hm-vfill {
      transition: none;
    }
    .hm-dot.burst {
      animation: none;
    }
  }
</style>
