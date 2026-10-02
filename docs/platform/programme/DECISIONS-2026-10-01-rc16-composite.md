# Technical decision: defer the rc.16 composite port

The programme integrator chooses the conservative resolution under the
existing package-adoption mandate. This is a local implementation decision,
not a claim of a new owner approval or permission to drop programme scope.

The rc.16 composite port makes the saved-chart RelationshipWheel load the
shared techniques and ephemeris chunks. The actual wheel static closure grows
from 22 chunks / 52,000 gzip bytes without the ephemeris to 30 chunks /
96,188 bytes with it. Production-flags `/compatibility/` grows to 36,915
bytes against its unchanged 36,864-byte limit, failing by 51 bytes.
The existing saved-chart view explicitly avoids loading the ephemeris.

The bounded audit found no import-only trim that preserves the package port,
immutable archive, existing behavior and lazy boundary. Evidence and exact
reproductions are in `evidence/site-engine-rc16/bundle-audit/PRODUCTION-COMPATIBILITY.md`.
The earlier same-engine composite numerical parity remains valid evidence,
but it does not establish safe product adoption or satisfy the route gate.

Restore only `src/lib/composite.ts` to the current-main implementation at
`ed55dacb449ada6e4893676c80bd0d9ba73db576`. Keep the verified rc.16 package,
all other adoptions, all owner changes, and the original parity artifacts.
No route budget increases, speculative export extraction or generated pure
bridge is introduced. Composite adoption waits for a lightweight published
entry that does not import the ephemeris; this extends finding F-54.

Four technique units remain locally eligible: returns, void-of-course,
aspect-patterns and Moon-sign candidates. P2.E.composite remains unaccepted
and stays in the fixed programme denominator. Every formal release gate
remains required; both build configurations and affected tests must be rerun.
