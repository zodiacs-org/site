# Vendored @zodiacs/engine artifact

`zodiacs-engine-0.1.1-rc.9.tgz` is the exact npm pack artifact consumed by this
site. The standalone starter keeps its separate engine `0.1.1-rc.3` pin and
immutable project archive. The optional ownership SDK remains separate.

- Package: `@zodiacs/engine@0.1.1-rc.9` (unpublished candidate)
- Source repository: `https://github.com/zodiacs-org/engine` (the package at the
  repository root; up to rc.6 it was `packages/engine` of `zodiacs-org/sdk`)
- Source commit: `82aad2fcc9b204a687e0b67f709681e62f9e889a`
- Artifact carrier commit: `fa1050e033a197b117868ce546d85352bff35376`
- Artifact SHA-256: `bb5592302b1fa542cc745a9410b5a77faf49bbf4e205347ab771810efc300a20`
- [Immutable anonymous download](https://raw.githubusercontent.com/zodiacs-org/engine/fa1050e033a197b117868ce546d85352bff35376/artifacts/zodiacs-engine-0.1.1-rc.9.tgz)
- Archive: 30 files, 55,576 packed bytes, 188,488 unpacked bytes.

The public engine archive was downloaded without credentials and checked against
the recorded SHA-256. The candidate adds nine house systems to whole sign,
Placidus and Porphyry, for twelve: Koch, Regiomontanus, Campanus, Topocentric,
Alcabitius, Equal, Vehlow, Meridian and Morinus. Nothing else it computes
moves, and its receipt conventions are rc.8's. An imported receipt remains an
untrusted claim.

New checks of this artifact are recorded in [the rc.9 adoption evidence](../docs/platform/evidence/site-engine-rc9/README.md).
Earlier evidence and immutable artifacts retain their original identities.
The site pin is not evidence of npm publication, production deployment,
required human review, or external adoption.

## Previous rc.8 site candidate

`zodiacs-engine-0.1.1-rc.8.tgz` and its checksum remain unchanged. Source commit:
`352ea49d9e1d7b07975a050bb4877acc454f86f5` (root of `zodiacs-org/engine`);
immutable artifact carrier: `a5b7d1d19a1c79465b2970b9ae948a8b5721a7c4`; SHA-256:
`3b934376fa53983cbdd7eb1a6ecf0eb0d50fbc49df01bc610b20c63bd5d12be6`. It ran
every calculation on observed ΔT with a 1-σ band (model `zodiacs-deltat/1`),
found longitude crossings with one solver that refuses instead of throwing,
flagged charts outside 1800–2200 and named its ephemeris in receipts, all kept
in rc.9. Its original [rc.8 evidence](../docs/platform/evidence/site-engine-rc8/README.md)
retains that package identity and does not certify rc.9.

## Previous rc.7 site candidate

`zodiacs-engine-0.1.1-rc.7.tgz` and its checksum remain unchanged. Source commit:
`6e14f3f7c5e3475fefce973a65ce4fc5d846ad85` (root of `zodiacs-org/engine`);
immutable artifact carrier: `f37dcdd628b637e5d3785a288a2bc89ceebb9e6a`; SHA-256:
`49b2b03f50fea8a625d443d4fd0f6d03ffc22831e54009fd09c49d07c8698f90`. It judged
an aspect applying from its orb's rate, took speeds as the derivative of the
reported longitude, built the angles on the true obliquity of date, put the
Placidus limit at the polar circle and added Porphyry houses, all kept in rc.8.
Its original [rc.7 evidence](../docs/platform/evidence/site-engine-rc7/README.md)
retains that package identity and does not certify rc.8 or rc.9.

## Previous rc.6 site candidate

`zodiacs-engine-0.1.1-rc.6.tgz` and its checksum remain unchanged. Source commit:
`fb57af7a2cd7c30983cc8fb655183d5a11f9cf30` (`packages/engine` of
`zodiacs-org/sdk`); immutable artifact carrier:
`51129a197cd3f2a2a8c966fb797ea4da1e147b3d`; SHA-256:
`09c3e63432f8ba2e9df05af137c42f65ab039740a207a89418d9e6470ea3db3e`.
Its original [rc.6 evidence](../docs/platform/evidence/site-engine-rc6/README.md)
retains that package identity and does not certify rc.7 or rc.8.

## Previous rc.5 site candidate

`zodiacs-engine-0.1.1-rc.5.tgz` and its checksum remain unchanged. Source commit:
`97f5e8d01828f4b85ffa845825dee9acff4695e4`; immutable artifact carrier:
`333369256af683c560603dd1e6411dd7a07adb1f`; SHA-256:
`1809c1686843a6be148eb185535e32059a20c35896e29ccfc7583a6b2738da65`.
Its original [rc.5 evidence](../docs/platform/evidence/site-engine-rc5/README.md)
retains the earlier package identity and does not certify rc.6.

## Previous site candidate

`zodiacs-engine-0.1.1-rc.1.tgz` and its checksum remain unchanged. Source commit:
`03bf77990f3014b9125eed4976d7a41200aac80d`; SHA-256:
`f95c887deedb55f64b185ed4dd406b580b6d3287656ab5ec0557215fc02e5d17`.
It supplied the initial corrected polar implementation. Its recorded Stage A
checks do not establish verification of later candidate bytes.

## Archived rollback artifact

`zodiacs-engine-0.1.0.tgz` and its checksum remain unchanged. Original source:
`codex/engine-expansion` at `cced011659d48877b8b73b8a85796815234cf741`;
SHA-256 `8da3e0f2eb3818fe2c5833e05331be61da9b605ffa118a8462182821412e7cbe`.
Rollback requires reverting the dependency/lock and adapter change together;
the old artifact alone needs the former site polar correction. The frozen
`src/lib/engine/fixtures/legacy-polar-saved.json` records 49 synthetic legacy
chart summaries produced from that artifact before replacing the dependency.
They exercise saved-record migration, not independent numerical accuracy.

The package is MIT licensed. Its `LICENSING.md`, `NOTICE`, and `LICENSE` are
inside the tarball. Consumers of the optional GeoNames adapter must retain the
CC BY 4.0 attribution in `NOTICE`.

The exported `@zodiacs/engine/internal` and
`@zodiacs/engine/internal/math` subpaths are explicitly site-only compatibility
boundaries. Public integrations use `@zodiacs/engine`, optional
`@zodiacs/engine/geo`, optional `@zodiacs/engine/receipt`, and, from rc.8,
optional `@zodiacs/engine/crossings` and `@zodiacs/engine/deltat`.

The intermediate `0.1.1-rc.0` tarball is also retained unchanged (SHA-256
`4b16eeac2e8c82e5fb3a5b3756b2ed31f8fec93a37728a722b9ef81ce8f5c20d`).
It passed numerical/consumer checks but was superseded by `rc.1` to clarify
one-sided endpoint direction in the packaged reference documentation. Neither
candidate was published to npm.
