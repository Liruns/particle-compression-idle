/**
 * game — 게임 부트스트랩 + 코어 루프 와이어링. (M1.2: 8단 체인 엔진 + 구매 + 코어 수식)
 *
 * 와이어링:
 *   - F2 StorageAdapter: platform.detectPlatform() → LocalStorageAdapter 주입.
 *   - F1 SaveManager: 부팅 시 load(봉투·체크섬·마이그레이션), autoSave 스케줄러로 주기 저장.
 *   - F3 GameLoop: 고정 timestep tick에서 **8단 체인 생산**(chainTick, 역순 단일 패스) → dec/r 파생.
 *   - F4 bignum: 모든 자원·생산이 Decimal. native 연산 없음.
 *
 * 코어 루프(system-flows §1.1 tick 순서):
 *   1. production_mult 계산(QF)  2. 체인 생산(역순 패스) → C·E·produced 갱신  3. lifetime_C 누적.
 * 구매(system-flows §2): 닫힌형 대량구매(planBuy) — while-bank 루프 없음.
 *
 * UI(App.svelte)는 이 모듈이 노출하는 readonly 스냅샷을 구독해 표시만 한다(§4.1 단방향).
 */

import { Decimal, D, ZERO, add, sub } from './core/bignum';
import { getState, setState, createInitialState, CHAIN_TIERS, type GameState } from './core/state';
import type { SlotPhase, PhaseState } from './core/layers/mechanics';
import { OrbitalResonance, PhaseOverlap, Harmonics } from './core/layers/mechanics';
import { MANUAL_COMPRESS, PHASE_OVERLAP, RESONANCE, DISCOVERY_D_BY_RARITY } from './data/constants';
import { particleById } from './data/particles';
import { GameLoop, Scheduler } from './core/loop';
import { SaveManager, type LoadResult } from './core/save';
import {
  computeDec,
  computeRadius,
  productionMult,
  chainTick,
  composeOwned,
  tierCost,
  tierProductionRate,
  planBuy,
} from './core/chain';
import { detectPlatform, type PlatformAdapter } from './platform';
import { bus } from './core/events';
import {
  layersEnteredSince,
  currentLayer,
  isNearKnownBoundary,
  layerByIndex,
  LAST_KNOWN_LAYER_INDEX,
  type LayerDefinition,
} from './core/layers';
import { formatNumber, setDefaultNotation, type NotationKind } from './core/format';
import {
  previewPrestige,
  applyPrestigeReset,
  nextPrestigeIndex,
  isBigCrunchAvailable,
  previewBigCrunch,
  applyBigCrunchReset,
  type PrestigePreview,
  type BigCrunchPreview,
} from './core/prestige';
import { seedBought } from './core/state';
import { prestigeBeat, prestigeExecLog, bigCrunchExecLog, BIG_CRUNCH_BEAT } from './data/narrative';
import {
  evaluateDiscoveries,
  evaluateMechDiscoveries,
  knownLayerCompletions,
  codexCompletion,
  discoverableCollected,
  CODEX_DENOMINATOR,
  type LayerCompletion,
} from './core/codex';
import { deriveFtue, type FtueState } from './core/ftue';
import { computeOffline, applyOfflineCredit, type OfflineResult } from './core/offline';
import {
  RESEARCH_NODES,
  buyResearchNode,
  chainTierMultipliers,
  clickPowerMultiplier,
  dYieldMultiplier,
  resonanceDMultiplier,
  resonanceWindowBonus,
  resonanceComboMaxBonus,
  hasAutoResonance,
  researchSnapshot,
  isResearchUnlocked,
  type ResearchView,
} from './core/research';
import {
  evaluateAchievements,
  ACHIEVEMENT_TOTAL,
  type AchievementContext,
} from './core/achievements';

/** 한 티어의 표시용 스냅샷(ui-flow §2-D 체인 테이블 한 행). */
export interface TierSnapshot {
  /** 1-기반 티어 번호(1..8). */
  tier: number;
  /** 구매 개수(정수). */
  bought: number;
  /** 보유 총량(= bought + produced, Decimal). */
  owned: Decimal;
  /** 다음 1개 비용 = cost_k(bought) (Decimal). */
  nextCost: Decimal;
  /** 생산율: 초당 만드는 하위 단위 수 (= owned·mult, Decimal). */
  rate: Decimal;
  /** 현재 E로 다음 1개 구매 가능 여부. */
  affordable: boolean;
  /** 해금 여부(T1은 항상, 그 외 직전 티어 1개 이상 보유 시 — ui-flow §2-D +1 노출). */
  unlocked: boolean;
}

/** 현재 층 표시용 스냅샷(ui-flow §2 우측 층 카드). */
export interface LayerSnapshot {
  /** 층 index(1..5 알려진 물리). */
  index: number;
  /** CSS data-layer 슬러그(팔레트 토큰 전환 키). */
  slug: string;
  /** 한국어 층 이름. */
  nameKo: string;
  /** 영문 층 이름. */
  nameEn: string;
  /** 메커니즘 한국어 이름(M1.4 풀 구현 — M1.3은 이름만). */
  mechanismNameKo: string;
  /** 대표 스케일(m 문자열). */
  scaleM: string;
  /** 서사 decade 범위 [start,end]. */
  decadeRange: readonly [number, number];
  /**
   * decade 진행 바용 정규화 진행도 0~1(ux-overhaul §P1-3). **표시 전용 읽기 파생** — 로직/경제 불변.
   *   현재 층 enterDec→다음 층 enterDec 구간에서 dec의 위치(decadeRange는 known층이 단일점이라 부적합).
   *   마지막 층은 decadeRange 폭으로 폴백. 분모≤0이면 0.
   */
  decadeProgress: number;
  /** decade 바 양끝 라벨용 [start,end] dec(진행도 분모와 동일 구간). 표시 전용. */
  decadeBarRange: readonly [number, number];
  /** 알려진 입자 경계 근접(dec15+) — ux.md §5-6 신호. */
  nearBoundary: boolean;
}

/** 도감 표시용 스냅샷(ui-flow §4). */
export interface CodexSnapshot {
  /** 발견된 입자 ID 집합(UI 카드 발견 여부 판정). */
  discovered: ReadonlySet<string>;
  /** 발견 discoverable 수(분모 76 기준). */
  collected: number;
  /** 분모(76, LEGENDARY 제외). */
  denominator: number;
  /** 완성도(0~1). */
  completion: number;
  /** 알려진 물리 층별 완성 현황(L1~L5). */
  layerCompletions: LayerCompletion[];
  /** 도달한 최대 층 index(1..11). 도감 뷰가 미지 서브층 섹션 노출 게이트로 사용(M1.6). */
  maxLayerReached: number;
}

/**
 * 오비탈 공명 위젯 표시용 스냅샷(ui-flow §2-E, M1.4). 원자층(L2) 진입 시 활성.
 *  UI는 이 값만 읽어 슬롯/링/배율을 그린다(메커니즘 내부는 모름 — 단방향 §4.1).
 */
export interface ResonanceSnapshot {
  /** 위젯 활성 여부(원자층 L2+ 도달 시 true). false면 위젯 숨김(분자층). */
  active: boolean;
  /** 현재 슬롯 상태(open=클릭 유효, closed=다음 열림 대기). */
  phase: SlotPhase;
  /** 현재 phase 진행도(0~1) — 카운트다운 링/프로그레스. */
  progress: number;
  /** 현재 공명 배율(1.0~1.5). 체인 production에 곱(표시·로그용). */
  multiplier: number;
  /** 현재 연속 성공 콤보(0~COMBO_MAX). UI 콤보 표시(개선). */
  combo: number;
}

/**
 * 위상 겹침 위젯 표시용 스냅샷(ui-flow §2-E, M1.6). 프리온층(L6) 진입 시 활성.
 *  오비탈 공명과 *다른 결*: 슬롯 타이밍이 아니라 [응집][분산][공명] 상태 토글 + 고정.
 *  UI는 이 값만 읽어 토글/상태/진행/누적을 그린다(메커니즘 내부는 모름 — 단방향 §4.1).
 */
export interface PhaseSnapshot {
  /** 위젯 활성 여부(프리온층 L6+ 도달 시 true). false면 위젯 숨김. */
  active: boolean;
  /** 현재 위상 상태(coherent=응집/dispersed=분산/resonant=공명). */
  state: PhaseState;
  /** 고정 여부(true면 자동 순환 정지 — 능동 전문화 중). */
  pinned: boolean;
  /** 다음 자동 순환까지 진행도(0~1). 고정 중이면 0. */
  cycleProgress: number;
  /** 현재 체인 배율(상태별 — 응집 최대). 표시·로그용. */
  multiplier: number;
  /** 상태 고정 1회 E 비용(현재 dC/dt 기반). UI 버튼 비용 표시. */
  pinCost: Decimal;
  /** 상태별 누적 유지 시간(초) — 프리온 발견 진행도 표시. */
  times: { coherent: number; dispersed: number; resonant: number };
}

/**
 * 진동 하모닉스 위젯 표시용 스냅샷(ui-flow §2-E, M1.6). 끈층(L7) 진입 시 활성.
 *  위상/공명과 또 다른 결: V 에너지 바 + 다음 공명 티어 예측(수동 없음 — 자동 진행).
 */
export interface HarmonicsSnapshot {
  /** 위젯 활성 여부(끈층 L7+ 도달 시 true). false면 위젯 숨김. */
  active: boolean;
  /** 다음 공명까지 진행도(0~1) — V 에너지 바. */
  chargeProgress: number;
  /** 다음에 공명할 티어(1..8) — "공명 스케줄 미리보기". */
  nextTier: number;
  /** 누적 공명 횟수(도감 진행). */
  totalResonances: number;
  /** 현재 burst 중인 티어들(1..8, 폭발 강조용). 없으면 빈 배열. */
  burstingTiers: number[];
}

/**
 * 상전이 표시용 스냅샷(ui-flow §5 상전이 화면, M1.5). 미지 6벽 도달 시만 점등(알려진 물리 비점등).
 *  UI는 이 값만 읽어 상전이 탭 점등·상전이 화면(QF 획득량·확인 버튼)을 그린다(단방향 §4.1).
 */
export interface PrestigeSnapshot {
  /** 상전이 가능 여부(미지 벽 도달 → 탭 점등 게이트). false면 상전이 탭/화면 숨김. */
  available: boolean;
  /** 다음 상전이 prestigeIndex(1=프리온 … 6=플랑크). 0=불가. */
  prestigeIndex: number;
  /** 이번 상전이로 받을 QF(예정량, Decimal). UI "+{N} QF 획득" 표시. */
  qfGain: Decimal;
  /** 상전이 후 QF 누적 총량(Decimal). */
  qfTotal: Decimal;
  /** 상전이 후 적용될 production_mult(부스트, Decimal). UI "다음 런 배율 ×{m}". */
  nextMult: Decimal;
  /** 진입할 미지 서브층 한국어 이름(프리온 등). available=false면 빈 문자열. */
  targetLayerKo: string;
  /** 진입할 미지 서브층 영문 이름. */
  targetLayerEn: string;
  /** 첫 상전이(PT1) 여부 — UI 특별 강조 연출(딥 퍼플, 2줄 내러티브, ui-flow §5-B). */
  isFirst: boolean;
  /** 빅 크런치(PT7)인가 — true면 재하강 프레이밍(종착점 언어 금지). targetLayer=분자층. */
  isBigCrunch: boolean;
  /** 상전이 횟수(N_prestige). */
  count: number;
}

/**
 * 오프라인 복귀 모달 표시용(ui-flow §10, M1.7). 로드 시 elapsed > 60초면 채워진다(아니면 null).
 *  UI는 이 값만 읽어 모달(자리비움 시간·유효시간·획득 자원)을 그린다. 확인하면 dismissOffline로 소거.
 */
export interface OfflineSnapshot {
  /** 자리비움 실제 시간(초, 클램프 전). UI "N시간 N분 자리 비움". */
  rawSeconds: number;
  /** 보상에 쓰인 유효 온라인 환산(초). UI "유효 온라인 환산: Xh (×mod)". */
  effectiveSeconds: number;
  /** 적용 modifier(0.65 또는 1.0 상전이 직후). */
  modifier: number;
  /** CAP(24h) 초과로 잘렸는지(UI "24시간 상한 도달" 안내). */
  cappedHit: boolean;
  /** 지급된 C 증분. */
  dC: Decimal;
  /** 지급된 E 증분. */
  dE: Decimal;
  /** 지급된 D 증분(공명 방치 기본 — 0일 수 있음). */
  dD: Decimal;
}

/** 통계(기록) 표시용 스냅샷(§stats). 진행 로직 비관여 — 표시 전용 집계. */
export interface StatsSnapshot {
  /** 수동 압축 누적 횟수. */
  manualCompresses: number;
  /** 결속(구매) 누적 수량. */
  totalBinds: number;
  /** 전 생애 최대 dec. */
  maxDec: number;
  /** 총 플레이타임(초). */
  playtimeSeconds: number;
  /** 상전이 횟수 / 재하강 run index. */
  prestigeCount: number;
  runIndex: number;
  /** 누적 압축 깊이 C(전 런) / 누적 발견 데이터 D. */
  lifetimeC: Decimal;
  lifetimeD: Decimal;
  /** 구매한 연구 노드 수. */
  researchCount: number;
  /** 도달 최대 층 index. */
  maxLayerIndex: number;
}

/** 관측 목표(업적) 표시용 스냅샷. 달성 집합 + 분모(뷰가 ACHIEVEMENTS 정의와 결합). */
export interface AchievementsSnapshot {
  /** 달성한 목표 ID 집합. */
  earned: Set<string>;
  /** 달성 수 / 전체 수. */
  count: number;
  total: number;
}

/** UI가 읽는 표시용 스냅샷(읽기 전용). Decimal 그대로 — format은 UI에서. */
export interface GameSnapshot {
  C: Decimal;
  E: Decimal;
  /** 발견 데이터 D(M1.4 오비탈 공명 산출). 느린 연구 화폐. */
  D: Decimal;
  QF: Decimal;
  /** 파생: dec = α·log₁₀(C+1). */
  dec: number;
  /** 파생: r = r₀·10^(−dec) (m). */
  r: Decimal;
  /** 파생: production_mult. */
  mult: Decimal;
  /** dC/dt (= g1·mult), UI 생산율 표시용 (Decimal). */
  rateC: Decimal;
  /**
   * 렌더 전용 파생(읽기 전용): 생산 중인가(rateC>0). 게이지 맥동·파티클 활성 조건.
   *   렌더러가 Decimal을 직접 만지지 않도록 snapshot 경계에서 boolean으로 환산(tech §6.2, V2-8).
   */
  rateCPositive: boolean;
  /**
   * 렌더 전용 파생(읽기 전용): log₁₀(rateC) (rateC≤0이면 0). 파티클 속도 로그압축 매핑용.
   *   native 연산 금지 원칙 — log10은 Decimal 메서드, 결과 number만 노출(tech §2.2, V2-8).
   */
  rateCLog10: number;
  /** 8단 체인 각 티어 표시 정보. */
  tiers: TierSnapshot[];
  /** 현재 층(M1.3). */
  layer: LayerSnapshot;
  /** 도감(M1.3). */
  codex: CodexSnapshot;
  /** 오비탈 공명 위젯(M1.4 — 원자층 L2). */
  resonance: ResonanceSnapshot;
  /** 위상 겹침 위젯(M1.6 — 프리온층 L6). */
  phase: PhaseSnapshot;
  /** 진동 하모닉스 위젯(M1.6 — 끈층 L7). */
  harmonics: HarmonicsSnapshot;
  /** 상전이 상태(M1.5 — 미지 벽 도달 시 점등). */
  prestige: PrestigeSnapshot;
  /** 연구 화면 상태(M1.7 — A가지 체인증폭 노드). */
  research: ResearchView;
  /** FTUE 점진 공개 상태(M1.3). */
  ftue: FtueState;
  /** 오프라인 복귀 모달(M1.7 — 로드 시 elapsed>60s). null이면 모달 없음. */
  offline: OfflineSnapshot | null;
  totalTicks: number;
  loadKind: LoadResult['kind'];
  /** 현재 표기법 설정(설정 패널 표시용). */
  notation: NotationKind;
  /** 통계(기록 패널). */
  stats: StatsSnapshot;
  /** 관측 목표(업적 패널). */
  achievements: AchievementsSnapshot;
}

/** snapshot 구독자(Svelte가 등록). */
type SnapshotListener = (snap: GameSnapshot) => void;

/** 대량구매 모드: 1개 / 10개 / 100개 / Max(전액). (ui-flow §2-D, system-flows §2.1) */
export type BuyMode = 1 | 10 | 100 | 'max';

/**
 * decade 진행 바 정규화(ux-overhaul §P1-3). **표시 전용 순수 파생** — 게임 상태·경제 불변.
 *  진행 구간 = 현재 층 enterDec → 다음 층 enterDec. (decadeRange는 known층이 단일점이라 분모 0 → 부적합.)
 *  마지막 층(다음 없음)은 decadeRange 폭으로 폴백, 그것도 0이면 +3 가상 폭. 분모≤0 가드.
 *  @returns [progress(0~1), [barStart, barEnd]]
 */
function deriveDecadeProgress(def: LayerDefinition, dec: number): [number, readonly [number, number]] {
  const start = def.enterDec;
  const next = layerByIndex(def.index + 1);
  let end = next ? next.enterDec : def.decadeRange[1];
  if (end <= start) end = def.decadeRange[1] > start ? def.decadeRange[1] : start + 3;
  const span = end - start;
  const progress = span > 0 ? Math.min(1, Math.max(0, (dec - start) / span)) : 0;
  return [progress, [start, end]];
}

export class Game {
  private readonly platform: PlatformAdapter;
  private readonly save: SaveManager;
  private readonly loop: GameLoop;
  private readonly scheduler = new Scheduler();
  private listeners = new Set<SnapshotListener>();
  private loadKind: LoadResult['kind'] = 'fresh';
  /** 상전이 가능 1회 발화 가드(prestige_ready 이벤트 중복 방지). 가능→불가→가능 재발화 허용. */
  private prestigeReadyEmitted = false;
  /** 오프라인 복귀 모달 데이터(로드 시 elapsed>60s면 채워짐, M1.7). 확인하면 null로 소거. */
  private offlineSnapshot: OfflineSnapshot | null = null;

  constructor() {
    this.platform = detectPlatform();
    this.save = new SaveManager(this.platform.createStorageAdapter());

    // F3: 고정 timestep 루프. tick=로직, render=표현(스냅샷 통지).
    this.loop = new GameLoop({
      tick: (dt) => this.tick(dt),
      render: () => this.notify(),
      // catch-up 상한 초과분(백그라운드 탭/장시간 멈춤)은 오프라인 경로로 일괄 흡수(§6.4).
      //   "백그라운드 = 짧은 오프라인" — 48h 클램프·modifier 동일 적용(익스플로잇 차단).
      onOverflow: (overflowSeconds) => this.applyOverflowOffline(overflowSeconds),
    });
  }

  /** 부팅: 세이브 로드 → 스케줄러(autoSave/everySecond) → 루프 시작. */
  async start(): Promise<void> {
    await this.platform.init();

    const result = await this.save.load();
    this.loadKind = result.kind;
    setState(result.state);
    // 저장된 표기법 설정을 표시 계층에 주입(formatNumber 전역 기본). 표시 전용 — 로직 불변.
    setDefaultNotation(result.state.settings.notation);

    // 오프라인 복귀(M1.7, system-flows §7.1). 로드 직후 단 한 번 — meta.lastSave로부터 elapsed
    //   계산 → 끊긴 시점 rate × 유효시간 일괄 지급(economy §3.1 하한). 새 게임(lastSave≈now)은 0.
    //   진행 동기화(processProgression) 전에 적용 — 오프라인으로 넘은 dec를 층/도감이 함께 흡수.
    this.applyLoadOffline();

    // 부팅 직후 진행 동기화(M1.3): 로드된 dec 기준 층/도감을 즉시 정합.
    //  - 새 게임(dec0): 물 분자(unlockDec 0) 즉시 발견 가능 → 시작부터 도감 1개.
    //  - 로드 세이브: 발견 누락분 보충(데이터 추가/조건 단순화로 새로 해금된 입자 흡수).
    //  멱등이므로 이미 기록된 것은 재발화 안 함.
    this.processProgression(computeDec(getState().resources.C));

    // 로드된 연구(공명 강화 노드)를 orbital에 주입(파생 — 세이브엔 purchased만, 강화는 재계산).
    this.applyResonanceConfig();

    // everySecond: lastSave·플레이타임 갱신(저빈도, §4.2).
    this.scheduler.every('everySecond', 1, () => {
      const s = getState();
      s.meta.totalPlaytime += 1;
    });
    // autoSave: 30초마다 저장(tick과 분리, §4.2).
    this.scheduler.every('autoSave', 30, () => {
      void this.persist();
    });

    this.loop.start();
  }

  /**
   * F3 tick(로직): 결정적 고정 dt. system-flows §1.1 순서.
   *   1. mult = production_mult(QF).
   *   2. 체인 생산(역순 단일 패스): produced 갱신 + dC/dE 산출.
   *   3. C·E 가산, lifetime_C 누적.  전부 Decimal(F4).
   */
  private tick(dt: number): void {
    const s = getState();

    // 스케줄러도 같은 시간축으로 구동(백그라운드/오프라인 일관, §6.4).
    this.scheduler.update(dt);

    // 1. 프레스티지 배율(현재 QF만 — holographic/research는 후속).
    const baseMult = productionMult(s.resources.QF);

    // 1b. 오비탈 공명(원자층 L2+, systems §2-A). 슬롯 전진 + 배율·D 산출.
    //     공명 배율은 체인 production에 곱해진다(§2-A "체인 전체에 곱"). 분자층(L1)에선 비활성.
    const resonanceMult = this.updateResonance(dt);

    // 1c. 위상 겹침(프리온층 L6+, systems §2-E, M1.6). 상태 순환 + 배율·D·QF·발견 산출.
    //     위상 배율도 체인 전체에 곱(오비탈 공명과 동형 합성). 미지 첫 메커니즘.
    const phaseMult = this.updatePhase(dt);

    // 전체 곱 배율(QF × 공명 × 위상). 1.0 항은 곱 생략(Decimal 연산 절약).
    let mult = baseMult;
    if (resonanceMult > 1) mult = mult.mul(resonanceMult);
    if (phaseMult > 1) mult = mult.mul(phaseMult);

    // 1d. 진동 하모닉스(끈층 L7+, systems §2-F, M1.6). V 누적 + 티어별 공명 배율 산출.
    //     전체 곱이 아닌 **티어 선택 배율**(특정 티어만 폭발) — chainTick tierMult로 전달.
    const harmonicMult = this.updateHarmonics(dt);

    // 1e. 연구 체인증폭(A가지, M1.7). 구매 노드의 **티어 내부 배율**(C안 — research_mult 불변).
    //     하모닉과 동형 티어별 배율 → 합성(같은 인덱스 곱)해 chainTick tierMult로 전달.
    const tierMult = this.composeTierMult(harmonicMult);

    // 2. 8단 체인 생산(역순 단일 패스, engine.py 동형). 전체 배율 mult + 티어별(하모닉·연구) 배율.
    const { dC, dE, produced } = chainTick(s.chain.bought, s.chain.produced, mult, dt, tierMult);
    s.chain.produced = produced;

    // 3. 자원 가산(C·E 동일 소스) + lifetime_C 누적(QF 산출 입력, §1.1 단계 2).
    s.resources.C = add(s.resources.C, dC);
    s.resources.E = add(s.resources.E, dE);
    s.resources.lifetime_C = add(s.resources.lifetime_C, dC);

    // 4. 층 진입 + 도감 발견 판정(M1.3). dec 파생 → 상태 갱신 → 이벤트 발행.
    this.processProgression(computeDec(s.resources.C));
  }

  /**
   * 오비탈 공명 메커니즘 전진(systems §2-A, M1.4). 원자층(L2) 진입 이후에만 동작.
   *  슬롯 상태머신을 dt만큼 전진시키고, 방치 자동 공명이 발화하면 D를 가산·이벤트를 발행한다.
   *  메커니즘은 자기완결 — game.ts는 update 결과(배율·D·슬롯 이벤트)만 자원/버스에 반영.
   * @returns 현재 공명 배율(1.0~1.5). 비활성(분자층)이면 1.0.
   */
  private updateResonance(dt: number): number {
    const s = getState();
    if (!this.isResonanceActive()) return 1;

    const orbital = s.mechanics.orbital;
    const resD = resonanceDMultiplier(s.research.purchased); // 공명 데이터 연구 배율.
    const r = orbital.update(dt);
    if (r.dGained > 0) this.addDiscovery(r.dGained * resD);
    if (r.slotOpened) bus.emit('resonance_slot_open', {});
    if (r.autoResonated) bus.emit('resonance_auto', {});

    // 자동 공명 연구(Z1): 열린 슬롯을 자동으로 잡아 성공 처리(콤보 유지 + D). 개입 자동화.
    if (hasAutoResonance(s.research.purchased) && orbital.getPhase() === 'open') {
      const cr = orbital.click();
      if (cr.success) {
        if (cr.dGained > 0) this.addDiscovery(cr.dGained * resD);
        bus.emit('resonance_click', { success: true });
      }
    }
    return orbital.getMultiplier();
  }

  /**
   * 오비탈 공명 활성 조건: 원자층(L2)~쿼크층(L5) 구간(2 ≤ currentIndex < 6).
   *   미지 진입(L6 프리온+) 후엔 비활성 — 위상 겹침이 그 자리를 대체(메커니즘 핸드오프, M1.6).
   *   → 위젯 표시와 생산 기여가 일치(L6+에선 공명 배율 미적용).
   */
  private isResonanceActive(): boolean {
    const i = getState().layers.currentIndex;
    return i >= 2 && i < 6;
  }

  /** D(발견 데이터) 가산. 현재 런 + lifetime 동시 누적(§5-2 D_lifetime 100% 보존, R8 입력). */
  private addDiscovery(amount: number): void {
    const s = getState();
    // d_yield 연구가 모든 D 획득(발견·공명)을 가속 — 연구 축 자체 성장(생산 레이스 무관).
    const d = D(amount * dYieldMultiplier(s.research.purchased));
    s.resources.D_current = add(s.resources.D_current, d);
    s.resources.D_lifetime = add(s.resources.D_lifetime, d);
  }

  /**
   * 위상 겹침 메커니즘 전진(systems §2-E, M1.6). 프리온층(L6) 진입 이후에만 동작.
   *  상태 순환 + 상태별 산출(분산=D, 공명=QF)을 자원에 반영하고, 전환 이벤트를 발행한다.
   *  발견 판정(P+/P-/P0)은 processProgression의 미지 경로에서 누적시간으로 한다(여기선 자원만).
   * @returns 현재 위상 체인 배율(상태별). 비활성이면 1.0.
   */
  private updatePhase(dt: number): number {
    const s = getState();
    if (!this.isPhaseActive()) return 1;

    const r = s.mechanics.phase.update(dt);
    if (r.dGained > 0) this.addDiscovery(r.dGained);
    if (r.qfGained > 0) {
      // 공명 상태 QF 트리클(systems §2-E "QF 미적립 지속"). 영구 보존 자원이라 직접 누적.
      s.resources.QF = add(s.resources.QF, D(r.qfGained));
    }
    if (r.cycled) bus.emit('phase_cycled', { state: r.newState });
    return s.mechanics.phase.getMultiplier();
  }

  /** 위상 겹침 활성 조건: 프리온층(L6) 이상 도달(layers.currentIndex ≥ 6). */
  private isPhaseActive(): boolean {
    return getState().layers.currentIndex >= 6;
  }

  /**
   * 진동 하모닉스 메커니즘 전진(systems §2-F, M1.6). 끈층(L7) 진입 이후에만 동작.
   *  V 누적 + 하모닉 공명(티어 burst)을 전진시키고, 공명 발생 시 이벤트를 발행한다.
   *  발견 판정(끈 입자)은 processProgression 미지 경로에서 누적 공명수로 한다(여기선 burst만).
   * @returns 티어별 배율 맵(길이 8). 비활성이면 undefined(chainTick이 전부 1로 처리).
   */
  private updateHarmonics(dt: number): number[] | undefined {
    const s = getState();
    if (!this.isHarmonicsActive()) return undefined;

    const r = s.mechanics.harmonics.update(dt);
    if (r.resonated) bus.emit('harmonic_resonance', { tier: r.resonantTier });
    return s.mechanics.harmonics.getTierMultipliers();
  }

  /** 진동 하모닉스 활성 조건: 끈층(L7) 이상 도달(layers.currentIndex ≥ 7). */
  private isHarmonicsActive(): boolean {
    return getState().layers.currentIndex >= 7;
  }

  /**
   * 티어별 배율 합성(M1.7): 하모닉(끈층) × 연구 체인증폭(A가지). 둘 다 티어별(인덱스 0..7) 배율 →
   *   같은 인덱스끼리 곱한다. 둘 다 1이면 undefined 반환(chainTick이 전부 1로 처리 — Decimal 연산 절약).
   *   ★ 연구 배율은 **체인 내부**(특정 티어만, C안) — 전역 production_mult에 안 들어간다(research_mult 불변).
   * @param harmonicMult updateHarmonics 결과(없으면 undefined).
   */
  private composeTierMult(harmonicMult: number[] | undefined): number[] | undefined {
    const purchased = getState().research.purchased;
    const hasResearch = purchased.size > 0;
    if (!harmonicMult && !hasResearch) return undefined; // 둘 다 없음 → 전부 1.

    const research = hasResearch ? chainTierMultipliers(purchased) : undefined;
    if (harmonicMult && !research) return harmonicMult;
    if (research && !harmonicMult) return research;

    // 둘 다 있음 → 인덱스별 곱(길이 8).
    const out = new Array<number>(CHAIN_TIERS);
    for (let i = 0; i < CHAIN_TIERS; i++) {
      out[i] = (harmonicMult ? harmonicMult[i] : 1) * (research ? research[i] : 1);
    }
    return out;
  }

  // --- 오프라인 복귀 (M1.7, system-flows §7, economy §3) ------------------------

  /**
   * 로드 직후 오프라인 복귀 처리(system-flows §7.1). 한 번만 호출(start 안).
   *   meta.lastSave를 last_save로 채택(§1.7 — 단일 클라이언트에선 파일 기록값. Cloud 교차검증은 M3).
   *   60초 이하면 모달 없음(ui-flow §10-A — 짧은 자리비움은 무시). elapsed > 60s면 모달 데이터 채움.
   */
  private applyLoadOffline(): void {
    const s = getState();
    const credit = this.runOffline(Date.now(), s.meta.lastSave, s.prestige.offlineBonusPending);
    if (!credit) return;
    // 60초 초과만 모달 노출(ui-flow §10-A "elapsed > 60초"). 그 이하 지급분은 조용히 반영됨.
    if (credit.result.rawSeconds > 60) {
      this.offlineSnapshot = {
        rawSeconds: credit.result.rawSeconds,
        effectiveSeconds: credit.result.effectiveSeconds,
        modifier: credit.result.modifier,
        cappedHit: credit.result.cappedHit,
        dC: credit.credit.dC,
        dE: credit.credit.dE,
        dD: credit.credit.dD,
      };
    }
  }

  /**
   * 루프 catch-up 상한 초과분을 오프라인으로 흡수(tech-arch §6.4 "백그라운드 = 짧은 오프라인").
   *   모달은 띄우지 않음(메인 진행 중 자연 흡수). last_save 비교가 아니라 overflowSeconds를 직접
   *   유효시간 공식에 태우기 위해, now/lastSave를 overflow만큼 벌려 같은 단일 진입점(runOffline)을 탄다.
   *   → 시계조작 방어·modifier·48h 클램프가 동일하게 적용(경로 일원화).
   */
  private applyOverflowOffline(overflowSeconds: number): void {
    if (overflowSeconds <= 0) return;
    const now = Date.now();
    // afterPrestige=false: 백그라운드 흡수는 복귀 임팩트 보너스 대상 아님(상전이 직후 1회성과 구분).
    this.runOffline(now, now - overflowSeconds * 1000, false);
  }

  /**
   * 오프라인 단일 진입점(§3.2 "클램프는 함수 입구에서 딱 한 번"). 시간 수식(computeOffline) +
   *   일괄 지급(applyOfflineCredit)을 묶어 자원에 반영하고 결과를 돌려준다. 유효시간 0이면 null.
   *
   *   끊긴 시점 rate(끊겼다 가정 — 현재 owned·mult 기준 dC/dt, 보수적 하한 §3.1) × 유효시간.
   *   D는 메커니즘 방치 기본 트리클(§3.4 — 현재 활성 메커니즘의 방치 기본율, 최댓값 아님).
   *   상전이 직후 modifier=1.0 플래그는 여기서 소비(1회성, §3.3).
   */
  private runOffline(
    now: number,
    lastSave: number,
    afterPrestige: boolean,
  ): { result: OfflineResult; credit: ReturnType<typeof applyOfflineCredit> } | null {
    const s = getState();
    const result = computeOffline({ now, lastSave, afterPrestige });
    if (result.effectiveSeconds <= 0) return null;

    // 끊긴 시점 dC/dt(=g1·mult). mult는 현재 production_mult(QF항만 — 메커니즘 배율은 방치 기본으로
    //   rateD에 별도 반영. C 생산엔 보수적으로 QF항만 — 일괄 하한 정신, 메커니즘 곱 미반영).
    const mult = productionMult(s.resources.QF);
    const owned = composeOwned(s.chain.bought, s.chain.produced);
    const rateC = owned[0].mul(mult);
    const rateD = this.offlineDRate();

    const credit = applyOfflineCredit(result.effectiveSeconds, rateC, rateD);

    // 자원 반영(§7.1 단계 6): C·E 가산 + lifetime_C 누적 + D_current·D_lifetime 가산.
    s.resources.C = add(s.resources.C, credit.dC);
    s.resources.E = add(s.resources.E, credit.dE);
    s.resources.lifetime_C = add(s.resources.lifetime_C, credit.dC);
    if (credit.dD.gt(0)) {
      s.resources.D_current = add(s.resources.D_current, credit.dD);
      s.resources.D_lifetime = add(s.resources.D_lifetime, credit.dD);
    }

    // 상전이 직후 modifier=1.0 1회성 소비(§3.3). afterPrestige=true로 적용됐으면 플래그 끔.
    if (afterPrestige && s.prestige.offlineBonusPending) {
      s.prestige.offlineBonusPending = false;
    }

    bus.emit('offlineApplied', { seconds: result.effectiveSeconds });
    return { result, credit };
  }

  /**
   * 오프라인 중 D 트리클율(초당, §3.4 메커니즘 방치 기본값). 현재 활성 메커니즘의 방치 기본 D율.
   *   - 원자~쿼크(오비탈 공명 활성): 자동 공명 방치 기본 D율(D_PER_IDLE / 주기).
   *   - 프리온+(위상 겹침): 분산 상태 평균 기여(자동 순환 중 일부 시간 분산) — 보수적으로 1/3.
   *   "방치 기본 배율 — 최댓값 아님(익스플로잇 방지)·최악값 아님(불쾌 방지)"(tech-arch §3.4).
   */
  private offlineDRate(): number {
    const i = getState().layers.currentIndex;
    if (i >= 2 && i < 6) {
      // 오비탈 자동 공명: SLOT_INTERVAL+WINDOW 주기마다 D_PER_IDLE 1회 → 초당 평균.
      const period = RESONANCE.SLOT_INTERVAL_SECONDS + RESONANCE.SLOT_WINDOW_SECONDS;
      return RESONANCE.D_PER_IDLE / period;
    }
    if (i >= 6) {
      // 위상 자동 순환: 3상태 중 분산 1/3 시간 가정 → 분산 D율의 1/3(방치 기본, 보수적).
      return PHASE_OVERLAP.DISPERSED_D_RATE / 3;
    }
    return 0; // 분자층(메커니즘 없음).
  }

  /** 오프라인 모달 확인(소거). UI "확인" 클릭 시. */
  dismissOffline(): void {
    this.offlineSnapshot = null;
    this.notify();
  }

  // --- 연구 (M1.7, system-flows §9) --------------------------------------------

  /**
   * 연구 노드 구매(system-flows §9.1). D_current로 비용 지불 → 구매 기록 → 효과(체인 티어 배율)는
   *   파생이라 다음 tick부터 자동 반영(composeTierMult가 구매 집합에서 재계산). research_mult 불변(C안).
   *   해금(첫 D + 원자층)·선행·중복·D 충분을 buyResearchNode가 판정, 성공 시에만 D 차감.
   * @returns 구매 성공 여부(UI 주스 분기).
   */
  buyResearch(nodeId: string): boolean {
    const s = getState();
    const node = RESEARCH_NODES.find((n) => n.id === nodeId);
    if (!node) return false;

    // 해금 게이트(첫 D + 원자층). 미해금이면 구매 자체 불가.
    const hasD = s.resources.D_lifetime.gt(0) || s.resources.D_current.gt(0);
    if (!isResearchUnlocked(s.layers.currentIndex, hasD)) return false;

    // D 충분 판정(Decimal 경계 §2.2 — 비교는 Decimal, 결과 boolean을 순수 함수에 주입).
    const affordable = s.resources.D_current.gte(node.costD);
    const r = buyResearchNode(nodeId, s.research.purchased, affordable);
    if (!r.ok || !r.node) {
      bus.emit('buy_failed', { tier: 0 }); // 연구 실패도 동일 피드백 채널(tier 0=연구).
      return false;
    }

    // 원자적 적용: D 차감 → 구매 기록.
    s.resources.D_current = sub(s.resources.D_current, D(r.node.costD));
    s.research.purchased.add(r.node.id);
    // 공명 강화 노드(창/콤보 상한)를 orbital에 즉시 반영(파생 — 저장 안 함).
    this.applyResonanceConfig();

    bus.emit('research_purchased', { nodeId: r.node.id, branch: r.node.branch });
    this.notify();
    return true;
  }

  /** research.purchased에서 공명 강화(창/콤보 상한)를 계산해 orbital에 주입. 로드/구매 시 호출. */
  private applyResonanceConfig(): void {
    const p = getState().research.purchased;
    getState().mechanics.orbital.configure(
      resonanceWindowBonus(p),
      resonanceComboMaxBonus(p),
    );
  }

  /**
   * 층 진입·도감 발견 판정(M1.3). tick 끝과 오프라인 적용 후 공용.
   *  - 알려진 물리 5층: dec가 새 층 임계 도달 시 currentIndex 갱신 + layerEnter 발행(무상전이).
   *  - 도감: dec ≥ unlockDec 인 입자 발견(영구) + codexDiscover 발행. LEGENDARY는 층 완성 시.
   * 멱등 안전: 이미 도달한 층/발견한 입자는 다시 발화하지 않는다(상태가 기억).
   */
  private processProgression(dec: number): void {
    const s = getState();

    // 전 생애 최대 dec 갱신(상전이 C 리셋을 넘어 유지 — 통계 "가장 깊이"). 표시 전용, 경제 불변.
    if (dec > s.stats.maxDec) s.stats.maxDec = dec;

    // 층 진입(알려진 물리). 오프라인 점프로 여러 층을 건너뛰어도 각 진입을 순서대로 발행.
    const entered = layersEnteredSince(s.layers.currentIndex, dec);
    if (entered.length > 0) {
      s.layers.currentIndex = entered[entered.length - 1];
      for (const idx of entered) {
        bus.emit('layerEnter', { layer: idx, sublayer: 0 });
      }
    }

    // 도감 발견(알려진 물리 L1~L5 — dec 게이트). 새로 발견된 ID만 집합에 추가 + 이벤트 발행.
    const newly = evaluateDiscoveries(dec, s.codex.discovered);
    for (const id of newly) {
      s.codex.discovered.add(id);
      // 발견 = 데이터(연구소 컨셉). 희귀도별 D 지급 → L1부터 연구 연료 확보.
      const rarity = particleById(id)?.rarity;
      if (rarity) this.addDiscovery(DISCOVERY_D_BY_RARITY[rarity]);
      bus.emit('codexDiscover', { particleId: id });
    }

    // 미지 서브층 발견(L6 프리온·L7 끈 — 메커니즘 게이트, M1.6). 위상 누적시간·하모닉 공명수로 판정.
    //   상전이 후 C 리셋(dec=0)이라 dec 게이트 부적합 → 메커니즘 상태가 발견 경로(필러 ④ 미지 첫 결).
    this.evaluateUnknownDiscoveries(dec);

    // 관측 목표(업적) 판정 — 영속 상태 파생. 새로 달성분만 집합 추가 + 이벤트 발행(멱등).
    this.evaluateAchievementProgress();

    // 상전이 가능 판정(M1.5). 미지 벽(dec19~26) 도달 + 미실행 상전이가 있으면 점등.
    //   prestige_ready는 가능 상태 진입 순간 1회만(UI 탭 점등·사운드). 멱등 — 매 tick 재발화 안 함.
    const pIndex = nextPrestigeIndex(dec, s.prestige.count);
    const bigCrunch = pIndex < 1 && isBigCrunchAvailable(dec, s.prestige.count);
    if (pIndex >= 1 || bigCrunch) {
      if (!this.prestigeReadyEmitted) {
        this.prestigeReadyEmitted = true;
        const previewQF = bigCrunch
          ? previewBigCrunch(dec, s.prestige.count, s.prestige.runIndex, s.resources.lifetime_C, s.prestige.qfClaimed)?.qfGain
          : previewPrestige(dec, s.prestige.count, s.resources.lifetime_C, s.prestige.qfClaimed)?.qfGain;
        bus.emit('prestige_ready', {
          prestigeIndex: bigCrunch ? 7 : pIndex,
          previewQF: (previewQF ?? ZERO).toString(),
        });
      }
    } else {
      // 벽 미도달(또는 상전이 실행으로 해소) → 가드 해제(다음 벽에서 재발화 가능).
      this.prestigeReadyEmitted = false;
    }
  }

  /**
   * 미지 서브층(L6 프리온·L7 끈) 메커니즘 발견 판정(systems §2-E·§2-F, M1.6). tick·오프라인 후 공용.
   *  현재 진입 미지 층의 메커니즘 상태(위상 누적시간·하모닉 공명수·dec)로 입자를 발견한다.
   *  알려진 물리(L1~L5)에선 미지 메커니즘이 비활성이라 호출돼도 빈 결과(currentIndex < 6).
   *  멱등: 이미 발견한 입자는 재발화 안 함(codex 모듈이 집합 비교).
   * @param dec 현재 dec(미지 층 내 후반 입자 decade 게이트용 — 위상 진공 등).
   */
  private evaluateUnknownDiscoveries(dec: number): void {
    const s = getState();
    const layerIndex = s.layers.currentIndex;
    if (layerIndex < 6) return; // 알려진 물리 구간 — 미지 메커니즘 없음.

    const ctx = {
      phaseTimes: this.isPhaseActive() ? s.mechanics.phase.getStateTimes() : undefined,
      harmonicResonances: this.isHarmonicsActive()
        ? s.mechanics.harmonics.getTotalResonances()
        : undefined,
      dec,
    };
    const newly = evaluateMechDiscoveries(layerIndex, ctx, s.codex.discovered);
    for (const id of newly) {
      s.codex.discovered.add(id);
      const rarity = particleById(id)?.rarity;
      if (rarity) this.addDiscovery(DISCOVERY_D_BY_RARITY[rarity]);
      bus.emit('codexDiscover', { particleId: id });
    }
  }

  /**
   * 관측 목표(업적) 판정. 영속 상태로 컨텍스트를 만들어 새로 달성된 목표만 집합에 추가·발행(멱등).
   *  ★순수 인정형 — 생산·경제 미관여(§13 가드레일). 큰 수는 log10(number)로 환산해 전달(Decimal 미유입).
   */
  private evaluateAchievementProgress(): void {
    const s = getState();
    const c = s.resources.lifetime_C;
    const d = s.resources.D_lifetime;
    const ctx: AchievementContext = {
      maxDec: s.stats.maxDec,
      maxLayerIndex: s.layers.currentIndex,
      prestigeCount: s.prestige.count,
      runIndex: s.prestige.runIndex,
      codexCollected: discoverableCollected(s.codex.discovered),
      codexCompletion: codexCompletion(s.codex.discovered),
      researchCount: s.research.purchased.size,
      manualCompresses: s.stats.manualCompresses,
      totalBinds: s.stats.totalBinds,
      lifetimeCLog10: c.gt(0) ? c.log10().toNumber() : 0,
      lifetimeDLog10: d.gt(0) ? d.log10().toNumber() : 0,
    };
    const newly = evaluateAchievements(ctx, s.achievements.earned);
    for (const id of newly) {
      s.achievements.earned.add(id);
      bus.emit('achievement_earned', { id });
    }
  }

  /**
   * 위상 상태 고정(systems §2-E 능동 개입, M1.6). 지정 상태로 E 1회 소모하고 자동 순환을 멈춘다.
   *  비용 = 현재 dC/dt의 PIN_COST_SECONDS초 분량 E. 부족하면 무시(피드백만). 프리온층 미진입 시 무시.
   * @param state 고정할 위상 상태.
   * @returns 고정 성공 여부(UI 주스 분기).
   */
  pinPhase(state: PhaseState): boolean {
    if (!this.isPhaseActive()) return false;
    const s = getState();
    const cost = this.phasePinCost();
    if (s.resources.E.lt(cost)) {
      bus.emit('phase_pin_failed', { state });
      return false;
    }
    s.resources.E = sub(s.resources.E, cost);
    s.mechanics.phase.pin(state);
    bus.emit('phase_pinned', { state });
    this.notify();
    return true;
  }

  /** 위상 고정 해제(무료, systems §2-E). 다시 자동 순환. 프리온층 미진입 시 무시. */
  unpinPhase(): void {
    if (!this.isPhaseActive()) return;
    getState().mechanics.phase.unpin();
    bus.emit('phase_unpinned', {});
    this.notify();
  }

  /** 위상 고정 1회 E 비용(현재 dC/dt 기반 — 체인 강할수록 절대비용↑이나 상대비용 일정). */
  private phasePinCost(): Decimal {
    const s = getState();
    const mult = productionMult(s.resources.QF);
    const owned = composeOwned(s.chain.bought, s.chain.produced);
    // dC/dt(=g1·mult)의 PIN_COST_SECONDS초 분량. 체인이 비면(불가능 — 프리온층은 체인 보유) 0.
    return owned[0].mul(mult).mul(PHASE_OVERLAP.PIN_COST_SECONDS);
  }

  /**
   * 압축기 구매(system-flows §2.1, 닫힌형). tier=1-기반(1..8).
   *   E ≥ 비용이면 원자적으로 E 차감 + bought 증가. 캐시 무효화 없음(파생은 매 tick 재계산).
   * @returns 실제 구매 수량(0이면 자원 부족).
   */
  buy(tier: number, mode: BuyMode): number {
    if (tier < 1 || tier > CHAIN_TIERS) return 0;
    const s = getState();
    const idx = tier - 1;
    const owned = s.chain.bought[idx];
    const target = mode === 'max' ? -1 : mode;

    const plan = planBuy(tier, owned, s.resources.E, target);
    if (plan.count <= 0) {
      bus.emit('buy_failed', { tier });
      return 0;
    }

    // 원자적 적용(§2.1 단계 3): E 차감 → bought 증가.
    s.resources.E = sub(s.resources.E, plan.cost);
    s.chain.bought[idx] = owned + plan.count;
    s.stats.totalBinds += plan.count; // 통계: 누적 결속 수(표시 전용).

    bus.emit('chain_purchased', { tier, count: plan.count });
    this.notify();
    return plan.count;
  }

  /**
   * 수동 압축(ui-flow §2 '압축' 버튼, systems §4-2 능동 손맛). 클릭당 현재 dC/dt의
   *   CLICK_SECONDS초 분량을 즉시 가산. "클릭은 체인 위에 더해지는 구조, 대체 아님."
   *   배율은 공명 포함 현재 유효 배율을 적용해 클릭도 공명의 혜택을 받게 한다(일관성).
   */
  manualCompress(times = 1): void {
    const s = getState();
    const n = Math.max(1, Math.floor(times));
    // n회 압축을 한 번의 notify/draw로 배치 — 스윕/드래그가 한 입력에 여러 셀을 흡수해도
    //   렌더는 1회만(구: 셀마다 notify→동기 draw로 메인스레드 블록 = "느려지다 멈춤" 원인).
    //   경제는 n회 개별 호출과 동일(각 반복이 갱신된 owned/C로 rate 재계산 = 결정적 동형).
    for (let k = 0; k < n; k++) {
      const baseMult = productionMult(s.resources.QF);
      // 현재 활성 메커니즘 배율도 클릭에 반영(메커니즘 중엔 클릭도 더 강함 — 곱 구조 일관).
      const resonanceMult = this.isResonanceActive() ? s.mechanics.orbital.getMultiplier() : 1;
      const phaseMult = this.isPhaseActive() ? s.mechanics.phase.getMultiplier() : 1;
      let mult = baseMult;
      if (resonanceMult > 1) mult = mult.mul(resonanceMult);
      if (phaseMult > 1) mult = mult.mul(phaseMult);
      const owned = composeOwned(s.chain.bought, s.chain.produced);
      // 연구 T1 체인증폭(M1.7)도 클릭에 반영(곱 구조 일관). C안 — 체인 내부 배율.
      const researchT1 = chainTierMultipliers(s.research.purchased)[0];
      let clickRate = owned[0].mul(mult);
      if (researchT1 !== 1) clickRate = clickRate.mul(researchT1);
      // 연구 click_power(관측 집중/정밀)도 클릭에 반영 — 만지기 파워↑(자동 생산 레이스와 분리).
      const clickPower = clickPowerMultiplier(s.research.purchased);
      if (clickPower !== 1) clickRate = clickRate.mul(clickPower);
      const bump = clickRate.mul(MANUAL_COMPRESS.CLICK_SECONDS);
      s.resources.C = add(s.resources.C, bump);
      s.resources.E = add(s.resources.E, bump);
      s.resources.lifetime_C = add(s.resources.lifetime_C, bump);
    }
    // dec는 C에 단조 — 배치 후 최종 C로 1회 동기화(층/도감). 중간 마일스톤도 최종 dec가 포섭.
    this.processProgression(computeDec(s.resources.C));
    s.stats.manualCompresses += n; // 통계: 누적 수동 압축(표시 전용).
    bus.emit('manual_compress', {}); // SFX(55ms 스로틀) — 배치 1회로 충분.
    this.notify();
  }

  /**
   * 오비탈 공명 슬롯 클릭(ui-flow §2-E, systems §2-A 능동 개입). 열린 슬롯이면 성공 —
   *   공명 배율 ×1.5 + D 획득. 닫힌 슬롯이면 실패(페널티 없음, "놓쳐도 진행 계속").
   *   원자층 미진입 시엔 무시(위젯 자체가 안 보임).
   * @returns 성공 여부(UI 주스 분기).
   */
  clickResonance(): boolean {
    if (!this.isResonanceActive()) return false;
    const s = getState();
    const r = s.mechanics.orbital.click();
    if (r.success && r.dGained > 0)
      this.addDiscovery(r.dGained * resonanceDMultiplier(s.research.purchased));
    bus.emit('resonance_click', { success: r.success });
    this.notify();
    return r.success;
  }

  /**
   * 현재 활성 층 정의(M1.5). 알려진 물리(L1~L5)는 dec에서 파생, 미지 서브층(L6+)은
   *   state.layers.currentIndex가 진실(상전이로 진입 — C가 리셋돼 dec=0이라 dec 파생 불가).
   *   즉 상전이 후엔 currentIndex(=6 프리온 등)가 dec 파생 층을 덮어쓴다.
   */
  private activeLayer(dec: number): LayerDefinition {
    const s = getState();
    // 미지 진입(상전이 1회 이상 + currentIndex가 알려진 물리 상한 초과) → currentIndex 기준.
    if (s.layers.currentIndex > LAST_KNOWN_LAYER_INDEX) {
      return layerByIndex(s.layers.currentIndex) ?? currentLayer(dec);
    }
    return currentLayer(dec);
  }

  /**
   * 다음 상전이 미리보기(현재 상태 기준). UI 상전이 화면·스냅샷 공용(없으면 null).
   *   순수 계산 — 상태를 바꾸지 않는다. dec는 현재 C에서 파생.
   */
  private currentPreview(dec: number): PrestigePreview | null {
    const s = getState();
    return previewPrestige(dec, s.prestige.count, s.resources.lifetime_C, s.prestige.qfClaimed);
  }

  /**
   * 상전이 실행(system-flows §4.1, M1.5 첫 상전이 PT1). 플레이어가 상전이 화면 "진입" 클릭 시.
   *   1. 미리보기로 QF·진입 층 계산(가능하지 않으면 무시 — 이중 클릭/미도달 방어).
   *   2. 리셋 매트릭스 적용(systems §5-2): E·C·체인 리셋 / lifetime_C·QF·도감·연구·D_lifetime 보존.
   *   3. QF 확정 → production_mult 부스트 영구 적용(= 1 + 0.25·log₁₀(1+QF)).
   *   4. 미지 서브층 진입(currentIndex 갱신) + §3.3 오프라인 보너스 플래그 설정.
   *   5. 이벤트 발행(prestige) + 상전이 비트(narrative) → UI 토스트·로그.
   *
   * @returns 실행된 PrestigePreview(성공) 또는 null(불가).
   */
  executePrestige(): PrestigePreview | null {
    const s = getState();
    const dec = computeDec(s.resources.C);
    const preview = this.currentPreview(dec);
    if (!preview) return null; // 미도달/이중 클릭 방어(§4.3 이중 상전이 방지).

    // 리셋 매트릭스 적용(순수 계산 → 결과로 state 교체). lifetime_C·도감·연구·D_lifetime은 보존(미변경).
    const reset = applyPrestigeReset(preview, s.resources.QF, s.prestige.count, seedBought);

    // --- 리셋: E·C·체인 보유수(systems §5-2) ---
    s.resources.E = reset.E;
    s.resources.C = reset.C;
    s.chain.bought = reset.bought;
    s.chain.produced = reset.produced;

    // --- D_current: 첫 상전이(run_index 1) = 0 리셋(첫 런 보존율 없음, system-flows §4.1) ---
    //   회차 곡선 보존(2회차 65% 등)은 빅 크런치 재하강(M3). 여기선 단순 0.
    s.resources.D_current = ZERO;

    // --- 보존·확정: QF 누적, qfClaimed 확정(production_mult 부스트 영구) ---
    s.resources.QF = reset.QF;
    s.prestige.qfClaimed = reset.qfClaimed;
    s.prestige.count = reset.count;

    // --- 미지 서브층 진입(프리온 등). currentIndex가 dec 파생 층을 덮어쓴다(activeLayer 참조) ---
    s.layers.currentIndex = reset.layerIndex;

    // --- 층별 메커니즘 상태 리셋(systems §5-2 "층별 메커니즘 상태 = 리셋", M1.6) ---
    //   새 미지 서브층 런은 메커니즘이 깨끗한 상태에서 시작(위상 응집·V=0). 도감 발견(discovered)은
    //   영구 보존이라 이미 발견한 프리온/끈은 재발견 안 됨(멱등) — 메커니즘 *진행*만 리셋.
    s.mechanics.phase = new PhaseOverlap();
    s.mechanics.harmonics = new Harmonics();
    // 오비탈 공명도 런 메커니즘이나 미지 진입 후엔 비활성(L2 위젯 미표시) — 리셋 불요(상태 무해).

    // --- §3.3 오프라인 보너스 1회성 플래그(상전이 직후 첫 오프라인 modifier=1.0) ---
    s.prestige.offlineBonusPending = true;

    // 상전이 해소 → prestige_ready 가드 해제(다음 벽 도달 시 재점등 가능).
    this.prestigeReadyEmitted = false;

    // --- 이벤트·내러티브 발행(system-flows §4.1 단계 8) ---
    bus.emit('prestige', {
      count: reset.count,
      prestigeIndex: preview.prestigeIndex,
      layer: reset.layerIndex,
      qfGain: preview.qfGain.toString(),
    });
    // 상전이 실행 로그(상태 로그 1줄) + 진입 비트(narrative §5-B).
    const beat = prestigeBeat(preview.prestigeIndex);
    const execLine = prestigeExecLog(formatNumber(preview.qfGain, 0), preview.targetLayer.nameKo);
    bus.emit('prestige_beat', {
      prestigeIndex: preview.prestigeIndex,
      execLine,
      beatLines: beat ? beat.lines : [],
      isFirst: reset.count === 1,
    });

    this.notify();
    return preview;
  }

  /**
   * 빅 크런치(PT7) 실행 = 재하강(economy §4.4·§7.3·§7.4). 플레이어가 재하강 확인 시.
   *   1. 미리보기(K=1.05 QF). 불가면 무시(이중 클릭 방어).
   *   2. 재하강 리셋(applyBigCrunchReset): E·C·체인·**층(→분자)**·**count(→0)** 리셋 /
   *      lifetime_C·QF(가산)·도감·연구·D_lifetime 보존 / **D_current × 회차곡선** / runIndex+1.
   *   3. 모든 층별 메커니즘 리셋(오비탈 포함 — 분자층 재시작이므로 오비탈도 초기화).
   *   4. bigCrunch 이벤트 + 재하강 비트(종착점 언어 금지 — "다시 내려간다").
   * @returns 실행 성공 여부(UI 패널 닫기 분기).
   */
  executeBigCrunch(): boolean {
    const s = getState();
    const dec = computeDec(s.resources.C);
    const preview: BigCrunchPreview | null = previewBigCrunch(
      dec,
      s.prestige.count,
      s.prestige.runIndex,
      s.resources.lifetime_C,
      s.prestige.qfClaimed,
    );
    if (!preview) return false;

    const reset = applyBigCrunchReset(
      preview,
      s.resources.QF,
      s.resources.D_current,
      s.prestige.runIndex,
      seedBought,
    );

    // 리셋: E·C·체인·층(→분자)·count(→0, 벽 재통과).
    s.resources.E = reset.E;
    s.resources.C = reset.C;
    s.chain.bought = reset.bought;
    s.chain.produced = reset.produced;
    s.layers.currentIndex = reset.layerIndex; // 분자층 dec0 재시작
    s.prestige.count = reset.count;
    s.prestige.runIndex = reset.runIndex;

    // 보존·확정: QF 가산, qfClaimed 확정(K=1.05), D_current 회차곡선 보존(lifetime_C·D_lifetime·도감·연구 불변).
    s.resources.QF = reset.QF;
    s.prestige.qfClaimed = reset.qfClaimed;
    s.resources.D_current = reset.dCurrent;

    // 전 메커니즘 리셋(분자층 재시작 — 오비탈/위상/하모닉 전부 새 인스턴스).
    s.mechanics.orbital = new OrbitalResonance();
    s.mechanics.phase = new PhaseOverlap();
    s.mechanics.harmonics = new Harmonics();

    s.prestige.offlineBonusPending = true; // §3.3 재하강 직후 첫 오프라인 modifier=1.0
    this.prestigeReadyEmitted = false;

    // 진행 동기화(dec0 재시작 — 분자 재발견은 멱등, 이미 도감 보존).
    this.processProgression(computeDec(s.resources.C));

    bus.emit('bigCrunch', { runIndex: reset.runIndex });
    // 재하강 비트(종착점 언어 금지, narrative §5-B — "재압축/유지/더 작은 것"). 첫 빅 크런치는 legendary.
    bus.emit('prestige_beat', {
      prestigeIndex: 7,
      execLine: bigCrunchExecLog(formatNumber(preview.qfGain, 0), reset.runIndex),
      beatLines: [...BIG_CRUNCH_BEAT],
      isFirst: reset.runIndex === 1,
    });

    this.notify();
    return true;
  }

  /**
   * 결정적 시간 전진(초). 테스트·오프라인·dev 검증용 — rAF 없이 고정 dt tick을 직접 돌린다.
   * (백그라운드 탭에서 rAF가 스로틀돼도 동일 로직을 재현. system-flows §12.1 결정성.)
   */
  advance(seconds: number): void {
    this.loop.advance(seconds);
    this.notify();
  }

  /** 현재 상태 → 표시 스냅샷(파생 계산은 여기서, 저장 안 함 §1.1). */
  snapshot(): GameSnapshot {
    const s = getState();
    const mult = productionMult(s.resources.QF);
    const owned = composeOwned(s.chain.bought, s.chain.produced);

    // 연구 체인증폭 티어 배율(M1.7, C안). 표시 생산율에 반영(체인 내부 배율 — 실제 tick과 일치).
    //   하모닉(끈층)은 burst 순간 배율이라 정적 표시엔 미반영(체인 테이블은 연구 정적 배율만).
    const researchTierMult = chainTierMultipliers(s.research.purchased);

    const tiers: TierSnapshot[] = [];
    for (let i = 0; i < CHAIN_TIERS; i++) {
      const tier = i + 1;
      const nextCost = tierCost(tier, s.chain.bought[i]);
      // 해금: T1 항상, 그 외 직전 티어 보유 ≥1 (ui-flow §2-D +1 노출 규칙).
      const unlocked = i === 0 || owned[i - 1].gt(0) || s.chain.bought[i] > 0;
      // 표시 생산율: 전역 mult × 연구 티어 배율(해당 티어 강화 시). 미강화 티어는 ×1.
      let rate = tierProductionRate(i, owned, mult);
      if (researchTierMult[i] !== 1) rate = rate.mul(researchTierMult[i]);
      tiers.push({
        tier,
        bought: s.chain.bought[i],
        owned: owned[i],
        nextCost,
        rate,
        affordable: s.resources.E.gte(nextCost),
        unlocked,
      });
    }

    const dec = computeDec(s.resources.C);
    // 활성 층: 알려진 물리는 dec 파생, 미지(상전이 진입)는 currentIndex(프리온 등)가 진실.
    const def: LayerDefinition = this.activeLayer(dec);
    // decade 진행 바(표시 전용 — 로직 불변, ux-overhaul §P1-3).
    const [decadeProg, decadeBar] = deriveDecadeProgress(def, dec);
    const discovered = s.codex.discovered;

    // T1 첫 구매 가능 여부(FTUE 체인 노출 게이트).
    const t1NextCost = tierCost(1, s.chain.bought[0]);
    const hasBoughtAnyTier = s.chain.bought.some((b, i) => b > (i === 0 ? 1 : 0)); // T1 시드 1 제외
    // D 보유: 현재 런 또는 lifetime(상전이로 D_current=0이 돼도 연구 탭은 영구 유지 — D_lifetime).
    const hasDiscoveryData = s.resources.D_current.gt(0) || s.resources.D_lifetime.gt(0);
    const ftue = deriveFtue({
      hasBoughtAnyTier,
      canAffordFirstTier: s.resources.E.gte(t1NextCost),
      discoveredCount: discovered.size,
      layerIndex: s.layers.currentIndex,
      hasPrestiged: s.prestige.count > 0,
      hasDiscoveryData,
    });

    // 연구 화면 스냅샷(M1.7). 해금(첫 D + 원자층) + 노드별 D 충분 판정.
    const researchUnlocked = isResearchUnlocked(s.layers.currentIndex, hasDiscoveryData);
    const research = researchSnapshot(s.research.purchased, researchUnlocked, (costD) =>
      s.resources.D_current.gte(costD),
    );

    // 오비탈 공명 위젯 상태(원자층 L2+ 활성). 표시 전용 — 메커니즘 인스턴스 직접 질의.
    //   미지 진입(L6+) 후엔 오비탈 위젯 비표시(active=false) — 미지 메커니즘이 그 자리를 차지.
    const resonanceActive = s.layers.currentIndex >= 2 && s.layers.currentIndex < 6;
    const orbital = s.mechanics.orbital;
    const resonance: ResonanceSnapshot = {
      active: resonanceActive,
      phase: orbital.getPhase(),
      progress: orbital.getPhaseProgress(),
      multiplier: orbital.getMultiplier(),
      combo: orbital.getCombo(),
    };

    // 위상 겹침 위젯 상태(프리온층 L6+ 활성, M1.6). 표시 전용.
    const phaseActive = s.layers.currentIndex >= 6;
    const phaseM = s.mechanics.phase;
    const phase: PhaseSnapshot = {
      active: phaseActive,
      state: phaseM.getState(),
      pinned: phaseM.isPinned(),
      cycleProgress: phaseM.getCycleProgress(),
      multiplier: phaseActive ? phaseM.getMultiplier() : 1,
      pinCost: phaseActive ? this.phasePinCost() : ZERO,
      times: phaseM.getStateTimes(),
    };

    // 진동 하모닉스 위젯 상태(끈층 L7+ 활성, M1.6). 표시 전용.
    const harmonicsActive = s.layers.currentIndex >= 7;
    const harm = s.mechanics.harmonics;
    const tierMults = harm.getTierMultipliers();
    const harmonics: HarmonicsSnapshot = {
      active: harmonicsActive,
      chargeProgress: harm.getChargeProgress(),
      nextTier: harm.getNextResonantTier(),
      totalResonances: harm.getTotalResonances(),
      burstingTiers: harmonicsActive
        ? tierMults.map((m, i) => (m > 1 ? i + 1 : 0)).filter((t) => t > 0)
        : [],
    };

    // 표시용 유효 배율: QF항 × 활성 공명 배율 × 활성 위상 배율(체인에 실제 적용되는 전체 곱과 일치).
    //   (하모닉 티어 배율은 티어별 — 전체 표시 배율엔 미반영. 체인 테이블 rate가 개별 반영.)
    let displayMult = mult;
    if (resonanceActive && resonance.multiplier > 1) displayMult = displayMult.mul(resonance.multiplier);
    if (phaseActive && phase.multiplier > 1) displayMult = displayMult.mul(phase.multiplier);

    // 상전이 스냅샷(M1.5). 미지 벽 도달 시만 점등. 미리보기로 QF 획득량·진입 층 계산.
    //   빅 크런치(PT7)는 6벽 소진 + 플랑크 dec26 재도달 시 — 재하강 프레이밍(targetLayer=분자층, K=1.05).
    const preview = this.currentPreview(dec);
    const bcPreview = preview
      ? null
      : previewBigCrunch(dec, s.prestige.count, s.prestige.runIndex, s.resources.lifetime_C, s.prestige.qfClaimed);
    const prestige: PrestigeSnapshot = preview
      ? {
          available: true,
          prestigeIndex: preview.prestigeIndex,
          qfGain: preview.qfGain,
          qfTotal: preview.qfTotal,
          // 상전이 후 적용될 부스트(QF_total 기준). 현재 표시 배율과 별개 — "다음 런 배율".
          nextMult: productionMult(preview.qfTotal),
          targetLayerKo: preview.targetLayer.nameKo,
          targetLayerEn: preview.targetLayer.nameEn,
          isFirst: s.prestige.count === 0, // 첫 상전이(아직 0회) → 특별 연출.
          isBigCrunch: false,
          count: s.prestige.count,
        }
      : bcPreview
        ? {
            available: true,
            prestigeIndex: 7,
            qfGain: bcPreview.qfGain,
            qfTotal: bcPreview.qfTotal,
            nextMult: productionMult(bcPreview.qfTotal),
            targetLayerKo: layerByIndex(1)?.nameKo ?? '분자층',
            targetLayerEn: layerByIndex(1)?.nameEn ?? 'Molecule',
            isFirst: s.prestige.runIndex === 0, // 첫 빅 크런치 특별 연출.
            isBigCrunch: true,
            count: s.prestige.count,
          }
        : {
            available: false,
            prestigeIndex: 0,
            qfGain: ZERO,
            qfTotal: s.prestige.qfClaimed,
            nextMult: mult,
            targetLayerKo: '',
            targetLayerEn: '',
            isFirst: s.prestige.count === 0,
            isBigCrunch: false,
            count: s.prestige.count,
          };

    // 표시 dC/dt: 전역 displayMult × 연구 T1 배율(체인 내부 — 실제 C 생산율과 일치).
    let rateC = owned[0].mul(displayMult);
    if (researchTierMult[0] !== 1) rateC = rateC.mul(researchTierMult[0]);

    // 렌더 전용 파생(V2-8, 읽기 전용): 렌더러가 Decimal을 만지지 않도록 number/boolean로 환산.
    //   rateCPositive=맥동·파티클 활성 조건, rateCLog10=파티클 속도 로그압축 매핑(log10 1회/프레임).
    const rateCPositive = rateC.gt(0);
    const rateCLog10 = rateCPositive ? rateC.log10().toNumber() : 0;

    return {
      C: s.resources.C,
      E: s.resources.E,
      D: s.resources.D_current,
      QF: s.resources.QF,
      dec,
      r: computeRadius(s.resources.C),
      mult: displayMult,
      rateC,
      rateCPositive,
      rateCLog10,
      tiers,
      layer: {
        index: def.index,
        slug: def.slug,
        nameKo: def.nameKo,
        nameEn: def.nameEn,
        mechanismNameKo: def.mechanismNameKo,
        scaleM: def.scaleM,
        decadeRange: def.decadeRange,
        // decade 진행 바(표시 전용 파생 — 로직 불변): 층 enterDec→다음 층 enterDec 구간 정규화.
        decadeProgress: decadeProg,
        decadeBarRange: decadeBar,
        nearBoundary: isNearKnownBoundary(dec),
      },
      codex: {
        discovered,
        collected: discoverableCollected(discovered),
        denominator: CODEX_DENOMINATOR,
        completion: codexCompletion(discovered),
        layerCompletions: knownLayerCompletions(discovered),
        maxLayerReached: s.layers.currentIndex,
      },
      resonance,
      phase,
      harmonics,
      prestige,
      research,
      ftue,
      offline: this.offlineSnapshot,
      totalTicks: this.loop.totalTicks,
      loadKind: this.loadKind,
      notation: s.settings.notation,
      stats: {
        manualCompresses: s.stats.manualCompresses,
        totalBinds: s.stats.totalBinds,
        maxDec: s.stats.maxDec,
        playtimeSeconds: s.meta.totalPlaytime,
        prestigeCount: s.prestige.count,
        runIndex: s.prestige.runIndex,
        lifetimeC: s.resources.lifetime_C,
        lifetimeD: s.resources.D_lifetime,
        researchCount: s.research.purchased.size,
        maxLayerIndex: s.layers.currentIndex,
      },
      achievements: {
        earned: s.achievements.earned,
        count: s.achievements.earned.size,
        total: ACHIEVEMENT_TOTAL,
      },
    };
  }

  /** 새 게임으로 리셋(설정/디버그용). createInitialState로 교체 후 통지. */
  resetToFresh(): void {
    setState(createInitialState());
    this.loadKind = 'fresh';
    this.prestigeReadyEmitted = false; // 상전이 가드 초기화(M1.5).
    this.offlineSnapshot = null; // 오프라인 모달 소거(M1.7).
    // dec0에서 물 분자(unlockDec 0) 즉시 발견 → 시작부터 도감 1개(FTUE 도감 탭 등장).
    this.processProgression(computeDec(getState().resources.C));
    this.notify();
  }

  /** 즉시 저장(autoSave·언로드 시). lastSave 갱신 후 봉투 기록(§1.7). */
  async persist(): Promise<void> {
    const s = getState();
    s.meta.lastSave = Date.now();
    await this.save.save(s);
    bus.emit('saved', { at: s.meta.lastSave });
  }

  /** 내보내기(§1.8 Base64 export 자리 — 봉투 그대로). */
  exportSave(): string {
    return this.save.exportSave(getState());
  }

  /** 가져오기(§1.8). 검증 실패 시 throw → UI가 처리. */
  importSave(raw: string): void {
    const next: GameState = this.save.importSave(raw);
    setState(next);
    this.notify();
  }

  /**
   * 표기법 설정 변경(설정 패널). state.settings에 기록 + 표시 전역 기본 갱신 + 즉시 저장·통지.
   *   표시 전용 — 경제·수식 불변. 저장으로 다음 로드에도 유지.
   */
  setNotation(n: NotationKind): void {
    const s = getState();
    if (s.settings.notation === n) return;
    s.settings.notation = n;
    setDefaultNotation(n);
    void this.persist();
    this.notify();
  }

  // --- 구독(Svelte 단방향, §4.1) ---------------------------------------------
  subscribe(fn: SnapshotListener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }

  /** 정리(누수 방지 §6.1). */
  dispose(): void {
    this.loop.stop();
    this.listeners.clear();
  }
}

/** 페이지 언로드 시 마지막 저장(세이브 안전, §6.1 안전벨트). */
export function installUnloadSave(game: Game): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeunload', () => {
    // 동기 경로 보장 위해 fire-and-forget(localStorage는 동기).
    void game.persist();
  });
}

// 디버그용 상수 노출(검증 시 콘솔에서 확인).
export { TICK_DT } from './core/loop';
export { D };
