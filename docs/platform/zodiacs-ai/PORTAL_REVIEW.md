# OpenAI portal review record

## ChatGPT release retest, 26 October 2026

The private Zodiacs Release Demo connection still failed in fresh Chat-mode
conversations. Selecting it and asking for a single-word reply without any
tool call produced a blank reply. The same prompt returned the requested word
without a plugin. Two other private Zodiacs test connections on separate
servers also produced blank replies without calling a tool.

Fresh wedding and Taurus horoscope prompts called the right tools but showed
"Couldn't display Zodiacs Release Demo" on the first card load and "This
response couldn't load" for the surrounding reply. **Try again** loaded each
card with the expected reading; reopening the wedding conversation reproduced
the first-load failure. Direct production tool calls returned valid wedding
and horoscope results, and `npm run ai:check` passed on the prepared 0.5.1
branch after merging the latest `main` locally.

The existing OpenAI draft still shows version 0.5.0, its outdated About text,
**Not submitted** and **Not published**. No package was uploaded, no rescan or
attestation was made, and no submission was sent. The first-load problem still
needs review before release.

## About correction prepared, 20 October 2026

Dias approved replacing only the draft's About text and seeing its preview.
The portal displays that field as read only and states that review information
is managed by the plugin ZIP. The current 0.5.0 draft still contains the old
claim that Zodiacs does not score relationships or rate dates. No ZIP was
uploaded and no About, test case, attestation or submission was changed.
The published `zodiacs-sky-0.5.0.zip` remains byte for byte unchanged.

With Dias's separate approval to prepare a candidate, `zodiacs-sky-0.5.1.zip`
now contains the exact About from `integrations/chatgpt/chatgpt-app-submission.json`
and release notes that describe the live scoring and ratings accurately.
`ai:build`, `ai:package` and `ai:check` pass. The package has not been
uploaded to the portal. A separate approval is required before that step.

Dias also approved refreshing the private Zodiacs Release Demo connection.
After the refresh, two new chats returned wedding and horoscope answers, but
both embedded panels still failed on the first display. In earlier fresh
chats, pressing **Try again** once loaded both redesigned panels. The first
display issue remains unresolved; a tool refresh did not correct it.

## Panel address refresh live, 20 October 2026

The source now advertises new addresses for all four redesigned chat panels:
sky events v4, Chart Studio v5, horoscopes v4 and occasions v5. Earlier
addresses stay registered and serve the current panels. A generated SHA-256
record prevents a panel from changing again under the same address and keeps
retired address fingerprints so they cannot be reused accidentally.

PR #802 merged as `35476c1622644bbb2a58e6bcb337f306b15c3578` after all PR
checks passed, including a rerun of the fluctuating Today layout check.
Production deployment `dpl_BnWvGnjHgF9nysuecbCZBBJeuhjh` was Ready before
the live MCP check at about 09:29 UTC. `tools/list` exposed thirteen tools;
the four panel tools advertised sky events v4, Chart Studio v5, horoscopes v4
and occasions v5 in both resource metadata fields. The six other occasion
tools also advertised occasions v5. Reading each new address and every
registered legacy address returned identical HTML, and the four live
SHA-256 hashes matched `src/ai-tools/panel-fingerprints.json`.
Main's Site Check run `39400395185` finished green on the same merge commit.

## OpenAI tool rescan, 20 October 2026

Dias approved this specific rescan in chat. The existing Zodiacs 0.5.0 draft
at `https://platform.openai.com/plugins/manage/plugin_asdk_app_6ad073182c5c8191ac05ef000b65058c`
was rescanned at 17:53 Bangkok time. The portal showed the production MCP URL,
domain verified, thirteen tools, and a fresh check time for each tool. Seven
tools had the same finding: "This new tool definition needs further review
before it can be published." They were `get_occasion_sky`,
`get_life_milestones`, `get_compatibility`, `find_chart_twins`,
`get_famous_chart`, `get_birthday` and `get_sky_calendar`. The other six tools
showed no findings. The portal did not report an input-definition error or a
server connection error. Its status remained **Not submitted / Not published**.
No About text, test case, package, attestation or submission was changed.

## Fresh ChatGPT card check, 20 October 2026

Two new chats used the private Zodiacs Release Demo connection to the
production MCP. The wedding prompt from the demo plan returned the Florence
reading for 12 June 2027 at 17:00. The embedded Zodiacs panel displayed the
redesigned artwork, Gemini and Libra sign icons, a 69/100 ring, the reasons
disclosure, share link and printable-card link with the date, time and place.
A second new chat requested the Taurus horoscope for 20 October 2026. Its
embedded panel displayed the redesigned artwork, Taurus icon, day and focus
controls, reading and share link. In both chats the first panel load showed
ChatGPT's "Couldn't display" message; pressing **Try again** once loaded the
panel. The separately generated ChatGPT response was not treated as evidence
of the embedded panel. No console error explained the initial load failures.
The draft remains unsubmitted and unpublished.

## 0.5.0 withdrawn for fixes — 15 October 2026

Later the same day the owner withdrew the submission below. The owner's review
brief of 15 October gives the last verified portal state as **Draft / Not
submitted / Not published**. This is reported by the owner; it was not
re-checked in the portal for this record. An independent review of the
withdrawn package and the plan for resubmitting are in
[`RESUBMISSION-0.5.0.md`](RESUBMISSION-0.5.0.md).

## 0.5.0 release — 15 October 2026

The owner reported that the old public plugin had been deleted and explicitly
requested a new identity. The replacement listing is
[Zodiacs](https://platform.openai.com/plugins/manage/plugin_asdk_app_6ad073182c5c8191ac05ef000b65058c?tab=details&version=appsub_6ad073182ca8819186c2cd4e686f03a6),
with the subtitle **Birth charts & horoscopes**, under the verified Zodiacs LLC
business identity. Public contact remains admin@zodiacs.org.

Sky 0.5.0 is uploaded, the production endpoint https://zodiacs.org/mcp is connected
without authentication, the domain is verified, and all thirteen read-only tools
were scanned. The skill checks passed. All five positive and three negative
review cases and the [0.5.0 demo](https://zodiacs.org/assets/ai/review/zodiacs-sky-0.5.0.mp4)
are saved. The demo is an edited sequence of actual private-staging captures with
synthetic examples; it is not a continuous recording.

The first scan flagged unnecessary birthday input. [#756](https://github.com/zodiacs-org/site/pull/756)
removed unused latitude, clarified the minimum birthday input and retained longitude
only for interpreting historical local clocks. All 231 AI-tool tests, 54 evaluation
cases, package checks and type checking passed. The deployed candidate passed
18 staging checks with 14 tool calls; three focused checks passed on staging and
production. The follow-up scan cleared the birthday finding. The claims-ledger
registration missed in #756 was added in [#757](https://github.com/zodiacs-org/site/pull/757);
all 36 relevant ledger, binding and birthday tests passed locally.

The scan initially could not confirm the Education & Research category. The final
submission dialog listed only MCP checks needing attention: get_occasion_sky needs
further review before going live. The dialog classified this as non-blocking.
Neither the scan nor acceptance of the submission is directory approval.

Status: **submitted / in review, not published**, confirmed in the portal on
15 October 2026 at about 14:21 Bangkok time (07:21 UTC). The owner explicitly
confirmed all six attestations and authorized submission. An initial connection
error was followed by a refreshed check that still showed Not submitted; the retry
succeeded. The listing detail shows **Metadata & skills version 0.5.0 · In review**.
The directory table labels its first review version 1.0.0; the uploaded package
version remains 0.5.0.
The old 0.4.0 support case 17133838 is already closed.

## Historical snapshot before deployment — 6 October 2026

Business verification is approved for Zodiacs LLC. The daily identity monitor is paused.
This approval is separate from plugin-directory approval.

The [Zodiacs draft](https://platform.openai.com/plugins/manage/plugin_asdk_app_6ac51614dd288191b38dd3b9c0cf191e?tab=details&version=appsub_6ac51614dd548191b711404446f2c323) was created under the verified Business identity in the
Personal organization / Default project. Plugin ID:
plugin_asdk_app_6ac51614dd288191b38dd3b9c0cf191e.

## Package and automated findings

Sky **0.3.3** is uploaded to the existing draft. Its SHA-256 is
11a965dd8c3e761a3c5fcd204342fb8b4dc9c3bda4b1199640bbed76d72c7eab. The portal rejected the earlier Lifestyle category.
Education & Research is supported by the current [submission-error reference](https://developers.openai.com/plugins/deploy/submission-errors#listing-and-interface-errors)
and fits public-sky exploration and reproducible calculations. The category finding
is now cleared. A local package guard checks supported categories for both plugins.

The explore-the-sky skill shows **Checks passed**. All **five positive** and
**three negative** review cases show complete. Release notes are imported.
Country availability shows all supported countries; no availability edit was made.
The icon, Zodiacs LLC, official website, support, privacy and terms fields imported.

The remaining privacy finding says the automated assessment could not be completed
and permits submission for additional review. The public privacy page returned HTTP
200. This is not a finding that the policy passed, and no compliance claim is made.

## Connection and remaining review work

The draft retains the stable public URL https://zodiacs.org/mcp with No Auth.
The public health endpoint and domain-challenge URL returned HTTP 404 during
this review. Production remains unmodified by this work.

The exact 43-byte domain challenge is now included at
`public/.well-known/openai-apps-challenge`, without an added newline. Its Vercel
route declares plain text and no caching. No existing challenge was overwritten.
This is a public domain-control proof, not an authentication credential; it stays
outside the plugin ZIP. After deployment, verify HTTP 200 and exact response
bytes before selecting Verify Domain. Tool discovery and automated tool findings
cannot be evaluated until the stable public server is reachable. The temporary
authenticated Watch host is not a substitute for this public URL.

The uploaded 0.3.3 walkthrough URL remains empty. Sky 0.3.4 is now prepared with
a 248-second actual native recording of all five positive and three negative
scenarios on the current private preview. Its extra Watch capability is clearly
outside public Sky scope. See [WALKTHROUGH.md](./WALKTHROUGH.md). The video URL
and exact public resource must be verified after deployment before this new ZIP
is uploaded; the historical rc.15 reel is not current evidence.

Status: **not submitted / not published**. Domain verification and tool scan are
incomplete. No policy attestations, paid upgrades, production activation or merge
were performed. Developer 0.3.2 remains a local stdio package; private Watch profiles
remain separate. Consenting human feedback for the 9/10 target is still absent.

## Verification

Sky 0.3.3 and Developer 0.3.2 package-contract and archive checks pass. The
runtime bundles are unchanged by the listing correction. The current branch
includes main a4903dd3, preserving the translated compatibility pages and the
sharp mobile homepage poster. Both branches patched the MCP test-client advisory;
this candidate retains the verified 2.3.1 client, its lock and regenerated daily
provenance. The Phase 1 source fingerprint and its reviewed captures are unchanged.

The newly published sharp advisory was resolved with sharp 0.35.5 / libvips 1.3.4
(librsvg 2.63.2). The production dependency audit reports zero vulnerabilities;
the full-tree high/critical gate passes, with two moderate Vitest development
findings still reported. See the [maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).

The final render-source capture [0a56bac0](https://github.com/zodiacs-org/site/commit/0a56bac0928b6dcdd2ea7eb308afc9cbd91d9fce)
passed the site build, all 18 captures, capture-receipt validation and visual
comparisons in [Browser Evidence 37507840107](https://github.com/zodiacs-org/site/actions/runs/37507840107).
All 19 capture files were imported unchanged after matching CI SHA-256 hashes;
the five local evidence tests pass. That run was cancelled during Lighthouse to
retrieve the new receipt, so it is not full browser acceptance. The final commit
still requires complete Site Check and Browser Evidence. Follow
[PR #618](https://github.com/zodiacs-org/site/pull/618) for their final result.

The newly listed MCP client advisory GHSA-6qxp-vccf-f47h was fixed by updating
the development test client to 2.3.1. Its stdio integration drive passed. Production
audit remains zero and the full high/critical gate passes; the two moderate
Vitest development findings remain. No client OAuth credentials were used.
