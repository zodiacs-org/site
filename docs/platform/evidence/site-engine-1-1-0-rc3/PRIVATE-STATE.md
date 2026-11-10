# Compute bundle private-state review, 10 November 2026

The reviewed inputs are:

- the digest-pinned 1.1.0-rc.3 archive (`vendor/zodiacs-engine-1.1.0-rc.3.tgz`);
- astronomy-engine 2.1.19, unchanged in the lockfile.

[inputs.json](private-state-review/inputs.json) records the 22 paths and
their ordered executable-input digest,
`bb94bb37e8e12528bd6efe0f3cf3bd59f62b43cf85b1dfe508901044ce10808d`.
1.1.0-rc.2's review had 20. The bundle now imports
`@zodiacs/engine/de440` (the compute API's DE440 backend, P4.1), whose
`dist/de440.js` and one more shared chunk join them; it includes none of
calc, Vedic, techniques, lite, sky or window, so none of the functions that
refuse inside `withEphemeris` is in it.

As for 1.1.0-rc.2, an external copy of the generator, outside the checkout,
wrote an audit-only bundle before the committed reviewed digest changed
([the copy's diff](private-state-review/audit-generator-copy.diff)): it
records the new digest instead of refusing it, and writes beside itself.
After the digest was updated, the guarded generator reproduced the
audit-only bundle byte for byte: 537,456 bytes, SHA-256 `3607971d…c8e7`
(main's, 1.1.0-rc.2's, is 501,093 bytes, `b53ebdbb…f165`). The generator's
assertions held: one `var last;` and no second holder, each
lifetime-boundary marker found once (the export marker now names the deploy's
pack opener, `de440FromFile`, beside the handler), and the NOTICE phrases it
requires present in 1.1.0-rc.3's NOTICE.

## State and dispositions

The inventory instruments are rc.16's, run unchanged but for the same two
redirections as for 1.1.0-rc.2 (the input path, and where they find the
checkout's packages:
[the copies' diff](private-state-review/audit-instrument-copies.diff)), on the
audit-only bundle and on main's committed bundle.

| Bundle | Top-level bindings | Direct write sites |
| --- | ---: | ---: |
| main (`inventory-main.json`) | 321 | 24 |
| 1.1.0-rc.3 (`inventory-1.1.0-rc.3.json`) | 375 | 27 |

Two of main's bindings are gone: `DEG23`, now `DEG4` under the bundler's
naming, and `statements`, the receipt statements' cache, now
`statementsByEphemeris`. 56 are new. All but three are constants (numbers,
strings, a regular expression without a global flag, frozen objects and
arrays), pure functions, the classes whose instances a DE440 source holds,
and a `Set` of endpoint names nothing writes. The three, with every new write
site:

- `source` (the engine's `src/ephemeris.ts`): the source `withEphemeris` puts
  in place. Its two write sites are in `withEphemeris` itself, which sets it
  and puts the previous one back in a synchronous `finally`, and which refuses
  a function that returns a promise or an iterator, so no request's source
  outlives the synchronous call that installed it.
- `rows` (`src/de440/nutation.ts`): the 77 nutation terms in the reduction's
  layout, built once from the engine's own table (`rows = out`). Fixed data.
- `statementsByEphemeris` (`src/lib/compute-api/receipt.ts`): the conventions
  and coverage statements a receipt carries, one entry per backend's
  ephemeris, each computed from a chart of a fixed instant
  (2000-01-01T12:00:00Z, no time) and never from a request
  (`statementsByEphemeris.set`). Request-independent data, as main's
  `statements` was.

The write site main has and 1.1.0-rc.3 has not is that `statements`'s.

A DE440 source's pack reader and reducer (`PackEphemeris`, `Reducer`) hold
the request's state: the last decoded record of each body and buffers with
its last state vectors. They are not top-level bindings: the deploy's opener,
`de440FromFile` (`src/lib/compute-api/handler.ts`), keeps only the pack's
bytes, which are fixed, and opens a new source for every request, which
nothing keeps once the response is written. A new instrument checks that
([audit-de440.mjs](private-state-review/audit-de440.mjs), written for this
review and committed with it): it takes the rc.16 inventory's snapshot of
every top-level binding around requests that the `de440` backend answers
from the deploy's pack, through the deployed opener, and after each request
forces garbage collection and checks that no reader or reducer is left. In
[its record](private-state-review/de440-1.1.0-rc.3.json), over 15 cases (four
charts from 1800 to 2199, each also compared with a fresh module instance,
positions, events, a sky fact, an election search, DE440 as the default, three
refusals, a deployment without the pack in both forms, and a failure inside
the calculation) no top-level binding changed, the engine's `source` was null
after each, and none of the 24 readers and reducers created was left. Its
positive control keeps one request's source: its reader still holds the Moon's
record of that request (2082-03-06 to 2082-04-07, for an instant of
2082-03-14), which is the state the per-request opening keeps from surviving.

The +1 ms overlap probe gives main's result: its record differs from main's
only in the bundle's SHA-256, and its positive control still recovers the
synthetic request's instant when the cleanup is left out. Records:

- [the inventory](private-state-review/inventory-1.1.0-rc.3.json) and
  [main's](private-state-review/inventory-main.json);
- [the probe](private-state-review/nearby-overlap-1.1.0-rc.3.json) and
  [main's](private-state-review/nearby-overlap-main.json);
- [the DE440 instrument](private-state-review/de440-1.1.0-rc.3.json);
- [the generator's audit line](private-state-review/generator-audit.log).

The focused tests, `tests/api/compute-api-private-state.test.ts` (which now
also runs the five endpoints on a synthetic DE440 pack and checks the
engine's `source` after success, refusal and failure),
`tests/api/compute-api-bundle.test.ts` and
`tests/api/compute-api-privacy.test.ts`, pass 14 of 14
([log](private-state-review/focused-tests.log)).

1.1.0-rc.2's dispositions hold unchanged:

- the ΔT and UT1 arrays are fixed data;
- the request-dependent frame (`last`) and the Pluto segments are cleared after
  every invocation, refusals and exceptions included;
- the aggregate Moon counter is reset;
- astronomy-engine's DeltaT callback is restored by the engine's synchronous
  `finally`.

## AI runtimes

After `npm run ai:build`, the static inventories
(`../site-engine-1-0-0-rc2/tools/ai-state-inventory.mjs`, run unchanged)
count, against the committed bundles of the base, `a67b7c9a` (the `-main`
files):

| Bundle | Top-level bindings, main | Now | Direct writes, main | Now |
| --- | ---: | ---: | ---: | ---: |
| HTTP (`ai-http-inventory.json`) | 1,026 | 1,041 | 32 | 32 |
| Sky Watch (`ai-watch-inventory.json`) | 1,026 | 1,041 | 32 | 32 |
| Local developer (`ai-local-inventory.json`) | 1,081 | 1,096 | 41 | 41 |

In each, the same two of main's bindings are gone, `DEG23` (now `DEG7`) and
the receipt statements' cache (now `statementsByEphemeris`), and the same 17
are new. Fifteen are constants (strings, a regular expression without a
global flag, frozen objects and arrays, the published backend schema, which
nothing writes) and pure functions. The other two:

- `source`, the engine's ephemeris source, which these bundles never write:
  they hold no call of `withEphemeris` (the AI tools call the calculations
  without a backend, so they answer from astronomy-engine), and it stays
  `null`.
- `statementsByEphemeris`, as in the compute bundle: statements computed from
  a chart of a fixed instant, never from a request.

The one write site gone is the cache's assignment and the one new is
`statementsByEphemeris.set`; every other write site is main's. The tools'
published definitions are unchanged (`src/ai-tools/release-060.test.ts`):
their backend keeps the schema it was published with
(`ASTRONOMY_ENGINE_BACKEND_SCHEMA`, `src/lib/compute-api/openapi.ts`), while
the compute API's own `Backend` also describes DE440. Chart Studio's
published panel is unchanged (`chart-studio-v6.html`); only the source build
its pin records moved (`SOURCE_SHA256`, `scripts/build-chart-studio.mjs`).

## Limits

These limits are 1.1.0-rc.2's, with one for the new instrument:

- This is a source review and finite regression evidence. It is not secure
  memory erasure, and it is not a universal proof of history independence.
- The inventory does not see alias mutations unless they are reviewed
  separately.
- Clearing references does not erase freed memory; a source that nothing
  reaches is unreachable, not erased.

No programme unit is accepted here.
