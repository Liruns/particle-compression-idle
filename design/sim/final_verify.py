"""
CONSOLIDATED VERIFICATION — every headline number for economy.md from one run.

*** v0.2 (2026-06-25): RE-SCHEDULED per director-review FAIL-1 mediation. ***
  WALLS reduced 11 -> 6, capped at dec26 (Planck). dec27/28/29 removed.
  7 phase transitions (6 walls PT1..PT6 + big crunch PT7).
  Multi-week retention now from BIG CRUNCH RE-DESCENT loop (see bigcrunch.py),
  not from a single long campaign. See campaign6.py + bigcrunch.py for the
  authoritative re-scheduled sims; this file kept for the legacy 11-wall record
  AND the re-scheduled headline block at the bottom.

Locked params (engine/prestige/offline UNCHANGED — only walls changed):
  Engine: growth_per_tier=2.2->1.8 (descending), base_k=10^(1+1.3k), alpha=0.65
  Prestige: QF_total=floor((lifetime_C/1e26)^0.5), mult=1+0.25*log10(1+QF)
  Walls (NEW): [19, 21.5, 23, 24.5, 25.5, 26]  (6 walls, dec26 cap)
  Offline: cap24h, mod0.65, post-prestige 1.0, log-bonus LB=0.5, tamper clamp 48h
"""
import math
from engine import simulate
from offline import effective_offline_seconds

ALPHA=0.65
GROWTH=[2.2-0.4/7*i for i in range(8)]   # tier1=2.2 ... tier8=1.8
SLOPE=1.3; LIN=1
K=1.0; D_NORM=1e26; BASE_RATE=0.25; E=0.5
WALLS=[19, 21.5, 23, 24.5, 25.5, 26]      # v0.2 re-scheduled (was dec19..29)

def C_at(d): return 10.0**(d/ALPHA)-1.0
def run_layer(t_dec, mult, dt=2.0):
    # use final_t (engine stops AT target) so FRACTIONAL walls (e.g. 21.5) work
    r=simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=LIN,
               alpha=ALPHA, mult=mult, days=400.0, dt=dt, target_decade=t_dec)
    return r["final_t"], r["final_C"]

print("="*72)
print("1) BASELINE SINGLE RUN (mult=1) — re-validated GDD §8")
print("="*72)
r=simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=LIN,
           alpha=ALPHA, mult=1.0, days=4.0, dt=1.0, target_decade=27)
dt=r["decade_times"]; prev=0
seg={1:0,9:0,14:0,20:0,26:0}
for d in sorted(dt):
    if d in (9,14,20,26): seg[d]=dt[d]/3600
print(f"  onboarding dec1-9: {seg[9]:.2f}h | dec14: {seg[14]:.2f}h | "
      f"dec20: {seg[20]:.2f}h | dec26: {seg[26]/24:.2f}d")

print("\n"+"="*72)
print("2) PRESTIGE CAMPAIGN (active back-to-back time)")
print("="*72)
N=0;qf=0;tot=0.0;life=0.0;rows=[]
for w in WALLS:
    mult=1.0+BASE_RATE*math.log10(1.0+qf)
    t,C=run_layer(w,mult)
    if t is None: break
    tot+=t; life+=C; qt=math.floor(K*(life/D_NORM)**E); g=qt-qf; qf=qt; N+=1
    rows.append((w,mult,t,g,qf))
print(f"  first prestige: {rows[0][2]/3600:.2f}h active")
print(f"  prestiges: {N}, final mult: {rows[-1][1]:.2f}x, final QF: {qf:.2e}")
print(f"  total ACTIVE: {tot/86400:.2f} days; per-run grows "
      f"{rows[0][2]/3600:.1f}h -> {rows[-1][2]/86400:.2f}d")
cr=(rows[-1][1]-1)/N
print(f"  count-equivalent base_rate (mult=1+N*cr): cr={cr:.3f} -> 6 prestiges={1+6*cr:.2f}x")
print(f"  +BIG CRUNCH (PT7) = 7th transition; final production_mult={rows[-1][1]:.3f}x "
      f"({'PASS 2-3x' if 2.0<=rows[-1][1]<=3.0 else 'OUT'})")

print("\n"+"="*72)
print("3) OFFLINE CREDIT TABLE")
print("="*72)
for away in [8,24,48,168]:
    e=effective_offline_seconds(away*3600)/3600
    print(f"  away {away:3}h -> {e:5.1f}h effective ({e/away*100:.0f}%)")

print("\n"+"="*72)
print("4) INTEGRATED CALENDAR (2 checkins/day + offline)")
print("="*72)
from offline import effective_offline_seconds as eos
N=0;qf=0;life=0.0;cal_s=0.0;gap_i=0;rows2=[]
for li,w in enumerate(WALLS):
    mult=1.0+BASE_RATE*math.log10(1.0+qf)
    need,_=run_layer(w,mult)
    if need is None: break
    post=(N>0); prog=0.0; first=True; start=cal_s
    while prog<need:
        weekend=(gap_i%5==4); gap_h=20 if weekend else (14 if gap_i%2==0 else 10); gap_i+=1
        mod=1.0 if (first and post) else 0.65
        prog+=eos(gap_h*3600,modifier=mod)+15*60
        cal_s+=gap_h*3600+15*60; first=False
    life+=C_at(w); qt=math.floor(K*(life/D_NORM)**E); g=qt-qf; qf=qt; N+=1
    rows2.append((w,mult,need/3600,(cal_s-start)/86400,cal_s/86400))
print(f"  TOTAL CALENDAR (1st big crunch): {cal_s/86400:.2f} days = {cal_s/86400/7:.2f} weeks")
print(f"  L1 (first prestige): {rows2[0][4]:.2f} cal-days")
mid = len(rows2)//2
print(f"  to L{mid+1} (mid):  {rows2[mid][4]:.2f} cal-days")
print(f"  to L{len(rows2)} (big crunch dec26): {rows2[-1][4]:.2f} cal-days")
print(f"  last layer alone: {rows2[-1][3]:.2f} cal-days")
print(f"  NOTE: single campaign caps at dec26 (~0.8wk). Multi-week retention")
print(f"        from BIG CRUNCH RE-DESCENT loop -> see bigcrunch.py")
