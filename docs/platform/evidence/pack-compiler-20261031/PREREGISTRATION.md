# Pack compiler 2.0.0 against version 1's M2.1: preregistration

Written on 31 October 2026 (Asia/Bangkok) before compiler 2.0.0 was run on
DE440 or DE432s. Until then it had compiled only DE440s, the kernel the
1.x choices were swept on, which this record calls the development kernel.

## The unit and its rule

Ledger unit P4.2, "Compiler fixes: span from the kernel; refuse over-budget
packs", gate "v1 M2.1". Version 1's M2.1 asks
([BRIEF-v1.md](../engine-audit-2026-09-22/BRIEF-v1.md), §3 M2 item 1):

> derive span from the kernel; `nrec = ceil(span/L)` with a clipped last
> record; refuse when any proven bound exceeds its budget; `--kernel`
> required, `--out` defaults to cwd, `--help` handled; container checks
> `formatVersion` and `conventions.{chebyshev, units}` as enumerated tokens;
> header gets a `provenance` block (producer name+institution, DE440
> citation with DOI, kernel hash, modification note per the NAIF rule).
> Compile a 1790–2210 pack from DE440 […]. Rule: DE440 full, DE440 cropped
> and DE432s each compile to a pack that opens and answers, or are refused
> with a typed reason; tier-B 85/85 on the new pack; payload digest
> recorded.

## How the rule is run

Compiler 2.0.0, candidate D, Node 22.22.2 on darwin-arm64, from this
branch's `examples/precision-alpha`. Three compiles:

| run | command |
| --- | --- |
| DE440 full | `compile.mjs --kernel=de440.bsp` |
| DE440 cropped | `compile.mjs --kernel=de440.bsp --fromYear=1790 --toYear=2210` |
| DE432s | `compile.mjs --kernel=de432s.bsp` |

Each passes if either:

- **it compiles, opens and answers**: exit 0; `tools/seal.mjs` seals it;
  `openPackFile` opens it with `selfConsistent` true; and `apparent()` with
  `CORRECTED` returns a finite longitude, latitude and distance for all ten
  bodies (Sun, Moon, Mercury to Pluto) at three instants: one day after the
  coverage start, the coverage midpoint, and one day before the coverage
  stop; or
- **it is refused with a typed reason**: exit 3 and a JSON refusal on
  stderr whose `refused` is one of the compiler's codes.

"The new pack" is the DE440 pack from 1790 to 2210. Tier B passes if
`npm run test:data` with `PRECISION_PACK` set to that pack, sealed, and
`PRECISION_KERNEL` set to `de440.bsp`, reports 85 tests and 85 passes.

"Payload digest recorded": the payload SHA-256 and the file SHA-256 of
every pack written, before and after sealing, are committed under
`results/`. The cropped compile runs twice, and the two outputs must be
byte-identical.

The kernels are NAIF's, from `generic_kernels/spk/planets/`, each checked
against NAIF's `aa_checksums.txt` (MD5) when downloaded:

| kernel | bytes | SHA-256 | NAIF MD5 |
| --- | ---: | --- | --- |
| `de440.bsp` | 119,799,808 | `a4ce9bf9b3282becc9f4b2ac3cebe03a2ae7599981aabd7265fd8482fff7c4b5` | `c9d581bfd84209dbeee8b1583939b148` |
| `de432s.bsp` | 10,895,360 | `363f32e14f5255359ac32c4d38080cf28ab55564a5e16696a75f63394b666e9b` | `d66c2153188958472fec67016b4b4e7a` |
| `de440s.bsp` (development) | 32,726,016 | `c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2` | `3917ee56769db332790c751e2168843d` |

No kernel and no pack is committed: the derived-coefficient question to
NAIF is still open ([RIGHTS.md](../precision-2026-09-20/RIGHTS.md)).

## What was decided on the development kernel, before these runs

1. **The proven bound combines the three components as a vector.** 1.x
   multiplied the largest component bound by √3. Per elementary interval,
   √(S_x² + S_y² + S_z²) also bounds the error vector, and is never looser.
2. **The fit is held to half of each budget by adding coefficients.** On
   DE440s with 1.x's choices, 1.x's own proven bounds put every body over
   its budget (the Moon at 0.0221 km against 0.010). With the vector bound,
   six bodies' fits proved inside half their budgets and five did not
   (Venus 0.191, EMB 0.188, Mars 0.527, Sun 0.155, Moon 0.0110 km). Two to
   four more coefficients at the same interval brought each inside, for 5 to
   13 per cent more bytes per body. So the rule: start from `choice.json`,
   add two coefficients while the proven fit bound exceeds half the budget,
   stop at 64, and refuse the pack if a body is still over. Quantisation
   keeps the other half, as in 1.x.
3. **The last record is not clipped; every record is shortened.** B and D
   lay `nrec = ceil(span / L)` records of `span / nrec` each, so the last
   record ends on the coverage stop and no record reaches past the kernel.
   A clipped last record would have a different length from the others,
   and the runtime's validated searches assume equal records (record
   boundaries at `initEt + i * intervalSec`, one radius). Shortening every
   record keeps that invariant and changes no runtime code; what M2.1's
   clipping is for, that nothing is extrapolated, holds either way. This is
   a stated departure from the brief's wording.
4. **The cosines are computed from arithmetic.** The same 1.1.0 source and
   the same DE440s gave payload `0a218764…` in the audit's record and
   `0c7e1c93…` on this machine, because `Math.cos` is
   implementation-defined and the fitted coefficients moved in their last
   bits. Compiler 2.0.0 reduces each Chebyshev angle in integers and
   evaluates a fixed Taylor polynomial, so the payload is a function of the
   kernel and the settings alone. A tier-A test pins the payload of a
   synthetic kernel's pack, so CI on another architecture checks this.

On DE440s, compiler 2.0.0 wrote 1,780,464 bytes (1.1.0: 1,737,632) with
every body proven inside its budget, and tier B passed 85 of 85 against it
and the kernel. That is development, not the rule's evidence.
