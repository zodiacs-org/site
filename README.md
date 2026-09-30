# zodiacs.org

The source of [zodiacs.org](https://zodiacs.org): a free astrology site with
guides, calculators that compute charts in the visitor's browser, and a
developer section. The site also keeps the Registry (Astrofolio), its record
of the Zodiacs collection, as a separate wing with its own pages.

Production deploys from `main` through Vercel as a static Astro build, with a
few serverless functions under `api/`.

This repository is public so that its work can be read and checked. It is not
open source: all rights are reserved (see [LICENSE](LICENSE)).

## What is where

- **The astrology site** is everything Astro builds from `src/`: the sign
  guides, the Learn pages, the calculators (`/birth-chart/`, `/moon-sign/`,
  `/rising-sign/` and others), the daily pages and the developer pages under
  `/developers/`. Charts are computed on the visitor's device by
  [`@zodiacs/engine`](https://github.com/zodiacs-org/engine), which the site
  vendors as a digest-pinned archive in `vendor/`.
- **The Registry wing** is the static pages in `public/registry/`,
  `public/thesis/`, `public/archive/` and `public/sdk/`, plus the wing routes
  under `src/pages/registry/`, `src/pages/terminal/` and `src/pages/fomo/`. It
  keeps its own register; `CLAUDE.md` gives the boundary between the two, and
  CI enforces it.
- **Records** of how the site and its engine are checked are in `docs/`:
  `docs/platform/programme/` (the programme's acceptance ledger and status),
  `docs/platform/evidence/` (measurements), and `docs/claims/ledger.json` (the
  evidence behind every accuracy, time and privacy sentence on the site).

## Development

```bash
npm ci
npm run dev        # Astro dev server
npm run build      # static build to dist/ (runs the generators' checks first)
npm run check      # consumer boundary, footer and astro check
npm test           # vitest
node scripts/check-dist.mjs   # link and artifact integrity over dist/
```

Several files are generated; `CLAUDE.md` lists each with its generator. Edit
the source, run the generator, and commit both: CI regenerates them and fails
on any difference.

## Privacy

Birth details entered in the calculators are computed on the visitor's device.
What the site does send, and when, is described on
[the privacy page](https://zodiacs.org/privacy/).

## Licence

All rights reserved; see [LICENSE](LICENSE), which also lists the parts that
come with their own terms: the chart engine (MIT code with CC BY 4.0 ΔT data, and the time and star data its NOTICE lists), the CC BY 4.0 sky
data and GeoNames place data, and third-party packages.

[CONTRIBUTING.md](CONTRIBUTING.md) says what kinds of report are welcome,
[SECURITY.md](SECURITY.md) how to report a security problem, and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) the rules for taking part.
