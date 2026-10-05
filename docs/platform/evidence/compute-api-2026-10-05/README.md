# The compute API's cost per address, measured again, 2026-10-05

The compute API's limits were set on 2026-09-29 from requests measured with
engine rc.15 (`../compute-api-2026-09-29/`). DECISIONS-2026-09-30 §7 set them
so that one address at both rate limits costs at most 10 CPU-seconds a minute,
and said the rules come down if a later engine's figures pass that. The API
has run rc.16 since #620. This record measures both engines again, on one
machine, with the election search's costliest requests beside the others.

## How it was measured

On 2026-10-05, on a 4-core machine (Node 22.22.2, an Intel Xeon at 2.10 GHz)
with no other work running; each step waited for two quiet minutes first:

1. `tools/engine-rc15-rc16.mjs` timed the engine calls the API makes on rc.15
   and rc.16 in one process, alternately, ten rounds of 300 calls each
   (`engine-rc15-rc16.txt`).
2. `../election-search-v0/tools/worst-case.ts` sent every endpoint's
   costliest shapes through the real handler over every year from 1800 to
   2199, all shapes in one seeded random order: 1,600 events requests, 400
   positions requests, 200 chart requests, 400 each of sky-fact and time, and
   400 of each of four elections shapes. It ran once in a copy of the tree with
   engine rc.15 installed (`worst-case-rc15.json`, 12:30 UTC) and once with
   rc.16 (`worst-case-rc16.json`, 12:40 UTC).

## What it found

| | rc.15 | rc.16 |
| --- | ---: | ---: |
| events, 92 days, every body and kind: CPU p95 / most | 265 / 403 ms | 309 / 539 ms |
| positions, 100 instants: CPU p95 / most | 109 / 124 ms | 122 / 178 ms |
| elections, the costliest of four shapes: CPU most | 343 ms | 384 ms |
| one address at both limits, at the most | 7.8 CPU-s a minute | 10.7 CPU-s a minute |
| one address at both limits, at the 95th percentiles | 5.9 CPU-s a minute | 6.8 CPU-s a minute |

One address at both limits is ten events requests and thirty others a minute:
10 × 0.539 s + 30 × 0.178 s = 10.7 CPU-seconds on rc.16. The engine calls
cost 5% to 14% more on rc.16; the slowest requests, 34% to 43% more, since a
maximum is a single request's time.

rc.16's figure is over the 10 CPU-seconds the rules were set for. F-78 in
`docs/platform/programme/FINDINGS.md` records it with the owner's options.
The election search does not raise it: its costliest request took less time
than the costliest events request on both engines.

## Limits

- **One machine, one run of each tool.** The deployed functions run on other
  hardware; the P3.3 gate's measurement of the deployed endpoints is still to
  be made.
- **Maxima move between runs.** Two earlier runs on rc.16 that morning, on a
  machine that reported a 2.80 GHz processor and with earlier versions of the
  tool, gave 13.2 and 12.8 CPU-seconds a minute. They are not kept here.
