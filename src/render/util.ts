/**
 * render/util — 렌더 공용 수학/색 유틸(공통화).
 *  board.ts / cosmic-cycle.ts / layer-worlds.ts에 중복돼 있던 헬퍼를 한 곳으로.
 *  ★동작 동일: 구현을 그대로 옮겼다(수치·라운딩·NaN 거동 불변). 표현 전용 — 로직/경제 무관.
 */

export const TAU = Math.PI * 2;

export function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function fract(x: number): number {
  return x - Math.floor(x);
}

export function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

/** 결정적 의사난수 0..1(시드 i). 프레임 무관 정적 시드용(성단·궤도체·모티프). */
export function rnd(i: number): number {
  return fract(Math.sin(i * 127.1 + 11.7) * 43758.5453);
}

/** 'r,g,b' 두 색을 t(0..1)로 선형 혼합. */
export function mixRGB(a: string, b: string, t: number): string {
  const pa = a.split(',').map(Number);
  const pb = b.split(',').map(Number);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `${r},${g},${bl}`;
}
