"""
WALL RESCHEDULER (FAIL-1 fix, director [지시 2] + §2.3 constraints).

Preserve verified engine (engine.py / offline.py). Change ONLY the wall schedule.

Constraints:
  WALLS = 6, first = dec19 (4.3h hold), last = dec26 (Planck cap). dec27/28/29 removed.
  Each sub층 single-run dwell (mult=1) >= 4h. Rear-weighting allowed.
  7 phase transitions (6 walls + big crunch). final production_mult in 2-3x at base_rate=0.25.

This file ONLY searches/validates the wall schedule and dwell times.
"""
import math
from engine import simulate

ALPHA = 0.65
GROWTH = [2.2 - 0.4/7*i for i in range(8)]   # tier1=2.2 ... tier8=1.8
SLOPE = 1.3; LIN = 1

def baseline_decade_times(dt=1.0, target=27.0):
    """mult=1 single run: cumulative time to reach each decade boundary."""
    r = simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=LIN,
                 alpha=ALPHA, mult=1.0, days=8.0, dt=dt, target_decade=target)
    return r["decade_times"]

def cum_hours_at(decade_times, d):
    """Interpolate cumulative hours at a (possibly fractional) decade.
    decade_times maps int decade -> seconds at which floor(dec) first hit d."""
    lo = int(math.floor(d))
    hi = lo + 1
    if lo not in decade_times:
        return None
    t_lo = decade_times[lo] / 3600.0
    if abs(d - lo) < 1e-9:
        return t_lo
    if hi not in decade_times:
        return None
    t_hi = decade_times[hi] / 3600.0
    # log-linear interpolation in time vs decade (time grows ~exp in decade)
    # use linear in log(time) since cost is exponential
    if t_lo <= 0 or t_hi <= 0:
        return t_lo + (t_hi - t_lo) * (d - lo)
    log_t = math.log(t_lo) + (math.log(t_hi) - math.log(t_lo)) * (d - lo)
    return math.exp(log_t)

def dwell_times(walls, decade_times):
    """Single-run (mult=1) dwell time in each sub층 = cum(wall_i) - cum(wall_{i-1}).
    First sub층 dwell = cum(wall_0) - cum(dec9) ... but per director,
    layer entry != prestige for known physics. The MISSING sub층 starts at dec19.
    We define dwell of sub층 i as time between consecutive walls (back-to-back single run).
    Sub층 1 (preon) dwell = time from dec9 (quark limit, last known) to dec19?
    No: per §2.5 each missing sub층 = the run that ENDS at its wall.
    Run i length (mult=1) = cum(wall_i) - cum(wall_{i-1}), wall_0 prior = onboarding end.
    For dwell-as-experienced we use the SINGLE CONTINUOUS run: time between walls.
    """
    times = []
    prev = None
    for w in walls:
        c = cum_hours_at(decade_times, w)
        if c is None:
            times.append(None); prev = c; continue
        if prev is None:
            times.append(c)  # cumulative from start of this run segment
        else:
            times.append(c - prev)
        prev = c
    return times

if __name__ == "__main__":
    dts = baseline_decade_times()
    print("=== mult=1 baseline cumulative decade times (h) ===")
    for d in sorted(dts):
        print(f"  dec{d:2d}: {dts[d]/3600:8.3f} h")

    def report(name, walls):
        print(f"\n=== {name}: WALLS = {walls} ===")
        dw = dwell_times(walls, dts)
        ok = True
        for w, d in zip(walls, dw):
            f = "OK" if (d is not None and d >= 4.0) else "FAIL<4h"
            if d is None or d < 4.0: ok = False
            print(f"    wall dec{w:6}: cum {cum_hours_at(dts,w):8.3f}h | dwell {d:8.3f}h  [{f}]")
        print(f"    --> ALL DWELL >= 4h: {ok}")
        return ok

    report("Candidate A (director start)", [19, 20.5, 22, 23.5, 25, 26])

    # ---- greedy search: first=19, last=26, 6 walls, each inter-wall gap >= 4h ----
    def find_into_window(decade_times, w0, wN, n_walls, min_gap_h,
                         step=0.01):
        """Place n_walls between w0..wN so every continuous-run gap >= min_gap_h,
        front wall = w0 (its 'dwell' is cum-from-start). Greedy from front, then
        verify last wall == wN reachable. Returns list or None."""
        walls = [w0]
        cum_prev = cum_hours_at(decade_times, w0)
        d = w0
        for i in range(n_walls - 2):  # interior walls
            # advance until gap >= min_gap_h
            target_cum = cum_prev + min_gap_h
            dd = d
            while dd < wN:
                dd += step
                c = cum_hours_at(decade_times, dd)
                if c is not None and c >= target_cum:
                    break
            d = round(dd, 2)
            walls.append(d)
            cum_prev = cum_hours_at(decade_times, d)
        # last wall is fixed at wN; check final gap
        walls.append(wN)
        final_gap = cum_hours_at(decade_times, wN) - cum_prev
        return walls, final_gap

    print("\n" + "="*72)
    print("GREEDY SEARCH: 6 walls in [19,26], every gap >= target")
    print("="*72)
    for mg in [4.0, 4.5, 5.0, 5.5, 6.0]:
        w, fg = find_into_window(dts, 19, 26, 6, mg)
        print(f"  min_gap={mg}h -> {w}  (final gap dec{w[-2]}->26 = {fg:.2f}h)")

    # ---- GEOMETRIC distribution: spread cumulative-time milestones so gaps grow
    #      smoothly (rear-weighted) instead of front-loading. Find decade for each
    #      target cumulative time by inverse interpolation. ----
    def decade_at_cum(decade_times, target_h, lo_d=19.0, hi_d=26.0, step=0.005):
        d = lo_d
        while d <= hi_d:
            c = cum_hours_at(decade_times, d)
            if c is not None and c >= target_h:
                return round(d, 2)
            d += step
        return round(hi_d, 2)

    def geometric_walls(decade_times, w0, wN, n_walls):
        """Walls so cumulative-time milestones grow geometrically (gaps rear-weighted,
        every gap > previous, none artificially thin)."""
        c0 = cum_hours_at(decade_times, w0)
        cN = cum_hours_at(decade_times, wN)
        ratio = (cN / c0) ** (1.0 / (n_walls - 1))
        walls = [w0]
        for i in range(1, n_walls - 1):
            tc = c0 * (ratio ** i)
            walls.append(decade_at_cum(decade_times, tc))
        walls.append(wN)
        return walls

    print("\n" + "="*72)
    print("GEOMETRIC DISTRIBUTION: 6 walls, cumulative-time gaps grow smoothly")
    print("="*72)
    wg = geometric_walls(dts, 19, 26, 6)
    report("Candidate B (geometric)", wg)

    print("\n" + "="*72)
    print(">>> FINAL CHOSEN SCHEDULE — mult=1 baseline dwell <<<")
    print("="*72)
    report("FINAL", [19, 21.5, 23, 24.5, 25.5, 26])

    # Round to clean 0.5 grid near the geometric solution, keep gaps>=4h
    print("\n--- Clean-grid candidates near geometric ---")
    for cand in [
        [19, 20.5, 22, 23.5, 25, 26],     # director original (FAIL ref)
        [19, 21, 22.5, 24, 25, 26],
        [19, 21, 22.5, 24, 25.5, 26],
        [19, 21, 23, 24.5, 25.5, 26],
        [19, 21.5, 23, 24.5, 25.5, 26],
        wg,
    ]:
        report(f"cand", cand)
