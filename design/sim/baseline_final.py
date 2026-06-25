"""Locked baseline: slope=1.3, growth=2.0, alpha=0.65, mult=1, single run.
Full decade-by-decade pacing + segment cumulative table.
This becomes the re-validated GDD §8 baseline for the discrete model.
"""
import math
from engine import simulate

res = simulate(growth=2.0, base_exp_slope=1.3, base_exp_lin=1, alpha=0.65,
               mult=1.0, days=4.0, dt=1.0, target_decade=27)
dt = res["decade_times"]
print("=== BASELINE (slope=1.3, growth=2.0, mult=1, single run) ===")
print(f"{'dec':>3} {'cum_h':>9} {'cum_d':>7} {'inc_min':>9} {'inc_h':>8}")
prev = 0.0
for d in sorted(dt):
    inc = dt[d]-prev; prev = dt[d]
    print(f"{d:3d} {dt[d]/3600:9.3f} {dt[d]/86400:7.3f} {inc/60:9.2f} {inc/3600:8.3f}")
print(f"\nfinal dec {res['final_decade']:.2f} @ {res['final_t']/86400:.3f}d")

# segment summary
def cum(d): return dt[d]/3600
print("\n--- Segment summary (single run baseline) ---")
print(f"Onboarding  (dec 1-9, known physics): {cum(9):.2f}h")
print(f"Codex done  (dec 9):                  {cum(9):.2f}h")
print(f"Accel       (dec 9-20):               +{cum(20)-cum(9):.2f}h -> {cum(20):.2f}h ({cum(20)/24:.2f}d)")
print(f"Hardcore    (dec 20-26):              +{cum(26)-cum(20):.2f}h -> {cum(26):.2f}h ({cum(26)/24:.2f}d)")
