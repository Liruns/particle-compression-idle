"""
Part 2: Cost-curve tuning — per-tier descending growth + milestone multipliers.

Research §2: cost multiplier hY tier (1.07-1.15), HIGH on low tiers, LOW on high tiers.
Milestones: 25/50/100/200 owned -> x2/x3/x5/x7 (boost on the tier's production).

BUT: my baseline used growth=2.0 flat (which gave the validated pacing).
growth 1.07-1.15 are MUCH cheaper -> chain explodes far faster.
Question: with descending growth + milestones, does pacing still hold, and does
the OPTIMAL purchase tier shift over time (so all 8 tiers stay relevant)?

We compare:
  (a) baseline growth=2.0 flat, no milestones (validated)
  (b) descending growth [1.15..1.07] + milestones
and report decade pacing + which tier is "best buy" (lowest time-to-double-rate)
at several time points.
"""
import math
from engine import simulate

ALPHA=0.65
# descending growth per tier (tier1=1.15 ... tier8=1.08)
GROWTH_DESC=[1.15,1.14,1.13,1.12,1.11,1.10,1.09,1.08]
MILESTONES={25:2.0, 50:1.5, 100:5.0/3.0, 200:7.0/5.0}
# note: milestones MULTIPLY cumulatively. To get x2,x3,x5,x7 TOTAL at 25/50/100/200,
# the per-threshold factors are 2, 3/2, 5/3, 7/5 (cumulative product = 2,3,5,7).

def report(label, **kw):
    r=simulate(alpha=ALPHA, days=4.0, dt=1.0, target_decade=27, **kw)
    dt=r["decade_times"]
    def h(d): return dt[d]/3600 if d in dt else float('nan')
    print(f"\n=== {label} ===")
    print(f"  dec5={h(5):.2f}h dec9={h(9):.2f}h dec14={h(14):.2f}h dec19={h(19):.2f}h "
          f"dec26={h(26)/24:.2f}d  bought={r['bought'][1:]}")
    return r

# (a) validated baseline
report("(a) growth=2.0 flat, no milestones [validated]",
       growth=2.0, base_exp_slope=1.3)

# (b) descending growth, with milestones - cheaper costs, need higher base to compensate
for slope in [1.3, 2.0, 2.5, 3.0]:
    report(f"(b) desc-growth 1.15..1.08 + milestones, base_slope={slope}",
           growth_per_tier=GROWTH_DESC, milestones=MILESTONES, base_exp_slope=slope)
