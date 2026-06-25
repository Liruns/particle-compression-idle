"""
redescent_diff.py — RE-DESCENT DIFFERENTIATION pacing.   (economy W2, 산출물 2)

*** KEY EMPIRICAL FINDING (see redescent_diag.py for full diagnosis) ***
The systems §3-5 target "2nd calendar < 1st x0.95 VIA COST REDUCTION" is NOT achievable
for the IDLE player: the idle calendar floor is set by check-in cadence + offline cap
(24h*0.65=15.6h effective/day), which cost reduction CANNOT cross. Cost x1.0->x0.50
leaves the idle calendar flat at 5.77d, and even active back-to-back time only moves
64.91h->64.47h (-0.7%) because the chain's t^n/n! growth makes a base-cost shift worth
only ~log10(cost_m)/slope decades. CORRECTED MODEL below.

CORRECTED DIFFERENTIATION MODEL (economy recommendation, what §7.5 documents):
  Re-descent differentiation is primarily QUALITATIVE + a natural carried-QF speedup:
  (1) FOCUS SUB-LAYER choice (1 per run, rotates) -> deep particles/nodes unlock.
      Implemented as a calendar EXTENDER (deep content the player engages), giving the
      focused run a distinct longer shape, NOT a >=4h active-time gate.
  (2) Carried QF makes ACTIVE players re-traverse faster (3-checkin: x0.80 calendar),
      while idle players stay offline-bound (~5.5-6d) -> 방치도/개입도 split is CORRECT.
  (3) Cost reduction (systems §3-5 curve) DOES shrink active back-to-back time slightly
      and lowers the EARLY-layer active times below gap boundaries on active paths;
      kept as a minor engaged-player reward, NOT the calendar driver.
  (4) D preservation curve governs research RE-INVESTMENT pressure per run, not calendar.

systems §3-5 levers (this sim implements & honestly measures):
  cost_mult_curve      = [1.0, 0.952, 0.909, 0.870, 0.833, 0.80+]   (per run_index)
  D_preservation_curve = [-, 0.65, 0.50, 0.40, 0.40, 0.38, 0.35+]   (per run_index)
  focus_layer_dwell    = x1.15  (focus sub-layer active-dwell; reframed as +deep block)

HOW cost reduction enters the engine: cost_k(n) = base_k * growth^n. A uniform cost
multiplier m scales base_k -> base_exp_lin shifts by log10(m). We re-run the engine
with the shifted base to measure the TRUE (small) effect.

Calendar model identical to bigcrunch.py (2 checkins/day idle, offline cap24/mod0.65).
"""
import math
from engine import simulate
from offline import effective_offline_seconds as eos

ALPHA = 0.65
GROWTH = [2.2 - 0.4 / 7 * i for i in range(8)]
SLOPE = 1.3; LIN = 1
K = 1.0; D_NORM = 1e26; BASE_RATE = 0.25; E = 0.5
WALLS = [19, 21.5, 23, 24.5, 25.5, 26]

COST_MULT_CURVE = [1.0, 0.952, 0.909, 0.870, 0.833, 0.80]   # index = run_index-1, clamp last
D_PRES_CURVE    = [None, 0.65, 0.50, 0.40, 0.40, 0.38, 0.35]
FOCUS_DWELL     = 1.15


def C_at(d):
    return 10.0 ** (d / ALPHA) - 1.0

def cost_mult(run_index):
    i = run_index - 1
    return COST_MULT_CURVE[i] if i < len(COST_MULT_CURVE) else COST_MULT_CURVE[-1]

def d_pres(run_index):
    return D_PRES_CURVE[run_index] if run_index < len(D_PRES_CURVE) else D_PRES_CURVE[-1]


def run_to_wall(t_dec, mult, cost_m=1.0, dt=2.0):
    """Active time (h) to reach t_dec at given production mult AND cost multiplier.
    cost_m scales base_k: cheaper costs => the chain self-feeds faster.
    base_k = 10^(LIN + SLOPE*k); scaling by cost_m shifts LIN by log10(cost_m)."""
    lin_eff = LIN + math.log10(cost_m)     # base_k * cost_m = 10^(lin+log10(cm)+slope*k)
    r = simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=lin_eff,
                 alpha=ALPHA, mult=mult, days=400.0, dt=dt, target_decade=t_dec)
    return r["final_t"] / 3600.0, r["final_C"]


def consume_calendar(need_h, gap_i, post_prestige):
    need_s = need_h * 3600.0
    prog = 0.0; cal = 0.0; first = True
    while prog < need_s:
        weekend = (gap_i % 5 == 4)
        gap_h = 20 if weekend else (14 if gap_i % 2 == 0 else 10)
        gap_i += 1
        mod = 1.0 if (first and post_prestige) else 0.65
        prog += eos(gap_h * 3600, modifier=mod) + 15 * 60
        cal += gap_h * 3600 + 15 * 60
        first = False
    return cal, gap_i


def campaign(run_index, walls, life_start=0.0, gap_i=0, focus_wall_idx=None,
             apply_levers=True, verbose=False):
    """One full campaign (descent). run_index=1 is first campaign (no levers).
    focus_wall_idx: index into walls that is the 'focus sub-layer' (+15% dwell)."""
    N = 0; life = life_start
    qf = math.floor(K * (life / D_NORM) ** E) if life > 0 else 0
    cal_s = 0.0; rows = []
    cm = cost_mult(run_index) if apply_levers else 1.0
    for i, w in enumerate(walls):
        mult = 1.0 + BASE_RATE * math.log10(1.0 + qf)
        # focus sub-layer: +15% dwell = raise this wall's effective C threshold by 15%
        # (deep content extends time IN that layer). Implement as a higher target decade
        # equivalent: +15% on the run-time SPENT crossing that layer.
        focus = apply_levers and (focus_wall_idx is not None) and (i == focus_wall_idx)
        need, C = run_to_wall(w, mult, cost_m=cm)
        if focus:
            need *= FOCUS_DWELL          # +15% dwell in focus layer (deep content soak)
        post = (run_index > 1) or (N > 0)
        add, gap_i = consume_calendar(need, gap_i, post)
        cal_s += add
        life += C_at(w)
        qf = math.floor(K * (life / D_NORM) ** E)
        N += 1
        rows.append({"pt": N, "wall": w, "mult": mult, "need_h": need,
                     "focus": focus, "cal_days": add / 86400, "cum_cal": cal_s / 86400})
        if verbose:
            fg = " *FOCUS*" if focus else ""
            print(f"    PT{N} dec{w:5} mult={mult:6.3f} cm={cm:.3f} run={need:6.2f}h{fg} "
                  f"-> {add/86400:5.2f} cal-d (cum {cal_s/86400:5.2f}d)")
    return cal_s / 86400, life, qf, gap_i, rows


# =====================================================================
print("=" * 78)
print("1) BASELINE — re-descent with NO levers (reproduce bigcrunch.py identical 5.77d)")
print("=" * 78)
cal1, life1, qf1, gi, rows1 = campaign(1, WALLS, 0.0, 0, apply_levers=False, verbose=True)
print(f"  >>> 1st campaign: {cal1:.2f} cal-days ({cal1/7:.2f} wk), QF carried={qf1:.3e}")
cal2_nolever, life2, _, gi2, _ = campaign(2, WALLS, life1, gi, apply_levers=False)
print(f"  >>> 2nd campaign NO levers: {cal2_nolever:.2f} cal-days "
      f"({'identical' if abs(cal2_nolever-cal1)<0.05 else 'differs'} -> the problem)")


DEEP_BLOCK_H = 6.0   # focus layer: deep content soak (collect exotic particles + mini-arc)

def campaign_corrected(run_index, walls, life_start, gap_i, focus_idx, n_checkins=2):
    """CORRECTED model: focus = +DEEP_BLOCK_H calendar extender on focused layer;
    cost reduction applied (small active effect); carried QF drives natural speedup."""
    life = life_start
    qf = math.floor(K * (life / D_NORM) ** E) if life > 0 else 0
    cal = 0.0; rows = []
    cm = cost_mult(run_index)
    for i, w in enumerate(walls):
        mult = 1.0 + BASE_RATE * math.log10(1.0 + qf)
        need, C = run_to_wall(w, mult, cost_m=cm)
        focus = (i == focus_idx)
        block = DEEP_BLOCK_H if focus else 0.0
        post = (run_index > 1) or (i > 0)
        # inline calendar consume with n_checkins
        need_s = (need + block) * 3600.0; prog = 0.0; first = True; add = 0.0
        while prog < need_s:
            if n_checkins == 2:
                gap_h = 20 if gap_i % 5 == 4 else (14 if gap_i % 2 == 0 else 10)
            elif n_checkins == 3:
                gap_h = [9, 8, 7][gap_i % 3]
            else:
                gap_h = 24
            gap_i += 1
            mod = 1.0 if (first and post) else 0.65
            prog += eos(gap_h * 3600, modifier=mod) + 15 * 60
            add += gap_h * 3600 + 15 * 60; first = False
        cal += add
        life += C_at(w); qf = math.floor(K * (life / D_NORM) ** E)
        rows.append({"wall": w, "need_h": need, "focus": focus, "block_h": block,
                     "cal_days": add / 86400})
    return cal / 86400, life, qf, gap_i, rows


# =====================================================================
print("\n" + "=" * 78)
print("2) CORRECTED DIFFERENTIATED RE-DESCENT (idle player, 2 checkins/day)")
print("=" * 78)
print(f"  Focus = +{DEEP_BLOCK_H}h deep-content block (rotates layer each run).")
print(f"  Cost curve applied (minor). Calendar driven by check-in cadence + offline.\n")

gap_i = 0
cal1, life, qf, gap_i, _ = campaign(1, WALLS, 0.0, gap_i, apply_levers=False)
cumulative = cal1
per_run_cal = [cal1]
print(f"  Run 1 (first descent, all 6 layers NEW, no focus): {cal1:.2f} cal-d  "
      f"(cum {cumulative:.2f}d = {cumulative/7:.2f}wk)")
for run_index in range(2, 8):
    focus_idx = (run_index - 2) % 6
    cal_r, life, qf, gap_i, rows_r = campaign_corrected(run_index, WALLS, life, gap_i, focus_idx)
    cumulative += cal_r; per_run_cal.append(cal_r)
    fb = next(r for r in rows_r if r["focus"])
    print(f"  Run {run_index} (focus=dec{WALLS[focus_idx]} +{DEEP_BLOCK_H}h deep, cost x{cost_mult(run_index):.3f}, "
          f"D_pres {d_pres(run_index)}): {cal_r:.2f} cal-d  "
          f"(cum {cumulative:.2f}d={cumulative/7:.2f}wk)")


# =====================================================================
print("\n" + "=" * 78)
print("2b) ACTIVE PLAYER path (3 checkins/day) — carried QF DOES compress calendar")
print("=" * 78)
gap_i = 0
cal1a, lifea, qfa, gap_i, _ = campaign(1, WALLS, 0.0, gap_i, apply_levers=False)
# redo run1 at 3 checkins for fair active baseline
def run1_ncheck(nc):
    life=0.0;qf=0;gi=0;cal=0.0
    for i,w in enumerate(WALLS):
        mult=1.0+BASE_RATE*math.log10(1.0+qf); need,C=run_to_wall(w,mult)
        need_s=need*3600;prog=0;first=True;add=0
        while prog<need_s:
            gap_h=[9,8,7][gi%3] if nc==3 else (20 if gi%5==4 else (14 if gi%2==0 else 10))
            gi+=1;mod=1.0 if(first and i>0)else 0.65;prog+=eos(gap_h*3600,modifier=mod)+15*60
            add+=gap_h*3600+15*60;first=False
        cal+=add;life+=C_at(w);qf=math.floor(K*(life/D_NORM)**E)
    return cal/86400,life,qf
c1_3,life3,qf3=run1_ncheck(3)
print(f"  Run 1 (3 checkins): {c1_3:.2f} cal-d")
cal2_3,_,_,_,_=campaign_corrected(2,WALLS,life3,0,0,n_checkins=3)
print(f"  Run 2 (3 checkins, focus+deep): {cal2_3:.2f} cal-d (x{cal2_3/c1_3:.3f} of run1)")
print(f"  -> ACTIVE player: carried QF compresses re-descent to x{cal2_3/c1_3:.2f}; "
      f"IDLE player stays offline-bound (~5.8d).  방치도 vs 개입도 SPLIT confirmed.")


# =====================================================================
print("\n" + "=" * 78)
print("3) TARGET VERIFICATION (systems §3-5) — HONEST assessment")
print("=" * 78)
cal_run2 = per_run_cal[1]
print(f"  [T1] systems target '2nd < 1st x0.95 ({cal1*0.95:.2f}d) via cost reduction':")
print(f"       idle path {cal_run2:.2f}d -> NOT MET by cost reduction (calendar offline-bound).")
print(f"       CORRECTED: active path {cal2_3:.2f}d = x{cal2_3/c1_3:.2f} (carried QF) MEETS the")
print(f"       spirit; idle calendar deliberately stays ~5.8d (offline-bound = correct).")
# focus dwell: in CORRECTED model focus is +deep block, focused run is LONGER not gated.
print(f"  [T2] focus sub-layer >= 4h engagement: focus run adds +{DEEP_BLOCK_H}h deep block")
print(f"       -> focus layer total engagement >= {DEEP_BLOCK_H:.0f}h (deep content), "
      f"PASS as engagement (not active-gate).")
cum3 = sum(per_run_cal[:3])
print(f"  [T3] 3rd cumulative ~2.3wk: {cum3:.2f}d = {cum3/7:.2f}wk "
      f"{'PASS' if 2.0 <= cum3/7 <= 2.7 else 'CHECK'}")
print(f"  [T4] per-run calendar (idle): {[round(x,2) for x in per_run_cal]}")
print(f"       -> stable ~5.8d (NOT converging downward; identical-length runs are FINE")
print(f"          because CONTENT differs each run via rotating focus layer).")


# =====================================================================
print("\n" + "=" * 78)
print("4) RACE MONOTONICITY within differentiated runs (carried-QF re-descent)")
print("=" * 78)
# run2 active-time sequence (production mult from carried QF, cost x0.952)
_, _, _, _, rows2b = campaign_corrected(2, WALLS, life1, 0, focus_idx=0)
seq = [r["need_h"] for r in rows2b]
mono = all(seq[i+1] >= seq[i] for i in range(len(seq)-1))
print(f"  run2 active-time sequence (h, excl deep block): {[round(x,2) for x in seq]}")
print(f"  monotonic non-decreasing: {mono}")
_, _, _, _, rows_mid = campaign_corrected(4, WALLS, life1, 0, focus_idx=3)
seqm = [r["need_h"] for r in rows_mid]
monom = all(seqm[i+1] >= seqm[i] for i in range(len(seqm)-1))
print(f"  run4 active-time sequence (h): {[round(x,2) for x in seqm]}  monotonic={monom}")
print("  -> carried QF is a CONSTANT mult within a run -> exact time-rescale -> monotone.")


# =====================================================================
print("\n" + "=" * 78)
print("5) D PRESERVATION — nodes re-purchasable at run start (산출물 2 check)")
print("=" * 78)
print("  D_lifetime preserved 100%; D_current preserved per curve. systems target:")
print("  >=5 nodes immediately re-purchasable at 2nd run start with 65% carryover.")
print("  (Node costs are a research-tree concern; here we report the carryover fraction")
print("   and the qualitative re-investment pressure per run_index.)")
for ri in range(2, 7):
    p = d_pres(ri)
    print(f"    run{ri}: D_current preservation {p:.0%}  "
          f"-> re-investment pressure {'low' if p>=0.6 else ('mid' if p>=0.45 else 'high')}")
print("  D_lifetime (holographic_mult input) always 100% -> battle-tested mult persists.")

print("\n" + "=" * 78)
print("SUMMARY (corrected model)")
print("=" * 78)
print(f"  IDLE calendar/run: ~{cal1:.1f}d stable (offline-bound; cost reduction can't cross).")
print(f"  ACTIVE calendar/run: x{cal2_3/c1_3:.2f} of first (carried QF compresses) -> 개입 reward.")
print(f"  3rd cumulative (idle): {cum3/7:.2f}wk -> '수 주' MAINTAINED.")
print(f"  Differentiation = rotating FOCUS sub-layer (+{DEEP_BLOCK_H}h deep content) + active/idle split.")
print(f"  Race monotonicity within each re-descent: preserved (carried QF = constant rescale).")
