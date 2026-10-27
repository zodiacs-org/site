# Compute bundle private-state review, 27 October 2026

The reviewed inputs are:

- the digest-pinned 1.1.0-rc.1 archive;
- astronomy-engine 2.1.19, unchanged in the lockfile;
- the regenerated server time basis, which differs from 1.0.0's only in
  comment lines.

[inputs.json](private-state-review/inputs.json) records the 17 paths and their
ordered executable-input digest,
`25339775546e2683e5488ec820f00ac748e5834b059428991df90966c4ec0f07`. 1.0.0's
review had 15. The two new ones are the `./conventions` entry
(`dist/conventions.js`) and the chunk it shares with `./receipt`, which holds
`conventionId` and `natalConventionIds`; the compute receipt calls
`conventionId` to write its own `conventionIds`. The bundle includes none of
calc, Vedic, techniques or the engine's internal entries.

An external copy of the generator, outside the checkout, wrote an audit-only
bundle before the committed reviewed digest changed
([the copy's diff](private-state-review/audit-generator-copy.diff)). The copy
differs from the generator in two ways: it records the new digest instead of
refusing it, and it writes beside itself instead of into the checkout. After
the digest was updated, the guarded generator reproduced the audit-only bundle
byte for byte: 516,865 bytes, SHA-256 `438e7d4a…8260`. Main's bundle, which
has grown since 1.0.0's review with the site's later compute changes, is
512,624 bytes.

## State and dispositions

The inventory instruments are rc.16's. They ran unchanged except for two
redirections: the input path, and where they find the checkout's packages
([the copies' diff](private-state-review/audit-instrument-copies.diff)). Their
records keep the instrument's label `api/_compute/compute.mjs`; the SHA-256
they record is the audit-only bundle's. The same copies were run on main's
committed bundle for comparison.

| Bundle | Top-level bindings | Direct write sites |
| --- | ---: | ---: |
| main (`inventory-main.json`) | 361 | 33 |
| 1.1.0-rc.1 (`inventory-1.1.0-rc.1.json`) | 365 | 33 |

With versions normalised, every write site is main's, and so are the alias
mutations the instrument reviews and its four finite cases. The bindings that
differ are constants:

- `NAMESPACE` and `VALUE`, the id syntax's two regular expressions. Neither
  has the global or sticky flag, so `test` keeps no `lastIndex` between calls;
- `CONVENTIONS_RC16`, the rc.16 set renamed, and `CONVENTIONS`, the new set,
  both frozen;
- `NATAL_RECEIPT_CONVENTION_SETS`, frozen, now with six sets;
- `IDS_FEATURE`, the string `"convention-ids"`.

`natalConventionIds` and the site's `computeConventionIds` build their ids in
a set local to each call; neither keeps anything at module level. The +1 ms
overlap probe gives main's result, and its positive control still recovers
the synthetic request's instant when the cleanup is left out, which is why the
boundary stays. Records:

- [the inventory](private-state-review/inventory-1.1.0-rc.1.json) and
  [main's](private-state-review/inventory-main.json);
- [the probe](private-state-review/nearby-overlap-1.1.0-rc.1.json) and
  [main's](private-state-review/nearby-overlap-main.json);
- [the generator's audit line](private-state-review/generator-audit.log).

The focused tests, `tests/api/compute-api-private-state.test.ts`,
`tests/api/compute-api-bundle.test.ts` and
`tests/api/compute-api-privacy.test.ts`, pass 13 of 13
([log](private-state-review/focused-tests.log)).

[entry-graphs.txt](entry-graphs.txt) shows that apart from `./receipt` and
the new `./conventions`, every entry loads 1.0.0's code. 1.0.0's
dispositions hold unchanged:

- the ΔT and UT1 arrays are fixed data;
- the request-dependent frame (`last`) and the Pluto segments are cleared after
  every invocation, refusals and exceptions included;
- the aggregate Moon counter is reset;
- astronomy-engine's DeltaT callback is restored by the engine's synchronous
  `finally`.

## The receipt holds nothing the request gave

A compute receipt lists the ids its own fields name and leaves out its
result's, such as a time record's ΔT segment or a flag. The result's would
make the receipt, and the digest `cite.receipt` quotes, depend on the request:
which ΔT segment an instant falls in, or whether a clock change touched it.
`src/mcp/sky-tools.test.ts` still finds one receipt for every positions
request and one per form for events and facts, apart from a search's
evaluation count.

## AI runtimes

After `npm run ai:build`, the static inventories
(`../site-engine-1-0-0-rc2/tools/ai-state-inventory.mjs`) count, against main's
bundles at `59a9383c`, merged into this branch (the `-main` files):

| Bundle | Top-level bindings, main | Now | Direct writes, main and now |
| --- | ---: | ---: | ---: |
| HTTP | 740 | 745 | 33 |
| Sky Watch | 740 | 745 | 33 |
| Local developer | 775 | 780 | 42 |

The write sites are main's once versions are normalised. The new bindings are
the engine's constants above and the OpenAPI document's `conventionIds`
schema helper; the developer bundle also changes its conventions vocabulary
(`SET_WRITERS`, `CONVENTION_KEYS`), and all three move the Chart Studio
panel's address to `chart-studio-v6.html`, keeping v5 as a legacy address.
`npm run ai:test` passes, which includes the developer bundle's privacy
recovery.

## Limits

These limits are the same as 1.0.0's:

- This is a source review and finite regression evidence. It is not secure
  memory erasure, and it is not a universal proof of history independence.
- The inventory does not see alias mutations unless they are reviewed
  separately.
- Clearing references does not erase freed memory.

No programme unit is accepted here.
