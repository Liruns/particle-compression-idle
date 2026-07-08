/**
 * 내러티브 비트 커버리지 검증 (M2.7 — narrative.md §4).
 *
 * 커버:
 *  - 층 진입 비트: 알려진 물리 L2~L5 전부(L1은 첫 화면 카피). "스케줄" 오타 없음(→"스케일").
 *  - 상전이 비트: 미지 6 서브층(prestigeIndex 1~6) 전부 실데이터(빈 자리 없음).
 *  - 보이스 규칙: 느낌표는 비트 텍스트에 없음(플랑크 붕괴 1회를 위해 아껴둠, narrative §2-B).
 *  - 조회 함수 정확성.
 */
import { describe, it, expect } from 'vitest';
import {
  LAYER_ENTRY_BEATS,
  PRESTIGE_BEATS,
  BIG_CRUNCH_BEAT,
  FIRST_SCREEN_LINES,
  WHISPER,
  layerEntryBeat,
  prestigeBeat,
} from '../../data/narrative';

describe('층 진입 비트', () => {
  it('알려진 물리 L2~L5 전부 존재(L1 제외)', () => {
    for (const idx of [2, 3, 4, 5]) {
      const b = layerEntryBeat(idx);
      expect(b, `layer ${idx}`).toBeDefined();
      expect(b!.lines.length).toBeGreaterThan(0);
    }
    expect(layerEntryBeat(1)).toBeUndefined();
  });

  it('"스케줄" 오타 없음 — 올바른 "스케일"', () => {
    for (const b of LAYER_ENTRY_BEATS) {
      for (const line of b.lines) {
        expect(line).not.toContain('스케줄');
      }
    }
    // 층 진입 비트 각각 "스케일 진입"으로 시작하는 규모 라인을 가진다.
    expect(layerEntryBeat(2)!.lines[0]).toContain('스케일');
  });
});

describe('상전이 비트 — 미지 6 서브층 전부', () => {
  it('prestigeIndex 1~6 전부 실데이터', () => {
    for (let i = 1; i <= 6; i++) {
      const b = prestigeBeat(i);
      expect(b, `prestige ${i}`).toBeDefined();
      expect(b!.lines.length).toBeGreaterThan(0);
    }
    expect(PRESTIGE_BEATS.length).toBe(6);
  });

  it('prestigeIndex 유일·정렬(1..6)', () => {
    const idxs = PRESTIGE_BEATS.map((b) => b.prestigeIndex);
    expect(idxs).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('보이스 규칙 — 느낌표 절제(narrative §2-B)', () => {
  it('층·상전이 비트 어디에도 느낌표 없음(빅 크런치용으로 아껴둠)', () => {
    const all = [
      ...LAYER_ENTRY_BEATS.flatMap((b) => b.lines),
      ...PRESTIGE_BEATS.flatMap((b) => b.lines),
    ];
    for (const line of all) expect(line).not.toContain('!');
  });
});

describe('오프닝/재하강 카피 배선(죽은 자산 방지)', () => {
  it('FIRST_SCREEN_LINES·WHISPER·BIG_CRUNCH_BEAT 존재·비어있지 않음', () => {
    expect(FIRST_SCREEN_LINES.length).toBeGreaterThan(0);
    expect(FIRST_SCREEN_LINES.every((l) => l.length > 0)).toBe(true);
    expect(WHISPER.length).toBeGreaterThan(0);
    expect(BIG_CRUNCH_BEAT.length).toBeGreaterThan(0);
  });
});
