/**
 * WorldRenderer 전환 검증 (M2.5 — 전환 하강 + 머니샷).
 *
 * 커버:
 *  - setLayerBySlug → 전환 시작(transitioning), 충분한 dt 누적 후 완료.
 *  - 머니샷 전환이 일반 전환보다 오래 걸린다(MONEY_SHOT_DUR > TRANSITION_DUR).
 *  - reduced-motion이면 전환 없이 즉시 스냅(멀미 방지). 같은 slug는 무시.
 *  - draw가 전환 중/후 throw하지 않음(canvas 스텁).
 */
import { describe, it, expect } from 'vitest';
import { WorldRenderer } from '../world-renderer';

// 최소 Canvas2D 스텁(board.test와 동형) — gradient는 addColorStop 보유.
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
  H = 600;

/** dt 스텝을 누적해 전환이 끝날 때까지(또는 상한) draw를 돌린 총 시간(초) 반환. */
function runUntilDone(wr: WorldRenderer, ctx: CanvasRenderingContext2D, maxSec = 10): number {
  let t = 0;
  const step = 0.05;
  while (wr.transitioning && t < maxSec) {
    wr.draw(ctx, W, H, step);
    t += step;
  }
  return t;
}

describe('WorldRenderer 전환', () => {
  it('setLayerBySlug → 전환 시작, dt 누적 후 완료', () => {
    const wr = new WorldRenderer();
    const ctx = makeCtx();
    wr.draw(ctx, W, H, 0.016); // 초기 프레임
    wr.setLayerBySlug('atom');
    expect(wr.transitioning).toBe(true);
    const secs = runUntilDone(wr, ctx);
    expect(wr.transitioning).toBe(false);
    expect(secs).toBeLessThan(6); // 일반 전환은 수 초 내 완료
  });

  it('머니샷 전환이 일반보다 오래 걸린다', () => {
    const ctxA = makeCtx();
    const wrA = new WorldRenderer();
    wrA.draw(ctxA, W, H, 0.016);
    wrA.setLayerBySlug('atom'); // 일반
    const normalSecs = runUntilDone(wrA, ctxA);

    const ctxB = makeCtx();
    const wrB = new WorldRenderer();
    wrB.draw(ctxB, W, H, 0.016);
    wrB.setLayerBySlug('atom', true); // 머니샷
    const moneySecs = runUntilDone(wrB, ctxB);

    expect(moneySecs).toBeGreaterThan(normalSecs);
  });

  it('reduced-motion이면 전환 없이 즉시 스냅', () => {
    const wr = new WorldRenderer();
    wr.setReducedMotion(true);
    wr.setLayerBySlug('atom');
    expect(wr.transitioning).toBe(false);
  });

  it('진행 중 reduced-motion 켜면 전환 즉시 종료', () => {
    const wr = new WorldRenderer();
    const ctx = makeCtx();
    wr.draw(ctx, W, H, 0.016);
    wr.setLayerBySlug('nuc');
    expect(wr.transitioning).toBe(true);
    wr.setReducedMotion(true);
    expect(wr.transitioning).toBe(false);
  });

  it('draw는 전환 중에도 throw하지 않는다', () => {
    const wr = new WorldRenderer();
    const ctx = makeCtx();
    wr.setLayerBySlug('prn', true);
    expect(() => {
      for (let i = 0; i < 10; i++) wr.draw(ctx, W, H, 0.1);
    }).not.toThrow();
  });
});
