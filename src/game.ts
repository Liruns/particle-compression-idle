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

/** UI가 읽는 표시용 스냅샷(읽기 전용). Decimal 그대로 — format은 UI에서. */
export interface GameSnapshot {
  C: Decimal;
  E: Decimal;
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
    const mult = productionMult(s.resources.QF);

    // 2. 8단 체인 생산(역순 단일 패스, engine.py 동형).
    const { dC, dE, produced } = chainTick(s.chain.bought, s.chain.produced, mult, dt);
    s.chain.produced = produced;

    // 3. 자원 가산(C·E 동일 소스) + lifetime_C 누적(QF 산출 입력, §1.1 단계 2).
    s.resources.C = add(s.resources.C, dC);
    s.resources.E = add(s.resources.E, dE);
    s.resources.lifetime_C = add(s.resources.lifetime_C, dC);
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

  /** 수동 압축(ui-flow §2 '압축' 버튼). 클릭당 현재 dC/dt의 0.5초 분량을 즉시 가산. */
  manualCompress(): void {
    const s = getState();
    const mult = productionMult(s.resources.QF);
    const owned = composeOwned(s.chain.bought, s.chain.produced);
    // 현재 dC/dt(=g1·mult)의 0.5초 분량. 체인이 비어도(T1 시드) 소폭 진행.
    const bump = owned[0].mul(mult).mul(0.5);
    s.resources.C = add(s.resources.C, bump);
    s.resources.E = add(s.resources.E, bump);
    s.resources.lifetime_C = add(s.resources.lifetime_C, bump);
    bus.emit('manual_compress', {});
    this.notify();
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

    return {
      C: s.resources.C,
      E: s.resources.E,
      QF: s.resources.QF,
      dec: computeDec(s.resources.C),
      r: computeRadius(s.resources.C),
      mult,
      rateC: owned[0].mul(mult),
      tiers,
      totalTicks: this.loop.totalTicks,
      loadKind: this.loadKind,
    };
  }

  /** 새 게임으로 리셋(설정/디버그용). createInitialState로 교체 후 통지. */
  resetToFresh(): void {
    setState(createInitialState());
    this.loadKind = 'fresh';
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
