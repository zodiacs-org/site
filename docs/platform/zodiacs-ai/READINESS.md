# Zodiacs plugin readiness

Updated 2026-10-06. The owner's target is at least 9/10. A score is a product
judgment, not a test count. The candidate is not yet certified at that level:
no consenting human beta feedback exists, and the new hosted workflows need
native ChatGPT acceptance.

## Product lineup

**Zodiacs Sky** helps a person explore a dated sky, inspect a chart and understand
what changed. Calendar, Chart Studio, Time Explorer and the private Sky Watch
preview are capabilities of this offering. Temporary deployment profiles are
test environments, not additional products to market.

**Zodiacs Developer** helps a builder calculate, reproduce and integrate an
astrology result using versioned methods, records and runnable examples.
The published engine version in an external recipe is distinct from the site's
vendored engine candidate. Never describe an unpublished candidate as an npm release.

## What would justify 9/10

| Area | Required evidence | Current position |
| --- | --- | --- |
| Calculation integrity | Versioned, reproducible results; explicit time/zone/coverage; meaningful negative tests | Implemented and automated checks pass; historical clock and receipt edge cases covered |
| First use | An unfamiliar user completes the primary task with clear defaults and recovery | Local time/city entry added; real unfamiliar-user trial still missing |
| ChatGPT experience | Current candidate opens globally and in conversation; worker, reviewed sharing, record export and event lifecycle work in the actual host | Current Studio/calendar render in conversation; local-time review, time stepping, worker completion, record reproduction and explicit sharing pass. Host blocks direct downloads/automatic clipboard; manual local copy verified against the displayed JSON. Native cancellation and event lifecycle remain pending |
| Trust | Clear company, website, support, privacy, terms, calculation methods and honest preview limits | Most profiles updated; Watch profile verified; original portable cloud profile still needs its desktop update; publisher verification pending |
| Reliability | Refresh/restart/retry, quota and cancellation checks; live disconnect blocks access/delivery; scheduled-worker health | Local PostgreSQL lifecycle and hosted OAuth/revocation pass; real ChatGPT delivery and stop still unverified |
| Usefulness | Consenting completion/usefulness and voluntary second-use evidence | No testers or fabricated results; task kit ready |
| Release operations | Exact candidate CI, rollback, owner review, sustainable capacity and measured hosting | Separate test deployment/limits in place; latest CI and final release review still required |

All rows need evidence, with no unresolved privacy, calculation or critical
usability defect. The small beta's proposed completion/usefulness and second-use
criteria are in [BETA_REVIEW.md](./BETA_REVIEW.md); they are proposed decision
rules, not measured outcomes. An owner's synthetic walkthrough provides useful
acceptance evidence but cannot stand in for independent user feedback.

## Remaining order of work

1. Completed: ChatGPT connected the existing synthetic preview account.
2. Finish native cancellation and Sky Watch subscription/arrival/refresh/stop on
   the 0.3.2 package candidate (runtime 0.3.0). The latest host exposes no
   subscription action; do not replace it with polling or claim delivery.
   [Current native evidence](evidence/native-2026-10-06/README.md) records the
   successful workflows and exact remaining limits.
3. Fix observed defects; repeat the affected checks and the final candidate CI.
4. Owner recruits consenting testers or explicitly revises the beta plan. Do not
   contact people without instruction. Record only the agreed aggregate feedback.
5. Review publisher identity, costs/capacity and beta results before the
   owner-reserved submission, merge or production activation.

Further plugin proliferation is deferred until these two offerings reliably
complete their primary workflows.
