/**
 * 빅 크런치 game.ts 배선 통합 검증. 순수 함수(big_crunch.test)는 별도 — 여기선 game.executeBigCrunch가
 *  크래프팅한 상태(6벽 소진·플랑크·dec26·큰 lifetime_C)에서 재하강 리셋을 상태에 실제 반영하는지 확인.
 *  (실경제로 dec26까지 6회 상전이 그라인드는 비현실적 → 상태 주입으로 배선만 국소 검증.)
 */
import { describe, it, expect } from 'vitest';
import { Game } from '../../game';
import { getState, setState, createInitialState } from '../state';
import { D } from '../bignum';

describe('game.executeBigCrunch 배선', () => {
  it('6벽 소진 + 플랑크 dec26 상태에서 재하강 리셋 반영', () => {
    const g = new Game(); // start() 안 함 — 루프 미가동, 순수 상태 조작만.
    const s = createInitialState();
    s.resources.C = D('1e40'); // dec = 0.65·log10(1e40) = 26
    s.resources.lifetime_C = D('1.175e40');
    s.resources.QF = D('1e7');
    s.resources.D_current = D('400');
    s.resources.D_lifetime = D('9999');
    s.prestige.count = 6; // 6벽 모두 소진(플랑크 진입 완료)
    s.prestige.qfClaimed = D('0');
    s.prestige.runIndex = 0;
    s.layers.currentIndex = 11; // 플랑크
    s.codex.discovered.add('water_molecule');
    setState(s);

    const ok = g.executeBigCrunch();
    expect(ok).toBe(true);

    const a = getState();
    // 재하강 리셋
    expect(a.prestige.count).toBe(0); // 벽 재통과
    expect(a.prestige.runIndex).toBe(1); // 첫 빅 크런치
    expect(a.layers.currentIndex).toBe(1); // 분자층 dec0 재시작
    expect(a.resources.C.eq(0)).toBe(true);
    expect(a.resources.E.eq(0)).toBe(true);
    // 보존/누적
    expect(a.resources.QF.gt('1e7')).toBe(true); // QF 가산(K=1.05)
    expect(a.resources.lifetime_C.eq('1.175e40')).toBe(true); // 불변(누적 유지)
    expect(a.resources.D_lifetime.eq('9999')).toBe(true); // 100% 보존
    expect(a.resources.D_current.toNumber()).toBeCloseTo(400 * 0.65, 0); // 회차2 곡선 0.65 → 260
    expect(a.codex.discovered.has('water_molecule')).toBe(true); // 도감 영구 보존
    g.dispose();
  });

  it('불가 상태(6벽 미소진)에서는 no-op(false)', () => {
    const g = new Game();
    const s = createInitialState();
    s.resources.C = D('1e40');
    s.prestige.count = 5; // 아직 PT6(정상 상전이) 남음
    setState(s);
    expect(g.executeBigCrunch()).toBe(false);
    expect(getState().prestige.runIndex).toBe(0); // 변화 없음
    g.dispose();
  });
});
