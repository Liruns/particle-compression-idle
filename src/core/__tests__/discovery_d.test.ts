/**
 * 발견 → D ("연구소" 컨셉) — 도감 발견이 연구 데이터 D를 주고, 연구가 분자층(L1)부터 열린다.
 *  루프 미가동(new Game만) — processProgression을 manualCompress 경로로 태워 검증.
 */
import { describe, it, expect } from 'vitest';
import { Game } from '../../game';
import { createInitialState, setState, getState } from '../state';
import { isResearchUnlocked } from '../research';
import { D } from '../bignum';

describe('발견 → D (연구소 축 — L1부터 연구 연료)', () => {
  it('분자층에서 입자 발견 시 D 획득 + 연구 해금(첫 D부터)', () => {
    const g = new Game();
    const s = createInitialState();
    s.resources.C = D('6'); // dec = 0.65·log10(6) ≈ 0.51 → L1 유지, 흔함 입자 다수 발견.
    setState(s);
    g.manualCompress(); // processProgression 경로.

    const st = getState();
    expect(st.layers.currentIndex).toBe(1); // 아직 분자층.
    expect(st.codex.discovered.size).toBeGreaterThan(0);
    expect(st.resources.D_current.gt(0)).toBe(true); // 발견으로 D 확보(L1).
    expect(st.resources.D_lifetime.gt(0)).toBe(true);
    // 연구는 첫 D부터 해금(층 게이트 없음).
    expect(isResearchUnlocked(st.layers.currentIndex, st.resources.D_lifetime.gt(0))).toBe(true);
  });

  it('d_yield 연구(R1)가 발견 D를 증폭(×1.35)', () => {
    const g = new Game();

    setState((() => {
      const s = createInitialState();
      s.resources.C = D('6');
      return s;
    })());
    g.manualCompress();
    const base = getState().resources.D_current.toNumber();

    setState((() => {
      const s = createInitialState();
      s.resources.C = D('6');
      s.research.purchased.add('R1'); // d_yield ×1.35
      return s;
    })());
    g.manualCompress();
    const boosted = getState().resources.D_current.toNumber();

    expect(base).toBeGreaterThan(0);
    expect(boosted).toBeCloseTo(base * 1.35, 2);
  });
});
