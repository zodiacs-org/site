# OpenAI portal review record

## 0.5.1 owner submission record, 28 October 2026

All times in this entry are Asia/Bangkok (ICT).

At 10:01:09, the release session recorded the existing 0.5.1 version's
final **Submit for review** dialog open, with the owner's approval for
inspection only. All six
attestations were unchecked, the optional submission context was blank,
and Submit was disabled. The release session changed no fields, confirmed
no attestation and did not submit. This direct observation is preserved in
the local `openai-051-final-review-20261028.json` receipt and its screenshot.

At 10:04:00, Dias wrote in this release chat, "i submitted. what about the
anthropic one?" This is the timestamp of his submission report, not an
observed portal submission timestamp. His final click and attestation
choices were not observed or recorded by the release session. Do not infer
which statements he confirmed from the later review status. The subsequent
read-only R44 check below records 0.5.1 as **In review**, **Not published**.
The chat timestamp is preserved in the local
`owner-submission-report-20261028.json` receipt.

The reviewed ZIP remains 88,054 bytes with SHA-256
`d6c440e088474773eac16edf2b89fb0520c880af5407ddc3f4ab7136b3066e13`.
There was no further package upload, submission or attestation by the
release session after the handoff.

## 0.5.1 server metadata verified, 28 October 2026

PR #848 merged as `a1b06fd2` after all 24 applicable PR checks passed or
were legitimately skipped and main's Site Check was green. Its own main
Site Check `40652007347` then passed all 21 jobs, and the exact production
deployment was Ready. At 15:33:25 ICT, public checks confirmed version
0.5.1 in the status response, MCP initialize response and get_capabilities.
All thirteen tool names and input schemas remained unchanged, as did the
four current panels and all twenty legacy panel mappings.

The version correction updates release-version values in initialize and
get_capabilities, including their flag-off fixture responses. It does not
change tools/list, R44's conventionIds receipt schema, or the scanned card
addresses. No OpenAI portal action or additional rescan was performed for
this correction. The completed directory save is recorded in
[`claude-directory/LISTING.md`](claude-directory/LISTING.md).

## Tool copy checked after R44, 28 October 2026

Dias approved a rescan so that the app's copy of the tools would match
production after R44 (#840). The portal was read first; the rescan turned
out not to be needed, so it was not run.

The Zodiacs app now shows **In review**, metadata and skills version 0.5.1,
and **Not published**. This record's earlier entries describe the 0.5.0
draft as not submitted; when 0.5.1 was submitted is not recorded here.

The MCP server `zodiacs-sky` shows In review, configured and domain
verified. Its server instructions and all thirteen tools were last checked
on 27 October at 22:11:09 Bangkok time, 25 minutes after #840's production
deployment was ready. The scanned definitions include
`ui://zodiacs/chart-studio-v6.html` for `open_chart_studio` and the
`conventionIds` field of `get_sky`'s receipt. Production's `tools/list`
serves the same thirteen definitions as main's flag-off fixture, which has
not changed since #840, so the copy under review is current.

The findings are unchanged: `get_occasion_sky` and `get_compatibility` each
say "This new tool definition needs further review before it can be
published." Neither is blocking. Nothing in the portal was changed.

## November content refresh prepared locally, 27 October 2026

Main merged PR #835 at `bdf4ef88` while the approved `c626a7b7` release
was running its checks. The November horoscopes carry their own Phase 1
screenshots, so GitHub reports a merge conflict. All nineteen conflicting
files are generated screenshots or their evidence manifest; there is no
plugin source conflict.

A private candidate merges that already published content and regenerates
the combined evidence with the official tools. Its complete frozen-clock
Node 22 build and source checks pass. All 293 AI tests, generated-file and
package checks, eighteen captures, five evidence tests and nine interrupted
response cases pass. No check or limit was weakened.

The plugin sources, runtimes, packages, selected icon and demo are unchanged
from the approved release. The remote PR remains at `c626a7b7`, pending
owner approval to publish this content and evidence refresh. No portal
action has been taken.

## Edition layout fixes prepared locally, 27 October 2026

Later status, 28 October: the reservation fix `f6bc89bd` landed through
PR #807's merge `59a9383c` and remains in main. The current sources retain
the reserved wheel geometry and the grid rows and columns for the
horoscope controls. A later 412px shift reported for `div.hz-hero__body`
still needs investigation; it does not establish that this earlier fix is
absent. The preparation record below describes the state before #807 merged.

The release remains on hold. Site Check run `40458842151` at the approved
head `c9736c27` exhausted its one permitted failed-job rerun. Attempt 2
failed the dated Today page at 360px (CLS 0.00347222900390625) and the
Aries horoscope at 1280px (CLS 0.01662311862244898). No further rerun was
requested, no gate was loosened, and no portal action was taken.

A regression pauses the actual responses before the wheel SVG arrives,
after the period navigation, and after the first sign icon. On the old
pages it reproduces both failures, including the decorative pseudo-element
on Today and the sign rail and period navigation on the horoscope.
Reserving the wheel's square and the controls' rows and sign columns fixes
the movement. All nine new interrupted-load cases have exactly zero CLS.
The complete Today browser suite passes 379 assertions in Chromium 149;
the source check reports no errors or warnings. Settled geometry matches
the old pages at 360, 900 and 1280px for both surfaces.

The complete merged release candidate builds successfully under Node 22
with the publication clock pinned to noon UTC. All bundle budgets pass
without changing a limit. Full CI success remains a condition of
publication.

All 293 AI tests, package and generated-file checks, and the flag-off
fixture pass. Phase 1 was recaptured with eighteen screenshots and all five
evidence checks pass. The same nine interruption cases also pass against
the complete merged release build. Main's Site Check run `40465453550`
finished successfully for `e94fdf1a`; the revised candidate still needs its
own GitHub checks after approval to publish it.

A private candidate combines current main `e94fdf1a`, the layout fix and
the approved release. Generated files were rebuilt with their tools.
It preserves main's occasions v8 and horoscopes v6 and their old addresses.
The reviewed Sky 0.5.1 ZIP, selected icon and demo retain the checksums
recorded below. The existing remote draft PR remains at `c9736c27`.
Owner approval is needed before publishing this revised candidate.

## Tilted ring profile picture selected, 27 October 2026

After reviewing the full-size options, Dias selected option 1, the tilted
ring, and approved adding it to 0.5.1 and publishing through PR #807 once
its updated checks pass. OpenAI uploads and directory profile changes remain
subject to separate approval. The earlier PR head `811171f0` finished with
all checks passing or legitimately skipped; that result does not cover this
new revision.

The Sky plugin's logo and composer icon now point to
`./assets/icon-v2.png`. The image is generated from the shared brand ring by
`ai:build`, verified by `ai:check`, and will be available at
`https://zodiacs.org/assets/ai/brand/zodiacs-avatar-v2.png`. It is a 512 by
512 PNG and matches the selected preview byte for byte. Earlier icons and
the published 0.5.0 ZIP and movie stay unchanged. No panel HTML or resource
address changes in this icon revision.

Current candidate ZIP: 88,054 bytes, SHA-256
`d6c440e088474773eac16edf2b89fb0520c880af5407ddc3f4ab7136b3066e13`.
Avatar SHA-256:
`739964975885d3a9d0228bb55dda611bacab461ace4a6eec7f00735f3042e5e8`.
The earlier candidate checksum below records the package before this icon
revision. No portal upload or profile setting was changed for this step.


## Sharper artwork live, 27 October 2026

With Dias's explicit approval, PR #837 merged at
`922924ee00a3574cd1a2d58dbe62702715630a41`. Production deployment
`dpl_9bcJHrh6Fnmm5xbf41hPL9VpFvoy` is Ready on zodiacs.org. Main
Site Check run `40445680773` completed successfully for the same merge
commit; the preceding daily main run `40424414749` is also green. A direct
production check confirmed the four current panel addresses and their
generated fingerprints: sky events v4, Chart Studio v5, horoscopes v5 and
occasions v7. All seventeen registered old addresses return the corresponding
current panel. All 32 referenced artwork files return HTTP 200 and match the
checked files byte for byte. Wedding, horoscope, comparison, chart twins,
famous chart, milestones and Russian sky calendar tool checks passed.
The generated receipt is in
`evidence/card-art-sharpness/production-2026-10-27.json`.
Plain HTTP checks also confirmed the three remaining share images as
1200 by 630 JPEGs below 300 KB and their three story pictures as 1080 by
1920 JPEGs. An unknown famous person returns HTTP 404. The receipt is
`evidence/card-art-sharpness/share-images-2026-10-27.json`.

Before the deployment, three fresh ChatGPT checks using the existing private
Zodiacs Release Demo connection passed on their first display: the single-word
reply without a tool call, the Florence wedding card and today's Leo horoscope.
The earlier blank reply and initial panel errors did not recur. After the
approved refresh, fresh comparison, wedding, Leo horoscope, sky events and
combined chart twins and Frida Kahlo checks also loaded on their first display.
The comparison scored 58/100 and the wedding 69/100. Opening the returned
wedding destination preserves Florence, 12 June 2027 and 17:00 and removes
the referral query as the page loads.

## OpenAI draft inspection, 27 October 2026

Dias approved inspecting the existing draft. It still shows package 0.5.0,
Not submitted and Not published, with its older About and skill description.
The domain is verified, authentication is off and thirteen tools are present.
Seven tool findings still say the new definition needs further review before
publication. The metadata category has a nonblocking finding: the automated
check could not confirm Education & Research. No package or listing field was
changed during this inspection.

Dias separately approved rescanning the existing draft after the production
check. The scan completed at 10:55:55 Bangkok time. Eleven tools have no
findings. The remaining findings, for `get_occasion_sky` and
`get_compatibility`, each say: "This new tool definition needs further review
before it can be published." No connection or input-definition error was
reported. The scanned definitions contain occasions v7 and horoscopes v5,
confirmed in the portal's definition views. The draft remains Not submitted
and Not published. The local screenshots are retained outside the repository.

Dias also approved refreshing tools for the existing private Zodiacs Release
Demo connection. The refresh finished without an error. The refreshed checks
are recorded above. No retry was needed.

The scheduling negative case used no Zodiacs tool and made no change. The
relationship guarantee case declined the guarantee without calling a tool.
The stock-picking negative case failed: the host called the horoscope tool
and suggested an astrology-themed investment list. No private profile details
or returned investment names are recorded here. A local candidate strengthens
the horoscope description to decline investment requests without a tool call
and forbids astrology-themed investment suggestions. A transport regression
test failed before the change and passes afterward. All 293 AI-tool tests and
`ai:check` pass locally. This wording change is not deployed and needs a fresh
host test before submission.

A new 41-second live recording of the comparison and wedding cards has been
prepared locally for owner review. The edit trims waiting time and crops to
the conversation, with no browser, account details or unrelated windows in
the export. Its proposed new address is
`https://zodiacs.org/assets/ai/review/zodiacs-sky-0.5.1.mp4`; the published
0.5.0 video stays unchanged. The local 0.5.1 ZIP now references the proposed
new video and strengthens the investment negative test and release notes.
The About wording is unchanged from the version Dias reviewed. Nothing has
been pushed, published or uploaded for these new changes.

Before the avatar revision, the candidate ZIP was 74,350 bytes, SHA-256
`d5de82e42e3f7fcc37b10f313d531aa42375f3114851b4f833e53dab891b944b`.
The video is 41 seconds, H.264 at 1080 by 1600 pixels and 30 frames per
second, with intentionally silent audio. Native project filmstrips and a
full-speed playback were reviewed locally. The final video SHA-256 is
`51bb6000a328b5fcb4dec11b5e552ec14bbb31ab60ad9be9443796fe1379ce35`.

## Local artwork check, pending release, 26 October 2026

Dias reported blurry pictures in the wedding and horoscope chat cards. The
published panels use 400px or 480px, quality 36 artwork at up to 540 CSS
pixels. A candidate on `codex/card-art-sharpness` loads the larger immutable
art from zodiacs.org and assigns fresh panel addresses, occasions v6 and
horoscopes v5. Local browser checks passed for 52 card renders, including
desktop, phone width, light and dark themes; the occasion browser drive also
passed. This has not been deployed, rescanned or entered in the OpenAI draft.
The draft remains unsubmitted and unpublished. Do not treat the candidate as
live portal evidence.

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
