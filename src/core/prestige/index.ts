/**
 * prestige — 상전이·QF·빅 크런치·재하강. (economy.md §1·§7.4, systems.md §5, system-flows.md §3·§4)
 *
 * M1.5 범위(첫 상전이 PT1, dec19 프리온 진입):
 *  - **상전이 가능 판정**: dec가 미지 서브층 벽(WALLS) 도달 시 phase_transition_available
 *    (알려진 물리 5층 = 무상전이, 트리거는 미지 벽만 — system-flows §3.1·§3.3).
 *  - **QF 획득**: `QF_total = floor(K·(lifetime_C/D_norm)^0.5)`, `QF_gain = QF_total − QF_claimed`
 *    (economy §1.1, K=1·D_norm=1e26·e=0.5. 빅 크런치만 K=1.05 — economy §7.4, M3).
 *  - **상전이 실행(리셋)**: systems §5-2 리셋 매트릭스 — E·C·체인 보유수 리셋 /
 *    lifetime_C·QF·도감·연구·D_lifetime 보존(AdCap식). production_mult 부스트는 QF→productionMult.
 *  - 첫 상전이 시 프리온층(L6) 진입(미지 영역 첫 진입).
 *
 * 순수 함수 + 상태 비포함(파생). 상태 갱신·이벤트 발행·층 진입은 game.ts가 와이어링(§4.1 단방향).
 *   → 이래야 결정성(system-flows §12.1)과 테스트(QF·리셋 정합)가 쉽다.
 *
 * M3 완료: 빅 크런치(PT7, dec26, K=1.05)·재하강 D_current 보존 회차 곡선 구현
 *   (BIG_CRUNCH_K·D_PRESERVATION_CURVE·isBigCrunchAvailable·previewBigCrunch·applyBigCrunchReset).
 * 남은 것(M4): 집중 서브층 로테이션(GDD §9 회차 집중 서브층).
 */

import { Decimal, D, ZERO, type DecimalSource } from '../bignum';
import { WALLS } from '../../data/constants';
import {
  LAYERS,
  layerByIndex,
  layerByPrestigeIndex,
  type LayerDefinition,
} from '../layers';

// --- QF 수식 상수 (economy §1.1 — 임의 변경 금지, 문제 발견 시 economy-designer 보고) ------

/** 베켄슈타인 계수 K. PT1~PT6 = 1.0(일반 상전이). 빅 크런치(PT7)만 1.05(economy §7.4, M3). */
export const QF_K = 1;
/** 정규화 상수 D_norm = 1e26 (economy §1.1). lifetime_C를 QF 스케일로 정규화. */
export const QF_D_NORM = '1e26';
/** 지수 e = 0.5 (제곱근, economy §1.1·§1.4 — 세제곱근은 엔드게임 단일런 과도). */
export const QF_EXPONENT = 0.5;

/**
 * 상전이 결과(미리보기 = 실행 = 동일 계산). game.ts가 실행 전 미리보기로도, 실행으로도 쓴다.
 */
export interface PrestigePreview {
  /** 이번 상전이가 도달한 미지 서브층 prestigeIndex(1=프리온 … 6=플랑크). */
  prestigeIndex: number;
  /** 진입할 미지 서브층 정의(프리온 등). */
  targetLayer: LayerDefinition;
  /** QF 누적 총량 = floor(K·(lifetime_C/D_norm)^0.5). */
  qfTotal: Decimal;
  /** 이번에 새로 받는 QF = qfTotal − qfClaimed (음수 방지 클램프). */
  qfGain: Decimal;
}

/**
 * QF 누적 총량: `QF_total = floor(K·(lifetime_C/D_norm)^0.5)`. (economy §1.1)
 *   lifetime_C는 모든 런 누적 압축 깊이(AdCap식 — 재하강에도 보존). break_eternity pow/floor 정밀.
 *   K는 PT1~PT6=1.0(기본). 빅 크런치(PT7)는 호출 측이 1.05 전달(economy §7.4).
 *
 * @param lifetimeC 누적 압축 깊이(Decimal).
 * @param k         베켄슈타인 계수(기본 QF_K=1; 빅 크런치만 1.05).
 * @returns QF 누적 총량(정수 Decimal). lifetimeC ≤ 0 이면 0.
 */
export function qfTotal(lifetimeC: DecimalSource, k: DecimalSource = QF_K): Decimal {
  const lc = D(lifetimeC);
  if (lc.lte(0)) return ZERO;
  // (lifetime_C / D_norm)^0.5  →  ×K  →  floor.  전부 Decimal(native 금지 §2.2).
  const ratio = lc.div(QF_D_NORM);
  const root = ratio.pow(QF_EXPONENT);
  return D(k).mul(root).floor();
}

/**
 * 이번 상전이로 새로 받는 QF: `QF_gain = QF_total − QF_claimed`. (economy §1.1)
 *   이미 청구한 양(qfClaimed)을 차감 → 같은 lifetime_C에서 두 번 청구해도 합계가 QF_total로 수렴.
 *   음수 방지(qfClaimed가 더 큰 비정상 상태 → 0 클램프, system-flows §4.3 "QF_gain==0 허용").
 */
export function qfGain(
  lifetimeC: DecimalSource,
  qfClaimed: DecimalSource,
  k: DecimalSource = QF_K,
): Decimal {
  const total = qfTotal(lifetimeC, k);
  const gain = total.sub(D(qfClaimed));
  return gain.lt(0) ? ZERO : gain;
}

// --- 벽·상전이 가능 판정 (system-flows §3.1·§3.3) -----------------------------

/**
 * dec가 도달한 가장 깊은 미지 서브층 벽의 prestigeIndex(1..6). 도달 전이면 0.
 *   WALLS = [19, 21.5, 23, 24.5, 25.5, 26] (economy §1.2, data/constants).
 *   - dec < 19 → 0 (알려진 물리 구간 — 상전이 없음).
 *   - dec ≥ 19 → 1 (프리온, 첫 벽). … dec ≥ 26 → 6 (플랑크, 빅 크런치 트리거).
 *   `>=` 비교(strictly above) — Decimal 정밀도 스킵 방지(system-flows §3.5).
 *
 * @param dec 현재 dec(파생 스칼라).
 * @returns 도달한 최대 벽의 prestigeIndex(0=미도달, 1..6).
 */
export function wallReachedIndex(dec: number): number {
  let reached = 0;
  for (let i = 0; i < WALLS.length; i++) {
    if (dec >= WALLS[i]) reached = i + 1;
  }
  return reached;
}

/**
 * **다음에 실행할 상전이의 prestigeIndex**: 현재 도달 벽 vs 이미 완료한 상전이 수.
 *   - reached = wallReachedIndex(dec).  pending = reached − prestigeCount.
 *   - pending ≥ 1 이면 "상전이 가능"(다음 상전이 = prestigeCount + 1).
 *   - pending ≤ 0 이면 0(아직 새 벽 미도달 — 더 압축 필요).
 *
 * 이 분리가 핵심: 한 런에서 dec가 여러 벽을 넘어도(오프라인 점프) **한 번에 1 상전이씩** 진행한다
 *   (system-flows §3.5 "미지 서브층은 첫 번째 벽에서 멈추고 상전이 대기"). 플레이어가 상전이를
 *   실행할 때마다 prestigeCount가 1 오르고, 다음 벽이 이미 넘어 있으면 즉시 또 가능.
 *
 * @param dec           현재 dec.
 * @param prestigeCount 지금까지 완료한 상전이 수(state.prestige.count).
 * @returns 다음 상전이 prestigeIndex(0=불가, 1..6).
 */
export function nextPrestigeIndex(dec: number, prestigeCount: number): number {
  const reached = wallReachedIndex(dec);
  if (reached <= prestigeCount) return 0;
  // 다음 상전이 = prestigeCount + 1 (한 번에 한 단계). reached가 더 크면 다음 실행에서 또 가능.
  return prestigeCount + 1;
}

/**
 * 상전이 가능 여부(UI 탭 점등 게이트). nextPrestigeIndex ≥ 1 이면 true.
 *   미지 6벽 도달 시만 점등(알려진 물리 비점등 — ui-flow §1-C, GDD §15).
 */
export function isPrestigeAvailable(dec: number, prestigeCount: number): boolean {
  return nextPrestigeIndex(dec, prestigeCount) >= 1;
}

// --- 빅 크런치 (PT7) + 재하강 (economy §1.2·§4.4·§7.3·§7.4) --------------------

/** 빅 크런치 QF 계수(economy §7.4 — 베켄슈타인 S=A/4). 일반 상전이(PT1~6)=1.0, 빅 크런치만 1.05. */
export const BIG_CRUNCH_K = 1.05;

/**
 * D_current 재하강 보존 회차 곡선(economy §7.3). index = **새 runIndex**(빅 크런치 후 값).
 *   runIndex 0 = 첫 캠페인(회차 1, 빅 크런치로 진입 안 함 → index 0은 미사용 자리). 첫 빅 크런치 → runIndex 1 → 0.65.
 *   [_, 0.65, 0.50, 0.40, 0.40, 0.38, 0.35], 범위 밖(7회차+)은 마지막 0.35 유지.
 *   ★ economy §7.3: D 보존율은 "연구 재구매 캘린더"에만 영향, race/배율엔 미미(인덱싱 저위험).
 */
export const D_PRESERVATION_CURVE: readonly number[] = [1, 0.65, 0.5, 0.4, 0.4, 0.38, 0.35];

/** 새 runIndex에서의 D_current 보존율(범위 밖은 마지막 값 클램프). */
export function dPreservation(newRunIndex: number): number {
  if (newRunIndex <= 0) return 1;
  const last = D_PRESERVATION_CURVE.length - 1;
  return D_PRESERVATION_CURVE[newRunIndex > last ? last : newRunIndex];
}

/**
 * 빅 크런치(PT7) 실행 가능 여부. **6벽을 모두 넘어(플랑크 진입, count≥6) + 플랑크에서 dec26 재도달**.
 *   PT6(플랑크 진입) 후 C가 리셋(dec=0)되고, 플랑크 층에서 다시 dec26까지 압축하면 빅 크런치.
 *   (economy §1.2 표: PT6=플랑크 진입, PT7=플랑크 도달 시 빅 크런치.)
 */
export function isBigCrunchAvailable(dec: number, prestigeCount: number): boolean {
  return prestigeCount >= WALLS.length && dec >= WALLS[WALLS.length - 1];
}

/** 빅 크런치 미리보기(K=1.05 QF). 불가면 null. */
export interface BigCrunchPreview {
  qfTotal: Decimal;
  qfGain: Decimal;
  /** 재하강 후 새 회차(runIndex+1). */
  nextRunIndex: number;
}
export function previewBigCrunch(
  dec: number,
  prestigeCount: number,
  runIndex: number,
  lifetimeC: DecimalSource,
  qfClaimed: DecimalSource,
): BigCrunchPreview | null {
  if (!isBigCrunchAvailable(dec, prestigeCount)) return null;
  return {
    qfTotal: qfTotal(lifetimeC, BIG_CRUNCH_K),
    qfGain: qfGain(lifetimeC, qfClaimed, BIG_CRUNCH_K),
    nextRunIndex: runIndex + 1,
  };
}

/** 빅 크런치 리셋 결과(재하강). game.ts가 이 값으로 state 교체 + 메커니즘 리셋. **순수**. */
export interface BigCrunchResetResult {
  E: Decimal;
  C: Decimal;
  bought: number[];
  produced: Decimal[];
  /** 확정 qfClaimed(= K=1.05 qfTotal). */
  qfClaimed: Decimal;
  /** 새 QF(= 이전 + gain). */
  QF: Decimal;
  /** 재하강 후 층 = 분자층(1) — dec0 재시작. */
  layerIndex: number;
  /** 회차 내 벽 카운터 리셋(0 — 6벽 재통과). */
  count: number;
  /** 새 빅 크런치 회차(runIndex+1). */
  runIndex: number;
  /** 보존된 D_current(= 이전 × 회차 곡선). */
  dCurrent: Decimal;
}

/**
 * 빅 크런치 리셋 매트릭스(재하강, systems §5-2 / economy §4.4·§7.3). **순수**.
 *   리셋: E·C·체인·**층(→분자)**·**count(→0, 벽 재통과)**.
 *   보존/누적: lifetime_C·QF(가산)·도감·연구·D_lifetime(game.ts) + **D_current × dPreservation(새 회차)**.
 *   증가: runIndex+1. qfClaimed = K=1.05 qfTotal 확정.
 */
export function applyBigCrunchReset(
  preview: BigCrunchPreview,
  currentQF: DecimalSource,
  currentDCurrent: DecimalSource,
  runIndex: number,
  seedBought: () => number[],
): BigCrunchResetResult {
  const newRunIndex = runIndex + 1;
  return {
    E: ZERO,
    C: ZERO,
    bought: seedBought(),
    produced: new Array<Decimal>(seedBought().length).fill(ZERO),
    qfClaimed: preview.qfTotal,
    QF: D(currentQF).add(preview.qfGain),
    layerIndex: 1, // 분자층 — dec0 재시작
    count: 0, // 회차 내 벽 카운터 리셋(6벽 재통과)
    runIndex: newRunIndex,
    dCurrent: D(currentDCurrent).mul(dPreservation(newRunIndex)),
  };
}

// --- 상전이 미리보기·실행 (system-flows §4.1) ---------------------------------

/**
 * 다음 상전이 미리보기: 진입 층·QF 획득량을 계산(리셋 없음 — 표시·확인용).
 *   game.ts가 상전이 화면(QF 예정량)과 실행에서 공용으로 쓴다.
 *
 * @returns PrestigePreview, 또는 상전이 불가(미도달)면 null.
 */
export function previewPrestige(
  dec: number,
  prestigeCount: number,
  lifetimeC: DecimalSource,
  qfClaimed: DecimalSource,
): PrestigePreview | null {
  const pIndex = nextPrestigeIndex(dec, prestigeCount);
  if (pIndex < 1) return null;
  const targetLayer = layerByPrestigeIndex(pIndex);
  if (!targetLayer) return null;

  // K = 1 (PT1~PT6). 빅 크런치(PT7)는 M3에서 K=1.05 분기.
  const total = qfTotal(lifetimeC, QF_K);
  const gain = qfGain(lifetimeC, qfClaimed, QF_K);

  return { prestigeIndex: pIndex, targetLayer, qfTotal: total, qfGain: gain };
}

/**
 * 상전이 리셋 결과(리셋 매트릭스 적용 후의 새 값). game.ts가 이 값으로 state를 교체한다.
 *   순수 — 입력 상태를 변경하지 않고 "리셋된 새 자원·체인·prestige 값"을 돌려준다(테스트 용이).
 */
export interface PrestigeResetResult {
  /** 리셋 후 E(=0). */
  E: Decimal;
  /** 리셋 후 C(=0). */
  C: Decimal;
  /** 리셋 후 체인 bought(시드 — T1 1개). */
  bought: number[];
  /** 리셋 후 체인 produced(전부 0). */
  produced: Decimal[];
  /** 확정된 QF_claimed(= QF_total). */
  qfClaimed: Decimal;
  /** 새 QF 보유량(= 이전 QF + qfGain). */
  QF: Decimal;
  /** 진입할 미지 서브층 index(1..11 — 프리온=6). */
  layerIndex: number;
  /** 새 상전이 횟수(prestigeCount + 1). */
  count: number;
}

/**
 * 상전이 리셋 매트릭스 적용(systems §5-2 / system-flows §4.1 단계 3~5). **순수**.
 *
 * 리셋(매 상전이): E · C · 8단 체인 보유수(bought·produced).
 * 보존(영구 누적): lifetime_C · QF · 도감 · 연구 · D_lifetime.
 *   - D_current는 M1.5(첫 상전이, run_index 1) 기준 0 리셋(첫 런 보존율 없음, system-flows §4.1).
 *     회차 곡선 보존(2회차 65% 등)은 빅 크런치 재하강(M3)에서.
 *   - QF_claimed = QF_total로 확정 → production_mult 부스트 영구 적용(= 1 + 0.25·log₁₀(1+QF)).
 *
 * @param preview      previewPrestige 결과(진입 층·QF).
 * @param currentQF    현재 QF 보유량(= 이전 qfClaimed와 동일해야 정상).
 * @param prestigeCount 현재 상전이 횟수.
 * @param seedBought   새 런 시드 bought 배열 생성기(state.seedBought — T1 1개).
 * @returns 리셋 후 새 값(game.ts가 state에 반영). lifetime_C·도감·연구·D_lifetime은 game.ts가 보존(여기서 안 건드림).
 */
export function applyPrestigeReset(
  preview: PrestigePreview,
  currentQF: DecimalSource,
  prestigeCount: number,
  seedBought: () => number[],
): PrestigeResetResult {
  return {
    E: ZERO,
    C: ZERO,
    bought: seedBought(),
    produced: new Array<Decimal>(seedBought().length).fill(ZERO),
    qfClaimed: preview.qfTotal,
    // 새 QF = 이전 QF + 이번 획득분. (qfTotal로 직접 두지 않고 가산 — currentQF==이전claimed라 동일하나
    //  방어적으로 gain 가산: 비정상 상태에서도 QF가 줄지 않게.)
    QF: D(currentQF).add(preview.qfGain),
    layerIndex: preview.targetLayer.index,
    count: prestigeCount + 1,
  };
}

// 재노출(편의).
export { WALLS };
export type { LayerDefinition };
export const UNKNOWN_LAYER_COUNT = LAYERS.filter((l) => l.kind === 'unknown').length;
export { layerByIndex };
