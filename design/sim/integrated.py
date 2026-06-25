# ============================================================================
# v0.2 UPDATE: re-scheduled from the OLD 11 walls (dec19..dec29) to the canon
# 6 walls [19, 21.5, 23, 24.5, 25.5, 26] + dec26 Planck cap, and fixed the
# fractional-wall timing bug (now uses engine final_t, not decade_times.get(floor)).
# AUTHORITATIVE integrated-calendar sims are bigcrunch.py and final_verify.py §4
# (economy.md §4.2); this file is a secondary calendar check kept in sync.
# NOTE: the engine driver here still uses flat growth=2.0, whereas the authoritative
# sims use the descending per-tier growth 2.2->1.8 — so treat the exact numbers
# here as indicative, not the economy.md headline.
# ============================================================================
"""
INTEGRATED CALENDAR PACING: prestige campaign + offline + realistic check-ins.

Player model (idle / hardcore-but-casual check-ins):
  - 2 check-ins/day: ~14h gap (overnight) + ~10h gap (workday), plus weekend longer.
  - Each check-in: collect offline (effective online-seconds), then a short active
    burst (ACTIVE_BURST minutes of real online progression).
  - Progress is measured as cumulative EFFECTIVE ONLINE SECONDS toward each layer
    wall; when wall reached -> prestige (mult up, reset), advance to next layer.
  - This converts "active sim seconds" (from prestige_final) into CALENDAR days.

We reuse the per-layer required-online-time at the layer's mult (the run length
from the campaign), and consume it via offline+active chunks across calendar days.
"""
import math
from engine import simulate
from offline import effective_offline_seconds

ALPHA=0.65
def run_layer_seconds(t_dec,mult,dt=4.0):
    # Use final_t (engine stops AT target) so FRACTIONAL walls (e.g. 21.5) are
    # timed correctly. The old decade_times.get(floor) snapped 21.5 -> dec21
    # (wrong time, or None for an unreached floor). Matches campaign6.py
    # run_to_wall + final_verify.py.
    r=simulate(growth=2.0,base_exp_slope=1.3,base_exp_lin=1,alpha=ALPHA,
               mult=mult,days=200.0,dt=dt,target_decade=t_dec)
    return r["final_t"],r["final_C"]

def integrated(walls,K,D_norm,base_rate,
               checkins_per_day=2, active_burst_min=15,
               gaps_h=(14,10), weekend_gap_h=20, verbose=True):
    """
    Simulate calendar time to complete the campaign with offline+checkins.
    gaps_h: weekday gaps between check-ins. weekend adds a long gap.
    Returns calendar_days, per-layer calendar table.
    """
    N=0; qf=0; life=0.0
    calendar_s=0.0
    # required effective-online seconds for current layer (at current mult)
    rows=[]
    day=0
    gap_i=0
    for li,wall in enumerate(walls):
        mult=1.0+base_rate*math.log10(1.0+qf)
        need_s,_=run_layer_seconds(wall,mult)
        if need_s is None: break
        # first run after a prestige: next offline modifier = 1.0 (comeback)
        post_prestige = (N>0)
        layer_cal_start=calendar_s
        progressed=0.0
        first_chunk=True
        # consume need_s via alternating offline gaps + active bursts
        while progressed < need_s:
            # choose gap (cycle weekday gaps, inject weekend every ~5 gaps)
            is_weekend = (gap_i % 5 == 4)
            gap_h = weekend_gap_h if is_weekend else gaps_h[gap_i % len(gaps_h)]
            gap_i+=1
            mod = 1.0 if (first_chunk and post_prestige) else 0.65
            eff = effective_offline_seconds(gap_h*3600, modifier=mod)
            # active burst (real online seconds)
            burst = active_burst_min*60
            chunk = eff + burst
            progressed += chunk
            calendar_s += gap_h*3600 + burst   # calendar advances by the full gap
            first_chunk=False
            if progressed>=need_s: break
        life += _layer_C(wall)
        qt=math.floor(K*(life/D_norm)**0.5); g=qt-qf; qf=qt; N+=1
        cal_days=(calendar_s-layer_cal_start)/86400
        rows.append((li+1,wall,mult,need_s/3600,cal_days,calendar_s/86400,qf))
        if verbose:
            print(f"  L{li+1:2d} dec{wall} mult={mult:6.3f} need={need_s/3600:6.2f}h online "
                  f"-> {cal_days:5.2f} cal-days  (cum {calendar_s/86400:6.2f}d) tot={qf:.2e}QF")
    return calendar_s/86400, rows, N, qf

def _layer_C(d): return 10.0**(d/ALPHA)-1.0

if __name__=="__main__":
    walls=[19, 21.5, 23, 24.5, 25.5, 26]   # v0.2 canon (6 walls, dec26 Planck cap; was dec19..29)
    print("=== INTEGRATED CALENDAR (2 checkins/day, 15min burst, modifier 0.65, post-prestige 1.0) ===")
    cal,rows,N,qf=integrated(walls,1,1e26,0.25)
    print(f"\nTOTAL CALENDAR (first big crunch): {cal:.1f} days = {cal/7:.1f} weeks, "
          f"{N} prestiges (PT1..PT{N}), {qf:.2e} QF")
    # phase-transition segments (6 walls: PT1 onboarding, PT2..PT(N-1) mid, PT(N)=dec26 crunch)
    print(f"\nOnboarding+codex (to PT1 prestige): {rows[0][5]:.1f} cal-days")
    print(f"Mid (PT2..PT{N-1}): {rows[-2][5]-rows[0][5]:.1f} cal-days")
    print(f"To big crunch (PT{N}, dec26): {rows[-1][5]:.1f} cal-days total "
          f"({rows[-1][4]:.2f} cal-days for the final layer)")
