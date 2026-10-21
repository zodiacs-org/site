# Build notes: synastry reference pages (preview)

These notes record the automated checks cited by `docs/synastry/RELEASE.md`.
The pages stay behind the preview flag; normal builds ship nothing new.

## Browser and ARIA
- `tests/synastry-reference-drive.mjs` runs in the synastry-reference CI job. It checks layout, keyboard order,
  privacy (no birth data leaves the page) and accessible names on the hub and the three pair pages.
- Relationship wheel reference links keep the visible text first in their accessible name and append the
  chart roles, for example "Read Sun-Moon conjunction in synastry (Moon in chart A, Sun in chart B)".
  Unit tests cover both role assignments.

## Lighthouse accessibility
- `npm run test:lighthouse` gates all four review routes with the existing mobile thresholds for
  performance, accessibility and SEO. No threshold was changed.

## Bundle budget
- The CI job runs `node scripts/report-bundles.mjs --fail` and `node scripts/check-dist.mjs` after the
  review build, so the 0 KiB entry budget in `budgets.synastry.json` is enforced.

## Evidence
- Each CI run uploads the `synastry-reference-<run id>` artifact (tests/visual/artifacts/), retained 30 days.
  Use the artifact from the latest run on the PR head for the numbers.

## Not covered by automation
- Named astrology and source approval, and a manual screen reader pass, remain release requirements.
