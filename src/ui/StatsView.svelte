<script lang="ts">
  /**
   * StatsView — 기록(누적 통계, 개입 bloom 오버레이). 진행 로직 비관여 — 표시 전용 집계를 보여준다.
   *  자원 성표(공허 팔레트) 톤을 재사용. 값은 game 스냅샷의 stats 번들(전 생애 보존 카운터 + 파생).
   *  로직 불변 — snapshot만 읽는다(단방향 §4.1).
   */
  import type { StatsSnapshot } from '../game';
  import { formatNumber, formatDuration } from '../core/format';
  import { layerByIndex } from '../core/layers';

  export let stats: StatsSnapshot;

  $: layerName = layerByIndex(stats.maxLayerIndex)?.nameKo ?? '분자층';
  // dec → 반경 r 근사(표시용, r = 1e-9 · 10^-dec m). 통계엔 "가장 깊이"를 r로도 보여준다.
  $: deepestR = 1e-9 * Math.pow(10, -stats.maxDec);

  interface Row {
    label: string;
    value: string;
    tone?: 'energy' | 'depth' | 'data' | 'qf' | 'plain';
  }
  $: rows = [
    { label: '총 플레이 시간', value: formatDuration(stats.playtimeSeconds), tone: 'plain' },
    { label: '가장 깊이 (dec)', value: stats.maxDec.toFixed(2), tone: 'depth' },
    { label: '가장 깊이 (반경)', value: `${deepestR.toExponential(2)} m`, tone: 'depth' },
    { label: '도달 최대 층', value: layerName, tone: 'plain' },
    { label: '누적 압축 깊이 C', value: formatNumber(stats.lifetimeC, 2), tone: 'depth' },
    { label: '누적 발견 데이터 D', value: formatNumber(stats.lifetimeD, 2), tone: 'data' },
    { label: '수동 압축 횟수', value: formatNumber(stats.manualCompresses, 0), tone: 'energy' },
    { label: '압축기 결속 수', value: formatNumber(stats.totalBinds, 0), tone: 'energy' },
    { label: '연구 노드 구매', value: `${stats.researchCount}`, tone: 'data' },
    { label: '상전이 횟수', value: `${stats.prestigeCount}`, tone: 'qf' },
    { label: '재하강 (빅 크런치)', value: `${stats.runIndex}`, tone: 'qf' },
  ] as Row[];
</script>

<div class="stats">
  <h2 class="st-title">기록</h2>
  <ul class="st-list" role="list">
    {#each rows as r}
      <li class="st-row">
        <span class="st-label">{r.label}</span>
        <span class="st-value tone-{r.tone ?? 'plain'}">{r.value}</span>
      </li>
    {/each}
  </ul>
  <p class="st-note">기록은 상전이·재하강을 넘어 전 생애 누적됩니다.</p>
</div>

<style>
  .stats {
    display: flex;
    flex-direction: column;
    gap: 14px;
    color: var(--foreground);
  }
  .st-title {
    margin: 0;
    font-family: var(--font-label);
    font-size: var(--text-label-lg, 16px);
    font-weight: 600;
    color: var(--foreground);
  }
  .st-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .st-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
  }
  .st-row:last-child {
    border-bottom: none;
  }
  .st-label {
    font-family: var(--font-label);
    font-size: var(--text-label-sm, 12px);
    color: var(--foreground-sub);
  }
  .st-value {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md, 14px);
    color: var(--foreground);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .tone-energy {
    color: var(--energy, #d9b86a);
  }
  .tone-depth {
    color: var(--depth, #7a9fc0);
  }
  .tone-data {
    color: var(--data, #9a8fc0);
  }
  .tone-qf {
    color: var(--qf, #a8c4b6);
  }
  .st-note {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm, 12px);
    color: var(--foreground-dim);
  }
</style>
