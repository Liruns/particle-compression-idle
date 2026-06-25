# ============================================================================
# LEGACY — OLD 11-wall schedule (dec19..dec29). SUPERSEDED by economy.md v0.2.
# Canon is now 6 walls [19, 21.5, 23, 24.5, 25.5, 26] + dec26 Planck cap, with
# 7 phase transitions (6 walls PT1..PT6 + big crunch PT7). Authoritative sims:
# campaign6.py / bigcrunch.py / rescheduler.py / final_verify.py.
# Kept for historical record ONLY — do NOT cite these numbers as current canon.
# ============================================================================
"""
FULL MULTI-PRESTIGE CAMPAIGN simulator.
Each layer: progress from 0 with current production_mult until reaching the
layer's wall (target decade). Then prestige: gain QF, mult increases,
reset compressors & C, advance to next layer (higher decade target).

Key question: does the boost-vs-inflation race produce weeks of play with
~10-11 prestiges, each run taking progressively longer (retention), without
the boost trivializing later layers?

prestige reward:  QF_total = floor(K*(lifetime_C/D_norm)^e); gain = total-claimed
boost:            mult = 1 + N_prestige * base_rate
layer wall:       target decade per layer (schedule below)
"""
import math
from engine import simulate

ALPHA = 0.65
def C_at_decade(d): return 10.0**(d/ALPHA) - 1.0

def run_layer_to_decade(target_dec, mult, max_days=60.0, dt=2.0):
    """Time (s) for a fresh run at given mult to reach target_dec."""
    res = simulate(growth=2.0, base_exp_slope=1.3, base_exp_lin=1, alpha=ALPHA,
                   mult=mult, days=max_days, dt=dt, target_decade=target_dec+0.001)
    dtimes = res["decade_times"]
    td = int(math.floor(target_dec))
    if td in dtimes:
        return dtimes[td], res["final_C"]
    return None, res["final_C"]  # didn't reach

def campaign(layer_walls, K, D_norm, base_rate, e=0.5, dt=2.0, verbose=True):
    """
    layer_walls: list of target decades, one per layer (the wall to clear).
    Returns total time, per-layer table.
    Lifetime_C for prestige = C reached at the wall this run
      (we use since-reset C at wall; cumulative across layers handled by claimed).
    """
    N = 0                  # prestige count
    qf_claimed = 0
    total_t = 0.0
    rows = []
    cumulative_lifetime_C = 0.0
    for i, wall in enumerate(layer_walls):
        mult = 1.0 + N * base_rate
        t_layer, C_reached = run_layer_to_decade(wall, mult, dt=dt)
        if t_layer is None:
            rows.append((i+1, wall, mult, None, N, qf_claimed, None))
            if verbose: print(f"  Layer {i+1}: STALLED at mult={mult:.2f} (wall dec{wall})")
            break
        total_t += t_layer
        # lifetime C accumulates across runs (AdCap-style lifetime)
        cumulative_lifetime_C += C_reached
        qf_total = math.floor(K * (cumulative_lifetime_C / D_norm)**e)
        qf_gain = qf_total - qf_claimed
        qf_claimed = qf_total
        N += 1
        rows.append((i+1, wall, mult, t_layer, N, qf_gain, qf_claimed))
        if verbose:
            print(f"  L{i+1:2d} wall=dec{wall:<3} mult={mult:6.2f}  run={t_layer/3600:7.2f}h "
                  f"({t_layer/86400:5.2f}d)  +{qf_gain:>6}QF  total={qf_claimed:>7}QF")
    return total_t, rows, N, qf_claimed

if __name__ == "__main__":
    # Layer wall schedule: 11 layers (GDD §9: ~10-11 to endgame).
    # Known physics layers early (smaller decade gaps), unknown region later (bigger).
    # Walls rise: molecule->atom->nucleus->nucleon->quark->[unknown x6]
    walls = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]
    print("=== CAMPAIGN: K=1, D_norm=1e26, base_rate=0.15, sqrt ===")
    tot, rows, N, qf = campaign(walls, K=1, D_norm=1e26, base_rate=0.15, e=0.5)
    print(f"\nTOTAL: {tot/86400:.2f} days, {N} prestiges, {qf} QF")
