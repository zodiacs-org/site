# Publisher review package

Prepared 2026-10-02 for PR #618. This is a review packet, not permission to
submit, merge, publish or enable production. The exact final commit and checks
must be recorded before owner approval.

## Files and proposed listing

The proposed name is **Zodiacs**: public astronomical positions, bounded
event calendars and sky fact checks with numerical receipts. It has no account
access, personal predictions, reminders, purchase flow or hosted natal storage.

- `integrations/chatgpt/chatgpt-app-submission.json`: proposed description,
  five read-only tools, metadata, legal URLs and five positive/three negative cases.
- `integrations/packages/zodiacs-sky-0.1.0.zip`: portable public-sky candidate.
- `integrations/packages/zodiacs-developer-0.1.0.zip`: separate local stdio candidate,
  three developer skills and eight tools, pinned published rc.16 dependency.
- `integrations/packages/manifest.json`: package/member digests; run `ai:check`
  against the exact files before upload.
- `evidence/`: dated staging, native ChatGPT, routing and synthetic evaluations.
- `BETA_REVIEW.md`: consent wording, tasks and aggregate feedback worksheet.
- `QUOTAS.md`: atomic service ceiling, refusal behavior and concurrency evidence.

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

## Final owner approval

Provide the exact commit, CI result, package SHA-256 values, final endpoint and
domain proof, walkthrough URL, portal scan result, beta aggregates and measured
capacity/cost limits. The owner handles identity documents, sign-in/2FA and all
attestations. Ask for approval of that concrete packet before submitting,
merging or activating production. A scan failure, unavailable challenge or
missing beta acceptance keeps the release gate open.
