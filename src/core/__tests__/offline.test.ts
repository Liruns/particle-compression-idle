/**
 * 오프라인 크레딧 검증 (M1.7 — economy §3, system-flows §7, tech-arch §3). economy §3.2 표값 정합 증명.
 *
 * 커버:
 *  - economy §3.2 표값 정확 정합: 1h=0.65h, 8h=5.20h, 24h=15.60h, 36h=16.97h, 48h=17.95h, 72h/168h=클램프.
 *  - 클램프 순서(§3.2): 48h 탬퍼 → 24h CAP → modifier → long_idle. 단일 진입점.
 *  - 시계 역행(§1.7): now < lastSave → rawSeconds 0, 지급 없음.
 *  - 상전이 직후 modifier=1.0(§3.3): 8h→8.0h(+54%), 24h→24.0h.
 *  - 일괄 지급(§3.1 하한): rate × effectiveSeconds = dC=dE, D 트리클 별도.
 *  - cappedHit 플래그(24h 초과 안내, ui-flow §10-C).
 */
import { describe, it, expect } from 'vitest';
import { D } from '../bignum';
import { computeOffline, applyOfflineCredit } from '../offline';

const H = 3600; // 1시간(초).

/** 자리비움 hours를 만드는 입력(lastSave를 hours 전으로). 기준 now=고정. */
function inputFor(hours: number, afterPrestige = false) {
  const now = 1_000_000_000_000; // 고정 기준 시각(ms).
  return { now, lastSave: now - hours * H * 1000, afterPrestige };
}

describe('오프라인 유효시간 — economy §3.2 표값 정확 정합', () => {
  // effectiveSeconds를 시간으로(초→h). economy §3.2 표 컬럼 "유효 온라인".
  function effHours(hours: number, afterPrestige = false): number {
    return computeOffline(inputFor(hours, afterPrestige)).effectiveSeconds / H;
  }

  it('1h → 0.65h (65%, 캡 이내 선형)', () => {
    expect(effHours(1)).toBeCloseTo(0.65, 4);
  });

  it('★ 8h → 5.20h (65%, 하룻밤)', () => {
    expect(effHours(8)).toBeCloseTo(5.2, 4);
  });

  it('12h → 7.80h (65%)', () => {
    expect(effHours(12)).toBeCloseTo(7.8, 4);
  });

  it('★ 24h → 15.60h (65%, 캡 도달)', () => {
    expect(effHours(24)).toBeCloseTo(15.6, 4);
  });

  it('36h → 16.97h (47%, 로그보너스 트리클)', () => {
    expect(effHours(36)).toBeCloseTo(16.9735, 3);
  });

  it('★ 48h → 17.95h (37%, 탬퍼 클램프 도달)', () => {
    expect(effHours(48)).toBeCloseTo(17.948, 3);
  });

  it('72h → 17.95h (클램프, 추가 없음)', () => {
    expect(effHours(72)).toBeCloseTo(17.948, 3);
  });

  it('168h(1주) → 17.95h (클램프 — 무한 방치 익스플로잇 차단)', () => {
    expect(effHours(168)).toBeCloseTo(17.948, 3);
  });

  it('72h와 168h가 동일(클램프 평탄) — 48h 이상 추가 보상 없음', () => {
    expect(effHours(72)).toBeCloseTo(effHours(168), 6);
  });
});

describe('클램프·modifier 세부 (economy §3.1·§3.3)', () => {
  it('modifier: 일반 0.65 / 상전이 직후 1.0', () => {
    expect(computeOffline(inputFor(8, false)).modifier).toBe(0.65);
    expect(computeOffline(inputFor(8, true)).modifier).toBe(1.0);
  });

  it('★ 상전이 직후 8h → 8.0h (+54%, 복귀 임팩트 §3.3)', () => {
    expect(computeOffline(inputFor(8, true)).effectiveSeconds / H).toBeCloseTo(8.0, 4);
  });

  it('상전이 직후 24h → 24.0h (캡 분량 100% 효율)', () => {
    expect(computeOffline(inputFor(24, true)).effectiveSeconds / H).toBeCloseTo(24.0, 4);
  });

  it('long_idle_bonus: 24h 이하 1.0, 48h에서 1.1505 (= 1+0.5·log10(2))', () => {
    expect(computeOffline(inputFor(24)).longIdleBonus).toBeCloseTo(1.0, 6);
    expect(computeOffline(inputFor(48)).longIdleBonus).toBeCloseTo(1.1505, 4);
  });

  it('cappedHit: 24h 이하 false, 초과 true (ui-flow §10-C 안내 게이트)', () => {
    expect(computeOffline(inputFor(24)).cappedHit).toBe(false);
    expect(computeOffline(inputFor(25)).cappedHit).toBe(true);
    expect(computeOffline(inputFor(48)).cappedHit).toBe(true);
  });

  it('rawSeconds·clampedSeconds: raw는 실경과, clamped는 48h 상한', () => {
    const r = computeOffline(inputFor(72));
    expect(r.rawSeconds).toBeCloseTo(72 * H, 0); // 실경과 72h.
    expect(r.clampedSeconds).toBeCloseTo(48 * H, 0); // 48h로 클램프.
  });
});

describe('시계 역행 방어 (§1.7 — now < lastSave)', () => {
  it('음수 elapsed → rawSeconds 0, effectiveSeconds 0', () => {
    const now = 1_000_000_000_000;
    const r = computeOffline({ now, lastSave: now + 10 * H * 1000, afterPrestige: false }); // 미래 lastSave
    expect(r.rawSeconds).toBe(0);
    expect(r.effectiveSeconds).toBe(0);
  });

  it('elapsed 0 (첫 실행 직후 lastSave==now) → 지급 없음', () => {
    const now = 1_000_000_000_000;
    const r = computeOffline({ now, lastSave: now, afterPrestige: false });
    expect(r.effectiveSeconds).toBe(0);
  });
});

describe('일괄 지급 — economy §3.1 하한 (rate × 유효시간)', () => {
  it('dC = dE = rateC · effectiveSeconds (C·E 동일 소스)', () => {
    // rate 2 C/s, 유효 5.2h → dC = 2 · 5.2·3600 = 37440.
    const eff = 5.2 * H;
    const credit = applyOfflineCredit(eff, D(2));
    expect(credit.dC.eq(2 * eff)).toBe(true);
    expect(credit.dE.eq(credit.dC)).toBe(true); // C·E 동일.
  });

  it('D 트리클 별도(rateD): dD = rateD · 유효시간', () => {
    const eff = 5.2 * H;
    const credit = applyOfflineCredit(eff, D(2), 0.1);
    expect(credit.dD.eq(0.1 * eff)).toBe(true);
  });

  it('rateD 미지정 → dD = 0 (메커니즘 없음)', () => {
    const credit = applyOfflineCredit(5.2 * H, D(2));
    expect(credit.dD.eq(0)).toBe(true);
  });

  it('effectiveSeconds 0 → 전부 0(지급 없음)', () => {
    const credit = applyOfflineCredit(0, D(999), 999);
    expect(credit.dC.eq(0)).toBe(true);
    expect(credit.dE.eq(0)).toBe(true);
    expect(credit.dD.eq(0)).toBe(true);
  });

  it('rate 0(체인 미보유) → 지급 0', () => {
    const credit = applyOfflineCredit(5.2 * H, D(0));
    expect(credit.dC.eq(0)).toBe(true);
  });

  it('Decimal 정밀: 큰 rate(1e30)에서도 정확 곱', () => {
    const eff = 15.6 * H;
    const credit = applyOfflineCredit(eff, D('1e30'));
    expect(credit.dC.eq(D('1e30').mul(eff))).toBe(true);
  });
});

/**
 * 오프라인 wiring 통합(game.ts runOffline 절차 재현). game.ts는 브라우저 의존(localStorage·rAF)이라
 *   상태 모듈 + 순수 함수로 동일 절차를 재현해 자원 반영·플래그 소비를 검증(prestige.test 패턴).
 */
import { createInitialState } from '../state';
import { productionMult, composeOwned } from '../chain';
import { add } from '../bignum';

/** game.ts runOffline의 자원 반영 절차를 그대로 재현(검증용). */
function applyOfflineToState(
  s: import('../state').GameState,
  now: number,
  lastSave: number,
  afterPrestige: boolean,
) {
  const result = computeOffline({ now, lastSave, afterPrestige });
  if (result.effectiveSeconds <= 0) return null;
  const mult = productionMult(s.resources.QF);
  const owned = composeOwned(s.chain.bought, s.chain.produced);
  const rateC = owned[0].mul(mult);
  const credit = applyOfflineCredit(result.effectiveSeconds, rateC, 0);
  s.resources.C = add(s.resources.C, credit.dC);
  s.resources.E = add(s.resources.E, credit.dE);
  s.resources.lifetime_C = add(s.resources.lifetime_C, credit.dC);
  if (afterPrestige && s.prestige.offlineBonusPending) s.prestige.offlineBonusPending = false;
  return { result, credit };
}

describe('오프라인 wiring 통합 — game.ts runOffline 절차 재현', () => {
  it('8h 자리비움 → C·E·lifetime_C에 rate×5.2h 일괄 지급', () => {
    const s = createInitialState();
    // T1 시드 1개 → rateC = 1·mult(QF0=1.0) = 1 C/s. 8h 유효 = 5.2h = 18720s.
    const now = 2_000_000_000_000;
    const r = applyOfflineToState(s, now, now - 8 * H * 1000, false)!;
    const expected = 1 * 5.2 * H; // rate 1 × 유효 5.2h.
    expect(s.resources.C.eq(expected)).toBe(true);
    expect(s.resources.E.eq(expected)).toBe(true);
    expect(s.resources.lifetime_C.eq(expected)).toBe(true);
    expect(r.result.effectiveSeconds / H).toBeCloseTo(5.2, 4);
  });

  it('상전이 직후 8h → modifier 1.0(8.0h 분량) + 플래그 소비(1회성)', () => {
    const s = createInitialState();
    s.prestige.offlineBonusPending = true;
    const now = 2_000_000_000_000;
    applyOfflineToState(s, now, now - 8 * H * 1000, true);
    // rate 1 × 유효 8.0h(modifier 1.0).
    expect(s.resources.C.eq(8 * H)).toBe(true);
    // 플래그 소비됨(다음 오프라인은 0.65).
    expect(s.prestige.offlineBonusPending).toBe(false);
  });

  it('rate가 owned·mult 반영: T1 5개 + QF로 mult↑ → 지급도 비례', () => {
    const s = createInitialState();
    s.chain.bought = [5, 0, 0, 0, 0, 0, 0, 0]; // owned[0]=5.
    s.resources.QF = D(41); // mult = 1+0.25·log10(42) ≈ 1.405.
    const now = 2_000_000_000_000;
    applyOfflineToState(s, now, now - 24 * H * 1000, false);
    const mult = productionMult(D(41));
    const expected = D(5).mul(mult).mul(15.6 * H); // owned·mult × 유효 15.6h.
    expect(s.resources.C.eq(expected)).toBe(true);
  });

  it('60초 이하 자리비움 → 지급은 되지만 모달 게이트(rawSeconds≤60)는 별도(game.ts)', () => {
    const s = createInitialState();
    const now = 2_000_000_000_000;
    const r = applyOfflineToState(s, now, now - 30 * 1000, false); // 30초.
    expect(r).not.toBeNull(); // 지급 자체는 발생(effectiveSeconds>0).
    expect(r!.result.rawSeconds).toBeCloseTo(30, 0); // game.ts는 rawSeconds>60에서만 모달.
  });

  it('시계 역행(lastSave 미래) → 자원 불변(지급 null)', () => {
    const s = createInitialState();
    const before = s.resources.C;
    const now = 2_000_000_000_000;
    const r = applyOfflineToState(s, now, now + 10 * H * 1000, false);
    expect(r).toBeNull();
    expect(s.resources.C.eq(before)).toBe(true);
  });
});
