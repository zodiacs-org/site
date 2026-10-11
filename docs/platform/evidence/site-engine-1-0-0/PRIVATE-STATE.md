# Compute bundle private-state review, 11 October 2026

The reviewed inputs are:

- the digest-pinned 1.0.0 archive;
- astronomy-engine 2.1.19, unchanged in the lockfile;
- the regenerated server time basis, which differs from rc.2's only in comment lines.

[inputs.json](private-state-review/inputs.json) records the 15 paths and their
ordered executable-input digest,
`f61093abe0234c08894ab5c027f5181653153ab359a34d88e5ebaa759f2487ac`. The bundle
includes none of calc, Vedic, techniques or the engine's internal entries.

An external copy of the generator, outside the checkout, wrote an audit-only
bundle before the committed reviewed digest changed
([the copy's diff](private-state-review/audit-generator-copy.diff)). The copy
differs from the generator in two ways: it records the new digest instead of
refusing it, and it writes beside itself instead of into the checkout. After
the digest was updated, the guarded generator reproduced the audit-only bundle
byte for byte: 271,925 bytes, SHA-256 `5b611f9f…9e32`. The committed bundle
differs from main's in six lines: the banner's engine version, four chunk-name
comments and `ENGINE_VERSION`.

## State and dispositions

The inventory instruments are rc.16's. They ran unchanged except for two
redirections: the input path, and where they find the checkout's packages
([the copies' diff](private-state-review/audit-instrument-copies.diff)). Their
records keep the instrument's label `api/_compute/compute.mjs`; the SHA-256
they record is the audit-only bundle's.

On the audit-only bundle the AST inventory finds 327 top-level bindings and 32
direct write sites, as on rc.2's bundle. With the version literal normalised,
every declaration and every write site is the same as rc.2's, at the same
lines. The only binding that names a version is `ENGINE_VERSION = "1.0.0"`. In
the four finite cases no binding changes, and the lifetime boundary clears the
frame, the Pluto segments and the Moon counter, as it does on rc.2. The +1 ms
overlap probe gives rc.2's result. Its positive control still recovers the
synthetic request's instant when the cleanup is left out, which is why the
boundary stays. Records:

- [the inventory](private-state-review/inventory-1.0.0.json);
- [the probe](private-state-review/nearby-overlap-1.0.0.json);
- rc.2's records, under `../site-engine-1-0-0-rc2/private-state-review/`.

The focused tests, `tests/api/compute-api-private-state.test.ts` and
`tests/api/compute-api-bundle.test.ts`, pass 6 of 6
([log](private-state-review/focused-tests.log)).

1.0.0 loads rc.2's code apart from the version string and chunk names
([entry-graphs.txt](entry-graphs.txt)), so rc.2's dispositions hold
unchanged:

- the ΔT and UT1 arrays are fixed data;
- the request-dependent frame (`last`) and the Pluto segments are cleared after
  every invocation, refusals and exceptions included;
- the aggregate Moon counter is reset;
- astronomy-engine's DeltaT callback is restored by the engine's synchronous
  `finally`.

## AI runtimes

After `npm run ai:build`, the static inventories
(`../site-engine-1-0-0-rc2/tools/ai-state-inventory.mjs`) count:

| Bundle | Top-level bindings | Direct writes |
| --- | ---: | ---: |
| HTTP | 393 | 33 |
| Sky Watch | 393 | 33 |
| Local developer | 429 | 42 |

Main's current bundles, recorded in the `-main` files beside them, have the
same bindings and the same writes once versions are normalised. The rc.2
record's 391 predates later changes on main and does not come from this
adoption. The lifetime adapters and their regression drive are unchanged.
`npm run ai:test` passes, which includes the developer bundle's privacy
recovery.

## Limits

These limits are the same as rc.2's:

- This is a source review and finite regression evidence. It is not secure
  memory erasure, and it is not a universal proof of history independence.
- The inventory does not see alias mutations unless they are reviewed
  separately.
- Clearing references does not erase freed memory.
- P3.3 is merged, not accepted: deployed cold latency and cost are still
  required.

No programme unit is accepted here.
