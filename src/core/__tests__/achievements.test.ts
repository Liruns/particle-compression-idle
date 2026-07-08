/**
 * 관측 목표(업적) 검증 — 순수 판정 + 직렬화 + 가드레일(순수 인정형).
 *
 * 커버:
 *  - evaluateAchievements: 조건 충족분만 반환 · 이미 달성분 제외(멱등) · 히든도 조건 충족 시 달성.
 *  - 첫걸음 목표는 낮은 임계에서 달성(이른 첫 승리).
 *  - 직렬화 라운드트립: earned 집합 보존 + 구버전(없음) → 빈 집합.
 *  - 정의 무결성: ID 유일 · test 함수 존재.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateAchievements,
  achievementById,
  ACHIEVEMENTS,
  ACHIEVEMENT_TOTAL,
  type AchievementContext,
} from '../achievements';
import { serializeState, deserializeState, type SaveData } from '../save/serialize';
import { createInitialState } from '../state';

const ZERO_CTX: AchievementContext = {
  maxDec: 0,
  maxLayerIndex: 1,
  prestigeCount: 0,
  runIndex: 0,
  codexCollected: 0,
  codexCompletion: 0,
  researchCount: 0,
  manualCompresses: 0,
  totalBinds: 0,
  lifetimeCLog10: 0,
  lifetimeDLog10: 0,
};

describe('정의 무결성', () => {
  it('ID 유일 · test 함수 존재 · 총 수 일치', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    expect(ids.size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENT_TOTAL).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(typeof a.test).toBe('function');
  });
});

describe('evaluateAchievements', () => {
  it('아무 진행 없음 → 달성 0', () => {
    expect(evaluateAchievements(ZERO_CTX, new Set())).toEqual([]);
  });

  it('첫걸음 — 첫 압축/결속은 임계 1에서 달성(이른 승리)', () => {
    const newly = evaluateAchievements({ ...ZERO_CTX, manualCompresses: 1, totalBinds: 1 }, new Set());
    expect(newly).toContain('first_compress');
    expect(newly).toContain('first_bind');
  });

  it('이미 달성한 목표는 재반환 안 함(멱등)', () => {
    const ctx = { ...ZERO_CTX, manualCompresses: 1 };
    const first = evaluateAchievements(ctx, new Set());
    expect(first).toContain('first_compress');
    const again = evaluateAchievements(ctx, new Set(first));
    expect(again).not.toContain('first_compress');
  });

  it('dec/상전이 이정표 달성', () => {
    const newly = evaluateAchievements(
      { ...ZERO_CTX, maxDec: 19, maxLayerIndex: 6, prestigeCount: 1 },
      new Set(),
    );
    expect(newly).toContain('dec_first_wall');
    expect(newly).toContain('world_preon');
    expect(newly).toContain('prestige_1');
  });

  it('히든 목표도 조건 충족 시 달성(관조자)', () => {
    const newly = evaluateAchievements(
      { ...ZERO_CTX, prestigeCount: 1, manualCompresses: 10 },
      new Set(),
    );
    expect(newly).toContain('quiet_observer');
    expect(achievementById('quiet_observer')?.hidden).toBe(true);
  });

  it('도감 완성도 완주 → codex_full', () => {
    expect(evaluateAchievements({ ...ZERO_CTX, codexCompletion: 1 }, new Set())).toContain('codex_full');
  });
});

describe('직렬화', () => {
  it('earned 라운드트립 보존', () => {
    const s = createInitialState();
    s.achievements.earned.add('first_compress');
    s.achievements.earned.add('prestige_1');
    const round = deserializeState(serializeState(s));
    expect(round.achievements.earned.has('first_compress')).toBe(true);
    expect(round.achievements.earned.has('prestige_1')).toBe(true);
    expect(round.achievements.earned.size).toBe(2);
  });

  it('구버전(achievements 없음) → 빈 집합', () => {
    const s = createInitialState();
    const data = serializeState(s) as SaveData;
    delete data.achievements;
    const round = deserializeState(data);
    expect(round.achievements.earned.size).toBe(0);
  });
});
