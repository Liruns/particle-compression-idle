/**
 * migrations — 단방향 마이그레이션 체인. (tech-architecture.md §1.3)
 *
 * "핵심 규칙: 마이그레이션은 단방향 체인이다. migrate_v1_to_v2, migrate_v2_to_v3 … 식의
 *  작은 변환 함수를 순서대로 등록하고, 로드 시 save.version부터 현재 버전까지 순차 적용한다.
 *  'v1에서 v5로 한 번에' 같은 점프 변환을 만들지 않는다(조합 폭발 방지)."
 *
 * 규칙(§1.3):
 *  - 마이그레이션 함수는 한 번 작성하면 **영원히 보존**(삭제 금지).
 *  - 누락 필드는 마이그레이션이 아니라 deserialize/validate에서 기본값으로 보충.
 *    버전을 올리는 건 **구조 변경·의미 변경**(키 이름·통화 단위·Decimal 표현 방식 변경) 때만.
 *  - Decimal 표현 변경은 반드시 새 버전 + 마이그레이션(R1).
 *
 * 1일차(F1): 현재 버전은 1. 아직 마이그레이션 함수는 없다(빈 레지스트리).
 *   봉투 포맷·version 필드·디스패치 골격을 지금 박아두는 것이 F-게이트의 핵심.
 *   v2가 생기면 migrations[1] = (raw) => v2형태 를 추가하고 CURRENT_SCHEMA_VERSION을 2로.
 */

/** 현재 스키마 버전. 봉투 envelope.version과 일치(§1.2). */
export const CURRENT_SCHEMA_VERSION = 1;

/** 마이그레이션 함수: 버전 v의 평문 객체 → 버전 v+1의 평문 객체. */
export type MigrationFn = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * 버전별 변환 등록부. 키 = from 버전. migrations[1]은 v1→v2.
 * 비어 있음(현재 최신 v1). 추가 시 절대 삭제하지 않는다.
 */
export const migrations: Record<number, MigrationFn> = {
  // 예시(미래):
  // 1: (raw) => { /* v1 → v2 구조 변경 */ return { ...raw, version: 2 }; },
};

/**
 * fromVersion부터 CURRENT_SCHEMA_VERSION까지 순차 적용(§1.3 while 루프).
 * 중간에 등록되지 않은 버전을 만나면 예외 → 상위가 .corrupt.bak 보존(§1.3 "침묵 삭제 금지").
 */
export function runMigrations(
  raw: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  let state = raw;
  let v = fromVersion;
  while (v < CURRENT_SCHEMA_VERSION) {
    const fn = migrations[v];
    if (!fn) {
      throw new Error(
        `No migration registered for schema v${v} → v${v + 1}. ` +
          `Save cannot be upgraded to v${CURRENT_SCHEMA_VERSION}.`,
      );
    }
    state = fn(state);
    v++;
  }
  return state;
}
