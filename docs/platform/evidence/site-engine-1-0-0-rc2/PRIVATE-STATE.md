# Compute bundle private-state review, 7 October 2026

The reviewed inputs are the digest-pinned rc.2 archive, astronomy-engine
2.1.19 (unchanged in the lockfile), and the regenerated server time basis.
[inputs.json](private-state-review/inputs.json) records the 15 paths and
their ordered executable-input digest,
`5e16f39b78d13c25f05137398c7d3237a74f06c7da2d34f25dbb4b1a4a768099`.
Neither calc, Vedic, techniques nor the engine's internal entries is bundled.

Before updating the committed reviewed digest, an external copy of the
generator wrote an audit-only bundle. Its only behavior change was to record
the new digest instead of refusing it. The final guarded generator reproduces
those bytes exactly. The server-only lifetime boundary is unchanged.

## State and dispositions

The AST inventory finds 327 top-level bindings and 32 direct write sites,
against 336 and 33 on site main's rc.17 bundle. Unused exported tables and
the default aspect-policy brand are dropped; rc.2's fixed numeric clock
bounds replace derived constants. New receipt convention records and the
aspect body set are fixed data, independent of a request. The error WeakMap
stores fixed error codes by weak error-object identity, never an input.

The ΔT arrays and decoded UT1 knots are initialized from fixed tables. Their
initialization holds no request epoch. Receipt statements are made from a
fixed J2000 chart. Astronomy-engine's DeltaT callback is restored by the
engine's synchronous finally. Pluto's GetSegment populates pluto_cache
through an alias; the direct-write inventory alone cannot detect that.

The one frame `last`, Pluto segments and aggregate Moon counter are cleared
after every invocation, including refusals and exceptions. The generator
still fails closed on a second frame or astronomy-engine time cache. The
finite completion-state inventory and +1 ms overlap probe pass on the
audit-only bundle. The positive control without cleanup recovers the
synthetic request's instant, demonstrating why the boundary remains needed.

Evidence: [rc.17 inventory](private-state-review/inventory-rc17.json),
[rc.2 inventory](private-state-review/inventory-rc2.json),
[rc.17 probe](private-state-review/nearby-overlap-rc17.json),
[rc.2 probe](private-state-review/nearby-overlap-rc2.json), and
[focused API tests](private-state-review/focused-tests.log).
The inventory/probe instruments are the committed rc.16 instruments,
with only their input path redirected for the audit-only run. Their original
source is retained under `../site-engine-rc16/private-state-review/`.

The attribution banner now copies the installed archive's full NOTICE;
it does not depend on a vendor README carrying an attribution paragraph.

## Limits

This is a source review and finite regression evidence, not secure memory
erasure or a universal proof of history independence. The inventory misses
alias mutations unless separately reviewed. The compute bundle alone is
covered by its digest; the current hosted AI MCP requires its own bundle
review and tests. Clearing references does not erase freed memory.
P3.3 is merged but not accepted; deployed cold latency and cost are still
required. No programme unit is accepted here.

## Current AI runtimes

The generated HTTP and Sky Watch bundles each contain 391 top-level bindings
and 33 direct writes; the local developer bundle contains 429 and 42.
The three `ai-*-inventory.json` files beside the compute inventory bind these
counts to their executable SHA-256 digests. The inventory tool is retained
in `tools/ai-state-inventory.mjs`; it performs static analysis, not a probe.

The engine state has the same dispositions as the compute bundle: fixed
ΔT/UT1 data, request-dependent frame and Pluto segments, the aggregate Moon
counter, and the restored DeltaT callback. The unchanged lifetime adapter
wraps the actual `executeAiTool` in a finally and local chart/comparison
`respond` in another finally. The three-bundle regression drive has a
positive control that leaves a synthetic epoch in the frame without cleanup,
then checks success, invalid zone, quota refusal, injected engine failure,
and overlapping asynchronous timezone resolution. Each owned resolver is
per call and disposed in the source `executeAiTool` finally. Calculation
itself is synchronous. The independent local chart/comparison tests also
check the local boundary after successful and failing calculations.

The additional HTTP counter holds only an aggregate preview-request count.
Its optional diagnostics contain enum names, timings and status, not request
arguments. Each HTTP request owns its SDK handler and closes it in finally.
The fixed origin set, capabilities and receipt statements carry no personal
inputs. The local stdio parser retains an incomplete bounded input line until
its newline, then resets its buffer; the output sanitizer likewise drains
complete lines. This transport buffering is not erased memory. External SDK
state is outside the static inventory. Sky Watch's authenticated durable
subscription/event store has its own disclosed retention policy; this audit
makes no claim that that store is ephemeral or that no hosting metadata exists.

The developer capability reply now preserves the shared engine's
`unpublished-candidate` status. Rebuilt developer ZIP 0.3.4 contains that
fix and the current full engine NOTICE. Prior ZIPs retain their bytes.
