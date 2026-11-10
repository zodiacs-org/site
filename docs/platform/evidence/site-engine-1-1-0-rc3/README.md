# The site on engine 1.1.0-rc.3

Engine 1.1.0-rc.3 (zodiacs-org/engine#84, merged as `bc0b5a76`) adds
`@zodiacs/engine/de440` and the root's `withEphemeris`, for P4.1, the DE440
reduction as the compute API's hosted backend. P4.1's own record, with its
preregistration and its run, is [../de440-hosted-20261109/](../de440-hosted-20261109/README.md).
This folder records the adoption: every output the engine feeds, regenerated
on the vendored archive with the site's own generators, on Node 22.22.2
(macOS arm64), the compute examples and the developer demo on Node 24.21.0.

| File | What |
| --- | --- |
| [ARTIFACT-IDENTITY.md](ARTIFACT-IDENTITY.md) | the archive, its carrier and merge, npm's state, the packed consumer and the parity reports, with two controls |
| [npm-view.txt](npm-view.txt), [npm-registry-1-0-0.json](npm-registry-1-0-0.json) | the registry read of 2026-11-10 |
| [public-consumer.log](public-consumer.log) | the engine's packed-consumer harness on Node 22.22.2 and 24.21.0 |
| [node22-parity.json](node22-parity.json), [node24-parity.json](node24-parity.json) | the node and polar residuals against the independent references: 1.1.0-rc.2's exactly |
| [regenerated-outputs.json](regenerated-outputs.json) | 76 regenerated files against the base `a67b7c9a`: 68 identical, 6 kept at the base's bytes (one date, five last-bit arm64 values, D-9 of 1.1.0-rc.2's adoption), 2 regenerated; `tools/check-regenerated-outputs.py` checks it |
| [PRIVATE-STATE.md](PRIVATE-STATE.md), [private-state-review/](private-state-review/) | the compute bundle's and the AI runtimes' private-state review |
| [accuracy-refresh/](accuracy-refresh/) | both Swiss statistics runs on 1.1.0-rc.3: every statistic equals 1.1.0-rc.2's (aggregates only) |
| [tools/](tools/) | `regenerate.py` and its checker, the accuracy refresh and the MCP comparison, 1.1.0-rc.2's tools with their paths moved |

Also regenerated: the engine reference (sixteen entry points, `./de440`
among them), the engine bundle record (natal charts 34.6 KiB gzipped, 34.4
on 1.1.0-rc.2), the natal aspect examples, the scene snapshot, the four
independent-reference fixtures (engine version only; two kept at the base's
bytes, D-9) and their five pins, the conformance summary from `bc0b5a76`
(engine version only) and the conventions registry 2026-11-10 (161 ids in
60 namespaces, the DE440 set's four values among them).

MCP adapter 0.1.0-rc.27 bundles 1.1.0-rc.3: against rc.26 the same 278
calls, 10 of them refusals, and the tool list are equal apart from versions
and digests, and the conventions resource lists the seventh set
([../mcp-adapter/mcp-rc26-rc27.json](../mcp-adapter/mcp-rc26-rc27.json)). The
developer plugin is 0.3.32. Two defects the regeneration found are fixed: the
conventions resource read its sets by position, so the seventh, which the
engine appends last, had no writer and the read threw; and the hosted AI
tools' published output schemas had taken the compute API's wider `Backend`
schema, so they now keep the one they were published with
(`ASTRONOMY_ENGINE_BACKEND_SCHEMA`; `src/ai-tools/release-060.test.ts`).
Chart Studio's published panel is unchanged; its pin records the new source
build.

No programme unit is accepted here.
