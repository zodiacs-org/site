# Independent review fixes, 2026-10-05

Source commit `40a37b52ea08a17f1512fd7ec48a71211204eaf9` addresses the two
independent review findings on the additive runner and selftests. Previous
review commit `1004eb2b1b6d4ac1e1c914c55e90a7e88c016b10`, its evidence and its
checksum index remain unchanged. This directory records a separate Node
22.22.2 / npm 10.9.7 run against the same pinned archive, source HTTP bundle
and OpenAPI bytes. No existing runtime, frontend, package/lock, CI, ledger,
runner or engine files changed.

HTTP capture now saves a request record before fetch, then actual status and
bounded headers before reading the body. Bounded body text and its captured
SHA-256 are saved before JSON parsing. Parse, fetch and interrupted body
failures retain the failure stage/type/message, available response metadata
and partial received bytes; they never invent a parsed result. Captured body
and header limits are 262,144 and 16,384 bytes respectively. Exceeding a
limit explicitly records truncation and stops the check. These are evidence
size guards, not load or quota probes.

Main mode now atomically creates a new output directory. Any existing path,
including an empty directory or symlink, fails before writing evidence.
Nothing is silently deleted. Its parent directories may be created normally.
Reproduction must select a new directory each time.

The 12 selftests pass and capture 18 typed, message-checked rejections. The
new controls preserve malformed JSON and non-JSON text alongside earlier
HTTP records, retain fetch and partial-body failures, test the explicit size
guards, and invoke both the directory helper and actual CLI against stale
MCP/HTTP/report evidence plus an unrelated file. Original file bytes remain
identical. Synthetic response/transport controls use injected fetch behavior
and make no network calls. A prototype-only comparison in the initial local
test attempt was corrected to compare the JSON-persisted representation;
the final recorded test run passes.

The fresh consumer passes all four stages, 21 packaged verify checks, six
parity cases, two shared refusals, four MCP recoveries and two HTTP
recoveries. Its 10 actual HTTP records all parse successfully and retain
bounded raw evidence. Existing targeted tests pass 56/56. Syntax checks,
the three source-bundle checks, protected-scope and ledger checks, historical
and new checksum indexes and whitespace checks pass. `gates.json` binds the
exact commands and source hashes. Only trailing blank lines were removed
from the new targeted-test transcript for whitespace checks.

`report.json`, `mcp.json`, `http.json` and the logs preserve the actual new
run. `review-summary.json` also retains independently observed consumer/server
cwd and environment, source hashes and result counts. The OpenAPI hash was
verified again; its identical full bytes remain at `../../openapi.json`.
The pinned input remains at `../../pin.json`. Log paths inside raw reports
identify the actual scratch run; copies are retained in this directory.

```sh
# Put the verified Node 22 distribution's bin first on PATH.
CONSUMER_REVIEW_ROOT="$(mktemp -d /tmp/zodiacs-consumer-review-XXXXXX)"
ZODIACS_NEGATIVE_CONTROL_OUT="$CONSUMER_REVIEW_ROOT/negative-controls.json" \
  node --test scripts/mcp-independent-consumer.selftest.mjs
node scripts/mcp-independent-consumer.mjs \
  --pin docs/platform/evidence/mcp-independent-consumer-2026-10-05/pin.json \
  --archive public/examples/zodiacs-mcp-server-0.1.0-rc.16.3.tgz \
  --out "$CONSUMER_REVIEW_ROOT/consumer"
node node_modules/vitest/vitest.mjs run scripts/mcp-artifact.test.mjs \
  tests/api/compute-api-bundle.test.ts tests/api/compute-api-openapi.test.ts
node scripts/programme-ledger.mjs --summary
```

There were zero live HTTP compute requests, pushes, PRs, merges, access
changes, paid services, external messages or private birth inputs. Live
deployment parity remains inconclusive. Loopback rate limiting is an explicit
allowed fixture and supplies no production firewall/quota evidence. Full
Astro/build/browser/audit/CI gates were not rerun: these files do not enter
the application graph and existing prebuild rewrites protected generated
surfaces outside this lane. No release acceptance is claimed.

Both MIT AND CC-BY-4.0 and NOTICE remain. Prior astronomical/conformance and
resource observations, including the diagnosed original pack failure, remain
preserved. Cross-wrapper equality is integration evidence only. The actual
read-only ledger summary remains `Overall delivery: 32% (58 of 182.45);
blocked 2% (3)`; no delivery credit was granted.
