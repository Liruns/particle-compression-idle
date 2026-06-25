"""
BIG CRUNCH RE-DESCENT CALENDAR SIM (director §2.3 #4 — NEW).

Goal:
  (a) First-big-crunch total CALENDAR time (2 check-ins/day + offline). Target ~1.5-2 weeks.
  (b) 2nd-campaign run AFTER big crunch: starting QF carries over, so the player
      fast re-traverses the 6 missing sub-layers. Show the re-descent curve and
      prove multi-week ("수 주") retention even though a single campaign caps at dec26.

Reuses verified offline.effective_offline_seconds + campaign6 run lengths.
WALLS = [19,21.5,23,24.5,25.5,26], base_rate=0.25.

Calendar model identical to integrated.py:
  2 check-ins/day, gaps 14h/10h, weekend 20h every 5th gap, 15min active burst,
  offline modifier 0.65 (post-prestige first chunk = 1.0), cap 24h, tamper 48h.
"""
import math
from engine import simulate
from offline import effective_offline_seconds as eos

ALPHA = 0.65
GROWTH = [2.2 - 0.4/7*i for i in range(8)]
SLOPE = 1.3; LIN = 1
K = 1.0; D_NORM = 1e26; BASE_RATE = 0.25; E = 0.5
WALLS = [19, 21.5, 23, 24.5, 25.5, 26]

def C_at(d): return 10.0**(d/ALPHA) - 1.0

def run_full_h(t_dec, mult, dt=2.0):
    r = simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=LIN,
                 alpha=ALPHA, mult=mult, days=400.0, dt=dt, target_decade=t_dec)
    return r["final_t"]/3600.0

def consume_calendar(need_h, gap_i, post_prestige):
    """Consume need_h of effective-online time via offline gaps + 15min bursts.
    Returns (calendar_seconds_added, new_gap_i)."""
    need_s = need_h*3600.0
    prog = 0.0; cal = 0.0; first = True
    while prog < need_s:
        weekend = (gap_i % 5 == 4)
        gap_h = 20 if weekend else (14 if gap_i % 2 == 0 else 10)
        gap_i += 1
        mod = 1.0 if (first and post_prestige) else 0.65
        prog += eos(gap_h*3600, modifier=mod) + 15*60
        cal += gap_h*3600 + 15*60
        first = False
    return cal, gap_i

def campaign_calendar2(walls, life_start=0.0, gap_i=0, post_first=False, verbose=True):
    N = 0; life = life_start
    qf = math.floor(K*(life/D_NORM)**E) if life > 0 else 0
    cal_s = 0.0; rows = []
    for i, w in enumerate(walls):
        mult = 1.0 + BASE_RATE*math.log10(1.0 + qf)
        need = run_full_h(w, mult)
        post = (N > 0) or (post_first and N == 0)
        add, gap_i = consume_calendar(need, gap_i, post)
        cal_s += add
        life += C_at(w)
        qf = math.floor(K*(life/D_NORM)**E)
        N += 1
        rows.append({"pt": N, "wall": w, "mult": mult, "need_h": need,
                     "cal_days": add/86400, "cum_cal": cal_s/86400, "qf": qf})
        if verbose:
            print(f"    PT{N} dec{w:5} mult={mult:6.3f} run={need:6.2f}h "
                  f"-> {add/86400:5.2f} cal-d (cum {cal_s/86400:5.2f}d) QF={qf:.2e}")
    return cal_s/86400, life, qf, gap_i, rows

if __name__ == "__main__":
    print("="*78)
    print("FIRST BIG CRUNCH — single campaign calendar (2 checkins/day + offline)")
    print(f"WALLS={WALLS}, base_rate={BASE_RATE}")
    print("="*78)
    cal1, life1, qf1, gap_i, rows1 = campaign_calendar2(WALLS, 0.0, 0, post_first=False)
    print(f"\n  >>> FIRST PRESTIGE (PT1) at: {rows1[0]['cum_cal']:.2f} cal-days")
    print(f"  >>> BIG CRUNCH (reach dec26, PT6->PT7) at: {cal1:.2f} cal-days "
          f"= {cal1/7:.2f} weeks")
    print(f"  >>> lifetime_C at crunch: {life1:.3e}, QF: {qf1:.3e}")
    band = "PASS (1.5-2wk)" if 10.5 <= cal1 <= 14.5 else ("short" if cal1<10.5 else "long")
    print(f"  >>> target ~1.5-2 weeks: {cal1/7:.2f}wk [{band}]")

    print("\n" + "="*78)
    print("BIG CRUNCH RE-DESCENT — 2nd campaign starts with carried QF")
    print("Big crunch = final QF explosion; new run keeps QF -> fast re-traverse.")
    print("="*78)
    # After big crunch, the PT7 explosion grants a big QF jump (planck-depth bonus).
    # Model: lifetime_C carries (AdCap), so 2nd campaign starts with life1 already banked.
    # Mult is high from start -> sub-layers re-traversed fast but still re-descend dec0->26.
    print("\n  2nd campaign (re-descent), starting lifetime_C carried:")
    cal2, life2, qf2, gap_i, rows2 = campaign_calendar2(WALLS, life1, gap_i, post_first=True)
    print(f"\n  >>> 2nd big crunch at +{cal2:.2f} cal-days ({cal2/7:.2f} wk) after the first")
    print(f"  >>> cumulative calendar (2 campaigns): {cal1+cal2:.2f} cal-days "
          f"= {(cal1+cal2)/7:.2f} weeks")
    speedup = (cal1/cal2 - 1)*100 if cal2 > 0 else 0
    print(f"  >>> re-descent is {cal1/cal2:.2f}x faster than first campaign "
          f"({speedup:+.0f}%) — but still {cal2:.1f} cal-days of engagement")

    print("\n" + "="*78)
    print("MULTI-WEEK RETENTION SUMMARY")
    print("="*78)
    print(f"  First big crunch:        {cal1:.1f} cal-days ({cal1/7:.2f} wk)")
    print(f"  + 2nd re-descent:        {cal2:.1f} cal-days -> {cal1+cal2:.1f} total ({(cal1+cal2)/7:.2f} wk)")
    # 3rd descent (QF even higher)
    cal3, life3, qf3, gap_i, _ = campaign_calendar2(WALLS, life2, gap_i, post_first=True, verbose=False)
    print(f"  + 3rd re-descent:        {cal3:.1f} cal-days -> {cal1+cal2+cal3:.1f} total ({(cal1+cal2+cal3)/7:.2f} wk)")
    print(f"\n  Re-descent loop supplies unbounded phase transitions; single campaign")
    print(f"  caps at dec26 but the meta sustains multi-week ('수 주') retention.")
