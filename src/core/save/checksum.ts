/**
 * checksum — 세이브 무결성/변조 탐지 값. (tech-architecture.md §1.2·§1.7)
 *
 * "checksum은 변조 탐지용이지 보안용이 아니다." 클라이언트 사이드 게임에서 진짜 변조 방지는
 * 불가능. 목표는 우연한 손상 검출 + 캐주얼 편집 억제 + 클라우드 충돌 시 유효성 판정.
 * 알고리즘 선택 기준: "빠르고 결정적"이면 됨(§1.2).
 *
 * 선택: FNV-1a 32-bit. 의존성 0, 결정적, 빠름. (암호학적 안전성 불필요 — §1.2 명시.)
 * 출력은 8자리 16진 문자열.
 */

/** FNV-1a 32비트 해시. data 문자열 → 8자리 hex 체크섬. */
export function checksum(data: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    // FNV prime 16777619, 32비트 곱(>>>0로 부호없는 32비트 유지)
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** data가 주어진 체크섬과 일치하는지(편집 탐지, §1.7-1). */
export function verifyChecksum(data: string, expected: string): boolean {
  return checksum(data) === expected;
}
