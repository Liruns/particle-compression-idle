"""
Reconcile pacing (needs steep-ish growth) with milestone relevance
(needs enough purchases that 25/50/100/200 all fire).

Sweep a MIDDLE growth band with descending per-tier growth and milestones,
re-calibrating base_slope to hold dec19 ~4-6h (first-prestige wall) and
dec26 ~2.5-3d for the mult=1 single run.

Descending growth: tier1=g_hi ... tier8=g_lo (spread = 0.04).
Milestones cumulative -> total x2/x3/x5/x7 at 25/50/100/200.
"""
import math
from engine import simulate

ALPHA=0.65
MILESTONES={25:2.0, 50:1.5, 100:5.0/3.0, 200:7.0/5.0}  # cumulative -> 2,3,5,7

def desc(g_hi, spread=0.04):
    # tier1 highest, tier8 lowest
    step=spread/7
    return [g_hi - step*i for i in range(8)]

def run(g_hi, slope, dt=1.0):
    gp=desc(g_hi)
    r=simulate(growth_per_tier=gp, milestones=MILESTONES, base_exp_slope=slope,
               base_exp_lin=1, alpha=ALPHA, mult=1.0, days=5.0, dt=dt, target_decade=27)
    dt_=r["decade_times"]
    def h(d): return dt_[d]/3600 if d in dt_ else float('nan')
    return h(5),h(9),h(14),h(19),h(26),r["bought"][1:]

print(f"{'g_hi':>5} {'slope':>6} {'d5':>6} {'d9':>6} {'d14':>6} {'d19':>6} {'d26(d)':>8} {'maxbought':>10}")
print("-"*70)
for g_hi in [1.30,1.40,1.50,1.60]:
    for slope in [1.5,1.7,1.9]:
        d5,d9,d14,d19,d26,bt=run(g_hi,slope)
        print(f"{g_hi:5.2f} {slope:6.2f} {d5:6.2f} {d9:6.2f} {d14:6.2f} {d19:6.2f} {d26/24:8.3f} {max(bt):10d}")
