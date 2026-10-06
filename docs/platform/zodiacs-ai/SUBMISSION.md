# Publisher review package

Updated 2026-10-06 against OpenAI's [submission reference], [package guide] and
[plugin guidelines]. This packet prepares owner review; it does not authorize
submission, attestations, merge, publication or production activation.

[submission reference]: https://developers.openai.com/plugins/deploy/submission
[package guide]: https://developers.openai.com/plugins/build/plugins
[plugin guidelines]: https://developers.openai.com/plugins/plugin-guidelines

## Distribution decision

| Offering | Current package | Public-directory route |
| --- | --- | --- |
| Zodiacs Sky | `integrations/packages/zodiacs-sky-0.3.3.zip`; portable manifest, one remote MCP, one skill | First public candidate. Its configured stable URL is `https://zodiacs.org/mcp`, currently disabled pending release review. |
| Zodiacs Developer | `integrations/packages/zodiacs-developer-0.3.2.zip`; nine local stdio tools and three skills | Local/private distribution remains supported. Public submission requires a remote HTTPS server or specific OpenAI support for local MCP distribution. Do not silently move personal chart calculations to a server. |
| Sky Watch and older custom profiles | Private ChatGPT app-reference ZIPs | Private testing only. ZIPs with `apps` / `.app.json` references or lifecycle hooks cannot currently be submitted. These are not public-release archives. |

The [local-to-directory guidance](https://developers.openai.com/plugins/guides/submit-claude-plugin)
requires a stable public HTTPS endpoint for the ordinary MCP submission route.
Do not strip Developer's MCP merely to pass a skills-only upload: an MCP cannot
currently be added to an existing skills-only plugin. Any genuinely skills-only
offering would need its own clear scope and owner decision.

Package 0.3.2 preserves the corrected metadata and adds local chart-record export
recovery for embedded hosts. Runtime reports 0.3.0; bundle digests identify the UI revision. The v2 Studio
resource avoids stale host HTML while v1 stays readable during tool refresh. The runtime's vendored
engine is rc.17, not an npm release. External developer recipes use published
rc.16. `integrations/packages/manifest.json` records current archive and member
hashes. Old archives and dated evidence do not establish the current candidate's
acceptance. Installed-package observations are dated evidence; an already-open chat
may retain an older process until the host reloads.

## Corrected package metadata

- Sky has three unique starter prompts, each at most 128 characters.
- Exactly five positive and three negative Sky review scenarios are packaged.
  One scenario covers capabilities plus an explicit sky calculation, retaining
  coverage of all six tools. Chart Studio remains a full positive scenario.
- Current release notes distinguish package, runtime and engine versions.
- Each package declares an included onboarding skill. The generator preserves
  onboarding, review and publication fields in the appropriate portable and
  Codex compatibility locations. The portable `extensions.com.openai` object
  takes precedence; its fields are not merged with a compatibility overlay.
- Company, icon, website, support, privacy and terms fields are present. The
  directory publisher name still comes from the verified identity selected in
  the portal, not merely from `developerName`.
- Sky's `review.demo_recording_url` is deliberately `""`. This clears the old
  calendar-only reel on import; it is an unresolved submission requirement.
  Omission or null would preserve an existing saved value.
- Reviewer credentials and private sign-in instructions remain outside ZIPs.
  Country targeting is omitted to preserve the portal's existing selection.

The older `integrations/chatgpt/chatgpt-app-submission.json` is a synchronized
reference packet, not the current ZIP upload format. Its annotation explanations
are retained as internal rationale; current review does not require annotation
justifications. Automated package checks do not replace dashboard scans.

## Required current walkthrough and scenarios

Run the exact five packaged positive scenarios and three negative scenarios on
the final connected candidate, including desktop and mobile UI. Record actual
outputs and explain any mismatch before submission. A scenario declaration is
not evidence that it passed. The current walkthrough must demonstrate Chart
Studio and the public-sky cases, with synthetic inputs only.

`evidence/chatgpt/host-capture-walkthrough.mp4` is historical rc.15 evidence: a
40-second reel of actual host captures, not a continuous recording and not proof
of the current candidate. Preserve it for history, but do not use it as the
current submission video. Add a reviewer-accessible recording URL only after
recording and verifying the current experience.

The base Sky package is anonymous and needs no reviewer login. Sky Watch is
separate and authenticated. Before any future Watch submission, prepare a
fully featured dedicated sample account that works immediately without MFA,
email/SMS approval, magic links or private-network access. Enter its credentials
and sign-in instructions only in the secure Review details form. Do not use a
real user's account or weaken the general login policy to manufacture access.
Keep that account available for later reviews.

## Portal sequence and stable endpoint

1. Use `https://platform.openai.com/plugins`. Confirm the owning organization
   and project, submission permissions and verified publisher identity.
2. Select the existing intended plugin when updating; upload its complete ZIP.
   Include the MCP in the initial public draft. Inspect Metadata & Skills and
   required skill scan findings; fix package source and upload a new version.
3. Connect the one supported remote MCP. Confirm its final URL before creating
   the public integration: the current update flow cannot change an existing
   MCP URL without support. A temporary preview URL is not the release endpoint.
4. Complete the exact domain challenge, authentication if applicable and tool
   scans. Resolve required setup/validation failures. Record the live and held
   tool definitions; a connected private profile is not a public approval.
5. Verify imported five/three cases, current walkthrough and release notes.
   Credentials belong only in Review details. Package-managed values must be
   changed through a new ZIP; explicit scalar values reapply on submission.
6. Present the concrete release packet to the owner for the reserved review and
   attestations. Only one review can be active per plugin. Approval and public
   publication are separate steps; the owner chooses when to publish.

Business verification is approved for Zodiacs LLC and the daily identity monitor
is paused. Sky 0.3.3 is uploaded to a public-submission draft, its category issue
is resolved and its skill check passed. Domain setup, tool scans and the current
walkthrough remain incomplete. The draft is not submitted or published. See
[PORTAL_REVIEW.md](./PORTAL_REVIEW.md) for actual portal findings and identifiers.
Public URLs must be accessible and identify the same publisher at final review.

## Domain challenge

When the portal supplies a challenge, record its exact URL and token privately.
Serve HTTP 200 with `Content-Type: text/plain; charset=utf-8` at the indicated
HTTPS origin's `/.well-known/openai-apps-challenge`. The body must be exactly the
token, without JSON, quotes, a token list or an added newline.

The base must be the MCP hostname or an eligible parent domain. Inspect any
existing challenge first. Do not replace another plugin's token; use an allowed
parent origin or distinct hostname, or contact support if neither is possible.
Verify the public response after the approved deployment. No token is invented
or committed to this packet.

## After publication

Metadata, assets and skills need a new complete versioned ZIP and the applicable
review/publication flow. Hosted MCP changes are scanned daily after initial
publication; Rescan can request an earlier check. Eligible tool updates can go
live after automated checks without a ZIP or a separate publish click.

Therefore a production server deployment is a potential public behavior change.
Keep the server compatible with the currently approved schemas until new
metadata is live. New tools remain unavailable until approved; held updates
leave the previous approved metadata active; removals take effect after a scan.
Stage and validate server changes before the owner-reserved production deploy,
then inspect scan findings and live availability. Do not advertise unapproved
new tools. An appeal pauses automatic MCP updates; correct valid findings and
rescan rather than filing a speculative appeal.

## Remaining release evidence

- Complete the remaining native acceptance and current walkthrough.
  [Observed host evidence](evidence/native-2026-10-06/README.md) now covers
  public-sky routing, Studio interaction, explicit sharing and manual record
  copying. Native event discovery, subscription, callback verification and stop
  pass; actual arrival, automatic renewal and worker cancellation remain unverified.
- Stable enabled endpoint, domain proof and portal tool scans; publisher identity is approved.
- Exact final commit/CI, package hashes, privacy/support reachability, rollback
  and measured capacity/cost review.
- Owner-reviewed usefulness evidence for the 9/10 product target. The small
  consenting beta in [BETA_REVIEW.md](./BETA_REVIEW.md) is our proposed quality
  plan, not an OpenAI requirement to recruit a specified number of testers.
  No testers or results currently exist; never substitute synthetic checks.

The owner handles identity documents, personal sign-in and policy attestations.
See [LAUNCH.md](./LAUNCH.md), [READINESS.md](./READINESS.md) and
[SKY_WATCH.md](./SKY_WATCH.md) for operational and private-preview gates.
