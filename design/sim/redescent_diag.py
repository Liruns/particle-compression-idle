"""
redescent_diag.py — DIAGNOSE why cost reduction doesn't move the re-descent calendar,
and find the lever that ACTUALLY differentiates re-descent calendar.   (W2 산출물 2 deep-dive)

Finding from redescent_diff.py: cost_mult 1.0->0.80 leaves calendar at 5.77d (x1.000).
Hypothesis: the calendar is set by check-in cadence + offline cap, not active time.
A long gap (14h) credits eos(14h)=9.1h; a run needing 22h active needs ceil over gaps.
Shrinking active 22h->20h doesn't reduce the NUMBER of gaps enough to change calendar.

This file:
  (A) shows the calendar's sensitivity to active-time (it's COARSE / step-like)
  (B) shows WHY cost reduction is too small to cross a gap-count boundary
  (C) tests which lever genuinely moves calendar:
        - bigger cost reduction
        - offline cap change (NOT desired - global)
        - check-in CADENCE change (player behavior, not a design lever)
        - **focus-dwell as a CALENDAR extender** (the real differentiator)
  (D) reframes: re-descent differentiation is QUALITATIVE (focus content) +
      a MODEST calendar trend, not a large calendar compression. Quantify honestly.
"""
import math
from engine import simulate
from offline import effective_offline_seconds as eos

ALPHA = 0.65
GROWTH = [2.2 - 0.4 / 7 * i for i in range(8)]
SLOPE = 1.3; LIN = 1
K = 1.0; D_NORM = 1e26; BASE_RATE = 0.25; E = 0.5
WALLS = [19, 21.5, 23, 24.5, 25.5, 26]


def C_at(d): return 10.0 ** (d / ALPHA) - 1.0

def run_to_wall(t_dec, mult, cost_m=1.0, dt=2.0):
    lin_eff = LIN + math.log10(cost_m)
    r = simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=lin_eff,
                 alpha=ALPHA, mult=mult, days=400.0, dt=dt, target_decade=t_dec)
    return r["final_t"] / 3600.0, r["final_C"]

def consume_calendar(need_h, gap_i, post_prestige, n_checkins=2):
    """n_checkins per day: 2 -> gaps 14/10; 3 -> gaps ~9/8/7; 1 -> gap 24."""
    need_s = need_h * 3600.0
    prog = 0.0; cal = 0.0; first = True; gaps_used = 0
    while prog < need_s:
        if n_checkins == 2:
            weekend = (gap_i % 5 == 4); gap_h = 20 if weekend else (14 if gap_i % 2 == 0 else 10)
        elif n_checkins == 1:
            gap_h = 24
        else:  # 3/day
            gap_h = [9, 8, 7][gap_i % 3]
        gap_i += 1; gaps_used += 1
        mod = 1.0 if (first and post_prestige) else 0.65
        prog += eos(gap_h * 3600, modifier=mod) + 15 * 60
        cal += gap_h * 3600 + 15 * 60; first = False
    return cal, gap_i, gaps_used


# Build 1st campaign to get carry-over life/qf
def first_campaign():
    life = 0.0; qf = 0; gap_i = 0; cal = 0.0
    for i, w in enumerate(WALLS):
        mult = 1.0 + BASE_RATE * math.log10(1.0 + qf)
        need, C = run_to_wall(w, mult)
        add, gap_i, _ = consume_calendar(need, gap_i, i > 0)
        cal += add; life += C_at(w); qf = math.floor(K * (life / D_NORM) ** E)
    return cal / 86400, life, qf, gap_i

cal1, life1, qf1, _ = first_campaign()

print("=" * 78)
print("(A) CALENDAR SENSITIVITY to per-run active time (re-descent, mult=2.76 fixed)")
print("=" * 78)
print("  For each wall, vary active hours and see calendar days (offline+2 checkins).")
print(f"  {'active_h':>9}{'cal_days':>10}{'gaps':>6}")
mult2 = 1.0 + BASE_RATE * math.log10(1.0 + qf1)
for ah in [1.5, 3, 6, 12, 18, 20, 22, 23, 25]:
    add, _, gaps = consume_calendar(ah, 0, True)
    print(f"  {ah:>9.1f}{add/86400:>10.3f}{gaps:>6}")
print("  -> calendar is STEP-LIKE in active time: each new check-in gap = +0.5-0.8 cal-d.")
print("     A 22h->20h cost reduction stays within the same gap count -> no calendar change.")


print("\n" + "=" * 78)
print("(B) WHY cost reduction is too small — active-time delta vs gap boundary")
print("=" * 78)
print(f"  {'cost_m':>8}{'PT6 active_h':>14}{'PT6 cal_d':>11}{'total_cal_d':>13}")
for cm in [1.0, 0.952, 0.90, 0.80, 0.65, 0.50]:
    # full re-descent campaign at this cost mult
    life = life1; qf = qf1; gap_i = 0; cal = 0.0; pt6_active = 0; pt6_cal = 0
    for i, w in enumerate(WALLS):
        mult = 1.0 + BASE_RATE * math.log10(1.0 + qf)
        need, C = run_to_wall(w, mult, cost_m=cm)
        add, gap_i, _ = consume_calendar(need, gap_i, True)
        cal += add
        if i == len(WALLS) - 1:
            pt6_active = need; pt6_cal = add / 86400
        life += C_at(w); qf = math.floor(K * (life / D_NORM) ** E)
    print(f"  {cm:>8.3f}{pt6_active:>14.2f}{pt6_cal:>11.3f}{cal/86400:>13.3f}")
print("  -> even cost x0.50 barely moves calendar: offline cap caps the daily progress,")
print("     so calendar ~ (active_h needed) / (eos credit per day) -> insensitive to small cm.")


print("\n" + "=" * 78)
print("(C) WHAT ACTUALLY MOVES THE RE-DESCENT CALENDAR")
print("=" * 78)
print("  Lever 1: cost reduction (systems §3-5)  -> calendar nearly flat (shown above).")
print("  Lever 2: focus-dwell as a CALENDAR EXTENDER on ONE layer (deep content soak).")
print("           This ADDS engagement to the focus layer (not compresses) -> calendar")
print("           goes UP slightly on the focused run, giving each run a distinct shape.")
print("  Lever 3: the REAL differentiator is QUALITATIVE: which layer is deep-dived,")
print("           which deep particles/nodes unlock -> 'different flavor', not 'faster'.\n")

# Reframe: model focus-dwell as calendar EXTENSION (deep content the player engages with)
def redescent_with_focus_extension(run_index, focus_idx, cost_m, life_start, gap_i):
    life = life_start
    qf = math.floor(K * (life / D_NORM) ** E)
    cal = 0.0; rows = []
    for i, w in enumerate(WALLS):
        mult = 1.0 + BASE_RATE * math.log10(1.0 + qf)
        need, C = run_to_wall(w, mult, cost_m=cost_m)
        focus = (i == focus_idx)
        # focus layer: deep content adds a FLAT engagement block (e.g. +deep particles to
        # collect, +1 research mini-arc). Model as +X active-equivalent hours of content.
        deep_block_h = 6.0 if focus else 0.0   # deep content soak (collect exotic particles)
        add, gap_i, _ = consume_calendar(need + deep_block_h, gap_i, True)
        cal += add; rows.append((w, need, focus, add / 86400))
        life += C_at(w); qf = math.floor(K * (life / D_NORM) ** E)
    return cal / 86400, life, qf, gap_i, rows

print("  Re-descent runs with focus-dwell as +6h deep-content block on the focused layer:")
life = life1; qf = qf1; gap_i = 0; cum = cal1
print(f"    Run 1 (no focus): {cal1:.2f} cal-d (cum {cum:.2f}d)")
percal = [cal1]
for ri in range(2, 8):
    fidx = (ri - 2) % 6
    cm = [1.0,0.952,0.909,0.870,0.833,0.80][min(ri-1,5)]
    calr, life, qf, gap_i, rows = redescent_with_focus_extension(ri, fidx, cm, life, gap_i)
    cum += calr; percal.append(calr)
    print(f"    Run {ri} (focus=dec{WALLS[fidx]}, +6h deep): {calr:.2f} cal-d (cum {cum:.2f}d={cum/7:.2f}wk)")
print(f"\n  -> Each run now has a DISTINCT focus layer + deep block. Calendar trends with")
print(f"     cost reduction (slow drift down) while focus block adds variety. 'Different結'.")
print(f"  -> 3rd cumulative: {sum(percal[:3]):.1f}d = {sum(percal[:3])/7:.2f}wk")


print("\n" + "=" * 78)
print("(D) HONEST REFRAME — what to put in economy.md §7.5")
print("=" * 78)
print("""  The systems §3-5 TARGET '2nd calendar < 1st x0.95 via cost reduction' is NOT
  achievable through cost reduction alone: the idle calendar floor is set by check-in
  cadence + offline cap, which cost reduction cannot cross (sim A/B above).

  CORRECTED MODEL (economy recommendation):
    - Re-descent differentiation is primarily QUALITATIVE (focus sub-layer choice +
      deep particles/nodes), NOT a calendar-compression mechanic.
    - The calendar STAYS ~5.5-6 cal-days per re-descent (good for '수 주' retention:
      3 runs ~2.5wk, N runs unbounded). Identical-length runs are FINE as long as the
      CONTENT differs (different focus layer each time).
    - Cost reduction's real role: shrink ACTIVE back-to-back time (22h->18h at x0.80),
      rewarding the ENGAGED player who plays actively, without changing idle calendar.
      (방치도 vs 개입도 -> active players feel the cost reduction; idle players don't,
       and that's correct - their pace is offline-bound.)
    - focus-dwell should be a calendar EXTENDER (deep content the player CHOOSES to
      engage), giving the focused run a distinct longer shape, not a >=4h active gate.
""")
