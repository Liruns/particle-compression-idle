/**
 * format — Decimal → 사람이 읽는 문자열. (tech-architecture.md §2.3)
 *
 * 철칙: "계산과 표시는 완전히 분리한다." Decimal은 내부 계산 전용,
 *       화면 출력은 이 포맷 레이어가 전담. 게임 로직·tick은 절대 문자열 포맷을 다루지 않는다.
 *
 * DESIGN.md game-ui.number-format:
 *   scientific:  "N.NN×10^exp"   (기본 — r값, 극소·극대)
 *   engineering: "N.NNe+exp"     (자원 표시용)
 *   prefix:      "K/M/G/T"       (옵션, 설정에서 전환)
 *   min-digits:  3               (유효 자릿수)
 *
 * 이 스켈레톤은 과학/공학/극소(r) 표기의 **자리**를 잡는다. 표기법 전환(설정),
 * 테마 접두사("플랑크 길이의 N배" 등 §2.3), 색맹/감소모션 무관한 순수 문자열 변환은
 * 후속 마일스톤(M1.2+)에서 확장. 지금은 헬로 셸이 읽을 수 있을 만큼만 정확히 동작.
 */

import { Decimal, D, type DecimalSource } from '../bignum';

export type NotationKind = 'scientific' | 'engineering' | 'standard';

/** 유효 자릿수 기본값(DESIGN min-digits=3 → 소수 2자리 = 유효 3자리). */
const DEFAULT_DECIMALS = 2;

/** 위첨자 변환용 (과학 표기 1.23×10²³ 의 지수부). */
const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

function toSuperscript(n: number): string {
  return String(n)
    .split('')
    .map((ch) => SUPERSCRIPT[ch] ?? ch)
    .join('');
}

/**
 * 자원·수치 표시 메인 진입점.
 * - |x| < 1e6 이고 정수에 가까우면 그냥 콤마 표기(읽기 쉬움).
 * - 그 외에는 과학 표기(기본). break_eternity의 거대/극소 지수도 안전하게 처리.
 */
export function formatNumber(
  value: DecimalSource,
  decimals: number = DEFAULT_DECIMALS,
  notation: NotationKind = 'scientific',
): string {
  const d = D(value);

  if (d.eq(0)) return '0';
  if (Number.isNaN(d.mag)) return 'NaN';

  const neg = d.sign < 0;
  const abs = d.abs();

  // 작은 수는 사람 친화 표기 (1,234 처럼)
  if (abs.lt('1e6') && abs.gte('1e-4')) {
    const asNum = abs.toNumber();
    const body =
      Number.isInteger(asNum) && asNum < 1e6
        ? asNum.toLocaleString('en-US')
        : asNum.toFixed(decimals);
    return neg ? `-${body}` : body;
  }

  // 큰/작은 수는 표기법에 따라
  const exp = abs.log10().floor().toNumber();
  const formatted =
    notation === 'engineering'
      ? formatEngineering(abs, exp, decimals)
      : formatScientific(abs, exp, decimals);

  return neg ? `-${formatted}` : formatted;
}

/** N.NN×10ⁿ — DESIGN scientific 기본. */
function formatScientific(abs: Decimal, exp: number, decimals: number): string {
  // mantissa = abs / 10^exp  (1 <= mantissa < 10)
  const mantissa = abs.div(Decimal.pow(10, exp));
  const m = mantissa.toNumber();
  const mStr = Number.isFinite(m) ? m.toFixed(decimals) : '1.00';
  return `${mStr}×10${toSuperscript(exp)}`;
}

/** N.NNe+exp — 자원 표시용 공학 표기(지수 3의 배수). */
function formatEngineering(abs: Decimal, exp: number, decimals: number): string {
  const engExp = Math.floor(exp / 3) * 3;
  const mantissa = abs.div(Decimal.pow(10, engExp));
  const m = mantissa.toNumber();
  const mStr = Number.isFinite(m) ? m.toFixed(decimals) : '1.00';
  const sign = engExp >= 0 ? '+' : '';
  return `${mStr}e${sign}${engExp}`;
}

/**
 * 반경 r 표시 (극소 표기). tech-architecture.md §2.3 "작아짐=강해짐" 화면 역설.
 * r = r₀·10^(-dec) 은 아주 작은 값(예: 1.6e-35 m)이므로 항상 과학 표기 + 단위.
 * (테마 변환 "플랑크 길이의 N배"는 후속 — 지금은 미터 단위 과학 표기.)
 */
export function formatRadius(rMeters: DecimalSource): string {
  const d = D(rMeters);
  if (d.eq(0)) return '0 m';
  return `${formatNumber(d, 3, 'scientific')} m`;
}

/** 시간(초) → 사람이 읽는 문자열. 오프라인 복귀·페이싱 표시용 헬퍼 스텁. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}시간`;
  return `${(seconds / 86400).toFixed(1)}일`;
}
