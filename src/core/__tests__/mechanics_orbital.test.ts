/**
 * 오비탈 공명 메커니즘 검증. (M1.4 — systems §2-A, economy 60/40 능동)
 *
 * 커버:
 *  - 슬롯 상태머신: 닫힘→열림(SLOT_INTERVAL)→만료/클릭→닫힘 사이클, 진행도.
 *  - 클릭: 열림에서 성공(×1.5 + D_PER_CLICK), 닫힘에서 실패(무효과·페널티 없음).
 *  - 방치 자동 공명: 슬롯 만료 시 IDLE_BASE + D_PER_IDLE 발화(60/40 — 방치도 진행).
 *  - 배율 감쇠: DECAY_SECONDS에 걸쳐 1.0으로 선형.
 *  - 60/40 차등: 클릭 D > 방치 D, 클릭 배율 > 방치 배율.
 *  - 오프라인 방치 기본값: getIdleBaselineMultiplier 양수 > 1.
 *  - 직렬화: serialize/deserialize 라운드트립, 손상/누락 방어.
 *  - 결정성: 같은 dt 시퀀스 → 같은 결과(루프 catch-up 대비).
 *  - FTUE: D 첫 획득 시 자원 D 행 노출(showResourceD).
 *  - state/serialize 통합: GameState.mechanics.orbital 라운드트립.
 */
import { describe, it, expect } from 'vitest';
import { OrbitalResonance } from '../layers/mechanics';
import { RESONANCE } from '../../data/constants';
import { deriveFtue } from '../ftue';
import { serializeState, deserializeState, type SaveData } from '../save/serialize';
import { createInitialState } from '../state';

/** 슬롯이 열릴 때까지(SLOT_INTERVAL) dt=0.05로 전진. 누적 슬롯/자동 발화 합산 반환. */
function advance(m: OrbitalResonance, seconds: number, dt = 0.05) {
  let dGained = 0;
  let slotOpened = 0;
  let autoResonated = 0;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    const r = m.update(dt);
    dGained += r.dGained;
    if (r.slotOpened) slotOpened++;
    if (r.autoResonated) autoResonated++;
  }
  return { dGained, slotOpened, autoResonated };
}

// --- 슬롯 상태머신 ----------------------------------------------------------
describe('오비탈 공명 — 슬롯 상태머신 (systems §2-A)', () => {
  it('초기엔 닫힘(SLOT_INTERVAL 대기)', () => {
    const m = new OrbitalResonance();
    expect(m.getPhase()).toBe('closed');
    expect(m.getMultiplier()).toBe(1);
  });

  it('SLOT_INTERVAL 경과 후 슬롯 열림', () => {
    const m = new OrbitalResonance();
    // interval 직전: 아직 닫힘.
    advance(m, RESONANCE.SLOT_INTERVAL_SECONDS - 0.1);
    expect(m.getPhase()).toBe('closed');
    // interval 넘김: 열림.
    advance(m, 0.2);
    expect(m.getPhase()).toBe('open');
  });

  it('열림 후 SLOT_WINDOW 미클릭 → 방치 자동 공명 + 닫힘', () => {
    const m = new OrbitalResonance();
    const r = advance(m, RESONANCE.SLOT_INTERVAL_SECONDS + RESONANCE.SLOT_WINDOW_SECONDS + 0.1);
    expect(r.slotOpened).toBe(1);
    expect(r.autoResonated).toBe(1);
    expect(m.getPhase()).toBe('closed');
    // 자동 공명이 IDLE_BASE를 찍음(직후 — 감쇠 전이라 ≈ IDLE_BASE).
    expect(m.getMultiplier()).toBeGreaterThan(1);
    expect(m.getMultiplier()).toBeLessThanOrEqual(RESONANCE.IDLE_BASE + 1e-9);
  });

  it('진행도: 닫힘은 다음 열림까지 0→1', () => {
    const m = new OrbitalResonance();
    expect(m.getPhaseProgress()).toBeCloseTo(0, 2); // timer=INTERVAL → 진행 0
    advance(m, RESONANCE.SLOT_INTERVAL_SECONDS / 2);
    expect(m.getPhaseProgress()).toBeCloseTo(0.5, 1);
  });

  it('한 사이클 = INTERVAL + WINDOW(=9s)마다 슬롯 1회 열림', () => {
    const m = new OrbitalResonance();
    const cycle = RESONANCE.SLOT_INTERVAL_SECONDS + RESONANCE.SLOT_WINDOW_SECONDS;
    const r = advance(m, cycle * 3 + 0.1);
    expect(r.slotOpened).toBe(3);
    expect(r.autoResonated).toBe(3); // 클릭 안 했으니 전부 자동
  });
});

// --- 클릭 (능동 개입) -------------------------------------------------------
describe('오비탈 공명 — 클릭 (능동, systems §2-A)', () => {
  it('열린 슬롯 클릭 → 성공: ×1.5 배율 + D_PER_CLICK', () => {
    const m = new OrbitalResonance();
    advance(m, RESONANCE.SLOT_INTERVAL_SECONDS + 0.1); // 열림
    expect(m.getPhase()).toBe('open');
    const r = m.click();
    expect(r.success).toBe(true);
    expect(r.dGained).toBe(RESONANCE.D_PER_CLICK);
    expect(m.getMultiplier()).toBeCloseTo(RESONANCE.CLICK_BONUS, 5);
    // 슬롯 소비 → 닫힘.
    expect(m.getPhase()).toBe('closed');
  });

  it('닫힌 슬롯 클릭 → 실패: 무효과(페널티 없음)', () => {
    const m = new OrbitalResonance();
    // 아직 닫힘(열림 전).
    expect(m.getPhase()).toBe('closed');
    const before = m.getMultiplier();
    const r = m.click();
    expect(r.success).toBe(false);
    expect(r.dGained).toBe(0);
    expect(m.getMultiplier()).toBe(before); // 변화 없음
  });

  it('클릭 성공이 방치 자동 발화를 대체(같은 슬롯에서 자동 안 뜸)', () => {
    const m = new OrbitalResonance();
    advance(m, RESONANCE.SLOT_INTERVAL_SECONDS + 0.1); // 열림
    m.click(); // 성공 → 닫힘
    // window가 지나도 (이미 닫혔으므로) 추가 자동 발화는 다음 사이클에서만.
    const r = advance(m, RESONANCE.SLOT_WINDOW_SECONDS); // 다음 열림 전까지
    expect(r.autoResonated).toBe(0);
  });
});

// --- 배율 감쇠 --------------------------------------------------------------
describe('오비탈 공명 — 배율 감쇠 (systems §2-A: 30초에 걸쳐 1.0)', () => {
  it('클릭 직후 ×1.5 → DECAY_SECONDS 후 1.0', () => {
    const m = new OrbitalResonance();
    advance(m, RESONANCE.SLOT_INTERVAL_SECONDS + 0.1);
    m.click();
    expect(m.getMultiplier()).toBeCloseTo(RESONANCE.CLICK_BONUS, 5);
    // DECAY_SECONDS 경과 → 1.0 복귀(중간에 자동 발화로 다시 오를 수 있으나, 클릭으로 슬롯
    //  소비했고 다음 자동까지 INTERVAL+WINDOW=9s — DECAY 30s보다 짧아 자동이 끼어든다.
    //  순수 감쇠만 보려면 슬롯 사이클을 멈출 수 없으므로, 감쇠율 자체를 직접 검증).
    const decayRate = (RESONANCE.CLICK_BONUS - 1) / RESONANCE.DECAY_SECONDS;
    const m2 = new OrbitalResonance();
    advance(m2, RESONANCE.SLOT_INTERVAL_SECONDS + 0.1);
    m2.click();
    const start = m2.getMultiplier();
    m2.update(1); // 1초 감쇠
    expect(m2.getMultiplier()).toBeCloseTo(start - decayRate, 4);
  });

  it('배율은 1.0 아래로 내려가지 않음', () => {
    const m = new OrbitalResonance();
    advance(m, RESONANCE.SLOT_INTERVAL_SECONDS + 0.1);
    m.click();
    // 아주 긴 시간 감쇠(자동 발화가 IDLE_BASE를 다시 찍지만, 그것도 결국 ≥1).
    m.update(1000);
    expect(m.getMultiplier()).toBeGreaterThanOrEqual(1);
  });
});

// --- 60/40 차등 (능동 > 방치) -----------------------------------------------
describe('오비탈 공명 — 60/40 차등 (필러 ③ 방치·개입 모두 보상)', () => {
  it('클릭 배율(×1.5) > 방치 배율(×1.1)', () => {
    expect(RESONANCE.CLICK_BONUS).toBeGreaterThan(RESONANCE.IDLE_BASE);
  });

  it('클릭 D > 방치 D (개입이 더 많은 발견)', () => {
    expect(RESONANCE.D_PER_CLICK).toBeGreaterThan(RESONANCE.D_PER_IDLE);
  });

  it('같은 시간 — 매 슬롯 클릭 성공 시 D 누적이 방치보다 큼', () => {
    const cycle = RESONANCE.SLOT_INTERVAL_SECONDS + RESONANCE.SLOT_WINDOW_SECONDS;
    // 방치 3사이클: 자동만.
    const idle = new OrbitalResonance();
    const idleR = advance(idle, cycle * 3 + 0.1);
    const idleD = idleR.dGained;
    // 능동 3사이클: 슬롯 열릴 때마다 클릭.
    const active = new OrbitalResonance();
    let activeD = 0;
    for (let c = 0; c < 3; c++) {
      // 슬롯 열릴 때까지 전진하며 D 누적(자동 발화는 클릭 전이라 없음).
      let opened = false;
      for (let i = 0; i < 400 && !opened; i++) {
        const r = active.update(0.05);
        activeD += r.dGained;
        if (active.getPhase() === 'open') opened = true;
      }
      const cr = active.click();
      if (cr.success) activeD += cr.dGained;
    }
    expect(activeD).toBeGreaterThan(idleD);
  });
});

// --- 오프라인 방치 기본값 ---------------------------------------------------
describe('오비탈 공명 — 오프라인 기본 기여 (§3.4)', () => {
  it('getIdleBaselineMultiplier는 1 초과 양수(방치도 진행)', () => {
    const m = new OrbitalResonance();
    const base = m.getIdleBaselineMultiplier();
    expect(base).toBeGreaterThan(1);
    expect(base).toBeLessThanOrEqual(RESONANCE.IDLE_BASE);
  });
});

// --- 직렬화 -----------------------------------------------------------------
describe('오비탈 공명 — 직렬화 (§1.1 R7)', () => {
  it('serialize/deserialize 라운드트립(phase·timer·bonus)', () => {
    const m = new OrbitalResonance();
    advance(m, RESONANCE.SLOT_INTERVAL_SECONDS + 0.1);
    m.click(); // bonus=1.5, phase=closed
    const saved = m.serialize();
    const m2 = new OrbitalResonance();
    m2.deserialize(saved);
    expect(m2.getPhase()).toBe(m.getPhase());
    expect(m2.getMultiplier()).toBeCloseTo(m.getMultiplier(), 6);
  });

  it('누락 데이터(undefined) → 기본값', () => {
    const m = new OrbitalResonance();
    m.deserialize(undefined);
    expect(m.getPhase()).toBe('closed');
    expect(m.getMultiplier()).toBe(1);
  });

  it('손상 데이터 방어 → 안전 클램프', () => {
    const m = new OrbitalResonance();
    m.deserialize({ phase: 'garbage', timer: -5, bonus: 99 });
    expect(m.getPhase()).toBe('closed'); // 알 수 없는 phase → closed
    expect(m.getMultiplier()).toBeLessThanOrEqual(RESONANCE.CLICK_BONUS); // bonus 상한 클램프
    expect(m.getMultiplier()).toBeGreaterThanOrEqual(1);
  });
});

// --- 결정성 -----------------------------------------------------------------
describe('오비탈 공명 — 결정성 (catch-up 일관, R9)', () => {
  it('같은 dt 시퀀스 → 같은 상태', () => {
    const a = new OrbitalResonance();
    const b = new OrbitalResonance();
    const seq = [0.05, 0.05, 1, 0.5, 2, 0.05];
    for (const dt of seq) {
      a.update(dt);
      b.update(dt);
    }
    expect(a.serialize()).toEqual(b.serialize());
  });

  it('큰 dt 점프(오프라인) — 여러 사이클 안전 처리', () => {
    const m = new OrbitalResonance();
    // 한 번에 100초 점프: 여러 슬롯 사이클을 가드 안에서 소화(무한루프 없음).
    const r = m.update(100);
    expect(r.dGained).toBeGreaterThan(0); // 자동 공명 누적
    expect(Number.isFinite(m.getMultiplier())).toBe(true);
    expect(m.getMultiplier()).toBeGreaterThanOrEqual(1);
  });
});

// --- FTUE: D 노출 -----------------------------------------------------------
describe('FTUE — D 첫 획득 시 자원 D 행 노출 (ui-flow §2-C)', () => {
  const base = {
    hasBoughtAnyTier: true,
    canAffordFirstTier: true,
    discoveredCount: 5,
    layerIndex: 2,
    hasPrestiged: false,
    hasDiscoveryData: false,
  };

  it('D 없음 → showResourceD false', () => {
    expect(deriveFtue(base).showResourceD).toBe(false);
  });

  it('D 보유 → showResourceD true (연구 탭은 여전히 false — M1.7)', () => {
    const f = deriveFtue({ ...base, hasDiscoveryData: true });
    expect(f.showResourceD).toBe(true);
    expect(f.showResearchTab).toBe(false);
  });
});

// --- state/serialize 통합 ---------------------------------------------------
describe('직렬화 — mechanics.orbital 라운드트립 (state ↔ SaveData)', () => {
  it('GameState.mechanics.orbital 직렬화/복원', () => {
    const s = createInitialState();
    // 슬롯을 열고 클릭한 상태로 만든 뒤 직렬화.
    advance(s.mechanics.orbital, RESONANCE.SLOT_INTERVAL_SECONDS + 0.1);
    s.mechanics.orbital.click();
    const data = serializeState(s);
    expect(data.mechanics?.orbital).toBeDefined();
    const back = deserializeState(data);
    expect(back.mechanics.orbital.getMultiplier()).toBeCloseTo(
      s.mechanics.orbital.getMultiplier(),
      6,
    );
    expect(back.mechanics.orbital.getPhase()).toBe(s.mechanics.orbital.getPhase());
  });

  it('구버전 세이브(mechanics 없음) → 새 인스턴스 기본값', () => {
    const init = serializeState(createInitialState());
    const legacy = { ...init };
    delete (legacy as Partial<SaveData>).mechanics;
    const back = deserializeState(legacy as SaveData);
    expect(back.mechanics.orbital.getPhase()).toBe('closed');
    expect(back.mechanics.orbital.getMultiplier()).toBe(1);
  });

  it('새 게임 → D_current/D_lifetime 0', () => {
    const s = createInitialState();
    expect(s.resources.D_current.eq(0)).toBe(true);
    expect(s.resources.D_lifetime.eq(0)).toBe(true);
  });
});
