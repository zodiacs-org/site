# Bounded live MCP-to-HTTP parity, 6 October 2026

**PASS.** A fresh extracted MCP rc.17 consumer agrees with the source-bound
production HTTP deployment in all five successful responses, including recovery
after a matching typed refusal. Exactly **six production compute attempts** and
**one short event search** were made, sequentially, with no retries or redirects.
The live run took place at **07:25:33.606–07:25:38.839 UTC** on Node v24.19.0.
This is cross-wrapper integration evidence, not independent astronomical accuracy,
scientific validation of astrology, a capacity measurement or a completeness proof.
No programme delivery credit is claimed. F-78 remains open.

## Access and deployment binding

The active `/etc/codex/network-policy.json` was read before any request. Both
owner-approved exact hosts were present: `zodiacs.org` and
`zodiacs-pqzrjq0ev-zodiacsofficial.vercel.app`. The environment also contained
generated `www.` variants. No variant was requested, and the opt-in runner rejects
them. The existing Package managers entries and all other policy settings were
left untouched. The owner-reported saved environment version is recorded in
[`preregistration.json`](preregistration.json); that Cloud UI version identity is
owner-provided, while the active policy host presence and its SHA-256 were observed
here. No access, credential, WAF, security or bypass setting was changed.

The first informational GET, the canonical manifest, returned 200 at 07:19:53 UTC:
[`01-manifest.json`](01-manifest.json). Production compute attempts were zero then.
The independently queried Vercel provider record at 07:20:34 UTC identifies:

| Item | Observed identity |
| --- | --- |
| Deployment | `dpl_6omXmaCaRgp4BXt9ZDBskx84262E` |
| State / target | `READY` / `production` |
| Immutable host | `zodiacs-pqzrjq0ev-zodiacsofficial.vercel.app` |
| Canonical alias | `zodiacs.org` |
| Repository / branch | `zodiacs-org/site` / `main` |
| Site source commit | `b1c42f199cea5c879afd1be3597666d43abf9653` |
| Site source tree | `52c81278e6bbfd944d4771f2012ff9bcd0dacda8` |
| MCP artifact source commit | `bd4d14484bf67df2de457a2cc0f1df7a825e7962` |
| Engine main commit | `782b4963a8575fa8d81c602a36285f65fb9ae9bb` |
| Engine artifact source commit | `aae419c05b77455b9e8f03ca11ee273b446f7d02` |
| Engine artifact carrier commit | `b080217c1b5b0b36c931e9c237bcff0308ec1efc` |
| Adapter / engine / ephemeris | `0.1.0-rc.17` / `0.1.1-rc.17` / `2.1.19` |

[`provider.json`](provider.json) contains selected nonsecret fields from the
read-only `vercel.get_deployment` call. [`source-proofs.json`](source-proofs.json)
records git trees, source/carrier/main ancestry, and exact equality between the
vendored engine archive and the carrier's git blob. The runner separately checks
site source inputs against the provider's commit and the MCP artifact's ancestry.

Three further informational GETs to the approved immutable host returned 200
at 07:21:01–07:21:02 UTC: its manifest, archive and OpenAPI. Their captured bodies,
status and bounded sanitized headers are retained as `02-*`, `03-*` and `04-*`.
The manifest matches the pinned source file, the archive matches the immutable
published file, and the served OpenAPI matches a fresh source build byte for byte.
All compute calls used that immutable host. A matching version string alone was
never treated as source binding.

| Bound bytes | Bytes | SHA-256 |
| --- | ---: | --- |
| Served MCP manifest | 731 | `5bf917ab2235887898d658ab94fa8260f7dfcba8dfeb9fc3436bdc711ac1536f` |
| Served MCP archive | 125262 | `e0f1f7a4035649dac0d2e18e22efd6c394e6b0d0f2377356784a3152b163a052` |
| Served and source-built OpenAPI | 369971 | `d47080a30766bdc08e9196230ac310bb9c5d47d1c6babe786c1c9d063f921a2e` |
| Vendored engine archive | 273123 | `9cd24c788863424ef614aaadec580db5a0dfc529303d385274db48a092a5299a` |
| Pinned HTTP compute bundle | — | `8130a75d1f24f26d42da614b0acc87c8aae6ab77caf4bb9d939e92c2bf538503` |
| Pinned HTTP local-time bundle | — | `6f9253009a83f84e755810ac5221eefd87811203e66aaef1933840be4e8571da` |
| Pinned source package lock | — | `5f817f4e3f08b52a4b82694dc33b1abd794c78e6f637938eade4557992fe5798` |

Full machine-readable pins and metadata binding are in [`pin.json`](pin.json)
and [`binding.json`](binding.json).

## Calls and results

| Attempt | Case / endpoint | HTTP | Verified behavior |
| ---: | --- | ---: | --- |
| 1 | `positions` / positions | 200 | J2000 Sun, Moon and Mars; schema, backend, receipt and citation digest; exact MCP parity |
| 2 | `short-lunation` / events | 200 | 1 lunation in 1–5 March 2026; membership and ordering; bounded sampling; `tested-not-proven` completeness |
| 3 | `date-depends` / sky-fact | 200 | Full-moon date returns `depends`, `any-zone-day`, null zone and a 50-hour window |
| 4 | `reference-edge` / sky-fact | 200 | Sun retrograde at 1800-01-01 returns `false` and preserves `outside-reference-span` |
| 5 | `invalid-civil-date` / positions | 400 | `invalid-request` at `/instants/0`; identical parser refusal sentence to MCP |
| 6 | `invalid-civil-date-recovery` / positions | 200 | Repeats attempt 1 exactly, including receipt digest, after refusal |

[`live/http.json`](live/http.json) retains every production attempt's bounded raw
body, status, headers, body hash and parsed value. The only normalization in success
parity is the documented exact `cite.url` substitution from the MCP tool anchor to
the corresponding HTTP endpoint anchor. Nothing else, including receipts and
digests, is normalized. Both HTTP and MCP successes were checked against the
source-bound OpenAPI response schema. The official MCP client also validates the
server's advertised output schemas.

The fresh consumer was extracted outside the checkout, inherited no ancestor
package or node_modules, installed its own shrinkwrap with `npm ci --ignore-scripts`,
and used its own locked MCP client 2.0.0. Actual child cwd/environment and SDK realpaths
were observed. Its package and NOTICE retain **MIT AND CC-BY-4.0**, with both required.
Its 21 packaged checks pass. [`live/mcp.json`](live/mcp.json) additionally records
six MCP cases, two parser refusals, explicit zone and eclipse refusals, recovery
after every refusal, and capability disclosures including no interruptible timeout.
No unsupported request was added to the production budget.

[`local-control/report.json`](local-control/report.json) is a new rc.17 loopback
control: six cases, two parser refusals and their recoveries, ten local HTTP calls,
zero production calls. Earlier published local evidence remains unchanged.
[`selftests.log`](selftests.log) records all **17 selftests passing**, retaining the
12 original tests and adding exact-host policy, source/served-byte binding, fixed
live budget/sequencing, stop-on-denial/error, and response-header privacy controls.
[`negative-controls.json`](negative-controls.json) preserves 32 explicit expected
rejections, including malformed/partial HTTP evidence and stale-output protections.

There were no unexpected live failures or access denials. One local source install
failed because npm's default cache was outside the writable roots; its exit 254
and log are preserved in `source-install-attempt-1.log`. A second install with a
`/tmp` cache succeeded (`source-install-attempt-2.log`). This was not a production
request, fallback route, credential change or sandbox escalation.

## Reproduction and review

From the site checkout, the following perform local checks only. Use a new output
directory; the runner intentionally rejects any existing output directory.

```bash
node --test scripts/mcp-independent-consumer.selftest.mjs
node scripts/mcp-independent-consumer.mjs \
  --pin docs/platform/evidence/mcp-live-parity-2026-10-06/pin.json \
  --archive docs/platform/evidence/mcp-live-parity-2026-10-06/03-archive.body \
  --out /tmp/zodiacs-rc17-review-CHOOSE-A-NEW-DIRECTORY
node scripts/programme-ledger.mjs --summary
```

From this evidence directory, verify captured artifacts without network access:

```bash
sha256sum -c SHA256SUMS
```

The actual live command already executed was:

```bash
node --use-env-proxy scripts/mcp-independent-consumer.mjs \
  --pin docs/platform/evidence/mcp-live-parity-2026-10-06/pin.json \
  --archive docs/platform/evidence/mcp-live-parity-2026-10-06/03-archive.body \
  --live-binding docs/platform/evidence/mcp-live-parity-2026-10-06/binding.json \
  --out docs/platform/evidence/mcp-live-parity-2026-10-06/live
```

The six-call production budget for this task is exhausted; independent review can
use the captured HTTP/MCP records and local reproduction above. A later live run
needs a new bounded task and fresh binding/evidence, rather than replaying this
dated snapshot as a new observation. No retry, alternate-route request, capacity,
quota, rate, load or exhaustion probe was made. Metadata bodies were limited to
1 MiB, compute bodies to 256 KiB, headers to 16 KiB; compute transport timeout was
10 seconds. Cookies and authorization response values are omitted from evidence.
`git diff --check` reports the observed trailing space in each captured HTTP/2
status line and the terminal blank header line. Those transport bytes are retained;
the runner, selftests, Markdown and remaining evidence pass the whitespace check.

Only the independent-consumer runner, its selftests and this new dated evidence
directory are changed. Runtime, frontend, Guide, CI, ledger, packages, released
archives and earlier evidence are unchanged. This isolated branch is unpushed,
pending the parent’s independent review.

Actual read-only `node scripts/programme-ledger.mjs --summary` output:
**Overall delivery: 33% (61 of 182.45); blocked 2% (3)**.
The full output is in [`programme-summary.log`](programme-summary.log).
