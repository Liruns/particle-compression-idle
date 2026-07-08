/**
 * FTUE 힌트 = 액션 신호 기반 검증 (온보딩 마찰 수정).
 *
 * 배경: 물 분자가 t=0에 자동 발견돼 stage가 즉시 'codex'로 뛴다. 예전엔 힌트를 stage로 정해
 *   "결속하라"가 살 수 없는 초반(첫 T1 ≈ 439E, rate 1/s → ~7분) 내내 떴다. 또 첫 T1 여유 시점엔
 *   이미 원자층이라 층 게이트로 힌트가 사라졌다. → 힌트를 액션 신호(구매/여유/층)로 재정의.
 */
import { describe, it, expect } from 'vitest';
import { deriveFtue, type FtueInput } from '../ftue';

const base: FtueInput = {
  hasBoughtAnyTier: false,
  canAffordFirstTier: false,
  discoveredCount: 1, // 물 분자 자동 발견(실제 신규 게임 조건)
  layerIndex: 1,
  hasPrestiged: false,
  hasDiscoveryData: false,
};

describe('FTUE 힌트 — 액션 기반', () => {
  it('미구매·미여유(신규) → "압축", "결속" 아님', () => {
    const h = deriveFtue(base).hint ?? '';
    expect(h).toContain('압축');
    expect(h).not.toContain('결속');
  });

  it('여유(미구매) → "결속" 안내', () => {
    const h = deriveFtue({ ...base, canAffordFirstTier: true }).hint ?? '';
    expect(h).toContain('결속');
  });

  it('여유(미구매) — 이미 원자층이어도 "결속" 유지(층 게이트로 안 사라짐)', () => {
    const h = deriveFtue({ ...base, canAffordFirstTier: true, layerIndex: 2 }).hint ?? '';
    expect(h).toContain('결속');
  });

  it('구매 후 분자층 → "가속/자동" 안내', () => {
    const h = deriveFtue({ ...base, hasBoughtAnyTier: true, canAffordFirstTier: true }).hint ?? '';
    expect(h).toMatch(/작동|빨라/);
  });

  it('구매 후 원자층+ → 힌트 없음(내러티브 양보)', () => {
    const h = deriveFtue({ ...base, hasBoughtAnyTier: true, layerIndex: 2 }).hint;
    expect(h).toBeNull();
  });
});
