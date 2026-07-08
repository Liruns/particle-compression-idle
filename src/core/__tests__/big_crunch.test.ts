/**
 * 빅 크런치(PT7) + 재하강 검증 (economy §1.2·§4.4·§7.3·§7.4).
 *
 * 커버:
 *  - 가용 판정: 6벽 소진(count≥6) + 플랑크 dec26 재도달.
 *  - K=1.05(베켄슈타인): 같은 lifetime_C에서 QF ×1.05. economy §7.4 PT6 1.084e7 → 1.138e7 정합.
 *  - 재하강 리셋: E·C=0 / 층→분자(1) / count→0(벽 재통과) / runIndex+1 / QF 가산 / D 회차곡선 보존 / qfClaimed 확정.
 *  - D 보존 회차 곡선(§7.3): [-,.65,.50,.40,.40,.38,.35], 범위 밖 0.35 클램프.
 */
import { describe, it, expect } from 'vitest';
import { D } from '../bignum';
import { seedBought } from '../state';
import {
  isBigCrunchAvailable,
  previewBigCrunch,
  applyBigCrunchReset,
  dPreservation,
  qfTotal,
  BIG_CRUNCH_K,
  D_PRESERVATION_CURVE,
} from '../prestige';

describe('isBigCrunchAvailable', () => {
  it('6벽 소진 + dec26 재도달 → 가능', () => {
    expect(isBigCrunchAvailable(26, 6)).toBe(true);
    expect(isBigCrunchAvailable(30, 6)).toBe(true); // 26 초과도 OK
  });
  it('벽 미소진 또는 dec 미달 → 불가', () => {
    expect(isBigCrunchAvailable(26, 5)).toBe(false); // 5벽 → 아직 PT6(정상 상전이) 남음
    expect(isBigCrunchAvailable(25, 6)).toBe(false); // dec 26 미달
    expect(isBigCrunchAvailable(19, 0)).toBe(false);
  });
});

describe('K=1.05 (베켄슈타인, economy §7.4)', () => {
  it('빅 크런치 QF = 일반 QF ×1.05 (floor 전 비율)', () => {
    // lifetime_C=1.175e40 → K=1.0 QF ≈ 1.084e7, K=1.05 → ≈ 1.138e7.
    const lc = '1.175e40';
    const k1 = qfTotal(lc, 1).toNumber();
    const k105 = qfTotal(lc, BIG_CRUNCH_K).toNumber();
    expect(k1).toBeGreaterThan(1.0e7);
    expect(k1).toBeLessThan(1.1e7);
    expect(k105 / k1).toBeCloseTo(1.05, 2); // ×1.05 prefactor
    expect(k105).toBeGreaterThan(1.13e7);
    expect(k105).toBeLessThan(1.15e7);
  });
  it('BIG_CRUNCH_K 상수 = 1.05 (임의 변경 금지)', () => {
    expect(BIG_CRUNCH_K).toBe(1.05);
  });
});

describe('previewBigCrunch', () => {
  it('불가 상태면 null', () => {
    expect(previewBigCrunch(25, 6, 0, '1e40', 0)).toBeNull();
    expect(previewBigCrunch(26, 5, 0, '1e40', 0)).toBeNull();
  });
  it('가능하면 K=1.05 QF + 다음 회차', () => {
    const p = previewBigCrunch(26, 6, 0, '1.175e40', 0);
    expect(p).not.toBeNull();
    expect(p!.nextRunIndex).toBe(1);
    expect(p!.qfTotal.toNumber()).toBeCloseTo(qfTotal('1.175e40', 1.05).toNumber(), 0);
    expect(p!.qfGain.eq(p!.qfTotal)).toBe(true); // qfClaimed=0이면 gain=total
  });
});

describe('dPreservation 회차 곡선 (§7.3)', () => {
  it('곡선 값: 2회차 0.65 … 6회차 0.38, 범위 밖 0.35 클램프', () => {
    expect(D_PRESERVATION_CURVE).toEqual([1, 0.65, 0.5, 0.4, 0.4, 0.38, 0.35]);
    expect(dPreservation(1)).toBe(0.65); // 첫 빅 크런치 → 회차2
    expect(dPreservation(2)).toBe(0.5);
    expect(dPreservation(6)).toBe(0.35);
    expect(dPreservation(9)).toBe(0.35); // 클램프
    expect(dPreservation(0)).toBe(1); // 캠페인1(빅 크런치 아님)
  });
});

describe('applyBigCrunchReset — 재하강 매트릭스', () => {
  it('E·C 리셋 / 층→분자 / count→0 / runIndex+1 / QF 가산 / D 보존', () => {
    const preview = previewBigCrunch(26, 6, 0, '1.175e40', 0)!;
    const reset = applyBigCrunchReset(preview, D('1e7'), D('500'), 0, seedBought);
    expect(reset.E.eq(0)).toBe(true);
    expect(reset.C.eq(0)).toBe(true);
    expect(reset.layerIndex).toBe(1); // 분자층
    expect(reset.count).toBe(0); // 벽 재통과
    expect(reset.runIndex).toBe(1); // 첫 빅 크런치
    expect(reset.bought).toEqual(seedBought());
    // QF = 이전(1e7) + gain(preview.qfGain).
    expect(reset.QF.eq(D('1e7').add(preview.qfGain))).toBe(true);
    expect(reset.qfClaimed.eq(preview.qfTotal)).toBe(true);
    // D_current 500 × dPreservation(1)=0.65 = 325.
    expect(reset.dCurrent.toNumber()).toBeCloseTo(325, 6);
  });

  it('2회차 재하강(runIndex 1→2)은 D 0.50 보존', () => {
    const preview = previewBigCrunch(26, 6, 1, '2e40', 0)!;
    const reset = applyBigCrunchReset(preview, D('1e7'), D('1000'), 1, seedBought);
    expect(reset.runIndex).toBe(2);
    expect(reset.dCurrent.toNumber()).toBeCloseTo(500, 6); // 1000 × 0.50
  });
});
