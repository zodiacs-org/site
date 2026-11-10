# P4.1: the DE440 reduction as the hosted backend

The acceptance ledger's P4.1, weight 8: "DE440 reduction as the hosted
backend (v1 M2.6 rules)". The unit is preregistered in
[PREREGISTRATION.md](PREREGISTRATION.md) (commit `5305fc74`, pushed
2026-11-09 16:32:34Z), and nothing in it changes; what was done otherwise is
under *Departures*. Nothing in this folder is a result until the run (S5)
writes one.

## What this folder holds

| Path | What | Step |
| --- | --- | --- |
| [PREREGISTRATION.md](PREREGISTRATION.md) | the rules, the holdout, the checks, the verdict | S1 |
| [oracles/](oracles/), [tools/](tools/) | the ERFA chain's places (rule (viii)) and nodes (C4), their generator and self-checks, and C3's record | S2 |
| `../../../../.github/workflows/precision-pack.yml` | the pack built on Linux (S2), then tier B and rule (vi) | S2, S3 |
| [harness/](harness/) | the one recorded script of S5 (`run.mjs`) and its parts: the hosted path in process (`lib/api.mjs`), the clock, the rules, the checks, the holdout, Swiss and Horizons (`swiss.py`, `horizons_holdout.py`, [README-python.md](harness/README-python.md)), rule (vi) (`cross-runtime/`), rule (viii) for the research runtime (`viii-alpha.mjs`) and the pack gate (`pack-gate.mjs`) | S3, frozen at S4 |
| `run/` | the run: `results.json`, `run.log`, the holdout, its Horizons responses and JPL's EOP2 file, the carried directions, the replay (C6) | S5 |
| `reviews/` | the two bounded reviews and their dispositions | S6 |

## The backend

Engine 1.1.0-rc.3 (zodiacs-org/engine#84, merged on 2026-11-10 as
`bc0b5a76`) adds `@zodiacs/engine/de440`, which opens the sealed pack and
reduces it as the preregistration fixes, and the root's `withEphemeris`,
which runs the engine's calls with a source in place of astronomy-engine.
The site adopts it in `71b478c0`
([../site-engine-1-1-0-rc3/](../site-engine-1-1-0-rc3/README.md)). The compute
API (`src/lib/compute-api/backend.ts`) takes `"backend"` on the five
endpoints that give positions; the deploy builds the pack
(`scripts/build-precision-pack.mjs`), never committed, and the function opens
it for each request (`de440FromFile` in `src/lib/compute-api/handler.ts`).
Until P4.1 is recorded `validated`, the default stays astronomy-engine.

## The freeze (S4)

The harness under [harness/](harness/), the CI job in
`.github/workflows/precision-pack.yml` and this README are committed
together, after the adoption, as the freeze. S5 runs the harness as frozen
there, once, and draws the holdout then; a change to the harness or the job
after the freeze is a departure, and this README gains only the run's record.

## Departures

Each is disclosed with its reason and effect; the unit stays `validated`
until the owner ratifies them (the programme README's rule).

1. **Horizons in chunks.** The preregistration fetches the holdout "exactly
   as `fetch.py` does", one request per target. With the holdout's 200 TT
   dates in one TLIST, Horizons answers HTTP 502: on 2026-11-10 a 24-date
   (723-character) and a 60-date (1,335-character) request were answered, a
   100-date (2,015-character) and a 200-date (3,715-character) one were not.
   `horizons_holdout.py fetch` therefore sends each target's dates in
   consecutive chunks of at most 50, with `fetch.py`'s parameters otherwise,
   and keeps each chunk's response verbatim. Effect: the same rows, from the
   same service, in four responses per target instead of one.
2. **curl.** `fetch.py` used Python's `urllib`. On the recording machine
   Python's certificate stores lack the root JPL's chain ends in (Sectigo
   Public Server Authentication Root R46), so `urllib` refuses a genuine
   chain; the tool fetches with the system's `/usr/bin/curl`, HTTPS only, TLS
   verified against the operating system's trust store. Effect: none on the
   bytes requested or kept.

## Before the run

The harness was exercised before the freeze, outside the repository, with
the holdout id `zodiacs-holdout/P4.1-harness-dev` (not P4.1's, which is drawn
only in S5): its Horizons fetch, its Swiss calls, the corpus rules and the
checks, on the development build. The corpus rules' numbers were therefore
seen before the freeze, as the research runs' were (development data, as the
preregistration says of them); P4.1's holdout was not drawn. After those
numbers were seen, no code that computes a position changed: the later engine
commits add refusals of other entries inside `withEphemeris`, tests and
documentation. Those runs are not P4.1's result.

## The run

To be written by S5.
