# Published MCP bundle 0.6.9, 20 November 2026

Dias approved the tap-target, horoscope disclosure and dash fixes at 10:37
Asia/Bangkok on 20 November 2026.

- RED-1 sets 44px hit areas for the controls identified by the 375px phone
  audit outside Chart Studio. The gate requires 44px on both dimensions
  apart from the three recorded Chart Studio controls and inline links.
- RED-9 displays the horoscope answer's full disclosure, including its
  Reading confidence label, in the new horoscope panel. After a minor's
  horoscope, the panel retains that disclosure when the host sends a later
  result without the minor flag. The repeated-result regression exercises
  the original host subscription and checks the disclosure after both results.
- RED-10 uses `1800 to 2199` in the five approved tools' input descriptions
  and `to` between dates in the sky calendar heading. The gate rejects en
  and em dashes in these descriptions and in rendered panels.

The five updated resource addresses are `sky-events-v5`, `horoscopes-v8`,
`occasions-v9`, `readings-v5` and `readings-v6`. Their earlier served addresses
remain available as aliases. `readings-v6` displays the lunar nodes and Chiron
when the existing sky events switch is on. Chart Studio stays byte for byte
at `chart-studio-v6.html` with its source pin and embedded engine 1.1.0-rc.1.
Publishing the current browser build would change engine flags and receipt
convention IDs. That change needs the owner's approval.

As in ZOD-63, the published connector comes from a frozen source snapshot.
`connector-transition.json` records the original source
`07269a76e1ec1c43032af088e056a1c2ba8dfff4` and the initial source change
`7245bce067c9fc25e600811f19d458f0b696b680`. The old runtime reproduced byte
for byte with the original hosted build and vendored engine 1.1.0-rc.2.
For the recut, take a one-line-context diff from `runtimeSource.changesBase`
through this fix for `src/ai-tools/contracts.ts`, `server.ts`, `http.ts`,
`features/compatibility.ts` and `horoscope/reading.ts`. Apply it to the original
source. Supply the five updated `integrations/generated/` panels from
`npm run ai:build` and keep `chart-studio.mjs` from `runtimeSource.chartStudioSource`.
Build the `src/ai-tools/http.ts` entry with the original
`scripts/build-ai-integrations.mjs` hosted settings and lifetime boundary,
and copy the result to `api/_ai/published/runtime.mjs`.

| Published runtime | SHA-256 |
| --- | --- |
| 0.6.8 | `1effa2796fd6eb59f50316479141c1ad89e024f404878ca01d10119fb787ed95` |
| 0.6.9 | `35ec7fee9454408aeb99215ac11e546184f775f0ce057f79252a216301bd179e` |

The transition fixture captures initialize, tool listing, resource listing,
capabilities and the two accounts-off checks for each of three scenarios.
An in-process comparison reproduced all 18 prior replies, then verified all
18 regenerated replies against the approved differences. The round 2 recut
reproduced the committed 0.6.9 fixture byte for byte. The production
Neptune path continues to use Astronomy Engine and the DE440 route keeps its
separate calculation. The server reports 0.6.9. The portable plugin and
registry record retain their existing versions.

## Gated numerology guidance

Starting from the reproduced 0.6.9 source, apply the changes to
`src/ai-tools/tools.ts` and `src/lib/numerology/reading.ts` from the
`runtimeSource.readingConfidence` commit with one line of diff context.
Build the hosted entry with the same settings and lifetime boundary. The
resulting digest is recorded in `publishedSha256`.

## Moment charts (ZOD-62)

The proposed hosted tool is available on both routes when
`ZODIACS_MOMENT_CHART_ENABLED=1` and the existing occasion and coverage
switches are on. `get_moment_chart` accepts the event latitude and longitude,
an optional ISO timestamp with an offset, and an optional house system.
Omitting the timestamp uses the server clock. The result identifies itself
as a moment chart and links to the general sky page.

The recut started by reproducing the 0.6.9 hash above, retaining its original
TypeScript configuration, Chart Studio address and legacy addresses. The
`momentChart` source commit in `connector-transition.json` contains the two
new feature modules and the changes to the hosted tool registry, dispatcher,
HTTP options and account save caller. Apply those changes to that reproduced
source, appending the tool after numerology in the pinned roster and after
good days in the DE440 roster. Compile with the same hosted settings and
lifetime boundary. The current digest is in `publishedSha256`.

`tests/api/mcp-moment-chart.test.ts` exercises both built handlers with the
switch on and off. It checks that existing definitions keep their values,
casts a chart for now, submits the same recent date to the birth tool, and
inspects the request URLs, returned links, counters and preview diagnostics.

The combined hosted build retains both source changes. After applying the moment chart changes to the reproduced source, apply the numerology guidance to the same sources before compiling.

## Split-day refusal for check_sky_fact

Starting from the reproduced 0.6.9 + moment chart + gated numerology source
(digest `861fa130487eade0784a989188c2f3a3541c2d88262259275c001b2ec8219f8c`),
apply `runtimeSource.splitDayRefusalPatch`
(`docs/platform/evidence/site-engine-1-1-0/split-day-refusal.patch`) with
`patch -p1`. The patch adds the legacy-resolver-compatible
`clockWentBackAcrossMidnight` and `refuseSplitDay` check before
`computeSkyFact` across `src/lib/compute-api/{local-time,validate,endpoints}.ts`
and `src/ai-tools/tools.ts`, while keeping all published tool definitions,
directory fixtures, and the Astronomy Engine 1.1.0-rc.2 ephemeris unchanged.
Rebuild `src/ai-tools/http.ts` with the original `scripts/build-ai-integrations.mjs`
hosted settings and `addAiLifetimeBoundary`. Both the rebuilt bundle digest and
the source patch digest are recorded in `publishedSha256`.

## Stateless listChanged, -32022 revisions and null params (29 November 2026)

Approved by Dias on 29 November 2026 (Asia/Bangkok). Apply
`runtimeSource.mcpFrictionPatch`
(`docs/platform/evidence/site-engine-1-1-0/mcp-listchanged-and-negotiation.patch`)
across `src/ai-tools/{server,sanitize,http}.ts`: declare `listChanged: false`
for tools and resources on the stateless HTTP server, preserve only the
server-constant `data.supported` list on JSON-RPC `-32022` responses without
echoing request input, drop `"params": null` before SDK parsing, and return
HTTP 202 with an empty body for valid JSON-RPC 2.0 notifications outside the
method allowlist. All published tool definitions, directory fixtures, and the
Astronomy Engine 1.1.0-rc.2 ephemeris remain unchanged. Both the updated
published bundle digest (`7e2c4e3a55647d4664b095451e3d9abdb20fe33e0f9a3889a2620b41666f6241`) and the patch digest (`a512a7a4c2d3245f9802d00ec67f8b0c3f97ec7a2d0ffc849a6862482122f85d`) are
recorded in `publishedSha256`.
