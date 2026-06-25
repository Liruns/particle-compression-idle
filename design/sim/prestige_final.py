# ============================================================================
# LEGACY — OLD 11-wall schedule (dec19..dec29, "11 layers / L11"). SUPERSEDED by
# economy.md v0.2. Canon is now 6 walls [19, 21.5, 23, 24.5, 25.5, 26] + dec26
# Planck cap, 7 phase transitions (6 walls PT1..PT6 + big crunch PT7). The QF
# formula / base_rate=0.25 are unchanged, but the schedule + layer-count framing
# below is stale. Authoritative sims: campaign6.py / bigcrunch.py / final_verify.py.
# Kept for historical record ONLY — do NOT cite these numbers as current canon.
# ============================================================================
"""
FINALIZE prestige formula. Decisions:
  schedule = flat+1 (walls 19..29), gives first prestige 4.44h (in 4-6h target)
  boost = QF-driven log:  mult = 1 + base_rate * log10(1 + QF_total)
  QF_total = floor(K*(lifetime_C/D_norm)^e)
We also report a COUNT-equivalent base_rate for the research-spec form
  mult = 1 + N*count_rate, so the GDD can state the simpler version too.

Compare sqrt(e=0.5) vs cube-root(e=0.33) for QF curve steepness.
Pick base_rate to satisfy: 10 prestiges ~2x, 20 (hypothetical) ~3x is impossible
with only 11 layers, so we calibrate to: mult at FINAL layer (L11) in 2.5-3.5x.
"""
import math
from engine import simulate
ALPHA=0.65
def run_layer(t_dec,mult,max_days=200.0,dt=4.0):
    r=simulate(growth=2.0,base_exp_slope=1.3,base_exp_lin=1,alpha=ALPHA,
               mult=mult,days=max_days,dt=dt,target_decade=t_dec+0.001)
    return r["decade_times"].get(int(math.floor(t_dec))),r["final_C"]

def campaign(walls,K,D_norm,base_rate,e=0.5,dt=4.0,verbose=False):
    N=0;qf=0;tot=0.0;rows=[];life=0.0
    for i,w in enumerate(walls):
        mult=1.0+base_rate*math.log10(1.0+qf)
        t,C=run_layer(w,mult,dt=dt)
        if t is None: break
        tot+=t;life+=C
        qt=math.floor(K*(life/D_norm)**e);g=qt-qf;qf=qt;N+=1
        rows.append((i+1,w,mult,t,g,qf))
        if verbose:
            ce = (mult-1)/(0.30) if base_rate else 0
            print(f"  L{i+1:2d} dec{w} mult={mult:6.3f} run={t/3600:7.2f}h({t/86400:5.2f}d) "
                  f"+{g:.3e}QF tot={qf:.3e}")
    return tot,rows,N,qf

walls=[19,20,21,22,23,24,25,26,27,28,29]

print("=== FINAL: sqrt e=0.5, K=1, D_norm=1e26, base_rate=0.30 ===")
tot,rows,N,qf=campaign(walls,1,1e26,0.30,e=0.5,verbose=True)
print(f"TOTAL active {tot/86400:.2f}d, {N} prestiges, final mult {rows[-1][2]:.2f}\n")

# count-equivalent base_rate: fit mult_end = 1 + N*cr  -> cr=(mult_end-1)/N
cr=(rows[-1][2]-1)/N
print(f"COUNT-equivalent base_rate for research spec (mult=1+N*cr): cr={cr:.4f}")
print(f"  -> at 10 prestiges: mult={1+10*cr:.2f}; at 11: {1+11*cr:.2f}")
print(f"  (research target 10-20 -> 2-3x; we hit {1+10*cr:.2f}x at 10, fits low end)\n")

print("=== Cube-root option e=0.33 (steeper QF), base_rate retuned 0.18 ===")
# cube root makes QF smaller, so need bigger base_rate
tot2,rows2,N2,qf2=campaign(walls,1,1e26,0.18,e=0.33,verbose=True)
print(f"TOTAL active {tot2/86400:.2f}d, final mult {rows2[-1][2]:.2f}, final QF {qf2:.3e}")
