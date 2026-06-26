/**
 * render/color — CSS 토큰 색 읽기 캐시 + hex↔rgba + mix 헬퍼.
 *  (m2-render-plan §1.2·V2-7) — 캔버스는 `var(--x)`를 직접 못 쓴다. tokens.css가 단일 진실이므로
 *  getComputedStyle로 1회 읽어 캐시하고, `onLayerChange` 시에만 갱신한다(매 프레임 아님).
 *  색맹 모드([data-colorblind])·런타임 토큰 변경이 캐시 재읽기로 자동 반영(DESIGN §625 의도).
 *
 *  읽기 전용: 색만 다룬다. 게임 상태와 무관.
 */

/** 0~255 정수로 클램프. */
function clampByte(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : Math.round(n);
}

/** 0~1로 클램프. */
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * `#rgb`/`#rrggbb` → {r,g,b}. 파싱 실패 시 fallback(기본 중간 회색).
 *  rgb()/rgba() 형태도 허용(getComputedStyle이 그 형태로 줄 수 있음).
 */
export function parseColor(input: string, fallback: RGB = { r: 128, g: 128, b: 128 }): RGB {
  if (!input) return fallback;
  const s = input.trim();

  // #rrggbb / #rgb
  if (s[0] === '#') {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return fallback;
      return { r, g, b };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return fallback;
      return { r, g, b };
    }
    return fallback;
  }

  // rgb(...) / rgba(...)
  if (s.startsWith('rgb')) {
    const nums = s.match(/[\d.]+/g);
    if (nums && nums.length >= 3) {
      return { r: clampByte(+nums[0]), g: clampByte(+nums[1]), b: clampByte(+nums[2]) };
    }
  }

  return fallback;
}

/** {r,g,b} + alpha → `rgba(r,g,b,a)` 문자열. */
export function rgba(c: RGB, alpha: number): string {
  return `rgba(${c.r},${c.g},${c.b},${clamp01(alpha)})`;
}

/** 두 색 선형 보간 t∈[0,1]: 0=a, 1=b. (글로우 코어에 층 악센트 블렌딩 §3-A.) */
export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = clamp01(t);
  return {
    r: clampByte(a.r + (b.r - a.r) * k),
    g: clampByte(a.g + (b.g - a.g) * k),
    b: clampByte(a.b + (b.b - a.b) * k),
  };
}

/**
 * 채도를 회색 방향으로 낮춘다(amount=0 원색, 1 완전 회색). 차가운 단색층 글로우(V2-2):
 *  심자주를 회색 방향으로 빼 네온감을 죽인다(art §1-A 거부 룩 차단).
 */
export function desaturate(c: RGB, amount: number): RGB {
  const k = clamp01(amount);
  // 지각 휘도 기반 그레이(Rec.601).
  const gray = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return {
    r: clampByte(c.r + (gray - c.r) * k),
    g: clampByte(c.g + (gray - c.g) * k),
    b: clampByte(c.b + (gray - c.b) * k),
  };
}

/**
 * CSS 토큰 색 캐시. onLayerChange 시 read()로 갱신, draw 중엔 get()으로 조회(getComputedStyle 비호출).
 *  rootEl 기본 = document.documentElement(:root 토큰). 테스트/SSR 가드: window 없으면 빈 캐시.
 */
export class ColorCache {
  private readonly rootEl: HTMLElement | null;
  private cache = new Map<string, RGB>();
  private rawCache = new Map<string, string>();

  constructor(rootEl?: HTMLElement | null) {
    this.rootEl =
      rootEl ?? (typeof document !== 'undefined' ? document.documentElement : null);
  }

  /**
   * 토큰 키 목록을 getComputedStyle로 읽어 캐시. onLayerChange/색맹 변경 시 호출.
   *  data-layer 변경 후 호출하면 현재 층 토큰(--layer-accent 등)이 새 값으로 잡힌다.
   */
  read(tokenKeys: string[]): void {
    this.cache.clear();
    this.rawCache.clear();
    if (!this.rootEl || typeof getComputedStyle === 'undefined') return;
    const cs = getComputedStyle(this.rootEl);
    for (const key of tokenKeys) {
      const raw = cs.getPropertyValue(key).trim();
      this.rawCache.set(key, raw);
      this.cache.set(key, parseColor(raw));
    }
  }

  /** 캐시된 토큰 색(없으면 fallback). draw 중 호출 — getComputedStyle 안 함. */
  get(tokenKey: string, fallback: RGB = { r: 62, g: 207, b: 142 }): RGB {
    return this.cache.get(tokenKey) ?? fallback;
  }

  /** 캐시된 원시 문자열(디버그·일부 직접 사용). */
  getRaw(tokenKey: string): string {
    return this.rawCache.get(tokenKey) ?? '';
  }
}
