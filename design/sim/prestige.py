# ============================================================================
# NOTE (v0.2): first-prestige CALIBRATION only (K, D_norm, e, and the dec19 first
# wall). Verified to contain NO 11-wall schedule — its findings remain canon:
# first prestige = dec19 (~4.3h), K=1, D_norm=1e26, e=0.5. The full wall SCHEDULE
# is defined elsewhere; current canon is the 6-wall list in campaign6.py /
# final_verify.py (economy.md v0.2). This file predates that reschedule but is
# NOT stale.
# ============================================================================
"""
Prestige (phase transition) reward design + first-prestige timing.

Reward form (sqrt-based, AdCap-proven):
    QF_gain = floor( K * (lifetime_C / D_norm)^e ) - QF_already_claimed
    e = 0.5 (sqrt). Option e=0.33 (cube root) compared.
Permanent boost:
    production_mult = 1 + prestige_count * base_rate
Race: boost must NOT outrun the per-layer target inflation.

We need: FIRST prestige available ~4-6h into play.
The player prestiges when crossing a LAYER wall (a decade target per layer).
Layer L target decade D_L; first layer wall at some decade reached ~4-6h.

From baseline (mult=1): decade@time:
  dec 18 ~3.3h, dec 19 ~4.4h, dec 20 ~6.1h, dec 21 ~8.6h
So a first-prestige wall around decade 19-20 lands at 4.4-6.1h. Good anchor.

But layers reset progress. Layer 1 = molecule->...; we map LAYER boundaries
to decade targets. Known physics (dec ~9) is layer-internal codex, NOT a reset.
First RESET wall should be the molecule-layer "completion" ~ decade 19-20.

We calibrate K, D_norm so QF_gain at first prestige is a satisfying small int
(e.g. 5-15 QF), and the boost-per-prestige is meaningful.
"""
import math
from engine import simulate

# --- get baseline decade->time and decade->C maps ---
def baseline_maps(mult=1.0):
    res = simulate(growth=2.0, base_exp_slope=1.3, base_exp_lin=1, alpha=0.65,
                   mult=mult, days=4.0, dt=1.0, target_decade=27)
    # also capture C at each decade
    return res

res = baseline_maps()
dt = res["decade_times"]
ALPHA = 0.65
# C at decade boundary d: dec = alpha*log10(C+1) -> C = 10^(d/alpha)-1
def C_at_decade(d):
    return 10.0**(d/ALPHA) - 1.0

print("decade -> time(h) -> C")
for d in [9, 16, 17, 18, 19, 20, 21, 22]:
    if d in dt:
        print(f"  dec {d}: {dt[d]/3600:6.2f}h   C={C_at_decade(d):.3e}")

# --- prestige reward calibration ---
# First prestige wall: decade 19 (lifetime_C ~ C_at_decade(19)), time ~4.4h
def qf_total(lifetime_C, K, D_norm, e=0.5):
    return math.floor(K * (lifetime_C / D_norm)**e)

print("\n--- Calibrate K, D_norm so first prestige (dec19, ~4.4h) gives ~8-12 QF ---")
firstC = C_at_decade(19)
print(f"lifetime_C at first wall (dec19) = {firstC:.3e}")
for D_norm in [1e20, 1e22, 1e24, 1e26]:
    for K in [1, 3, 10]:
        q = qf_total(firstC, K, D_norm, 0.5)
        print(f"  K={K:<3} D_norm={D_norm:.0e}: first QF = {q}")
