<script lang="ts">
  /**
   * AchievementsView — 관측 목표(업적, 개입 bloom 오버레이). 순수 인정·목표 레이어(생산 배율 0).
   *  달성=밝은 기록 행, 미달성=물러난 잠긴 행, 히든=이름/설명 가림(발견의 재미). 카테고리별 그룹.
   *  로직 불변 — snapshot의 earned 집합 + ACHIEVEMENTS 정의만 읽는다(단방향 §4.1).
   */
  import type { AchievementsSnapshot } from '../game';
  import { ACHIEVEMENTS, type AchievementCategory } from '../core/achievements';

  export let achievements: AchievementsSnapshot;

  $: earned = achievements.earned;

  const categoryLabel: Record<AchievementCategory, string> = {
    onboarding: '첫걸음',
    descent: '하강',
    prestige: '상전이·재하강',
    codex: '도감',
    research: '연구',
    craft: '손맛',
    endgame: '스케일',
  };
  // 표시 순서(정의 등장 순 유지).
  const order: AchievementCategory[] = [
    'onboarding',
    'descent',
    'prestige',
    'codex',
    'research',
    'craft',
    'endgame',
  ];
  $: grouped = order
    .map((cat) => ({ cat, items: ACHIEVEMENTS.filter((a) => a.category === cat) }))
    .filter((g) => g.items.length > 0);
</script>

<div class="ach">
  <header class="ac-top">
    <span class="ac-title">관측 목표</span>
    <span class="ac-count">{achievements.count}<span class="slash">/</span>{achievements.total}</span>
  </header>

  {#each grouped as g}
    <section class="ac-group">
      <h3 class="ac-cat">{categoryLabel[g.cat]}</h3>
      <ul class="ac-list" role="list">
        {#each g.items as a}
          {@const got = earned.has(a.id)}
          {@const masked = a.hidden && !got}
          <li class="ac-item" class:got>
            <span class="ac-mark" aria-hidden="true">{got ? '◆' : '◇'}</span>
            <span class="ac-body">
              <span class="ac-name">{masked ? '???' : a.nameKo}</span>
              <span class="ac-desc">{masked ? '숨겨진 목표 — 계속 관측하라.' : a.descKo}</span>
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
  <p class="ac-note">목표는 인정·기록이며 생산에 영향을 주지 않습니다(검증된 경제 불변).</p>
</div>

<style>
  .ach {
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: var(--foreground);
  }
  .ac-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .ac-title {
    font-family: var(--font-label);
    font-size: var(--text-label-lg, 16px);
    font-weight: 600;
    color: var(--foreground);
  }
  .ac-count {
    font-family: var(--font-numeric);
    font-size: var(--text-num-md, 14px);
    color: var(--qf, #a8c4b6);
    font-variant-numeric: tabular-nums;
  }
  .ac-count .slash {
    color: var(--foreground-dim);
    margin: 0 1px;
  }
  .ac-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ac-cat {
    margin: 0;
    font-family: var(--font-label);
    font-size: var(--text-label-sm, 12px);
    letter-spacing: 0.08em;
    color: var(--foreground-sub);
    text-transform: none;
  }
  .ac-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .ac-item {
    display: grid;
    grid-template-columns: 18px 1fr;
    align-items: baseline;
    gap: 10px;
    padding: 7px 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 30%, transparent);
    opacity: 0.5;
    transition: opacity 0.3s ease;
  }
  .ac-item:last-child {
    border-bottom: none;
  }
  .ac-item.got {
    opacity: 1;
  }
  .ac-mark {
    font-size: 12px;
    color: var(--foreground-dim);
    text-align: center;
  }
  .ac-item.got .ac-mark {
    color: var(--qf, #a8c4b6);
    text-shadow: 0 0 8px color-mix(in srgb, var(--qf, #a8c4b6) 55%, transparent);
  }
  .ac-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .ac-name {
    font-family: var(--font-label);
    font-size: var(--text-label-md, 14px);
    color: var(--foreground);
  }
  .ac-desc {
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm, 12px);
    color: var(--foreground-sub);
  }
  .ac-note {
    margin: 0;
    font-family: var(--font-narrative);
    font-size: var(--text-narr-sm, 12px);
    color: var(--foreground-dim);
  }
</style>
