# Technical decision: measured rc.16 engine allowance, 1 October 2026

The incorporated `HANDOFF-STATUS-rc16.md` step 10 permits only the measured
engine growth, with its reason recorded, preserves the prior 250-byte
headroom and forbids any route-budget increase. This applies that existing
authority after an independent bounded import-graph review; it is not a
new owner approval or an arbitrary gate waiver.

The actual seven-chunk static closure grows from 32,108 to 33,154 gzip bytes,
**1,046 bytes**. Identical source-boundary and chart-adapter code, bundle
settings and versions are verified. An independent same-source Vite 8.1.3 /
Rolldown 1.1.4 archive comparison measures +1,047 bytes; esbuild measures
+1,070 bytes. These corroborate intrinsic full IAU 2000B / frame growth;
they do not replace the actual seven-chunk budget metric.

The ephemeris/frame chunk contributes +1,039 gzip bytes, shared math +8 and
houses −1; runtime, site adapter and time basis remain byte-identical. The
review found no duplicate ephemeris copy, unused retained export, eager-site
import or safe trim preserving numerical behavior and lazy boundaries.
Evidence and reproducible audit: `evidence/site-engine-rc16/bundle-audit/`.

Only `budgets.json`'s engine-chunk value changes: 31.6 to 32.621484375 KiB.
That is exactly **+1,046 bytes**, from 32,358.4 to 33,404.4 bytes, preserving
250.4 bytes of headroom (the earlier prose rounded this to 250). Every route
and chunk-max allowance stays unchanged. All 16 default route gates and
engine/homepage lazy isolation passed before the allowance change; the
smallest route margin was `/big-three/`, 11 bytes. Both full build modes and
all final gates still need to be checked on the resulting source.

The original failing budget report remains in the audit evidence. No
immutable archive, production flag, numerical gate or programme denominator
changes with this decision.

## Final accounting after composite deferral

The bounded composite deferral changes shared chunk retention. The final
production build's engine closure is 33,130 bytes, **1,022 bytes** over the
verified rc.15 baseline of 32,108. The earlier 1,046-byte measurement remains
in the audit as the before-deferral state. The final allowance is therefore
**32.598046875 KiB = 33,380.4 bytes**, exactly +1,022 bytes over the old
allowance and preserving 250.4 bytes headroom. The provisional allowance
is reduced by 24 bytes; no excess headroom or route increase is retained.
All final production route gates pass; compatibility is 36,763 bytes,
101 bytes below its unchanged limit, and its saved-chart wheel again loads
no ephemeris. Final graphs are in the audit's after-deferral records.
