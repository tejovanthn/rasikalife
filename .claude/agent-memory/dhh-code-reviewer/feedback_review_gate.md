---
name: feedback-review-gate
description: How Tejovanth commissions and consumes these reviews — phase gates, pre-formed opinions he wants argued with, and claims he expects executed rather than read
metadata:
  type: feedback
---

Reviews here are a **formal gate between phases of a written plan**, not a nicety. Deliver a verdict per numbered question, and do not soften.

**Why:** the repo's history shows the loop closing — a plan in `docs/plans/`, then commits like `fix: act on DHH review of phase 1` and `docs: record deferred phase 1 review findings`. Every finding gets either fixed or explicitly deferred, so a vague finding costs him a decision he can't make.

**How to apply:**
- When he says "I noticed this and did not fix it, wanting an independent read", he has already formed a view. Confirming it is worth little; give the argument, name where the fix belongs, and say plainly when his instinct is wrong.
- "Verify by actually parsing, not by reading" is literal. Run the schema, run the test, add a throwaway test to prove a guard fires, then delete it. Assertions from reading get discounted.
- He supplies verified test/typecheck baselines and asks you to re-derive them. Do it — it is a check on the baseline, not busywork.
- Phases are often written by several parallel subagents. Cross-file consistency (does the new junction match the precedent junction? does the new cascade cover every path the old one covers?) is a first-class review axis, not a nit.
- He will name the specific things he wants scrutinised. Answer all of them, and still report what he did not ask about — the highest-value finding is usually outside his list.

Related: [[project-rasika-shape]], [[project-auto-checkpoint-commits]].
