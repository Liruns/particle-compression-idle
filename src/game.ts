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

import { Decimal, D, add, sub } from './core/bignum';
import { getState, setState, createInitialState, CHAIN_TIERS, type GameState } from './core/state';
import type { SlotPhase } from './core/layers/mechanics';
import { MANUAL_COMPRESS } from './data/constants';
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
  type LayerDefinition,
} from './core/layers';
import {
  evaluateDiscoveries,
  knownLayerCompletions,
  codexCompletion,
  discoverableCollected,
  CODEX_DENOMINATOR,
  type LayerCompletion,
} from './core/codex';
import { deriveFtue, type FtueState } from './core/ftue';

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
  /** 8단 체인 각 티어 표시 정보. */
  tiers: TierSnapshot[];
  /** 현재 층(M1.3). */
  layer: LayerSnapshot;
  /** 도감(M1.3). */
  codex: CodexSnapshot;
  /** 오비탈 공명 위젯(M1.4 — 원자층 L2). */
  resonance: ResonanceSnapshot;
  /** FTUE 점진 공개 상태(M1.3). */
  ftue: FtueState;
  totalTicks: number;
  loadKind: LoadResult['kind'];
}

/** snapshot 구독자(Svelte가 등록). */
type SnapshotListener = (snap: GameSnapshot) => void;

/** 대량구매 모드: 1개 / 10개 / 100개 / Max(전액). (ui-flow §2-D, system-flows §2.1) */
export type BuyMode = 1 | 10 | 100 | 'max';

export class Game {
  private readonly platform: PlatformAdapter;
  private readonly save: SaveManager;
  private readonly loop: GameLoop;
  private readonly scheduler = new Scheduler();
  private listeners = new Set<SnapshotListener>();
  private loadKind: LoadResult['kind'] = 'fresh';

  constructor() {
    this.platform = detectPlatform();
    this.save = new SaveManager(this.platform.createStorageAdapter());

    // F3: 고정 timestep 루프. tick=로직, render=표현(스냅샷 통지).
    this.loop = new GameLoop({
      tick: (dt) => this.tick(dt),
      render: () => this.notify(),
      // catch-up 상한 초과분은 지금은 폐기(오프라인 적용은 M1.7).
      onOverflow: (s) => {
        // TODO(M1.7): offline.computeOffline로 일괄 반영.
        void s;
      },
    });
  }

  /** 부팅: 세이브 로드 → 스케줄러(autoSave/everySecond) → 루프 시작. */
  async start(): Promise<void> {
    await this.platform.init();

    const result = await this.save.load();
    this.loadKind = result.kind;
    setState(result.state);

    // 부팅 직후 진행 동기화(M1.3): 로드된 dec 기준 층/도감을 즉시 정합.
    //  - 새 게임(dec0): 물 분자(unlockDec 0) 즉시 발견 가능 → 시작부터 도감 1개.
    //  - 로드 세이브: 발견 누락분 보충(데이터 추가/조건 단순화로 새로 해금된 입자 흡수).
    //  멱등이므로 이미 기록된 것은 재발화 안 함.
    this.processProgression(computeDec(getState().resources.C));

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

    // 1. 프레스티지 배율(현재 QF만 — holographic/research는 M1.6+).
    const baseMult = productionMult(s.resources.QF);

    // 1b. 오비탈 공명(원자층 L2+, systems §2-A). 슬롯 전진 + 배율·D 산출.
    //     공명 배율은 체인 production에 곱해진다(§2-A "체인 전체에 곱"). 분자층(L1)에선 비활성.
    const resonanceMult = this.updateResonance(dt);
    const mult = resonanceMult > 1 ? baseMult.mul(resonanceMult) : baseMult;

    // 2. 8단 체인 생산(역순 단일 패스, engine.py 동형). 공명 배율 반영된 mult로 생산.
    const { dC, dE, produced } = chainTick(s.chain.bought, s.chain.produced, mult, dt);
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

    const r = s.mechanics.orbital.update(dt);
    if (r.dGained > 0) this.addDiscovery(r.dGained);
    if (r.slotOpened) bus.emit('resonance_slot_open', {});
    if (r.autoResonated) bus.emit('resonance_auto', {});
    return s.mechanics.orbital.getMultiplier();
  }

  /** 오비탈 공명 활성 조건: 원자층(L2) 이상 도달(layers.currentIndex ≥ 2). */
  private isResonanceActive(): boolean {
    return getState().layers.currentIndex >= 2;
  }

  /** D(발견 데이터) 가산. 현재 런 + lifetime 동시 누적(§5-2 D_lifetime 100% 보존, R8 입력). */
  private addDiscovery(amount: number): void {
    const s = getState();
    const d = D(amount);
    s.resources.D_current = add(s.resources.D_current, d);
    s.resources.D_lifetime = add(s.resources.D_lifetime, d);
  }

  /**
   * 층 진입·도감 발견 판정(M1.3). tick 끝과 오프라인 적용 후 공용.
   *  - 알려진 물리 5층: dec가 새 층 임계 도달 시 currentIndex 갱신 + layerEnter 발행(무상전이).
   *  - 도감: dec ≥ unlockDec 인 입자 발견(영구) + codexDiscover 발행. LEGENDARY는 층 완성 시.
   * 멱등 안전: 이미 도달한 층/발견한 입자는 다시 발화하지 않는다(상태가 기억).
   */
  private processProgression(dec: number): void {
    const s = getState();

    // 층 진입(알려진 물리). 오프라인 점프로 여러 층을 건너뛰어도 각 진입을 순서대로 발행.
    const entered = layersEnteredSince(s.layers.currentIndex, dec);
    if (entered.length > 0) {
      s.layers.currentIndex = entered[entered.length - 1];
      for (const idx of entered) {
        bus.emit('layerEnter', { layer: idx, sublayer: 0 });
      }
    }

    // 도감 발견. 새로 발견된 ID만 집합에 추가 + 개별 이벤트 발행.
    const newly = evaluateDiscoveries(dec, s.codex.discovered);
    for (const id of newly) {
      s.codex.discovered.add(id);
      bus.emit('codexDiscover', { particleId: id });
    }
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

    bus.emit('chain_purchased', { tier, count: plan.count });
    this.notify();
    return plan.count;
  }

  /**
   * 수동 압축(ui-flow §2 '압축' 버튼, systems §4-2 능동 손맛). 클릭당 현재 dC/dt의
   *   CLICK_SECONDS초 분량을 즉시 가산. "클릭은 체인 위에 더해지는 구조, 대체 아님."
   *   배율은 공명 포함 현재 유효 배율을 적용해 클릭도 공명의 혜택을 받게 한다(일관성).
   */
  manualCompress(): void {
    const s = getState();
    const baseMult = productionMult(s.resources.QF);
    // 현재 활성 공명 배율도 클릭에 반영(공명 중엔 클릭도 더 강함 — systems §2-A 곱 구조 일관).
    const resonanceMult = this.isResonanceActive() ? s.mechanics.orbital.getMultiplier() : 1;
    const mult = resonanceMult > 1 ? baseMult.mul(resonanceMult) : baseMult;
    const owned = composeOwned(s.chain.bought, s.chain.produced);
    // 현재 dC/dt(=g1·mult)의 CLICK_SECONDS초 분량. 체인이 비어도(T1 시드) 소폭 진행.
    const bump = owned[0].mul(mult).mul(MANUAL_COMPRESS.CLICK_SECONDS);
    s.resources.C = add(s.resources.C, bump);
    s.resources.E = add(s.resources.E, bump);
    s.resources.lifetime_C = add(s.resources.lifetime_C, bump);
    // 클릭으로 dec가 임계를 넘었을 수 있음 — 층/도감 동기화.
    this.processProgression(computeDec(s.resources.C));
    bus.emit('manual_compress', {});
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
    if (r.success && r.dGained > 0) this.addDiscovery(r.dGained);
    bus.emit('resonance_click', { success: r.success });
    this.notify();
    return r.success;
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

    const tiers: TierSnapshot[] = [];
    for (let i = 0; i < CHAIN_TIERS; i++) {
      const tier = i + 1;
      const nextCost = tierCost(tier, s.chain.bought[i]);
      // 해금: T1 항상, 그 외 직전 티어 보유 ≥1 (ui-flow §2-D +1 노출 규칙).
      const unlocked = i === 0 || owned[i - 1].gt(0) || s.chain.bought[i] > 0;
      tiers.push({
        tier,
        bought: s.chain.bought[i],
        owned: owned[i],
        nextCost,
        rate: tierProductionRate(i, owned, mult),
        affordable: s.resources.E.gte(nextCost),
        unlocked,
      });
    }

    const dec = computeDec(s.resources.C);
    const def: LayerDefinition = currentLayer(dec);
    const discovered = s.codex.discovered;

    // T1 첫 구매 가능 여부(FTUE 체인 노출 게이트).
    const t1NextCost = tierCost(1, s.chain.bought[0]);
    const hasBoughtAnyTier = s.chain.bought.some((b, i) => b > (i === 0 ? 1 : 0)); // T1 시드 1 제외
    const ftue = deriveFtue({
      hasBoughtAnyTier,
      canAffordFirstTier: s.resources.E.gte(t1NextCost),
      discoveredCount: discovered.size,
      layerIndex: s.layers.currentIndex,
      hasPrestiged: s.prestige.count > 0,
      hasDiscoveryData: s.resources.D_current.gt(0),
    });

    // 오비탈 공명 위젯 상태(원자층 L2+ 활성). 표시 전용 — 메커니즘 인스턴스 직접 질의.
    const resonanceActive = s.layers.currentIndex >= 2;
    const orbital = s.mechanics.orbital;
    const resonance: ResonanceSnapshot = {
      active: resonanceActive,
      phase: orbital.getPhase(),
      progress: orbital.getPhaseProgress(),
      multiplier: orbital.getMultiplier(),
    };

    // 표시용 유효 배율: QF항 × 활성 공명 배율(체인에 실제 적용되는 값과 일치).
    const displayMult = resonanceActive && resonance.multiplier > 1
      ? mult.mul(resonance.multiplier)
      : mult;

    return {
      C: s.resources.C,
      E: s.resources.E,
      D: s.resources.D_current,
      QF: s.resources.QF,
      dec,
      r: computeRadius(s.resources.C),
      mult: displayMult,
      rateC: owned[0].mul(displayMult),
      tiers,
      layer: {
        index: def.index,
        slug: def.slug,
        nameKo: def.nameKo,
        nameEn: def.nameEn,
        mechanismNameKo: def.mechanismNameKo,
        scaleM: def.scaleM,
        decadeRange: def.decadeRange,
        nearBoundary: isNearKnownBoundary(dec),
      },
      codex: {
        discovered,
        collected: discoverableCollected(discovered),
        denominator: CODEX_DENOMINATOR,
        completion: codexCompletion(discovered),
        layerCompletions: knownLayerCompletions(discovered),
      },
      resonance,
      ftue,
      totalTicks: this.loop.totalTicks,
      loadKind: this.loadKind,
    };
  }

  /** 새 게임으로 리셋(설정/디버그용). createInitialState로 교체 후 통지. */
  resetToFresh(): void {
    setState(createInitialState());
    this.loadKind = 'fresh';
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
