/**
 * achievements — 관측 목표 판정(순수). 영속 상태 컨텍스트로 달성 여부를 평가.
 *
 *  게임 로직·경제 비관여 — 상태를 읽어 "새로 달성된 ID"만 돌려준다(codex/research 발견 판정과 동형).
 *  달성 집합(Set)은 game.ts/state가 보유, 이벤트 발행도 game.ts. 멱등: 이미 달성한 것은 재평가해도 재발화 안 함.
 */

import { ACHIEVEMENTS, ACHIEVEMENT_TOTAL, type AchievementContext, type AchievementDef } from '../../data/achievements';

export { ACHIEVEMENTS, ACHIEVEMENT_TOTAL };
export type { AchievementContext, AchievementDef, AchievementCategory } from '../../data/achievements';

/**
 * 컨텍스트 + 이미 달성한 집합 → **새로 달성되는 ID 배열**(정의 순서). 부작용 없음.
 *  game.ts가 반환 ID를 집합에 추가하고 achievement_earned 이벤트를 발행한다.
 */
export function evaluateAchievements(ctx: AchievementContext, earned: ReadonlySet<string>): string[] {
  const newly: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (earned.has(a.id)) continue;
    if (a.test(ctx)) newly.push(a.id);
  }
  return newly;
}

/** ID → 정의(표시용 조회). 없으면 undefined. */
export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
