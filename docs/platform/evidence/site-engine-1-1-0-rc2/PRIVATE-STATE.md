# Compute bundle private-state review, 4 November 2026

The reviewed inputs are:

- the digest-pinned 1.1.0-rc.2 archive;
- astronomy-engine 2.1.19, unchanged in the lockfile.

The site's own server time basis is no longer one of them. Since this
adoption the compute API takes its time basis from `@zodiacs/engine/time`
(F-53, [time-entry/](time-entry/)), and the generated
`src/lib/engine/time-basis.mjs` is deleted.

[inputs.json](private-state-review/inputs.json) records the 20 paths and
their ordered executable-input digest,
`d20f0c4c6fa6dd4879bc6a33f09dca17b27d00670375717fdcc3236316a9cc19`.
1.1.0-rc.1's review had 17. The generated module left them, and
`dist/time.js`, the `./time` entry, joined them; the engine chunks they
import are 15, where 1.1.0-rc.1's were 12 (1.1.0-rc.2 moves the nutation and
frame modules out of the ephemeris chunk into a shared chunk that it and
`dist/time.js` import: the engine's CHANGELOG, NOTICE and LICENSING.md). The
bundle includes none of calc, Vedic, techniques, lite or the engine's
internal entries.

An external copy of the generator, outside the checkout, wrote an audit-only
bundle before the committed reviewed digest changed
([the copy's diff](private-state-review/audit-generator-copy.diff)). The copy
differs from the generator in two ways: it records the new digest instead of
refusing it, and it writes beside itself instead of into the checkout. After
the digest was updated, the guarded generator reproduced the audit-only bundle
byte for byte: 501,093 bytes, SHA-256 `b53ebdbb…f165`. Main's bundle,
1.1.0-rc.1's, is 516,865 bytes (`438e7d4a…8260`). The generator's own
assertions held: one `var last;` and no renamed second holder (the frame
chunk is shared with the root, which holds the one frame cache), each
lifetime-boundary marker found once, and the NOTICE phrases it requires
present in 1.1.0-rc.2's NOTICE.

## State and dispositions

The inventory instruments are rc.16's. They ran unchanged except for two
redirections: the input path, and where they find the checkout's packages
([the copies' diff](private-state-review/audit-instrument-copies.diff)). Their
records keep the instrument's label `api/_compute/compute.mjs`; the SHA-256
they record is the audit-only bundle's. The same copies were run on main's
committed bundle for comparison.

| Bundle | Top-level bindings | Direct write sites |
| --- | ---: | ---: |
| main (`inventory-main.json`) | 365 | 33 |
| 1.1.0-rc.2 (`inventory-1.1.0-rc.2.json`) | 321 | 24 |

Main's bundle carried the time basis twice: the engine's, inside its
chunks, and the site's generated copy of it, which the bundler renamed
(`DELTA_T_MODEL2`, `UT1_DATA2`, `LEAP_SECOND_LIST2` and the like). 1.1.0-rc.2's
carries it once. Every write site of 1.1.0-rc.2's bundle is main's, and so
are the alias mutation the instrument reviews and its four finite cases. What
differs:

- 45 of main's bindings are gone, every one of them the copy's: its ΔT model
  and table and their decoded state, its leap-second list and UT1 − UTC table
  with their bounds, and its constants;
- the nine write sites main has and 1.1.0-rc.2 has not are the copy's lazy
  decoding of its ΔT table (`X2`, `Y2`, `M2`, `KX2`, `KV2`, `OBS2`, `PRED2`,
  `SLOPE2` and `knots2 ??= decode2()`), state the engine's own copy also
  holds;
- one binding is new: `RAD32`, the constant `180 / Math.PI` under the name
  the bundler now gives it (main's `RAD23`).

So 1.1.0-rc.2 removes state rather than adding any. The +1 ms overlap probe
gives main's result: its record differs from main's only in the bundle's
SHA-256, and its positive control still recovers the synthetic request's
instant when the cleanup is left out, which is why the boundary stays.
Records:

- [the inventory](private-state-review/inventory-1.1.0-rc.2.json) and
  [main's](private-state-review/inventory-main.json);
- [the probe](private-state-review/nearby-overlap-1.1.0-rc.2.json) and
  [main's](private-state-review/nearby-overlap-main.json);
- [the generator's audit line](private-state-review/generator-audit.log).

The focused tests, `tests/api/compute-api-private-state.test.ts`,
`tests/api/compute-api-bundle.test.ts` and
`tests/api/compute-api-privacy.test.ts`, pass 14 of 14
([log](private-state-review/focused-tests.log)).

1.1.0-rc.1's dispositions hold unchanged:

- the ΔT and UT1 arrays are fixed data;
- the request-dependent frame (`last`) and the Pluto segments are cleared after
  every invocation, refusals and exceptions included;
- the aggregate Moon counter is reset;
- astronomy-engine's DeltaT callback is restored by the engine's synchronous
  `finally`.

## AI runtimes

After `npm run ai:build`, the static inventories
(`../site-engine-1-0-0-rc2/tools/ai-state-inventory.mjs`) count, against the
committed bundles of the base, `0bf69bd5` (the `-main` files):

| Bundle | Top-level bindings, main | Now | Direct writes, main | Now |
| --- | ---: | ---: | ---: | ---: |
| HTTP | 938 | 894 | 39 | 30 |
| Sky Watch | 938 | 894 | 39 | 30 |
| Local developer | 998 | 954 | 48 | 39 |

In each, the same 45 bindings of the copy are gone and `RAD32` is new, and
the nine write sites gone are the copy's; every other write site is main's.
All three move the Chart Studio panel's address to `chart-studio-v7.html`,
keeping v6 as a legacy address, because the panel embeds the engine. D-12
(see the README) later takes that move back: the three bundles name
`chart-studio-v6.html` again, as main's do, and nothing else this review
covers changes.

## Limits

These limits are the same as 1.1.0-rc.1's:

- This is a source review and finite regression evidence. It is not secure
  memory erasure, and it is not a universal proof of history independence.
- The inventory does not see alias mutations unless they are reviewed
  separately.
- Clearing references does not erase freed memory.

No programme unit is accepted here.
