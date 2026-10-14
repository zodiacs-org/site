# Aspect facts in the compute API and check_sky_fact (A1.b), 2026-10-12

The brief's Track A1 asks `check_sky_fact` to take "a position, a date, an
aspect, a retrograde". Until this change it took a sign, a retrograde, an
ingress and a lunar phase. This adds `kind: "aspect"` to
`POST /api/v1/sky-fact`, and so to `check_sky_fact`, which runs the compute
API's own parser and calculation.

## What it answers

- A request names a `body`, an `other` body (one of the same ten, the Sun to
  Pluto, and not the body itself) and an `aspect`: `conjunction`, `sextile`,
  `square`, `trine` or `opposition`. It takes an `instant`, or a `date` with an
  optional `zone`, as the sign and retrograde facts do. The MCP adapter looks
  up no time zone, so its `check_sky_fact` takes no `zone`: it reads a date as
  that day in every UTC offset in use, as it does for the other kinds.
- **At an instant** the answer is `true` exactly when the engine's
  `matchAspect`, which decides a chart's aspects, names that aspect between the
  two bodies. The fact holds within the orb a chart uses, the wider one when
  the Sun or the Moon is one of the two. The reply gives both bodies' states,
  their `separation`, the `orb` (distance from the exact angle), `allowedOrb`
  and `motion` (`applying`, `separating` or `stationary`, the engine's
  `aspectMotion`).
- **On a date** the engine's crossing search runs on the difference between the
  two longitudes, normalised to 0–360°. Its targets are the edges of the orb on
  each side of the circle, where the aspect begins or ends, and the exact
  angles. The answer is `depends` when the aspect begins or ends in the day.
  Otherwise it is the state at the day's start. The reply gives `changes` (each
  `at` and whether the aspect `holds` from there), `exact` (each instant, with
  both bodies' places) and the state at both ends. The search steps 1 day when
  the Moon is one of the two, and 5 days otherwise.

## Checks

- `tests/api/compute-api-aspects.test.ts`:
  - The requests: refusals at `/other`, `/aspect` and `/body`; each of the five
    aspects accepted.
  - 160 seeded instants from 1800 to 2199. Each answer equals `matchAspect`, and
    each reported value equals the engine's own. `allowedOrb` is the widest orb
    that `matchAspect` accepts.
  - 48 seeded dates from 1900 to 2199, with and without a zone. Each answer,
    and each begin, end and exact instant, is held against a scan that reads
    the engine every 5 minutes (every 30 when the Moon is not one of the two)
    and bisects each change to the millisecond. Every instant agrees within a
    second.
  - The new moon and full moon of October 2026 are read across 0° of relative
    longitude.
- A one-off sweep of the same date test at 600 cases, with seeds 7 and 77 (1,200
  dates), found no disagreement. It is not part of the suite.
- `src/mcp/sky-tools.test.ts`: 49 aspect facts were added to the seeded corpus,
  along with two at each end of the accepted dates and four refusals. Each
  result is the compute API handler's body, and each passes the tool's output
  schema, the JSON Schema the host reads, and the OpenAPI response.
- `tests/api/compute-api-openapi.test.ts`: the `AspectFact` request schema
  agrees with the handler on six new cases. The new example
  (`aspect`: the Moon trine Saturn on 2026-10-14 in Europe/London, which
  depends: the aspect begins at 05:59 UTC and is exact at 21:44 UTC) validates
  against the schemas.
- A day's aspect search spends about 62 of the request's 1,000 evaluations.

## The adapter: 0.1.0-rc.23

The local MCP adapter carries the change as 0.1.0-rc.23, and the developer
plugin as 0.3.11.

- The archive `public/examples/zodiacs-mcp-server-0.1.0-rc.23.tgz` is 125,534
  bytes, SHA-256
  `be720004e31cd583c34e2873799fb95654a7cf3b1d9ace4b18cff7deffd3f619`, built
  from commit `7ec05433c18c708244673c3973bad55f97982e1c`. Its `server.mjs` has
  SHA-256 `cba42fac851f431f57e0578d593607844a8d8b80bf8b26850f46f479d19847fe`.
  It was packed again on 2026-10-13, after the merge of #730 and the
  developer-query guides, because its `candidate.json` said it superseded
  0.1.0-rc.19; it now names 0.1.0-rc.22, the latest archive the site served
  before it, and `scripts/mcp-artifact.test.mjs` holds that field to the
  served archives. The `server.mjs` the drives below ran is unchanged, byte for
  byte.
- `integrations/packages/zodiacs-developer-0.3.11.zip` is 1,835,229 bytes. Its
  `mcp/server.mjs` also carries Chart Studio's fix for a birth date without a
  time (F-91), which this change ships in the same plugin version. The plugin
  registers the hosted tools' `check_sky_fact`, which keeps its four kinds and
  refuses an aspect (`src/ai-tools/tools.test.ts`), and the adapter's chart
  tools; its `get_local_chart_capabilities` still describes the adapter's sky
  tools, which it does not register, and so lists `aspect` among their fact
  kinds. Its release note says so.
- [`../mcp-adapter/mcp-rc22-rc23.json`](../mcp-adapter/mcp-rc22-rc23.json)
  drives rc.22 and rc.23 with the same 278 tool calls, 10 of them refusals,
  after versions and digests are written out. One answer differs:
  `get_capabilities` lists `aspect` among the fact kinds. The tool list
  differs in 12 places, all in that list and in `check_sky_fact`'s description
  and schemas: the new kind, the `other` and `aspect` inputs, the descriptions
  of `kind`, `body`, `instant` and `date`, and three new result shapes. The
  methodology resource gains the paragraph on aspect facts. The comparison's
  calls were written for rc.22, so none of them asks for an aspect; the checks
  above cover those.
- The protocol drive passed 106 of 106 checks, the host drive with Claude Code
  2.1.296 7 of 7, and the comparison benchmark 18 of 18 cases and 112 of 112
  assertions ([`../mcp-adapter/`](../mcp-adapter/)).

## Phase 1 captures

The aspect facts change `src/lib/compute-api/`, which the Phase 1 capture
digest covers, so CI took the 18 captures again.

- **Committed captures.** Browser Evidence run 38444247411 took them on
  `53e99a59`, this branch merged with main at `6af799c7`, after main's #737
  came in, because #737 changed `src/lib` and `src/components`. Chromium
  149.0.7827.55 took them at 2026-10-13T18:12:02Z, for the 2026-10-13 edition,
  bound to template source digest `b730c4bb…`. Its build, acceptance captures,
  receipt, visual comparison, Lighthouse and explorer drive passed
  ([browser-evidence-provenance.json](browser-evidence-provenance.json) is the
  run's own record). The 18 images are byte for byte main's; the manifest's
  digest, build receipt and capture time are new.
- **Superseded run.** Run 38433828282 on `37b3f056`, before #737, took them
  for digest `51f4d297…`; its provenance is kept as
  `browser-evidence-provenance-37b3f056.json`.

## Production

#740 merged as `848e6087d3e3558aa37030749d010e33e73b4ab6`. Vercel
`dpl_AHCoAbgz8RfLgSPZSeU4YKv7vohq` built it for production and was READY at
2026-10-13T20:14:15Z; the zodiacs.org alias named it, built from the merge,
when [`tools/production-check.mjs`](tools/production-check.mjs) ran at
20:15:05Z. All 6 checks pass ([`production/production.json`](production/production.json)):

- the MCP adapter's manifest is the merge's, byte for byte, and the rc.23
  archive the site serves has its 125,534 bytes and digest `be720004…`;
- the compute API's sky-fact endpoint answers the documented aspect example
  (the Moon trine Saturn on 2026-10-14 in Europe/London) as
  `src/lib/compute-api/examples.json` documents it: `depends`, read over the
  local day;
- the hosted MCP's Chart Studio (`resources/read` of
  `ui://zodiacs/chart-studio-v2.html`) is the merge's
  `integrations/generated/chart-studio.mjs`, byte for byte, with F-91's
  wording;
- `/developers/compare/` has the section linking the four guides that compare
  the engine with other software (S4).

The same check against production before the merge, with #740's head as the
expected commit ([`production/control-before.json`](production/control-before.json)),
passed 0 of 6: the deployment was #737's, production's adapter manifest was the
earlier one, for rc.22, the rc.23 archive was 404, the sky-fact endpoint refused the
aspect example (400), Chart Studio was the earlier one and the compare page had
no such section.

## Not changed

The hosted assistant tools (`src/ai-tools/`, the remote MCP at zodiacs.org) keep
their own `check_sky_fact` contract, which still lists four kinds. Adding
aspects there changes a listed integration's contract and follows separately.
