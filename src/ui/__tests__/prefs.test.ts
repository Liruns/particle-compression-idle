/**
 * 환경설정 스토어 검증 (설정 — 접근성 §2-B 모션 원칙).
 *
 * 커버:
 *  - 기본 motion='auto', 볼륨/뮤트 기본.
 *  - effectiveReducedMotion = OS감소 OR 사용자'reduce'. (node 환경 OS=false → 'reduce'만 true.)
 *  - setMuted/setVolume 클램프.
 * (node 환경엔 window/matchMedia 없음 → osReducedMotion=false로 고정. OS-wins의 OR 반쪽 검증.)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { prefs, effectiveReducedMotion, setMuted, setVolume, setMotion } from '../stores/prefs';

beforeEach(() => {
  // 각 테스트 독립 — 기본으로 되돌림.
  prefs.set({ muted: false, volume: 0.7, motion: 'auto', ambient: true });
});

describe('prefs 기본값', () => {
  it('기본 motion=auto · muted=false · volume=0.7', () => {
    const p = get(prefs);
    expect(p.motion).toBe('auto');
    expect(p.muted).toBe(false);
    expect(p.volume).toBeCloseTo(0.7);
  });
});

describe('effectiveReducedMotion — OS감소 OR 사용자 reduce', () => {
  it("auto + OS 미감소(node) → 전체 모션(false)", () => {
    setMotion('auto');
    expect(get(effectiveReducedMotion)).toBe(false);
  });

  it("사용자 reduce → 항상 감소(true)", () => {
    setMotion('reduce');
    expect(get(effectiveReducedMotion)).toBe(true);
  });

  it('reduce→auto 전환이 반영', () => {
    setMotion('reduce');
    expect(get(effectiveReducedMotion)).toBe(true);
    setMotion('auto');
    expect(get(effectiveReducedMotion)).toBe(false);
  });
});

describe('setVolume 클램프 · setMuted', () => {
  it('볼륨 0..1 클램프', () => {
    setVolume(2);
    expect(get(prefs).volume).toBe(1);
    setVolume(-1);
    expect(get(prefs).volume).toBe(0);
    setVolume(0.5);
    expect(get(prefs).volume).toBe(0.5);
  });

  it('뮤트 토글', () => {
    setMuted(true);
    expect(get(prefs).muted).toBe(true);
    setMuted(false);
    expect(get(prefs).muted).toBe(false);
  });
});
