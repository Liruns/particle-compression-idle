/**
 * serialize — 직렬화 경계. GameState(메모리, Decimal 살아있음) ↔ SaveData(디스크, 평문 JSON).
 * (tech-architecture.md §1.4·§2.4)
 *
 * 핵심: "break_eternity Decimal은 JSON 직렬화 안 됨 → 저장 시 .toString(), 로드 시 new Decimal(str).
 *        전 스키마에 흩어진 Decimal을 일일이 처리하지 않도록 **직렬화 경계에서 일괄 변환**."
 *        이 변환 규칙을 세이브 모듈 한 곳(여기)에 캡슐화한다.
 *
 * SaveData = 봉투 안 data 페이로드의 평문 JSON 형태(모든 Decimal이 string으로 바뀐 GameState).
 * 이 모듈만이 Decimal↔string 변환 지점을 안다. 게임 로직은 항상 살아있는 Decimal만 본다.
 */

import { Decimal, toStore, fromStore, ZERO } from '../bignum';
import {
  type GameState,
  type SettingsState,
  type StatsState,
  createInitialState,
  CHAIN_TIERS,
} from '../state';
import { OrbitalResonance, PhaseOverlap, Harmonics } from '../layers/mechanics';

/**
 * 디스크 페이로드 형태. GameState와 같은 모양이되, 모든 Decimal 필드가 string.
 * (이 게임의 "현재 스키마 버전"이 표현하는 형태. 버전이 오르면 마이그레이션이 이전 형태를 흡수.)
 */
export interface SaveData {
  meta: {
    build: string;
    createdAt: number;
    lastSave: number;
    totalPlaytime: number;
  };
  resources: {
    E: string;
    C: string;
    D_current: string;
    QF: string;
    lifetime_C: string;
    D_lifetime: string;
  };
  chain: {
    bought: number[];
    /** 누적 생산분(Decimal → string[8]). 구버전 세이브엔 없을 수 있음 → validate에서 0 채움. */
    produced?: string[];
  };
  prestige: {
    count: number;
    runIndex: number;
    qfClaimed: string;
    focusSublayer: number | null;
    offlineBonusPending: boolean;
  };
  /** M1.3 추가. 구버전 세이브엔 없음 → validate에서 분자층(1) 기본. */
  layers?: {
    currentIndex: number;
  };
  /** M1.3 추가. 발견 입자 ID 배열(Set → array, §1.1 스파스). 구버전 없음 → 빈 배열. */
  codex?: {
    discovered: string[];
  };
  /** M1.7 추가. 구매 연구 노드 ID 배열(Set → array, §1.1 스파스). 구버전 없음 → 빈 배열. */
  research?: {
    purchased: string[];
  };
  /**
   * M1.4 추가. 층별 메커니즘 직렬화 상태(§1.1 R7 — 메커니즘이 .serialize()로 평문화).
   * 구버전(없음) → deserialize에서 새 인스턴스 기본값. 각 메커니즘 형태는 모듈이 책임(불투명).
   */
  mechanics?: {
    orbital?: unknown;
    /** M1.6 추가. 위상 겹침(프리온 L6) 직렬화 상태. 구버전 없음 → 새 인스턴스 기본값. */
    phase?: unknown;
    /** M1.6 추가. 진동 하모닉스(끈 L7) 직렬화 상태. 구버전 없음 → 새 인스턴스 기본값. */
    harmonics?: unknown;
  };
  settings: SettingsState;
  /** 누적 통계(옵셔널 추가 — 구버전 세이브엔 없음 → deserialize에서 0 기본). */
  stats?: Partial<StatsState>;
  /** validate가 채운 누락 필드 흔적 등 후속 확장 자리. */
  [extra: string]: unknown;
}

/** GameState → SaveData (Decimal → string, 직렬화 경계 §2.4). */
export function serializeState(s: GameState): SaveData {
  return {
    meta: { ...s.meta },
    resources: {
      E: toStore(s.resources.E),
      C: toStore(s.resources.C),
      D_current: toStore(s.resources.D_current),
      QF: toStore(s.resources.QF),
      lifetime_C: toStore(s.resources.lifetime_C),
      D_lifetime: toStore(s.resources.D_lifetime),
    },
    chain: {
      bought: [...s.chain.bought],
      produced: s.chain.produced.map((d) => toStore(d)),
    },
    prestige: {
      count: s.prestige.count,
      runIndex: s.prestige.runIndex,
      qfClaimed: toStore(s.prestige.qfClaimed),
      focusSublayer: s.prestige.focusSublayer,
      offlineBonusPending: s.prestige.offlineBonusPending,
    },
    layers: { currentIndex: s.layers.currentIndex },
    // Set → 정렬된 배열(결정적 직렬화 — 동일 상태 → 동일 봉투 → 체크섬 안정).
    codex: { discovered: [...s.codex.discovered].sort() },
    research: { purchased: [...s.research.purchased].sort() },
    // 메커니즘은 각자 .serialize()로 평문화(§1.1 R7 — save는 형태를 모름, 불투명 값 그대로).
    mechanics: {
      orbital: s.mechanics.orbital.serialize(),
      phase: s.mechanics.phase.serialize(),
      harmonics: s.mechanics.harmonics.serialize(),
    },
    settings: { ...s.settings },
    stats: { ...s.stats },
  };
}

/**
 * SaveData → GameState (string → Decimal). 마이그레이션·validate를 거친 *현재 버전* SaveData를 받는다.
 * 누락 필드는 초기값으로 방어(§1.3 "누락 필드는 validate에서 기본값으로 보충").
 */
export function deserializeState(data: SaveData): GameState {
  const init = createInitialState();
  const bought = Array.isArray(data.chain?.bought)
    ? normalizeBought(data.chain.bought)
    : init.chain.bought;
  const produced = normalizeProduced(data.chain?.produced);

  return {
    meta: {
      build: data.meta?.build ?? init.meta.build,
      createdAt: data.meta?.createdAt ?? init.meta.createdAt,
      lastSave: data.meta?.lastSave ?? init.meta.lastSave,
      totalPlaytime: data.meta?.totalPlaytime ?? 0,
    },
    resources: {
      E: fromStore(data.resources?.E),
      C: fromStore(data.resources?.C),
      D_current: fromStore(data.resources?.D_current),
      QF: fromStore(data.resources?.QF),
      lifetime_C: fromStore(data.resources?.lifetime_C),
      D_lifetime: fromStore(data.resources?.D_lifetime),
    },
    chain: { bought, produced },
    prestige: {
      count: data.prestige?.count ?? 0,
      runIndex: data.prestige?.runIndex ?? 0,
      qfClaimed: fromStore(data.prestige?.qfClaimed),
      focusSublayer: data.prestige?.focusSublayer ?? null,
      offlineBonusPending: data.prestige?.offlineBonusPending ?? false,
    },
    layers: {
      // 구버전(layers 없음) → 분자층(1). 범위 밖 값은 1로 클램프(§1.3 validate).
      currentIndex: normalizeLayerIndex(data.layers?.currentIndex),
    },
    codex: {
      // 발견 ID 배열 → Set. 문자열 아닌 값은 무시(§1.3 방어).
      discovered: normalizeDiscovered(data.codex?.discovered),
    },
    research: {
      // 구매 노드 ID 배열 → Set. 문자열 아닌 값은 무시(§1.3 방어). 구버전 없음 → 빈 집합.
      purchased: normalizeDiscovered(data.research?.purchased),
    },
    mechanics: {
      // 새 인스턴스 + 저장 상태 복원(§1.3 — deserialize가 누락/손상을 기본값으로 방어).
      orbital: restoreOrbital(data.mechanics?.orbital),
      phase: restorePhase(data.mechanics?.phase),
      harmonics: restoreHarmonics(data.mechanics?.harmonics),
    },
    settings: {
      offlinePrecise: data.settings?.offlinePrecise ?? init.settings.offlinePrecise,
      notation: data.settings?.notation ?? init.settings.notation,
      colorblind: data.settings?.colorblind ?? init.settings.colorblind,
    },
    stats: {
      // 구버전(없음)·손상 → 0. 유한 음수 아닌 정수만 채택(§1.3 방어).
      manualCompresses: safeCount(data.stats?.manualCompresses),
      totalBinds: safeCount(data.stats?.totalBinds),
      maxDec: safeNonNeg(data.stats?.maxDec),
    },
  };
}

/** 통계 카운터 정규화: 유한·음수 아님·정수(구버전/손상 → 0). */
function safeCount(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}
/** 통계 실수(maxDec) 정규화: 유한·음수 아님(구버전/손상 → 0). */
function safeNonNeg(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}
/** 체인 보유 배열을 항상 길이 CHAIN_TIERS로 정규화(구버전 길이 변화 방어). */
function normalizeBought(arr: number[]): number[] {
  const out = new Array<number>(CHAIN_TIERS).fill(0);
  for (let i = 0; i < CHAIN_TIERS; i++) {
    const v = arr[i];
    out[i] = typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }
  return out;
}

/**
 * 누적 생산분 배열을 항상 길이 CHAIN_TIERS Decimal로 정규화.
 * 구버전 세이브(produced 없음) → 전부 0(§1.3 "누락 필드는 validate에서 기본값").
 * 손상 문자열은 fromStore가 0으로 방어.
 */
function normalizeProduced(arr: string[] | undefined): Decimal[] {
  const out = new Array<Decimal>(CHAIN_TIERS).fill(ZERO);
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < CHAIN_TIERS; i++) {
    out[i] = fromStore(arr[i]);
  }
  return out;
}

/** 층 index를 1..11로 정규화(구버전/손상 방어). 알려진 물리는 1..5만 쓰나 상한은 11. */
function normalizeLayerIndex(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1;
  const i = Math.floor(v);
  if (i < 1) return 1;
  if (i > 11) return 11;
  return i;
}

/** 발견 ID 배열 → Set<string>. 문자열만 채택(중복 자동 제거, §1.3 방어). */
function normalizeDiscovered(arr: unknown): Set<string> {
  const set = new Set<string>();
  if (!Array.isArray(arr)) return set;
  for (const v of arr) {
    if (typeof v === 'string' && v.length > 0) set.add(v);
  }
  return set;
}

/**
 * 오비탈 공명 인스턴스 복원(§1.1 R7·§1.3). 새 인스턴스를 만들고 저장 상태를 주입한다.
 * 구버전(undefined)·손상 값은 메커니즘 deserialize가 기본값으로 흡수(자기완결 방어).
 */
function restoreOrbital(data: unknown): OrbitalResonance {
  const m = new OrbitalResonance();
  m.deserialize(data);
  return m;
}

/** 위상 겹침 인스턴스 복원(§1.1 R7·§1.3, M1.6). 구버전(undefined)·손상은 deserialize가 흡수. */
function restorePhase(data: unknown): PhaseOverlap {
  const m = new PhaseOverlap();
  m.deserialize(data);
  return m;
}

/** 진동 하모닉스 인스턴스 복원(§1.1 R7·§1.3, M1.6). 구버전(undefined)·손상은 deserialize가 흡수. */
function restoreHarmonics(data: unknown): Harmonics {
  const m = new Harmonics();
  m.deserialize(data);
  return m;
}
