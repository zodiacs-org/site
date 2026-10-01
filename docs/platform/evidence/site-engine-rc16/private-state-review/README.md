# Independent rc.16 compute private-state review

Reviewed 1 October 2026 against the locally prepared adoption worktree. Outcome:
**no remaining blocker found in the revised server lifetime boundary**. This is
a focused local code and regression review, not release approval, production
verification or full programme acceptance. Only this evidence directory was
written by the independent reviewer; no implementation, archive, Guide or
reference fixture was changed by this review.

## Artifact identity and reproducibility

The reviewed generated compute module is 245,241 bytes, SHA-256
`7e2f1e5c36ae577b513bbc438c295c7499668e138d1a0a8fdab7d34949c2bab6`.
The generator source is SHA-256
`7e010c1798bd8eff21dba4e3f1b7f58c4a28bcbb2b2a72ad035b608e70e10208`.
Its reviewed executable-input aggregate is
`025fc77deed9584f4d5f4c342f42483f1880fd3c5f4abe87af4cabd0584cc1ab`,
covering the installed engine and astronomy-engine inputs plus
`src/lib/engine/time-basis.mjs`. See `manifest.json` for individual source,
bundle, test and evidence-file hashes and the exact executable used. Because
the implementation was uncommitted when reviewed, the recorded worktree HEAD
alone is not an artifact identity; these file hashes are authoritative.

From the repository root, with `NODE22` pointing to Node **v22.22.2**, the exact
commands used were:

```sh
EVIDENCE=docs/platform/evidence/site-engine-rc16/private-state-review
"$NODE22" "$EVIDENCE/audit-inventory.mjs" > "$EVIDENCE/inventory-result.json"
"$NODE22" "$EVIDENCE/probe-nearby-overlap.mjs" > "$EVIDENCE/nearby-overlap-result.json"
"$NODE22" node_modules/vitest/vitest.mjs run tests/api/compute-api-private-state.test.ts tests/api/compute-api-bundle.test.ts > "$EVIDENCE/focused-tests.log" 2>&1
"$NODE22" scripts/build-compute-handler.mjs --check > "$EVIDENCE/generator-check.log" 2>&1
"$NODE22" scripts/build-compute-local-time.mjs --check >> "$EVIDENCE/generator-check.log" 2>&1
```

Both probes read the actual generated bundle and instantiate test-only
instrumented modules in memory. They do not edit the bundle or export an audit
interface from production. The Firewall verdict is replaced by a local allowed
stub; no live Firewall, production endpoint or other remote mutation is used.

## Independent inspection

The review read the repository instructions, rc.16 handoff, programme handoff
section 7, installed compiled inputs and their corresponding frame/ephemeris
source, the generated module, adapter, endpoint/receipt source and local-time
resolver. It also used TypeScript's symbol binding to identify writes to actual
top-level variables rather than relying only on cache-name searches. The
inventory records **315 top-level variable bindings and 33 direct write/update sites**
in the revised bundle. Aliased writes require source review: specifically,
`GetSegment(cache, tt)` receives and mutates `pluto_cache`, although the local
parameter is not a global identifier in the syntax tree.

The retained-state findings and dispositions are:

- `last`, rc.16's ecliptic frame, holds exact TT, nine rotation components and
  five tilt values. The new server-only `finally` clears it
- `pluto_cache` retains fixed table segments selected by request epoch. The
  same boundary clears its entries
- `CalcMoonCount` is an aggregate evaluation diagnostic. The rc.15 evidence
  already described it accurately as a non-time counter, not a retained date
  or body record. Resetting it here is a bounded tightening, not discovery of
  a new critical timestamp leak
- `DeltaT` temporarily refers to a closure over a sample's DeltaT seconds.
  Every bundled public computation that installs it runs through synchronous
  `evaluated`, whose own `finally` restores the fixed `deltaT` function
- The two DeltaT interpolation-table copies, both UT1 knot arrays and the
  IAU 2000B coefficient array are lazily initialized entirely from fixed
  definitions. They retain no requested date or selected input values
- Receipt `statements` stores conventions, coverage and DeltaT-source identity
  derived from a fixed J2000 chart. It retains neither that chart nor a
  request's input, and the emitted rc.16 convention values were checked
- The policy WeakSet brands a fixed default policy in this graph. The error
  WeakMap associates weak error keys with fixed codes; it does not strongly
  retain errors, charts or timestamps. These collections were source-reviewed,
  not introspected or claimed empty
- Enum initialization, static sets/maps and coefficient tables are
  input-independent. `StarTable` has no request writer because `DefineStar`
  is absent from the bundled graph
- Endpoint memos, budgets, chart inputs and outputs are request-local.
  Returned chart values do not alias the frame or Pluto caches
- Async timezone state belongs to each invocation's separate resolver factory
  instance and is disposed in the adapter's `finally`. It is not a shared map
  that another request's completion could erase

No await occurs between installing a sample's DeltaT and restoring it. The
calculation itself cannot be interrupted by another promise's cleanup. Async
work can overlap before or after those synchronous calculations without
changing the already calculated numeric outputs.

The generator requires the unique frame declaration, frame assignment, Pluto
and counter declarations and export marker. It rejects obsolete tilt/sidereal
caches and a second generated frame. Dependency-byte changes fail the reviewed
digest. A draft duplicate-declaration test exposed a missing standalone
`var last;` uniqueness check; that check was added and the final mutation tests
pass. Production exports contain no audit namespace or failure injection hook.

## Executed evidence

**Focused tests: 2 files, 6 tests passed on Node v22.22.2.** Both generator
drift checks also passed. The private-state suite loads the actual production
adapter and generated modules with test-only observers, rather than substituting
a separate computation implementation. It covers:

- The unwrapped positive control and real active frame/Pluto/counter state
- All six endpoint successes; method, malformed and budget refusals; Firewall
  refusals/failures; injected ephemeris, resolver and response-writer exceptions
- A historical resolver paused after preparation while a second request
  completes, followed by parity after the first resolver resumes
- Nine exact fresh-OS-process response comparisons: six endpoints and three
  additional charts, including near the permitted era ends. These comparisons
  include numerical fields, complete receipts and citation digests
- Missing/duplicate cleanup markers, reintroduced old time caches and an
  additional frame, plus generated-output and runtime-import checks

The separate source-handler/example comparison in the bundle suite uses the
existing `withoutRuntime` helper, which replaces runtime provenance and citation
digests. That test must not be cited as exact digest parity. The nine
fresh-process comparisons and both additional probes do not use that helper.

**Inventory probe:** after deliberately initializing both the IERS and model
table branches with fixed synthetic examples, four charts spanning 1800,
2000, 2026 and 2199 left every observed top-level variable snapshot unchanged.
Each completion also explicitly had a null frame, no Pluto keys, zero Moon
counter and the restored DeltaT function identity. Every chart named rc.16's
`nutation` and `moonPosition` conventions. The initial exploratory probe showed
the expected first-use UT1-knot initialization; it was classified as fixed
table initialization, not suppressed as a request-dependent mutation.

**One-millisecond probe:** for the synthetic pair at
`2082-03-14T05:29:17.000Z` and `.001Z`, the entire target response was identical
between a warmed unwrapped module, fresh isolated unwrapped module, cleaned
sequential module and cleaned overlapping module. Both overlapping completion
observations were empty/restored. Fresh here means a separately instantiated
ESM module in the same process; it is distinct from the nine OS-process tests.

The unwrapped observer actually retained TT `30022.979541406614` for the target
chart's positive node-speed sample. Inverting the engine's time basis and
subtracting its known 0.25-day sample offset recovered the target's exact API
UTC millisecond. This uses rounding to the API's millisecond resolution, not a
claim that binary64 stores an arbitrary UTC instant with infinite precision.
The saved positive-control frame is from a synthetic fixture, not a person.

## Limits and historical evidence

These are finite, same-runtime lifecycle and regression checks, not independent
astronomical accuracy measurements, a universal bitwise-history-independence
proof or a guarantee for every input or runtime. Weak collections and function
closures are not enumerable through the snapshot serialization; the source
audit and exact DeltaT identity check supply the relevant additional evidence.

No numeric rounding, tolerance, field removal or digest removal was applied to
the nine fresh-process comparisons or the one-millisecond probe. Different
Node/ICU versions can change runtime provenance and its receipt digest. The
rc.15 review's tiny rounding differences and overlap caveats remain valid dated
rc.15 evidence; they are not silently replaced by this finite rc.16 result.
Its old `review-numerical-parity.mjs` references `cache_e_tilt` and an rc.15
baseline and is not a current rc.16 reproducer. Use the scripts in this
directory for the additional rc.16 observations.

Cleanup is established at completed handler invocation, after the wrapper's
`finally`. The active frame can exist during calculation and response writing;
the tests deliberately observe it there. Dropping these references is not
cryptographic erasure of V8 heap pages or operating-system memory, and this
review makes no new assertion about every platform log.

No full-suite, browser, build-budget, throughput, cold-start, publication,
deployment or production gate is closed by this evidence. Those remain separate
adoption work. The crosschecked parent records `../PRIVATE-STATE.md` and
`../private-state-validation.json` describe broader checks; this independent
report claims only the commands and observations recorded here.
