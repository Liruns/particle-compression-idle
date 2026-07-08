/**
 * ui/toast-priority — 토스트 우선순위 cap(순수, 테스트 가능).
 *
 *  문제: 상전이 순간엔 상전이 비트(서사 머니 모먼트)와 업적 토스트(discover)가 같은 프레임에 다발로 뜬다.
 *   단순 "최근 N개 유지"(slice(-N))면 나중에 뜬 업적들이 **더 중요한 비트를 밀어낸다**.
 *  해결: **우선순위(legendary>beat>discover)로 CAP개를 고르되, 표시 순서는 삽입 순 유지**(읽기 흐름 보존).
 */

export type ToastKind = 'discover' | 'beat' | 'legendary' | 'notice';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  lines: string[];
}

/** 동시 표시 상한(ui-flow §11-C). */
export const TOAST_CAP = 3;

/** 종류별 중요도(높을수록 유지 우선). 통지(세이브 손상/복구 등 시스템) > 전설 > 비트(서사) > 발견. */
const PRIORITY: Record<ToastKind, number> = { notice: 4, legendary: 3, beat: 2, discover: 1 };

/**
 * items 중 유지할 것을 고른다: **중요도 내림차순 → 최신(id 큰) 순**으로 cap개 선택 후, 원래 삽입 순서로 복원.
 *  동일 중요도면 최신이 이긴다(오래된 저순위는 밀림). 표시는 삽입 순(위→아래 = 오래된→최신).
 */
export function capByPriority(items: readonly ToastItem[], cap = TOAST_CAP): ToastItem[] {
  if (items.length <= cap) return [...items];
  const keep = [...items]
    .sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || b.id - a.id)
    .slice(0, cap);
  const keepIds = new Set(keep.map((t) => t.id));
  return items.filter((t) => keepIds.has(t.id));
}
