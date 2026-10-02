# Owner frontend test handoff

Source is owner main `db5bf5744507605cf0007ed3bc760596e7818428`, unchanged in the compute branch's frontend. The fresh compute [Explorer run](https://github.com/zodiacs-org/site/actions/runs/36914298793/job/110544352378) reports four failures. Calendar's independent current-source run reports the same four. Earlier mobile-menu and hidden-Guide failures no longer appear.

1. `tests/search-learning-checks.mjs:236`: EN at390px and ES at1440px saved-chart continuation still computes, but the whole stored synthetic profile string differs from the frozen `PROFILE` string (`:37`). No before/after field-level diff was retained by this assertion, so input loss or leakage is not established.
2. `tests/search-learning-checks.mjs:167`: the native reflection label at1440px has a44px height and owns sampled points, but overlaps a `BUTTON.btn.btn--ghost`. The row's reported bounds are left262, right1016.609375, top412.609375, bottom456.609375.
3. `tests/learning-practice-checks.mjs:30`: a30-second click timeout waits for the exact button name `Choose a saved chart`.

The programme does not alter these tests or authored frontend source. Capture receipt, visual comparison and Lighthouse passed. These failures are retained as owner-lane diagnostics; the compute privacy fix still needs final ordinary CI/merge/deployment checks.
