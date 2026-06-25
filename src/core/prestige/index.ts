/**
 * prestige — 상전이·QF·빅 크런치·재하강. (economy.md §1, systems.md §2-K·§5)
 *
 * 담당(후속 마일스톤 M1.5 첫 상전이 / M3.2~3.3 빅 크런치·재하강):
 *  - 상전이(PT1~PT6) 판정: dec가 WALLS 임계값 도달 시 트리거(data/constants WALLS).
 *  - QF 획득 → production_mult 부스트(= 1 + 0.25·log₁₀(1+QF), chain.productionMult).
 *  - 빅 크런치(PT7, dec26): 최종 QF 폭발 → dec0 재시작, lifetime_C·QF 누적 보존(§1.1 재하강 키).
 *  - 재하강 차별화: 회전 집중 서브층 선택(state.prestige.focusSublayer, systems §2-K).
 *  - 상전이 시 §3.3 오프라인 보너스 플래그(offlineBonusPending=true) 설정.
 *
 * 이벤트(events.ts): 상전이 → bus.emit('prestige'), 빅 크런치 → bus.emit('bigCrunch').
 *   platform 레이어가 구독해 Steam 업적으로 변환(§5.2).
 *
 * TODO(M1.5): 상전이 실행(자원 리셋 매트릭스 §5, QF 계산), 벽 도달 판정 헬퍼.
 * TODO(M3): 빅 크런치, 재하강 보존(lifetime_C·QF·D_lifetime), 집중 서브층 로테이션.
 */

export {}; // 스텁: 구현은 후속 마일스톤. 인터페이스 자리만 표시.
