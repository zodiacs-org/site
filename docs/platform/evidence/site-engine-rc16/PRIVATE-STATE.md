# rc.16 server-only private-state review, 1 October 2026

This local adoption integrates site main `ed55dacb` and the reviewed rc.15
compute prerequisite `458b6ab9` in an isolated worktree. No production change
or programme acceptance is implied. Immutable engine archives are unchanged.

## Reviewed artifact and graph

The vendored archive is byte-identical to engine carrier
`ef44477f85f28a57d5ec7f61ed6ea6a99c4be563`, whose archive record binds source
`ddbbaa0b1d21e16834722f81e8708816849c6726`: SHA-256
`43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`,
266,934 bytes, 69 regular files, 923,282 unpacked bytes. The installed package
is from those bytes. `private-state-validation.json` records each executable
input digest. The generator's reviewed aggregate covers the engine and
astronomy-engine files plus the locally generated server time basis.

The actual bundled code, its top-level mutable bindings and writes, and the
corresponding engine sources were reviewed. This was not a global-property
name scan or a version-pin-only update.

| State | What survives without cleanup | Disposition |
| --- | --- | --- |
| Engine `frame.ts` / bundled `last` | Exact TT, nine rotation values, and five tilt values | Clear in the server-only invocation `finally` |
| astronomy-engine `pluto_cache` | Table segments selected by request epoch | Clear in the same `finally` |
| astronomy-engine `CalcMoonCount` | Aggregate Moon evaluation count, not exact input | Reset in the same `finally`; bounded tightening beyond rc.15's documented aggregate-counter caveat |
| astronomy-engine `DeltaT` callback | Temporarily closes over a sample's DeltaT seconds | Engine `evaluated` restores the fixed model in its synchronous `finally`; inspect restored identity on success and injected failure |
| `cache_e_tilt`, `sidereal_time_cache` | No state in this graph | Both are tree-shaken out on rc.16; generator rejects their reappearance |
| DeltaT spline arrays and scalars; UT1 knots, in both package and server time-basis copies | Lazily decoded fixed tables | Input-independent, retained |
| Nutation `coefficientValues` | Decoded fixed IAU 2000B series | Input-independent, retained |
| Receipt `statements` | Conventions, coverage and DeltaT source identity from fixed J2000 example | Input-independent, retained; no chart or input retained |
| Default aspect policy WeakSet; receipt error WeakMap | Static policy brand and fixed error-code brand on weak keys | No request chart or timestamp stored; no strong lifetime extension |
| Enum initialization, constants, StarTable, BODY_ORDER | Static definitions | No request-dependent writes in this graph; DefineStar is absent |
| Local-time offset/wall/history/load maps | Zone/time lookup state | Existing F-59 per-request resolver instance, disposed by adapter `finally`; never cleared as shared maps |
| Endpoint maps, sample budgets and chart/results | Request-local values | No module-level retention; returned charts hold numbers, not frame/cache aliases |

The frame is new in rc.16. Replacing only the reviewed dependency digest would
leave the new timestamp cache uncleared; retaining rc.15's obsolete tilt reset
would fail because that variable is absent. The generator instead requires the
exact reviewed frame declaration and assignment, Pluto and count declarations,
and exported handler marker. Missing or duplicate markers, old time caches or
a second generated frame fail closed. Executable dependency changes fail the
aggregate digest and require a fresh audit.

## Lifetime and numerical tests

`tests/api/compute-api-private-state.test.ts` compiles the real production
adapter, loads the actual generated compute and local-time modules in a Node
22 process with `--no-experimental-detect-module`, and adds test-only private
observers. Production exports no observer or test hook.

The unwrapped-handler positive control retains a synthetic chart's frame. Its
last TT is the positive node-speed central-difference sample, 0.25 day after
the requested instant. Inverting the time basis and subtracting that known
six-hour sample offset recovers the exact synthetic UTC millisecond. The
observer also sees the frame's rotation/tilt, Pluto segments and positive Moon
count before cleanup. This is specific evidence of reachable module retention.

After every completed invocation the corrected wrapper has no retained frame,
no selected Pluto segments and a zero Moon counter; the fixed DeltaT callback
is restored. Cases include all six endpoints, malformed/budget/method refusals,
Firewall refusals/failures, an exception injected after frame construction, a
resolver failure and a response writer that throws. A historical resolver held
between prepare and resolve survives another request's cleanup and returns the
same response after resuming.

For all six endpoints and three additional synthetic charts (near the allowed
era ends and two milliseconds from the canary), each sequential response equals
a genuinely fresh-process response exactly, including numerical fields, full
receipt and citation digest. Source-handler versus bundled-handler examples
also compare equal. These are same-runtime regression comparisons, not an
independent accuracy assessment or proof for every input. No tolerance, rounding
normalization or citation removal is used in the fresh-process comparison.
Different Node/ICU releases can legitimately change named runtime provenance and
its digest. The rc.15 cleanup evidence's sub-display rounding caveats remain
historical evidence for rc.15 and do not become a blanket rc.16 parity claim.

The engine computes synchronously between installing sample DeltaT and restoring
it. There is no await inside that interval; another invocation's cleanup cannot
interrupt a calculation. Request-local asynchronous timezone state is separate.
Response/failure finally cleanup establishes reachability, not secure erasure of
freed bytes, operating-system memory or every platform log.

## Release limits

Focused checks are listed in `private-state-validation.json`. This audit does
not substitute for full rc.16 adoption: data/reference refresh, all numerical
causes, MCP carrier/pin, both build modes and unchanged budgets, all unit and
browser gates, final captures, publication and production checks remain separate.
P3.3 stays partial and its earlier release/telemetry gates remain unaccepted.
No new request to publish a package, spend, grant access or fetch secrets is made.
