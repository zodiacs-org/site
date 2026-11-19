# ZOD-63 live Horizons refresh

The request that previously failed at the network tunnel succeeded on 18 November 2026. `python3 scripts/accuracy-audit/horizons_fetch.py --refresh` fetched all 277 DE441 responses from `ssd.jpl.nasa.gov` from 14:33:22 to 14:34:20 UTC. The refresh used the script's exact query URLs and stopped on any request error. The URLs match the 277 earlier queries. The manifest records the retrieval time, byte count and SHA-256 of each response. [Live manifest](s1-horizons-manifest.json) [Earlier refusal](owner-horizons-refresh.json)

| Neptune enters Aries, 26 January 2026 | Earlier | Live |
| --- | --- | --- |
| Horizons interpolation, UTC | 17:35:23.115 | 17:35:23.115 |
| Horizons rounded to the second, UTC | 17:35:23 | 17:35:23 |
| DE440 bundled compute comparison, UTC | 17:34:38.262 in the connector evidence | 17:34:38.263 in the compute API |

The bundled compute API was exercised in process with the repository's request harness and an injected rate-limit verdict. Its result was 44.852 seconds earlier than the live Horizons interpolation. [Earlier connector evidence](connector-times.json) [Earlier interpolation](../../../accuracy-audit-2026-11/truth-events.json)

`truth.py` rebuilt 2,557 ingresses, 102 stations and 260 lunations from the live tables. Event counts agree with the earlier run. Maximum shifts were 3.999 seconds for ingresses, 37.862 seconds for stations and 0.001 seconds for lunations. `build-nasa-event-instants.py` rebuilt 498 ingresses, 102 stations and 797 aspects, and `--check` reproduced the result byte for byte. At whole-second precision, 43 ingress times moved by up to four seconds, 46 station times moved by up to 35 seconds, and nine aspect times moved by one second.

| Local comparison | Earlier or before | Live or after |
| --- | --- | --- |
| Published-data audit | 749 mismatches across 9,367 claims in the original report | 84 mismatches across 9,362 claims with the regenerated table. These were 80 raw ingress times, two raw degree displays and two lunar eclipse durations. All 1,548 printed-time checks matched. |
| Published-data audit using the archived site table | The current script looks up the current catalog keys directly in the archived table | 1,572 mismatches across 9,362 claims. Of those, 1,488 were missing lookup keys. Applying the site's archived-key lookup in a scratch comparison recovered all 1,488, leaving 84. |
| People-chart data only | 154 mismatches across 14,468 comparable checks | 154 mismatches across 14,468 checks, all natal positions |
| `src/lib/nasa-instants.test.ts` assertions run with Node's test runner and an assertion adapter | 17 passed and 0 failed with the published table | 9 passed and 8 failed after substituting the regenerated table in the worktree. All eight failures involve lookups through the published event keys. |
| Full `npm test` | 9,435 passed, 5 failed and 13 skipped | Blocked locally because Vitest was unavailable and the offline dependency install lacked the locked packages |

The published event table uses archived event keys. The regenerated table uses the current catalog's keys. The refresh was kept as comparison evidence so published lookups continue to use the archived table. The rendered-page and connector regression checks require dependencies absent from this workspace. The people-chart run covered stored data. The data audit used the committed lunar eclipse canon for duration checks. [Original audit](../../../accuracy-audit-2026-11/REPORT.md) [Earlier full test run](owner-verification.json)

The package manager made an unintended version-check request to `registry.npmjs.org` during the offline install. The install failed, and the version check was disabled for subsequent commands.
