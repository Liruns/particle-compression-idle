/**
 * F-게이트 검증 테스트. (roadmap §1-A — "1일차 제대로")
 * 브라우저 없이 코어 로직의 정확성을 증명한다(vitest, node 환경).
 *
 * 커버:
 *  F4 bignum:  Decimal 경계·직렬화 round-trip.
 *  F1 save:    봉투 build/parse, 체크섬 편집 탐지, 마이그레이션 디스패치.
 *  F3 loop:    고정 timestep 누산기 결정성(advance).
 *  코어 수식:  dec/r/cost/production_mult가 GDD/economy 확정값과 일치.
 *  offline:    48h 탬퍼 클램프 + 시계역행 0 클램프.
 */
import { describe, it, expect } from 'vitest';
import { D, add, mul, pow10, toStore, fromStore } from '../bignum';
import { checksum, verifyChecksum } from '../save/checksum';
import { SaveManager, SAVE_KEY, CURRENT_SCHEMA_VERSION } from '../save';
import type { StorageAdapter } from '../save/adapters';
import { createInitialState } from '../state';
import { GameLoop, TICK_DT } from '../loop';
import { computeDec, computeRadius, tierCost, productionMult } from '../chain';
import { computeOffline } from '../offline';
import { ALPHA } from '../../data/constants';

// --- 인메모리 어댑터(테스트용 StorageAdapter, §1.6 인터페이스 준수) ---
class MemoryAdapter implements StorageAdapter {
  store = new Map<string, string>();
  async read(k: string) {
    return this.store.get(k) ?? null;
  }
  async write(k: string, v: string) {
    this.store.set(k, v);
  }
  async exists(k: string) {
    return this.store.has(k);
  }
  async backup(k: string) {
    const cur = this.store.get(k);
    if (cur != null) this.store.set(`${k}.bak.1`, cur);
  }
}

describe('F4 bignum — Decimal 경계', () => {
  it('직렬화 round-trip (toString/fromStore)', () => {
    const big = pow10(40); // dec26 근방 magnitude
    expect(fromStore(toStore(big)).eq(big)).toBe(true);
  });
  it('손상 문자열은 0으로 방어', () => {
    expect(fromStore('💥not-a-number').eq(0)).toBe(true);
    expect(fromStore(null).eq(0)).toBe(true);
  });
  it('add/mul이 Decimal 산술', () => {
    expect(add('1e100', '1e100').eq('2e100')).toBe(true);
    expect(mul(2, '5e50').eq('1e51')).toBe(true);
  });
});

describe('F1 save — 봉투·체크섬·마이그레이션', () => {
  const mgr = new SaveManager(new MemoryAdapter());

  it('봉투 build/parse round-trip', () => {
    const s = createInitialState();
    s.resources.C = D('1.23e45');
    s.chain.bought[0] = 7;
    const env = mgr.buildEnvelope(s);
    const back = mgr.parseEnvelope(env);
    expect(back.resources.C.eq('1.23e45')).toBe(true);
    expect(back.chain.bought[0]).toBe(7);
  });

  it('봉투 version은 현재 스키마', () => {
    const env = JSON.parse(mgr.buildEnvelope(createInitialState()));
    expect(env.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(typeof env.checksum).toBe('string');
  });

  it('체크섬 편집 탐지', () => {
    expect(verifyChecksum('hello', checksum('hello'))).toBe(true);
    expect(verifyChecksum('hellp', checksum('hello'))).toBe(false);
  });

  it('data 변조 시 parse 거부', () => {
    const env = JSON.parse(mgr.buildEnvelope(createInitialState()));
    env.data = env.data.replace('"E":"0"', '"E":"999"'); // 손으로 편집
    expect(() => mgr.parseEnvelope(JSON.stringify(env))).toThrow();
  });

  it('save/load 통합 — fresh → loaded', async () => {
    const adapter = new MemoryAdapter();
    const m = new SaveManager(adapter);
    const fresh = await m.load();
    expect(fresh.kind).toBe('fresh');

    const s = createInitialState();
    s.resources.QF = D('42');
    await m.save(s);
    expect(adapter.store.has(SAVE_KEY)).toBe(true);

    const loaded = await m.load();
    expect(loaded.kind).toBe('loaded');
    expect(loaded.state.resources.QF.eq('42')).toBe(true);
  });
});

describe('F3 loop — 고정 timestep 결정성', () => {
  it('advance(n초) = floor(n/dt) tick', () => {
    let ticks = 0;
    const loop = new GameLoop({ tick: () => ticks++, render: () => {} });
    loop.advance(1); // 1초
    expect(ticks).toBe(Math.floor(1 / TICK_DT)); // 20틱
  });

  it('같은 입력 → 같은 누적(결정성)', () => {
    const run = () => {
      let acc = 0;
      const loop = new GameLoop({ tick: (dt) => (acc += dt), render: () => {} });
      loop.advance(3);
      return acc;
    };
    expect(run()).toBeCloseTo(run(), 10);
  });
});

describe('코어 수식 — GDD/economy 확정값', () => {
  it('dec = α·log₁₀(C+1)', () => {
    // C=1e10 → dec = 0.65·log₁₀(1e10+1) ≈ 0.65·10 = 6.5
    expect(computeDec(D('1e10'))).toBeCloseTo(ALPHA * Math.log10(1e10 + 1), 6);
    expect(computeDec(0)).toBe(0);
  });

  it('r = r₀·10^(−dec), r₀=1e-9 (작아짐)', () => {
    // C=0 → dec=0 → r=1e-9
    expect(computeRadius(0).eq('1e-9')).toBe(true);
    // C 증가 → r 감소(작아짐=강해짐)
    expect(computeRadius(D('1e10')).lt('1e-9')).toBe(true);
  });

  it('cost_k(n) = 10^(1+1.3k)·growth^n', () => {
    // T1, n=0 → base = 10^(1+1.3) = 10^2.3
    expect(tierCost(1, 0).eq(pow10(2.3))).toBe(true);
    // n 증가 → 비용 증가
    expect(tierCost(1, 5).gt(tierCost(1, 0))).toBe(true);
  });

  it('production_mult = 1 + 0.25·log₁₀(1+QF); QF=0 → 1', () => {
    expect(productionMult(0).eq(1)).toBe(true);
    expect(productionMult(D('1e4')).gt(1)).toBe(true);
  });
});

describe('offline — 탬퍼 클램프(§3.2)', () => {
  const HOUR = 3600 * 1000;

  it('시계 역행 → 0 (음수 elapsed 방어)', () => {
    const r = computeOffline({ now: 1000, lastSave: 5000, afterPrestige: false });
    expect(r.rawSeconds).toBe(0);
    expect(r.effectiveSeconds).toBe(0);
  });

  it('48h 초과 시계조작 → 48h로 클램프', () => {
    const now = 1_000_000_000_000;
    const r = computeOffline({ now, lastSave: now - 1000 * HOUR, afterPrestige: false });
    // clampedSeconds는 48h(=172800s)를 넘지 않는다.
    expect(r.clampedSeconds).toBeLessThanOrEqual(48 * 3600 + 1);
  });

  it('상전이 직후 modifier=1.0', () => {
    const now = 1_000_000_000_000;
    const r = computeOffline({ now, lastSave: now - 2 * HOUR, afterPrestige: true });
    expect(r.modifier).toBe(1.0);
  });

  it('일반 modifier=0.65', () => {
    const now = 1_000_000_000_000;
    const r = computeOffline({ now, lastSave: now - 2 * HOUR, afterPrestige: false });
    expect(r.modifier).toBe(0.65);
  });
});
