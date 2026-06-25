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
  createInitialState,
  CHAIN_TIERS,
} from '../state';

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
  settings: SettingsState;
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
    settings: { ...s.settings },
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
    settings: {
      offlinePrecise: data.settings?.offlinePrecise ?? init.settings.offlinePrecise,
      notation: data.settings?.notation ?? init.settings.notation,
      colorblind: data.settings?.colorblind ?? init.settings.colorblind,
    },
  };
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
