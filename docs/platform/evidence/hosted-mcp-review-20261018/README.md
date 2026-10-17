# The hosted MCP tools, typed and reviewed (P3.6), 2026-10-18

P3.6's gate is that "MCP conformance tests and Inspector CLI pass against every
tool; the registry entry resolves". This record covers the first half for the
13 tools `https://zodiacs.org/mcp` offers in production: the server on, the
occasion tools on and accounts off. The registry entry needs the owner's
approval to publish and a verified `org.zodiacs` namespace, so it stays open.

The owner asked for the fix on 2026-10-18 (Asia/Bangkok), before the 0.5.0
resubmission.

## What the Inspector found

The 2026-10-09 review ran Inspector 2.10.1 against the six tools of 0.4.0 and
found 14 untyped parts across four of them. This review uses the same
Inspector, with `--strict`, against all 13 tools. Before this change it finds
3 errors and 29 warnings in production:

- **14 untyped parts.** Each came from one line in `src/ai-tools/contracts.ts`,
  `z.record(z.string(), z.unknown())`. Its `additionalProperties: {}` accepts
  any value without saying so. These were:
  - the receipt, the backend and the result of a calculation;
  - an instant's ΔT and time scale;
  - the capabilities' engine, limits, conventions and coverage.
- **3 errors, in the 0.5.0 tools.** A zod tuple writes `items: false`, which
  some clients do not take where they expect a schema object. These were the
  compared signs, a cusp's two signs and its ingress range.
- **15 warnings.** These are nullable values whose `type` is an array, such as
  `["string","null"]`.

## What changed

- **The compute API's values.** They carry the schemas the compute API
  documents for them in `/api/v1/openapi.json`, with each reference written
  out:
  - the receipt (`ComputeReceipt`) and the backend (`Backend`);
  - the events and sky-fact results (`EventsResult`, `SkyFactResult`);
  - ΔT (`DeltaT`) and the time scale (`TimeScale`).

  At run time each is still checked only as an object, as before. The server
  checks every result against its tool's schema before answering, so a field
  the API documents loosely can never make it refuse its own calculation.
- **The capabilities.** The limits get an exact type, and the conventions and
  coverage are maps of strings, as the receipts write them.
- **The three pairs** are two-item arrays.
- **Size.** `tools/list` grows by 33.7 KB: from 24.6 KB to 58.3 KB for the
  released tools, and from 73.6 KB to 107.3 KB with the occasion tools. The
  `initialize` answer, the resources and the capabilities answer are the same
  bytes as before (`src/ai-tools/accounts/flag-off.fixture.json`).
- **The packages.**
  - `integrations/packages/zodiacs-sky-0.5.0.zip` is unchanged: it carries no
    tool schemas, and a host reads them from the server.
  - `zodiacs-developer-0.3.13.zip` is rebuilt in place, because its local
    server carries the same contracts.

The 18 warnings left are all nullable `type` arrays: the 15 above, and the
receipt's `runtimeTzdb` in the three tools that carry one. That is legal JSON
Schema, the form some model providers recommend for nullable fields, as the
Inspector itself says. zod writes every nullable string or number this way,
even when it is spelled as a union, so it stays.

## Tests

`src/ai-tools/schema-types.test.ts` reads every tool's schemas as the MCP SDK
writes them: the 13 tools and the account-only save tool, input and output.

- **Typed throughout.** Every part states a type or another validation keyword.
  No bare `true` or `false` appears outside the four keywords where one is
  conventional. With the old contracts the test lists the 14 untyped paths,
  and with the old tuples the 3 bare `false` paths.
- **The compute values** are the API's own schemas for them, compared part for
  part.
- **41 calls** cover:
  - `get_capabilities`;
  - `get_sky` from 1800 to 2199, before, in and after the IERS era;
  - `get_upcoming_events` across four windows;
  - `check_sky_fact` for each kind, body and phase.

  Each result validates against its tool's advertised schema, as a client that
  validates checks it, and against the tool's own schema, as the server checks
  it.

`scripts/hosted-mcp-review.test.mjs` checks how the review sorts what the
conformance suite reports.

## The review

`scripts/hosted-mcp-review.mjs` runs the official tools at pinned versions:
Inspector 2.10.1 and the MCP conformance suite 0.1.16.

- **Listing.** The Inspector lists the tools with `--strict`, which exits 6 on
  any error.
- **Calls.** It calls each tool once with synthetic inputs. Each structured
  result must validate against the `outputSchema` its tool advertises.
- **Conformance.** The suite runs each of its 32 server scenarios on its own,
  and each is sorted:
  - **Passed.**
  - **Warnings only.** Nothing failed and nothing was confirmed.
  - **Not applicable**, for three reasons:
    - it needs a capability this server does not offer (logging, completions,
      prompts or resource subscriptions);
    - it calls the reference server's own test tools, prompts and resources;
    - it runs only against a localhost address.

    A scenario counts as not applicable only when it fails in the way its
    reason predicts.
  - **Failed.** This includes a scenario that recorded no checks, which did
    not run, and one that confirmed nothing and warned of nothing, which
    checked nothing. Codex's review found that the first had counted as
    warnings only.

  The pinned suite lists 32 server scenarios. A listing of any other number
  fails the review.
- **The rate limit.** Production answers 429 when one address calls it too
  often. A limited step is retried after a minute, so the limit slows a
  review but never decides it.

`.github/workflows/hosted-mcp-review.yml` runs the review on a pull request
that touches the AI tools, against that change's runtime served on the runner
(`scripts/serve-hosted-mcp.mjs`). Run by hand, it reviews a deployed endpoint.

### This change, served locally ([local/report.json](local/report.json))

This is `api/_ai/runtime.mjs` from this branch, with production's switches.

- **Inspector `--strict`** exits 0: no error, no untyped part, and the 18
  nullable `type` warnings.
- **All 13 tools** answered, each within its advertised `outputSchema`.
- **Conformance**: 0 of 32 failed.
  - **5 passed.** These are `server-initialize`, `ping`, `tools-list`,
    `resources-list` and `dns-rebinding-protection`: a foreign Host is
    refused. Its other check, that a local server accepts `localhost`, does
    not apply to a server that answers only for its own hostname.
  - **2 gave warnings only**: `server-sse-polling` and
    `server-sse-multiple-streams`. They recommend SSE resumability, which a
    stateless server does not offer.
  - **25 do not apply**: 10 need capabilities the server does not offer, and
    15 call the reference server's fixtures.

### Production before the change ([production-before/report.json](production-before/report.json))

The run was against `dpl_AmBueY8pexpXXyL1RYr4GxaeyKYf`, built from `ed5c0d3d`
([alias.json](production-before/alias.json)). The alias was the same before
and after it.

- **Inspector `--strict`** exits 6: 3 errors and 29 warnings, as above.
- **All 13 tools** answered within the schemas they advertised then.
- **Conformance**: 0 of 32 failed.
  - **4 passed**: `server-initialize`, `ping`, `tools-list` and
    `resources-list`.
  - **2 gave warnings only.**
  - **26 do not apply.** The suite runs `dns-rebinding-protection` only
    against a localhost address.
- **The rate limit.** Production limited the run four times, and each limited
  step passed when it ran again.

### Production after the deploy

To be recorded after the merge.
