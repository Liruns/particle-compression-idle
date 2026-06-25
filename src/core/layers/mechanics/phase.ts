/**
 * layers/mechanics/phase — 위상 겹침 (프리온층 L6). (systems.md §2-E, M1.6)
 *
 * **미지 영역 첫 메커니즘**(필러 ④ "한 층=한 새로움"의 미지 첫 결). 알려진 물리 메커니즘
 *   (오비탈 공명=타이밍 클릭, 핵력 게이지=충전 대기)과 *다른 결*: "어떤 자원을 우선할지"의
 *   **전략적 상태 선택**이다. 양자 중첩을 메커니즘으로 — 위상 C가 세 상태를 오간다.
 *
 * 동작 모델(systems §2-E 의사코드 충실):
 *   - 상태(phase_state) ∈ {COHERENT(응집), DISPERSED(분산), RESONANT(공명)}.
 *   - 방치: AUTO_CYCLE_SECONDS마다 다음 상태로 결정적 순환(가중 랜덤 대신 순환 — 결정성 R9·오프라인 일관).
 *   - 개입: 플레이어가 상태를 pin(고정)하면 E 1회 소모로 자동 순환을 멈추고 선택 상태 유지(전문화).
 *     unpin(해제)은 무료 — 다시 자동 순환.
 *   - 상태별 출력:
 *       응집: 체인 배율 최대(COHERENT_MULT), D 0.              → 누적 시 P+ 발견
 *       분산: 체인 배율 낮음(DISPERSED_MULT), D 최대.          → 누적 시 P- 발견
 *       공명: 체인 배율 중간(RESONANT_MULT), QF 트리클.        → 누적 시 P0 발견
 *
 * 자기완결(tech-arch §1.1·§3.4·§4.4): orbital.ts와 동형 — 상태머신·직렬화·방치기본값을 스스로 책임.
 *   game.ts는 update(dt)/pin()/unpin()을 호출하고 결과(배율·D·QF·상태 누적시간)만 읽어 반영한다.
 *   → 세이브/오프라인이 메커니즘 내부를 모른다. 모듈 추가만으로 미지 서브층 확장.
 *
 * Decimal 규칙(orbital.ts와 동일): 배율·타이머·누적시간은 스칼라(native — 작은 범위, 오버플로 0).
 *   D·QF 산출량만 "이번 update 증가량"을 native로 보고 → game.ts가 Decimal로 환산해 누적
 *   (D·QF는 느린 화폐, native 누적 위험 0 — bignum 경계는 game.ts 책임).
 */

import { PHASE_OVERLAP } from '../../../data/constants';
import type { LayerMechanic } from './index';

/** 위상 상태: 응집(체인) / 분산(D) / 공명(QF). systems §2-E. */
export type PhaseState = 'coherent' | 'dispersed' | 'resonant';

/** 자동 순환 순서(결정적). 응집 → 분산 → 공명 → 응집 … */
const CYCLE_ORDER: readonly PhaseState[] = ['coherent', 'dispersed', 'resonant'] as const;

/** update(dt) 결과: game.ts가 자원·발견·이벤트로 반영할 부수효과. */
export interface PhaseUpdateResult {
  /** 이번 update에서 발생한 D 증가량(분산 상태). native — game.ts가 Decimal 환산. */
  dGained: number;
  /** 이번 update에서 발생한 QF 트리클(공명 상태). native — game.ts가 Decimal 환산. */
  qfGained: number;
  /** 이번 update에서 상태가 자동 순환으로 전환됐는가(UI 전환 연출·로그). */
  cycled: boolean;
  /** 전환됐다면 새 상태(cycled=false면 무의미). */
  newState: PhaseState;
}

/** 직렬화 형태(평문 JSON — save 봉투에 그대로, §1.1 R7). */
interface PhaseSave {
  state: PhaseState;
  /** 고정 여부(true면 자동 순환 멈춤). */
  pinned: boolean;
  /** 현재 상태 진입 후 경과(초) — 자동 순환 카운트다운 + UI 진행도. */
  elapsed: number;
  /** 상태별 누적 유지 시간(초) — 프리온 발견 임계 판정용. */
  coherentTime: number;
  dispersedTime: number;
  resonantTime: number;
}

/**
 * PhaseOverlap — 위상 겹침 메커니즘(프리온층). LayerMechanic 자기완결 구현.
 *
 * 생성 직후 응집 상태에서 시작(첫 진입 = 가장 직관적인 "체인 강화" 상태로 학습 시작).
 */
export class PhaseOverlap implements LayerMechanic {
  readonly id = 'phase_overlap';

  private state: PhaseState = 'coherent';
  /** 고정 여부 — true면 자동 순환을 멈추고 현재 상태 유지(능동 전문화). */
  private pinned = false;
  /** 현재 상태 진입 후 경과(초). 자동 순환 카운트다운. */
  private elapsed = 0;
  /** 상태별 누적 유지 시간(초) — 프리온 발견 임계(P+/P-/P0). */
  private coherentTime = 0;
  private dispersedTime = 0;
  private resonantTime = 0;

  /**
   * 고정 dt 전진(systems §2-E 상태 순환 + 상태별 산출). game.ts tick에서 매 틱 호출.
   *   고정(pin) 중이면 순환 정지·선택 상태 유지. 미고정이면 AUTO_CYCLE_SECONDS마다 다음 상태로.
   *   dt가 여러 주기를 넘을 수 있으므로(오프라인 점프) while 가드로 결정적 처리.
   * @param dt 고정 논리 스텝(초).
   * @returns 부수효과(D·QF 증가·상태 전환). game.ts가 자원/발견/버스에 반영.
   */
  update(dt: number): PhaseUpdateResult {
    let cycled = false;

    // 1. 상태별 누적 시간 + 자원 산출(현재 상태 기준 — 전환 전 dt 전체를 현 상태로 계산).
    //    (한 틱 50ms는 주기 12s에 비해 작아 경계 분할 오차 무시. 오프라인 대량 dt는 아래 순환 루프가
    //     "현 상태로 한 주기" 단위로 끊어 처리 → 누적·산출이 상태별로 정확히 분배된다.)
    let remaining = dt;
    let guard = 0;
    while (remaining > 0 && guard++ < 100000) {
      // 고정 중이면 무한 — 남은 dt 전부를 현 상태로 소화하고 종료.
      const untilCycle = this.pinned
        ? remaining
        : Math.min(remaining, PHASE_OVERLAP.AUTO_CYCLE_SECONDS - this.elapsed);
      const slice = Math.max(0, untilCycle);

      this.accumulate(this.state, slice);
      this.elapsed += slice;
      remaining -= slice;

      // 고정 아니고 주기 경계 도달 → 다음 상태로 순환.
      if (!this.pinned && this.elapsed >= PHASE_OVERLAP.AUTO_CYCLE_SECONDS - 1e-9) {
        this.state = nextState(this.state);
        this.elapsed = 0;
        cycled = true;
      } else if (this.pinned) {
        break; // 고정: 남은 dt를 위에서 모두 소화했으므로 종료.
      }
      // slice=0 방어(부동소수 경계) — guard가 폭주 막지만 진행 보장 위해 미세 전진.
      if (slice <= 0 && remaining > 0) {
        this.elapsed = PHASE_OVERLAP.AUTO_CYCLE_SECONDS; // 다음 루프에서 강제 순환.
      }
    }

    // 2. 이번 update의 산출 합산(상태별 누적 시간 증가분으로부터 — 위 accumulate가 _gain에 적립).
    const dGained = this._dGain;
    const qfGained = this._qfGain;
    this._dGain = 0;
    this._qfGain = 0;

    return { dGained, qfGained, cycled, newState: this.state };
  }

  /** 이번 update 누적 산출 버퍼(상태 분배 정확성 위해 멤버에 적립 후 update 끝에서 회수·리셋). */
  private _dGain = 0;
  private _qfGain = 0;

  /** slice(초)만큼 상태별 누적 시간 + 자원 산출 적립. */
  private accumulate(state: PhaseState, slice: number): void {
    if (slice <= 0) return;
    switch (state) {
      case 'coherent':
        this.coherentTime += slice;
        break;
      case 'dispersed':
        this.dispersedTime += slice;
        this._dGain += PHASE_OVERLAP.DISPERSED_D_RATE * slice;
        break;
      case 'resonant':
        this.resonantTime += slice;
        this._qfGain += PHASE_OVERLAP.RESONANT_QF_RATE * slice;
        break;
    }
  }

  /**
   * 상태 고정(systems §2-E 능동 개입 player_pins_state). 지정 상태로 전환 + 자동 순환 정지.
   *   E 비용은 game.ts가 부과(메커니즘은 자원을 모름 — 단방향). 비용 지불 성공 시 호출된다.
   * @param state 고정할 상태.
   */
  pin(state: PhaseState): void {
    this.state = state;
    this.pinned = true;
    this.elapsed = 0;
  }

  /** 고정 해제 — 다시 자동 순환(무료). 현재 상태부터 이어서 순환. */
  unpin(): void {
    this.pinned = false;
    this.elapsed = 0;
  }

  /**
   * 현재 체인 배율(systems §2-E state_mult). 체인 production에 곱(game.ts — 오비탈 공명과 동형 합성).
   *   비활성(프리온 미진입)은 game.ts가 update 자체를 스킵하므로 항상 활성 상태에서만 질의됨.
   */
  getMultiplier(): number {
    switch (this.state) {
      case 'coherent':
        return PHASE_OVERLAP.COHERENT_MULT;
      case 'dispersed':
        return PHASE_OVERLAP.DISPERSED_MULT;
      case 'resonant':
        return PHASE_OVERLAP.RESONANT_MULT;
    }
  }

  /** 현재 위상 상태(UI 위젯 토글 하이라이트). */
  getState(): PhaseState {
    return this.state;
  }

  /** 고정 여부(UI 잠금 표시). */
  isPinned(): boolean {
    return this.pinned;
  }

  /**
   * 현재 상태 진행도(0~1) — 다음 자동 순환까지. 고정 중이면 0(순환 안 함 = 진행 없음).
   *   UI 위젯이 토글에 카운트다운 표시(오비탈 링과 다른 형태 — 가로 진행/세그먼트).
   */
  getCycleProgress(): number {
    if (this.pinned) return 0;
    return Math.min(1, Math.max(0, this.elapsed / PHASE_OVERLAP.AUTO_CYCLE_SECONDS));
  }

  /** 상태별 누적 유지 시간(초) — 프리온 발견 임계 판정·UI 진행. game.ts가 발견 판정에 쓴다. */
  getStateTimes(): { coherent: number; dispersed: number; resonant: number } {
    return {
      coherent: this.coherentTime,
      dispersed: this.dispersedTime,
      resonant: this.resonantTime,
    };
  }

  // --- LayerMechanic 계약 (tech-arch §1.1·§3.4) ------------------------------

  /** 직렬화(§1.1 R7). 상태·고정·누적시간을 평문 JSON으로. save 봉투에 그대로. */
  serialize(): PhaseSave {
    return {
      state: this.state,
      pinned: this.pinned,
      elapsed: this.elapsed,
      coherentTime: this.coherentTime,
      dispersedTime: this.dispersedTime,
      resonantTime: this.resonantTime,
    };
  }

  /** 복원(§1.3 누락/손상 방어). 알 수 없는 상태→coherent, 음수/비유한→0 클램프. */
  deserialize(data: unknown): void {
    const d = (data ?? {}) as Partial<PhaseSave>;
    this.state = isPhaseState(d.state) ? d.state : 'coherent';
    this.pinned = d.pinned === true;
    this.elapsed = clampTime(d.elapsed);
    this.coherentTime = clampTime(d.coherentTime);
    this.dispersedTime = clampTime(d.dispersedTime);
    this.resonantTime = clampTime(d.resonantTime);
  }

  /**
   * 오프라인 방치 기본 기여 배율(§3.4). 오프라인 계산기는 위상 공식을 모르고 이 값만 질의.
   *   방치 중에는 세 상태를 균등 순환하므로 세 배율의 평균을 보고한다(장기 평균 효율).
   *   (고정은 능동 개입 — 오프라인엔 미반영. systems §2-E "방치 시 균형 잡힌 진행".)
   */
  getIdleBaselineMultiplier(): number {
    return (
      (PHASE_OVERLAP.COHERENT_MULT + PHASE_OVERLAP.DISPERSED_MULT + PHASE_OVERLAP.RESONANT_MULT) / 3
    );
  }
}

/** 다음 순환 상태(결정적). */
function nextState(s: PhaseState): PhaseState {
  const i = CYCLE_ORDER.indexOf(s);
  return CYCLE_ORDER[(i + 1) % CYCLE_ORDER.length];
}

/** 타입 가드: 알 수 없는 값 방어. */
function isPhaseState(v: unknown): v is PhaseState {
  return v === 'coherent' || v === 'dispersed' || v === 'resonant';
}

/** 시간 값 정규화(음수/비유한 → 0). */
function clampTime(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}
