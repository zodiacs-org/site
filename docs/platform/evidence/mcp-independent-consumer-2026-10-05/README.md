# Pinned MCP archive consumer against source-bound HTTP, 2026-10-05

**PASS for the local integration seam. Live parity is inconclusive. No
delivery credit is claimed.** The new runner downloads the pinned archive,
installs its shrinkwrap in a fresh consumer outside the checkout, runs its
unchanged `verify.mjs`, then compares its stdio sky tools with an actual
loopback HTTP server over the committed compute bundle. It uses the official
MCP client and its advertised-output-schema validation. It does not implement
a second protocol driver.

This is integration evidence. The two wrappers share calculation code. Their
agreement establishes neither independent astronomical accuracy nor astrology
prediction validity, search completeness, production deployment parity,
production rate-limit behavior, privacy guarantees, or assistant-host support.

## Source identities and scope

The saved environment initially contained site `550c6768`. A fresh fetch on
2026-10-05 found site main `51b64f3cb67c2026a18772297ec6b367ed2ca183`, the
merge of election-search PR #655. The isolated branch is
`codex/mcp-independent-consumer-2026-10-05`, based on that commit. Engine main
was separately fetched and remained
`23660f509fd9552d596966419fc982544fe06019`. It is not the vendored engine's
release identity; the vendored archive is pinned separately below.

Read: `AGENTS.md`, `CLAUDE.md`, programme `HANDOFF-2026-09-30.md` §§6–7,
`STATUS.md`, engine `AGENTS.md`, and the relevant source/test/packaging files.
The two repository-local `.agents/skills` concern visual design and are not
applicable to this runner. No platform/engine/frontend development was taken
over. This change adds only a runner, its selftests and this dated evidence.
No existing source, runtime, runner, package, lockfile, CI or ledger is changed.

| Independent binding | Exact pin |
| --- | --- |
| MCP archive source | `dcb51a1669f78de7942930d9b72479e3450b3edb` |
| MCP adapter | `0.1.0-rc.16.3`, unpublished candidate |
| Archive bytes | 124924 |
| Archive SHA-256 | `dde8e475a43d1ef9f7563281996aef8a4f53d89b99d5c387ba708f8878e034a4` |
| Manifest SHA-256 | `e6a2ee81b6b97ed7c12ba50867a20fd9bb2ca483f17adc3d7351734ffeb4defe` |
| Bundled server SHA-256 | `a59382d0fbe5b3f9afc9ff788ce92a1dd406a3ef2c59d98d77a41c7e0f598312` |
| Engine archive SHA-256 | `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8` |
| Engine / ephemeris | `@zodiacs/engine 0.1.1-rc.16` / `astronomy-engine 2.1.19` |
| HTTP source | `51b64f3cb67c2026a18772297ec6b367ed2ca183` |
| HTTP source tree | `21a259f71e0796dcc6e282d29fecfd4215910442` |
| Committed HTTP bundle SHA-256 | `662dd5105a5ee65bd058e28b01397a9e19d04a9d9e33fe0cdeb0c311332ccef1` |
| OpenAPI bytes / SHA-256 | 369971 / `911e663d40aa63c17f868a517f2cbb4a591e304fac077851003a42747ecb16c2` |
| Live HTTP source / deployment | Unestablished; no live HTTP request made |

[pin.json](pin.json) fixes these identities; it does not follow a mutable
manifest during execution. The runner checks the source inputs against the
pinned Git commit, requires the archive source to be its ancestor, checks the
manifest hash, downloads the immutable raw GitHub archive, and checks its hash
and length **before extraction**. The OpenAPI bytes come from the existing
`buildSkyApi` publication builder at the pinned source; no schema or API
version is inferred from the MCP version. Old rc.16.2 pins were superseded by
fresh main, not treated as equivalent.

## Why this is additional coverage

Existing coverage was inspected before adding this check:

- [tests/mcp-protocol-drive.mjs](../../../../tests/mcp-protocol-drive.mjs)
  launches the repository's `examples/mcp-server/server.mjs`, uses the client
  from checkout dependencies, and owns protocol negotiation/malformed-wire
  coverage. Its fixed server and evidence paths are unchanged.
- [src/mcp/sky-tools.test.ts](../../../../src/mcp/sky-tools.test.ts)
  compares MCP with the handler through `InMemoryTransport` and the in-process
  HTTP harness, over 252 seeded cases and additional edge/refusal cases. It
  does not extract/install the pinned archive or send TCP HTTP requests.
- [src/mcp/outputs.test.ts](../../../../src/mcp/outputs.test.ts) covers schema
  matrices; [scripts/mcp-artifact.test.mjs](../../../../scripts/mcp-artifact.test.mjs)
  covers archive/manifest contents, source bundle equality, examples and the
  checkout bundle's verifier.
- [The rc.16.3 adapter record](../mcp-adapter/README.md#010-rc163-2026-10-05)
  records 106 protocol checks, host/benchmark checks and a fresh extraction's
  21 verifier checks. The fresh extraction was not compared with HTTP.

These are useful existing checks. The missing combination was the downloaded
archive's independently installed stdio consumer against source-bound HTTP.
The packaged verifier is reused unchanged. Low-level protocol probing stays
with the existing protocol driver.

## Results

The final runner's SHA-256, exact source/package pins, SDK resolution paths,
timestamps, scratch directory and outcomes are in [report.json](report.json)
and [mcp.json](mcp.json). Runtime: Node `v24.19.0`, npm `11.9.0`, locked client
`2.0.0`. The consumer was created below `/tmp`, with no ancestor `package.json`
or `node_modules`; its SDK resolves inside its own installed directory.
`npm ci --ignore-scripts --no-audit --no-fund` installed 14 packages, preserved
the shrinkwrap hash, and did not link checkout dependencies. Application
credentials and Node preload/module-path variables are not passed to it;
platform proxy/CA settings are retained for normal registry access.

| Check | Result |
| --- | --- |
| Download hash/size, manifest and source guards | PASS |
| Both archive licences and NOTICE | PASS: `MIT AND CC-BY-4.0` retained |
| Packaged `verify.mjs` | 21/21 checks passed; [log](packaged-verify.log) |
| Advertised six tool schemas and annotations | PASS; actual declarations retained in `mcp.json` |
| Adapter/engine/ephemeris versions and capability citation | PASS |
| Six fixed parity cases below | 6/6 PASS, MCP output and HTTP 200 schemas checked |
| Two shared parser refusals | 2/2 PASS, HTTP 400 and exact pointer/message agreement |
| Unsupported zone and eclipse event kind | Both refused; original messages retained |
| Valid positions request after each MCP refusal | 4/4 PASS |
| Valid positions request after each shared HTTP refusal | 2/2 PASS |
| Negative-control selftests | 8/8 PASS, including all six requested controls; [log](selftests.log) |
| Existing compute/MCP/OpenAPI targeted tests | 56/56 PASS; [supporting checks](supporting-checks.log) |
| Existing compute, local-time and MCP bundle source checks | PASS |
| Existing archive repack check under npm 11.9.0 | **FAIL**, retained below |

| Fixed synthetic case | Observed behavior, identical beyond the citation URL |
| --- | --- |
| Positions at `2000-01-01T12:00:00Z` | Sun, Moon and Mars rows; backend and receipt present |
| Moon lunation, `2026-03-01`–`2026-03-05` | One full moon, in the requested window; receipt says `tested-not-proven` |
| Sun retrograde at the same instant | `false` |
| Sun in Capricorn at the same instant | `true` |
| Full moon on unzoned `2026-03-03` | `depends`, `any-zone-day`, null zone, 50-hour window |
| Sun retrograde on unzoned `1800-01-01` | `false`, with `outside-reference-span` |

The independently written canonical-JSON/SHA-256 implementation recomputes
each carried receipt's citation. Exact digests are in the report's case
matrix. Both sides' citation URLs are checked against their exact documented
anchors before substituting that field alone for equality. No number,
receipt field, completeness label, version, time basis, search sample count,
coverage flag or digest is masked.

[http.json](http.json) retains response status, headers, exact response text,
parsed values and requests; [mcp.json](mcp.json) retains declarations,
capabilities, structured values, refusal messages and recovery values.
[openapi.json](openapi.json) retains the exact source-built publication bytes.
There were **10 sequential local HTTP requests, zero live compute requests**.
The loopback fixture uses real `IncomingMessage`/`ServerResponse` and mirrors
the route rewrite into the committed handler. Its rate-limit dependency is
the explicit test verdict `allowed`; no production security/configuration
change or rate-limit/exhaustion test occurred.

The negative controls reject altered archive bytes, stale adapter/engine
versions, a missing receipt, an invalid citation digest, lost `depends` even
when both wrappers agree on the incorrect answer, and inflated completeness
even when both wrappers recompute their citations over the altered receipt.
Additional controls check canonical digest bytes and forbid hiding arbitrary
result differences or accepting an arbitrary citation URL. They import the
same guards used in the runner and require the expected failure, not just
any thrown error.

## Failures and limits preserved

- On this environment, the first source `npm ci` failed because its default
  cache `/home/agent/.npm/_cacache` was outside the writable paths. A normal
  rerun with `--cache /tmp/zodiacs-consumer-npm-cache` succeeded. No dependency
  integrity, manifest or lockfile was bypassed or changed.
- Native Node `fetch` initially failed when downloading the raw archive
  through the environment's network setup. The runner uses standard `curl`
  with the platform's proxy/CA configuration, bounded download time/size, and
  the same mandatory pre-extraction digest guard. The final default download
  succeeded; no alternative archive identity was accepted.
- `npm_config_cache=/tmp/zodiacs-consumer-npm-cache node
  scripts/pack-mcp-server.mjs --check` reported
  `public/examples/zodiacs-mcp-server-0.1.0-rc.16.3.tgz differs from a fresh pack
  of examples/mcp-server`. This existing gate failed under npm 11.9.0. Its
  cause is not established here. The immutable archive was not overwritten,
  repacked for distribution or retuned to this npm version. Its pinned bytes,
  extracted server and installed behavior passed. Exact repack reproducibility
  remains unverified in the candidate's original Node/npm environment.
- The root site declares Node 22.x; this saved environment provides Node
  24.x. Source installation emitted `EBADENGINE`; the narrow checks above
  ran successfully on Node 24.19.0, which the MCP package supports. Full site
  Node-22 CI, Astro build/check and frontend/browser gates were not run and
  are not claimed. No existing runtime/frontend file changed.
- Local transport parity does not establish a matching live deployment. No
  live source binding was established, so live parity remains inconclusive.
- The search remains `tested-not-proven`. Unsupported sidereal/eclipse work
  and partial Track A acceptance remain as in STATUS. The existing physical
  declination failure F-08, Koch/shared-UT1 owner decision F-71, Moon
  enclosure failed/partial records and other independent accuracy failures
  remain untouched. This runner is not their oracle or resolution.
- Fresh main's [F-78](../../programme/FINDINGS.md#f-78--on-engine-rc16-one-address-can-cost-more-than-the-10-cpu-seconds-a-minute-the-compute-apis-limits-allow-major-cost)
  preserves 10.7 CPU-seconds/minute and earlier 12.8/13.2 runs against the
  ceiling of 10. No load, limit, capacity, firewall or quota probe was run.
- No credentials, external messages, paid services, access changes, private
  birth data, raw Swiss values or restricted packs were used or added.

## Reproduction and review

From a checkout containing the new files with the protected inputs still at
the pinned commit (Git history must include the archive source commit):

```sh
npm ci --cache /tmp/zodiacs-consumer-npm-cache --ignore-scripts --no-audit --no-fund
node --test scripts/mcp-independent-consumer.selftest.mjs
node scripts/mcp-independent-consumer.mjs \
  --pin docs/platform/evidence/mcp-independent-consumer-2026-10-05/pin.json \
  --out /tmp/zodiacs-consumer-reproduction
node scripts/programme-ledger.mjs --summary
```

The default command downloads the archive from its immutable source URL.
`--archive /absolute/path/to/candidate.tgz` permits an already downloaded
archive with exactly the same pinned hash/length. Results go to the specified
output directory. The consumer scratch remains under `/tmp` for inspection;
neither the archive nor `node_modules` is copied into this evidence directory.
Use a new output directory to preserve earlier attempts. On failure the report
and available MCP/HTTP answers are retained, the command exits nonzero, and
no further HTTP calls are made.

Supporting reproducible commands and their recorded outcomes are in
[supporting-checks.log](supporting-checks.log). [programme-summary.log](programme-summary.log)
is actual read-only output of `node scripts/programme-ledger.mjs --summary`:

```text
Overall delivery: 32% (58 of 182.45); blocked 2% (3)
```

58/182.45 is 31.790% to three decimals. No delivery acceptance, denominator,
gate or finding disposition was changed. The local commit is for independent
parent review; no push, PR or merge was performed.
