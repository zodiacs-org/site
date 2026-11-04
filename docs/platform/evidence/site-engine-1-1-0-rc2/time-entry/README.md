# F-53's closing evidence in the site (time-entry S1, S1b and S2)

The engine's time-entry preregistration (`docs/evidence/1.1.0-rc.2-20261102/time-entry/PREREGISTRATION.md`,
section 8, at the source commit `806f76b`) asks the site's adoption for S1
and S1b "after vendoring and before any import changes", then S2 after the
switch and the deletions, and S3 in production
([../PRODUCTION-CHECKS.md](../PRODUCTION-CHECKS.md)). This folder holds the
tools, committed before any of them runs, and later their outputs.

## The engine's tools, byte for byte

Copied from the engine's `docs/evidence/1.1.0-rc.2-20261102/time-entry/tools/`
at `806f76b`, whose blobs are the same in the tree of engine main `883371f5`:

| File | SHA-256 | git blob at `806f76b` | Bytes |
| --- | --- | --- | ---: |
| `tools/corpora.mjs` | `33a3a86575ce14694c6b23e36bfbaf252e55175e4e42458942ce4d4ebd1ffc22` | `6739591ba55b359a78c384116d1b49c95c437086` | 4,469 |
| `tools/load.mjs` | `60ea45a21c01b4a9f150764996d67d9328d3918ff58d0e088869e469914ce727` | `b6fed737e5a25cf408ce121ccc5adcf8759b959e` | 2,886 |
| `tools/site-module.mjs` | `1f6d1b041043a41c5b840a24380704dff4e6a4fb793dbebedff5de36aee2a092` | `4eb813390090f3a5299093b4653292179cdd4796` | 8,678 |
| `tools/natal-parity.mjs` | `9918e38737e694bac4bffc1a8017b5523a0c448cecf16c715a0c5a0b0032da72` | `07db419bd0b6823803f1705b71949840f5b6c477` | 4,742 |

`site-module.mjs` is T4: the entry against the committed module, value for
value, with its controls a, b and c; S1 runs it again with the vendored
archive. `natal-parity.mjs` is T5, whose two controls S1 takes over; it is
carried for reference and the adoption does not run it. `corpora.mjs` and
`load.mjs` are what the others import.

## The site's own tools

- [tools/generator-check.mjs](tools/generator-check.mjs), **S1**: the check
  `scripts/build-time-basis.mjs` makes before it writes the module (its
  `checkInstants`, 14,765 instants, which equal K1, and the bit-for-bit
  longitude check, 177,180 longitudes), run unchanged with
  `@zodiacs/engine/time` in place of the bundled module. T5's two controls
  are built in and must fail at every instant: (a) astronomy-engine's own
  `Ecliptic()` in place of `eclipticOfDate`, (b) `natalChart` given a ΔT
  1 ms off the basis.
- [tools/adapter-parity.mjs](tools/adapter-parity.mjs), **S1b**: two
  temporary copies of `src/lib/engine/server-ephemeris.ts`, one importing the
  committed module (refused unless its SHA-256 is the pin below) and one
  `@zodiacs/engine/time`, each bundled by the site's esbuild for Node with
  packages external, give `bodyLongitude` and `longitudeSpeed` for the 12
  bodies at the K1 instants, compared with `Object.is`. Its control, a third
  copy importing the module with the first nutation coefficient
  `-172064161` read as `-172064160`, must differ at most instants.

## Pins and inputs

- The committed module, `src/lib/engine/time-basis.mjs`: SHA-256
  `5857c888df07dd5a1695273797632ea8736f37a26aad2fe908b3d857d2333f40`, 26,217
  bytes, git blob `60bdcb5e006d79ff53a5100a4f60084fecdda0e9`; its
  declarations, `time-basis.d.mts`: SHA-256
  `8cc3670eb2aae747a2e22e667633594b8d24f7f6982dfcee2c0ffc2a2cff6ff9`. Both
  are unchanged at this adoption's base, `0bf69bd5`.
- T4's fixture is the engine's `src/fixtures/nutation-erfa.json` (SHA-256
  `2719dd382310ca5514db0577fc4b3607e99edd941111f0f872957125b4713604`), read
  from the engine checkout by path.
- The package is the vendored `vendor/zodiacs-engine-1.1.0-rc.2.tgz`, installed
  and checked byte for byte against the archive
  ([../ARTIFACT-IDENTITY.md](../ARTIFACT-IDENTITY.md)).

## Order

1. With the module still in place and the archive installed: S1 and its
   controls, T4 and its controls, S1b and its control; outputs here, and
   `package.json` and the lock committed with them.
2. Then the switch: the importers move to `@zodiacs/engine/time`, and the
   module, its declarations, its generator and the CI step are deleted.
3. S2 on the adoption head: the full list of checks before every push, and
   the search of the base and of the head for the module (its control).
