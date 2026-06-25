<script lang="ts">
  /**
   * PrestigeView — 상전이 화면 (SCR-04, ui-flow §5). M1.5 첫 상전이 PT1.
   *  미지 벽 도달 시만 진입(prestige.available). QF 획득량 + 리셋/보존 매트릭스 + 확인 버튼.
   *  첫 상전이(isFirst)는 특별 강조 — 딥 퍼플 헤더 + "양자 거품 첫 획득" + 2줄 내러티브(§5-B).
   *
   *  단방향(§4.1): prestige 스냅샷만 읽고, 실행은 onPrestige 콜백으로 위임(부모가 game 호출).
   *  리셋/보존 매트릭스(systems §5-2): E·C·체인=리셋 / D=일부 / QF·도감·연구·D누적=보존.
   */
  import type { PrestigeSnapshot } from '../game';
  import { formatNumber } from '../core/format';

  export let prestige: PrestigeSnapshot;
  /** 상전이 실행 위임(부모가 game.executePrestige 호출). */
  export let onPrestige: () => void;
  /** "압축 계속"(상전이 화면을 닫고 메인으로 — 더 큰 QF를 위해 더 압축). */
  export let onContinue: () => void;

  // 리셋/보존 매트릭스(systems §5-2). badge: R=리셋 / P=일부 / K=보존.
  type Cell = { label: string; badge: 'R' | 'P' | 'K'; badgeText: string };
  const matrix: Cell[] = [
    { label: '압축 에너지 E', badge: 'R', badgeText: '리셋' },
    { label: '압축 깊이 C', badge: 'R', badgeText: '리셋' },
    { label: '압축기 체인', badge: 'R', badgeText: '리셋' },
    { label: '발견 데이터 D', badge: 'R', badgeText: '리셋' },
    { label: '양자 거품 QF', badge: 'K', badgeText: '보존' },
    { label: '입자 도감', badge: 'K', badgeText: '보존' },
    { label: '연구 트리', badge: 'K', badgeText: '보존' },
    { label: '발견 누적', badge: 'K', badgeText: '보존' },
  ];
</script>

{#if prestige.available}
  <section class="prestige" class:first={prestige.isFirst}>
    <!-- 헤더: 첫 상전이는 "미지 영역 진입" 강조 -->
    <header class="pt-head">
      {#if prestige.isFirst}
        <span class="pt-title">미지 영역 진입 — 쿼크층 → {prestige.targetLayerKo}</span>
      {:else}
        <span class="pt-title">상전이 가능 — {prestige.targetLayerKo} 진입</span>
      {/if}
    </header>

    <!-- QF 획득 블록: 첫 상전이는 "양자 거품 첫 획득" 강조 -->
    <div class="pt-qf">
      {#if prestige.isFirst}
        <span class="pt-qf-label">양자 거품 첫 획득</span>
      {:else}
        <span class="pt-qf-label">양자 거품 획득</span>
      {/if}
      <span class="pt-qf-gain">+{formatNumber(prestige.qfGain, 0)} QF</span>
      <span class="pt-qf-mult">다음 런 생산 배율 ×{formatNumber(prestige.nextMult, 3)}</span>
    </div>

    <!-- 리셋/보존 매트릭스(systems §5-2) -->
    <div class="pt-matrix" role="table" aria-label="리셋·보존">
      {#each matrix as cell}
        <div class="pt-cell" role="row">
          <span class="pt-cell-label">{cell.label}</span>
          <span class="pt-badge badge-{cell.badge}">{cell.badgeText}</span>
        </div>
      {/each}
    </div>

    <!-- 내러티브: 첫 상전이만 2줄(ui-flow §5-B) -->
    {#if prestige.isFirst}
      <p class="pt-narrative">
        알려진 물리의 경계를 넘는다.<br />여기서부터 지도는 없다.
      </p>
    {/if}

    <!-- 액션: 압축 계속 / 진입 -->
    <div class="pt-actions">
      <button class="pt-btn pt-continue" on:click={onContinue}>압축 계속</button>
      <button class="pt-btn pt-go" on:click={onPrestige}>
        {prestige.isFirst ? '미지 영역으로' : '다음 층으로'}
      </button>
    </div>
  </section>
{:else}
  <section class="prestige locked">
    <p class="pt-locked">
      상전이 조건 미충족. 미지 영역의 벽(dec 19)까지 압축을 계속한다.
    </p>
  </section>
{/if}

<style>
  .prestige {
    width: 100%;
    max-width: 460px;
    background: var(--canvas-layer);
    border: 1px solid var(--border);
    border-radius: var(--rounded-md);
    padding: var(--space-base);
    display: flex;
    flex-direction: column;
    gap: var(--space-base);
  }
  /* 첫 상전이: 딥 퍼플 레이어(ui-flow §5-B, #7c4dff opacity 0.15). */
  .prestige.first {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, #7c4dff 15%, var(--canvas-layer)),
      var(--canvas-layer) 60%
    );
    border-color: color-mix(in srgb, #7c4dff 40%, var(--border));
  }

  .pt-head {
    text-align: center;
  }
  .pt-title {
    font-family: var(--font-label);
    font-size: var(--text-label-lg);
    color: var(--layer-accent);
    font-weight: 500;
  }
  .prestige.first .pt-title {
    color: #b39dff;
  }

  /* QF 획득 블록 */
  .pt-qf {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-md);
    background: var(--surface);
    border-radius: var(--rounded-md);
    border: 1px solid var(--border);
  }
  .pt-qf-label {
    font-family: var(--font-narrative);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }
  .pt-qf-gain {
    font-family: var(--font-numeric);
    font-size: var(--text-num-lg);
    color: var(--qf);
    font-weight: 500;
  }
  .pt-qf-mult {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }

  /* 리셋/보존 매트릭스 */
  .pt-matrix {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-xs);
  }
  .pt-cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--rounded-sm);
  }
  .pt-cell-label {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }
  .pt-badge {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    border-radius: var(--rounded-sm);
    padding: 1px 6px;
    white-space: nowrap;
  }
  /* 뱃지 색(ui-flow §5-A): R=리셋(붉음) / P=부분(호박) / K=보존(녹). */
  .badge-R {
    color: var(--col-reset, #c0392b);
    border: 1px solid var(--col-reset, #c0392b);
  }
  .badge-P {
    color: var(--col-partial, #e67e22);
    border: 1px solid var(--col-partial, #e67e22);
  }
  .badge-K {
    color: var(--col-keep, #27ae60);
    border: 1px solid var(--col-keep, #27ae60);
  }

  .pt-narrative {
    margin: 0;
    text-align: center;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-md, var(--text-narr-sm));
    line-height: 1.6;
    color: var(--foreground-sub);
  }

  .pt-actions {
    display: flex;
    gap: var(--space-base);
    justify-content: center;
  }
  .pt-btn {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    border-radius: var(--rounded-md);
    padding: 12px 20px;
    min-height: 44px;
    cursor: pointer;
    transition: transform var(--motion-click-duration) ease-out;
  }
  .pt-btn:active {
    transform: scale(var(--motion-click-scale));
  }
  .pt-continue {
    color: var(--foreground-sub);
    background: var(--surface);
    border: 1px solid var(--border);
  }
  .pt-go {
    color: var(--qf);
    background: var(--surface);
    border: 1px solid var(--qf);
    flex: 1;
  }
  .pt-go:hover {
    box-shadow: 0 0 8px color-mix(in srgb, var(--qf) 40%, transparent);
  }

  .prestige.locked {
    align-items: center;
  }
  .pt-locked {
    margin: 0;
    text-align: center;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.8;
  }
</style>
