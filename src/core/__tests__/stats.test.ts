/**
 * 통계 직렬화 검증 (stats — 추가 옵셔널 필드, 버전 업 없이 보존).
 *
 * 커버:
 *  - 라운드트립: serialize→deserialize가 stats 3필드 보존.
 *  - 구버전 세이브(stats 없음) → deserialize 기본 0(마이그레이션 불필요, §1.3 "누락=기본값").
 *  - 손상 값(음수·NaN·문자열) → 0 방어. 정수 아닌 카운터는 floor.
 */
import { describe, it, expect } from 'vitest';
import { serializeState, deserializeState, type SaveData } from '../save/serialize';
import { createInitialState } from '../state';

describe('stats 직렬화', () => {
  it('라운드트립 — 3필드 보존', () => {
    const s = createInitialState();
    s.stats.manualCompresses = 137;
    s.stats.totalBinds = 42;
    s.stats.maxDec = 19.37;
    const round = deserializeState(serializeState(s));
    expect(round.stats.manualCompresses).toBe(137);
    expect(round.stats.totalBinds).toBe(42);
    expect(round.stats.maxDec).toBeCloseTo(19.37, 6);
  });

  it('구버전 세이브(stats 없음) → 기본 0', () => {
    const s = createInitialState();
    const data = serializeState(s) as SaveData;
    delete data.stats; // 구버전 시뮬
    const round = deserializeState(data);
    expect(round.stats.manualCompresses).toBe(0);
    expect(round.stats.totalBinds).toBe(0);
    expect(round.stats.maxDec).toBe(0);
  });

  it('손상 값 방어(음수·NaN·문자열 → 0)', () => {
    const s = createInitialState();
    const data = serializeState(s) as SaveData;
    data.stats = { manualCompresses: -5, totalBinds: NaN, maxDec: '깨짐' as unknown as number };
    const round = deserializeState(data);
    expect(round.stats.manualCompresses).toBe(0);
    expect(round.stats.totalBinds).toBe(0);
    expect(round.stats.maxDec).toBe(0);
  });

  it('정수 아닌 카운터는 floor(maxDec는 실수 유지)', () => {
    const s = createInitialState();
    const data = serializeState(s) as SaveData;
    data.stats = { manualCompresses: 9.9, totalBinds: 3.2, maxDec: 5.5 };
    const round = deserializeState(data);
    expect(round.stats.manualCompresses).toBe(9);
    expect(round.stats.totalBinds).toBe(3);
    expect(round.stats.maxDec).toBeCloseTo(5.5, 6);
  });
});
