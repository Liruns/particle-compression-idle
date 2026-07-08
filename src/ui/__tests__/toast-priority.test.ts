/**
 * 토스트 우선순위 cap 검증 (상전이 순간 비트 보존).
 *
 * 커버:
 *  - cap 이하면 그대로.
 *  - 초과 시 중요도(legendary>beat>discover)로 유지 — **상전이 비트가 업적(discover) 다발에 안 밀림.**
 *  - 동일 중요도는 최신(id 큰) 우선.
 *  - 유지 항목의 표시 순서는 삽입 순(읽기 흐름 보존).
 */
import { describe, it, expect } from 'vitest';
import { capByPriority, type ToastItem } from '../toast-priority';

function item(id: number, kind: ToastItem['kind']): ToastItem {
  return { id, kind, lines: [`t${id}`] };
}

describe('capByPriority', () => {
  it('cap 이하면 전부 유지(순서 보존)', () => {
    const a = [item(0, 'discover'), item(1, 'beat')];
    expect(capByPriority(a, 3)).toEqual(a);
  });

  it('상전이 비트가 업적(discover) 다발에 밀리지 않는다', () => {
    // 비트 먼저 → 발견 3개 다발(같은 프레임). cap 3.
    const items = [item(0, 'beat'), item(1, 'discover'), item(2, 'discover'), item(3, 'discover')];
    const kept = capByPriority(items, 3);
    expect(kept.map((t) => t.id)).toContain(0); // 비트 생존
    // 나머지 2칸은 최신 발견(2,3).
    expect(kept.map((t) => t.id)).toEqual([0, 2, 3]);
  });

  it('legendary가 최우선', () => {
    const items = [item(0, 'discover'), item(1, 'discover'), item(2, 'discover'), item(3, 'legendary')];
    const kept = capByPriority(items, 2);
    expect(kept.map((t) => t.id)).toContain(3); // 전설 생존
    expect(kept.length).toBe(2);
  });

  it('동일 중요도는 최신 우선', () => {
    const items = [item(0, 'discover'), item(1, 'discover'), item(2, 'discover')];
    expect(capByPriority(items, 2).map((t) => t.id)).toEqual([1, 2]);
  });

  it('유지 항목은 삽입 순으로 반환(표시 흐름)', () => {
    const items = [item(5, 'discover'), item(6, 'beat'), item(7, 'discover'), item(8, 'legendary')];
    const kept = capByPriority(items, 3);
    // 유지 = beat(6)·legendary(8)·최신 discover(7). 삽입 순 = 6,7,8.
    expect(kept.map((t) => t.id)).toEqual([6, 7, 8]);
  });
});
