# ============================================================================
# LEGACY — OLD 11-wall schedule (dec19..dec29). SUPERSEDED by economy.md v0.2.
# Canon is now 6 walls [19, 21.5, 23, 24.5, 25.5, 26] + dec26 Planck cap, with
# 7 phase transitions (6 walls PT1..PT6 + big crunch PT7). Authoritative sims:
# campaign6.py / bigcrunch.py / rescheduler.py / final_verify.py.
# Kept for historical record ONLY — do NOT cite these numbers as current canon.
# ============================================================================
"""
Campaign v2 — make QF MEANINGFUL in the boost (fix: huge QF was cosmetic).

Three boost models compared:
  A) count-only:   mult = 1 + N*base_rate                      (research spec literal)
  B) QF-log:       mult = 1 + base_rate * log10(1+QF_total)    (QF drives power, self-damping)
  C) hybrid:       mult = (1 + N*base_rate) * (1 + qf_rate*log10(1+QF))

We want: ~10-11 prestiges, weeks total, each run progressively longer but NOT
explosively (last run < ~3 days so it stays a "check-in" not a wall of death).
And boost at 10-20 prestiges ~ 2-3x (for the count component).
"""
import math
from engine import simulate

ALPHA = 0.65
def C_at_decade(d): return 10.0**(d/ALPHA) - 1.0

def run_layer(target_dec, mult, max_days=120.0, dt=4.0):
    res = simulate(growth=2.0, base_exp_slope=1.3, base_exp_lin=1, alpha=ALPHA,
                   mult=mult, days=max_days, dt=dt, target_decade=target_dec+0.001)
    td = int(math.floor(target_dec))
    return res["decade_times"].get(td), res["final_C"]

def campaign(walls, K, D_norm, base_rate, qf_rate=0.0, model="A", e=0.5, dt=4.0, verbose=True):
    N=0; qf_claimed=0; total_t=0.0; rows=[]; life_C=0.0
    for i,wall in enumerate(walls):
        if model=="A":
            mult = 1.0 + N*base_rate
        elif model=="B":
            mult = 1.0 + base_rate*math.log10(1.0+qf_claimed)
        elif model=="C":
            mult = (1.0 + N*base_rate)*(1.0 + qf_rate*math.log10(1.0+qf_claimed))
        t_layer, C_reached = run_layer(wall, mult, dt=dt)
        if t_layer is None:
            if verbose: print(f"  L{i+1} STALL mult={mult:.2f}")
            break
        total_t += t_layer
        life_C += C_reached
        qf_total = math.floor(K*(life_C/D_norm)**e)
        qf_gain = qf_total-qf_claimed; qf_claimed=qf_total; N+=1
        rows.append((i+1,wall,mult,t_layer,qf_gain,qf_claimed))
        if verbose:
            print(f"  L{i+1:2d} dec{wall:<3} mult={mult:7.3f} run={t_layer/3600:7.2f}h"
                  f"({t_layer/86400:5.2f}d) +{qf_gain:.3e}QF tot={qf_claimed:.3e}")
    return total_t,rows,N,qf_claimed

if __name__=="__main__":
    walls=[19,20,21,22,23,24,25,26,27,28,29]
    for model,kw in [("A",dict(base_rate=0.15)),
                     ("B",dict(base_rate=0.5)),
                     ("C",dict(base_rate=0.10,qf_rate=0.05))]:
        print(f"\n===== MODEL {model} {kw} =====")
        tot,rows,N,qf=campaign(walls,K=1,D_norm=1e26,**kw,model=model)
        print(f"TOTAL {tot/86400:.2f}d, {N} prestiges, last run "
              f"{rows[-1][3]/86400:.2f}d, final mult {rows[-1][2]:.2f}")
