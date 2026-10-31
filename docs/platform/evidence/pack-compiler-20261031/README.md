# Pack compiler 2.0.0, 31 October 2026: P4.2 accepted

Ledger unit P4.2, "Compiler fixes: span from the kernel; refuse over-budget
packs", has the gate "v1 M2.1". Its rule: "DE440 full, DE440 cropped and
DE432s each compile to a pack that opens and answers, or are refused with a
typed reason; tier-B 85/85 on the new pack; payload digest recorded."
[PREREGISTRATION.md](PREREGISTRATION.md) fixed how that is run before
compiler 2.0.0 touched DE440 or DE432s.

**Verdict: PASS.** All three compile, open and answer, with every body
proven inside its position budget. Tier B passes 85 of 85 on the DE440 pack
from 1790 to 2210, against `de440.bsp`. The payload digests are below, and
the cropped compile gave the same bytes twice.

## What 1.1.0 did

The audit ran 1.1.0 on these kernels
([its verdict](../engine-audit-2026-09-22/verify/verdicts-data-toolchain-packaging.txt)):

- **DE440 and DE440 from 1800 to 2200** compiled, but every body's records
  stopped 109,600 days after the kernel's start, in 1850. The runtime
  refused both packs (`bad-geometry`).
- **DE432s** compiled and opened, but its last records ran up to 1,816 days
  past the kernel, where the SPK reader extrapolated the last polynomial.
  The EMB's proven bound was 52.6 km against a 0.3 km budget, the compiler
  wrote the pack anyway, and every `apparent()` call the audit tried threw.

On DE440s, the one kernel 1.1.0 handled, its own proven bounds put all
eleven bodies over their budgets: the Moon at 0.0221 km against 0.010, Mars
at 1.010 against 0.5 ([development-de440s.json](results/development-de440s.json)).

## What 2.0.0 changes

In `examples/precision-alpha/tools/compiler/` (its `SOURCE.md` records the
1.1.0 and 2.0.0 hashes) and the runtime's `src/core/container.mjs`:

- **The span comes from the kernel**: the stretch every segment the pack
  reads covers. Each needed segment must be present, SPK type 2 in the
  J2000 frame, and covered by its own records, or the kernel is refused by
  name (`segment-missing`, `segment-type`, `segment-coverage`). A window
  from `--fromYear` and `--toYear` must lie inside the kernel
  (`window-outside-kernel`), where 1.1.0 shortened it without saying so.
- **`nrec = ceil(span / L)` records of `span / nrec` each**, so the last
  record ends on the coverage stop. The brief asks for a clipped last
  record; this shortens every record instead, because the runtime's
  validated searches assume equal records. Nothing is extrapolated either
  way, and the SPK reader now throws for an instant outside a segment
  rather than running its last polynomial outward. This departure from the
  brief's wording was stated before the runs, and the merge is where it is
  accepted or not.
- **Every body is proven inside its budget, or nothing is written.** The
  proven fit bound combines the three components as a vector (1.1.0 took
  √3 times the largest), the fit is held to half the budget by adding two
  coefficients at a time up to 64, and quantisation takes the other half.
  A body still over budget is an `over-budget` refusal naming it.
- **The command line**: `--kernel` is required, `--out` defaults to
  `<kernel>-<candidate>.zeph` in the working directory, `--help` prints the
  options, unknown, repeated or empty flags are refused, and an output path
  equal to the kernel is refused. Refusals print their code as JSON on
  stderr and exit 3 (usage errors exit 2).
- **Format 2.** The header names its conventions with tokens
  (`chebyshev: "spk-type-2"`, `units: "km,km/s"`), and the runtime now
  refuses a `formatVersion` it does not know and convention values its
  version does not define. Version 1's two sentences remain readable.
- **A `provenance` block**: the producer's name and institution (settable;
  NAIF's rules ask a modified kernel to name its last modifier), the source
  kernel's file, size and SHA-256, the ephemeris read from the segment
  names, the DE440 citation with its DOI (`10.3847/1538-3881/abd414`, which
  the kernel's own comment area also carries), and a modification note.
  DE432s's comment area cites no reference, and the header says none rather
  than supplying one.
- **The same bytes on any machine.** The cosines in the fit come from
  integer reduction and a fixed Taylor polynomial instead of `Math.cos`,
  whose last bits differ between engines. 1.1.0's DE440s payload was
  `0a218764…` in the records and `0c7e1c93…` on this machine, from the
  same source and kernel. A tier-A test pins the payload digest of a
  synthetic kernel's pack, so CI on another architecture checks it.
- **A record with one interval** stored every coefficient as its
  midpoint, all widths 0 and a stride of 0, which the runtime refuses; any
  crop shorter than one record of an outer planet produced such a pack. The
  stride is now at least 4 bytes.
- Candidate C, a residual over astronomy-engine, has no proven bound and is
  refused (`no-proven-bound`).

## The rule's runs

Compiler 2.0.0, candidate D, Node 22.22.2 on darwin-arm64,
[`tools/run-m21.mjs`](tools/run-m21.mjs), output
[`results/m21.json`](results/m21.json):

| run | exit | compile | pack bytes | payload SHA-256 | sealed SHA-256 | verdict |
| --- | ---: | ---: | ---: | --- | --- | --- |
| DE440 full, 1549-12-31 to 2650-01-25 | 0 | 73.0 s | 6,481,936 | `fa74500d40fe79804090d0eb792bed0cd55e8a12edd69cc152b24440dd22cc22` | `a08553daadd8b14e…` | compiles, opens, answers |
| DE440 cropped, 1790-01-01 to 2210-01-01 | 0 | 28.3 s | 2,489,632 | `1ff4ac1b28cb0cf25b97662209e1df3fc7e10bf2a75396416eea153f0735a8bd` | `51428874d9a47213…` | compiles, opens, answers |
| DE432s, 1949-12-14 to 2050-01-02 | 0 | 5.3 s | 606,416 | `5291f8ab2aa92e2ee69c3710bdd5706114bc792def601e512a241402677a64ba` | `99892e4b3c3ded11…` | compiles, opens, answers |

The full digests, before and after sealing, are in `results/m21.json`. Each
pack opened with `selfConsistent` true, and `apparent()` returned a finite
place for all ten bodies at one day after the start, the midpoint and one
day before the stop (30 answers per pack, in the same file). At the cropped
pack's midpoint, J2000.0, the Sun's apparent longitude is 280.368°.

The cropped compile ran a second time and wrote the same bytes (file
SHA-256 `08b5d1a2f5c6ac85c7ec3f4e4b38a23a729f3aef16c94babb3a03f8b7fbc9b62`).
The brief estimated about 2.3 MiB for this pack by scaling 1.1.0's DE440s
pack; it is 2.374 MiB, because six bodies needed more coefficients to be
proven inside their budgets.

### The 1790 to 2210 pack, body by body

| body | coefficients (chosen → used) | records | days each | proven fit, km | proven total, km | budget, km |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Mercury barycentre | 41 → 41 | 1,918 | 79.980 | 0.1361 | 0.2861 | 0.3 |
| Venus barycentre | 43 → 45 | 384 | 399.482 | 0.1366 | 0.2866 | 0.3 |
| Earth-Moon barycentre | 31 → 37 | 560 | 273.930 | 0.1337 | 0.2837 | 0.3 |
| Mars barycentre | 39 → 45 | 224 | 684.826 | 0.1869 | 0.4369 | 0.5 |
| Jupiter barycentre | 43 → 43 | 56 | 2,739.304 | 0.4642 | 0.9642 | 1 |
| Saturn barycentre | 22 → 24 | 56 | 2,739.304 | 0.2018 | 0.7018 | 1 |
| Uranus barycentre | 14 → 14 | 56 | 2,739.304 | 0.4125 | 0.9125 | 1 |
| Neptune barycentre | 11 → 11 | 56 | 2,739.304 | 0.4427 | 0.9427 | 1 |
| Pluto barycentre | 10 → 10 | 56 | 2,739.304 | 0.4523 | 0.9523 | 1 |
| Sun | 44 → 46 | 384 | 399.482 | 0.1118 | 0.2618 | 0.3 |
| Moon | 31 → 33 | 4,794 | 31.998 | 0.0035 | 0.0085 | 0.01 |

The proven total is the proven fit plus the proven quantisation bound, half
the budget. The other two packs' tables are in `results/m21.json`.

### Tier B on the new pack

`npm run test:data` in `examples/precision-alpha` with `PRECISION_PACK` set
to the sealed 1790 to 2210 pack and `PRECISION_KERNEL` to `de440.bsp`:
85 tests, 85 passed, none failed, skipped or cancelled
([tier-b-de440-1790-2210.tap](results/tier-b-de440-1790-2210.tap)).

## Development, not evidence

On DE440s, 2.0.0 wrote 1,780,464 bytes against 1.1.0's 1,737,632 here, with
every body inside its budget, and tier B passed 85 of 85 with both
([development-de440s.json](results/development-de440s.json),
[tier-b-de440s-development.tap](results/tier-b-de440s-development.tap)).

The new tier-A tests (`compiler.nodetest.mjs`, `pack-format.nodetest.mjs`)
compile synthetic kernels written byte by byte in `_spk.mjs`. They check
the span from the kernel (one segment starting later than the rest), the
record grid, the budgets, the provenance block, determinism and the pinned
digest, the runtime opening and answering, cropping, every refusal through
the command line, the reader's refusal to extrapolate, and the container's
version and token checks.

## Timeline, Asia/Bangkok

- 22:46:01: [PREREGISTRATION.md](PREREGISTRATION.md) committed. At 22:47:30
  one en dash in it was replaced by "to", amending that commit; no pack had
  been written yet (the first was written at 22:47:44).
- 22:46:37 to 22:48:43: a first run. Every compile passed, but the
  determinism check failed, because `compile.mjs` was edited while the run
  was going (years below 100 were read as 1900 plus the year).
  The second cropped compile used the edited source, so its header named a
  different source hash; the payload was the same. That run is not the
  record.
- 22:49:12 to 22:52:50: the recorded run, tier B and the development run,
  on the source committed with this record.

## Reproduce

Download `de440.bsp`, `de432s.bsp` and `aa_checksums.txt` from NAIF's
`generic_kernels/spk/planets/`, check the MD5s, put the two kernels in one
directory, and from the repository root:

```sh
node docs/platform/evidence/pack-compiler-20261031/tools/run-m21.mjs \
  --kernels=/path/to/kernels --work=/path/outside/the/repo --out=m21.json
cd examples/precision-alpha
PRECISION_PACK=/path/outside/the/repo/de440-1790-2210.v2.zeph \
PRECISION_KERNEL=/path/to/kernels/de440.bsp npm run test:data
```

No kernel and no pack is committed. Whether NAIF's permission reaches a
derived coefficient set is still unanswered
([RIGHTS.md](../precision-2026-09-20/RIGHTS.md)), so none is distributed.

## Not covered

- Candidates A and B were not run on DE440 or DE432s; the rule concerns
  the pack the runtime uses, candidate D.
- The validated searches were exercised only as far as tier B exercises
  them, on the 1790 to 2210 pack.
- Cross-machine determinism is pinned on a synthetic kernel in CI, not on
  the DE440 packs, whose digests here are from one machine.
