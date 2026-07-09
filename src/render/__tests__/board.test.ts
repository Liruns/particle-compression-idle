import { describe, it, expect } from 'vitest';
import { BoardRenderer, type BoardInput } from '../board';

// 최소 Canvas2D 스텁 — board가 호출하는 메서드는 no-op, gradient는 addColorStop 보유.
function makeCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop() {} };
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => grad;
        if (prop === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
      set() {
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
}

const W = 800,
  H = 800,
  cx = 400,
  cy = 400,
  minDim = 800;
const phaseRad = minDim * 0.4; // 320 (board.phasePos와 정합)
const phaseCy = cy + minDim * 0.08; // 위상장 중심 하강(토스트 회피)
function phasePos(i: number) {
  const ang = -Math.PI / 2 + (i * Math.PI * 2) / 3;
  return { x: cx + Math.cos(ang) * phaseRad, y: phaseCy + Math.sin(ang) * phaseRad };
}

function baseInput(over: Partial<BoardInput>): BoardInput {
  return {
    shells: [],
    decadeProgress: 0,
    energyLabel: '0',
    resonance: { active: false, open: false, progress: 0, combo: 0 },
    phase: { active: false, state: 'coherent', pinned: false, cycleProgress: 0, pinCostLabel: '0', nodes: [] },
    harmonics: { active: false, chargeProgress: 0, nextTier: 1, burstingTiers: [], totalResonances: 0 },
    ...over,
  };
}

const NODES = [
  { state: 'coherent' as const, nameKo: '응집', effect: '체인 ↑', mult: 1.35, found: false },
  { state: 'dispersed' as const, nameKo: '분산', effect: '데이터 ↑', mult: 1.05, found: false },
  { state: 'resonant' as const, nameKo: '공명', effect: '거품 ↑', mult: 1.18, found: false },
];

describe('BoardRenderer 다이제틱 히트테스트 (L6 위상)', () => {
  it('위상 활성 시 세 노드 위치 클릭 → 해당 상태 phase 히트', () => {
    const b = new BoardRenderer();
    b.setReducedMotion(true); // 정적 위치(결정적)
    const ctx = makeCtx();
    b.setInput(baseInput({ phase: { active: true, state: 'coherent', pinned: false, cycleProgress: 0.3, pinCostLabel: '12', nodes: NODES } }));
    b.draw(ctx, W, H, 0.016, 0); // 기하 설정

    for (let i = 0; i < 3; i++) {
      const p = phasePos(i);
      b.setPointer(p.x, p.y);
      expect(b.activate()).toEqual({ kind: 'phase', state: NODES[i].state });
    }
  });

  it('위상 비활성이면 같은 위치 클릭이 phase 히트가 아니다', () => {
    const b = new BoardRenderer();
    b.setReducedMotion(true);
    const ctx = makeCtx();
    b.setInput(baseInput({ phase: { active: false, state: 'coherent', pinned: false, cycleProgress: 0, pinCostLabel: '0', nodes: NODES } }));
    b.draw(ctx, W, H, 0.016, 0);
    const p = phasePos(0);
    b.setPointer(p.x, p.y);
    expect(b.activate().kind).not.toBe('phase');
  });
});

describe('BoardRenderer 다이제틱 (L7 하모닉 passive)', () => {
  it('하모닉 활성 시 draw가 throw하지 않고, 중심 클릭은 히트 없음(passive)', () => {
    const b = new BoardRenderer();
    b.setReducedMotion(true);
    const ctx = makeCtx();
    b.setInput(baseInput({ harmonics: { active: true, chargeProgress: 0.7, nextTier: 3, burstingTiers: [5], totalResonances: 12 } }));
    expect(() => b.draw(ctx, W, H, 0.016, 0)).not.toThrow();
    b.setPointer(cx, cy);
    expect(b.activate().kind).toBe('none');
  });
});
