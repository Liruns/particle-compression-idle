/**
 * render/haze — L1 배경 헤이즈(오프스크린 value-noise 타일 드리프트, m2-render-plan §4·V2-7).
 *  부팅 시 1회 토로이달(wrap) value-noise 타일을 사전계산(절차적 매 프레임 금지). 매 프레임은
 *  drawImage 타일링 + 고정 저속 드리프트만(백버퍼 재생성 없음 → 프레임당 추가 힙 할당 0).
 *
 *  토로이달 wrap + 최소 2옥타브로 이음매·격자 비침을 막는다(V2-7). 드리프트는 rateC 비례 금지(고정).
 *  헤이즈 타일은 dpr 비의존(저주파라 흐려도 무방, V2-7 M6) — CSS px 기준으로 그린다.
 */
import type { HazeConfig } from './layer-visuals';
import { type RGB } from './color';

const TILE_SIZE = 256; // 타일 한 변(px). 화면에 wrap 타일링.

/** 결정적 의사난수(시드 기반 — value-noise 격자값). 외부 의존 없음. */
function hash2(ix: number, iy: number, seed: number): number {
  let h = ix * 374761393 + iy * 668265263 + seed * 1442695040888963407;
  h = (h ^ (h >> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  return (h >>> 0) / 4294967295; // 0~1
}

/** 5차 smoothstep(Perlin fade). 보간 경계 매끄럽게. */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 토로이달 value-noise 1옥타브. 격자 주기 = period(셀 수). 좌표를 period로 모듈러 → 타일 끝과 시작이
 *  같은 격자값을 공유(wrap). x,y는 0~TILE_SIZE.
 */
function valueNoiseOctave(x: number, y: number, period: number, seed: number): number {
  const fx = (x / TILE_SIZE) * period;
  const fy = (y / TILE_SIZE) * period;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fade(fx - x0);
  const ty = fade(fy - y0);
  // period로 wrap → 타일 경계 연속.
  const x0m = ((x0 % period) + period) % period;
  const y0m = ((y0 % period) + period) % period;
  const x1m = (x0m + 1) % period;
  const y1m = (y0m + 1) % period;
  const v00 = hash2(x0m, y0m, seed);
  const v10 = hash2(x1m, y0m, seed);
  const v01 = hash2(x0m, y1m, seed);
  const v11 = hash2(x1m, y1m, seed);
  // 이중선형 보간(x축 두 번 → y축 한 번).
  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
}

/**
 * Haze — 단일 헤이즈 레이어. ensureTile()로 config별 타일 1회 생성, draw()로 매 프레임 타일링.
 *  config가 바뀌면(onLayerChange) setConfig로 타일 무효화 → 다음 draw에서 재생성.
 */
export class Haze {
  private tile: HTMLCanvasElement | OffscreenCanvas | null = null;
  private config: HazeConfig | null = null;
  private color: RGB = { r: 139, g: 195, b: 74 };
  private offsetX = 0;
  private offsetY = 0;
  private builtKey = '';

  /** 헤이즈 활성 여부(현재 층에 헤이즈 config가 있는지). */
  get active(): boolean {
    return this.config != null;
  }

  /**
   * config·색 설정. onLayerChange에서 호출. config=null이면 헤이즈 비활성(타일 유지하되 draw 스킵).
   *  색이 바뀌면 타일 재생성 키를 갱신.
   */
  setConfig(config: HazeConfig | null, color: RGB): void {
    this.config = config;
    this.color = color;
    if (config) {
      const key = `${config.colorToken}:${config.octaves}:${color.r},${color.g},${color.b}`;
      if (key !== this.builtKey) {
        this.tile = null; // 무효화 — 다음 draw에서 재빌드
        this.builtKey = key;
      }
    }
  }

  /** 오프스크린 타일 1회 생성(토로이달 + 다중옥타브 가산). 색은 alpha 채널로 명암만 — 합성은 draw에서. */
  private buildTile(): void {
    const cfg = this.config;
    if (!cfg) return;
    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
        : (() => {
            const c = document.createElement('canvas');
            c.width = TILE_SIZE;
            c.height = TILE_SIZE;
            return c;
          })();
    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return;

    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const data = img.data;
    const octaves = Math.max(2, cfg.octaves);
    // 옥타브: period 2,4,8…, 진폭 1,1/2,1/4… 정규화.
    let ampSum = 0;
    for (let o = 0; o < octaves; o++) ampSum += 1 / (1 << o);

    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        let n = 0;
        for (let o = 0; o < octaves; o++) {
          const period = 2 << o; // 2,4,8,...
          const amp = 1 / (1 << o);
          n += valueNoiseOctave(x, y, period, 1000 + o * 97) * amp;
        }
        n /= ampSum; // 0~1 정규화
        // 저주파 명암 대비를 살짝 키운다(카드 가독성 해치지 않게 완만 — V2-7).
        const v = n * n * (3 - 2 * n); // smoothstep 한 번 더 → 중간톤 압축
        const idx = (y * TILE_SIZE + x) * 4;
        data[idx] = this.color.r;
        data[idx + 1] = this.color.g;
        data[idx + 2] = this.color.b;
        data[idx + 3] = Math.round(v * 255); // 명암을 알파에 — 합성 알파는 draw에서 globalAlpha로 스케일
      }
    }
    ctx.putImageData(img, 0, 0);
    this.tile = canvas;
  }

  /**
   * 드리프트 적분(고정 저속). reduced-motion이면 드리프트 정지(offset 고정).
   *  dt는 렌더러가 클램프한 값(복귀 점프 방지).
   */
  update(dt: number, reducedMotion: boolean): void {
    if (!this.config || reducedMotion) return;
    const drift = this.config.driftPxPerSec * dt;
    // 대각선 느린 흐름. TILE_SIZE로 wrap(무한 스크롤).
    this.offsetX = (this.offsetX + drift * 0.7) % TILE_SIZE;
    this.offsetY = (this.offsetY + drift * 0.5) % TILE_SIZE;
  }

  /**
   * 화면 전체에 타일 wrap 드로우. CSS px 좌표(ctx는 dpr setTransform 적용 상태) — w,h는 CSS px.
   *  매 프레임 drawImage만(백버퍼 재생성 없음). 알파는 config.alpha[max] 사용(저주파 명암 가시화).
   */
  draw(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ): void {
    if (!this.config) return;
    if (!this.tile) this.buildTile();
    const tile = this.tile;
    if (!tile) return;

    const alpha = this.config.alpha[1]; // 최대 알파(명암은 타일 알파채널이 이미 담음)
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    // 시작 오프셋(음수 방향으로 한 타일 당겨 빈틈 없이 덮음).
    const startX = -((this.offsetX % TILE_SIZE) + TILE_SIZE);
    const startY = -((this.offsetY % TILE_SIZE) + TILE_SIZE);
    for (let ty = startY; ty < h; ty += TILE_SIZE) {
      for (let tx = startX; tx < w; tx += TILE_SIZE) {
        ctx.drawImage(tile as CanvasImageSource, tx, ty, TILE_SIZE, TILE_SIZE);
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  /** 타일 해제(dispose). */
  destroy(): void {
    this.tile = null;
    this.config = null;
  }
}
