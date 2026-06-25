/**
 * layers/mechanics/harmonics — 진동 하모닉스 (끈층 L7). (systems.md §2-F, M1.6)
 *
 * 미지 두 번째 메커니즘(필러 ④). 위상 겹침(상태 선택)·오비탈 공명(타이밍 클릭)과 또 다른 결:
 *   **자동 누적 → 하모닉 공명 → 티어 폭발의 예측 게임**. 끈이론의 진동 모드를 메커니즘으로 —
 *   진동 에너지 V가 쌓이다 특정 임계마다 8단 체인의 한 티어가 순환적으로 공명(burst)한다.
 *   "다음 공명 티어가 무엇인가"를 미리 알고 그 티어에 투자하는 전술 플레이(수동 클릭 없음).
 *
 * 동작 모델(systems §2-F 의사코드 충실):
 *   V += FILL_RATE · dt
 *   harmonic_n = floor(V / HARMONIC_INTERVAL);  resonant_tier = (harmonic_n % 8) + 1
 *   V가 HARMONIC_INTERVAL·n 임계를 교차할 때마다 → 그 티어 burst(BURST_MULT, BURST_SECONDS 지속).
 *   8티어(T1~T8) 순환 → 방치 시 모든 티어가 차례로 혜택(자동 밸런싱, systems §2-F).
 *
 * 자기완결(orbital.ts·phase.ts 동형): 상태머신·직렬화·방치기본값 자기 책임. game.ts는 update(dt)를
 *   호출하고 결과(공명 티어·burst 배율 맵)만 읽어 체인 생산에 반영(단방향 §4.1).
 *
 * Decimal 규칙: V·타이머는 스칼라(native — 임계마다 잔여 이월로 무한 누적 없음). 산출은 배율(스칼라).
 *   체인 production 합성은 game.ts가 티어별 배율 맵으로 적용(D/QF 직접 산출 없음 — 순수 배율 메커니즘).
 */

import { HARMONICS } from '../../../data/constants';
import { CHAIN_TIERS } from '../../chain';
import type { LayerMechanic } from './index';

/** update(dt) 결과: 이번 전진에서 새로 발생한 공명(있으면). */
export interface HarmonicsUpdateResult {
  /** 이번 update에서 새 하모닉 공명이 일어났는가(UI 펄스·로그·도감 진행). */
  resonated: boolean;
  /** 공명했다면 폭발 티어(1..8). resonated=false면 0. */
  resonantTier: number;
  /** 이번 update까지 누적 공명 횟수(도감 "공명 패턴 기록" 임계). */
  totalResonances: number;
}

/** 직렬화 형태(평문 JSON — §1.1 R7). */
interface HarmonicsSave {
  /** 누적 진동 에너지(임계 잔여 이월 — 무한 누적 아님, 8주기마다 사실상 리셋 효과). */
  v: number;
  /** 활성 burst 남은 시간(초)[8] — 각 티어별. 0이면 해당 티어 burst 없음. */
  burst: number[];
  /** 누적 공명 횟수(도감 임계). */
  totalResonances: number;
}

/**
 * Harmonics — 진동 하모닉스 메커니즘(끈층). LayerMechanic 자기완결 구현.
 *
 * 생성 직후 V=0, burst 없음. 진입 후 FILL_RATE로 충전되며 첫 HARMONIC_INTERVAL에서 첫 공명.
 */
export class Harmonics implements LayerMechanic {
  readonly id = 'vibration_harmonics';

  /** 누적 진동 에너지 V. 임계 교차 시 잔여만 남기지 않고 계속 누적(harmonic_n이 단조 증가). */
  private v = 0;
  /** 티어별(T1~T8) 활성 burst 남은 시간(초). 길이 CHAIN_TIERS. */
  private burst: number[] = new Array<number>(CHAIN_TIERS).fill(0);
  /** 누적 공명 횟수. */
  private totalResonances = 0;
  /** 직전 update까지의 harmonic_n(임계 교차 검출 기준). */
  private lastHarmonicN = 0;

  /**
   * 고정 dt 전진(systems §2-F V 누적 + 하모닉 공명 검출 + burst 감쇠). game.ts tick에서 매 틱 호출.
   *   V를 채우고, harmonic_n이 증가하면(임계 교차) 해당 티어 burst를 점화한다. 오프라인 대량 dt도
   *   한 번에 여러 공명을 가드 안에서 결정적으로 소화(가장 최근 티어만 burst 유지 — 과거 burst는 만료).
   * @param dt 고정 논리 스텝(초).
   * @returns 부수효과(공명 발생·티어). game.ts가 체인 배율·버스에 반영.
   */
  update(dt: number): HarmonicsUpdateResult {
    // burst 타이머 감쇠(모든 티어).
    for (let i = 0; i < this.burst.length; i++) {
      if (this.burst[i] > 0) this.burst[i] = Math.max(0, this.burst[i] - dt);
    }

    // V 누적.
    this.v += HARMONICS.FILL_RATE * dt;

    // harmonic_n 증가분 = 이번에 교차한 임계 수. 각 교차마다 공명 1회(티어 순환).
    const newHarmonicN = Math.floor(this.v / HARMONICS.HARMONIC_INTERVAL);
    let resonated = false;
    let resonantTier = 0;
    if (newHarmonicN > this.lastHarmonicN) {
      // 여러 임계를 한 번에 넘었을 수 있음(오프라인 점프). 각각 공명 카운트, 마지막 티어만 burst 점화.
      const crossings = newHarmonicN - this.lastHarmonicN;
      // 가드: 비정상 대량 dt에서도 공명 카운트 폭주 방지(상한). 정상 진행은 1.
      const counted = Math.min(crossings, 100000);
      this.totalResonances += counted;
      // 마지막 교차의 티어 = (newHarmonicN-1) % 8 + 1 (직전 임계가 점화한 티어).
      resonantTier = ((newHarmonicN - 1) % CHAIN_TIERS) + 1;
      this.burst[resonantTier - 1] = HARMONICS.BURST_SECONDS;
      this.lastHarmonicN = newHarmonicN;
      resonated = true;
    }

    return { resonated, resonantTier, totalResonances: this.totalResonances };
  }

  /**
   * 티어별 현재 배율 맵(1..8 → 배율). burst 활성 티어만 BURST_MULT, 나머지 1.0.
   *   game.ts가 체인 생산 합성 시 티어별로 곱한다(체인 전체 균일 배율이 아닌 **티어 선택 배율** —
   *   위상/공명의 "전체 곱"과 다른 결: 특정 티어만 폭발).
   * @returns 길이 CHAIN_TIERS 배열, 각 원소는 해당 티어 배율(≥1).
   */
  getTierMultipliers(): number[] {
    const out = new Array<number>(CHAIN_TIERS).fill(1);
    for (let i = 0; i < this.burst.length; i++) {
      if (this.burst[i] > 0) out[i] = HARMONICS.BURST_MULT;
    }
    return out;
  }

  /**
   * 다음에 공명할 티어(1..8) — UI "공명 스케줄 미리보기"(ui-flow §2-E). 예측 게임 핵심.
   *   현재 harmonic_n 기준 다음 임계가 점화할 티어 = newHarmonicN % 8 + 1.
   */
  getNextResonantTier(): number {
    const currentN = Math.floor(this.v / HARMONICS.HARMONIC_INTERVAL);
    return (currentN % CHAIN_TIERS) + 1;
  }

  /** 다음 공명까지 진행도(0~1) — UI V 에너지 바. 현재 임계 구간 내 비율. */
  getChargeProgress(): number {
    const within = this.v % HARMONICS.HARMONIC_INTERVAL;
    return Math.min(1, Math.max(0, within / HARMONICS.HARMONIC_INTERVAL));
  }

  /** 누적 공명 횟수(도감 "끈 진동 모드" 임계). */
  getTotalResonances(): number {
    return this.totalResonances;
  }

  // --- LayerMechanic 계약 ----------------------------------------------------

  /** 직렬화(§1.1 R7). V·burst·누적 공명을 평문 JSON으로. */
  serialize(): HarmonicsSave {
    return {
      v: this.v,
      burst: [...this.burst],
      totalResonances: this.totalResonances,
    };
  }

  /** 복원(§1.3 누락/손상 방어). 음수/비유한 → 0, burst 배열 길이 정규화. lastHarmonicN 재계산. */
  deserialize(data: unknown): void {
    const d = (data ?? {}) as Partial<HarmonicsSave>;
    this.v = typeof d.v === 'number' && Number.isFinite(d.v) && d.v >= 0 ? d.v : 0;
    this.burst = new Array<number>(CHAIN_TIERS).fill(0);
    if (Array.isArray(d.burst)) {
      for (let i = 0; i < CHAIN_TIERS; i++) {
        const b = d.burst[i];
        this.burst[i] = typeof b === 'number' && Number.isFinite(b) && b >= 0 ? b : 0;
      }
    }
    this.totalResonances =
      typeof d.totalResonances === 'number' && Number.isFinite(d.totalResonances) && d.totalResonances >= 0
        ? Math.floor(d.totalResonances)
        : 0;
    // lastHarmonicN을 현재 V에서 재유도 → 로드 직후 거짓 공명 폭발 방지(결정성).
    this.lastHarmonicN = Math.floor(this.v / HARMONICS.HARMONIC_INTERVAL);
  }

  /**
   * 오프라인 방치 기본 기여 배율(§3.4). burst가 8티어를 순환하며 짧게 BURST_MULT를 찍으므로,
   *   장기 평균은 "BURST_SECONDS / 공명간격(=HARMONIC_INTERVAL/FILL_RATE) × (BURST_MULT−1) / 8티어"로
   *   희석된 소폭(+). 보수적 평균(양수 보장) — 오프라인 §3 정합.
   */
  getIdleBaselineMultiplier(): number {
    const interval = HARMONICS.HARMONIC_INTERVAL / HARMONICS.FILL_RATE; // 공명 1회 간격(초)
    const dutyCycle = interval > 0 ? HARMONICS.BURST_SECONDS / interval : 0; // burst 점유율
    // 한 시점에 한 티어만 burst → 체인 평균 기여는 (BURST_MULT−1)·dutyCycle / CHAIN_TIERS.
    const avgBoost = ((HARMONICS.BURST_MULT - 1) * dutyCycle) / CHAIN_TIERS;
    return 1 + Math.max(0, avgBoost);
  }
}
