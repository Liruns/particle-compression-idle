/**
 * ui/icons/paths — 계측기 라인 아이콘 세트 (visual-overhaul-plan §3). 인라인 SVG path 모음.
 *  방향(§3-A): 유니코드 글리프 동물원 폐기 → 24×24 그리드·1.75px 균일 stroke·라운드 조인.
 *  전부 stroke-only(fill 금지) — currentColor 상속으로 부모 팔레트 토큰이 색을 100% 통제(이모지 폴백 영구 제거).
 *  메타포는 §3-C: 상투("⚡=번개")가 아니라 실제 측정/물리 도상으로.
 *
 *  주의: 채워야 하는 점도 작은 원 stroke로 표현(라인워크 톤 통일). 옵티컬 보정 — 원형은 살짝 크게.
 *  Icon.svelte가 {@html ICON_PATHS[name]}로 <svg> 내부에 주입. svg 속성(stroke/width/cap)은 래퍼가 공급.
 */

/** name → SVG inner markup(path/circle/line…). viewBox 0 0 24 24 기준. */
export const ICON_PATHS: Record<string, string> = {
  // depth (C): 아래로 수렴하는 깊이 눈금 — 위→아래로 좁아지는 3선 + 하강 화살촉. ◎ 대체.
  depth:
    '<path d="M5 6h14M7 11h10M10 16h4"/><path d="M9 19l3 3 3-3"/>',

  // energy (E): 포텐셜 우물 — U자 곡선 + 바닥 점(에너지 최저). 직선 stroke만(컬러 이모지 불가). ⚡ 대체.
  energy:
    '<path d="M5 4v6a7 7 0 0 0 14 0V4"/><circle cx="12" cy="18.5" r="1.5"/>',

  // data (D): 샘플 점이 찍힌 산점도 격자 — 미세 격자 + 측정점. ▣ 대체("데이터=측정점").
  data:
    '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 12h16M12 4v16"/><circle cx="8" cy="16" r="1.25"/><circle cx="16" cy="8" r="1.25"/>',

  // qf (QF): 요동 결정(결맞음 격자) — 마름모 + 내부 점(진공 요동). ◆ 대체("거품=요동").
  qf:
    '<path d="M12 3l8 9-8 9-8-9 8-9z"/><circle cx="12" cy="12" r="1.5"/>',

  // mult (×): 곱셈 게이지 — ×를 원이 감싼 증폭 다이얼. × 단독 대신.
  mult:
    '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',

  // best: 타깃 캐럿 — 조준 캐럿(가는 ▷). ▶(이모지) 제거.
  best:
    '<path d="M9 6l7 6-7 6"/>',

  // phase: 상태 전이 노드 — 점 + 발산 링(위상 점등). ● 제거(펄스는 CSS).
  phase:
    '<circle cx="12" cy="12" r="2.5"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15M12 4.5a7.5 7.5 0 0 0 0 15"/>',

  // compress: 수렴 화살(안쪽으로) — 양쪽에서 중심으로. 버튼 보조 아이콘.
  compress:
    '<path d="M4 12h6M10 8l-3 4 3 4M20 12h-6M14 8l3 4-3 4"/>',

  // codex: 카드 격자 — 2×3 미세 카드. 도감 탭 텍스트 보조.
  codex:
    '<rect x="4" y="5" width="7" height="6" rx="1"/><rect x="13" y="5" width="7" height="6" rx="1"/><rect x="4" y="13" width="7" height="6" rx="1"/><rect x="13" y="13" width="7" height="6" rx="1"/>',

  // research: 노드 트리 — 점 3 연결선. 연구 탭 텍스트 보조.
  research:
    '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="9" cy="18" r="2"/><path d="M7.7 7.2l8.6 1.6M7.3 8l1.4 8.2"/>',

  // save: 디스크/스냅샷 프레임 — 모서리 마커 4. 저장 텍스트 보조.
  save:
    '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v6h6V4M9 14h6"/>',

  // lock: 가는 자물쇠 윤곽. 잠금 티어 텍스트 보조.
  lock:
    '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};

/** 정의된 아이콘 키(타입 보조). */
export type IconName = keyof typeof ICON_PATHS;
