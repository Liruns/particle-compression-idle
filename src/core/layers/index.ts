/**
 * layers — 층 진입 판정·서브층 벽. (systems.md §1, data-spec §4, GDD §9)
 *
 * 11층(분자→플랑크) 중 알려진 물리 5층(분자/원자/핵/핵자/쿼크)은 **무상전이 층 진입**,
 * 미지 6 서브층은 상전이 벽(WALLS, data/constants)으로 진입. "층 진입 ≠ 상전이"가 핵심 학습.
 *
 * M1.3 범위: 알려진 물리 5층의 **dec→층 매핑 + 진입 판정**(무상전이). 미지 서브층 진입(상전이)은
 *   M1.5+. 데이터는 data/layers.ts(LAYERS). 메커니즘 모듈 동적 로드는 M1.4+.
 *
 * 순수 함수 + 상태 비포함(파생). 이벤트 발행·상태 갱신은 game.ts가 와이어링(§4.1 단방향).
 */

import { LAYERS, KNOWN_LAYERS, layerByIndex, type LayerDefinition } from '../../data/layers';

export type { LayerDefinition };
export { LAYERS, KNOWN_LAYERS, layerByIndex };

/**
 * 미지 서브층 prestigeIndex(1..6) → 층 정의. (prestige 진입 층 조회용 — M1.5)
 *   prestigeIndex 1=프리온(L6) … 6=플랑크(L11). 알려진 물리(prestigeIndex=null)는 제외.
 */
export function layerByPrestigeIndex(prestigeIndex: number): LayerDefinition | undefined {
  return LAYERS.find((l) => l.prestigeIndex === prestigeIndex);
}

/**
 * 현재 dec에서의 알려진 물리 층 index(1..5).
 *  - dec < 1 → L1(분자).  dec ≥ enterDec인 가장 깊은 알려진 물리 층.
 *  - 알려진 물리 캡: dec9(쿼크) 이상이어도 L5에 머문다(미지 진입 = 상전이, M1.5+).
 *
 * @returns 층 index(1..5). dec가 음수/0이면 1.
 */
export function currentLayerIndex(dec: number): number {
  let idx = 1;
  for (const layer of KNOWN_LAYERS) {
    if (dec >= layer.enterDec) idx = layer.index;
  }
  return idx;
}

/** 현재 dec에서의 알려진 물리 층 정의(1..5). */
export function currentLayer(dec: number): LayerDefinition {
  // KNOWN_LAYERS[0]은 항상 분자층(L1) — 폴백 보장.
  return layerByIndex(currentLayerIndex(dec)) ?? KNOWN_LAYERS[0];
}

/**
 * 층 전환 판정: 이전 층 index → 현재 dec 기준 층 index.
 *  - 새로 진입한 층들(이전보다 깊어진 구간)을 순서대로 반환 → 한 틱에 여러 층을 건너뛰어도
 *    각 층 진입 이벤트/비트를 빠짐없이 발행할 수 있다(오프라인 점프 대비).
 *
 * @param prevIndex 직전 층 index(1..5). 최초엔 1.
 * @param dec 현재 dec.
 * @returns 새로 진입한 층 index 배열(오름차순). 변화 없으면 빈 배열. (역행은 무시 — 알려진 물리는 리셋 없음.)
 */
export function layersEnteredSince(prevIndex: number, dec: number): number[] {
  const target = currentLayerIndex(dec);
  if (target <= prevIndex) return [];
  const entered: number[] = [];
  for (let i = prevIndex + 1; i <= target; i++) entered.push(i);
  return entered;
}

/** 알려진 물리 최종 층 index(쿼크=5). 이 이상은 미지(상전이, M1.5+). */
export const LAST_KNOWN_LAYER_INDEX = KNOWN_LAYERS[KNOWN_LAYERS.length - 1].index;

/** dec가 알려진 물리 경계 근접(dec15+, ux.md §5-6 "알려진 입자 경계 근접" 신호) 여부. */
export function isNearKnownBoundary(dec: number): boolean {
  return dec >= 15;
}
