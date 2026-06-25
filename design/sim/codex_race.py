"""
codex_race.py — Codex completion bonus (holographic_mult) RACE SAFETY re-sim.

Trigger: qa-report-v2 CONCERN-NEW-2 — codex x1.5 alone shortens the dec26
single-run wall by -33.3%, violating director §3.4 / §7.2 "total product must
not shorten the single-run dec26 wall by >= 30%". Director R2 (§7.2) fixed the
codex completion-bonus cap at +0.35x (x1.35); x1.25 is the conservative floor
of the x1.25~1.35 fine-tuning band (content ramp curve TBD).

KEY ENGINE FACT (analytic): every production rate scales linearly with `mult`
(dC/dt = g1*mult ; dg_k/dt = g_{k+1}*mult). A CONSTANT holographic multiplier H
is therefore an exact time-rescaling: with t' = H*t the system is identical, so
reaching ANY fixed decade takes 1/H the time.
  => dec26 reduction = 1 - 1/H   (exact)
  => campaign run sequence = baseline sequence * (1/H)  -> monotonicity preserved
     STRUCTURALLY (a constant scale cannot reorder a monotone sequence).
The runs below confirm this numerically and reproduce the qa-report-v2 numbers.

Worst-case note: a constant H assumes codex is 100% complete from the very start
(holographic_mult maxed at PT1). The real bonus RAMPS with collection, so the
true reduction is strictly LESS than 1-1/H. x1.35 worst case (-25.9%) already
clears the 30% guardrail, so any monotone ramp to x1.35 is safe with margin.

Locked params identical to final_verify.py / qa-report-v2.
"""
import math
from engine import simulate

ALPHA = 0.65
GROWTH = [2.2 - 0.4 / 7 * i for i in range(8)]   # tier1=2.2 ... tier8=1.8
SLOPE = 1.3; LIN = 1
K = 1.0; D_NORM = 1e26; BASE_RATE = 0.25; E = 0.5
WALLS = [19, 21.5, 23, 24.5, 25.5, 26]


def run_layer(t_dec, mult, dt=2.0):
    r = simulate(growth_per_tier=GROWTH, base_exp_slope=SLOPE, base_exp_lin=LIN,
                 alpha=ALPHA, mult=mult, days=400.0, dt=dt, target_decade=t_dec)
    return r["final_t"], r["final_C"]


print("=" * 72)
print("1) BASELINE dec26 single run (mult=1)")
print("=" * 72)
base_t, _ = run_layer(26, 1.0)
base_h = base_t / 3600
print(f"  dec26 baseline = {base_h:.2f}h ({base_h/24:.2f}d)")

print("\n" + "=" * 72)
print("2) CONSTANT holographic mult H -> dec26 reduction (worst case: 100% codex)")
print("=" * 72)
print(f"  {'cap':>9} {'dec26 h':>9} {'reduction':>10} {'1-1/H':>8} {'<30%?':>6}")
for H in [1.5, 1.35, 1.25]:
    t, _ = run_layer(26, H)
    h = t / 3600
    red = 1 - h / base_h
    analytic = 1 - 1 / H
    ok = "PASS" if red < 0.30 else "FAIL"
    print(f"  x{H:<8.2f}{h:>9.2f}{red*100:>9.1f}%{analytic*100:>7.1f}%{ok:>6}")

print("\n" + "=" * 72)
print("3) CAMPAIGN RACE MONOTONICITY, holo applied from PT1 (extreme worst case)")
print("=" * 72)


def campaign(holo):
    qf = 0.0; life = 0.0; rows = []
    for w in WALLS:
        qfmult = 1.0 + BASE_RATE * math.log10(1.0 + qf)
        t, C = run_layer(w, qfmult * holo)
        life += C
        qf = math.floor(K * (life / D_NORM) ** E)
        rows.append(t / 3600)
    return rows


for holo in [1.0, 1.5, 1.35, 1.25]:
    rows = campaign(holo)
    mono = all(rows[i + 1] > rows[i] for i in range(len(rows) - 1))
    seq = " -> ".join(f"{x:.2f}" for x in rows)
    print(f"  holo x{holo:.2f}: [{seq}]h  monotonic={mono}")

print("\n" + "=" * 72)
print("4) codex_bonus_factor reverse-calc (codex.md formula)")
print("=" * 72)
print("  holographic_mult += codex_completion * codex_bonus_factor")
print("  completion=1.0 -> contribution = +cap  =>  factor = cap / 1.0")
for cap in [0.5, 0.35, 0.25]:
    print(f"    cap +{cap}x (x{1+cap:.2f}) -> codex_bonus_factor = {cap}")
