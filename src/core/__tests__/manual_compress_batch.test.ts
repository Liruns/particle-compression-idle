/**
 * manualCompress 배치 동등성 — 성능 수정(스윕 n셀을 1회 notify/draw로) 이후에도
 *  경제가 개별 n회 호출과 완전히 동일함을 못박는다(수식·밸런스 0 변경 보증).
 *  루프 미가동(new Game만, start 안 함) — 순수 상태 조작.
 */
import { describe, it, expect } from 'vitest';
import { Game } from '../../game';
import { createInitialState, setState, getState } from '../state';

describe('manualCompress(times) 배치 = 개별 times회 (경제 동일)', () => {
  it('C·E·lifetime_C·누적횟수가 개별 5회와 동일', () => {
    const g = new Game(); // start() 안 함 — rAF 미가동.

    // A) 개별 5회.
    setState(createInitialState());
    for (let i = 0; i < 5; i++) g.manualCompress();
    const a = getState();
    const aC = a.resources.C.toString();
    const aE = a.resources.E.toString();
    const aLC = a.resources.lifetime_C.toString();
    const aN = a.stats.manualCompresses;

    // B) 배치 5회.
    setState(createInitialState());
    g.manualCompress(5);
    const b = getState();

    expect(b.resources.C.toString()).toBe(aC);
    expect(b.resources.E.toString()).toBe(aE);
    expect(b.resources.lifetime_C.toString()).toBe(aLC);
    expect(b.stats.manualCompresses).toBe(aN);
    expect(aN).toBe(5);
  });

  it('times<1 방어 → 최소 1회', () => {
    const g = new Game();
    setState(createInitialState());
    g.manualCompress(0);
    expect(getState().stats.manualCompresses).toBe(1);
  });
});
