"""
synergy_codex_integ.py — RESEARCH SYNERGY (systems C-plan) + CODEX RAMP (curve B)
COMBINED §3.4 GUARDRAIL VERIFICATION  (economy W2, 산출물 1)

Resolves the orchestrator's cross-tension #1/#2/#3:

  #1 HOLOGRAPHIC POOL COLLISION:
     codex.md §13-3 defines:
        holographic_mult = [1 + log10(D_total+1)*holo_factor]   (D-term, pre-existing)
                         + min(codex_completion * codex_bonus_factor, 0.35)  (codex term, cap +0.35x)
     systems C-plan wants B_HOLO (codex_count*0.0012 = +10.4%@87) ALSO inside holographic_mult.
     content curve B wants the CODEX COMPLETION term to reach +0.35x at completion=1.0.
     => If B_HOLO lands in the SAME +0.35x pool, the two compete (collision).

     DECISION TESTED HERE (and recommended): B_HOLO is folded INTO the +0.35x codex
     sub-pool by RE-DEFINING the codex completion contribution as the SINGLE source that
     reaches +0.35x at full collection. Concretely, B_HOLO's "codex_count*0.0012" IS just
     a linear re-statement of "completion * 0.35" mis-scaled (87*0.0012 = 0.104, not 0.35).
     We keep ONE codex sub-pool with curve B (0.35*c^2) and treat B_HOLO as redundant /
     absorbed: B_HOLO does NOT add a SEPARATE term on top of the +0.35x cap.
     The codex contribution to holographic_mult is bounded by +0.35x REGARDLESS.
     (We also test the ALTERNATIVE where B_HOLO is a separate additive term to show it
     breaks the budget, justifying the decision.)

  #2 -30.1% BOUNDARY:
     content warns codex x1.35 * research x1.06 = x1.431 -> -30.1% (0.1%p over).
     systems C-plan removes A13/B8/B12 from the production_mult constant-product (they
     become chain-internal / conditional / event-path), so research_mult ~= 1.0.
     With curve B, codex is NOT x1.35 from PT1 (mid-campaign c~0.65 -> x1.148).
     We confirm the COMBINED product stays well inside -30%.

  #3 "HIGGS BONUS":
     Not a research-tree node. It is the codex LEGENDARY/EPIC unlock bonus of the
     Higgs boson particle (codex.md L949-960, "체인 전 티어 배율 소폭 증가"). It is a
     CODEX unlock bonus, so its budget belongs to the codex holographic pool, NOT to
     research_mult. We treat it as already inside the +0.35x codex cap (it is one of
     the discoverable particles whose collection raises completion).

KEY ENGINE FACT (exact, from codex_race.py): every production rate is linear in mult
  (dC/dt=g1*mult, dg_k/dt=g_{k+1}*mult). A CONSTANT holographic multiplier H is an exact
  time-rescale: reaching any fixed decade takes 1/H the time => dec26 reduction = 1 - 1/H.
  A RAMPING bonus gives strictly LESS reduction than its peak-H constant equivalent.

Locked params identical to final_verify.py / codex_race.py.
"""
import math
from engine import simulate

ALPHA = 0.65
GROWTH = [2.2 - 0.4 / 7 * i for i in range(8)]   # tier1=2.2 ... tier8=1.8
SLOPE = 1.3; LIN = 1
K = 1.0; D_NORM = 1e26; BASE_RATE = 0.25; E = 0.5
WALLS = [19, 21.5, 23, 24.5, 25.5, 26]

# --- content curve B (codex ramp) ---
CODEX_FACTOR = 0.35           # codex_bonus_factor (cap +0.35x at completion=1.0)
def codex_bonus_B(c):         # curve B: 0.35 * c^2
    return CODEX_FACTOR * c * c
def codex_bonus_linear(c):    # curve D (baseline) for comparison
    return CODEX_FACTOR * c

# --- systems C-plan recommended values (산출물 1, §1-5) ---
B_HOLO_COEFF = 0.0012         # codex_count * 0.0012  (+10.4% @ 87 particles)
N_CODEX = 87                  # total codex entries (UI), discoverable denom = 76


def run_layer(t_dec, mult, dt=2.0):
    r = simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=LIN,
                 alpha=ALPHA, mult=mult, days=400.0, dt=dt, target_decade=t_dec)
    return r["final_t"], r["final_C"]


# =====================================================================
print("=" * 74)
print("0) BASELINE dec26 single run (mult=1)")
print("=" * 74)
base_t, _ = run_layer(26, 1.0)
base_h = base_t / 3600
print(f"  dec26 baseline = {base_h:.2f}h ({base_h/24:.3f}d)  [reduction reference]")


# =====================================================================
print("\n" + "=" * 74)
print("1) HOLOGRAPHIC POOL DECISION — does B_HOLO fit inside the +0.35x codex cap?")
print("=" * 74)
print("  Codex completion=1.0 contribution under each option (holographic codex sub-pool):")
print(f"  {'option':<46}{'codex contrib':>14}{'holo_mult':>11}")
# Option 1 (RECOMMENDED): single codex pool, curve B, B_HOLO ABSORBED (not separate)
c1 = codex_bonus_B(1.0)
print(f"  {'A) curve B only (B_HOLO absorbed)  [RECO]':<46}{'+'+format(c1,'.3f'):>14}{'x'+format(1+c1,'.3f'):>11}")
# Option 2: curve B + SEPARATE B_HOLO additive term (collision)
c2 = codex_bonus_B(1.0) + B_HOLO_COEFF * N_CODEX
print(f"  {'B) curve B + SEPARATE B_HOLO term':<46}{'+'+format(c2,'.3f'):>14}{'x'+format(1+c2,'.3f'):>11}")
# Option 3: B_HOLO is the WHOLE codex pool (systems literal, mis-scaled)
c3 = B_HOLO_COEFF * N_CODEX
print(f"  {'C) B_HOLO only (systems literal x0.0012)':<46}{'+'+format(c3,'.3f'):>14}{'x'+format(1+c3,'.3f'):>11}")
print(f"\n  cap rule (codex.md §13-3): codex sub-pool contribution <= +0.35x")
print(f"  -> Option A: {c1:.3f} <= 0.35  PASS (exactly hits cap at c=1)")
print(f"  -> Option B: {c2:.3f}  {'PASS' if c2<=0.35 else 'FAIL (exceeds +0.35x cap -> COLLISION)'}")
print(f"  -> Option C: {c3:.3f} <= 0.35  PASS but only reaches +10.4% (under-delivers completion reward)")
print("  DECISION: B_HOLO absorbed into the single curve-B codex pool (Option A).")
print("            'codex_count*0.0012' was a mis-scaled restatement; one pool, capped +0.35x.")


# =====================================================================
print("\n" + "=" * 74)
print("2) CONSTANT-H dec26 reduction — curve B at various completion snapshots")
print("=" * 74)
print(f"  codex_mult = 1 + 0.35*c^2 ; dec26 reduction = 1 - 1/H (exact, holo constant)")
print(f"  {'completion c':>12}{'codex H':>10}{'dec26 h':>10}{'reduction':>11}{'1-1/H':>8}")
for c in [0.25, 0.50, 0.65, 0.75, 0.85, 0.90, 1.00]:
    H = 1 + codex_bonus_B(c)
    t, _ = run_layer(26, H)
    h = t / 3600
    red = 1 - h / base_h
    analytic = 1 - 1 / H
    print(f"  {c:>12.2f}{H:>10.4f}{h:>10.2f}{red*100:>10.1f}%{analytic*100:>7.1f}%")
print("  worst (c=1.0) = -25.9% target (matches codex_race.py x1.35).")
print("  mid (c=0.65)  = curve B's headroom point.")


# =====================================================================
print("\n" + "=" * 74)
print("3) COMBINED PRODUCT — codex(curve B) x research(C-plan) at dec26")
print("=" * 74)
print("  C-plan: A13/B8/B12 OUTSIDE production_mult -> research_mult ~= 1.0")
print("  Only B_HOLO would touch holo, and it's ABSORBED in the codex pool (Option A).")
print("  So at worst-case completion, combined extra product H_total = codex H only.")
print(f"  {'scenario':<42}{'H_total':>9}{'dec26 h':>10}{'reduction':>11}{'<30%?':>7}")

scenarios = [
    ("codex c=1.0 (x1.35) + research=1.0  [C-plan]", 1 + codex_bonus_B(1.0), 1.0),
    ("codex c=0.65 (mid) + research=1.0",            1 + codex_bonus_B(0.65), 1.0),
    # Stress: what if research_mult were a real constant x1.06 (the OLD A-plan budget)
    ("codex c=1.0 + research x1.06 (OLD budget)",    1 + codex_bonus_B(1.0), 1.06),
    ("codex c=1.0 + research x1.055 (content hedge)", 1 + codex_bonus_B(1.0), 1.055),
    # Stress: separate B_HOLO term ON TOP (Option B, to show why it's rejected)
    ("Option B: codex c=1.0 + sep B_HOLO + res=1.0",  1 + c2, 1.0),
]
for name, hcodex, hres in scenarios:
    H = hcodex * hres
    t, _ = run_layer(26, H)
    h = t / 3600
    red = 1 - h / base_h
    ok = "PASS" if red < 0.30 else "FAIL"
    print(f"  {name:<42}{H:>9.4f}{h:>10.2f}{red*100:>10.1f}%{ok:>7}")


# =====================================================================
print("\n" + "=" * 74)
print("4) REACHABLE WORST-CASE (timing model, systems §1-2) — dec26 SHORTENING sim")
print("=" * 74)
print("  Bonuses RAMP and unlock late. We model a single run where holo H(t) varies")
print("  with the *decade reached so far*, per the systems timing model:")
print("    - A13 unlock dec19+, B12/B_HOLO unlock dec25+, codex maxes just before dec26")
print("  Since A13/B8/B12 are OUTSIDE production_mult (C-plan), only the codex pool ramps.")
print("  We integrate the run with a decade-dependent codex completion schedule.")

def codex_completion_schedule(dec):
    """Reachable completion as a function of decade reached (systems §1-2 timing).
    Collection ramps with depth; full (c=1.0) only at dec26 (planck particles).
    Worst-case 'reachable' = collection runs AHEAD of schedule."""
    # piecewise-linear, deliberately FRONT-LOADED (worst case for race: more bonus earlier)
    pts = [(0, 0.0), (9, 0.30), (14, 0.45), (19, 0.55), (23, 0.70), (25, 0.85), (26, 1.00)]
    for i in range(len(pts) - 1):
        d0, c0 = pts[i]; d1, c1 = pts[i + 1]
        if dec <= d1:
            if dec <= d0: return c0
            return c0 + (c1 - c0) * (dec - d0) / (d1 - d0)
    return 1.0

def run_ramped_codex(target_dec=26.0, dt=2.0):
    """Euler single run with mult = 1 + 0.35*c(dec)^2, c rising with depth.
    Mirrors engine.simulate internals but recomputes mult each tick from decade."""
    g = [0.0] * 9; bought = [0] * 9
    g[1] = 1.0; bought[1] = 1
    from engine import base_k, bulk_cost, max_affordable
    bases = [0.0] + [base_k(k, LIN, SLOPE) for k in range(1, 9)]
    C = 0.0; E_cur = 0.0; t = 0.0
    while True:
        dec = ALPHA * math.log10(C + 1.0)
        c = codex_completion_schedule(dec)
        mult = 1.0 + codex_bonus_B(c)
        new_g = g[:]
        for k in range(1, 8):
            new_g[k] += g[k + 1] * mult * dt
        c_rate = g[1] * mult
        C += c_rate * dt; E_cur += c_rate * dt; g = new_g
        spend = E_cur
        for k in range(8, 0, -1):
            n = max_affordable(bases[k], GROWTH[k - 1], bought[k], spend)
            if n > 0:
                cost = bulk_cost(bases[k], GROWTH[k - 1], bought[k], n)
                if cost <= spend:
                    spend -= cost; E_cur -= cost; bought[k] += n; g[k] += n
        if ALPHA * math.log10(C + 1.0) >= target_dec:
            return t
        t += dt

t_ramp = run_ramped_codex(26.0) / 3600
red_ramp = 1 - t_ramp / base_h
# constant worst-case for comparison
t_const, _ = run_layer(26, 1 + codex_bonus_B(1.0))
red_const = 1 - (t_const / 3600) / base_h
print(f"  RAMPED codex (front-loaded reachable):  dec26 = {t_ramp:.2f}h  reduction = {red_ramp*100:.1f}%")
print(f"  CONSTANT x1.35 (PT1 worst-case bound):  dec26 = {t_const/3600:.2f}h  reduction = {red_const*100:.1f}%")
print(f"  -> ramped reduction ({red_ramp*100:.1f}%) < constant bound ({red_const*100:.1f}%): "
      f"{'CONFIRMED' if red_ramp < red_const else 'CHECK'}")
print(f"  -> reachable worst-case < 30%: {'PASS' if red_ramp < 0.30 else 'FAIL'}")


# =====================================================================
print("\n" + "=" * 74)
print("5) CAMPAIGN MONOTONICITY — curve B codex applied (constant worst-case, PT1)")
print("=" * 74)
def campaign(holo_const):
    qf = 0.0; life = 0.0; rows = []
    for w in WALLS:
        qfmult = 1.0 + BASE_RATE * math.log10(1.0 + qf)
        t, C = run_layer(w, qfmult * holo_const)
        life += C
        qf = math.floor(K * (life / D_NORM) ** E)
        rows.append(t / 3600)
    return rows
for tag, H in [("no codex (x1.00)", 1.0),
               ("curve B max (x1.35)", 1 + codex_bonus_B(1.0)),
               ("curve B mid (x1.148, c=0.65)", 1 + codex_bonus_B(0.65))]:
    rows = campaign(H)
    mono = all(rows[i + 1] > rows[i] for i in range(len(rows) - 1))
    seq = " -> ".join(f"{x:.2f}" for x in rows)
    print(f"  {tag:<30}: [{seq}]h  monotonic={mono}")


# =====================================================================
print("\n" + "=" * 74)
print("6) DECISION SUMMARY")
print("=" * 74)
print("  * curve B (0.35*c^2) CONFIRMED: worst -25.9%, mid(c=0.65) -12.9%, headroom >=4.1%p")
print("  * B_HOLO PLACEMENT: absorbed into the single codex holo sub-pool (<= +0.35x cap).")
print("    A SEPARATE B_HOLO additive term would push codex contribution to +0.45x")
print("    (x1.45 -> -31.0%) -> REJECTED. One pool, curve B, capped +0.35x.")
print("  * §3.4 30% guardrail: C-plan (A13/B8/B12 outside mult) => research_mult~=1.0,")
print("    combined dec26 reduction = codex pool only = -25.9% worst, PASS with margin.")
print("  * -30.1% boundary DISSOLVED: it only arose from codex x1.35 * research x1.06.")
print("    C-plan removes the x1.06, so no boundary breach.")
print("  * 'Higgs bonus' = codex unlock bonus (not a research node) -> already in codex pool.")
print("  * Campaign monotonicity preserved at all codex levels.")
