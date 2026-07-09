/**
 * layers/mechanics/orbital — 전자 오비탈 공명 (원자층 L2). (systems.md §2-A, M1.4)
 *
 * "첫 눌러야 할 이유"가 생기는 층(필러 ③ 능동 손맛). 주기적으로 공명 슬롯이 열리고,
 *   유효 시간(window) 안에 클릭하면 **공명 배율 ×1.5 + D 획득**. 놓쳐도 방치 자동 공명이
 *   낮은 효율로 진행을 잇는다(60/40 — 방치 60%, 개입 +40%). 공명 배율은 체인 전체 production에
 *   곱해지므로 체인이 강할수록 효과가 커진다("작아짐=강해짐" 강화).
 *
 * 자기완결(tech-arch §1.1·§3.4·§4.4): 이 모듈은 슬롯 상태머신·배율 감쇠·직렬화·방치기본값을
 *   스스로 책임진다. 루프 코어(game.ts)는 update(dt)/click()을 호출하고 결과 배율·이벤트만 읽는다.
 *   → 세이브/오프라인이 메커니즘 내부를 모른다. "한 층=한 새로움"을 모듈 추가만으로 확장.
 *
 * 동작 모델(systems §2-A 의사코드 충실):
 *   - 슬롯 주기: 닫힌 상태 SLOT_INTERVAL → 열림 SLOT_WINDOW → (클릭=성공 / 미클릭=만료) → 닫힘 반복.
 *   - 클릭 성공: bonus = max(bonus, CLICK_BONUS). D += D_PER_CLICK. 슬롯 즉시 소비(닫힘).
 *   - 슬롯 만료(미클릭): 방치 자동 공명 1회 — bonus = max(bonus, IDLE_BASE). D += D_PER_IDLE.
 *   - 매 틱 bonus가 DECAY_SECONDS에 걸쳐 1.0으로 선형 감쇠(systems §2-A "30초에 걸쳐 1.0으로").
 *   - 현재 공명 배율 = max(1, bonus). 체인 production에 곱(game.ts).
 *
 * Decimal 규칙: 배율·타이머는 스칼라(native number — 0~1.5, 0~6초 범위, 오버플로 0)다.
 *   D 획득량만 Decimal로 누적(game.ts가 resources.D_current/D_lifetime에 가산). 본 모듈은
 *   "이번 update에서 발생한 D 증가량"을 native number로 보고하고, game.ts가 Decimal로 환산해 더한다
 *   (D는 느린 화폐라 native 누적 위험 0 — bignum 경계는 game.ts가 책임).
 */

import { RESONANCE } from '../../../data/constants';
import type { LayerMechanic } from './index';

/** 슬롯 상태: 닫힘(다음 열림 대기) / 열림(클릭 유효). */
export type SlotPhase = 'closed' | 'open';

/** update(dt) 결과: game.ts가 자원/이벤트로 반영할 부수효과. */
export interface OrbitalUpdateResult {
  /** 이번 update에서 발생한 D 증가량(방치 자동 공명 만료 발화분). native — game.ts가 Decimal 환산. */
  dGained: number;
  /** 이번 update에서 슬롯이 새로 열렸는가(UI 깜빡임·사운드 트리거). */
  slotOpened: boolean;
  /** 이번 update에서 방치 자동 공명이 발화했는가(놓친 슬롯 — 로그용). */
  autoResonated: boolean;
}

/** click() 결과: 성공 여부 + D 증가량(UI 피드백·자원 반영). */
export interface OrbitalClickResult {
  /** 열린 슬롯을 유효 시간 안에 눌렀는가(성공 시 ×1.5 + D). */
  success: boolean;
  /** 성공 시 D 증가량(D_PER_CLICK). 실패 0. native — game.ts가 Decimal 환산. */
  dGained: number;
}

/** 직렬화 형태(평문 JSON — save 봉투에 그대로 담김, §1.1 R7). */
interface OrbitalSave {
  phase: SlotPhase;
  /** 현재 phase 남은 시간(초). closed=다음 열림까지, open=만료까지. */
  timer: number;
  /** 현재 공명 배율(1.0~1.5). 감쇠 중. */
  bonus: number;
  /** 연속 성공 콤보(0~COMBO_MAX). 성공 클릭 시 증가, 놓친 슬롯(자동 공명) 시 0. */
  combo: number;
}

/**
 * OrbitalResonance — 오비탈 공명 메커니즘(원자층). LayerMechanic 자기완결 구현.
 *
 * 생성 직후 closed 상태에서 SLOT_INTERVAL 후 첫 슬롯이 열린다(진입 직후 바로 안 열려 학습 여유).
 */
export class OrbitalResonance implements LayerMechanic {
  readonly id = 'orbital_resonance';

  private phase: SlotPhase = 'closed';
  /** 현재 phase 남은 시간(초). */
  private timer: number = RESONANCE.SLOT_INTERVAL_SECONDS;
  /** 현재 공명 배율(1.0~CLICK_BONUS). 1.0이면 비활성. */
  private bonus = 1;
  /** 연속 성공 콤보(개선 — 연달아 맞힐수록 클릭 D↑, 놓치면 0). */
  private combo = 0;
  /** 연구 강화(파생 — game.ts가 research에서 계산해 주입, 저장 안 함). 창 연장(초)·콤보 상한 증가. */
  private windowBonus = 0;
  private comboMaxBonus = 0;

  /**
   * 고정 dt 전진(systems §2-A 슬롯 상태머신 + 배율 감쇠). game.ts tick에서 매 틱 호출.
   *   슬롯이 닫혀 SLOT_INTERVAL 경과 → 열림. 열린 채 SLOT_WINDOW 경과(미클릭) → 방치 자동 공명 + 닫힘.
   * @param dt 고정 논리 스텝(초).
   * @returns 부수효과(D 증가·슬롯 이벤트). game.ts가 자원/버스에 반영.
   */
  update(dt: number): OrbitalUpdateResult {
    let dGained = 0;
    let slotOpened = false;
    let autoResonated = false;

    // 배율 감쇠: DECAY_SECONDS에 걸쳐 1.0으로 선형(systems §2-A).
    if (this.bonus > 1) {
      const decayRate = (RESONANCE.CLICK_BONUS - 1) / RESONANCE.DECAY_SECONDS; // 단위/초
      this.bonus = Math.max(1, this.bonus - decayRate * dt);
    }

    // 슬롯 타이머 전진. dt가 phase 경계를 넘을 수 있으므로 잔여를 다음 phase로 이월(결정성).
    this.timer -= dt;
    // 한 틱(50ms)이 여러 phase를 건너뛰는 일은 정상 진행에선 없지만(주기 ≥3s), 오프라인 점프
    //   대량 dt 방어로 while 루프 + 가드. 정상 틱은 1회 분기로 끝난다.
    let guard = 0;
    while (this.timer <= 0 && guard++ < 1000) {
      if (this.phase === 'closed') {
        // 닫힘 → 열림. 남은 음수 시간을 window에서 차감해 이월.
        this.phase = 'open';
        this.timer += this.windowSeconds();
        slotOpened = true;
      } else {
        // 열림 만료(미클릭) → 방치 자동 공명 발화 후 닫힘.
        this.phase = 'closed';
        this.timer += RESONANCE.SLOT_INTERVAL_SECONDS;
        this.bonus = Math.max(this.bonus, RESONANCE.IDLE_BASE);
        this.combo = 0; // 놓친 슬롯 → 콤보 리셋(연속 성공 끊김).
        dGained += RESONANCE.D_PER_IDLE;
        autoResonated = true;
      }
    }

    return { dGained, slotOpened, autoResonated };
  }

  /**
   * 공명 슬롯 클릭(능동 개입, ui-flow §2-E). 열린 슬롯이면 성공 — ×1.5 배율 + D 획득, 슬롯 소비.
   *   닫힌 슬롯이면 실패(아무 효과 없음 — 페널티 없음, systems §2-A "놓쳐도 진행은 계속").
   * @returns 성공 여부 + D 증가량. game.ts가 자원/피드백에 반영.
   */
  click(): OrbitalClickResult {
    if (this.phase !== 'open') {
      return { success: false, dGained: 0 };
    }
    // 성공: 배율 상향(이미 더 높으면 유지), 슬롯 소비. 콤보↑ → D 가속(연속 성공 보상, 놓치면 리셋).
    //   생산 배율(×1.5)은 불변 — 콤보는 D(연구 연료)만 키운다(레이스 안전).
    this.bonus = Math.max(this.bonus, RESONANCE.CLICK_BONUS);
    this.phase = 'closed';
    this.timer = RESONANCE.SLOT_INTERVAL_SECONDS;
    this.combo = Math.min(RESONANCE.COMBO_MAX + this.comboMaxBonus, this.combo + 1);
    const comboMult = 1 + (this.combo - 1) * RESONANCE.COMBO_D_STEP;
    return { success: true, dGained: RESONANCE.D_PER_CLICK * comboMult };
  }

  /** 현재 공명 배율(1.0~1.5). 체인 production에 곱(game.ts). 비활성 시 정확히 1.0. */
  getMultiplier(): number {
    return this.bonus;
  }

  /** 현재 슬롯 상태(UI 위젯 표시). */
  getPhase(): SlotPhase {
    return this.phase;
  }

  /** 현재 연속 성공 콤보(0~COMBO_MAX). UI 피드백 표시용. */
  getCombo(): number {
    return this.combo;
  }

  /** 슬롯 유효 창(초) — 기본 + 연구 연장(넓은 공명창). */
  private windowSeconds(): number {
    return RESONANCE.SLOT_WINDOW_SECONDS + this.windowBonus;
  }

  /** 연구 강화 주입(파생 — game.ts가 research.purchased에서 계산해 로드/구매 시 호출). 저장 안 함. */
  configure(windowBonus: number, comboMaxBonus: number): void {
    this.windowBonus = Number.isFinite(windowBonus) && windowBonus > 0 ? windowBonus : 0;
    this.comboMaxBonus =
      Number.isFinite(comboMaxBonus) && comboMaxBonus > 0 ? Math.floor(comboMaxBonus) : 0;
  }

  /**
   * 현재 phase 진행도(0~1). open=window 소진율(카운트다운 링), closed=다음 열림까지 진행율.
   *   UI 위젯이 링/프로그레스로 표시(ui-flow §2-E "카운트다운 링").
   */
  getPhaseProgress(): number {
    const full =
      this.phase === 'open' ? this.windowSeconds() : RESONANCE.SLOT_INTERVAL_SECONDS;
    if (full <= 0) return 0;
    // timer = 남은 시간 → 진행도 = 1 - 남은/전체. 경계 클램프.
    return Math.min(1, Math.max(0, 1 - this.timer / full));
  }

  // --- LayerMechanic 계약 (tech-arch §1.1·§3.4) ------------------------------

  /**
   * 직렬화(§1.1 R7). 슬롯 상태머신을 평문 JSON으로. save 봉투에 그대로 담김.
   *   배율(bonus)도 보존 — 로드 직후 진행 중인 공명이 끊기지 않게(짧은 끊김도 체감 손해).
   */
  serialize(): OrbitalSave {
    return { phase: this.phase, timer: this.timer, bonus: this.bonus, combo: this.combo };
  }

  /** 복원(§1.3 누락/손상 방어 — 기본값으로). 범위 밖 값은 안전 클램프. */
  deserialize(data: unknown): void {
    const d = (data ?? {}) as Partial<OrbitalSave>;
    this.phase = d.phase === 'open' ? 'open' : 'closed';
    this.timer =
      typeof d.timer === 'number' && Number.isFinite(d.timer) && d.timer >= 0
        ? d.timer
        : RESONANCE.SLOT_INTERVAL_SECONDS;
    this.bonus =
      typeof d.bonus === 'number' && Number.isFinite(d.bonus)
        ? Math.min(RESONANCE.CLICK_BONUS, Math.max(1, d.bonus))
        : 1;

    this.combo =
      typeof d.combo === 'number' && Number.isFinite(d.combo) && d.combo >= 0
        ? Math.min(RESONANCE.COMBO_MAX, Math.floor(d.combo))
        : 0;
  }

  /**
   * 오프라인 방치 기본 기여 배율(§3.4). 오프라인 계산기는 공명 공식을 모르고 이 값만 질의.
   *   방치 중에는 자동 공명만 동작하므로 "평균 IDLE_BASE 수준"의 장기 기여를 보고한다.
   *   (정확 적분 대신 보수적 평균 — 자동 공명이 주기적으로 IDLE_BASE를 찍고 감쇠하므로
   *    장기 평균은 1과 IDLE_BASE 사이. 중간값 채택 — economy 오프라인 §3 정합, 양수 보장.)
   */
  getIdleBaselineMultiplier(): number {
    return 1 + (RESONANCE.IDLE_BASE - 1) * 0.5;
  }
}
