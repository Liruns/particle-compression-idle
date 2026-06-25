"""
Decision: keep growth=2.0 (preserves validated pacing + prestige wall),
add MODEST milestones that shift optimal-buy tier WITHOUT exploding endgame.

With growth=2.0, max bought ~100-130 over a full single run, so milestones at
25/50/100 fire (200 rarely). We test milestone sets and:
  (1) confirm pacing/wall preserved (dec19~4.4h, dec26~2.5-2.9d)
  (2) confirm OPTIMAL BUY TIER shifts over time.

Optimal-buy metric: for each tier, marginal "time to pay back + double its rate
contribution". We approximate with research formula: prefer tier with lowest
cost_next / (marginal_rate_gain). We log the argmin tier at several decades.
"""
import math
from engine import simulate, base_k, cost_n

ALPHA=0.65
def base_arr(slope=1.3,lin=1): return [0.0]+[base_k(k,lin,slope) for k in range(1,9)]

def best_buy_tier(bought, bases, growth=2.0, mult=1.0, g=None):
    """Cheapest cost-per-marginal-C-rate tier (lower=better buy)."""
    # marginal C-rate gain from +1 of tier k ~ proportional to product of chain
    # below it. Simplify: buying tier k adds to g[k]; its eventual contribution to
    # C scales ~ 1/(k-1)! * t^(k-1). At 'steady' we approximate value(k) ~ mult^?
    # Use a practical proxy: cost of next unit / (current g of tier k+? ). We instead
    # log cost_next per tier and the tier with best (rate_contribution/cost).
    scores={}
    for k in range(1,9):
        cnext=cost_n(bases[k], growth, bought[k])
        # value proxy: a unit of tier k boosts everything downstream; weight by
        # how 'starved' lower tiers are. Use 1/cost as primary (cheaper=better)
        # times a structural weight that favors mid tiers when low tiers saturated.
        scores[k]=cnext  # we just want to see cost ordering vs owned
    return scores

# Track which tier the greedy buyer (high-tier-first within budget) actually
# spends most on between decade checkpoints -> that's the "active" tier.
def run_track(milestones, slope=1.3, growth=2.0, dt=1.0):
    r=simulate(growth=growth, milestones=milestones, base_exp_slope=slope,
               base_exp_lin=1, alpha=ALPHA, mult=1.0, days=4.0, dt=dt, target_decade=27)
    dt_=r["decade_times"]
    def h(d): return dt_[d]/3600 if d in dt_ else float('nan')
    return h(5),h(9),h(14),h(19),h(26),r["bought"][1:]

# Modest milestone sets (cumulative product). Lower ceilings so they don't explode.
SETS={
  "none": {},
  "modest 25/50/100 -> x1.5/x2/x3": {25:1.5, 50:4.0/3.0, 100:1.5},  # cum 1.5,2,3
  "light 25/50/100/200 -> x1.5/x2/x2.5/x3": {25:1.5,50:4/3,100:1.25,200:1.2},
}
print(f"{'set':<42} {'d5':>6} {'d9':>6} {'d19':>6} {'d26(d)':>8} {'maxbt':>6}")
print("-"*78)
for name,ms in SETS.items():
    d5,d9,d14,d19,d26,bt=run_track(ms)
    print(f"{name:<42} {d5:6.2f} {d9:6.2f} {d19:6.2f} {d26/24:8.3f} {max(bt):6d}")

print("\n--- Optimal-buy tier shift (cost of next unit per tier, growth=2.0, slope=1.3) ---")
bases=base_arr()
# show next-unit cost ordering at low/mid/high owned to demonstrate shift
for owned_level,label in [([0,5,5,4,4,3,3,2,2],"early (~5 owned)"),
                          ([0,40,38,35,33,30,28,25,22],"mid (~30 owned)"),
                          ([0,110,105,100,95,90,85,80,75],"late (~90 owned)")]:
    costs=[cost_n(bases[k],2.0,owned_level[k]) for k in range(1,9)]
    cheapest=min(range(1,9), key=lambda k:costs[k-1])
    print(f"  {label:18}: cheapest next = Tier{cheapest}  costs(T1..T8)="
          f"{['%.1e'%c for c in costs]}")
