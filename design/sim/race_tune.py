# ============================================================================
# LEGACY — OLD 11-wall schedule exploration (dec19..dec29, plus variants reaching
# dec31). SUPERSEDED by economy.md v0.2: canon is 6 walls
# [19, 21.5, 23, 24.5, 25.5, 26] + dec26 Planck cap, 7 phase transitions.
# Also uses the pre-fix decade_times.get(floor) wall timing, which mis-times
# fractional walls (e.g. 26.5 -> dec26); the fixed approach is engine final_t
# (see campaign6.py run_to_wall / final_verify.py).
# Kept for historical record ONLY — do NOT cite these numbers as current canon.
# ============================================================================
"""
Tune the boost-vs-inflation RACE to hit all targets at once.

Decision: QF-DRIVEN boost (so QF matters -> pillar "작아짐=강해짐").
    production_mult = 1 + base_rate * log10(1 + QF_total)
QF_total = floor(K * (lifetime_C / D_norm)^e), e=0.5

Inflation control = layer wall schedule (decade per layer).
We test variable wall gaps: small early (onboarding layers fast),
larger late (endgame breathing).

Targets:
  - first prestige: 4-6h
  - prestiges to endgame: 10-11
  - TOTAL: 2-4 weeks (14-28 d)  [GDD §65 "weeks"]
  - last layer run: <= ~2.5 d  (a check-in, not a death wall)
  - report a count-equivalent "10/20 prestige mult" for the research spec.
"""
import math
from engine import simulate

ALPHA=0.65
def run_layer(target_dec, mult, max_days=200.0, dt=4.0):
    res=simulate(growth=2.0,base_exp_slope=1.3,base_exp_lin=1,alpha=ALPHA,
                 mult=mult,days=max_days,dt=dt,target_decade=target_dec+0.001)
    return res["decade_times"].get(int(math.floor(target_dec))), res["final_C"]

def campaign(walls,K,D_norm,base_rate,e=0.5,dt=4.0):
    N=0;qf=0;tot=0.0;rows=[];life=0.0
    for i,w in enumerate(walls):
        mult=1.0+base_rate*math.log10(1.0+qf)
        t,C=run_layer(w,mult,dt=dt)
        if t is None: rows.append((i+1,w,mult,None,0,qf)); break
        tot+=t; life+=C
        qt=math.floor(K*(life/D_norm)**e); g=qt-qf; qf=qt; N+=1
        rows.append((i+1,w,mult,t,g,qf))
    return tot,rows,N,qf

# candidate wall schedules (inflation curves)
SCHEDS = {
  "flat+1":   [19,20,21,22,23,24,25,26,27,28,29],
  "gentle":   [18,19,20,21,22,23,24,25,26.5,28,29.5],   # 11 layers, widening
  "wide_end": [18,19,20,21,22,23.5,25,26.5,28,29.5,31],
}

print(f"{'sched':<10} {'base_rate':<10} {'1st(h)':>7} {'N':>3} {'total(d)':>9} {'last(d)':>8} {'mult_end':>9}")
print("-"*70)
for sname,walls in SCHEDS.items():
    for br in [0.30,0.40,0.50]:
        tot,rows,N,qf=campaign(walls,K=1,D_norm=1e26,base_rate=br)
        first=rows[0][3]/3600 if rows[0][3] else float('nan')
        last=rows[-1][3]/86400 if rows[-1][3] else float('nan')
        mend=rows[-1][2]
        print(f"{sname:<10} {br:<10} {first:7.2f} {N:3d} {tot/86400:9.2f} {last:8.2f} {mend:9.2f}")
