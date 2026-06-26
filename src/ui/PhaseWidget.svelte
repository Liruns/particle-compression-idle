<script lang="ts">
  /**
   * PhaseWidget — 위상 겹침 토글 위젯 (프리온층 L6, ui-flow §2-E / systems §2-E). M1.6.
   *  **미지 첫 메커니즘 — 오비탈 공명과 다른 결**: 슬롯 타이밍 클릭이 아니라 세 위상 상태
   *  [응집][분산][공명] 사이를 자동 순환하는 것을 보며, "어떤 자원을 우선할지" 전략적으로
   *  상태를 고정(pin)한다. 응집=체인 / 분산=데이터 / 공명=양자거품. 방치하면 균형, 개입하면 전문화.
   *
   *  비주얼: 세 상태 세그먼트(가로) + 현재 상태 하이라이트 + 자동순환 진행 바(고정 시 정지).
   *  각 세그먼트 클릭 = 그 상태로 고정(E 비용). 고정 상태 다시 클릭 = 해제(무료).
   *  차가운 자주(--layer-prn-accent #7c4dff) — 알려진 물리(온기)에서 미지(냉기)로의 경계.
   *
   *  단방향(§4.1): 표시는 snapshot.phase만, 조작은 onPin/onUnpin 콜백으로 부모에 위임.
   */
  import type { PhaseSnapshot } from '../game';
  import type { PhaseState } from '../core/layers/mechanics';
  import { formatNumber } from '../core/format';

  export let phase: PhaseSnapshot;
  /** 상태 고정 핸들러(부모가 game.pinPhase 호출). */
  export let onPin: (state: PhaseState) => void;
  /** 고정 해제 핸들러(부모가 game.unpinPhase 호출). */
  export let onUnpin: () => void;

  // 세 상태 메타(라벨·짧은 효과 설명·발견 임계 초).
  const STATES: { id: PhaseState; ko: string; effect: string; gateKey: keyof PhaseSnapshot['times']; gateSec: number }[] = [
    { id: 'coherent', ko: '응집', effect: '체인 ↑', gateKey: 'coherent', gateSec: 10 },
    { id: 'dispersed', ko: '분산', effect: '데이터 ↑', gateKey: 'dispersed', gateSec: 10 },
    { id: 'resonant', ko: '공명', effect: '거품 ↑', gateKey: 'resonant', gateSec: 20 },
  ];

  function handleSegment(state: PhaseState) {
    if (!phase.active) return;
    if (phase.pinned && phase.state === state) {
      onUnpin(); // 고정된 상태를 다시 누르면 해제.
    } else {
      onPin(state);
    }
  }

  $: multLabel = phase.multiplier > 1.001 ? `×${phase.multiplier.toFixed(2)}` : '—';
</script>

{#if phase.active}
  <div class="phase" class:pinned={phase.pinned}>
    <div class="ph-head">
      <span class="ph-title">위상 겹침</span>
      <span class="ph-mult">{multLabel}</span>
    </div>

    <!-- 세 상태 세그먼트(가로 토글) -->
    <div class="ph-segs" role="group" aria-label="위상 상태 선택">
      {#each STATES as st (st.id)}
        {@const isCurrent = phase.state === st.id}
        {@const isPinned = phase.pinned && isCurrent}
        {@const gateMet = phase.times[st.gateKey] >= st.gateSec}
        <button
          class="ph-seg"
          class:current={isCurrent}
          class:pinned={isPinned}
          on:click={() => handleSegment(st.id)}
          aria-pressed={isPinned}
          title={isPinned ? `${st.ko} 고정 중 — 클릭으로 해제` : `${st.ko}로 고정 (E ${formatNumber(phase.pinCost, 1)})`}>
          <span class="ph-seg-name">{st.ko}</span>
          <span class="ph-seg-effect">{st.effect}</span>
          {#if isCurrent}
            <!-- 현재 상태 자동순환 진행 바(고정 시 정지). -->
            <span class="ph-seg-bar" style="--p: {phase.cycleProgress}"></span>
          {/if}
          {#if gateMet}<span class="ph-seg-found" aria-label="발견 완료">✓</span>{/if}
        </button>
      {/each}
    </div>

    <p class="ph-hint">
      {#if phase.pinned}
        고정됨 — 다시 누르면 자동 순환
      {:else}
        자동 순환 중 — 상태를 눌러 고정 (E {formatNumber(phase.pinCost, 1)})
      {/if}
    </p>
  </div>
{/if}

<style>
  .phase {
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

  .ph-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .ph-title {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--layer-accent);
  }
  .ph-mult {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md);
    color: var(--primary);
  }

  /* 세 상태 세그먼트 — 가로 3분할. 현재 상태 강조, 고정 상태 테두리 글로우. */
  .ph-segs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-xs);
  }
  .ph-seg {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-sm) var(--space-xs);
    min-height: 56px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
    cursor: pointer;
    overflow: hidden;
    transition:
      border-color var(--motion-layer-accent-shift) ease-out,
      background var(--motion-layer-accent-shift) ease-out;
  }
  .ph-seg.current {
    background: color-mix(in srgb, var(--layer-accent) 14%, var(--surface));
    border-color: var(--layer-accent);
  }
  .ph-seg.pinned {
    border-color: var(--layer-accent);
    box-shadow: 0 0 8px var(--layer-glow, var(--col-glow-core));
  }
  .ph-seg-name {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--foreground-sub);
  }
  .ph-seg.current .ph-seg-name {
    color: var(--layer-accent);
  }
  .ph-seg-effect {
    font-family: var(--font-narrative);
    font-size: var(--text-label-sm);
    color: var(--foreground-dim);
  }
  /* 자동순환 진행 바 — 세그먼트 하단을 채운다(progress 0→1). */
  .ph-seg-bar {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    width: calc(var(--p, 0) * 100%);
    background: var(--layer-accent);
    opacity: 0.7;
    transition: width 120ms linear;
  }
  .ph-seg.pinned .ph-seg-bar {
    width: 100%;
    opacity: 0.35; /* 고정: 가득 찬 정적 바(순환 정지 신호). */
  }
  .ph-seg-found {
    position: absolute;
    top: 3px;
    right: 5px;
    font-size: var(--text-label-sm);
    color: var(--layer-accent);
  }

  .ph-hint {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.85;
    min-height: 1.2em;
    text-align: center;
  }
  .phase.pinned .ph-hint {
    color: var(--layer-accent);
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .ph-seg-bar {
      transition: none;
    }
  }
</style>
