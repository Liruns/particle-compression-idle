/**
 * events — 이벤트 버스(event-hub). (tech-architecture.md §4.3)
 *
 * "상전이 발생, 입자 발견, 층 진입 같은 도메인 이벤트를 발행/구독(AD event-hub.js 선례).
 *  도감·내러티브·사운드·VFX가 게임로직에 직접 결합하지 않고 이벤트로 반응 → 모듈 경계 분리."
 *
 * §6.1 누수 방지: 구독 해제 규율 필수(상전이·층전환으로 메커니즘 모듈 교체 시 구버스 구독 정리).
 *   on()은 unsubscribe 함수를 반환한다 — 호출 측이 정리 책임.
 *
 * platform 레이어(§5.2)가 이 버스를 구독해 codex/상전이 이벤트를 Steam 업적으로 변환.
 *   게임 코어는 Steam을 모른다.
 */

/** 도메인 이벤트 맵. 후속 마일스톤에서 페이로드 타입 확장. */
export interface GameEvents {
  /** 상전이 발생(N회차·진입 서브층·획득 QF). (system-flows §4.1 단계 8) */
  prestige: { count: number; prestigeIndex: number; layer: number; qfGain: string };
  /** 상전이 가능 상태 진입(미지 벽 도달, 1회 — UI 탭 점등·사운드). (system-flows §3.3) */
  prestige_ready: { prestigeIndex: number; previewQF: string };
  /** 상전이 비트·실행 로그(UI 토스트·상태 로그용, narrative §5-B). */
  prestige_beat: { prestigeIndex: number; execLine: string; beatLines: string[]; isFirst: boolean };
  /** 빅 크런치(재하강 run 진입). */
  bigCrunch: { runIndex: number };
  /** 입자 발견. */
  codexDiscover: { particleId: string };
  /** 층/서브층 진입. */
  layerEnter: { layer: number; sublayer: number };
  /** 오프라인 복귀 보상 지급. */
  offlineApplied: { seconds: number };
  /** 세이브 완료. */
  saved: { at: number };
  /** 압축기 구매 성공(티어·수량). (system-flows §2.1) */
  chain_purchased: { tier: number; count: number };
  /** 압축기 구매 실패(자원 부족). UI 피드백용. */
  buy_failed: { tier: number };
  /** 수동 압축 클릭(ui-flow §2). */
  manual_compress: Record<string, never>;
  /** 오비탈 공명 슬롯 열림(원자층, systems §2-A) — UI 깜빡임·사운드. */
  resonance_slot_open: Record<string, never>;
  /** 오비탈 공명 클릭 결과(성공=×1.5+D / 실패=놓침). UI 주스·로그. */
  resonance_click: { success: boolean };
  /** 방치 자동 공명 발화(놓친 슬롯이 낮은 효율로 자동 처리, systems §2-A) — 로그. */
  resonance_auto: Record<string, never>;
  /** 위상 상태 자동 순환 전환(프리온층, systems §2-E) — UI 전환 연출·로그. */
  phase_cycled: { state: 'coherent' | 'dispersed' | 'resonant' };
  /** 위상 상태 고정 성공(E 소모, systems §2-E) — UI 주스. */
  phase_pinned: { state: 'coherent' | 'dispersed' | 'resonant' };
  /** 위상 상태 고정 실패(E 부족) — UI 피드백. */
  phase_pin_failed: { state: 'coherent' | 'dispersed' | 'resonant' };
  /** 위상 고정 해제(무료, systems §2-E) — UI. */
  phase_unpinned: Record<string, never>;
  /** 하모닉 공명 발생(끈층 — 티어 폭발, systems §2-F) — UI 펄스·로그. */
  harmonic_resonance: { tier: number };
  /** 연구 노드 구매 성공(M1.7, system-flows §9.1) — UI 트리 갱신·로그. */
  research_purchased: { nodeId: string; branch: string };
  /** 관측 목표(업적) 달성 — UI 토스트·사운드·Steam 매핑(M3.7) 후보. */
  achievement_earned: { id: string };
}

export type EventName = keyof GameEvents;
export type Listener<K extends EventName> = (payload: GameEvents[K]) => void;
export type Unsubscribe = () => void;

/**
 * EventBus — 타입 안전 발행/구독. 모듈 간 결합을 끊는 단일 허브.
 */
export class EventBus {
  // 내부 저장은 단일 Map(키별 Set). 제네릭 키 인덱싱의 매핑타입 충돌을 피하려
  // 경계에서만 좁은 캐스트를 쓴다(타입 안전한 공개 시그니처는 on/emit이 보장).
  private listeners = new Map<EventName, Set<Listener<EventName>>>();

  /** 구독. 반환된 함수를 호출하면 해제(§6.1 누수 방지). */
  on<K extends EventName>(name: K, fn: Listener<K>): Unsubscribe {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set<Listener<EventName>>();
      this.listeners.set(name, set);
    }
    set.add(fn as Listener<EventName>);
    return () => set!.delete(fn as Listener<EventName>);
  }

  /** 발행. 등록된 모든 구독자에 동기 호출. */
  emit<K extends EventName>(name: K, payload: GameEvents[K]): void {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const fn of set) (fn as Listener<K>)(payload);
  }

  /** 특정 이벤트의 모든 구독 제거(모듈 교체 시 일괄 정리). */
  clear<K extends EventName>(name?: K): void {
    if (name) {
      this.listeners.get(name)?.clear();
    } else {
      this.listeners.clear();
    }
  }
}

/** 전역 단일 이벤트 버스(중앙 단일 상태와 짝, §4.3). */
export const bus = new EventBus();
