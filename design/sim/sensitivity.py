# ============================================================================
# LEGACY / REFERENCE — OLD 10-12 layer-count sensitivity (walls dec19..dec29).
# SUPERSEDED as canon by economy.md v0.2 (6 walls [19, 21.5, 23, 24.5, 25.5, 26],
# dec26 Planck cap, 7 phase transitions). This layer-count sweep is intentionally
# PRESERVED as the formula-robustness reference cited in economy.md §1.5 — but it
# is NOT current canon. Authoritative sims: campaign6.py / bigcrunch.py / rescheduler.py.
# ============================================================================
"""Final base_rate dial + layer-count sensitivity (systems still confirming sub-layers).
Lock sqrt e=0.5. Target final mult ~3.0x, first prestige 4-6h."""
import math
from engine import simulate
ALPHA=0.65
def run_layer(t_dec,mult,dt=4.0):
    r=simulate(growth=2.0,base_exp_slope=1.3,base_exp_lin=1,alpha=ALPHA,
               mult=mult,days=200.0,dt=dt,target_decade=t_dec+0.001)
    return r["decade_times"].get(int(math.floor(t_dec))),r["final_C"]
def campaign(walls,K,D_norm,base_rate,e=0.5,dt=4.0):
    N=0;qf=0;tot=0.0;rows=[];life=0.0
    for w in walls:
        mult=1.0+base_rate*math.log10(1.0+qf)
        t,C=run_layer(w,mult,dt=dt)
        if t is None:break
        tot+=t;life+=C;qt=math.floor(K*(life/D_norm)**e);g=qt-qf;qf=qt;N+=1
        rows.append((w,mult,t,g,qf))
    return tot,rows,N,qf

print("--- base_rate dial (walls 19..29, 11 layers) ---")
print(f"{'br':>5} {'1st(h)':>7} {'total(d)':>9} {'last(d)':>8} {'mult_end':>9}")
walls11=[19,20,21,22,23,24,25,26,27,28,29]
for br in [0.22,0.25,0.28,0.30]:
    tot,rows,N,qf=campaign(walls11,1,1e26,br)
    print(f"{br:5} {rows[0][2]/3600:7.2f} {tot/86400:9.2f} {rows[-1][2]/86400:8.2f} {rows[-1][1]:9.2f}")

print("\n--- layer-count sensitivity (base_rate=0.25, sub-layers unconfirmed) ---")
SCH={
 "10 layers":[19,20,21,22,23,24,25,26,27,28],
 "11 layers":[19,20,21,22,23,24,25,26,27,28,29],
 "12 layers":[19,20,21,22,23,24,25,26,27,28,29,30],
}
print(f"{'layers':<10} {'N':>3} {'total(d)':>9} {'last(d)':>8} {'mult_end':>9} {'finalQF':>10}")
for name,w in SCH.items():
    tot,rows,N,qf=campaign(w,1,1e26,0.25)
    print(f"{name:<10} {N:3d} {tot/86400:9.2f} {rows[-1][2]/86400:8.2f} {rows[-1][1]:9.2f} {qf:10.2e}")
