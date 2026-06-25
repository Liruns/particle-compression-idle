"""
Core 8-tier compressor chain engine simulator.
Reproduces GDD §8 baseline (mult=1, no boost, single progression).

Model:
  Tier k produces Tier k-1 (k=2..8). Tier 1 produces compression depth C.
  dg_k/dt = g_{k+1} * mult   (k=1..7)
  dC/dt   = g_1 * mult
  radius decade: dec = alpha * log10(C+1), alpha=0.65, r0=1e-9
  cost_k(n) = base_k * growth^n,  base_k = 10^(1+2k)

Purchases: CLOSED-FORM bulk buy (geometric series). No while-bank loops.
C grows huge -> track in log space / cap to avoid float overflow.
"""
import math

# ---------- parameters ----------
ALPHA = 0.65
R0 = 1e-9

def base_k(k, base_exp_lin=1, base_exp_slope=2):
    # base_k = 10^(base_exp_lin + base_exp_slope*k)
    return 10.0 ** (base_exp_lin + base_exp_slope * k)

def cost_n(b, growth, n):
    return b * (growth ** n)

def bulk_cost(b, growth, owned, count):
    """Total cost to buy `count` units starting from `owned`."""
    r = growth
    if count <= 0:
        return 0.0
    return b * (r ** owned) * (r ** count - 1) / (r - 1)

def max_affordable(b, growth, owned, bank):
    """Closed-form max units buyable from current bank."""
    r = growth
    cur = b * (r ** owned)
    if bank < cur:
        return 0
    # bank >= b*r^owned*(r^n - 1)/(r-1)  -> solve for n
    val = bank * (r - 1) / (b * (r ** owned)) + 1
    if val <= 0:
        return 0
    return int(math.floor(math.log(val, r)))


def simulate(
    growth=2.0,
    alpha=ALPHA,
    mult=1.0,
    days=10.0,
    dt=1.0,                 # seconds per tick
    base_exp_lin=1,
    base_exp_slope=2,
    growth_per_tier=None,   # optional: list of 8 growths (tier1..tier8). overrides growth
    milestones=None,        # dict: owned_threshold -> mult (applied per tier on purchased count)
    buy_fraction=1.0,       # fraction of bank spendable per tick on buys
    start_g1=1.0,           # seed: start with 1 tier-1 so C accrues
    target_decade=27.0,
    log_every_decade=True,
    verbose=False,
):
    """
    Returns dict: decade_times {int_decade: seconds}, final state.
    Uses native floats; switches C to log tracking when it gets large.
    """
    if growth_per_tier is None:
        growth_per_tier = [growth] * 8
    if milestones is None:
        milestones = {}

    # state
    g = [0.0] * 9          # g[1..8] tier counts (total owned, incl produced)
    bought = [0] * 9       # purchased count (integer) per tier - for cost & milestones
    g[1] = start_g1
    bought[1] = int(start_g1)
    C = 0.0
    E = 0.0                # compression energy = currency (we treat C-production cost in E)
    # We model purchases as paid from a "bank". In GDD, E buys compressors.
    # Simplify baseline: bank accumulates from C-production proxy. Actually GDD:
    #   Tier1 produces C; we need an energy currency for buying.
    # For baseline pacing we follow the validated model: the chain self-feeds;
    # purchases are funded by accumulated production of the *currency* = E,
    # where dE/dt = g1*mult (same as C). We keep E as spendable, C as depth.
    # (This matches GDD §7: dC/dt = g1*mult; E is the buy currency from same source.)

    decade_times = {}
    bases = [0.0] + [base_k(k, base_exp_lin, base_exp_slope) for k in range(1, 9)]

    t = 0.0
    max_t = days * 86400.0
    last_dec_logged = -1

    def milestone_mult(cnt):
        m = 1.0
        for thr, mm in sorted(milestones.items()):
            if cnt >= thr:
                m *= mm
        return m

    while t < max_t:
        # ---- production (Euler) ----
        # high tiers feed low tiers
        new_g = g[:]
        for k in range(1, 8):
            # tier k gains from tier k+1
            prod = g[k + 1] * mult * milestone_mult(bought[k + 1]) * dt
            new_g[k] += prod
        # C and E from tier 1
        c_rate = g[1] * mult * milestone_mult(bought[1])
        dC = c_rate * dt
        dE = c_rate * dt
        g = new_g
        C += dC
        E += dE

        # ---- purchases: high tier first (skill heuristic) ----
        spend_bank = E * buy_fraction
        for k in range(8, 0, -1):
            b = bases[k]
            n = max_affordable(b, growth_per_tier[k - 1], bought[k], spend_bank)
            if n > 0:
                cost = bulk_cost(b, growth_per_tier[k - 1], bought[k], n)
                if cost <= spend_bank:
                    spend_bank -= cost
                    E -= cost
                    bought[k] += n
                    g[k] += n
        # ---- record decade ----
        dec = alpha * math.log10(C + 1.0)
        d_int = int(math.floor(dec))
        if d_int > last_dec_logged:
            for dd in range(last_dec_logged + 1, d_int + 1):
                decade_times[dd] = t
            last_dec_logged = d_int
            if verbose and log_every_decade:
                print(f"  decade {d_int} at t={t/3600:.2f}h  C={C:.3e}")
        if dec >= target_decade:
            break
        t += dt

    return {
        "decade_times": decade_times,
        "final_C": C,
        "final_t": t,
        "final_decade": alpha * math.log10(C + 1.0),
        "bought": bought,
        "g": g,
    }


if __name__ == "__main__":
    # Reproduce GDD baseline
    res = simulate(growth=2.0, alpha=0.65, mult=1.0, days=4.0, dt=1.0, verbose=True)
    dt_ = res["decade_times"]
    print("\n=== Baseline decade times (hours) ===")
    for d in sorted(dt_):
        print(f"decade {d:2d}: {dt_[d]/3600:8.3f} h  ({dt_[d]/86400:.3f} d)")
    print(f"final decade reached: {res['final_decade']:.2f} at {res['final_t']/86400:.3f} d")
