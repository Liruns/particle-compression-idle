/**
 * codex — 입자 도감: 발견 판정·완성도. (codex.md §13·§0, systems.md §2-I, economy.md §7.1)
 *
 * 발견된 ID 집합으로 저장(§1.1 "집합은 ID 배열로", 스파스). 발견은 영구 보존(상전이/재하강 불변).
 *
 * M1.3 범위:
 *  - 발견 판정: **dec 게이트**(particle.unlockDec). 메커니즘 의존 조건(공명 N회 등)은 M1.4+ 재구현.
 *  - LEGENDARY 완성 보너스 엔트리: 해당 층의 **discoverable 입자 전부 발견 시** 자동 해금(codex §0).
 *  - 완성도 = 발견 discoverable 수 / 76(LEGENDARY 11 제외 분모, economy §7.1). M1.3은 57만 활성.
 *
 * 홀로그래픽 배율(곡선 B, += completion²·0.35, 상한 ×1.35)은 economy §7.2.3 — **L10 정보층에서만
 *   생산에 적용**. M1.3은 완성도 *표시*만(생산 적용 X). 상한값 임의 변경 금지(economy §7.2).
 *
 * 순수 함수 + 상태 비포함. 발견 집합(Set)은 game.ts/state가 보유, 이벤트 발행도 game.ts.
 */

import { PARTICLES, particlesByLayer, type Particle } from '../../data/particles';
import { KNOWN_LAYERS } from '../../data/layers';

/**
 * 홀로그래픽 완성도 분모(economy §7.1 확정 = 76 = 전체 87 − LEGENDARY 11).
 * UI 전체 표시(87)와 분리. M1.3은 알려진 물리 57만 활성이나 분모는 최종 76 고정(곡선 일관).
 */
export const CODEX_DENOMINATOR = 76;

/** 도감 완성도 보너스 상한(economy §7.1, ×1.35 = dec26 −25.9%). 임의 변경 금지. */
export const CODEX_BONUS_FACTOR = 0.35;

/**
 * dec 기준 발견 평가. 이미 발견한 집합을 받아 **새로 발견되는 ID**만 반환.
 *  1. discoverable 입자: dec ≥ unlockDec 이면 발견.
 *  2. LEGENDARY(완성 보너스): 해당 층의 discoverable 입자 전부 발견 시 해금
 *     (+ dec ≥ unlockDec — 층 완성 시점 보장). codex §0 "층 도감 100% → 1회성 해금".
 *
 * @param dec 현재 dec.
 * @param discovered 이미 발견된 ID 집합(읽기 전용).
 * @returns 이번에 새로 발견된 입자 ID 배열(unlockDec 오름차순).
 */
export function evaluateDiscoveries(dec: number, discovered: ReadonlySet<string>): string[] {
  const newly: string[] = [];

  // 1단계: discoverable 입자 dec 게이트.
  for (const p of PARTICLES) {
    if (!p.discoverable) continue;
    if (discovered.has(p.id) || newly.includes(p.id)) continue;
    if (dec >= p.unlockDec) newly.push(p.id);
  }

  // 2단계: LEGENDARY 완성 보너스 — 층의 discoverable 전부 발견 시.
  //   (1단계 결과를 합쳐 같은 틱 층 완성도 즉시 반영.)
  const after = new Set<string>(discovered);
  for (const id of newly) after.add(id);
  for (const p of PARTICLES) {
    if (p.discoverable) continue; // LEGENDARY만
    if (after.has(p.id)) continue;
    if (dec < p.unlockDec) continue;
    if (isLayerDiscoverableComplete(p.layer, after)) newly.push(p.id);
  }

  return newly.sort((a, b) => particleUnlockDec(a) - particleUnlockDec(b));
}

/** 특정 층의 **discoverable 입자**가 전부 발견됐는지(LEGENDARY 제외). */
export function isLayerDiscoverableComplete(layerIndex: number, discovered: ReadonlySet<string>): boolean {
  const list = particlesByLayer(layerIndex).filter((p) => p.discoverable);
  if (list.length === 0) return false;
  return list.every((p) => discovered.has(p.id));
}

/** 층 완성도: { collected, total } — discoverable + LEGENDARY 모두 포함(UI 층별 n/전체 표시). */
export interface LayerCompletion {
  layerIndex: number;
  /** 발견 수(이 층, LEGENDARY 포함). */
  collected: number;
  /** 이 층 전체 입자 수(LEGENDARY 포함). */
  total: number;
}

/** 한 층의 완성 현황(UI 층별 진행도). */
export function layerCompletion(layerIndex: number, discovered: ReadonlySet<string>): LayerCompletion {
  const list = particlesByLayer(layerIndex);
  const collected = list.reduce((n, p) => n + (discovered.has(p.id) ? 1 : 0), 0);
  return { layerIndex, collected, total: list.length };
}

/** 전체 알려진 물리 층(L1~L5) 완성 현황 목록. */
export function knownLayerCompletions(discovered: ReadonlySet<string>): LayerCompletion[] {
  return KNOWN_LAYERS.map((l) => layerCompletion(l.index, discovered));
}

/**
 * 홀로그래픽 완성도(0~1) = 발견 discoverable 수 / 76(economy §7.1).
 * M1.3은 57만 활성이라 최대 ~0.70(53/76). 정보층(M1.6+) 이후 생산 적용.
 */
export function codexCompletion(discovered: ReadonlySet<string>): number {
  let collected = 0;
  for (const p of PARTICLES) {
    if (p.discoverable && discovered.has(p.id)) collected++;
  }
  return Math.min(1, collected / CODEX_DENOMINATOR);
}

/**
 * 도감 완성도 배율(곡선 B, economy §7.1): 1 + min(0.35·c², 0.35).
 * ★ M1.3은 **표시 전용**(생산에 적용 X — 정보층 L10에서만 활성, economy §7.2.3).
 *   상한 ×1.35 유지. 임의로 올리면 dec26 race 가드레일(<30%) 붕괴(economy §7.2).
 */
export function holographicMultiplier(discovered: ReadonlySet<string>): number {
  const c = codexCompletion(discovered);
  return 1 + Math.min(CODEX_BONUS_FACTOR * c * c, CODEX_BONUS_FACTOR);
}

/** 발견 discoverable 총수(UI 수집 n/76 표시용). */
export function discoverableCollected(discovered: ReadonlySet<string>): number {
  let n = 0;
  for (const p of PARTICLES) if (p.discoverable && discovered.has(p.id)) n++;
  return n;
}

/** id → unlockDec (정렬 헬퍼). */
function particleUnlockDec(id: string): number {
  const p = PARTICLES.find((x) => x.id === id);
  return p ? p.unlockDec : 0;
}

export type { Particle };
export { PARTICLES, particlesByLayer };
