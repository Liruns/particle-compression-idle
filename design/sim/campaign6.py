"""
6-WALL CAMPAIGN RE-SIM (director [지시 2], dec19..dec26, 7 phase transitions incl big crunch).

Preserves verified engine/offline/prestige formulas. Only WALLS changed.

Phase transitions = 7:
  PT1 = quark->preon (first, dec19)
  PT2..PT6 = preon->string->loop->foam->info->planck (5 walls)
  PT7 = BIG CRUNCH (planck reached, dec26 = final prestige)

Reports:
  (a) per-run active time + dwell-in-new-territory at each run's mult
  (b) final production_mult after 7 transitions, base_rate sweep
  (c) race monotonicity (run length sequence)
"""
import math
from engine import simulate

ALPHA = 0.65
GROWTH = [2.2 - 0.4/7*i for i in range(8)]
SLOPE = 1.3; LIN = 1
K = 1.0; D_NORM = 1e26; E = 0.5

def C_at(d):
    return 10.0**(d/ALPHA) - 1.0

def run_to_wall(t_dec, mult, dt=2.0):
    """Active back-to-back time (h) to reach wall t_dec from C=0 at given mult.
    Uses final_t (engine stops AT target), robust for fractional walls.
    Also returns decade_times for measuring dwell-in-new-territory (prev wall)."""
    r = simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=LIN,
                 alpha=ALPHA, mult=mult, days=400.0, dt=dt, target_decade=t_dec)
    return r["final_t"]/3600.0, r["decade_times"], r["final_C"]

def cum_h(decade_times, d):
    lo = int(math.floor(d)); hi = lo + 1
    if lo not in decade_times: return None
    t_lo = decade_times[lo]/3600.0
    if abs(d-lo) < 1e-9: return t_lo
    if hi not in decade_times: return None
    t_hi = decade_times[hi]/3600.0
    if t_lo <= 0 or t_hi <= 0:
        return t_lo + (t_hi-t_lo)*(d-lo)
    return math.exp(math.log(t_lo)+(math.log(t_hi)-math.log(t_lo))*(d-lo))

def campaign(walls, base_rate=0.25, dt=2.0, verbose=True):
    """Run the single campaign: 6 walls (PT1..PT6) then big crunch (PT7).
    Each run resets C=0, runs to wall at current mult."""
    N = 0; qf = 0; life = 0.0; tot = 0.0
    rows = []
    prev_wall = None
    for i, w in enumerate(walls):
        mult = 1.0 + base_rate*math.log10(1.0 + qf)
        t_full, dts, Cend = run_to_wall(w, mult, dt)   # full run C=0 -> wall (h)
        # dwell in NEW territory this run = time from prev_wall to w within THIS run.
        # dts (run to w) has integer decades up to floor(w); for fractional prev_wall
        # interpolate. cum_h handles None gracefully.
        if prev_wall is None:
            dwell_new = t_full
        else:
            t_prev_in_run = cum_h(dts, prev_wall)
            dwell_new = t_full - (t_prev_in_run if t_prev_in_run else 0.0)
        tot += t_full
        life += C_at(w)
        qt = math.floor(K*(life/D_NORM)**E); g = qt - qf; qf = qt; N += 1
        rows.append({"pt": N, "wall": w, "mult": mult, "t_full_h": t_full,
                     "dwell_new_h": dwell_new, "qf_gain": g, "qf_cum": qf})
        prev_wall = w
    if verbose:
        print(f"  {'PT':>3} {'wall':>6} {'mult':>7} {'run_full(h)':>12} "
              f"{'new-territory(h)':>16} {'+QF':>10} {'cumQF':>12}")
        for r in rows:
            print(f"  {r['pt']:>3} {r['wall']:>6} {r['mult']:>7.3f} {r['t_full_h']:>12.2f} "
                  f"{r['dwell_new_h']:>16.2f} {r['qf_gain']:>10} {r['qf_cum']:>12.3e}")
    return rows

def quick_dwell_check(walls, base_rate=0.25):
    """Compact: campaign run-full + new-territory dwell + final mult, for comparing schedules."""
    rows = campaign(walls, base_rate=base_rate, verbose=False)
    seq = [r["t_full_h"] for r in rows]
    new = [r["dwell_new_h"] for r in rows]
    mono = all(seq[i+1] >= seq[i] for i in range(len(seq)-1))
    final_mult = 1.0 + base_rate*math.log10(1.0+rows[-1]["qf_cum"])
    thin = [f"PT{r['pt']}={r['dwell_new_h']:.1f}h" for r in rows if r["dwell_new_h"]<4.0]
    print(f"  {str(walls):42} mono={mono} finalmult={final_mult:.3f} "
          f"thin(campaign<4h): {thin if thin else 'none'}")
    return rows

if __name__ == "__main__":
    print("="*78)
    print("SCHEDULE COMPARISON (campaign new-territory dwell, base_rate=0.25)")
    print("="*78)
    for cand in [
        [19, 21, 23, 24.5, 25.5, 26],
        [19, 21.5, 23, 24.5, 25.5, 26],
        [19, 22, 23.5, 24.5, 25.5, 26],
        [19, 22, 24, 25, 25.6, 26],
    ]:
        quick_dwell_check(cand)
    print()

    WALLS = [19, 21.5, 23, 24.5, 25.5, 26]   # chosen 6-wall schedule (FINAL)

    print("="*78)
    print("6-WALL CAMPAIGN (base_rate=0.25) — PT1..PT6 = 6 missing sub-layers")
    print(f"WALLS = {WALLS}")
    print("="*78)
    rows = campaign(WALLS, base_rate=0.25)

    # PT7 = big crunch happens AT dec26 (PT6 wall). The 6th wall IS the planck/big-crunch.
    # Per director §2.3: PT6 = planck entry, big crunch = PT7 = final prestige at dec26.
    # In a single campaign the player reaches dec26 (PT6) then triggers BIG CRUNCH (PT7).
    # PT7 adds the final QF explosion. Model big crunch as one more prestige claim at dec26
    # with full lifetime_C (the planck-layer completion).
    print("\n--- PHASE TRANSITION COUNT ---")
    print(f"  Walls (PT1..PT6): {len(rows)} prestiges in single campaign")
    print(f"  + BIG CRUNCH (PT7) at planck dec26 = 7th phase transition")
    final_mult = rows[-1]["mult"]
    # mult entering big crunch (after PT6 QF claimed):
    qf_after6 = rows[-1]["qf_cum"]
    mult_at_crunch = 1.0 + 0.25*math.log10(1.0+qf_after6)
    print(f"  production_mult after PT6 (entering big crunch): {mult_at_crunch:.3f}x")
    print(f"  --> band check (2-3x): {'PASS' if 2.0<=mult_at_crunch<=3.0 else 'OUT'}")

    print("\n--- RACE MONOTONICITY (run_full lengths) ---")
    seq = [r["t_full_h"] for r in rows]
    mono = all(seq[i+1] >= seq[i] for i in range(len(seq)-1))
    print(f"  full-run sequence (h): {[round(x,2) for x in seq]}")
    print(f"  strictly non-decreasing: {mono}")
    for i in range(len(seq)-1):
        d = (seq[i+1]/seq[i]-1)*100
        tag = "" if d>=0 else "  <-- DIP"
        print(f"    PT{i+1}->PT{i+2}: {seq[i]:.2f}h -> {seq[i+1]:.2f}h ({d:+.1f}%){tag}")

    print("\n--- NEW-TERRITORY DWELL (the '한 층=한 새로움' check) ---")
    for r in rows:
        f = "OK" if r["dwell_new_h"]>=4.0 else "THIN"
        print(f"  PT{r['pt']} dec{r['wall']}: {r['dwell_new_h']:.2f}h in new territory [{f}]")
