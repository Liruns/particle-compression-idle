"""Diagnose purchase dynamics & calibrate to GDD §8 curve.
GDD §8 target:
  onboarding decades 1-14: ~7 min/decade flat -> cumulative 1.6h
  accel 15-20: 14min -> 1.7h/decade, cumulative 6.2h
  hardcore 21-26: 2.6h -> 22.5h/decade, cumulative 2.74d
"""
import math
from engine import simulate, base_k, max_affordable, bulk_cost

def run_and_report(label, **kw):
    res = simulate(**kw)
    dt = res["decade_times"]
    print(f"\n=== {label} ===")
    prev = 0.0
    for d in sorted(dt):
        inc = dt[d] - prev
        prev = dt[d]
        mark = ""
        if d in (14, 20, 26):
            mark = "  <== checkpoint"
        print(f"  dec {d:2d}: cum {dt[d]/3600:8.3f}h  inc {inc/60:7.2f}min{mark}")
    print(f"  final dec {res['final_decade']:.2f} @ {res['final_t']/86400:.3f}d  bought={res['bought'][1:]}")
    return res

# Baseline as written
run_and_report("growth=2.0 base_slope=2 (current)", growth=2.0, days=4.0, dt=1.0)
