# Compatibility invites: consent, age and opt-in signups

Status: built behind switches that are off. Approved scope (Dias, 2026-11-09):
a person checks compatibility with a friend or partner; the other person enters
their own birth details through an invite link, never entered on their behalf;
consent on both sides; no birth details in URLs or logs; the under-13 refusal
kept and nothing collected about children; every completed invite creates a
real opt-in signup. Dias delegated the product and design decisions; each is
below with its reason.

This amends the released Phase 4 contract
(`docs/PHASE4-SHARING-TECHNICAL-CONTRACT.md`) only while the switches are on.
Off, every Phase 4 behaviour is unchanged.

## Switches

| Switch | Where | Effect when exactly `1` |
| --- | --- | --- |
| `PUBLIC_INVITE_SIGNUP_ENABLED` | build (UI), with `PUBLIC_COMPAT_INVITES_ENABLED=1` | The recipient's own-details and age checkbox, the under-13 refusal, no completion when the result shows, the signup card for adults, and the inviter's "my own chart" consent wording. |
| `INVITE_SIGNUP_ENABLED` | server, with the invite contract and the daily email's double opt-in (`hasDailySunEmailProvider`) | `/api/compatibility/invite-signup` answers, consent is recorded for both sides, and a confirmed daily-email signup completes the invites staged for that address. Off: 404. |

## The flow

1. **Inviter**, signed in, chooses one of their synced charts and ticks
   "This is my own chart, and I agree to share its positions with whoever opens
   the link". The server records that consent against the invite by policy
   version (`invite-inviter-2026-11-09.v1`).
2. **Recipient** opens `/c/{token}/` as before. Before anything is worked out
   they tick "These are my own birth details, and I am 13 or older".
3. In their browser, their own birth date is banded: under 13 is refused
   with nothing worked out or sent; 13 to 17 gets the result and no signup;
   18 and over gets the result, then the signup card. The date never leaves
   the page.
4. **Signup**, adults only and only if they want it: their address and their
   own Sun sign for the daily horoscope email, with an unticked "Yes, email me
   the {sign} daily. I am 18 or older." The request carries exactly
   `{ email, sign, consent: true, adult: true }` and the invite's session
   handle; anything else, a birth detail included, is refused. The server
   stages the invite against a keyed hash of the address (records the
   recipient's consent, `invite-recipient-2026-11-09.v1`) and sends the
   site's existing daily double opt-in email.
5. **Completion**: when they click the confirmation link, every still-active
   invite staged for that address completes exactly as the released
   completion does (token and positions destroyed, inviter notified if they
   asked). An address already confirmed for the daily email completes at once.
   Without a confirmed signup the invite stays open and expires after 14 days.

## Decisions

| # | Decision | Reason |
| --- | --- | --- |
| 1 | Extend the released Phase 4 server invite, not a new system. | It already keeps birth input in the browser, puts no birth detail in a link, and has expiry, revocation and an at-most-once inviter note. |
| 2 | An invite is "completed" only by a confirmed opt-in signup. | Makes "every completed invite creates a real opt-in signup" true by definition, without a fake or pre-ticked signup. |
| 3 | The result is never gated behind an email. | The friend came for the reading; gating it would make consent less free and the result less trusted. |
| 4 | The signup is the existing daily Sun-sign email with its double opt-in. | A real, confirmed subscription with unsubscribe, rate limits and provider gating already in production code; no new list or provider. |
| 5 | The checkbox is unticked and the button stays disabled until it is ticked. | Opt-in consent must be an affirmative act. |
| 6 | The recipient confirms "my own birth details" and "13 or older" before any calculation. | Details are never entered on someone else's behalf, and the age gate comes before anything is worked out. |
| 7 | Under 13: refuse, compute nothing, complete nothing, offer nothing. | Zodiacs is not directed at children under 13 and collects nothing about them. |
| 8 | 13 to 17: the result, no signup offered. | Consent ages for marketing email reach 16 in parts of the EU, and the site already holds romance framing back under 18; the adult line is the safe one. |
| 9 | The age is worked out in the browser; only `adult: true` crosses. | The birth date stays on the device, as the Phase 4 contract requires. |
| 10 | The server keeps a keyed hash of the address, never the address. | The same identity rule the daily email uses; the address lives only with the email provider. |
| 11 | Consent is recorded per invite and party as a policy version, with no identity. | Shows consent on both sides without storing who the recipient is. |
| 12 | The inviter's wording changes to "This is my own chart" with the switch on. | An account can hold saved charts of other people; only the owner's own chart may be shared. |
| 13 | The recipient is told that confirming finishes the invitation and what the inviter's note does and doesn't say. | Informed consent: they know the one effect their signup has on someone else. |
| 14 | An address already confirmed for the daily email completes the invite at once. | They have already opted in; a second confirmation would be noise and would leave the invite open. |
| 15 | The signup shares the daily signup's firewall rate limit. | It is a daily signup; one limit covers both paths. |
| 16 | The plain two-chart calculator and the `#p=` private link are unchanged. | Out of this scope; the server invite is the consented path, and changing the flagship calculator needs its own decision. |
| 17 | No analytics event is added. | The compatibility page is a private surface with analytics off. |

## What Dias needs to decide (recommendations)

1. **Migration**: apply `supabase/migrations/20261109120000_compat_invite_signups.sql`.
   It is additive: two new tables and three service-role functions; nothing
   deleted and no personal data touched. Recommended: apply after review, then
   run `scripts/test-phase4-compat-invites-sql.sh` against a branch database.
2. **Email sending**: the signup sends only through the existing daily email
   double opt-in, so it sends nothing until `DAILY_EMAIL_ENABLED=1` and the
   Resend settings are in place in production. Recommended: keep it off until
   the daily email is open to the public; test on a Preview with the daily
   test allowlist.
3. **Production switch-on**, in order, each verified on a Preview first:
   `INVITE_SIGNUP_ENABLED=1` (server), then `PUBLIC_INVITE_SIGNUP_ENABLED=1`
   (rebuild). Rolling back is the reverse; staged rows stay inert.
4. **Privacy page**: with the switch on, add the invite signup to the daily
   email section (address with the provider, keyed hash, Sun sign; invite
   consent records by policy version). Recommended wording is in the PR.
