# Vendored @zodiacs/engine artifact

`zodiacs-engine-0.1.1-rc.16.tgz` is the exact npm pack artifact consumed by this
candidate site revision. The standalone starter keeps its separate engine
`0.1.1-rc.3` pin and immutable project archive.

- Package: `@zodiacs/engine@0.1.1-rc.16` (vendored release candidate)
- Independently verified npm distribution on 2026-10-01: `next` is rc.16,
  `latest` remains rc.15. The registry tarball is byte-identical to this archive;
  SLSA provenance binds release workflow run 36858851623 at engine commit
  `6807f632fc5aad08999d97f61e50793c6ca9a0b4`. See
  `docs/platform/evidence/site-engine-rc16/npm-release/verification-receipt.json`.
  The earlier rc.15 registry record remains unchanged as dated evidence.
- Source repository: `https://github.com/zodiacs-org/engine`
- Source commit: `ddbbaa0b1d21e16834722f81e8708816849c6726`
- Artifact carrier commit: `ef44477f85f28a57d5ec7f61ed6ea6a99c4be563`, merged into
  engine `main` by `6807f632fc5aad08999d97f61e50793c6ca9a0b4` (engine PR #22)
- Artifact SHA-256: `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`
- [Immutable anonymous download](https://raw.githubusercontent.com/zodiacs-org/engine/ef44477f85f28a57d5ec7f61ed6ea6a99c4be563/artifacts/zodiacs-engine-0.1.1-rc.16.tgz)
- Archive: 69 files, 266,934 packed bytes, 923,282 unpacked bytes.

The archive and its `.sha256` receipt were written from the engine
repository's git objects at `6807f632`, byte for byte (blob ids `92a0bf99…`
and `81282022…`), and the digest checked again; the anonymous download above
gives the same bytes. The licence expression is `MIT AND CC-BY-4.0`, as in
rc.15, and `engines.node` is `^20.19.0 || >=22.7.0`. The packaged NOTICE and
LICENSING.md now also cite the IAU 2000B nutation (McCarthy & Luzum 2003,
transcribed from NOVAS C 3.1, a work of the US Government), astronomy-engine's
precession reproduced in the package's frame module, the sources of the
dignity tables, and the constants of the calc and sky entries.

What rc.16 changes for this site:

- The nutation is the full IAU 2000B series, where astronomy-engine keeps 5
  of its 77 luni-solar terms. Every longitude of date moves by the change in
  Δψ, the same for every body, up to 0.2701″ from 1800 to 2200; the angles and
  cusps with the sidereal time and the true obliquity, up to 0.8003″ below
  60.17° N and Koch's cusps up to 3.883″ at 65.75°; and every instant found
  from them.
- Receipts gain a conventions set at index 0 of
  `NATAL_RECEIPT_CONVENTION_SETS`, naming the nutation and the Moon's
  position; rc.15's set moves to index 1 and is accepted under rc.15 alone.
- Five opt-in entry points that the root entry does not import:
  `@zodiacs/engine/calc`, `/window`, `/techniques`, `/houses` and `/sky`,
  and `planetaryReturns` in `/timing`. The site takes six techniques from
  `@zodiacs/engine/techniques` and does not use the others.

`src/lib/engine/time-basis.mjs` carries the package's compiled time basis and,
from rc.16, its frame of date and nutation, bundled from this archive by
`scripts/build-time-basis.mjs`, for the calendar function's server adapter
and the reference tools, which call astronomy-engine directly.

[The rc.16 adoption evidence](../docs/platform/evidence/site-engine-rc16/README.md)
records what was run for this adoption and what it does not establish.

The site pin is not evidence of npm publication, production deployment or
external adoption. Earlier archives and evidence retain their identities.

## Previous rc.15 site candidate

`zodiacs-engine-0.1.1-rc.15.tgz` and its checksum remain unchanged. Source
`104bd5a56ee00356eecc75f15f0aa946f5a39f41`, carrier
`cbad72cf075c1950bca1250dfd911085da3208d2` (merged by `93ebae9f`), SHA-256
`24eeb597b0157598c0faa26bb615c0cb5dfaaeac0393d62c73fbd37c5da4d348`, 190,974
bytes. It read an instant from 1972 to 2027-10-02 as UTC, through the IERS
leap seconds and UT1 − UTC, shipped the tzdb 2025c history before 1970 and
gave `lmt` its local-mean-time meaning.
[Its evidence](../docs/platform/evidence/site-engine-rc15/README.md) describes
that release and does not certify rc.16.

## Previous rc.14 site candidate

`zodiacs-engine-0.1.1-rc.14.tgz` and its checksum remain unchanged. Source
`03db4bb602377896283775920519b26d1f19a890`, carrier
`b221534e75842c9d7e589c456ed57957844cd06b` (merged by `8deda244`), SHA-256
`adc9805e22cd2468fa3340a864d9c53b36ff91e8f1592fdb35d8da8b69f4476e`, 87,415
bytes. It added configurable aspects, declinations and parallels (rc.11),
secondary progressions (rc.12), exact configured-aspect and declination
decisions (rc.13), and the Sun's out-of-bounds convention, `EPHEMERIS_SPAN`
refusal and the licence expression `MIT AND CC-BY-4.0` (rc.14).
[Its evidence](../docs/platform/evidence/site-engine-rc14/README.md) describes
that release and does not certify rc.15 or rc.16.

## Previous rc.10 site candidate

`zodiacs-engine-0.1.1-rc.10.tgz` and its checksum remain unchanged. Source
`9c4f3fd77b5d6235288d9cdfc2ac1d183a5c4d6b`, carrier
`d0c5cd0c8edaa849d2e2c0793ccc32c28826e7ee`, SHA-256
`a377cdc8c12e25ff7de4fe95ddf77a4cdee8d2da97071b0f8454e340b374565c`, 61,318
bytes. It added Equal-MC houses and the `chartPoints` API.
[Its evidence](../docs/platform/evidence/site-engine-rc10/README.md) describes
that release and does not certify rc.14 or rc.15.

## Previous rc.9 site candidate

`zodiacs-engine-0.1.1-rc.9.tgz` and its checksum remain unchanged. Source
`82aad2fcc9b204a687e0b67f709681e62f9e889a`, carrier
`fa1050e033a197b117868ce546d85352bff35376`, SHA-256
`bb5592302b1fa542cc745a9410b5a77faf49bbf4e205347ab771810efc300a20`.
[Its evidence](../docs/platform/evidence/site-engine-rc9/README.md) describes
that release's twelve house systems and does not certify rc.10.

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
