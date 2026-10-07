# Zodiacs 0.4.0 release audit

Audit date: 7 October 2026. Prepared by Codex for Claude and the owner. PR
[#681](https://github.com/zodiacs-org/site/pull/681) remains a draft on
`opus/consumer-plugin-0.4`. Nothing was merged, submitted, withdrawn or
published. No production setting, project environment variable, Firewall rule,
database schema or service-role key was changed. No email was sent.

## Decision

**The technical staging packet is ready for review; the release is not ready
for submission.** Six remote tools and their self-contained panel resources
pass the actual Vercel acceptance drive. Actual ChatGPT and Claude use, the
iPhone check and the new eight-case walkthrough remain blocked or unverified.
Protocol checks and desktop responsive screenshots do not establish those
host results. Keep `demo_recording_url` empty until an actual 0.4 recording
exists. Do not merge this server change during the existing 0.3.4 review.

## Claude's review and update — 7 October 2026, about 06:30 UTC

**Recommendation: not ready to submit.** No assistant has yet run the 0.4.0
server for a real conversation. The blocks below are access problems, not
product failures, and each has a documented way through. Two need the owner's
decision.

### Codex's amendments: accepted

- The four Codex commits match their descriptions. CI on the staged head
  `edb05486` passed all 20 jobs.
- The text evidence contains no shareable-link token, preview cookie, bypass
  secret or service key; I searched every changed text file for each pattern.
  The Claude screenshot shows the header value masked.
- The Claude manifest and the typed `.mcp.json` are consistent with the
  package checks. Validation is not a directory approval.
- The evidence is honest. Nothing is counted as a host result unless a host
  produced it.

### What the documentation says about each block

1. **The existing ChatGPT preview identity cannot be repointed by us.**
   OpenAI's [submission guide](https://developers.openai.com/plugins/deploy/submission)
   says: "To change an existing MCP server's URL, contact support; the current
   update flow does not support URL changes." Its frozen URL carries an expired
   23-hour preview credential, so Refresh and Reconnect cannot repair it.
   - The supported procedure that keeps the identity is a support request.
     The owner sends it; nothing has been sent. It must stay separate from
     case 16624967, which concerns the obsolete 0.1.0 listing.
   - The alternative is a new temporary custom MCP server in ChatGPT for
     testing, which gets a new identity and needs the owner's approval.
2. **ChatGPT on iPhone cannot be tested before publication.** OpenAI's
   [developer mode article](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
   answers "Are MCP apps available on mobile? No - web only." A private
   preview therefore cannot open on the owner's iPhone. The mobile check moves
   to after approval. It is recorded as **not executable**, not as a failure.
3. **Claude: custom header names need Anthropic's approval.** Claude's dialog
   says to contact support to request approval for a new name. Vercel's
   shareable link answers with a 307 cookie redirect that Claude's connector
   does not keep.
4. **The documented route for clients that send only a URL** is Vercel's
   [Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
   as a query parameter: `…/mcp?x-vercel-protection-bypass=<secret>`. Vercel
   documents it for third-party services that cannot set headers, and the
   secret travels on every request without a redirect.
   - **Server side, done here (commit `1dd7d698`).** `/mcp` refused that
     parameter with 400 even after Vercel accepted it; I observed this on
     `zodiacs.org/mcp`. It now tolerates the parameter on preview deployments
     only, never reads, echoes or logs it, and still refuses it in production.
     Tests cover both cases.
   - **Owner side, not done.** A bypass secret works on every deployment of
     the project until it is revoked, so it is wider than a one-preview
     temporary link. Creating, sharing and revoking it is the owner's
     decision. It is a security setting, made in the Vercel dashboard. The
     owner pastes the full URL only into the ChatGPT and Claude connector
     forms, never into a chat, commit or evidence file, and revokes it when
     testing ends.

### What has to happen before the host tests

- Redeploy staging from `1dd7d698` or later with Codex's bounded-preview
  procedure, keeping the deployment-only switch, staging host and quota
  credential.
- Before testing on 8 October or later, merge main into the branch and rebuild
  `src/data/horoscope-window.json`. The committed window covers 6–8 October
  only.
- Then run the case matrix on ChatGPT web, through a new temporary connection
  or a repaired identity, and on Claude. Mobile waits until after approval.
- Record the eight-case walkthrough from ChatGPT web, then set
  `demo_recording_url` and rebuild the packages.

### Case status after this update

The matrix above is unchanged: every ChatGPT web and Claude case is still
blocked, and every iPhone case is not executable before publication. No new
host result has been observed.

## Source and amendments

Claude's initial candidate was `deb0dd933844f13af1052546401ed8db18226513`.
The staged source is `edb054868f20f6a82fe7f3fab5c4824aa070522e`.

| Codex commit | Change | Verification |
| --- | --- | --- |
| `d0e66af397440ad31140c5de8ae7e27f1991aba9` | Regenerate the assistant's cached developer-page description, fixing the one failing initial CI assertion | Five focused assertions passed |
| `76a35a3bc51cbc38b9aa5325732b83dd8d175795` | Generate the consumer Claude manifest and typed remote configuration; refresh the requested internal documents, category and Developer skills; rebuild packages | `ai:build`, `ai:package`, `ai:check`; current Claude validator |
| `edb054868f20f6a82fe7f3fab5c4824aa070522e` | Derive the staging engine expectation from the pinned package and verify the actual horoscope resource, digest and CSP | Actual staging drive below |

Each commit has Codex co-author attribution. No changes were made to the
other two Claude branches, the wing, SDK product wording, `disclosure.*`,
hash-locked trust copy or Registry heading. Existing legal and privacy text
was carried through unchanged; no new legal wording was authored.

The initial Site Check run `37569555552` failed one stale cached-description
assertion: 6,911 tests passed, one failed and six were skipped. The refreshed
focused suite passed 147 tests in 14 files. Run `37572247837` tests the staged
head. All 20 jobs passed, including the full-site build, typecheck, integration
verification, functional browser steps and final performance checks. The exact
head and final results are saved in [ci.json](evidence/0.4.0/ci.json).
The draft's skipped Browser Evidence workflow is not a completed release gate.

## Vercel staging and its limits

| Field | Observed value |
| --- | --- |
| Team / project | `zodiacsofficial` / `zodiacs-org` |
| Project ID | `prj_nRTO3q3aNYLfaM3dotAowOc028fO` |
| Deployment | `dpl_F3jbqCMvgb8rHX6XsYVZ2e9r7MHZ`, READY, Preview |
| Stable alias | `zodiacs-consumer-040-preview-zodiacsofficial.vercel.app` |
| MCP endpoint | `https://zodiacs-consumer-040-preview-zodiacsofficial.vercel.app/mcp` |
| Source | `edb054868f20f6a82fe7f3fab5c4824aa070522e` |
| Builder / function runtime | Vercel CLI 62.7.0, `@vercel/node`; actual runtime `nodejs22.x` |
| Local release checks | Official Node 24.21.0 |
| Authentication | Existing Vercel protection remains enabled; temporary preview-only share access expires after 24 hours |

This is a **bounded prebuilt MCP preview**, not a complete preview of the
website. The repository ignores non-production Git builds. Git-source attempts
were cancelled by that rule. A per-deployment GUI rebuild bypassed the ignore
step but dropped the one-off MCP/quota environment values. It was not used as
enabled MCP acceptance evidence. No project build rule was changed.

The successful preview builds the branch's existing compatibility-function
closure. Deployment-only environment values include `ZODIACS_MCP_ENABLED=1`,
the exact alias in `ZODIACS_MCP_STAGING_HOST`, and the existing server-side
quota URL/key. They remain outside Git, public artifacts and evidence.
Production and general Preview environment values were not changed.

The private builder adapter normalizes the function directory to the existing
rewrite target and explicitly includes the exact committed horoscope window.
The bundled MCP runtime and window match the staged source byte for byte;
[preview-build.json](evidence/0.4.0/preview-build.json) records their digests.
Vercel's prebuilt deployment has no `gitSource` metadata; its source provenance
comes from the checked-out head and artifact digests, not a claimed Vercel Git
checkout. The adapter also wraps the compiled handler with a preview-only
Origin-presence boolean log. It logs no header values, request arguments, birth
data or credentials. This wrapper is not part of the branch or release ZIP.
Its digest is recorded separately. Thus the compiled wrapper is not claimed
to be identical to the release handler.

[staging-acceptance.json](evidence/0.4.0/staging-acceptance.json), captured
`2026-10-07T05:06:38.105Z`, records **16 passing checks and seven tool calls**:
health on both slash forms; six read-only tools and output schemas; empty-only
Studio arguments and native entrypoints; all six tool operations; calendar,
horoscope and Studio resources; exact resource/CSP comparisons; argument
canary non-echo; malformed/oversized/Origin/query/method refusals; recovery.
These are official MCP-client and HTTP results, not assistant-routing results.

[staging-local-day.json](evidence/0.4.0/staging-local-day.json) separately
checks actual staging responses at UTC 7 October: Bangkok receives the
7 October Leo edition; Los Angeles receives 6 October. This proves the
service's differing-date selection at the captured time. It does not prove
an actual host supplied the reader's time zone. The preview's committed window
is frozen around 7 October; refresh it before testing on later dates.

## Real host tests

All observations below are dated 7 October 2026. **Blocked** means the intended
case was not executed successfully; it is neither a pass nor an invented
assistant refusal. Planned prompts are shown to make the rerun unambiguous.

### ChatGPT web: existing Zodiacs Preview identity

Identity: `plugin_asdk_app_6ac3eb972308819196d5c5b70e90fa28`.
The same private plugin was updated to profile version 1.0.3 with exactly:

- Show my horoscope for today
- Is Mercury retrograde right now?
- Help me read my birth chart

Actual UI confirmation: [private-preview-starters.jpg](evidence/0.4.0/private-preview-starters.jpg).
This was a private ChatGPT profile update, not a developer-portal upload.
Its existing MCP connection still points at a frozen older deployment with an
expired temporary credential. That profile update does not upgrade the server.

The Mercury starter was actually sent in
[this conversation](https://chatgpt.com/c/6ac5cf24-55e0-83ec-91a9-010293760fed).
ChatGPT reported that the Zodiacs Preview connection had expired. The normal
Reconnect flow was attempted and did not restore a working connection.
Evidence: [chatgpt-expired-connection-current.jpg](evidence/0.4.0/chatgpt-expired-connection-current.jpg).
The management UI exposes no server-URL edit. No plugin or connection was
deleted, no duplicate ChatGPT identity was created, and no portal URL was
changed to work around it.

### ChatGPT iPhone

The owner selected iPhone for the real-device check. This Mac has no attached
phone-control surface. No iPhone result has been observed or recorded. Use the
same private identity after its connection is repaired. A simulator, desktop
browser at phone width or SDK response must not be counted as this check.

### Claude custom connector

The actual Claude desktop app's normal chat opened the custom-connector setup
for “Zodiacs 0.4 preview”. The temporary preview URL produced **HTTP 307** in
the server check, before a usable MCP connection was established. Claude
offered Continue anyway. Automatic approval review rejected continuing because
the URL contains a temporary access secret that would be shared with Anthropic.
The owner then explicitly approved sharing the temporary preview access with
Anthropic. Setup continued using the clean staging URL and Claude's documented
Request headers controls, with no OAuth sign-in. The temporary preview cookie
header works against staging health (HTTP 200, ready), but Claude rejected
creation with: “The header name ‘cookie’ isn't approved.” Its UI requires
Anthropic approval for custom header names. No connector or conversation test
completed. No alternative header name was substituted to evade that policy,
and no preview protection was disabled. The draft dialog was closed.
The redacted setup observation is recorded in
[claude-connector-block.json](evidence/0.4.0/claude-connector-block.json).
[claude-header-rejected.jpg](evidence/0.4.0/claude-header-rejected.jpg) captures
the rejected setup with the private sidebar hidden and temporary access values
masked by the UI. An earlier full-window capture is retained privately outside
Git because its background contains unrelated private conversation titles.

**Claude Origin-header presence: unverified.** The preview boolean wrapper is
available, but the captured acceptance-drive log entries belong to the SDK
client. Those entries have `originPresent:false`; they must not be attributed
to Claude. No panel rendering in Claude has been observed. Do not commit a
screenshot of the connector URL while its access secret is visible.

### Required case matrix

| Prompt or interaction | ChatGPT web | ChatGPT iPhone | Claude |
| --- | --- | --- | --- |
| “Show my horoscope for today”; choose a sign without guessing | Blocked: expired connection; not executed | Not executed: device check pending | Blocked: connector setup |
| Today's horoscope in a zone whose local day differs from UTC | Blocked; SDK-only differing-date evidence above | Not executed | Blocked |
| Switch sign inside the horoscope panel | Blocked; no panel rendered | Not executed | Blocked; no panel rendered |
| “Help me read my birth chart”; first screen asks when/where | Blocked; starter set, not executed | Not executed | Blocked |
| “I don't know my birth time”; omit uncertain houses/angles | Blocked; no real host flow | Not executed | Blocked |
| “What's happening in the sky this week? I'm in Bangkok.”; local dates/times | Blocked; not executed | Not executed | Blocked |
| “Is Mercury retrograde right now?”; plain answer | **Attempted, failed before invocation: expired connection** | Not executed | Blocked |
| “Reschedule my work meeting tomorrow.” | Not executed | Not executed | Not executed |
| “Tell me which stock will rise based on my horoscope.” | Not executed | Not executed | Not executed |
| “Guarantee that my partner and I will stay together.” | Not executed | Not executed | Not executed |

The screenshots prove the metadata update and connection failure. They do not
prove the unexecuted cases. Source instructions and synthetic tests are not
evidence of real assistant refusals.

## Walkthrough and packages

The 0.4.0 manifest has exactly five positive and three negative review cases.
No valid 0.4.0 recording has been made because the required host connection
does not yet work. The existing 0.3.4 video is not reused as 0.4 evidence.
`public/assets/ai/review/zodiacs-sky-0.4.0.mp4` is not fabricated or populated
with a simulation. Its future URL is not advertised as accessible now.

`ai:package` and `ai:check` pass with the current deliberate empty demo URL.
This verifies package consistency, not review readiness. Sky is 0.4.0;
Developer is 0.3.3. The generated consumer Claude manifest is included in the
complete Sky ZIP. Shared `.mcp.json` now declares remote `type: "http"`;
portable `mcp.json` retains `type: "streamable-http"`.

The current official Claude CLI 2.1.292 validates the consumer package. An older
installed 2.1.81 validator rejects newer directory fields and is not the
validation authority for these fields. See the current
[Claude manifest reference](https://code.claude.com/docs/en/plugins-reference)
and [remote MCP configuration](https://code.claude.com/docs/en/mcp).
Validation is not a Claude directory approval or a host-rendering check.

The product, support/about, privacy and terms URLs each returned HTTP 200 and
identify Zodiacs. The proposed 0.4.0 video URL returned HTTP 404. These read-only
reachability observations are in
[public-url-check.json](evidence/0.4.0/public-url-check.json); they are not a
legal-content review or permission to change any wording.

## Guidelines review and outstanding product risks

Reviewed the current [OpenAI plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
and [submission flow](https://developers.openai.com/plugins/deploy/submission)
on 7 October. Relevant requirements include suitable experiences for ages
13–17; minimized personal data and accurate privacy information; no ads or
upselling; specific, verifiable listing claims; accurate tool annotations;
declared UI CSP; functional desktop and mobile experiences; five positive and
three negative review cases and an accessible walkthrough. This packet cannot
establish compliance with the missing real-host and walkthrough checks.

- **Birth data:** Remote Studio accepts `{}` only and rejects birth-detail
  arguments without echoing them. Source calculates inside the panel and
  requires review/action before selected chart facts are shared. Those derived
  facts can still be personal data. The actual host's sharing, retention and
  unknown-time behavior must be checked. The listing's “without saving it” and
  “only what you choose to share” statements need confirmation across the
  actual embedding and all host retention layers; source isolation alone is
  not that proof. No privacy/disclosure rewrite was made. Any such rewrite
  needs the owner's approval.
- **Ages 13–17:** No under-13 targeting or guaranteed health, money or
  relationship outcome was found in the consumer skill/listing. Source tells
  the assistant not to guarantee outcomes. All supplied horoscope editions
  and real-host negative cases still need a suitability review; an automated
  suite is not a declaration that every reading is safe for teenagers.
- **Ads and upselling:** The review metadata declares no commerce. The skill
  makes website links optional and requires complete answers without a click.
  No advertising or purchase tool is in the six-tool staging surface. Hosted
  conversational behavior remains unverified.
- **Claims:** The source distinguishes computed astronomy from interpretation,
  explains omitted eclipses/reminders and unknown birth time, and makes no
  comparative accuracy or guaranteed-outcome claim in this listing. Avoid
  treating these source statements as verified host behavior.
- **Tools:** Staging exposes `get_capabilities`, `get_sky`,
  `get_upcoming_events`, `check_sky_fact`, `get_horoscope`,
  `open_chart_studio`. Output schemas and read-only flags pass. Source marks
  destructive/open-world behavior false. A natural host must route reliably
  and keep the date-only “depends” result instead of inventing certainty.
- **CSP:** Actual horoscope and Studio resources match the committed bundles
  with empty connect/resource allowlists. Calendar resource retrieval passes.
  This checks server declarations and bytes; actual enforced rendering and
  in-panel calls remain release gates.
- **Availability:** The horoscope window is deployment-bundled. A stale build
  will eventually lack the reader's date. Verify the daily job refreshes it
  and handles unavailable editions without inventing a reading.
- **F-78:** The handoff records a live Firewall ceiling of 30 general/6 event
  calls per minute versus code/docs' 40/10 atomic limits. It is a separate
  unresolved change; no Firewall or budgets were changed here. Shared provider
  IPs/global quotas can affect multiple readers. No capacity SLA is inferred
  from this short drive.
- **Daily similarity fix and email wording:** The handoff assigns the
  8/10 October horoscope similarity issue and email-signup mismatch to
  separate work. Neither other branch was changed or counted as fixed here.
  No human beta feedback was invented and no tester was contacted.

## Existing OpenAI submission: read-only observation

Public submission identity:
`plugin_asdk_app_6ac51614dd288191b38dd3b9c0cf191e`.
The portal showed **0.3.4 · In review, not published**, Zodiacs LLC,
Education & Research. The MCP URL is `https://zodiacs.org/mcp`, no authentication,
domain verified, latest scanned tools with no issues. The six scanned 0.3.4
tools include `search_zodiacs` and do not include `get_horoscope`; they are
marked **Not live**. Server instructions are also not live.

Evidence: [portal-0.3.4-in-review.jpg](evidence/0.4.0/portal-0.3.4-in-review.jpg)
and [portal-0.3.4-mcp.jpg](evidence/0.4.0/portal-0.3.4-mcp.jpg).
No rescan, cancellation, upload or policy attestation was performed.
Historical dated descriptions in LAUNCH.md do not override this observation.

Submitting 0.4 would create a replacement draft on that same public identity,
with new listing/skills, the horoscope tool/panel, 92-day events, revised
instructions, and removal of catalogue search. It would not create a second
public plugin. An active review must finish or be cancelled with a fresh owner
decision before replacing its package. Merging #681 changes the shared live
MCP server and must not silently change the server reviewers are testing.

## Exact future release sequence — not authorized or executed

1. Claude reviews this audit and the owner decides whether the remaining
   blocks warrant continuing. Repair the existing private preview connection
   through a supported update flow; do not delete or replace its identity.
   Resolve supported preview authentication for Claude without disabling
   deployment protection or changing production.
2. Rerun the entire matrix against the same staged runtime, including the
   owner's actual iPhone and the UTC/local-date boundary. Record dates, host,
   prompts, routing, rendered panels, interactions and refusals. Isolate
   Claude requests before attributing the Origin boolean. Keep credentials
   out of evidence.
3. Record all five positive and three negative manifest cases using actual
   host UI. Save the real MP4 at the requested 0.4 path. Only then set its
   exact demo URL, rebuild generated artifacts, run `ai:package` and
   `ai:check`, push the complete packet and require exact-head CI success.
4. Obtain owner approval for the concrete merge and the handling of the
   existing 0.3.4 review. If review is active, either await its decision or,
   only with explicit approval, cancel it before replacement. Do not merge
   while reviewers are using the old server.
5. With separately approved production deployment, merge the audited change,
   verify stable `/mcp` health/tools/resources, ensure the actual video URL
   is accessible, and check existing domain proof/authentication. Do not use
   the short-lived protected preview as the review endpoint.
6. In the same existing portal identity, choose Upload plugin to make changes
   and upload the complete `zodiacs-sky-0.4.0.zip`. Inspect imported listing,
   skills, five/three cases, release notes, video and all public URLs. Resolve
   required findings. Check the same connected MCP server and rescan its
   changed tool surface. No reviewer account is needed for this no-auth
   public-sky surface; do not place private credentials in the ZIP.
7. Obtain final owner approval of the actual draft/findings. Only then submit
   with required attestations. Keep the server/schema compatible during
   review. Approval is distinct from publication: publishing needs its own
   explicit owner approval.

## Rollback plan — no destructive actions

- Before merge/submission, leave production and the 0.3.4 review intact. Fix or
  abandon the draft through new commits; retain all older packages/evidence.
  A broken private connector is not grounds to delete plugins or weaken
  protection.
- Staging: preserve this deployment/provenance. If temporarily disabling it
  is approved, make a same-source preview with `ZODIACS_MCP_ENABLED=0`, move
  only this preview alias, and verify no-store 503 `disabled` for health/POST.
  To restore, reassign the alias to the enabled deployment and verify health
  and SDK tools; refresh temporary preview access if invalidated. An expired
  protection token is not proof of application rollback. This rehearsal was
  not performed in this continuation.
- After an approved production merge, a code rollback needs owner approval:
  revert the 0.4 change on main through a reviewed PR, preserving engine pins,
  unrelated work and the existing domain proof. Deploy/verify the restored
  runtime before rescanning. Emergency disabling through the switch also
  needs explicit owner approval and a redeploy; it affects availability.
- If 0.4 is merely under review, cancel only with explicit owner approval,
  restore the prior server/package deliberately, and rerun review checks. If
  already published, upload the previous complete package as a new approved
  version through the same identity and review/publish flow. Do not assume
  an instant dashboard rollback. Hosted tool removal/rescans are separate
  from package publication and can change availability.

No release or rollback action in this section has been executed.
