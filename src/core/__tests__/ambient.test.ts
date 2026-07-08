/**
 * 앰비언트 파라미터 매핑 검증 (사운드 2차 — audio-design §1 4축).
 *
 * 커버:
 *  - 깊을수록(작아질수록) 드론 음고↑ · 노이즈(매질)↓ · 컷오프↑(밝은 점) · 디튠↓. 단조성.
 *  - 분자층=따뜻/두터움, 플랑크층=얇음/무향 접근. 범위 밖 클램프. 유효 파라미터(양수·유한).
 */
import { describe, it, expect } from 'vitest';
import { ambientParams } from '../audio/ambient';

describe('ambientParams — 웜↔쿨 아크', () => {
  it('깊을수록 드론 음고 상승(작아짐=음고↑)', () => {
    expect(ambientParams(11).droneHz).toBeGreaterThan(ambientParams(1).droneHz);
    expect(ambientParams(6).droneHz).toBeGreaterThan(ambientParams(2).droneHz);
  });

  it('깊을수록 노이즈(매질) 감소 → 플랑크 거의 침묵', () => {
    expect(ambientParams(1).noiseGain).toBeGreaterThan(ambientParams(11).noiseGain);
    expect(ambientParams(11).noiseGain).toBeLessThan(0.1);
  });

  it('깊을수록 드론 몸통 감소(얇아짐)', () => {
    expect(ambientParams(1).droneGain).toBeGreaterThan(ambientParams(11).droneGain);
  });

  it('깊을수록 컷오프 상승(밝은 협대역 점)', () => {
    expect(ambientParams(11).cutoffHz).toBeGreaterThan(ambientParams(1).cutoffHz);
  });

  it('깊을수록 디튠 감소(순음화)', () => {
    expect(ambientParams(1).detune).toBeGreaterThan(ambientParams(11).detune);
    expect(ambientParams(11).detune).toBe(0);
  });

  it('범위 밖 인덱스 클램프(양끝 동일)', () => {
    expect(ambientParams(0)).toEqual(ambientParams(1));
    expect(ambientParams(99)).toEqual(ambientParams(11));
  });

  it('모든 파라미터 유효(양수·유한)', () => {
    for (let i = 1; i <= 11; i++) {
      const p = ambientParams(i);
      expect(p.droneHz).toBeGreaterThan(0);
      expect(Number.isFinite(p.droneHz)).toBe(true);
      expect(p.droneGain).toBeGreaterThan(0);
      expect(p.noiseGain).toBeGreaterThanOrEqual(0);
      expect(p.cutoffHz).toBeGreaterThan(0);
      expect(p.detune).toBeGreaterThanOrEqual(0);
    }
  });
});
