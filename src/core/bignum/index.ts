/**
 * bignum — F게이트 F4: break_eternity.js `Decimal` 단일 진입점.
 *
 * tech-architecture.md §2 (BigNumber 처리) 구현.
 *  - §2.1: break_eternity.js 채택 (테트레이션 10^^1e308 + 극소 10^-(10^^1e308)).
 *           재하강 누적 lifetime_C가 위로 폭발, r은 아래로 0을 향함 → 두 방향 모두 필요.
 *  - §2.2: "게임의 수치적 진실은 전부 Decimal. native number는 오버플로 위험이 0인 곳에서만."
 *           금지 패턴(게임수치에 +·*·Math.pow·parseFloat·Number 직접 사용)을 막기 위해
 *           **모든 Decimal 생성·연산은 이 모듈을 단일 진입점으로 통과**한다.
 *  - §2.4: 직렬화 경계 — toString/parse는 save 모듈이 이 모듈의 헬퍼로 처리.
 *
 * 철칙: 게임 코드는 `break_eternity.js`를 직접 import 하지 않는다. 항상 여기서 가져온다.
 *       이렇게 해야 (1) 향후 라이브러리 교체 시 한 곳만 수정, (2) 직렬화 표현 변경(R1)을
 *       이 경계에서 흡수, (3) native 연산 혼입을 린트/리뷰로 차단할 수 있다.
 */

import Decimal from 'break_eternity.js';

export { Decimal };

/** 게임수치 입력으로 허용하는 타입. native number/string은 *생성 시점에만* 허용. */
export type DecimalSource = Decimal | number | string;

// --- 자주 쓰는 상수 (재계산 비용 0, 매 틱 new Decimal 방지) ---
export const ZERO: Decimal = new Decimal(0);
export const ONE: Decimal = new Decimal(1);
export const TWO: Decimal = new Decimal(2);
export const TEN: Decimal = new Decimal(10);

/**
 * Decimal 생성 단일 진입점. 게임 로직은 `new Decimal()` 대신 `D()`를 쓴다.
 * (생성 지점을 한 함수로 모아 grep·교체·계측을 쉽게 한다.)
 */
export function D(value: DecimalSource = 0): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

// --- 산술 래퍼 (§2.2 금지 패턴 회피용 명시 API) -------------------------------
// native +,*,Math.pow 대신 이 함수들을 사용. 모두 Decimal을 반환한다.

export const add = (a: DecimalSource, b: DecimalSource): Decimal => D(a).add(D(b));
export const sub = (a: DecimalSource, b: DecimalSource): Decimal => D(a).sub(D(b));
export const mul = (a: DecimalSource, b: DecimalSource): Decimal => D(a).mul(D(b));
export const div = (a: DecimalSource, b: DecimalSource): Decimal => D(a).div(D(b));
export const pow = (base: DecimalSource, exp: DecimalSource): Decimal => D(base).pow(D(exp));
/** 10^x — r 매핑·dec 변환의 핵심(§2.3 "작아짐=강해짐"). */
export const pow10 = (exp: DecimalSource): Decimal => Decimal.pow(10, D(exp));
export const log10 = (a: DecimalSource): Decimal => D(a).log10();
export const max = (a: DecimalSource, b: DecimalSource): Decimal => Decimal.max(D(a), D(b));
export const min = (a: DecimalSource, b: DecimalSource): Decimal => Decimal.min(D(a), D(b));

// --- 비교 (boolean 반환, native 비교 회피) -----------------------------------
export const gt = (a: DecimalSource, b: DecimalSource): boolean => D(a).gt(D(b));
export const gte = (a: DecimalSource, b: DecimalSource): boolean => D(a).gte(D(b));
export const lt = (a: DecimalSource, b: DecimalSource): boolean => D(a).lt(D(b));
export const lte = (a: DecimalSource, b: DecimalSource): boolean => D(a).lte(D(b));
export const eq = (a: DecimalSource, b: DecimalSource): boolean => D(a).eq(D(b));

// --- 직렬화 경계 헬퍼 (§2.4 / §1.4) ------------------------------------------
// Decimal은 JSON 직렬화가 안 되므로 저장 시 문자열, 로드 시 재파싱.
// save 모듈이 이 두 함수를 직렬화 경계에서 일괄 사용한다.

/** 저장용 문자열로 변환. break_eternity의 toString 포맷을 그대로 사용. */
export const toStore = (d: Decimal): string => d.toString();

/** 저장 문자열에서 Decimal 복원. 손상 값은 ZERO로 방어(§1.3 validate 정신). */
export function fromStore(s: string | null | undefined): Decimal {
  if (s == null || s === '') return D(0);
  try {
    const d = new Decimal(s);
    // break_eternity는 NaN을 가질 수 있다 — 게임수치에 NaN 혼입 차단.
    return Number.isNaN(d.mag) ? D(0) : d;
  } catch {
    return D(0);
  }
}
