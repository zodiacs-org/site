# Market Lens private research

This is an offline, versioned experiment, separate from the browser application.
It compares fixed TA, lunar-phase, and combined logistic models with training-only
benchmarks. Read `manifest.json` before running. It is a compact preregistration,
not proof of independent third-party preregistration.

Run from the site checkout with its pinned Node and installed dependencies:

```sh
./node_modules/.bin/vitest run research/market-lens/core.test.mjs --maxWorkers=1 --minWorkers=1
node scripts/market-lens-research.mjs acquire --dir /workspace/.onboarding/lens-research/v1
node scripts/market-lens-research.mjs run --dir /workspace/.onboarding/lens-research/v1
```

`acquire` uses curl, preserving the host's HTTPS proxy and TLS trust. It makes
bounded, sequential requests for finalized Coinbase Exchange UTC daily bars.
It saves the manifest hash before requesting data, records raw bytes and hashes,
reuses verified pages on restart, validates prices/time/volume and rejects
conflicting duplicates. Leading pre-listing absence is reflected in observed
coverage; internal missing bars remain gaps. No filling or venue splicing.

`run` needs no network. It verifies dataset and original-response hashes,
generates lunar features with the site's pinned rc.15 engine, runs two expanding
validation folds, writes model-selection receipts, and evaluates the frozen
2023-onward holdout. Raw data, full feature rows, model weights and individual
holdout predictions remain in the specified private directory. Concise aggregate
`results.json` and generated `REPORT.md` are reviewable source artifacts; the app
does not expose live model predictions.

The end date and all choices are fixed in the manifest. Change the experiment
version and directory for a new protocol; do not revise choices after viewing
the same holdout and describe it as unseen. Re-running identical code/data checks
reproducibility only. Aggregate results include retrieval/source hashes, all
candidate scores, calibration counts, yearly slices and paired block uncertainty.

Public API accessibility does not establish market-data display/redistribution
rights. No raw data is committed or published. Classification performance does
not establish profitability. Prospective paper forecasts and independent review
are prerequisites for a public model feature.
