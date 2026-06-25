/**
 * state — 중앙 단일 상태 컨테이너 + 스키마 타입. (tech-architecture.md §1.1·§4.3)
 *
 * §4.3: "중앙 단일 상태 컨테이너(AD player.js 선례). 단일 진실 소스 — 모든 모듈이
 *        같은 상태를 읽고, 변경은 명확한 경로로만."
 * §1.1: 저장 대상은 "게임의 진실 상태(source of truth)" 전부이되, **파생 캐시는 저장하지 않는다**.
 *        스키마는 도메인별 네임스페이스로 분할해 마이그레이션 단위를 작게 유지한다.
 *
 * 중요한 표현 규칙(§2.4): 이 타입의 Decimal 필드는 **메모리에선 Decimal 인스턴스**다.
 *   저장 시 save 모듈이 직렬화 경계에서 toString, 로드 시 Decimal로 복원한다.
 *   즉 GameState는 "살아있는" 형태이고, 디스크 형태(SaveData)는 save 모듈이 관리한다.
 *
 * 스캐폴딩 범위: F게이트가 돌 만큼의 핵심 네임스페이스(meta/resources/chain/prestige/settings)만
 *   채운다. layers·codex·research·stats·메커니즘 상태는 후속 마일스톤에서 확장(타입에 자리만 표시).
 */

import { Decimal, D } from '../bignum';

// --- 네임스페이스 타입 (§1.1 스키마 표) ---------------------------------------

/** meta: 스키마/빌드 버전, 타임스탬프, 플레이타임. 마이그레이션·변조 탐지 기준. */
export interface MetaState {
  /** 게임 빌드 버전(표시용). 세이브 스키마 version과 별개. */
  build: string;
  /** 생성 시각(ms). */
  createdAt: number;
  /** 마지막 저장 시각(ms). 오프라인 계산 last_save 후보(§1.7). */
  lastSave: number;
  /** 총 플레이타임(초, native number — 정확 카운팅). */
  totalPlaytime: number;
}

/**
 * resources: 핵심 자원. 모두 Decimal(§2.2 native 절대 금지).
 *  E=압축 에너지, C=압축 깊이, D_current=발견 데이터, QF=양자 거품.
 *  lifetime_C·D_lifetime은 재하강 보존 키(§1.1).
 */
export interface ResourcesState {
  E: Decimal;
  C: Decimal;
  D_current: Decimal;
  QF: Decimal;
  lifetime_C: Decimal;
  D_lifetime: Decimal;
}

/** chain: 8단 압축기 각 티어의 보유 개수(bought). 정수 카운트 = native number(§2.2). */
export interface ChainState {
  /** 길이 8(T1~T8). 비용·생산량은 파생 → 저장 안 함, 로드 시 재계산. */
  bought: number[];
}

/** prestige: 상전이·빅 크런치·재하강 상태(§1.1, §3.3 오프라인 보너스 플래그). */
export interface PrestigeState {
  /** 상전이 횟수 N_prestige. */
  count: number;
  /** 빅 크런치 회차(재하강 run index). */
  runIndex: number;
  /** 회수 대기 QF(미청구). */
  qfClaimed: Decimal;
  /** 현재 집중 서브층 선택(재하강 차별화, systems §2-K). null=미선택. */
  focusSublayer: number | null;
  /** §3.3 오프라인 보너스 1회성 플래그: 마지막 상전이 후 아직 미소비면 true → modifier=1.0. */
  offlineBonusPending: boolean;
}

/** settings: 게임 진행과 분리. 마이그레이션 영향 최소(§1.1). */
export interface SettingsState {
  /** 오프라인 정밀모드 on/off(§3.1 미니 시뮬). */
  offlinePrecise: boolean;
  /** 숫자 표기법. */
  notation: 'scientific' | 'engineering' | 'standard';
  /** 색맹 모드(DESIGN accessibility). null=off. */
  colorblind: 'protanopia' | 'deuteranopia' | 'tritanopia' | null;
}

/**
 * GameState — 중앙 단일 상태. 메모리 표현(Decimal 살아있음).
 * 후속 확장 자리: layers / codex / research / stats / events 구독 상태 등.
 */
export interface GameState {
  meta: MetaState;
  resources: ResourcesState;
  chain: ChainState;
  prestige: PrestigeState;
  settings: SettingsState;
  // TODO(M1.3+): layers   — 현재 층/서브층 인덱스 + 메커니즘 상태(§1.1)
  // TODO(M1.6+): codex     — 발견 입자 ID 집합(영구 보존)
  // TODO(M1.7+): research  — 구매 노드 ID 집합(영구 보존)
  // TODO(M1.7+): stats     — 누적 통계(정확 카운터 = native 정수), D_total 텔레메트리(R8)
}

/** 8단 체인. */
export const CHAIN_TIERS = 8;

/** 새 게임 초기 상태. (세이브 없을 때 / 새 시작 시) */
export function createInitialState(now: number = Date.now()): GameState {
  return {
    meta: {
      build: '0.0.1',
      createdAt: now,
      lastSave: now,
      totalPlaytime: 0,
    },
    resources: {
      E: D(0),
      C: D(0),
      D_current: D(0),
      QF: D(0),
      lifetime_C: D(0),
      D_lifetime: D(0),
    },
    chain: {
      bought: new Array<number>(CHAIN_TIERS).fill(0),
    },
    prestige: {
      count: 0,
      runIndex: 0,
      qfClaimed: D(0),
      focusSublayer: null,
      offlineBonusPending: false,
    },
    settings: {
      offlinePrecise: false,
      notation: 'scientific',
      colorblind: null,
    },
  };
}

/**
 * 모듈 전역 단일 상태 보유자(§4.3 단일 진실 소스).
 * UI(Svelte)는 이 인스턴스를 읽기 전용으로 구독, 변경은 tick·도메인 모듈만.
 * (Svelte store 연동은 ui 레이어에서 — 여기선 순수 보유·접근만 제공.)
 */
let _state: GameState = createInitialState();

export function getState(): GameState {
  return _state;
}

/** 로드/리셋 시 상태 교체(단일 경로). */
export function setState(next: GameState): void {
  _state = next;
}
