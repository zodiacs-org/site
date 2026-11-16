# Compatibility invites: consent, age and opt-in signups

Status: built behind switches that are off. Approved scope (Dias, 2026-11-09):
a person checks compatibility with a friend or partner; the other person enters
their own birth details through an invite link, never entered on their behalf;
consent on both sides; no birth details in URLs or logs; the under-13 refusal
kept and nothing collected about children; a real opt-in signup offered after
the reading. Dias delegated the product and design decisions; each is below
with its reason.

Decided by Dias on 2026-11-10 (ZOD-21): "Separate invite completion from the
daily email signup." An invite completes when its recipient's reading is made,
exactly as the released Phase 4 completion does, and the daily email offered
afterwards is a plain, separate opt-in with no link to the invite. The earlier
design, where only a confirmed signup completed an invite, kept the inviter's
positions and the link alive until a confirmation that might never come, and
let the signup route reveal which addresses already subscribe.

This amends the released Phase 4 contract
(`docs/PHASE4-SHARING-TECHNICAL-CONTRACT.md`) only while the switches are on.
Off, every Phase 4 behaviour is unchanged.

## Switches

| Switch | Where | Effect when exactly `1` |
| --- | --- | --- |
| `PUBLIC_INVITE_SIGNUP_ENABLED` | build (UI), with `PUBLIC_COMPAT_INVITES_ENABLED=1` | The recipient's own-details checkbox, the signup card for adults after their reading, the inviter's "my own chart" consent wording, and the consent version each page sends. Completion is unchanged. |
| `INVITE_SIGNUP_ENABLED` | server, with the invite contract and the daily email's double opt-in (`hasDailySunEmailProvider`) | Consent is recorded for both sides, by policy version, when the page sends a known version. Off: nothing is recorded and invites work as released. |

## The flow

1. **Inviter**, signed in, chooses one of their synced charts and ticks
   "This is my own chart, and I agree to share its positions with whoever opens
   the link". The create request carries the version of that text
   (`invite-inviter-2026-11-16.v1`), and the server records it against the
   invite only if it is a version the site has shown
   (`src/lib/invite/consent.ts`; the database keeps the same allowlist).
2. **Recipient** opens `/c/{token}/` as before. Before anything is worked out
   they tick "These are my own birth details, and I am 13 or older".
3. In their browser, their own birth date is checked: under 18 is refused
   with nothing worked out or sent (ZOD-22), and an invitation opened without
   their own date asks for it first. 18 and over gets the result. The date
   never leaves the page.
4. **Completion**: when the result shows, the invite completes exactly as the
   released completion does: token and positions destroyed, inviter notified
   if they asked. The completion request carries the version of the text the
   recipient ticked (`invite-recipient-2026-11-16.v1`), and the server records
   the recipient's consent against the completed invite only for a known
   version.
5. **Signup**, adults only and only if they want it: their address and a Sun
   sign for the daily horoscope email, with an unticked "Yes, email me the
   {sign} daily. I am 18 or older." The sign is preselected from their chart
   only when it has a birth time; otherwise they choose it. The request goes
   to the public daily subscribe route (`/api/email/subscribe`), the same one
   every daily signup form uses, and carries exactly
   `{ email, sign, consent: true, adult: true }`: no invite handle, session or
   birth detail. The route sends the site's existing daily double opt-in email.
   The card always answers "If that address is new to us, we sent one email to
   confirm.", so it reveals nothing about who already subscribes.

## Decisions

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Extend the released Phase 4 server invite, not a new system. | It already keeps birth input in the browser, puts no birth detail in a link, and has expiry, revocation and an at-most-once inviter note. |
| 2 | An invite completes when the reading is made, as released; the signup is a separate opt-in with no link to the invite (Dias, 2026-11-10, ZOD-21). | The inviter's positions and the link are destroyed as soon as they have done their job; no invite waits on a marketing opt-in; and the signup cannot reveal who subscribes. |
| 3 | The result is never gated behind an email. | The friend came for the reading; gating it would make consent less free and the result less trusted. |
| 4 | The signup is the existing daily Sun-sign email with its double opt-in, through the public subscribe route. | A real, confirmed subscription with unsubscribe, rate limits and provider gating already in production code; no new list, provider or route. |
| 5 | The checkbox is unticked and the button stays disabled until it is ticked. | Opt-in consent must be an affirmative act. |
| 6 | The recipient confirms "my own birth details" before any calculation. | Details are never entered on someone else's behalf, and the age check comes before anything is worked out. |
| 7 | Under 13: refuse, compute nothing, complete nothing, offer nothing. | Zodiacs is not directed at children under 13 and collects nothing about them. |
| 8 | 13 to 17: no reading, as under 13, and no signup. An invitation opened without the recipient's own birth date (a link or pasted positions) asks for the date first. This holds whenever invites are on, with signups on or off (ZOD-22). With no reading, the invite does not complete; it stays open until it expires or the inviter ends it, as any unread invite does. | The synastry result speaks of attraction and romance, and get_compatibility gives no reading at all under 18; the page now knows the recipient's age, so it holds back the same way. The date is checked on the device and never sent. |
| 9 | The age is worked out in the browser; only `adult: true` crosses, and only in the signup. | The birth date stays on the device, as the Phase 4 contract requires. |
| 10 | The server keeps no address, and no hash of one, against an invite. | The signup goes through the public daily route, whose identity rule is unchanged; nothing ties an address to an invitation. |
| 11 | Consent is recorded per invite and party as a policy version, with no identity, and only for a version the page sent and the server knows. | Shows consent on both sides without storing who the recipient is, and a record never names text nobody saw (for example while the server switch is on before the UI is rebuilt). |
| 12 | The inviter's wording changes to "This is my own chart" with the switch on. | An account can hold saved charts of other people; only the owner's own chart may be shared. |
| 13 | The signup card says nothing about the invitation finishing. | Consent to a marketing email must not be tied to doing a friend a favour. |
| 14 | The signup's answer is the same for every address. | A different answer for an address that already subscribes would reveal who subscribes. |
| 15 | The signup shares the daily signup's firewall rate limit. | It is the daily signup; one route and one limit. |
| 16 | The plain two-chart calculator and the `#p=` private link are unchanged. | Out of this scope; the server invite is the consented path, and changing the flagship calculator needs its own decision. |
| 17 | No analytics event is added. | The compatibility page is a private surface with analytics off. |

## What Dias needs to decide (recommendations)

1. **Migration**: apply `supabase/migrations/20261109120000_compat_invite_signups.sql`.
   It is additive: one new table (`compatibility_invite_consents`) and two
   service-role functions that record a consent version; nothing deleted and
   no personal data touched. Recommended: apply after review, then
   run `scripts/test-phase4-compat-invites-sql.sh` against a branch database.
2. **Email sending**: the signup sends only through the existing daily email
   double opt-in, so it sends nothing until `DAILY_EMAIL_ENABLED=1` and the
   Resend settings are in place in production. Recommended: keep it off until
   the daily email is open to the public; test on a Preview with the daily
   test allowlist.
3. **Production switch-on**, in order, each verified on a Preview first:
   `INVITE_SIGNUP_ENABLED=1` (server), then `PUBLIC_INVITE_SIGNUP_ENABLED=1`
   (rebuild), and only once `DAILY_EMAIL_ENABLED=1` is on in production, as
   the card offers the daily email. The order no longer matters for
   correctness: the server records only a version the page sends, and the page
   sends one only once rebuilt. Invites complete on the reading either way.
   Rolling back is the reverse; consent rows stay inert.
4. **Privacy page**: with the switch on, mention the invite consent records
   (a policy version per side, no identity) in the invitations section. The
   signup card is an ordinary daily email signup and needs no new wording.
