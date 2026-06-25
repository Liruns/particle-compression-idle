"""Sweep base cost slope & growth to flatten the early bootstrap hump
and hit GDD §8 intent for a SINGLE mult=1 run:
  - onboarding (dec 1-9 known physics) reachable in ~1h (codex onboarding)
  - dec 14 ~1.5-2h, dec 20 ~6h, dec 26 ~2.5-3d
The discrete sim is more realistic than the closed-form GDD approx,
so we re-anchor parameters to the INTENT, not the old numbers.
"""
import math
from engine import simulate

def checkpoints(res):
    dt = res["decade_times"]
    def h(d): return dt[d]/3600 if d in dt else float('nan')
    return h(5), h(9), h(14), h(20), h(26)

print(f"{'config':<42} {'d5':>7} {'d9':>7} {'d14':>7} {'d20':>7} {'d26(d)':>8}")
print("-"*85)
for slope in [1.0, 1.3, 1.5, 1.7, 2.0]:
    for growth in [1.6, 1.8, 2.0]:
        res = simulate(growth=growth, base_exp_slope=slope, days=6.0, dt=2.0,
                       base_exp_lin=1, target_decade=27)
        d5,d9,d14,d20,d26 = checkpoints(res)
        print(f"slope={slope} growth={growth:<4}                    "
              f"{d5:7.2f} {d9:7.2f} {d14:7.2f} {d20:7.2f} {d26/24:8.3f}")
