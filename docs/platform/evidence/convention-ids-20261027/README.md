# R44 in production: receipts and conformance vectors carry the registry's ids, 27 October 2026

R44's gate reads "registry published; receipts and conformance vectors use its
ids". The registry has been in production since 20 October
([conventions-registry-20261018](../conventions-registry-20261018/README.md)).
The engine 1.1.0-rc.1 adoption (#840) put the ids into the payloads:

- natal receipts, which the engine writes;
- the compute API's receipts, which the site writes;
- the conformance vectors, in suite 0.2.0.

The adoption's own record is
[site-engine-1-1-0-rc1](../site-engine-1-1-0-rc1/README.md). This folder
records the checks of what production serves since the merge. Times are UTC,
with Asia/Bangkok (ICT) where it helps.

## The merge and its deployment

- #840 merged on 27 October at 21:38 ICT (14:38:12Z) as `d698bc08`. It is a
  merge commit whose parents are main `59a9383c` and the head `2cd66f37`, and
  its tree is the head's tree, on which every CI check passed (26 jobs; the
  27th, the run for an edited pull request body, is skipped by design).
- Vercel built `dpl_9BVVN29Z2d8zWsiBUthJo1ytcePn` from the merge for
  production. It was READY at 14:45:58Z, and the zodiacs.org alias moved to
  it then.
- The alias was read through the Vercel connector before the deployment and
  before and after each check. Each read keeps only `deploymentId`,
  `aliasUpdatedAt`, `readyState`, `target` and `githubCommitSha`, and
  `recordedAt` is when it was written down:
  - [alias-before.json](production/alias-before.json): the deployment of
    `59a9383c`, before the merge's was ready;
  - [alias-at-merge.json](production/alias-at-merge.json),
    [alias-at-merge-after-e1-e3.json](production/alias-at-merge-after-e1-e3.json),
    [alias-at-merge-before-e2.json](production/alias-at-merge-before-e2.json)
    and [alias-at-merge-after-e2.json](production/alias-at-merge-after-e2.json):
    the merge's deployment, with the same `updatedAt` each time.

## Before the deployment

While the merge was building, production still served `59a9383c`:

- E3, the registry check below, ran against the merge: 5 of 12 passed
  ([conventions-before.json](production/conventions-before.json)). The seven
  that failed read the deployment or the ids:
  - the alias named a deployment without the merge;
  - the two new ids had no anchor, no link to their address and no entry for
    Chromium to land on;
  - registry.json and the Markdown twin served the 154 ids before them;
  - the sitemap's date for the page was the previous registry's.
- [served-before.json](production/served-before.json): registry.json held 154
  ids in 57 namespaces. registry.json, the OpenAPI document, the engine and
  MCP pages, `llms.txt` and the API's `llms.txt` named neither 1.1.0-rc.1 nor
  `conventionIds`. (A seventh path, `/support/engine/`, was a wrong guess and
  answered 404.)
- [positions-before.json](production/positions-before.json): the documented
  positions request was answered on engine 1.0.0, and its receipt had no
  `conventionIds`.

E2's tool was finished after the alias had moved, less than eight minutes
after the merge, so it has no run before the deployment. The two snapshots above
stand in for that run.

## E1: the engine adoption, 11 of 11

[`../site-engine-1-1-0-rc1/tools/verify-production.mjs`](../site-engine-1-1-0-rc1/tools/verify-production.mjs)
is 1.0.0's check, adapted. It reads its expected values from the merge
commit, and the alias read from a file. Its record is
[production-at-merge.json](../site-engine-1-1-0-rc1/production/production-at-merge.json):

- the engine, support and MCP pages and both llms files name 1.1.0-rc.1 as a
  release candidate npm does not carry, with npm's 1.0.0 beside it, and the
  pages give the archive's digest;
- the TypeDoc provenance names 1.1.0-rc.1, its source commit, its digest and
  its licence;
- the MCP manifest served is the merge's, and the rc.25 archive has its
  digest;
- the documented positions request is answered with `backend` and receipt
  engine 1.1.0-rc.1, and the receipt lists its ids.

## E2: the ids, 25 of 25

[`tools/ids-check.mjs`](tools/ids-check.mjs) is new, shaped like
`conventions-check.mjs`. It records only ids, statuses, counts and digests.
Its record is [ids-at-merge.json](production/ids-at-merge.json):

- registry.json is the merge's registry, every id with its address. It holds
  the two ids the merge added: the natal set's
  `conventionIds:zodiacs-conventions-registry;receipt-and-result;sorted-unique;in-receipt`
  and `flag:zone-history-disputed`.
- `/api/v1/openapi.json` requires `conventionIds` in both the calculation
  receipt and the compute receipt, and its request examples are the requests
  the check sends.
- Twelve receipts list their ids:
  - the documented chart (UTC and local) and houses (Koch) requests, and one
    synthetic polar chart (Svalbard, no person's data), whose Placidus falls
    back to whole sign and names `flag:polar-fallback`. Each receipt's ids
    are `natalConventionIds` of the receipt and its result, and, for the
    documented three, the documented answer's (`examples.json`);
  - the documented positions, events, time (pinned and gap), sky-fact (phase
    and aspect) and elections (London) requests. Each compute receipt lists
    the ids its own fields name, by the site's rule, and the documented
    answer's;
  - the hosted MCP server's `check_sky_fact` for the full moon of 26
    October, whose advertised output schema requires `conventionIds`. Its
    receipt is the compute API's for the same question, digest
    `fcde3856…451a4f` in both.

  Every id is registered, and each `cite.receipt` is the SHA-256 of its
  receipt's RFC 8785 canonical JSON. The receipts list 22 to 28 ids each, 46
  distinct ids in all. Those include the 18 ids of the "Coverage statements"
  and "Compute API receipts" groups, and the ephemeris id.
- The conformance page's Dataset is suite 0.2.0 and links its three
  `vectors/0.2.0/` files at engine commit `7e64717b`. Each file's SHA-256 is
  the summary's and the registry's (`4e45a526…`, `fc5321b9…`, `51a367f9…`).
  All 500 vectors list their kind and arbiter ids, sorted and registered.

The controls are:

- **`IDS_CHECK_CONTROL=dropped-id`**
  ([ids-control-dropped-id-at-merge.json](production/ids-control-dropped-id-at-merge.json))
  expects the registry without the natal set's id. 13 checks fail: the
  registry's equality and every receipt check, the hosted MCP's included. The
  other 12 pass. The control was written expecting only the four natal
  receipts to fail. But the compute receipts quote the engine's conventions
  set, this key included, as the registry's entry for the id says. So every receipt names the id, and
  every check that reads a receipt's ids fails without it.
- **`IDS_CHECK_CONTROL=suite-0.1.0`**
  ([ids-control-suite-0.1.0-at-merge.json](production/ids-control-suite-0.1.0-at-merge.json)):
  exactly the five conformance checks fail.
- **`local`** ([ids-local.json](production/ids-local.json)): the eleven
  requests go to the merge's bundled handler, `api/_compute/compute.mjs`,
  in-process. 14 of 14 pass. The served documents, the MCP server and the
  Dataset are not checked.

Four receipts are not byte for byte the documented ones, although their ids
are: chart local, time pinned, time gap and sky-fact aspect. Each names the
runtime's time zone data. Production's runtime reports 2026a
([runtime-tzdb.json](production/runtime-tzdb.json)), where `examples.json`
was written on 2026c. So the OpenAPI document's cite digests for those four
examples are not the ones production writes. This is outside R44's gate.

## E3: the registry, 12 of 12

`conventions-check.mjs` ran unchanged from
[conventions-registry-20261018](../conventions-registry-20261018/tools/conventions-check.mjs)
([conventions-at-merge.json](production/conventions-at-merge.json)). It
checks the following:

- each of the 156 ids has its anchor and its address, and Chromium opening
  the address lands on the id's entry;
- a made-up id's address lands on nothing;
- registry.json and the Markdown twin are the merge's registry;
- the developer index, the conformance page, `llms.txt` and the sitemap
  (with the registry's date) link to it.

With one id renamed, exactly the five checks that read the ids fail, 7 of 12
([conventions-control-renamed-id-at-merge.json](production/conventions-control-renamed-id-at-merge.json)).

## The next deployment, 28 October

The next production deployment came from the daily sky commit `457ad878`,
whose parent is the merge. It changes the day's sky and horoscope editions,
the registry's research and market data and the twelve registry sign pages,
none of which the checks read. Vercel built it as
`dpl_ErxbAH1Qp8jfhqWVKY3w6CDKpet1`, READY at 00:16:41Z (07:16 ICT), when
the alias moved to it. The alias was read before and after the checks, and
named that deployment with the same `updatedAt` both times
([alias-later-before.json](production/alias-later-before.json),
[alias-later-after.json](production/alias-later-after.json)).

Each check ran again there, with its controls:

| Report | Passed |
| --- | --- |
| E1, [production-later.json](../site-engine-1-1-0-rc1/production/production-later.json) | 11 of 11 |
| E2, [ids-later.json](production/ids-later.json) | 25 of 25 |
| E2 without the natal set's id, [ids-control-dropped-id-later.json](production/ids-control-dropped-id-later.json) | 12 of 25 |
| E2 on suite 0.1.0, [ids-control-suite-0.1.0-later.json](production/ids-control-suite-0.1.0-later.json) | 20 of 25 |
| E3, [conventions-later.json](production/conventions-later.json) | 12 of 12 |
| E3 with one id renamed, [conventions-control-renamed-id-later.json](production/conventions-control-renamed-id-later.json) | 7 of 12 |

Each control fails the same checks as at the merge. The reports record the
same SHA-256 digests as at the merge for:

- registry.json and the registry's page and Markdown twin;
- the conformance page and its three vector files;
- all eleven receipts and the hosted MCP server's, each with the same ids;
- in E1, the engine, support and MCP pages, both llms files, the TypeDoc
  provenance and the MCP archive.

One digest differs: the OpenAPI document's, because it names the day's data
("Data as of 2026-10-28"). With that date set back to 2026-10-27, its
SHA-256 is the one served at the merge, `85bb125b…`.

## What this does not establish

- Other receipts and request forms. The check sends the documented requests
  and one polar chart, not every form a client can send. The local MCP
  adapter's own receipt (`zodiacs.mcp-receipt.v1`, for `search_places`)
  states no convention and lists no ids. The static sky files carry no
  receipts.
- Where the vectors live. The check reads the files the Dataset links, on
  raw.githubusercontent.com at engine commit `7e64717b`. zodiacs.org does not
  host them.
- A portal rescan. The hosted `tools/list` changed (the compute receipts'
  schemas and Chart Studio's address), so the AI portals' copies stay stale
  until they scan again. That is the owner's call.
- Readers of new records. As the adoption's record says, npm's 1.0.0 and the
  earlier archives refuse the records the site now writes.
