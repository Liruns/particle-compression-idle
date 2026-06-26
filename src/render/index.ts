/**
 * render — 파티클/VFX/스케일 줌. (tech-architecture.md §4.1·§6.3, graphics-programmer 영역)
 *
 * 책임 경계(§6.3): 본 게임-프로그래머 스캐폴딩은 **로직↔렌더 분리 계약**만 둔다.
 *   실제 파티클 시스템·셰이더·스케일 줌은 graphics-programmer(Canvas2D/WebGL, 60fps).
 *
 * 계약(§4.1·§6.3):
 *  - render는 tick 상태를 **읽기 전용**으로만 받는다(단방향). 상태를 변경하지 않는다.
 *  - 파티클 수는 **표현 파라미터**(graphics)이지 게임 상태가 아님 → 줄여도 로직/진행 불변.
 *  - 객체 풀링 전제(누수·GC 스파이크 방지 §6.1). 저사양/백그라운드에서 LOD/스킵 자율 결정.
 *  - DESIGN.md game-ui.particles: 층별 파티클 스펙(mol/atom/.../plk).
 *
 * 1일차: GameLoop의 render 콜백이 들어올 자리. 실제 캔버스 렌더는 graphics-programmer가 채운다.
 *   헬로 셸은 Svelte DOM으로 충분(캔버스 불필요) — 이 레이어는 빈 계약으로 둔다.
 */

/** render 진입점(읽기 전용 상태 소비 계약). graphics-programmer가 구현. */
export interface Renderer {
  /** 표현 레이어에서 호출(호출자 무관·읽기전용). alpha=tick 사이 보간(0~1). 상태 변경 금지. */
  draw(alpha: number): void;
  /** 층 전환 시 파티클/팔레트 교체(§6.3, DESIGN motion). */
  onLayerChange(layerSlug: string): void;
  /** 정리(누수 방지 §6.1). */
  dispose(): void;
}

// Canvas2D 렌더 구현체(m2-render-plan v0.2). App.svelte가 인스턴스화·subscribe 콜백에서 draw(V2-4).
export { CanvasRenderer, type RenderInput } from './CanvasRenderer';
