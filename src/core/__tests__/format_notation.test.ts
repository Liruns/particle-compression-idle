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
import { formatNumber, formatScale, formatDuration, setDefaultNotation, getDefaultNotation } from '../format';

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

describe('formatScale — 도감 스케일 위첨자 통일', () => {
  it('일반 e표기 → 위첨자 + m', () => {
    expect(formatScale('2.75e-10')).toBe('2.75×10⁻¹⁰ m');
    expect(formatScale('1e-33')).toBe('1.00×10⁻³³ m');
  });
  it('"<" 상한 접두사 보존', () => {
    expect(formatScale('<1e-18')).toBe('<1.00×10⁻¹⁸ m');
  });
  it('"0"·빈값·손상 → —', () => {
    expect(formatScale('0')).toBe('—');
    expect(formatScale('')).toBe('—');
    expect(formatScale(null)).toBe('—');
  });
  it('표기 설정과 무관하게 항상 scientific(위첨자)', () => {
    setDefaultNotation('engineering');
    expect(formatScale('2.75e-10')).toBe('2.75×10⁻¹⁰ m'); // e표기 아님
  });
});

describe('formatNumber 경계값(방어 — 화면 garbage/거짓 0 방지)', () => {
  it('0·NaN·±Infinity', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(NaN)).toBe('NaN');
    expect(formatNumber(Infinity)).toBe('∞'); // "1.00×10Infinity" garbage 아님
    expect(formatNumber(-Infinity)).toBe('-∞');
  });

  it('음수는 부호 보존', () => {
    expect(formatNumber(-1234)).toBe('-1,234');
    expect(formatNumber('-1.23e8', 2, 'scientific')).toBe('-1.23×10⁸');
  });

  it('아주 작은 값은 "0.00"으로 뭉개지지 않고 과학 표기로 폴백(거짓 0 방지)', () => {
    const s = formatNumber(0.0003, 2, 'scientific');
    expect(s).toContain('×10');
    expect(parseFloat(s)).not.toBe(0);
    // 소수 2자리로 표현 가능한 작은 값은 그대로 소수.
    expect(formatNumber(0.25, 2)).toBe('0.25');
  });
});

describe('formatDuration — 복합 2단위 + 방어(스텁 소수-단위 제거)', () => {
  it('초/분/시간/일 복합, 하위 0 단위 생략', () => {
    expect(formatDuration(45)).toBe('45초');
    expect(formatDuration(90)).toBe('1분 30초');
    expect(formatDuration(300)).toBe('5분');
    expect(formatDuration(3600)).toBe('1시간');
    expect(formatDuration(9240)).toBe('2시간 34분');
    expect(formatDuration(93600)).toBe('1일 2시간');
    expect(formatDuration(86400)).toBe('1일');
  });
  it('음수·NaN·Infinity → 0초(방어)', () => {
    expect(formatDuration(-5)).toBe('0초');
    expect(formatDuration(NaN)).toBe('0초');
    expect(formatDuration(Infinity)).toBe('0초');
  });
});

describe('logarithm 표기 (AD Logarithm 참조 — 로그 스케일 게임 테마)', () => {
  it('거대 수는 e{log₁₀} — 자릿수 직관', () => {
    expect(formatNumber('1e40', 2, 'logarithm')).toBe('e40.00');
    expect(formatNumber('1.23e40', 2, 'logarithm')).toBe('e40.09');
    expect(formatNumber('1e100', 2, 'logarithm')).toBe('e100.00');
  });
  it('극소 수는 음수 지수', () => {
    expect(formatNumber('3e-11', 2, 'logarithm')).toBe('e-10.52');
  });
  it('작은 수는 표기법 무관 콤마 유지(로그 분기 미도달)', () => {
    expect(formatNumber(1234, 2, 'logarithm')).toBe('1,234');
    expect(formatNumber(70.25, 2, 'logarithm')).toBe('70.25');
  });
  it('전역 기본으로 설정 시 미지정 호출부가 로그를 따름', () => {
    setDefaultNotation('logarithm');
    expect(getDefaultNotation()).toBe('logarithm');
    expect(formatNumber('1e50', 2)).toBe('e50.00');
  });
});
