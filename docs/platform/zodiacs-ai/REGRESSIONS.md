# Existing site regression gates

The AI candidate preserves consumer navigation, homepage, chart-demo and shared
style sources. A clean detached checkout of main at
`450f0fd948d86d82c416bcbd51b3dace5196097e` was built with the same dependency
installation and Chromium 151.0.7922.173. The inspected sources are byte-identical
to this branch. Hashes and measurements are recorded in
[`evidence/site-regression-review.json`](./evidence/site-regression-review.json).

## Visual baselines

The original Linux visual gate failed 11 of 15 cases. Every failed branch capture
has exactly the same pixels as its independently generated clean-main capture.
The differences include approved navigation/profile changes, footer labels and
mobile spacing that were absent from the older baselines.

The Linux baselines were generated on that clean main checkout with
`npm run test:visual:update`, copied into this branch and checked again with
`npm run test:visual`. The strict 0.1% budget and existing daily-data masks remain
unchanged. No consumer layout was changed to match a screenshot. Darwin baselines
were not captured or updated in this Linux environment.

## Homepage accessibility blocks the site-wide gate

The full existing Lighthouse gate ran three samples on each of 30 routes.
Twenty-nine routes passed; the homepage scored 93 for accessibility in all three
samples. Performance, SEO, LCP, CLS and TBT passed its existing budgets. No runner
stall or retake occurred. The protected routes retained their required noindex.

A separate one-sample Lighthouse run on clean main reproduced the same 93
accessibility score and failed audits:

- `target-size`: dense chart-demo planet, house and aspect buttons are too small.
- `color-contrast`: the selected Planet label has 4.38:1 contrast against its
  selected button surface, below the required 4.5:1.

The current chart-demo geometry is also pinned by existing layout contract tests.
A focused accessibility fix must preserve pointer selection and keyboard access
while correcting these targets. This candidate does not change that unrelated
interaction or weaken the accessibility floor. **The site-wide CI/release gate
remains blocked by this existing failure.**

To reproduce on the recorded main revision, run `npm ci`, `npm run build`, then
`LIGHTHOUSE_ROUTES=home LIGHTHOUSE_RUNS=1 npm run test:lighthouse`. The default
`npm run test:lighthouse` retains the full three-sample, 30-route gate.

## Navigation assertions

The homepage unit assertion now checks the approved “Your horoscope” action and
its actual destination. The terminal browser assertion now checks the approved
#606 profile shortcut, its 44px target, label and destination, nonoverlapping
actions, and lockup centering between menu and profile. Both preserve the approved
navigation source and styling; the complete terminal browser drive passes.
