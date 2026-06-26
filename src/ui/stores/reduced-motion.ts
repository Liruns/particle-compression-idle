/**
 * ui/stores/reduced-motion — `$reducedMotion` readable store (m2-render-plan §7·V2 / DESIGN §846 이행).
 *  prefers-reduced-motion: reduce 미디어쿼리를 JS로 구독한다. tokens.css의 @media는 DOM만 커버하고
 *  캔버스(비트맵)에는 안 닿으므로, 렌더러가 이 스토어를 구독해 파티클 정지·맥동 제거·드리프트 정지를
 *  분기한다(accessibility §2-B). 런타임 토글(OS 설정/DevTools)도 리스너로 반영.
 *
 *  SSR/테스트 가드: window·matchMedia 없으면 false(모션 허용)로 고정한 no-op 스토어.
 */
import { readable } from 'svelte/store';

const QUERY = '(prefers-reduced-motion: reduce)';

/** 현재 reduced-motion 선호 여부(즉시 조회용 — 비반응 컨텍스트). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * reduced-motion 선호를 반영하는 readable<boolean>.
 *  true = 모션 감쇠(파티클 정지·맥동 0·드리프트 0). 구독 해제 시 리스너 정리.
 */
export const reducedMotion = readable<boolean>(prefersReducedMotion(), (set) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    set(false);
    return; // no-op(정리 불필요)
  }
  const mql = window.matchMedia(QUERY);
  set(mql.matches);

  const onChange = (e: MediaQueryListEvent) => set(e.matches);
  // Safari<14 호환: addEventListener 없으면 deprecated addListener 폴백.
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  mql.addListener(onChange);
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return () => mql.removeListener(onChange);
});
