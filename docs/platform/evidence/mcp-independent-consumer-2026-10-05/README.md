# Pinned MCP archive consumer against source-bound HTTP, 2026-10-05

**PASS for this local integration seam on Node 22.22.2/npm 10.9.7. Live parity
is inconclusive. No delivery credit is claimed.** The runner installs the
pinned archive outside checkout dependencies, reuses its unchanged verifier
and official MCP client, and compares its stdio sky tools against real
loopback HTTP requests to the source-bound compute bundle.

Both wrappers share calculation code. Their agreement is integration
evidence, not independent astronomical accuracy, astrology prediction
validation, search completeness or production deployment evidence.

The original Node 24 run and first repack failure remain in this directory's
root files and in commit `9d8586232891463ba4dd049d724de1da094c4346`. Final-source
Node 22 results are under [node22/](node22/). The source-only review checkpoint
is `06b44ca482061d59a51faa9f1deb539fa8da3b59`; the evidence commit is reported
separately to avoid a circular self-pin.

## Scope and the missing seam

Fresh site main was `51b64f3cb67c2026a18772297ec6b367ed2ca183` (merged #655),
not the saved `550c6768`. Separately fetched engine main remained
`23660f509fd9552d596966419fc982544fe06019`; it is not the vendored engine's
release identity. Branch: `codex/mcp-independent-consumer-2026-10-05`.
Repository instructions, HANDOFF §§6–7, STATUS and relevant source/tests
were read. Local `.agents/skills` concern visual design and do not apply.

Only the new runner, its selftests and dated evidence changed. No owner
source, engine, runtime, frontend, existing runner, package, lock, CI or
ledger changed. Nothing was pushed, published or merged. This is
agent-authored test tooling, not a human/customer trial.

Existing coverage was inspected before implementation:

- [Protocol driver](../../../../tests/mcp-protocol-drive.mjs): repository
  server and checkout client; owns low-level protocol probing, unchanged.
- [Sky-tools tests](../../../../src/mcp/sky-tools.test.ts): 252 seeded cases
  through in-memory MCP and in-process handler parity, not installed archive/TCP.
- [Output matrices](../../../../src/mcp/outputs.test.ts) and
  [artifact tests](../../../../scripts/mcp-artifact.test.mjs): schemas,
  manifests, source bundles and examples, including the checkout verifier.
- [Adapter evidence](../mcp-adapter/README.md): the rc.16.3 fresh extraction
  ran its verifier, but was not compared with HTTP.

The uncovered combination is an independently installed archive process
versus source-bound HTTP. The new runner reuses `verify.mjs` and the SDK;
it does not duplicate the existing wire-protocol driver.

## Independent bindings

[pin.json](pin.json) is fixed. Different MCP/API versions are never silently
accepted as equivalent, and execution does not follow a mutable manifest.

| Binding | Exact value |
| --- | --- |
| Archive source | `dcb51a1669f78de7942930d9b72479e3450b3edb` |
| Adapter | `0.1.0-rc.16.3`, unpublished candidate |
| Archive bytes / SHA256 | 124924 / `dde8e475a43d1ef9f7563281996aef8a4f53d89b99d5c387ba708f8878e034a4` |
| Manifest SHA256 | `e6a2ee81b6b97ed7c12ba50867a20fd9bb2ca483f17adc3d7351734ffeb4defe` |
| Extracted server SHA256 | `a59382d0fbe5b3f9afc9ff788ce92a1dd406a3ef2c59d98d77a41c7e0f598312` |
| Engine / ephemeris | `@zodiacs/engine 0.1.1-rc.16` / `astronomy-engine 2.1.19` |
| Engine archive SHA256 | `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8` |
| HTTP source | `51b64f3cb67c2026a18772297ec6b367ed2ca183` |
| HTTP source tree | `21a259f71e0796dcc6e282d29fecfd4215910442` |
| HTTP bundle SHA256 | `662dd5105a5ee65bd058e28b01397a9e19d04a9d9e33fe0cdeb0c311332ccef1` |
| OpenAPI bytes / SHA256 | 369971 / `911e663d40aa63c17f868a517f2cbb4a591e304fac077851003a42747ecb16c2` |
| Live source / deployment | Unestablished; zero live compute requests |

The first run downloaded the immutable raw GitHub URL in `pin.json`, checking
hash/length before extraction. The Node 22 retake used identical cached bytes,
again checking both. Source inputs are checked against the HTTP Git commit;
the archive source must be its ancestor. OpenAPI is separately pinned output
of the existing `buildSkyApi` builder at that source; exact publication bytes
are retained in [openapi.json](openapi.json). Backend, receipt and citation
versions are checked. Equality permits only the independently checked
`cite.url` difference; no numbers, digests or metadata are masked.

## Results and consumer isolation

Site CI specifies Node 22; root engines specifies 22.x. It does not pin an
exact npm version. The candidate records Node 22.22.2. Its official Linux
x64 distribution was verified against the
[official checksum list](https://nodejs.org/download/release/v22.22.2/SHASUMS256.txt):
31065656 bytes, SHA256
`88fd1ce767091fd8d4a99fdb2356e98c819f93f3b1f8663853a2dee9b438068a`.
Bundled npm: 10.9.7. See [runtime.json](node22/runtime.json).

| Final-source check | Result |
| --- | --- |
| Fixed parity corpus | 6/6 PASS |
| Packaged verifier | 21/21 PASS |
| Shared parser refusals / HTTP recovery | 2/2 / 2/2 PASS |
| Unsupported zone/eclipse kind / MCP recovery | Refused / 4/4 PASS after all refusals |
| Selftests / captured exact rejections | 8/8 PASS / 11 |
| Existing targeted tests | 56/56 PASS: artifact 46, bundle 5, OpenAPI 5 |
| Compute/local-time/MCP source-bundle checks | PASS |
| Scope / ledger / syntax / whitespace checks | PASS |
| Node 22 local / live HTTP requests | 10 sequential / 0 |

Fixed cases: Sun/Moon/Mars positions at 2000-01-01 12:00 UTC; one Moon
lunation in a four-day March 2026 window; Sun retrograde false; Sun in
Capricorn true; unzoned full-Moon date `depends` in a 50-hour window; and an
1800 date retaining `outside-reference-span`. Search remains `tested-not-proven`.
Shared refusals are an invalid civil date and a reversed event window, with
exact HTTP/MCP pointer-message agreement. Every carried citation digest is
independently recomputed using the new canonical-JSON/SHA256 implementation.

[Node 22 report](node22/report.json), [MCP](node22/mcp.json) and
[HTTP](node22/http.json) retain source/code pins, declarations, exact replies,
headers, digests, refusals and recoveries. [Review summary](node22/review-summary.json)
is a compact index. Original Node 24 evidence remains unchanged.

The actual install, worker and server cwd was
`/tmp/zodiacs-mcp-consumer-U2r9GM/package`, outside the checkout
`/workspace/mcp-consumer-review`. Standard
`npm ci --ignore-scripts --no-audit --no-fund` installed 14 locked packages
there. Its unchanged `npm-shrinkwrap.json` has SHA256
`4c30e34d30f64f4a7255aafb67a00f7277ce51d7578f41d6225f82a98c9b4759`.
The source lock is separately hashed in the report.

The copied worker imports only builtins at startup. It resolves the two SDK
entrypoints relative to the extracted package and checks realpaths inside its
own `node_modules`, then imports absolute file URLs. Every consumer ancestor
was checked for `package.json` and `node_modules`: none existed. `NODE_PATH`
and `NODE_OPTIONS` were absent. Node resolution walks ancestors of those
files, not the unrelated checkout. The independent
[installed-tree observation](node22/consumer-install-tree.json) records all
14 unique package paths inside the consumer, including transitive dependencies.

Absolute Node/server paths and explicit cwd/env launch the server. Read-only
`/proc/2971/cwd` and `/proc/2971/environ` confirmed its actual cwd and exact
expected environment. Keys: PATH (official Node 22 bin first; no checkout bin),
TMPDIR=/tmp, LANG=C.UTF-8, NODE_ENV=development,
npm_config_cache=/tmp/zodiacs-consumer-npm-cache, npm_config_userconfig=/dev/null,
and platform HTTP/HTTPS proxy, NO_PROXY and CA settings. Network values are
omitted from evidence. No application credential, home config, preload hook
or module-path variable was inherited. `mcp.json:isolation` retains configured
and actual process evidence; these conditions are asserted.

[Negative controls](node22/negative-controls.json) retain exact assertions,
expected messages and actual `ERR_ASSERTION` messages. Required failures begin
`archive SHA-256`, `backend version`/`MCP handshake version`, `missing receipt`,
`citation digest`, `date-depends: answer` and `search completeness`. Stale-engine
and lost-depends controls alter both wrappers; inflated completeness alters
both and recomputes their citations. The collector rejects any wrong failure
type/message. Extra controls cover size, non-finite JSON, result differences
and incorrect citation URLs. Counts alone are not the evidence.

## Repack failure diagnosis

The first npm 11.9.0 failure remains in [supporting-checks.log](supporting-checks.log).
The saved worktree also fails under Node 22.22.2/npm 10.9.7. Its umask is 0077
and all seven source files have mode 0600, whereas the released tar has 0644.
All seven payloads match source byte-for-byte.

Both npm versions produce the same diagnostic 0600 archive: 124922 bytes,
SHA256 `032992f181a265c06f32d7354fac7fed2fbad68af5f29f1b55efd7efa56ca427`.
The uncompressed tar differs in 22 bytes: mode fields and header checksums
only. Payloads, order, names, sizes, uid/gid and timestamps match.

A separate pinned `git archive` export extracted under /tmp with umask 022
retained Git's 0644 modes. After normal locked `npm ci`, the unchanged
`pack-mcp-server.mjs --check` passed under both Node 22/npm 10 and Node 24/npm
11, reproducing the exact released 124924-byte archive. See
[full comparison and outputs](node22/repack-diagnosis.json).

No archive, lock, owner-file contents or owner-file permissions changed.
Diagnostic packs stayed temporary and were not distributed. This establishes
an environment file-mode mismatch, not payload drift or an npm-major defect.
The unmodified gate still fails in the original 0600 worktree.

## Gate limits and reproduction

These additive files enter no application/runtime/frontend import graph and
change no dependency or CI configuration. Necessary local gates were Node 22
syntax/selftests, isolated consumer execution, schema/digest checks,
source-bundle equality, archive reproduction diagnosis, relevant existing
tests, protected scope, ledger and whitespace checks. Full Astro build/check,
browser drives, dependency audits and the complete site CI matrix were not
run or claimed. Existing `prebuild` rewrites public generators; such existing
runtime/frontend work is outside this lane. Full site gates remain required
before separately authorized publication/merge; no release acceptance follows.

The loopback fixture uses actual HTTP streams but explicitly supplies
`rateLimit: allowed` and mirrors the rewrite. It proves no production
firewall/quota behavior. Live source binding is absent, hence inconclusive.
No additional live compute requests, load probes, access changes, private
birth data, raw Swiss outputs, restricted packs or paid services occurred.
`MIT AND CC-BY-4.0` and NOTICE survive. F-08/F-71 accuracy failures/decisions,
Moon-enclosure failed/partial records and F-78's 10.7/12.8/13.2 observations
remain untouched.

```sh
# Put the verified official Node 22 distribution's bin first on PATH.
npm ci --cache /tmp/zodiacs-consumer-npm-cache --ignore-scripts --no-audit --no-fund
ZODIACS_NEGATIVE_CONTROL_OUT=/tmp/negative-controls.json \
  node --test scripts/mcp-independent-consumer.selftest.mjs
node scripts/mcp-independent-consumer.mjs \
  --pin docs/platform/evidence/mcp-independent-consumer-2026-10-05/pin.json \
  --archive public/examples/zodiacs-mcp-server-0.1.0-rc.16.3.tgz \
  --out /tmp/zodiacs-consumer-reproduction
node scripts/programme-ledger.mjs --summary
```

Omit `--archive` to download the immutable URL; supplied archives must match
hash/length. Use new output directories to preserve attempts. Failure retains
available reports/replies, exits nonzero and stops HTTP calls. Linux records
actual child cwd/env; other platforms retain configured launch evidence.
Initial cache/native-fetch setup failures remain in the first review commit;
no identity or lock integrity was bypassed.

For pack diagnosis, export the pinned source into a new scratch directory:
`git archive 51b64f3cb67c2026a18772297ec6b367ed2ca183 | (umask 022; tar -x -C DIR)`;
run locked `npm ci` and unchanged `node scripts/pack-mcp-server.mjs --check`
there. Leave owner files and immutable artifacts untouched.

Actual read-only [programme-summary.log](programme-summary.log):
`Overall delivery: 32% (58 of 182.45); blocked 2% (3)`.
58/182.45 = 31.790% to three decimals. No ledger credit was added.
