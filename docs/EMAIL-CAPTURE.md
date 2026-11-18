# Standalone weekly email capture

This is the public email-and-optional-sign form used by the chart, horoscope,
and footer placements. It is separate from both the account-linked saved-chart
digest and the frozen daily-email canary. It sends only a normalized email
address and an optional self-declared sun-sign slug to the selected provider;
it never reads or sends chart, birth, profile, or saved-chart data.

## Current release state: keep hidden

The standalone capture promises a weekly forecast, but this repository does
not contain a sender that reads the standalone Resend Segment (or the
equivalent Buttondown/Loops list). The account weekly sender reads Supabase
account preferences and saved charts instead. The existing email unsubscribe
endpoints serve the account digest and daily lists, not this standalone list.

Provider credentials are therefore not a release signal. The component and
weekly lifecycle endpoints remain unavailable unless
`STANDALONE_WEEKLY_EMAIL_ENABLED=1` is also present. Resend additionally
requires `RESEND_SEGMENT_ID`. Leave the release flag unset: no sender and
complete unsubscribe lifecycle have been accepted, and this remediation does
not authorize creating or enabling either one.

The chosen sender for this list (the Monday Note) is the provider's own
broadcast tool, sent by hand: a Resend Broadcast to the weekly Segment, with
Resend's unsubscribe link and suppression. No new sending code is planned.
`docs/MONDAY-NOTE-RELEASE.md` turns the gate below into an ordered procedure
with who, where and what proof for each step, plus the weekly routine. It has
not been run; the flag stays unset until it is, with the owner's yes.

The birth-chart placement has an additional client-side reveal condition after
a chart is computed, but that is not a substitute for the server-side release
gate.

## Future release gate

A separately authorized release must satisfy every item below before setting
`STANDALONE_WEEKLY_EMAIL_ENABLED=1`:

1. Verify the current legal operator/controller identity is deployed and the
   message uses a valid owner-approved postal address. The committed Terms and
   Privacy pages already name Zodiacs LLC; see the remaining address and
   authorization requirements in `docs/OWNER-SETUP-RUNBOOK.md` §1b.
2. Implement and review a real weekly sender, or configure and document a
   Resend Broadcast/Automation lifecycle, that selects only the intended
   Segment and includes the provider's unsubscribe control. Merely collecting
   Contacts into a Segment is not delivery.
3. Use a new owner-controlled fixture address to submit the public form. Verify
   that sending the confirmation and opening its scanner-safe `GET` create no
   Contact or Segment membership.
4. Submit the confirmation form's explicit `POST`. In **Resend → Contacts →
   Segments**, verify that the Contact appears in the intended weekly Segment
   only after that POST. “Audiences” is deprecated terminology.
5. Send a limit-one forecast canary through the actual standalone weekly
   sender implemented in step 2. That release must document its exact sender
   or provider procedure and its dedicated secret for the owner-controlled
   recipient; no such standalone sender or canary command exists here yet.
   First prove a dry run selects that address or nobody, then obtain explicit
   approval for one live message. Keep the address out of dispatch inputs and
   logs; record delivery counts and a recipient hash prefix. Exercise that
   message's unsubscribe link and verify provider suppression or list removal,
   then verify the next eligible send does not deliver.
6. Confirm retry, duplicate-contact, expiry, rate-limit, and failure behavior.
   Only then may the owner explicitly enable the standalone release flag and
   redeploy.

Do not treat mocked tests as provider acceptance. They prove the code's request
shape and scanner-safe ordering, not live Segment membership, cadence, or
unsubscribe suppression.

The **Daily Email** workflow and `DAILY_EMAIL_CANARY_TO` exercise only the
confirmed daily test cohort. **Weekly Digest** and `DIGEST_CANARY_TO` exercise
the account-linked digest described in `docs/WEEKLY-DIGEST.md`. Neither sends
to the standalone weekly list, so their receipts cannot satisfy step 5.

## Dormant adapter contract

Choose exactly one provider with `EMAIL_PROVIDER=resend|buttondown|loops`.
These values configure an adapter; they do not override the standalone release
gate.

### Resend

Adapter prerequisites:

- `RESEND_API_KEY` — server-only sending-access key used for confirmation
  delivery
- `RESEND_CONTACTS_API_KEY` — a different server-only key with the Contact and
  Segment access required by the lifecycle
- `RESEND_FROM_EMAIL` — verified confirmation sender
- `EMAIL_CONFIRM_SECRET` — an independently generated random value of at least
  32 bytes (for example, `openssl rand -base64 48`); derives the AES-256-GCM key
  for the opaque 48-hour opt-in token
- `RESEND_SEGMENT_ID` — the standalone weekly Segment assigned only after
  explicit confirmation
- Optional `EMAIL_CONFIRM_BASE_URL` — HTTPS origin, defaulting to
  `https://zodiacs.org`
- Optional `RESEND_SIGN_PROPERTY` — Contact property for the selected sign,
  defaulting to `sun_sign`

The sending key and Contacts key must differ. Resend's sending-only permission
does not grant Contact and Segment access.

The first request sends a first-party encrypted confirmation without creating
a Contact or exposing the normalized address in the URL. Link `GET` is
read-only for mail-scanner safety; explicit form `POST`
creates the Contact with its weekly Segment. A duplicate Contact response is a
safe no-op and is deliberately not used to reverse a prior unsubscribe. For
that reason, live acceptance must inspect actual Segment membership rather
than infer it from a success page.

Current terminology and API references:

- [Contacts](https://resend.com/docs/api-reference/contacts/create-contact)
- [Segments](https://resend.com/docs/dashboard/segments/introduction)
- [Migration from Audiences to Segments](https://resend.com/docs/dashboard/segments/migrating-from-audiences-to-segments)

The daily canary uses a distinct `RESEND_DAILY_SEGMENT_ID`. Its database
preference is consent authority; provider membership is only routing metadata.
Both configured IDs must match the provider's 6–128 character identifier
contract, and the daily and standalone weekly Segment IDs must never match.

### Buttondown

`BUTTONDOWN_API_KEY` selects the adapter. It omits Buttondown's `type` field so
the provider creates an `unactivated` subscriber and sends its native
double-opt-in message. The optional sign is stored as `sun_sign` metadata.
Duplicate submissions do not overwrite existing consent history.

This DOI behavior does not prove that a weekly publication or its unsubscribe
lifecycle exists. Keep the standalone release flag off until the future release
gate passes for the chosen Buttondown list.

### Loops

Adapter prerequisites:

- `LOOPS_FORM_ENDPOINT` — the exact
  `https://app.loops.so/api/newsletter-form/...` endpoint
- `LOOPS_DOUBLE_OPT_IN_CONFIRMED=1` — acknowledgement that provider DOI is
  enabled and its confirmation email is published
- Optional `LOOPS_MAILING_LIST_ID`
- Optional `LOOPS_SIGN_PROPERTY`, defaulting to `sunSign`

Only the provider form endpoint is accepted because Loops applies double
opt-in there rather than to ordinary Contacts API calls. This still does not
prove a weekly sender or unsubscribe lifecycle; keep the standalone release
flag off until the future release gate passes.

## Daily-email boundary

Daily email remains frozen to its existing owner-controlled test cohort. The
admin bootstrap can exercise the already documented canary path without
setting `DAILY_EMAIL_ENABLED` or exposing public capture, but it is not a
public-release switch. Public daily enrollment, broader cohorts, new Segment
configuration, and daily feature-flag changes are outside this remediation.

## Contract tests

`src/lib/email/email.test.ts` covers release gating, input minimization, token
expiry/tampering, scanner-safe Resend confirmation, post-confirmation Segment
request shape, and the Buttondown adapter. Run:

```bash
npm test -- --run src/lib/email/email.test.ts
```
