# DE440 comparison with live NASA JPL Horizons, replayed on engine 3.0.0

The comparison is the 2.1.0 record's
([site-engine-2-1-0/claims-horizons](../../site-engine-2-1-0/claims-horizons/README.md)):
the NASA JPL Horizons answers of 18 November 2026, their acquisition receipts
in its `requests.json`, the values in its `horizons-values.json.gz` and its
`comparison.py`, all unchanged. This directory replays them on the site's
engine at version 3.0.0, which computes on astronomy-engine until
`useDe440()` installs its DE440 pack; `engine.mjs` installs it first, as the
site's server does (`src/lib/engine/server-de440.mjs`).

The replay gives the 2.1.0 record's figures exactly: the stratified, dense,
clock and Moon ingress summaries are equal to the last bit, because 3.0.0's
DE440 positions are 2.1.0's (`../values.json`). `results.json` is the 2.1.0
record's with the engine version and archive digest of 3.0.0; its event rows
are the 2.1.0 record's, as the published catalog is unchanged. The methodology
page keeps its dated statement about the comparison on 2.1.0.

With the locked Node dependencies and the same Python dependencies as the
independent reference rebuild installed, run this command from the site root.

```sh
python3 docs/platform/evidence/site-engine-3-0-0/claims-horizons/comparison.py --check
```
