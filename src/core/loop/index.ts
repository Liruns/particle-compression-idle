/**
 * loop — F게이트 F3: 고정 timestep 게임 루프. tick(로직) / render(표현) 분리.
 * (tech-architecture.md §4.1·§4.2)
 *
 * 두 루프는 독립이며 서로의 주기를 모른다(§4.1):
 *   - tick(로직): 고정 dt 누산기(accumulator). 결정적(같은 입력→같은 결과). 생산·비용·상전이 판정.
 *   - render(표현): requestAnimationFrame. 상태→화면(읽기 전용). 로직 안 함.
 *
 * 고정 timestep 핵심: render가 느려도(저사양·백그라운드) 로직은 정확한 게임시간으로 진행.
 *   프레임드랍이 진행속도를 바꾸지 않음. economy의 결정적 시뮬과 일치(§4.1, R9).
 *
 * 누산기 패턴(§4.1): 실제 경과시간을 모아 고정 dt 단위로 tick을 0~N회 실행(catch-up).
 *   **catch-up 상한**을 둬서 긴 멈춤 후 폭주 방지. 상한 초과분은 오프라인 경로로 넘긴다(§6.4).
 *
 * 1일차(F3): dt·누산기·catch-up 상한·tick/render 콜백 분리 구조를 지금 박는다.
 *   economy 시뮬은 dt=1~2s 결정적 가정(§4.1, R9) → 본 루프의 tick dt를 그와 정합되게 선택.
 */

/** 고정 논리 스텝(초). economy 결정적 시뮬 가정(dt=1~2s, R9)과 정합. */
export const TICK_DT = 1 / 20; // 50ms = 초당 20틱. 1초 = 20틱(부드러운 진행 + 결정성).

/**
 * catch-up 상한(초). 한 rAF 사이에 이 시간 이상 밀렸으면 실시간 따라잡기를 포기.
 * 초과분은 오프라인 경로(offline 모듈)가 일괄 처리(§4.1·§6.4).
 */
export const MAX_CATCHUP_SECONDS = 5;

/**
 * 부동소수 경계 보정 ε. dt 정확히 한 칸(예: 0.05×20=1.0)이 누적될 때 마지막 스텝이
 * 0.04999…로 떨어져 한 틱을 빠뜨리는 것을 막는다. 누산기는 나머지를 이월하므로
 * 장기적으론 시간 손실이 없지만, 경계에서의 1틱 드랍을 ε로 흡수해 결정성을 매끄럽게 한다.
 */
const TICK_EPSILON = 1e-9;

/** tick 콜백: 고정 dt(초)만큼 로직을 결정적으로 전진. */
export type TickFn = (dt: number) => void;

/** render 콜백: 보간계수 alpha(0~1)로 표현 갱신. 상태를 변경하지 않는다. */
export type RenderFn = (alpha: number) => void;

/** catch-up 상한 초과 콜백: 누락 시간(초)을 오프라인 경로로 위임(§6.4). */
export type OverflowFn = (overflowSeconds: number) => void;

export interface GameLoopOptions {
  tick: TickFn;
  render: RenderFn;
  /** 누락분 위임(없으면 단순 폐기 — 헬로 셸 단계 기본). */
  onOverflow?: OverflowFn;
  /** 테스트용 시간 소스(기본 performance.now). */
  now?: () => number;
}

/**
 * GameLoop — 고정 timestep 누산기 루프.
 *
 * 동작(§4.1):
 *   frame:
 *     frameTime = now - last;  last = now
 *     accumulator += min(frameTime, MAX_CATCHUP)   // 폭주 방지
 *     while (accumulator >= dt): tick(dt); accumulator -= dt
 *     render(accumulator / dt)                      // 보간 alpha
 */
export class GameLoop {
  private readonly tickFn: TickFn;
  private readonly renderFn: RenderFn;
  private readonly onOverflow?: OverflowFn;
  private readonly now: () => number;

  private rafId: number | null = null;
  private last = 0;
  private accumulator = 0;
  private running = false;

  /** 누적 tick 수(디버그·검증용). */
  public totalTicks = 0;

  constructor(opts: GameLoopOptions) {
    this.tickFn = opts.tick;
    this.renderFn = opts.render;
    this.onOverflow = opts.onOverflow;
    this.now = opts.now ?? (() => performance.now());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = this.now();
    this.accumulator = 0;
    this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame(() => this.frame());
  }

  /** 한 rAF 프레임: 누산 → 고정 dt tick 0~N회 → render. */
  private frame(): void {
    if (!this.running) return;

    const current = this.now();
    let frameSeconds = (current - this.last) / 1000;
    this.last = current;
    if (frameSeconds < 0) frameSeconds = 0; // 시계 역행 방어

    // catch-up 상한 초과분은 오프라인 경로로(§4.1·§6.4)
    if (frameSeconds > MAX_CATCHUP_SECONDS) {
      const overflow = frameSeconds - MAX_CATCHUP_SECONDS;
      frameSeconds = MAX_CATCHUP_SECONDS;
      this.onOverflow?.(overflow);
    }

    this.accumulator += frameSeconds;

    // 고정 dt로 결정적 전진
    let guard = 0;
    const maxSteps = Math.ceil(MAX_CATCHUP_SECONDS / TICK_DT) + 2;
    while (this.accumulator >= TICK_DT - TICK_EPSILON) {
      this.tickFn(TICK_DT);
      this.accumulator -= TICK_DT;
      this.totalTicks++;
      if (++guard > maxSteps) {
        // 방어선: 어떤 이유로든 무한 루프가 되면 누산기 비우고 탈출.
        this.accumulator = 0;
        break;
      }
    }

    // 보간 alpha(0~1): 표현이 tick 사이를 부드럽게.
    this.renderFn(this.accumulator / TICK_DT);

    this.scheduleFrame();
  }

  /**
   * 테스트/오프라인용 수동 전진: dt 단위 tick을 n회 실행(rAF 없이 결정적).
   * 누산기 경로와 동일한 tick을 쓰므로 재현성 보장.
   */
  advance(seconds: number): void {
    let remaining = seconds;
    let guard = 0;
    while (remaining >= TICK_DT - TICK_EPSILON) {
      this.tickFn(TICK_DT);
      remaining -= TICK_DT;
      this.totalTicks++;
      if (++guard > 10_000_000) break;
    }
  }
}

export { Scheduler } from './scheduler';
