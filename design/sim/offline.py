"""
Offline progression model + clock-tamper defense + long-idle decay.

Spec:
  offline_gain = rate_at_disconnect * min(elapsed, CAP) * modifier
  CAP = 24h (hardcore option 48h)
  modifier = 0.65 (online 65%); FIRST run after prestige modifier = 1.0
  long-idle bonus: beyond CAP, add a damped log term so AFK >24h still trickles:
     bonus_factor(elapsed) = 1 + LB*log10(1 + max(0, elapsed-CAP)/CAP), capped
  clock-tamper: elapsed = min(now-last, MAX_DELTA=CAP*tamper_mult)

Key question: how much does offline accelerate CALENDAR progression?
Idle players check in ~2x/day. We model a realistic check-in schedule and
compare active-only vs active+offline to get true calendar-week pacing.

Offline granted as a lump of E AND C (both flow from tier1 at disconnect rate).
We approximate offline progress as: advance the sim by an EFFECTIVE online time
 = min(elapsed,CAP)*modifier*bonus_factor  (since production is rate-linear in C,
  a lump grant of rate*dt*mod is equivalent to mod*dt of online progression at the
  *frozen* rate; conservative because online rate would have compounded faster).
This is the standard idle approximation and is a LOWER bound on offline value.
"""
import math

CAP_H = 24.0
MODIFIER = 0.65
LB = 0.5          # long-idle log bonus coefficient
MAX_DELTA_MULT = 2.0   # clock-tamper: cap elapsed at 2*CAP = 48h

def effective_offline_seconds(elapsed_s, modifier=MODIFIER, cap_h=CAP_H,
                              max_delta_mult=MAX_DELTA_MULT, lb=LB):
    """Return EFFECTIVE online-equivalent seconds credited for an offline gap."""
    cap = cap_h*3600
    # clock-tamper defense
    elapsed = min(elapsed_s, cap*max_delta_mult)
    capped = min(elapsed, cap)
    # long-idle damped bonus for the portion beyond cap (diminishing)
    extra = max(0.0, elapsed - cap)
    bonus = 1.0 + lb*math.log10(1.0 + extra/cap) if extra>0 else 1.0
    return capped * modifier * bonus

if __name__=="__main__":
    print("=== offline effective-time credit (modifier=0.65, cap=24h) ===")
    print(f"{'away(h)':>8} {'eff_online(h)':>14} {'ratio':>7}")
    for away_h in [1,4,8,12,24,36,48,72,168]:
        eff=effective_offline_seconds(away_h*3600)/3600
        print(f"{away_h:8} {eff:14.2f} {eff/away_h:7.2f}")
    print("\nNote: away>=48h clamps (tamper guard). 24->15.6h eff (0.65). "
          "Long-idle log bonus lifts 36h slightly above flat-cap.")
    print("\n=== post-prestige first-run modifier=1.0 ===")
    for away_h in [8,24]:
        e065=effective_offline_seconds(away_h*3600,0.65)/3600
        e100=effective_offline_seconds(away_h*3600,1.0)/3600
        print(f"  away {away_h}h: normal {e065:.1f}h eff, post-prestige {e100:.1f}h eff (+{(e100/e065-1)*100:.0f}%)")
