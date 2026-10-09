# Owner decisions of 2026-10-09: specific delegated ratification

The owner was asked two separate, explicit questions in the continuation
chat: whether to ratify F-71's shared-UT1 comparison and 1850–2049 window,
and whether B4.a may publish the tool's replies as its raw answers while
assistant answers remain private and are evaluated separately in B4.b.
The owner answered each: **"you decide the best course of action here"**.

The following decisions exercise that specific instruction. They do not infer
ratification from the general instruction to reach 100%, or from the separate
permission to use full GitHub Actions gates when the cloud executor failed.
They supersede the non-ratification of these named questions in
DECISIONS-2026-10-05.md §4. No unrelated amendment is ratified.

## 1. F-71: the same UT1 clock and an explicit reference window

**Decision.** Ratify giving Swiss the engine's UT1 Julian day in the
end-to-end Koch and co-ascendant comparisons. Ratify 1850–2049 as the
co-ascendants' judged end-to-end window, matching the house-system record.

**Reason.** Swiss houses_ex reads its input as UT1; the engine resolves UTC
through UT1−UTC. Reading the same clock compares the house algorithms rather
than a difference deliberately introduced into their time inputs. The
reference changes sidereal-time conventions outside the window. Acceptance
of this limited comparison must not imply a ≤3″ comparison outside it.

The window and reading were selected after results were known. This decision
does not turn their preregistrations into pristine preregistrations. Preserve
the original UTC-as-UT1 failures, the earlier scratch comparison, all
outside-window residuals, repeated-draw limitations and prior verdicts.
The limits and full chronology remain in FINDINGS F-71 and the 4 October
house/co-ascendant evidence.

**Action.** Verify the unchanged given-input and limited end-to-end gates on
the currently carried rc.2 before changing either unit to accepted. Keep the
fixed weights and tolerances. Ratification alone is not a fresh measurement.

## 2. B4.a: public tool replies; B4.b still needs assistant answers

**Decision.** Ratify the published check_sky_fact replies as B4.a's raw
answers. Preserve the frozen v0 files and their CC0 dedication. Require the
current engine/tool agreement gate and actual publication identities.

**Reason.** B4.a provides a reproducible public tool benchmark. B4.b separately
tests assistants, whose raw responses follow the private-baseline policy.
This reading separates those two deliverables without counting an assistant
trial that has not happened. Public tool replies alone do not address the
brief's risk of a self-serving assistant benchmark.

**Action.** B4.b and the monthly assistant panel retain their existing
uncompleted gates, account prerequisites and private-answer requirements.
No assistant output is invented or disclosed.

## 3. Publication and permissions

These ratifications authorize records and the named gate judgements. They do
not authorize a new stable archive, npm/PyPI/JSR publication, guide-route
publication, private clearance, Firewall changes, account grants, spending
or outreach. The separate stable publication proposal remains engine #32.
