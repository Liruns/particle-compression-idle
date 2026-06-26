<script lang="ts">
  /**
   * ResonanceWidget — 오비탈 공명 슬롯 위젯 (원자층 L2, ui-flow §2-E / systems §2-A). M1.4.
   *  ○ 원형 공명 슬롯 + 카운트다운 링(SVG). 슬롯이 열리면(open) 청록 글로우가 맥동하며
   *  클릭을 유도한다. 유효 시간 안에 클릭하면 공명 배율 ×1.5 + D 획득(성공 글로우 버스트).
   *  놓치면 방치 자동 공명이 낮은 효율로 처리(필러 ③ — 방치도 진행, 개입이 더 강함).
   *
   *  주스(DESIGN §5): 클릭 스쿼시(scale 0.92) + 성공 글로우 버스트(200ms). 모든 모션 토큰은
   *  prefers-reduced-motion에서 감쇠(tokens.css) — 링/상태는 유지, 맥동·스쿼시만 제거.
   *
   *  단방향(§4.1): 표시는 snapshot.resonance만 읽고, 클릭은 onClick 콜백으로 위임(부모가 게임 호출).
   */
  import type { ResonanceSnapshot } from '../game';

  export let resonance: ResonanceSnapshot;
  /** 슬롯 클릭 핸들러(부모가 game.clickResonance 호출). */
  export let onClick: () => void;

  /** 성공 글로우 버스트 1회 트리거(클릭 성공 시 잠깐 켰다 끔). */
  let hitFlash = false;
  let hitTimer: ReturnType<typeof setTimeout> | null = null;

  // 카운트다운 링: 둘레 기준 stroke-dashoffset. progress 0→1 동안 링이 줄어든다(남은 시간 시각화).
  const RING_R = 26;
  const RING_C = 2 * Math.PI * RING_R;
  // open이면 남은 비율(1-progress)만큼 링이 차 있음. closed면 다음 열림까지 충전(progress).
  $: ringFill = resonance.phase === 'open' ? 1 - resonance.progress : resonance.progress;
  $: dashOffset = RING_C * (1 - ringFill);

  $: isOpen = resonance.active && resonance.phase === 'open';
  $: multLabel = resonance.multiplier > 1.001 ? `×${resonance.multiplier.toFixed(2)}` : '대기';

  function handleClick() {
    if (!resonance.active) return;
    const wasOpen = resonance.phase === 'open';
    onClick();
    // 열린 슬롯을 눌렀을 때만 성공 버스트(닫힘 클릭은 무피드백 — 페널티 없음).
    if (wasOpen) {
      hitFlash = true;
      if (hitTimer) clearTimeout(hitTimer);
      hitTimer = setTimeout(() => (hitFlash = false), 220);
    }
  }
</script>

{#if resonance.active}
  <div class="resonance" class:open={isOpen}>
    <div class="rz-head">
      <span class="rz-title">오비탈 공명</span>
      <span class="rz-mult" class:active={resonance.multiplier > 1.001}>{multLabel}</span>
    </div>

    <button
      class="rz-slot"
      class:open={isOpen}
      class:hit={hitFlash}
      on:click={handleClick}
      aria-label={isOpen ? '공명 슬롯 — 지금 클릭' : '공명 슬롯 — 대기 중'}
      title={isOpen ? '지금 클릭 — 공명 ×1.5 + 데이터' : '슬롯이 열리면 클릭'}
    >
      <!-- 카운트다운 링 (SVG) -->
      <svg class="rz-ring" viewBox="0 0 64 64" aria-hidden="true">
        <circle class="rz-ring-track" cx="32" cy="32" r={RING_R} />
        <circle
          class="rz-ring-fill"
          cx="32"
          cy="32"
          r={RING_R}
          stroke-dasharray={RING_C}
          stroke-dashoffset={dashOffset}
        />
      </svg>
      <span class="rz-core" aria-hidden="true"></span>
    </button>

    <p class="rz-hint">
      {#if isOpen}
        지금 — 공명 클릭
      {:else}
        다음 공명 충전 중…
      {/if}
    </p>
  </div>
{/if}

<style>
  .resonance {
    width: 100%;
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-left: 2px solid var(--layer-accent);
    border-radius: var(--rounded-md);
    padding: var(--space-base);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
  }

  .rz-head {
    width: 100%;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .rz-title {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--layer-accent);
  }
  .rz-mult {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--foreground-dim);
  }
  .rz-mult.active {
    color: var(--primary);
  }

  /* 공명 슬롯 — 원형 버튼(44px 권장, DESIGN click-targets). */
  .rz-slot {
    position: relative;
    width: 64px;
    height: 64px;
    min-width: 64px;
    min-height: 64px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: var(--rounded-full);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: transform var(--motion-click-duration) ease-out;
  }
  .rz-slot:active {
    transform: scale(var(--motion-resonance-scale));
  }

  /* SVG 링: 트랙(희미) + 채움(악센트). 링이 슬롯을 감싼다. */
  .rz-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    transform: rotate(-90deg); /* 12시 방향 시작 */
  }
  .rz-ring-track {
    fill: none;
    stroke: var(--border);
    stroke-width: 3;
  }
  .rz-ring-fill {
    fill: none;
    stroke: var(--layer-accent);
    stroke-width: 3;
    stroke-linecap: round;
    /* dashoffset이 progress 따라 매 프레임 바뀌므로 transition은 짧게(끊김 없는 추적). */
    transition: stroke-dashoffset 100ms linear;
    opacity: 0.45;
  }
  .rz-slot.open .rz-ring-fill {
    opacity: 1;
  }

  /* 중심 코어: 닫힘=희미, 열림=악센트 글로우 맥동(클릭 유도). */
  .rz-core {
    width: 22px;
    height: 22px;
    border-radius: var(--rounded-full);
    background: var(--foreground-dim);
    transition:
      background var(--motion-resonance-open) ease-out,
      box-shadow var(--motion-resonance-open) ease-out;
  }
  .rz-slot.open .rz-core {
    background: var(--layer-accent);
    box-shadow: 0 0 10px var(--layer-glow, var(--col-glow-core));
    animation: rz-pulse var(--motion-resonance-pulse) ease-in-out infinite;
  }
  /* 클릭 성공 버스트: 코어 글로우 순간 확장. */
  .rz-slot.hit .rz-core {
    box-shadow: 0 0 22px var(--primary);
    animation: none;
  }

  .rz-hint {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.85;
    min-height: 1.2em;
    text-align: center;
  }
  .resonance.open .rz-hint {
    color: var(--layer-accent);
    opacity: 1;
  }

  @keyframes rz-pulse {
    0%,
    100% {
      box-shadow: 0 0 8px var(--layer-glow, var(--col-glow-core));
    }
    50% {
      box-shadow: 0 0 16px var(--layer-glow, var(--col-glow-core));
    }
  }

  /* 감소 모션: 맥동·버스트 애니메이션 제거(토큰 0ms로 이미 감쇠되나 keyframes는 별도 차단). */
  @media (prefers-reduced-motion: reduce) {
    .rz-slot.open .rz-core {
      animation: none;
    }
    .rz-ring-fill {
      transition: none;
    }
  }
</style>
