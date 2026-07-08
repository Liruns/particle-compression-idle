/**
 * 표기법 검증 (설정 — SettingsState.notation → format 전역 기본).
 *
 * 커버:
 *  - standard(접미사) 표기: K/M/B/Qa … · 범위 밖 초거대값·극소값은 과학 표기 폴백.
 *  - engineering: 지수 3의 배수.
 *  - setDefaultNotation: notation 미지정 호출부가 전역 기본을 따른다(callsite 0 수정 전환).
 *  - 작은 정수는 표기법 무관 콤마(사람 친화) 유지.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { formatNumber, setDefaultNotation, getDefaultNotation } from '../format';

// 각 테스트 후 전역 기본 복구(다른 테스트 오염 방지).
afterEach(() => setDefaultNotation('scientific'));

describe('standard 표기(접미사)', () => {
  it('백만·십억·조 접미사', () => {
    expect(formatNumber('1.23e6', 2, 'standard')).toBe('1.23M');
    expect(formatNumber('4.5e9', 2, 'standard')).toBe('4.50B');
    expect(formatNumber('7e12', 2, 'standard')).toBe('7.00T');
  });

  it('큰 접미사(Qa=1e15, Dc=1e33)', () => {
    expect(formatNumber('2e15', 2, 'standard')).toBe('2.00Qa');
    expect(formatNumber('3e33', 2, 'standard')).toBe('3.00Dc');
  });

  it('접미사 소진(초거대) → 과학 표기 폴백', () => {
    // 표 마지막(NoDc=1e60 그룹 20) 초과 → 과학 표기.
    const s = formatNumber('1e75', 2, 'standard');
    expect(s).toContain('×10');
  });

  it('극소값(exp<0) → 과학 표기 폴백', () => {
    const s = formatNumber('1.5e-9', 3, 'standard');
    expect(s).toContain('×10');
  });
});

describe('engineering 표기', () => {
  it('지수 3의 배수', () => {
    expect(formatNumber('1.23e7', 2, 'engineering')).toBe('12.30e+6');
    expect(formatNumber('5e9', 2, 'engineering')).toBe('5.00e+9');
  });
});

describe('setDefaultNotation — 전역 기본(callsite 0 전환)', () => {
  it('기본은 scientific', () => {
    expect(getDefaultNotation()).toBe('scientific');
    expect(formatNumber('1.23e8', 2)).toContain('×10');
  });

  it('standard로 바꾸면 notation 미지정 호출부가 따른다', () => {
    setDefaultNotation('standard');
    expect(getDefaultNotation()).toBe('standard');
    expect(formatNumber('1.23e8', 2)).toBe('123.00M');
  });

  it('명시 notation은 전역 기본을 무시(우선)', () => {
    setDefaultNotation('standard');
    expect(formatNumber('1.23e8', 2, 'scientific')).toContain('×10');
  });
});

describe('작은 수는 표기법 무관 콤마', () => {
  it('정수는 콤마(과학/공학/표준 동일)', () => {
    expect(formatNumber(1234, 2, 'scientific')).toBe('1,234');
    expect(formatNumber(1234, 2, 'engineering')).toBe('1,234');
    expect(formatNumber(1234, 2, 'standard')).toBe('1,234');
  });
});
