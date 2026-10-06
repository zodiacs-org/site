# rc.17 server-only private-state review, 6 October 2026

`scripts/build-compute-handler.mjs` refuses to build the compute API's bundle
when the engine and astronomy-engine files it inlines, or the server time
basis, change bytes, until their private mutable state has been audited
again. Vendoring rc.17 changed those bytes. This is that audit. It changes
the reviewed digest, `PRIVACY_REVIEWED_ENGINE_INPUTS_SHA256`, from rc.16's
`025fc77deed9584f4d5f4c342f42483f1880fd3c5f4abe87af4cabd0584cc1ab` to
`6168dc1f1bf7eb08a2c50815b193378c2cbd874559ec16a61b55d5601790a64a`, and the
comment above it, which names this review. Nothing else in the generator
changes: the lifetime boundary, its markers and the cleanup it adds are
rc.16's.

## Reviewed artifact

`vendor/zodiacs-engine-0.1.1-rc.17.tgz`, SHA-256
`9cd24c788863424ef614aaadec580db5a0dfc529303d385274db48a092a5299a`,
273,123 bytes, 70 files, 946,349 bytes unpacked: the archive carried by
engine commit `b080217` and packed from its source commit `aae419c`. The
installed package is from those bytes.

## What rc.17 changes, and what the bundle takes from it

rc.17 adds the sidereal zodiac to `@zodiacs/engine/calc`, and with it moves
the ayanamsa module out of `dist/vedic.js` into `dist/chunk-TCGFZEEE.js`, a
chunk that `dist/calc.js` and `dist/vedic.js` share. The module's two
WeakMaps, `FRAMES` and `VALUES`, move with it; rc.16 declared both in
`dist/vedic.js`. The other top-level bindings rc.17 adds are constants and
functions in `dist/calc.js` and three functions in that chunk. The compute
API imports neither `./calc` nor `./vedic`: it imports the root entry and
`./receipt`, that chunk is not among the bundle's inputs, and the bundle
holds neither name.

The digest covers 15 inputs
([`private-state-review/inputs.json`](private-state-review/inputs.json)).
Against rc.16's:

- six engine chunks are byte-identical;
- six engine files differ only in the file names of the chunks they import;
- one chunk differs in those names and in the version string,
  `ENGINE_VERSION`;
- astronomy-engine's ESM build is the same file (2.1.19, unchanged in the
  lockfile);
- `src/lib/engine/time-basis.mjs`, regenerated from rc.17 by
  `scripts/build-time-basis.mjs`, differs in five comment lines: the engine
  version, the archive's digest and chunk file names.

## Method

1. With rc.17 installed, the bundle was built by a copy of the generator,
   kept outside the repository, whose only change printed the new digest
   instead of refusing. The committed generator, with the new digest, then
   built the same bytes: SHA-256
   `8130a75d1f24f26d42da614b0acc87c8aae6ab77caf4bb9d939e92c2bf538503`,
   266,155 bytes, the size of the rc.16 bundle it replaces.
2. [`bundle-rc16-rc17.diff`](private-state-review/bundle-rc16-rc17.diff)
   compares it with the bundle on site main (`b4f82564`), which production
   serves with rc.16: six lines differ, the banner's engine version,
   `ENGINE_VERSION`'s value and four comments that name chunk files. No
   executable statement changes but the version string's.
3. rc.16's review tools, unchanged
   (`../site-engine-rc16/private-state-review/audit-inventory.mjs` and
   `probe-nearby-overlap.mjs`), read `api/_compute/compute.mjs` from the
   checkout they run in. They were run on Node 22.22.2 in two checkouts:
   site main with rc.16 installed, and this adoption. The inventory finds 336
   top-level variable bindings and 33 direct write sites in each bundle, and
   the two inventories differ only in the bundle's digest and
   `ENGINE_VERSION`'s initializer
   ([`inventory-rc16.json`](private-state-review/inventory-rc16.json),
   [`inventory-rc17.json`](private-state-review/inventory-rc17.json)). The
   probe's results differ only in the bundle's digest
   ([`nearby-overlap-rc16.json`](private-state-review/nearby-overlap-rc16.json),
   [`nearby-overlap-rc17.json`](private-state-review/nearby-overlap-rc17.json)):
   in both, the positive control recovers a synthetic request's exact
   instant from the frame the module keeps without the boundary, and with
   the boundary, requests 1 ms apart, one after the other or overlapping,
   get the answers a fresh module gives. Each tool was run twice, about
   forty minutes apart, and wrote the same bytes both times. The inventory
   has 21 more bindings than rc.16's review recorded (315): the election
   search endpoint's constants and one helper, added to the bundle since.
   They are the site's code, not the engine's, and the same in both bundles.
4. `tests/api/compute-api-private-state.test.ts` and
   `tests/api/compute-api-bundle.test.ts` pass on the rc.17 bundle
   ([`focused-tests.log`](private-state-review/focused-tests.log)), and both
   generators' checks pass
   ([`generator-check.log`](private-state-review/generator-check.log)).

## Dispositions

The state rc.16's review found, and its dispositions, stand unchanged: the
frame `last`, `pluto_cache` and `CalcMoonCount` cleared by the server-only
boundary after every invocation; the ΔT callback restored by the engine's
own synchronous `finally`; fixed tables decoded lazily from constant
definitions; the receipt statements built from a fixed J2000 chart; the
policy WeakSet and error WeakMap holding fixed brands. rc.17 adds no state
to this bundle.

## Rerun

On Node 22.22.2, in each of the two checkouts (writing the `rc16` files in
the first and the `rc17` files in the second), from the checkout's root:

```sh
TOOLS=docs/platform/evidence/site-engine-rc16/private-state-review
OUT=docs/platform/evidence/site-engine-rc17/private-state-review
node "$TOOLS/audit-inventory.mjs" > "$OUT/inventory-rc17.json"
node "$TOOLS/probe-nearby-overlap.mjs" > "$OUT/nearby-overlap-rc17.json"
```

and in this one:

```sh
node node_modules/vitest/vitest.mjs run tests/api/compute-api-private-state.test.ts \
  tests/api/compute-api-bundle.test.ts > "$OUT/focused-tests.log" 2>&1
node scripts/build-compute-handler.mjs --check > "$OUT/generator-check.log" 2>&1
node scripts/build-compute-local-time.mjs --check >> "$OUT/generator-check.log" 2>&1
```

In the logs, `<site>` stands for the checkout's path.

## Limits

This review covers the compute API's bundle alone. The browser chunks run
in one person's browser and the MCP adapter in one person's own process;
neither is shared between people as the compute API's function is, and
neither is covered by this pin. Clearing references establishes that a
request's values are no longer reachable from the module, not that freed
memory is erased. Nothing here accepts a programme unit; P3.3 stays partial.
