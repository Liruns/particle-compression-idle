/**
 * game — 헬로 셸 부트스트랩. F게이트 4종을 하나로 묶어 "구조가 돈다"를 증명한다.
 * (scope-mvp §2 프로토타입 IN의 최소: 루프가 돈다 + 세이브가 산다 + Decimal 경계 + 토큰)
 *
 * 이 파일은 *전체 게임이 아니다*. M1.1 "F-게이트 + 빈 게임 루프 + 화면엔 숫자 하나"(roadmap §1-B).
 * 와이어링:
 *   - F2 StorageAdapter: platform.detectPlatform() → LocalStorageAdapter 주입.
 *   - F1 SaveManager: 부팅 시 load(봉투·체크섬·마이그레이션), autoSave 스케줄러로 주기 저장.
 *   - F3 GameLoop: 고정 timestep tick에서 C 증가(chain.helloShellRate) → dec/r 파생.
 *   - F4 bignum: 모든 자원이 Decimal. native 연산 없음.
 *
 * UI(App.svelte)는 이 모듈이 노출하는 readonly 스냅샷을 구독해 표시만 한다(§4.1 단방향).
 */

import { Decimal, D, add, mul } from './core/bignum';
import { getState, setState, type GameState } from './core/state';
import { GameLoop, Scheduler, TICK_DT } from './core/loop';
import { SaveManager, type LoadResult } from './core/save';
import { computeDec, computeRadius, productionMult, helloShellRate } from './core/chain';
import { detectPlatform, type PlatformAdapter } from './platform';
import { bus } from './core/events';

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
  totalTicks: number;
  loadKind: LoadResult['kind'];
}

/** snapshot 구독자(Svelte가 등록). */
type SnapshotListener = (snap: GameSnapshot) => void;

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

  /** F3 tick(로직): 결정적 고정 dt. 헬로 셸 = C 증가 → dec/r 파생(§표현 분리). */
  private tick(dt: number): void {
    const s = getState();

    // 스케줄러도 같은 시간축으로 구동(백그라운드/오프라인 일관, §6.4).
    this.scheduler.update(dt);

    // dC/dt = helloShellRate(QF) (= production_mult × 1/s). 전부 Decimal(F4).
    const rate = helloShellRate(s.resources.QF);
    const gain = mul(rate, dt);
    s.resources.C = add(s.resources.C, gain);
    s.resources.lifetime_C = add(s.resources.lifetime_C, gain);

    // E도 C에 비례해 소폭 누적(헬로 셸: 자원이 둘 다 산다는 증명용).
    s.resources.E = add(s.resources.E, mul(gain, 0.1));
  }

  /** 현재 상태 → 표시 스냅샷(파생 계산은 여기서, 저장 안 함 §1.1). */
  snapshot(): GameSnapshot {
    const s = getState();
    return {
      C: s.resources.C,
      E: s.resources.E,
      QF: s.resources.QF,
      dec: computeDec(s.resources.C),
      r: computeRadius(s.resources.C),
      mult: productionMult(s.resources.QF),
      totalTicks: this.loop.totalTicks,
      loadKind: this.loadKind,
    };
  }

  /** 수동 압축(능동 손맛 자리, M1.4 확장). 헬로 셸: 클릭당 C 소폭 가산. */
  manualCompress(): void {
    const s = getState();
    const bump = mul(helloShellRate(s.resources.QF), 0.5);
    s.resources.C = add(s.resources.C, bump);
    s.resources.lifetime_C = add(s.resources.lifetime_C, bump);
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
export { TICK_DT, D };
