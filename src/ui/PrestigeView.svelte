<script lang="ts">
  /**
   * PrestigeView — 상전이 (ui-flow §5). 우주적 현미경 재구성(2단계): 카드 매트릭스+딥퍼플 카드 →
   *  **문턱의 의식**. 패널 크롬 제거(bloom-panel이 컨테이너) · QF 획득=발광 중심 수치 · 리셋/보존=
   *  테두리 없는 두 갈래 원장(R/K=색 텍스트, 뱃지 박스 폐기) · 첫 상전이=옅은 자보라 발광(머니샷 §5-B).
   *  단방향(§4.1): prestige 스냅샷만 읽고 실행은 onPrestige 위임. 리셋/보존 매트릭스 정보 불변.
   */
  import type { PrestigeSnapshot } from '../game';
  import { formatNumber } from '../core/format';

  export let prestige: PrestigeSnapshot;
  /** 상전이 실행 위임(부모가 game.executePrestige 호출). */
  export let onPrestige: () => void;
  /** "압축 계속"(상전이 화면을 닫고 메인으로 — 더 큰 QF를 위해 더 압축). */
  export let onContinue: () => void;

  // 리셋/보존(systems §5-2). 두 갈래 원장으로 분리.
  const resetItems = ['압축 에너지 E', '압축 깊이 C', '압축기 체인', '발견 데이터 D'];
  const keepItems = ['양자 거품 QF', '입자 도감', '연구 트리', '발견 누적'];
  // 빅 크런치(재하강, systems §5-2 / economy §7.3): 층까지 분자로 리셋, D_current는 회차곡선 부분 보존.
  const bcResetItems = ['압축 에너지 E', '압축 깊이 C', '압축기 체인', '층 · 미지 진행'];
  const bcKeepItems = ['양자 거품 QF', '입자 도감', '연구 트리', '발견 데이터 일부'];

  $: bc = prestige.isBigCrunch;
  $: reset = bc ? bcResetItems : resetItems;
  $: keep = bc ? bcKeepItems : keepItems;
</script>

{#if prestige.available}
  <section class="prestige" class:first={prestige.isFirst} class:bigcrunch={bc}>
    <header class="pt-head">
      <span class="pt-eyebrow"
        >{bc ? '압축 한계 — 재압축' : prestige.isFirst ? '알려진 물리의 마지막 문턱' : '상전이'}</span>
      <span class="pt-title">
        {#if bc}빅 크런치 · 재하강{:else if prestige.isFirst}쿼크층 → {prestige.targetLayerKo}{:else}{prestige.targetLayerKo} 진입{/if}
      </span>
    </header>

    <!-- QF 획득 — 발광 중심 수치(카드 박스 폐기). -->
    <div class="pt-qf">
      <span class="pt-qf-label"
        >{bc ? '최종 양자 거품 폭발' : prestige.isFirst ? '양자 거품 첫 획득' : '양자 거품 획득'}</span>
      <span class="pt-qf-gain">+{formatNumber(prestige.qfGain, 0)}<span class="pt-qf-unit"> QF</span></span>
      <span class="pt-qf-mult">다음 런 생산 ×{formatNumber(prestige.nextMult, 3)}</span>
    </div>

    <!-- 리셋 / 보존 — 두 갈래 원장(테두리 없는 색 텍스트). -->
    <div class="pt-ledger">
      <div class="pt-col pt-reset">
        <span class="pt-col-head">리셋</span>
        {#each reset as it}<span class="pt-item">{it}</span>{/each}
      </div>
      <div class="pt-divider" aria-hidden="true"></div>
      <div class="pt-col pt-keep">
        <span class="pt-col-head">보존</span>
        {#each keep as it}<span class="pt-item">{it}</span>{/each}
      </div>
    </div>

    {#if bc}
      <p class="pt-narrative">
        이전 관측은 남는다. 양자 거품은 남는다.<br />더 작은 것이 있다. 다시 내려간다.
      </p>
    {:else if prestige.isFirst}
      <p class="pt-narrative">
        알려진 물리의 경계를 넘는다.<br />여기서부터 지도는 없다.
      </p>
    {/if}

    <div class="pt-actions">
      <button class="pt-continue" on:click={onContinue}>{bc ? '아직 압축' : '압축 계속'}</button>
      <button class="pt-go" on:click={onPrestige}
        >{bc ? '재하강 →' : prestige.isFirst ? '미지 영역으로 →' : '다음 층으로 →'}</button>
    </div>
  </section>
{:else}
  <section class="prestige locked">
    <p class="pt-locked">상전이 조건 미충족. 미지 영역의 벽(dec 19)까지 압축을 계속한다.</p>
  </section>
{/if}

<style>
  /* 컨테이너 크롬 0 — bloom-panel이 프레임. 문턱의 의식처럼 중앙 정렬·여백. */
  .prestige {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }

  .pt-head {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .pt-eyebrow {
    font-family: var(--font-narrative);
    font-size: var(--text-label-sm);
    letter-spacing: 0.04em;
    color: var(--foreground-dim);
  }
  .pt-title {
    font-family: var(--font-label);
    font-size: var(--text-label-lg);
    color: var(--layer-accent);
  }
  .prestige.first .pt-eyebrow {
    color: color-mix(in srgb, var(--layer-prn-accent) 70%, var(--foreground-dim));
  }
  .prestige.first .pt-title {
    color: #b6a8ec;
    text-shadow: 0 0 18px color-mix(in srgb, var(--layer-prn-accent) 45%, transparent);
  }

  /* QF 획득 — 발광 중심 수치(어둠 위에 떠오름). */
  .pt-qf {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
  }
  .pt-qf-label {
    font-family: var(--font-narrative);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }
  .pt-qf-gain {
    font-family: var(--font-numeric);
    font-size: 34px;
    font-weight: 500;
    line-height: 1.05;
    color: var(--qf);
    text-shadow: 0 0 22px color-mix(in srgb, var(--qf) 40%, transparent);
  }
  .pt-qf-unit {
    font-size: 16px;
    color: color-mix(in srgb, var(--qf) 75%, var(--foreground-dim));
  }
  .pt-qf-mult {
    font-family: var(--font-numeric);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }

  /* 리셋/보존 — 두 갈래 원장. 색 텍스트(뱃지 박스 폐기), 가운데 가는 분리선. */
  .pt-ledger {
    display: grid;
    grid-template-columns: 1fr 1px 1fr;
    gap: 0 18px;
    width: 100%;
    max-width: 380px;
    padding: 12px 0;
    border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  }
  .pt-col {
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: center;
  }
  .pt-col-head {
    font-family: var(--font-label);
    font-size: 10px;
    letter-spacing: 0.12em;
    margin-bottom: 3px;
  }
  .pt-reset .pt-col-head {
    color: var(--col-reset);
  }
  .pt-keep .pt-col-head {
    color: var(--col-keep);
  }
  .pt-item {
    font-family: var(--font-label);
    font-size: var(--text-label-sm);
    color: var(--foreground-sub);
  }
  .pt-reset .pt-item {
    color: color-mix(in srgb, var(--col-reset) 30%, var(--foreground-sub));
  }
  .pt-keep .pt-item {
    color: color-mix(in srgb, var(--col-keep) 32%, var(--foreground-sub));
  }
  .pt-divider {
    background: color-mix(in srgb, var(--border) 70%, transparent);
  }

  .pt-narrative {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-md, var(--text-narr-sm));
    line-height: 1.7;
    color: var(--foreground-sub);
  }
  .prestige.first .pt-narrative {
    color: color-mix(in srgb, var(--layer-prn-accent) 25%, var(--foreground-sub));
  }

  .pt-actions {
    display: flex;
    gap: 18px;
    align-items: center;
    margin-top: 2px;
  }
  /* 압축 계속 = 물러남(조용한 텍스트). 진입 = 발광 알약(QF 톤, 의식의 무게). */
  .pt-continue {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--foreground-sub);
    background: none;
    border: none;
    padding: 10px 8px;
    cursor: pointer;
    transition: color 0.2s ease;
  }
  .pt-continue:hover {
    color: var(--foreground);
  }
  .pt-go {
    font-family: var(--font-label);
    font-size: var(--text-label-md);
    color: var(--qf);
    background: color-mix(in srgb, var(--qf) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--qf) 45%, transparent);
    border-radius: 999px;
    padding: 11px 22px;
    min-height: 44px;
    cursor: pointer;
    transition:
      box-shadow 0.25s ease,
      background 0.25s ease;
  }
  .pt-go:hover {
    background: color-mix(in srgb, var(--qf) 14%, transparent);
    box-shadow: 0 0 18px color-mix(in srgb, var(--qf) 35%, transparent);
  }
  .pt-go:active {
    transform: scale(var(--motion-click-scale, 0.97));
  }
  .prestige.first .pt-go {
    color: #c2b4f4;
    border-color: color-mix(in srgb, var(--layer-prn-accent) 55%, transparent);
    background: color-mix(in srgb, var(--layer-prn-accent) 12%, transparent);
  }
  .prestige.first .pt-go:hover {
    box-shadow: 0 0 22px color-mix(in srgb, var(--layer-prn-accent) 45%, transparent);
  }

  /* 빅 크런치(재하강) — QF 민트 톤의 무게(첫 상전이 보라와 구분, 종착점 아닌 시작점). */
  .prestige.bigcrunch .pt-eyebrow {
    color: color-mix(in srgb, var(--qf) 70%, var(--foreground-dim));
  }
  .prestige.bigcrunch .pt-title {
    color: var(--qf);
    text-shadow: 0 0 20px color-mix(in srgb, var(--qf) 45%, transparent);
  }
  .prestige.bigcrunch .pt-narrative {
    color: color-mix(in srgb, var(--qf) 28%, var(--foreground-sub));
  }
  .prestige.bigcrunch .pt-go {
    box-shadow: 0 0 14px color-mix(in srgb, var(--qf) 30%, transparent);
  }
  .prestige.bigcrunch .pt-go:hover {
    box-shadow: 0 0 24px color-mix(in srgb, var(--qf) 45%, transparent);
  }

  .pt-locked {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm);
    color: var(--foreground-sub);
    opacity: 0.8;
  }
</style>
