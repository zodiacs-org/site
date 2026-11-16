# Engine 1.1.0 on the site: a trial for ZOD-63 (not adopted)

A trial of moving the vendored `@zodiacs/engine` from 1.1.0-rc.2 to 1.1.0, made on 2026-11-16 to see
whether it gives the connector one time for a planet's sign change, the one NASA JPL Horizons gives. It is
not an adoption: the upgrade breaks pages, data and published tool outputs well beyond a small change, so
this branch stops here and opens no pull request.

- **Archive.** `vendor/zodiacs-engine-1.1.0.tgz`, copied from engine `artifacts/` (carrier `d82d241`, merged
  by `322f855`, engine pull request 104; source commit `2496c28f273e1e99526490e857332fae44473367`).
  SHA-256 `4e53cda9bd6ccb5f5581c2a9af2f2ae4010af2599f411ac5220425e0932e41ac`, checked against the
  carried receipt and `artifacts/README.md`.

## The sign changes against Horizons

`tools/ingress-vs-horizons.mjs` compares the engine's crossing of each sign boundary with the 498 sign
changes of `src/data/nasa-event-instants.json` (Horizons DE441, apparent geocentric ecliptic longitude of
date, QUANTITIES 31, Mars to Pluto as system barycentres, as the engine's DE440 pack computes them). A fresh
Horizons query could not be made from the session: its network policy refused ssd.jpl.nasa.gov (proxy
403), so the reference is the committed table, whose provenance names every query URL, retrieval time and
response SHA-256. Results: `ingress-vs-horizons-1.1.0-rc.2.json` and `ingress-vs-horizons-1.1.0.json`.

| Sign change | Horizons | 1.1.0-rc.2 | 1.1.0 |
| --- | --- | --- | --- |
| Neptune into Aries | 2026-01-26 17:35:23 | 14:31:41 (3 h 4 min early) | 17:34:38 (45 s early) |
| Saturn into Aries | 2026-02-14 00:11:49 | 00:39:45 (28 min late) | 00:11:39 (10 s early) |
| Uranus into Gemini | 2026-04-26 00:51:53 | 01:00:45 (9 min late) | 00:51:32 (21 s early) |
| Uranus into Gemini | 2025-07-07 07:47:45 | 07:58:54 (11 min late) | 07:47:19 (26 s early) |
| Saturn into Aries | 2025-05-25 03:36:08 | 04:16:49 (41 min late) | 03:35:52 (16 s early) |
| Pluto into Aquarius | 2024-11-19 20:40:00 | 21:03:36 (24 min late) | 20:38:57 (63 s early) |
| Pluto into Aquarius | 2024-01-21 00:56:19 | 01:09:33 (13 min late) | 00:55:46 (33 s early) |

From 1962 to 2099, on 1.1.0: every sign change of Mercury to Saturn within a minute (Saturn's largest 48 s);
Uranus 47 of 57 (largest 2 min 53 s), Neptune 23 of 30 (2 min 46 s) and Pluto 15 of 30 (5 min 55 s). As an
angle every difference is under 0.42 arcseconds, most about 0.05 with the engine early: a frame difference
between Horizons's ecliptic of date and the engine's, which at a slow planet's speed is minutes. On rc.2 the
same rows were up to 4 h 28 min (Neptune), 9 h 38 min (Pluto) and 1 h 32 min (Saturn) away.

## What else would have to change

`npm test` on 1.1.0 with nothing else changed: 141 tests fail in 46 files that pass on main
(`failing-tests-1.1.0.txt`). Among them: the server and browser ephemeris parity, which CLAUDE.md pins to
1e-12 (the browser's `src/lib/engine/` stays on astronomy-engine, 0.00018 degrees apart); the 2026 transits
months, `sky.json`, the natal planet-pair evidence, the scene snapshot and the daily fact audit, which
regenerate differently; the compute API bundle, examples, OpenAPI responses and playground; the MCP
adapter archive and its README examples; the conventions registry (1.1.0's new receipt ids); the claims
ledger and the methodology accuracy claim; the Phase 1 captures; the hosted tools' flag-off byte-for-byte
checks; and the compute API's own parity test against the event pages published for 2026. That is a full
adoption on the scale of 1.1.0-rc.2's (`../site-engine-1-1-0-rc2/`), plus a decision on DE440 in the browser
or on the server only (draft #943), not a small change.

## Also on this branch

`src/ai-tools/features/engine-ingress.ts`: search_sky_events and the year view of get_horoscope_period list
sign changes from `src/data/ingresses.json`, which `scripts/build-ingresses.mjs` builds with astronomy-engine
directly, not with `@zodiacs/engine`, so the upgrade alone leaves them at the old times. The module keeps
the table's list of sign changes and gives each the engine's own instant, so every tool gives one time.
Its tests are `engine-ingress.test.ts`. This is what draft #975's NASA table did for those two tools that
1.1.0 does not do by itself; the rest of #975's table is what 1.1.0 already does.
