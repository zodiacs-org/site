# Guide gate repair after checkpoint 9

The first complete-checkpoint CI run at `fb4efd3b` passed eighteen checks,
but Build & Check stopped at the Phase 6 Ask Zodiacs drive:
https://github.com/zodiacs-org/site/actions/runs/36830688009/job/110266353472

Its three failed expectations were composer autofocus on touch opening, a
full-width mobile sheet, and a near-full-height desktop drawer. Merged PR #606
explicitly approved a compact 66dvh mobile panel and touch opening without
summoning the keyboard:
https://github.com/zodiacs-org/site/pull/606

The current CSS specifies 10px mobile insets, a 600px compact height cap,
16px desktop insets, and a 680px desktop height cap. Its existing unit contract
already reflects those choices. The browser drive had not been updated.

## Narrow changes

- Measure bounds after the panel's entrance animations finish and enforce the
  approved compact/inset geometry, with the existing two-pixel tolerance.
- Verify touch opening focuses the labelled modal, explicit touch focuses the
  composer, and keyboard opening focuses the composer. Keep privacy, consent,
  request-PII and 44px-target assertions unchanged.
- Cover Expand/compact, Hide/reopen draft retention, and both focus wraps.
- Correct a real focus-trap omission: reverse Tab from the deliberately
  focused modal itself must wrap to its last enabled control. The production
  listener is executed in a unit test; removing the new condition reproduces
  the original failure. No focusable selector or forward-wrap policy changes.
- Run the Guide drive in the existing opt-in Browser Evidence compare job,
  independently of later Site Check gates, and retain Guide screenshots in
  the existing artifact directory. Permissions remain contents-read only.
  The provenance record includes the Guide step's outcome, never its outputs.

## Verification and outstanding evidence

- Node 22.22.2 focused suite: 55 tests pass across the Guide and browser-evidence
  controls. The Guide subset alone has 36 tests.
- Guide bundle rebuild and full site build pass; all bundle budgets remain
  unchanged. Typecheck passes with zero errors/warnings and eighteen hints.
- Full suite: 6,352 tests pass, four skip, and exactly one fails: the mandatory
  stale Phase 1 capture hash. That failure is preserved and not waived.
- The render-source hash changes from
  `0b53514a64e0e9a3fa6c7cae1be3ab70f274f1a13bcd8a2aafbf481c9e5a0cf6`
  to `3653d309905add0cfa5a51eb74a768ce0e7e82118c84cb73952fef856910f841`.
- The executor cannot launch Chromium because its Unix sockets are denied.
  No local browser pass or fresh capture is claimed. The existing head-bound
  Browser Evidence workflow must capture the final source, then the reviewed
  artifacts must be imported and the complete Site Check rerun.

This is synchronization with the previously approved Guide contract and a
focus-trap repair, not a change to an astronomical tolerance, performance
budget, privacy promise, or programme denominator. P3.3 remains unaccepted.
