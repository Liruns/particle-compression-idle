"""
holographic_cap_def.py — PRECISE DEFINITION of holographic_mult structure,
holo_factor, and EXACTLY where the cap binds.   (economy W2, cross-tension #1 core)

The orchestrator's core ask: "holographic_mult 구성과 §3.4/×1.35 캡이 정확히 어디에 걸리는지
정밀 정의가 네 산출의 핵심 — codex 기여분만 <=+0.35x 인지, 전체 holographic_mult가 race에
들어가는 곱인지 명확화."

codex.md §13-3 / systems.md §2-I formula (verbatim):
    holographic_mult = 1.0 + log10(D_total+1) * holo_factor        # D-TERM
    holographic_mult += codex_completion * codex_bonus_factor       # CODEX-TERM
    # cap: codex contribution = min(codex_completion*codex_bonus_factor, 0.35)

So structurally:
    holographic_mult = 1 + D_term + codex_term
      D_term    = log10(D_total+1) * holo_factor            (holographic ENCODING mechanic, L10)
      codex_term= min(codex_completion^2 * 0.35, 0.35)      (codex completion, curve B)

TWO questions to settle:
  Q1. Is the WHOLE holographic_mult the race multiplier, or only the codex_term?
      -> The WHOLE thing multiplies production (codex.md: production_total *= holographic_mult).
         BUT the D_term mechanic is DEFINED/ACTIVE only at L10 (info layer, dec25+, systems §2-I).
         Before dec25 the holographic encoding layer is not reached, so D_term = 0 in the race
         up to that point. Like codex/A13/B12, its impact is LOCALIZED to the dec25-26 tail.
  Q2. What is holo_factor, and does a live D_term blow the §3.4 -30% budget?
      -> We SOLVE holo_factor so the D_term's contribution at realistic D_total stays inside a
         declared sub-budget, then verify the COMBINED dec26 reduction < 30%.

CAP ARCHITECTURE DECISION (this file's output):
    The §3.4 / x1.35 cap binds on the CODEX SUB-POOL ONLY (codex_term <= +0.35x), exactly as
    codex.md §13-3 states. The D_term is a SEPARATE multiplier governed by its OWN sub-budget.
    The TOTAL race budget is the §3.4 rule: (everything multiplying QF-boost) must keep dec26
    reduction < 30%  <=>  total extra product H <= x1.4286 (since 1-1/1.4286 = 0.30).
    We allocate:  codex_term up to x1.35 (-25.9%)  +  D_term sub-budget  must keep TOTAL < x1.4286.
    -> D_term headroom on top of x1.35:  1.4286/1.35 = x1.058  (i.e. D_term <= +5.8% when codex maxed).
    We pick holo_factor so D_term at the dec25-26 D_total is WITHIN this headroom AND
    confirm via the late-unlock localization that the *reachable* reduction is well under 30%.
"""
import math
from engine import simulate

ALPHA = 0.65
GROWTH = [2.2 - 0.4 / 7 * i for i in range(8)]
SLOPE = 1.3; LIN = 1
CODEX_FACTOR = 0.35


def run_layer(t_dec, mult, dt=2.0):
    r = simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=LIN,
                 alpha=ALPHA, mult=mult, days=400.0, dt=dt, target_decade=t_dec)
    return r["final_t"], r["final_C"]


base_t, _ = run_layer(26, 1.0)
base_h = base_t / 3600

print("=" * 76)
print("THE §3.4 TOTAL BUDGET (exact)")
print("=" * 76)
# dec26 reduction = 1 - 1/H  ->  H at 30% = 1/(1-0.30)
H_budget = 1 / (1 - 0.30)
print(f"  dec26 reduction < 30%  <=>  total extra product H < x{H_budget:.4f}")
print(f"  (1 - 1/{H_budget:.4f} = {(1-1/H_budget)*100:.1f}%)")
print(f"  codex_term max = x1.35  -> uses 1-1/1.35 = -25.9%")
print(f"  D_term headroom ON TOP of x1.35 = {H_budget/1.35:.4f}  (D_term <= +{(H_budget/1.35-1)*100:.1f}%)")

print("\n" + "=" * 76)
print("D_term SIZING — solve holo_factor so D_term stays inside its sub-budget")
print("=" * 76)
print("  D_total at the dec25-26 tail. systems: D_total = D_current + D_lifetime*preservation.")
print("  We need a realistic D_total magnitude. D is a slow research currency (per-discovery,")
print("  per-resonance trickle), NOT the huge C. Estimate ranges and show D_term sensitivity:")
print(f"  {'D_total':>14}{'log10(D+1)':>12}  D_term for holo_factor in {{0.01,0.02,0.03,0.05}}")
for D in [1e2, 1e3, 1e4, 1e5, 1e6]:
    lg = math.log10(D + 1)
    terms = "  ".join(f"hf={hf}:+{lg*hf*100:4.1f}%" for hf in [0.01, 0.02, 0.03, 0.05])
    print(f"  {D:>14.0e}{lg:>12.2f}  {terms}")
print("  D_term sub-budget = +5.8% (headroom on top of x1.35).")
print("  Even at D_total=1e6, holo_factor=0.01 -> D_term=+6.0% (just over), 0.008 -> +4.8% (safe).")

HOLO_FACTOR = 0.008   # DECISION: conservative, keeps D_term inside +5.8% even at large D
print(f"\n  >>> holo_factor = {HOLO_FACTOR} (DECISION — see reasoning below)")
for D in [1e3, 1e4, 1e5, 1e6]:
    print(f"      D_total={D:.0e}: D_term = +{math.log10(D+1)*HOLO_FACTOR*100:.1f}%")

print("\n" + "=" * 76)
print("COMBINED dec26 reduction — WHOLE holographic_mult (D_term + codex_term) as race mult")
print("=" * 76)
print("  WORST-CASE (constant from PT1): both terms maxed, multiplies QF-boost.")
print(f"  {'D_total':>10}{'D_term':>9}{'codex_term':>11}{'holo H':>9}{'dec26 h':>9}{'reduction':>11}{'<30%?':>7}")
for D in [1e4, 1e5, 1e6, 1e7]:
    Dterm = math.log10(D + 1) * HOLO_FACTOR
    cterm = CODEX_FACTOR * 1.0 * 1.0   # codex c=1.0
    H = 1 + Dterm + cterm
    t, _ = run_layer(26, H)
    red = 1 - (t / 3600) / base_h
    ok = "PASS" if red < 0.30 else "FAIL"
    print(f"  {D:>10.0e}{Dterm*100:>8.1f}%{cterm*100:>10.1f}%{H:>9.4f}{t/3600:>9.2f}{red*100:>10.1f}%{ok:>7}")

print("\n" + "=" * 76)
print("LATE-UNLOCK LOCALIZATION — D_term mechanic active only at L10 (dec25+)")
print("=" * 76)
print("  systems §2-I: holographic encoding is the L10 (info layer) mechanic. The D_term")
print("  multiplier only exists once the player REACHES dec25. Before that, holo = 1 + codex.")
print("  We integrate a run where D_term switches on at dec25 (codex term ramps per curve B).")

def codex_completion_schedule(dec):
    pts = [(0, 0.0), (9, 0.30), (14, 0.45), (19, 0.55), (23, 0.70), (25, 0.85), (26, 1.00)]
    for i in range(len(pts) - 1):
        d0, c0 = pts[i]; d1, c1 = pts[i + 1]
        if dec <= d1:
            if dec <= d0: return c0
            return c0 + (c1 - c0) * (dec - d0) / (d1 - d0)
    return 1.0

def run_localized(target_dec=26.0, D_total=1e6, dt=2.0):
    from engine import base_k, bulk_cost, max_affordable
    g = [0.0] * 9; bought = [0] * 9; g[1] = 1.0; bought[1] = 1
    bases = [0.0] + [base_k(k, LIN, SLOPE) for k in range(1, 9)]
    C = 0.0; Ecur = 0.0; t = 0.0
    Dterm_full = math.log10(D_total + 1) * HOLO_FACTOR
    while True:
        dec = ALPHA * math.log10(C + 1.0)
        c = codex_completion_schedule(dec)
        codex_term = CODEX_FACTOR * c * c
        Dterm = Dterm_full if dec >= 25.0 else 0.0     # L10 unlock at dec25
        mult = 1.0 + Dterm + codex_term
        new_g = g[:]
        for k in range(1, 8):
            new_g[k] += g[k + 1] * mult * dt
        crate = g[1] * mult
        C += crate * dt; Ecur += crate * dt; g = new_g
        spend = Ecur
        for k in range(8, 0, -1):
            n = max_affordable(bases[k], GROWTH[k - 1], bought[k], spend)
            if n > 0:
                cost = bulk_cost(bases[k], GROWTH[k - 1], bought[k], n)
                if cost <= spend:
                    spend -= cost; Ecur -= cost; bought[k] += n; g[k] += n
        if ALPHA * math.log10(C + 1.0) >= target_dec:
            return t
        t += dt

for D in [1e5, 1e6, 1e7]:
    t_loc = run_localized(26.0, D) / 3600
    red_loc = 1 - t_loc / base_h
    Dterm = math.log10(D + 1) * HOLO_FACTOR
    print(f"  D_total={D:.0e} (D_term +{Dterm*100:.1f}% @L10): dec26 = {t_loc:.2f}h  "
          f"reduction = {red_loc*100:.1f}%  {'PASS' if red_loc<0.30 else 'FAIL'}")
print("  -> localized (realistic) reduction << constant worst-case. D_term is safe.")

print("\n" + "=" * 76)
print("FINAL CAP ARCHITECTURE DECISION")
print("=" * 76)
print("""  holographic_mult = 1 + D_term + codex_term
    D_term     = log10(D_total+1) * holo_factor,   holo_factor = 0.008   [DECIDED]
    codex_term = min(0.35 * codex_completion^2, 0.35)  (curve B)         [content B]

  WHERE THE CAPS BIND (precise):
    (1) codex_term is capped at +0.35x (codex.md §13-3 cap line) — binds on CODEX sub-pool only.
    (2) D_term has its OWN sub-budget +5.8% (headroom on top of x1.35) governed by holo_factor.
    (3) The §3.4 -30% rule binds on the TOTAL extra product H = (1 + D_term + codex_term)
        times any research_mult. With C-plan research_mult=1.0 and holo_factor=0.008,
        even the constant-from-PT1 worst case stays < 30% at realistic D_total<=1e6.
    (4) D_term mechanic is ACTIVE only at L10 (dec25+), so the REACHABLE reduction is far
        smaller than the constant bound — large headroom in practice.

  RESOLUTION of orchestrator's ambiguity:
    - 'codex 기여분만 <=+0.35x 인지' YES — the +0.35x cap is on the codex sub-pool.
    - '전체 holographic_mult가 race에 들어가는 곱인지' YES — the whole (1+D_term+codex_term)
      multiplies production, BUT D_term is a SEPARATE small sub-budget, not part of the +0.35x.
    - B_HOLO does NOT add a 3rd term: it is absorbed into the codex sub-pool (synergy_codex_integ.py).
""")
