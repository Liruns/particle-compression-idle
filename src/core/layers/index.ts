/**
 * layers — 층 진입 판정·서브층 벽. (systems.md §1, GDD §9)
 *
 * 11층(분자→플랑크) 중 알려진 물리 5층(분자/원자/핵/핵자/쿼크)은 **무상전이 층 진입**,
 * 미지 6 서브층은 상전이 벽(WALLS, data/constants)으로 진입. "층 진입 ≠ 상전이"가 핵심 학습.
 *
 * 담당(후속):
 *  - 현재 dec → 현재 층/서브층 인덱스 매핑(층 경계 dec 값).
 *  - 층 진입 시 DESIGN.md data-layer 속성 교체(--layer-accent/glow/bg) → bus.emit('layerEnter').
 *  - 메커니즘 모듈 로드/언로드(mechanics/, 각자 serialize·idleBaseline·이벤트 책임 §1.1·§3.4).
 *
 * "한 층 = 한 새로움"(필러④)을 **모듈 추가만으로** 확장(§4.4).
 *
 * TODO(M1.3): dec→층 매핑, 알려진 물리 5층 진입(무상전이), data-layer CSS 속성 전환.
 * TODO(M1.6+): 미지 서브층 진입, 메커니즘 모듈 동적 로드.
 */

export {}; // 스텁: dec→층 매핑·메커니즘 로더는 M1.3+.
