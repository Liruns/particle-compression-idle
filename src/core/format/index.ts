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

/**
 * 모듈 기본 표기법. 설정(SettingsState.notation)을 game이 로드/변경 시 주입한다.
 *  formatNumber에 notation을 명시하지 않은 모든 호출부(App·board·뷰)가 이 값을 따른다 →
 *  callsite 0개 수정으로 표기법 전환(표시 전용 전역, 로직·경제 불변).
 */
let defaultNotation: NotationKind = 'scientific';

/** 기본 표기법 설정(설정 패널 → game.setNotation → 여기). */
export function setDefaultNotation(n: NotationKind): void {
  defaultNotation = n;
}

/** 현재 기본 표기법. */
export function getDefaultNotation(): NotationKind {
  return defaultNotation;
}

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
  notation?: NotationKind,
): string {
  const d = D(value);

  if (d.eq(0)) return '0';
  if (Number.isNaN(d.mag)) return 'NaN';
  // Infinity 방어 — scientific 경로로 새면 "1.00×10Infinity" 같은 garbage가 됨(위첨자 변환 통과).
  if (!Number.isFinite(d.mag)) return d.sign < 0 ? '-∞' : '∞';

  const neg = d.sign < 0;
  const abs = d.abs();

  // 작은 수는 사람 친화 표기 (1,234 처럼)
  if (abs.lt('1e6') && abs.gte('1e-4')) {
    const asNum = abs.toNumber();
    const body =
      Number.isInteger(asNum) && asNum < 1e6
        ? asNum.toLocaleString('en-US')
        : asNum.toFixed(decimals);
    // 0이 아닌데 반올림이 "0.00"으로 뭉개지면(값 < 0.5·10⁻ᵈ) 과학 표기로 폴백 — 거짓 0 방지.
    if (parseFloat(body) !== 0) return neg ? `-${body}` : body;
  }

  // 큰/작은 수는 표기법에 따라(미지정 시 모듈 기본 — 설정 반영).
  const nk: NotationKind = notation ?? defaultNotation;
  const exp = abs.log10().floor().toNumber();
  const formatted =
    nk === 'engineering'
      ? formatEngineering(abs, exp, decimals)
      : nk === 'standard'
        ? formatStandard(abs, exp, decimals)
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

/** 접미사 표기(단위: K/M/B/T … 짧은 스케일). 표에 없는 초거대/미소값은 과학 표기로 안전 폴백. */
const STANDARD_SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No',
  'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc',
];

/**
 * N.NN[접미사] — 접미사 표기(예: 1.23M, 4.56Qa). 지수를 3자리 그룹으로 나눠 접미사를 붙인다.
 *  범위 밖(접미사 소진) 또는 극소값(exp<0)은 과학 표기로 폴백 — 반쪽짜리 표기 방지.
 */
function formatStandard(abs: Decimal, exp: number, decimals: number): string {
  if (exp < 0) return formatScientific(abs, exp, decimals);
  const group = Math.floor(exp / 3);
  if (group >= STANDARD_SUFFIXES.length) return formatScientific(abs, exp, decimals);
  const mantissa = abs.div(Decimal.pow(10, group * 3));
  const m = mantissa.toNumber();
  const mStr = Number.isFinite(m) ? m.toFixed(decimals) : '1.00';
  return `${mStr}${STANDARD_SUFFIXES[group]}`;
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

/**
 * 도감 입자 스케일 문자열(scaleM) → 표시. 데이터는 `"2.75e-10"`·`"<1e-18"`·`"0"` 등 다양 →
 *  게임 전체(r 표기)와 동일한 **과학 위첨자**로 통일(밤티 회피). "<"(측정 상한) 접두사 보존, "0"·빈값은 "—".
 *  표기 설정(공학/표준) 무관하게 항상 scientific — 물리 스케일은 위첨자가 표준.
 */
export function formatScale(scaleM: string | null | undefined): string {
  if (!scaleM || scaleM === '0') return '—';
  const lt = scaleM.trim().startsWith('<');
  const num = lt ? scaleM.trim().slice(1) : scaleM;
  const d = D(num);
  if (d.eq(0) || Number.isNaN(d.mag)) return '—';
  return `${lt ? '<' : ''}${formatNumber(d, 2, 'scientific')} m`;
}

/**
 * 시간(초) → 사람이 읽는 문자열. 오프라인 복귀·총 플레이시간 표시(§game 230 "N시간 N분" 정신).
 *  복합 2단위(예: "2시간 34분", "5일 7시간") — 소수-단위("3.4시간")의 스텁틱함 제거. 하위 단위 0이면 생략.
 *  방어: 음수·NaN·Infinity는 0으로 클램프.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) {
    const rs = s % 60;
    return rs > 0 ? `${m}분 ${rs}초` : `${m}분`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    const rm = m % 60;
    return rm > 0 ? `${h}시간 ${rm}분` : `${h}시간`;
  }
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}일 ${rh}시간` : `${d}일`;
}
