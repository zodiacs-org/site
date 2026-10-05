# Publisher review package

Refreshed 2026-10-05 for PR #618. This is a review packet, not permission to
submit, merge, publish or enable production. The exact final commit and checks
must be recorded before owner approval.

## Files and proposed listing

The proposed name is **Zodiacs**: public astronomical positions, bounded
event calendars and sky fact checks with numerical receipts. It has no account
access, personal predictions, reminders, purchase flow or hosted natal storage.

- `integrations/chatgpt/chatgpt-app-submission.json`: proposed description,
  five read-only tools, metadata, legal URLs and five positive/three negative cases.
- `integrations/packages/zodiacs-sky-0.1.1.zip`: portable public-sky candidate.
- `integrations/packages/zodiacs-developer-0.1.1.zip`: separate local stdio candidate,
  three developer skills and eight tools, pinned published rc.16 dependency.
- `integrations/packages/manifest.json`: package/member digests; run `ai:check`
  against the exact files before upload.
- `evidence/`: dated staging, native ChatGPT, routing and synthetic evaluations.
- `BETA_REVIEW.md`: consent wording, tasks and aggregate feedback worksheet.
- `QUOTAS.md`: atomic service ceiling, refusal behavior and concurrency evidence.
- `COST.md`: measured latency, provider metrics and incremental rate-card estimate.

Public legal/support destinations are the candidate's configured canonical
Zodiacs URLs. Their HTTPS reachability and exact portal-required fields must be
checked again on the submission commit. A protected 23-hour preview share is
for testing, not a stable directory endpoint. Production remains disabled.

## Walkthrough

`evidence/chatgpt/host-capture-walkthrough.mp4` is a labelled 40-second reel of
actual rc.15 ChatGPT captures: connected tool selection, astronomical result,
timezone ambiguity, native calendar and refusal recovery. It is not a continuous
screen recording. The rc.16 continuation preserves that dated evidence and adds
new protocol/widget and staging results separately. Do not describe the reel as
portal-approved or as evidence of an rc.16 host invocation.

Proposed reviewer sequence: ask for the current sky in Bangkok; ask for a bounded
seven-day calendar; open its native global and thread panels; change the display
zone; check the Sun's Libra ingress date without a timezone and then with one;
request an unsupported eclipse search and recover with a supported calendar.
Show UTC, zone, receipt version, limits and “tested, not proven” completeness.
If the verified portal requires a continuous video, record that sequence and
provide the exact reviewer-accessible URL before submission.

The packaged review URL points to the immutable rc.15 capture reel on commit
`fca11967611ab4758dc616b871ce991f82cf1cd4`. Its anonymous HEAD check returns
200 and 376,135 bytes (`application/octet-stream`, downloadable MP4). This
establishes file access, not portal acceptance or an inline video player.
Its version and selected-state scope are explicit in the packaged release notes.

The canonical privacy, terms and developer-support URLs each return HTTP 200.

## Domain challenge

The signed-in publisher portal currently blocks upload on identity verification.
No domain challenge has been supplied. No token or base domain is invented.

When the portal supplies its challenge, record its exact hostname, path and
token privately, check that the chosen hostname belongs to the owner and is the
portal's eligible MCP domain or parent, and prepare a static response:

1. Exact portal path, expected to be `/.well-known/openai-apps-challenge`.
2. HTTP 200, `Content-Type: text/plain; charset=utf-8`.
3. Body bytes exactly equal to the supplied challenge token, without JSON,
   quotes, HTML, a list of tokens or an added newline.
4. Confirm an existing challenge is not overwritten, and verify the exact
   public URL, status and bytes after the owner approves its deployment.

The exact response cannot be prepared until the portal issues the challenge.
Preparing a local file is distinct from activating a production route.

## Current package identity

The metadata-only 0.1.1 sky archive is 59,446 bytes, SHA-256
`f04d4920b196c47948237deca22145c84bba3a1bf5b23e28fd4030839bb2a912`.
The developer archive is 701,898 bytes, SHA-256
`2df4951ac18481cdb46299333b372ef0138fb51789e5cf39826382adb11565f2`.
The manifest records every member digest; `ai:check` passes. Runtime code and MCP
configurations are unchanged. Complete Site Check and Browser Evidence pass on
preceding source `c1977043bbe814f05dd12c5ac3e16ee1c36ad58e`; require checks on
the final submission head before approval. The owner-created Staging October 5
app is Connected and fresh native calendar checks pass rc.16, UTC defaults,
Bangkok display, invalid-zone refusal and recovery. Full routing/video evidence
remains dated rc.15. See [profile metadata](./PROFILE_METADATA.md) for the eight
updated custom profiles and remaining original desktop-only cloud update.

On 2026-10-05 the owner confirmed there are no testers. The beta worksheet has
no consenting results. Publisher identity verification remains incomplete; no
domain challenge or submission has been issued.

## Final owner approval

Provide the exact commit, CI result, package SHA-256 values, final endpoint and
domain proof, walkthrough URL, portal scan result, beta aggregates and measured
capacity/cost limits. The owner handles identity documents, sign-in/2FA and all
attestations. Ask for approval of that concrete packet before submitting,
merging or activating production. A scan failure, unavailable challenge or
missing beta acceptance keeps the release gate open.
