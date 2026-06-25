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

import { Decimal, D, ZERO } from '../bignum';
import { SEED_T1_BOUGHT } from '../chain/engine';
import { OrbitalResonance, PhaseOverlap, Harmonics } from '../layers/mechanics';

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

/**
 * chain: 8단 압축기 상태.
 *  - bought:   각 티어 구매 개수(정수, native number §2.2). 비용·마일스톤 기준. 세이브 대상.
 *  - produced: 상위 티어가 생산해 누적된 분량(Decimal). 진짜 누적 상태 → 세이브 대상.
 *
 * [tech-architect 보고] data-spec §6-D는 chain에 bought[8]만 명시하나, 8단 자기증식 모델에서
 *   상위 티어가 만든 하위 티어 분량(produced)은 bought만으로 복원 불가한 누적 상태다(C와 동급).
 *   따라서 produced[8] Decimal 배열을 세이브 스키마에 추가한다. owned = bought + produced(파생).
 */
export interface ChainState {
  /** 길이 8(T1~T8) 구매 개수. */
  bought: number[];
  /** 길이 8(T1~T8) 누적 생산분(Decimal). 상위 티어 생산 결과. */
  produced: Decimal[];
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

/**
 * layers: 현재 층 추적(systems §1, M1.3). 알려진 물리 5층 무상전이 진입.
 *  currentIndex만 진실 상태(파생 아님 — 진입 이벤트/비트는 "처음 도달" 1회만 발화하므로
 *  dec에서 매번 재계산하면 비트가 중복 발화됨 → 도달한 최대 층을 상태로 기억).
 */
export interface LayersState {
  /** 현재(=지금까지 도달한 최대) 알려진 물리 층 index(1..5). 초기 1=분자층. */
  currentIndex: number;
}

/**
 * codex: 입자 도감(codex.md §13, M1.3). 발견된 입자 ID 집합(영구 보존, 상전이/재하강 불변).
 *  메모리에선 Set<string>(빠른 has). 저장 시 배열로 직렬화(§1.1 "집합은 ID 배열로", 스파스).
 */
export interface CodexState {
  /** 발견된 입자 ID 집합. */
  discovered: Set<string>;
}

/**
 * research: 연구 트리(research-tree.md, M1.7). 구매한 노드 ID 집합(영구 보존, 상전이/재하강 불변).
 *  메모리에선 Set<string>(빠른 has). 저장 시 정렬 배열로 직렬화(§1.1 "집합은 ID 배열로", 스파스).
 *  효과(체인 티어 배율)는 파생 — 저장 안 함(chainTierMultipliers가 집합에서 재계산).
 */
export interface ResearchState {
  /** 구매한 연구 노드 ID 집합(A1·A2 등, 프로토타입 = A가지 2노드). */
  purchased: Set<string>;
}

/**
 * mechanics: 층별 메커니즘 모듈의 **살아있는 인스턴스**(tech-arch §1.1·§4.4 자기완결).
 *  Decimal 필드와 같은 규칙: 메모리에선 live 객체, 저장 시 save 모듈이 .serialize()로 평문화.
 *  M1.4: 오비탈 공명(원자층 L2). M1.6: 위상 겹침(프리온 L6) + 진동 하모닉스(끈 L7).
 *  메커니즘 상태는 상전이/재하강 시 리셋(§5-2 "층별 메커니즘 상태 = 리셋"). M1.6은 미지 메커니즘을
 *  상전이 실행 시 새 인스턴스로 교체(game.ts executePrestige가 진입 층에 맞춰 리셋).
 */
export interface MechanicsState {
  /** 오비탈 공명(원자층 L2). 항상 존재(원자층 미진입 시엔 game.ts가 update 스킵). */
  orbital: OrbitalResonance;
  /** 위상 겹침(프리온층 L6, M1.6). 미지 첫 메커니즘 — 프리온층 진입(상전이 1) 후에만 game.ts가 update. */
  phase: PhaseOverlap;
  /** 진동 하모닉스(끈층 L7, M1.6). 끈층 진입(상전이 2) 후에만 game.ts가 update. */
  harmonics: Harmonics;
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
  layers: LayersState; // M1.3: 알려진 물리 5층 진입 추적
  codex: CodexState; // M1.3: 발견 입자 ID 집합(영구 보존)
  mechanics: MechanicsState; // M1.4: 층별 메커니즘 살아있는 인스턴스(오비탈 공명)
  research: ResearchState; // M1.7: 구매 연구 노드 ID 집합(영구 보존)
  settings: SettingsState;
  // TODO(M3+): stats     — 누적 통계(정확 카운터 = native 정수), D_total 텔레메트리(R8)
}

/** 8단 체인. */
export const CHAIN_TIERS = 8;

/** 새 런 시작 시드 bought 배열: T1만 SEED_T1_BOUGHT개. (재하강 리셋·새 게임 공용.) */
export function seedBought(): number[] {
  const arr = new Array<number>(CHAIN_TIERS).fill(0);
  arr[0] = SEED_T1_BOUGHT;
  return arr;
}

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
      // T1 1개 시드 → C가 t=0부터 누적(engine.py start_g1=1과 정합, economy §2.2 dec1=0.009h).
      bought: seedBought(),
      produced: new Array<Decimal>(CHAIN_TIERS).fill(ZERO),
    },
    prestige: {
      count: 0,
      runIndex: 0,
      qfClaimed: D(0),
      focusSublayer: null,
      offlineBonusPending: false,
    },
    layers: {
      currentIndex: 1, // 분자층에서 시작.
    },
    codex: {
      discovered: new Set<string>(),
    },
    mechanics: {
      orbital: new OrbitalResonance(),
      phase: new PhaseOverlap(),
      harmonics: new Harmonics(),
    },
    research: {
      purchased: new Set<string>(),
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
