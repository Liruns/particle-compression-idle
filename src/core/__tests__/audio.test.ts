/**
 * 사운드 서술자 순수 로직 검증 (M2.4 — audio-design.md 정신).
 *
 * 커버:
 *  - layerBaseFreq: 층이 깊을수록(작아질수록) 음고 상승 · 결정적 · 범위 밖 클램프.
 *  - voiceForEvent: 순수(동일 입력→동일 출력) · 능동 이벤트=발음 · 자동/방치 이벤트=무음.
 *  - 결과 분기: 공명 성공 vs 실패 · 전설 발견 vs 일반 · 첫 상전이 vs 이후.
 *  - 층 인덱스가 기음에 반영(음역 동기).
 */
import { describe, it, expect } from 'vitest';
import { layerBaseFreq, voiceForEvent } from '../audio/voices';

const CTX = { layerIndex: 1 };

describe('layerBaseFreq — 층 색온도↔음역', () => {
  it('층이 깊을수록 기음이 (약단조로) 상승', () => {
    const freqs = [1, 2, 3, 5, 6, 7, 11].map((i) => layerBaseFreq(i));
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i]).toBeGreaterThan(freqs[i - 1]);
    }
  });

  it('결정적 — 같은 층은 같은 주파수', () => {
    expect(layerBaseFreq(6)).toBe(layerBaseFreq(6));
  });

  it('범위 밖 인덱스는 클램프(양끝)', () => {
    expect(layerBaseFreq(0)).toBe(layerBaseFreq(1));
    expect(layerBaseFreq(99)).toBe(layerBaseFreq(11));
  });

  it('1층 기음은 가청·양수', () => {
    const f = layerBaseFreq(1);
    expect(f).toBeGreaterThan(20);
    expect(f).toBeLessThan(20000);
  });
});

describe('voiceForEvent — 순수성·발음 분기', () => {
  it('같은 입력 → 같은 보이스(순수)', () => {
    const a = voiceForEvent('manual_compress', {}, CTX);
    const b = voiceForEvent('manual_compress', {}, CTX);
    expect(a).toEqual(b);
  });

  it('능동 액션은 최소 한 보이스', () => {
    for (const name of [
      'manual_compress',
      'chain_purchased',
      'resonance_click',
      'phase_pinned',
      'harmonic_resonance',
      'research_purchased',
      'codexDiscover',
      'layerEnter',
      'prestige',
      'offlineApplied',
    ]) {
      expect(voiceForEvent(name, {}, CTX).length).toBeGreaterThan(0);
    }
  });

  it('자동/방치 이벤트는 무음(saved·phase_cycled·resonance_auto·미지 이벤트)', () => {
    for (const name of ['saved', 'phase_cycled', 'resonance_auto', 'nonexistent_event']) {
      expect(voiceForEvent(name, {}, CTX)).toEqual([]);
    }
  });

  it('공명 성공 vs 실패는 다른 소리(성공이 더 밝고/풍성)', () => {
    const ok = voiceForEvent('resonance_click', { success: true }, CTX);
    const miss = voiceForEvent('resonance_click', { success: false }, CTX);
    expect(ok).not.toEqual(miss);
    // 성공은 옥타브 위 벨(더 높은 주파수) + 화음(보이스 수 ≥ 실패).
    expect(ok.length).toBeGreaterThanOrEqual(miss.length);
    expect(Math.max(...ok.map((v) => v.freq))).toBeGreaterThan(Math.max(...miss.map((v) => v.freq)));
  });

  it('전설 발견은 일반보다 풍성(화음)', () => {
    const legend = voiceForEvent('codexDiscover', { legendary: true }, CTX);
    const normal = voiceForEvent('codexDiscover', { legendary: false }, CTX);
    expect(legend.length).toBeGreaterThan(normal.length);
  });

  it('첫 상전이는 이후보다 크게(머니샷)', () => {
    const first = voiceForEvent('prestige', { count: 1 }, CTX);
    const later = voiceForEvent('prestige', { count: 3 }, CTX);
    expect(first[0].gain).toBeGreaterThan(later[0].gain);
  });

  it('하모닉 공명 티어가 높을수록 음고 상승', () => {
    const t1 = voiceForEvent('harmonic_resonance', { tier: 1 }, CTX)[0].freq;
    const t5 = voiceForEvent('harmonic_resonance', { tier: 5 }, CTX)[0].freq;
    expect(t5).toBeGreaterThan(t1);
  });

  it('층이 다르면 기음이 반영(음역 동기)', () => {
    const l1 = voiceForEvent('manual_compress', {}, { layerIndex: 1 })[0].freq;
    const l6 = voiceForEvent('manual_compress', {}, { layerIndex: 6 })[0].freq;
    expect(l6).toBeGreaterThan(l1);
  });

  it('모든 보이스는 유효 파라미터(양수 freq/dur/gain, 유한)', () => {
    for (const name of ['manual_compress', 'prestige', 'layerEnter', 'chain_purchased']) {
      for (const v of voiceForEvent(name, { count: 3 }, { layerIndex: 6 })) {
        expect(v.freq).toBeGreaterThan(0);
        expect(Number.isFinite(v.freq)).toBe(true);
        expect(v.dur).toBeGreaterThan(0);
        expect(v.gain).toBeGreaterThan(0);
        expect(v.gain).toBeLessThanOrEqual(1);
      }
    }
  });
});
