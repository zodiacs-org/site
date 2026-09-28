# Transit-window independent validation

The source review was completed before product implementation on 7 September
2026. The original v2/v3 Uranus D exact-topology contract remains
`failed-incomplete`. Its 0.044188° turning-point margin is below the original
0.05° model budget; the second period cannot certify an exact-pass count.

A separately declared v6 acquisition qualifies period membership and a broad
closest-alignment region. It retains the original inputs, budgets, 0.1-second
root brackets, one-second band padding, original calls and failed receipt.
The new runtime reproduced all 3,414 retained Uranus six-tuples bit-exact before
404 additional evaluations. Total new calls: 3,818; elapsed 1.226 seconds. All
returned flags were 258, with no provider warnings. Four threshold bands,
two positive periods and the five false/true/false/true/false membership cells
passed root review. The second period must display uncertain exact topology.

The historical Python extension was unavailable. The official pinned PySwissEph
2.10.3.2 source distribution was rebuilt with the recorded GCC recipe. This is
a new independently identified runtime, not a claim of recovered binary identity.
The unsuccessful default-compiler attempt is preserved with the successful
build, exact wheel/extension, ephemeris bytes, complete source journals and all
proposals in `zodiacs-wave24-qualified-source-2026-09-07.zip` (23,128,142 bytes):
SHA-256 `f5a4d921db71d64dbc204e514330b3db00dbcd3c806c26443f172dfbb1bc6128`.
It is durably retained with the task's evidence. No site output enters that
source acquisition.

Important immutable identities:

| Record | SHA-256 |
| --- | --- |
| v2 original partial | `3c48a6f13c5b0ea080e4b298418422d4b76a9405aeb767f25b61963e085c579b` |
| v3 original partial | `8faab02e91e8dc1e96652118802e97d5d6a567e9475e5ebe18ed54f80118f62f` |
| v6 policy | `52bf3fbf5bd2730cf82848864b70ed51a0061e72bba9bd8d0f4ed1ed74770fc2` |
| v6 acquisition wrapper | `a8e97086ae77c7f87084fd52c13235ca4b9fdbeb971f19f817cd4abca3c82a36` |
| v6 runtime manifest | `1258c2ad9410ec17cfe33292761b323b6e5915f95b3be4bfd6ff8fba9422d5fa` |
| v6 qualified receipt | `2776acbc5b15fb80e0ecc9ce2cc63dc19b9a835a080461da8adee9b5f7c2485c` |
| v6 evaluation journal | `8c69e0992cbdc302abf4e41d230a6c36910c9b289c1addf66c553f17f5f63c71` |
| A–I compact projection | `db4ddce1d2761ad0ada1ab7aaf456d74d2f79b6b6a3434b1b8f6b9895ad66c3a` |

To reproduce the compact projection offline, extract the retained archive and
run `python3 docs/engine-validation/transit-windows/project-fixtures.py /path/to/extracted/archive`.
The projection verifies original receipt hashes and performs no provider or
product calculations. The tests cover nine A–I cases and 30 aspect branches,
including empty branches, entry/exit/exact bands, local versus global minima,
compound natal gates, source-clock conventions and crop-count qualifications.
Original fixed-target budgets remain unchanged. Production computed targets
combine moving 0.05° with natal 0.05° for planets, 0.15° for Moon and 0.10° for
angles: totals 0.10°, 0.20° and 0.15° respectively.

The product computes model periods within a 3° orb, labels exact topology or
membership uncertainty, preserves real gaps, and excludes unresolved boundaries
from calendars. Unknown or unverified time excludes Moon and angles. A cropped
edge never becomes an invented peak; discrete equal minima and plateaus remain
distinct. The UI describes approximate traditional interpretations.

Finite modern fixtures and the bounded half-day slow-planet sampling grid do
not certify arbitrary high-frequency trajectories or every supported epoch.
Historical Wave 19 raw files and the later Wave 20 supplement remain separate
unrecovered evidence limitations, as recorded in their original recovery notes.

## Addition, 2026-09-28: the projection left the tree

Under [DECISIONS-2026-09-28 §3](../../platform/programme/DECISIONS-2026-09-28.md)
the A–I compact projection, `src/lib/engine/fixtures/transit-window-independent.json`,
SHA-256 `db4ddce1d2761ad0ada1ab7aaf456d74d2f79b6b6a3434b1b8f6b9895ad66c3a`
as in the table above, left the tree. Commit `2ca93d41` still has it.
`project-fixtures.py` regenerates it and now requires `--output`, which should
name a path outside the repository:
`python3 docs/engine-validation/transit-windows/project-fixtures.py /path/to/extracted/archive --output /tmp/transit-window-independent.json`.
The receipts' hashes, the v6 policy, its acquisition wrapper and the runtime
manifest stay. `transit-window-independent.test.ts` reads
`transit-window-horizons.json`: the same nine cases, 30 branches, budgets and
crops, on the NASA JPL Horizons longitude
([`../independent-references/`](../independent-references/README.md)). The
original contract stays `failed-incomplete`, and the new reference reaches the
same limit on its own: Uranus turns 0.0442° from the D target in the second
period, inside the 0.05° budget, so that period keeps an uncertain exact
topology. The record of everything removed is
[`../SWISS-OUTPUT-REMOVAL.md`](../SWISS-OUTPUT-REMOVAL.md).
