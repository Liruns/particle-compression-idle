/**
 * scheduler — 독립 주기 작업 분리. (tech-architecture.md §4.2)
 *
 * AD intervals.js처럼 서로 다른 주기의 작업을 독립 객체로 분리(start/stop 가능):
 *   autoSave(수십 초~분) / cloudSync(분, Steam만) / everySecond(1초, 저빈도 UI·lastSave 갱신).
 *
 * 저장을 별도 스케줄러로 빼는 이유: 큰 세이브 직렬화가 tick 한 프레임에 끼면 hitch(§4.2).
 *   빈도·타이밍을 게임 루프(tick)와 독립 제어.
 *
 * 구현: 게임 루프의 시간축과 분리해, 콜백을 interval(ms)마다 호출하는 단순 누산 타이머.
 *   게임 루프의 tick에서 update(dt)를 호출해 구동하거나(시간 일관), setInterval로 독립 구동.
 *   여기선 update(dt) 주입형(고정 timestep과 시간 일관 유지).
 */

export type ScheduledTask = () => void;

interface Entry {
  intervalSeconds: number;
  elapsed: number;
  fn: ScheduledTask;
  enabled: boolean;
}

/**
 * Scheduler — 이름표 붙은 주기 작업 모음. 게임 루프에서 update(dt) 호출로 구동.
 * (tick과 같은 시간축 → 백그라운드/오프라인에서도 일관, §6.4)
 */
export class Scheduler {
  private entries = new Map<string, Entry>();

  /** 주기 작업 등록. interval초마다 fn 호출. */
  every(name: string, intervalSeconds: number, fn: ScheduledTask): void {
    this.entries.set(name, { intervalSeconds, elapsed: 0, fn, enabled: true });
  }

  setEnabled(name: string, enabled: boolean): void {
    const e = this.entries.get(name);
    if (e) e.enabled = enabled;
  }

  remove(name: string): void {
    this.entries.delete(name);
  }

  /** 게임 루프 tick에서 호출. 누적 경과로 각 작업의 주기 도달 시 실행. */
  update(dt: number): void {
    for (const e of this.entries.values()) {
      if (!e.enabled) continue;
      e.elapsed += dt;
      if (e.elapsed >= e.intervalSeconds) {
        // 누적분을 주기로 나눠 1회만 실행(드리프트 방지: 남은 나머지 보존).
        e.elapsed %= e.intervalSeconds;
        e.fn();
      }
    }
  }
}
