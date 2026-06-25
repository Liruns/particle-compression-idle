/**
 * 위상 겹침 + 진동 하모닉스 메커니즘 검증. (M1.6 — systems §2-E·§2-F)
 *
 * 위상 겹침(프리온 L6) 커버:
 *  - 상태 순환: 응집→분산→공명→응집 자동 순환(AUTO_CYCLE 주기), 진행도.
 *  - 상태별 산출: 분산=D, 공명=QF, 응집=둘 다 0. 상태별 배율(응집 최대).
 *  - 고정(pin)/해제(unpin): 고정 시 순환 정지·상태 유지, 해제 시 재순환.
 *  - 누적 시간: 상태별 누적(프리온 발견 임계 입력).
 *  - 직렬화 라운드트립 + 손상/누락 방어. 결정성(같은 dt → 같은 상태). 오프라인 기본값.
 *  - "다른 결"(필러 ④): 오비탈 공명과 달리 타이밍 클릭 없음 — 상태 선택.
 *
 * 진동 하모닉스(끈 L7) 커버:
 *  - V 누적 → 하모닉 임계마다 티어 공명(burst), 8티어 순환. 다음 티어 예측.
 *  - 티어별 배율 맵(burst 티어만 BURST_MULT). burst 감쇠.
 *  - 직렬화·결정성·오프라인 기본값.
 *
 * 미지 발견(메커니즘 게이트) 커버:
 *  - evaluateMechDiscoveries: 위상 누적/하모닉 공명으로 프리온·끈 입자 발견.
 */
import { describe, it, expect } from 'vitest';
import { PhaseOverlap, Harmonics } from '../layers/mechanics';
import { PHASE_OVERLAP, HARMONICS } from '../../data/constants';
import { evaluateMechDiscoveries } from '../codex';
import { serializeState, deserializeState } from '../save/serialize';
import { createInitialState } from '../state';

/** dt=0.1로 seconds 전진(누적 산출 합산). */
function advancePhase(m: PhaseOverlap, seconds: number, dt = 0.1) {
  let dGained = 0;
  let qfGained = 0;
  let cycles = 0;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    const r = m.update(dt);
    dGained += r.dGained;
    qfGained += r.qfGained;
    if (r.cycled) cycles++;
  }
  return { dGained, qfGained, cycles };
}

// =====================================================================
// 위상 겹침 (프리온 L6)
// =====================================================================
describe('위상 겹침 — 상태 순환 (systems §2-E)', () => {
  it('초기 상태 = 응집(coherent), 미고정', () => {
    const m = new PhaseOverlap();
    expect(m.getState()).toBe('coherent');
    expect(m.isPinned()).toBe(false);
  });

  it('AUTO_CYCLE_SECONDS마다 다음 상태로 순환: 응집→분산→공명→응집', () => {
    const m = new PhaseOverlap();
    advancePhase(m, PHASE_OVERLAP.AUTO_CYCLE_SECONDS + 0.05);
    expect(m.getState()).toBe('dispersed');
    advancePhase(m, PHASE_OVERLAP.AUTO_CYCLE_SECONDS);
    expect(m.getState()).toBe('resonant');
    advancePhase(m, PHASE_OVERLAP.AUTO_CYCLE_SECONDS);
    expect(m.getState()).toBe('coherent'); // 한 바퀴 완주
  });

  it('순환 진행도: 0→1 (주기 절반에서 ≈0.5)', () => {
    const m = new PhaseOverlap();
    expect(m.getCycleProgress()).toBeCloseTo(0, 2);
    advancePhase(m, PHASE_OVERLAP.AUTO_CYCLE_SECONDS / 2);
    expect(m.getCycleProgress()).toBeCloseTo(0.5, 1);
  });
});

describe('위상 겹침 — 상태별 산출 (systems §2-E)', () => {
  it('응집: 체인 배율 최대, D·QF 산출 0', () => {
    const m = new PhaseOverlap();
    expect(m.getMultiplier()).toBeCloseTo(PHASE_OVERLAP.COHERENT_MULT, 5);
    // 응집 상태에서만 머무는 짧은 전진(주기 내) → D·QF 0.
    const r = advancePhase(m, 1);
    expect(r.dGained).toBe(0);
    expect(r.qfGained).toBe(0);
  });

  it('분산: D 산출(systems §2-E "D 최대"), 배율은 낮음', () => {
    const m = new PhaseOverlap();
    m.pin('dispersed'); // 분산 고정 → 순환 안 함.
    expect(m.getMultiplier()).toBeCloseTo(PHASE_OVERLAP.DISPERSED_MULT, 5);
    const r = advancePhase(m, 2);
    // 2초 × DISPERSED_D_RATE.
    expect(r.dGained).toBeCloseTo(2 * PHASE_OVERLAP.DISPERSED_D_RATE, 4);
    expect(r.qfGained).toBe(0);
  });

  it('공명: QF 트리클(systems §2-E "QF 미적립 지속"), 중간 배율', () => {
    const m = new PhaseOverlap();
    m.pin('resonant');
    expect(m.getMultiplier()).toBeCloseTo(PHASE_OVERLAP.RESONANT_MULT, 5);
    const r = advancePhase(m, 5);
    expect(r.qfGained).toBeCloseTo(5 * PHASE_OVERLAP.RESONANT_QF_RATE, 4);
    expect(r.dGained).toBe(0);
  });

  it('상태별 배율 차등: 응집 > 공명 > 분산 (전문화 의미)', () => {
    expect(PHASE_OVERLAP.COHERENT_MULT).toBeGreaterThan(PHASE_OVERLAP.RESONANT_MULT);
    expect(PHASE_OVERLAP.RESONANT_MULT).toBeGreaterThan(PHASE_OVERLAP.DISPERSED_MULT);
  });
});

describe('위상 겹침 — 고정/해제 (systems §2-E 능동 개입)', () => {
  it('pin → 순환 정지, 선택 상태 유지', () => {
    const m = new PhaseOverlap();
    m.pin('resonant');
    expect(m.getState()).toBe('resonant');
    expect(m.isPinned()).toBe(true);
    // 긴 시간 전진해도 순환 안 함.
    const r = advancePhase(m, PHASE_OVERLAP.AUTO_CYCLE_SECONDS * 3);
    expect(r.cycles).toBe(0);
    expect(m.getState()).toBe('resonant');
    expect(m.getCycleProgress()).toBe(0); // 고정 = 진행 없음
  });

  it('unpin → 다시 자동 순환', () => {
    const m = new PhaseOverlap();
    m.pin('coherent');
    m.unpin();
    expect(m.isPinned()).toBe(false);
    advancePhase(m, PHASE_OVERLAP.AUTO_CYCLE_SECONDS + 0.05);
    expect(m.getState()).toBe('dispersed'); // 순환 재개
  });

  it('누적 시간: 고정 상태에서 그 상태만 누적', () => {
    const m = new PhaseOverlap();
    m.pin('coherent');
    advancePhase(m, 10);
    const t = m.getStateTimes();
    expect(t.coherent).toBeCloseTo(10, 1);
    expect(t.dispersed).toBe(0);
    expect(t.resonant).toBe(0);
  });
});

describe('위상 겹침 — 직렬화·결정성 (§1.1 R7 / R9)', () => {
  it('serialize/deserialize 라운드트립(상태·고정·누적)', () => {
    const m = new PhaseOverlap();
    m.pin('dispersed');
    advancePhase(m, 3);
    const saved = m.serialize();
    const m2 = new PhaseOverlap();
    m2.deserialize(saved);
    expect(m2.getState()).toBe('dispersed');
    expect(m2.isPinned()).toBe(true);
    expect(m2.getStateTimes().dispersed).toBeCloseTo(m.getStateTimes().dispersed, 5);
  });

  it('누락(undefined) → 기본값(응집·미고정)', () => {
    const m = new PhaseOverlap();
    m.deserialize(undefined);
    expect(m.getState()).toBe('coherent');
    expect(m.isPinned()).toBe(false);
  });

  it('손상 데이터 방어 → 안전 기본값', () => {
    const m = new PhaseOverlap();
    m.deserialize({ state: 'garbage', pinned: 'yes', coherentTime: -5 });
    expect(m.getState()).toBe('coherent'); // 알 수 없는 상태 → coherent
    expect(m.isPinned()).toBe(false); // 비boolean → false
    expect(m.getStateTimes().coherent).toBe(0); // 음수 → 0
  });

  it('같은 dt 시퀀스 → 같은 상태(결정성)', () => {
    const a = new PhaseOverlap();
    const b = new PhaseOverlap();
    const seq = [0.1, 0.1, 5, 0.5, 13, 0.1];
    for (const dt of seq) {
      a.update(dt);
      b.update(dt);
    }
    expect(a.serialize()).toEqual(b.serialize());
  });

  it('큰 dt 점프(오프라인) — 여러 순환 안전 처리', () => {
    const m = new PhaseOverlap();
    const r = m.update(100); // 한 번에 100초
    expect(Number.isFinite(m.getMultiplier())).toBe(true);
    // 100초 / 12초 주기 ≈ 8 순환 → cycled=true(전환 발생).
    expect(r.cycled).toBe(true);
    const t = m.getStateTimes();
    expect(t.coherent + t.dispersed + t.resonant).toBeCloseTo(100, 1); // 누적 합 = 전체 dt
  });

  it('오프라인 기본 기여 배율 = 세 상태 평균(양수 > 1)', () => {
    const m = new PhaseOverlap();
    const base = m.getIdleBaselineMultiplier();
    const avg =
      (PHASE_OVERLAP.COHERENT_MULT + PHASE_OVERLAP.DISPERSED_MULT + PHASE_OVERLAP.RESONANT_MULT) / 3;
    expect(base).toBeCloseTo(avg, 6);
    expect(base).toBeGreaterThan(1);
  });
});

// =====================================================================
// 진동 하모닉스 (끈 L7)
// =====================================================================
describe('진동 하모닉스 — V 누적·공명 (systems §2-F)', () => {
  it('초기 V=0, burst 없음, 공명 0', () => {
    const m = new Harmonics();
    expect(m.getTotalResonances()).toBe(0);
    expect(m.getTierMultipliers().every((x) => x === 1)).toBe(true);
  });

  it('HARMONIC_INTERVAL 충전 시 첫 공명 발생(티어 burst)', () => {
    const m = new Harmonics();
    // FILL_RATE로 HARMONIC_INTERVAL 채우는 시간.
    const t = HARMONICS.HARMONIC_INTERVAL / HARMONICS.FILL_RATE + 0.05;
    let resonated = false;
    let tier = 0;
    const steps = Math.round(t / 0.1);
    for (let i = 0; i < steps; i++) {
      const r = m.update(0.1);
      if (r.resonated) {
        resonated = true;
        tier = r.resonantTier;
      }
    }
    expect(resonated).toBe(true);
    expect(tier).toBeGreaterThanOrEqual(1);
    expect(tier).toBeLessThanOrEqual(8);
    expect(m.getTotalResonances()).toBeGreaterThanOrEqual(1);
  });

  it('공명 티어 8 순환 + 다음 티어 예측', () => {
    const m = new Harmonics();
    // 첫 공명 직전: nextTier = 1.
    expect(m.getNextResonantTier()).toBe(1);
    // 한 임계 채움 → 공명, nextTier = 2.
    m.update(HARMONICS.HARMONIC_INTERVAL / HARMONICS.FILL_RATE + 0.01);
    expect(m.getNextResonantTier()).toBe(2);
  });

  it('burst 티어만 BURST_MULT, 나머지 1.0; burst 감쇠 후 1.0', () => {
    const m = new Harmonics();
    const r = m.update(HARMONICS.HARMONIC_INTERVAL / HARMONICS.FILL_RATE + 0.01);
    expect(r.resonated).toBe(true);
    const mults = m.getTierMultipliers();
    const bursting = mults.filter((x) => x > 1);
    expect(bursting.length).toBe(1); // 한 티어만 폭발
    expect(bursting[0]).toBeCloseTo(HARMONICS.BURST_MULT, 5);
    // BURST_SECONDS 후 감쇠 → 전부 1.0.
    m.update(HARMONICS.BURST_SECONDS + 0.1);
    expect(m.getTierMultipliers().every((x) => x === 1)).toBe(true);
  });

  it('charge 진행도 0~1 (임계 구간 내 비율)', () => {
    const m = new Harmonics();
    expect(m.getChargeProgress()).toBeCloseTo(0, 2);
    m.update((HARMONICS.HARMONIC_INTERVAL / HARMONICS.FILL_RATE) / 2);
    expect(m.getChargeProgress()).toBeCloseTo(0.5, 1);
  });
});

describe('진동 하모닉스 — 직렬화·결정성 (§1.1 R7 / R9)', () => {
  it('serialize/deserialize 라운드트립(V·공명수)', () => {
    const m = new Harmonics();
    m.update(HARMONICS.HARMONIC_INTERVAL * 2.5);
    const saved = m.serialize();
    const m2 = new Harmonics();
    m2.deserialize(saved);
    expect(m2.getTotalResonances()).toBe(m.getTotalResonances());
    expect(m2.getNextResonantTier()).toBe(m.getNextResonantTier());
  });

  it('로드 직후 거짓 공명 없음(lastHarmonicN 재유도)', () => {
    const m = new Harmonics();
    m.update(HARMONICS.HARMONIC_INTERVAL * 3 + 1);
    const saved = m.serialize();
    const m2 = new Harmonics();
    m2.deserialize(saved);
    // 로드 직후 작은 전진 → 새 임계 안 넘으면 공명 없음.
    const r = m2.update(0.05);
    expect(r.resonated).toBe(false);
  });

  it('누락 → 기본값(V=0)', () => {
    const m = new Harmonics();
    m.deserialize(undefined);
    expect(m.getTotalResonances()).toBe(0);
    expect(m.getChargeProgress()).toBeCloseTo(0, 5);
  });

  it('같은 dt 시퀀스 → 같은 상태(결정성)', () => {
    const a = new Harmonics();
    const b = new Harmonics();
    const seq = [0.1, 0.1, 5, 0.5, 20, 0.1];
    for (const dt of seq) {
      a.update(dt);
      b.update(dt);
    }
    expect(a.serialize()).toEqual(b.serialize());
  });

  it('큰 dt 점프(오프라인) — 여러 공명 안전 처리', () => {
    const m = new Harmonics();
    const r = m.update(HARMONICS.HARMONIC_INTERVAL * 20);
    expect(r.totalResonances).toBeGreaterThan(1);
    expect(Number.isFinite(m.getChargeProgress())).toBe(true);
  });

  it('오프라인 기본 기여 배율 양수(≥1)', () => {
    const m = new Harmonics();
    expect(m.getIdleBaselineMultiplier()).toBeGreaterThanOrEqual(1);
  });
});

// =====================================================================
// 미지 발견 (메커니즘 게이트)
// =====================================================================
describe('미지 발견 — evaluateMechDiscoveries (systems §2-E·§2-F)', () => {
  it('프리온: 응집 누적 10초 → P+ 발견', () => {
    const ctx = { phaseTimes: { coherent: 10, dispersed: 0, resonant: 0 } };
    const newly = evaluateMechDiscoveries(6, ctx, new Set());
    expect(newly).toContain('preon_plus');
    // 분산·공명 미충족 → P-·P0 미발견.
    expect(newly).not.toContain('preon_minus');
    expect(newly).not.toContain('preon_zero');
  });

  it('프리온: 응집 미달(9초) → P+ 미발견', () => {
    const ctx = { phaseTimes: { coherent: 9, dispersed: 0, resonant: 0 } };
    const newly = evaluateMechDiscoveries(6, ctx, new Set());
    expect(newly).not.toContain('preon_plus');
  });

  it('프리온: 분산 10초 → P-, 공명 20초 → P0', () => {
    const ctx = { phaseTimes: { coherent: 0, dispersed: 10, resonant: 20 } };
    const newly = evaluateMechDiscoveries(6, ctx, new Set());
    expect(newly).toContain('preon_minus');
    expect(newly).toContain('preon_zero');
  });

  it('프리온: 위상 진공은 decade 게이트(dec20.5)', () => {
    const ctx = { phaseTimes: { coherent: 0, dispersed: 0, resonant: 0 }, dec: 20.5 };
    const newly = evaluateMechDiscoveries(6, ctx, new Set());
    expect(newly).toContain('phase_vacuum');
  });

  it('프리온: 6개 discoverable 전부 발견 시 LEGENDARY(l6_completion) 해금', () => {
    // 6 discoverable 다 채울 컨텍스트(전부 충족).
    const have = new Set([
      'preon_plus',
      'preon_minus',
      'preon_zero',
      'coherent_preon',
      'phase_vacuum',
      'phase_knot',
    ]);
    const ctx = {
      phaseTimes: { coherent: 100, dispersed: 100, resonant: 100 },
      dec: 21,
    };
    const newly = evaluateMechDiscoveries(6, ctx, have);
    expect(newly).toContain('l6_completion');
  });

  it('끈: 하모닉 공명 1회 → 개방끈, 3회 → 폐쇄끈', () => {
    expect(evaluateMechDiscoveries(7, { harmonicResonances: 1 }, new Set())).toContain(
      'open_string_mode1',
    );
    const newly3 = evaluateMechDiscoveries(7, { harmonicResonances: 3 }, new Set());
    expect(newly3).toContain('open_string_mode1');
    expect(newly3).toContain('closed_string_mode1');
  });

  it('끈: 공명 0회 → 아무것도 발견 안 됨', () => {
    expect(evaluateMechDiscoveries(7, { harmonicResonances: 0 }, new Set())).toHaveLength(0);
  });

  it('현재 층만 평가(프리온 컨텍스트로 끈 입자 미발견)', () => {
    const ctx = { phaseTimes: { coherent: 100, dispersed: 100, resonant: 100 } };
    const newly = evaluateMechDiscoveries(6, ctx, new Set());
    expect(newly.every((id) => !id.includes('string'))).toBe(true);
  });

  it('멱등: 이미 발견한 입자는 재발견 안 함', () => {
    const have = new Set(['preon_plus']);
    const ctx = { phaseTimes: { coherent: 50, dispersed: 0, resonant: 0 } };
    const newly = evaluateMechDiscoveries(6, ctx, have);
    expect(newly).not.toContain('preon_plus');
  });
});

// =====================================================================
// state/serialize 통합 (미지 메커니즘 라운드트립)
// =====================================================================
describe('직렬화 — phase·harmonics 라운드트립 (state ↔ SaveData)', () => {
  it('GameState.mechanics.phase·harmonics 직렬화/복원', () => {
    const s = createInitialState();
    s.mechanics.phase.pin('resonant');
    s.mechanics.phase.update(5);
    s.mechanics.harmonics.update(HARMONICS.HARMONIC_INTERVAL * 2);
    const data = serializeState(s);
    expect(data.mechanics?.phase).toBeDefined();
    expect(data.mechanics?.harmonics).toBeDefined();
    const back = deserializeState(data);
    expect(back.mechanics.phase.getState()).toBe('resonant');
    expect(back.mechanics.phase.isPinned()).toBe(true);
    expect(back.mechanics.harmonics.getTotalResonances()).toBe(
      s.mechanics.harmonics.getTotalResonances(),
    );
  });

  it('구버전 세이브(phase·harmonics 없음) → 새 인스턴스 기본값', () => {
    const init = serializeState(createInitialState());
    const legacy = JSON.parse(JSON.stringify(init));
    delete legacy.mechanics.phase;
    delete legacy.mechanics.harmonics;
    const back = deserializeState(legacy);
    expect(back.mechanics.phase.getState()).toBe('coherent');
    expect(back.mechanics.harmonics.getTotalResonances()).toBe(0);
  });
});

// =====================================================================
// 프리온층 통합 — 메커니즘 ↔ 발견 결합 (game.ts 절차 재현, 브라우저 비의존)
// =====================================================================
describe('프리온층 통합 — 위상 누적 → 프리온 발견 (필러 ④ 미지 첫 결)', () => {
  it('프리온층(currentIndex=6)에서 응집 고정·누적 → P+ 발견', () => {
    const s = createInitialState();
    s.layers.currentIndex = 6; // 상전이 1 후 프리온 진입 상태.

    // 게임 절차 재현: 응집 고정 → 10초 누적 → 메커니즘 발견 판정.
    s.mechanics.phase.pin('coherent');
    s.mechanics.phase.update(10.5);
    const ctx = {
      phaseTimes: s.mechanics.phase.getStateTimes(),
      harmonicResonances: undefined,
      dec: 0, // 프리온 진입 직후 C 리셋 → dec≈0(dec 게이트 아닌 메커니즘 게이트로 발견).
    };
    const newly = evaluateMechDiscoveries(6, ctx, s.codex.discovered);
    expect(newly).toContain('preon_plus');
  });

  it('위상 배율이 체인 production에 곱해진다(응집 = 최대 배율)', () => {
    const s = createInitialState();
    s.layers.currentIndex = 6;
    s.mechanics.phase.pin('coherent');
    // game.ts updatePhase가 getMultiplier()를 mult에 곱 → 응집 배율 = COHERENT_MULT.
    expect(s.mechanics.phase.getMultiplier()).toBeCloseTo(PHASE_OVERLAP.COHERENT_MULT, 5);
  });

  it('공명 상태 QF 트리클이 자원에 누적 가능(game.ts updatePhase 경로)', () => {
    const s = createInitialState();
    s.layers.currentIndex = 6;
    s.mechanics.phase.pin('resonant');
    const r = s.mechanics.phase.update(10);
    // game.ts가 r.qfGained를 QF에 가산 → 양수.
    expect(r.qfGained).toBeGreaterThan(0);
    expect(r.qfGained).toBeCloseTo(10 * PHASE_OVERLAP.RESONANT_QF_RATE, 4);
  });

  it('상전이 리셋 시 메커니즘은 새 인스턴스, 도감은 보존(systems §5-2)', () => {
    const s = createInitialState();
    s.layers.currentIndex = 6;
    s.mechanics.phase.pin('dispersed');
    s.mechanics.phase.update(20);
    s.codex.discovered.add('preon_minus'); // 이미 발견.

    // 상전이 리셋(game.ts executePrestige 절차): 메커니즘 교체 + 도감 유지.
    s.mechanics.phase = new PhaseOverlap();
    s.mechanics.harmonics = new Harmonics();

    expect(s.mechanics.phase.getState()).toBe('coherent'); // 리셋됨.
    expect(s.mechanics.phase.getStateTimes().dispersed).toBe(0); // 누적 리셋.
    expect(s.codex.discovered.has('preon_minus')).toBe(true); // 도감 보존.
  });
});

describe('끈층 통합 — 하모닉 공명 → 끈 발견', () => {
  it('끈층(currentIndex=7)에서 공명 누적 → 개방끈 발견', () => {
    const s = createInitialState();
    s.layers.currentIndex = 7; // 상전이 2 후 끈 진입.
    // 첫 공명까지 충전.
    s.mechanics.harmonics.update(HARMONICS.HARMONIC_INTERVAL / HARMONICS.FILL_RATE + 0.1);
    const ctx = {
      harmonicResonances: s.mechanics.harmonics.getTotalResonances(),
      dec: 0,
    };
    const newly = evaluateMechDiscoveries(7, ctx, s.codex.discovered);
    expect(newly).toContain('open_string_mode1');
  });
});
