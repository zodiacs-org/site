# Monday Note: release steps for the weekly list on Resend

Written 12 Nov 2026 (ZOD-116, plan key P1.4). This document is the procedure
only. Writing it set nothing, sent nothing and switched nothing on. Running it
is a separate ticket (P1.5) that needs the owner's yes, and every step below
that touches Vercel, Resend or a live inbox is the owner's to do.

The Monday Note is the standalone weekly email that the public capture form
promises. `docs/EMAIL-CAPTURE.md` keeps that form hidden until six release
checks pass. This procedure meets those checks with the provider's own tools:
the note is written as a **Resend Broadcast**, sent by hand to the weekly
Segment, and Resend's own unsubscribe link and suppression handle opting out.
No new sending code is needed, and none is added here.

## What the code already does

Read from `src/lib/email/config.ts`, `api/email/subscribe.ts`,
`api/email/_confirm.ts`, `src/lib/email/provider.ts` and
`src/lib/email/opt-in-token.ts` at commit 1853a6814:

- The form (`src/components/EmailCapture.astro`) and the subscribe and confirm
  endpoints answer only when `hasStandaloneWeeklyEmailCapture` is true:
  `STANDALONE_WEEKLY_EMAIL_ENABLED` is `1`, `EMAIL_PROVIDER` is `resend`, both
  Resend keys are present **and differ**, `RESEND_FROM_EMAIL` is set,
  `EMAIL_CONFIRM_SECRET` is at least 32 characters, `RESEND_SEGMENT_ID` is a
  valid Segment ID, and it differs from `RESEND_DAILY_SEGMENT_ID` if that is
  set. Otherwise both endpoints answer 503 and the form does not render.
- The form is decided at build time, so a settings change takes effect only
  after a redeploy.
- `POST /api/email/subscribe` first checks the Vercel Firewall rule
  `zodiacs-email-subscribe`. If the rule is missing or the check fails, it
  answers 503 and sends nothing. Over the limit it answers 429 with
  `Retry-After: 60`.
- A valid submission sends one confirmation email through `RESEND_API_KEY`
  from `RESEND_FROM_EMAIL`. It creates no Contact. The link is
  `/api/email/confirm?token=...` on the origin in `EMAIL_CONFIRM_BASE_URL`
  (default `https://zodiacs.org`; it must be HTTPS).
- The same address submitted again within 10 minutes on the same server
  instance gets the same "check your inbox" answer but no second email. If
  Resend fails, the endpoint answers 502 and releases that hold, so a real
  retry can send.
- Opening the link (`GET`) changes nothing. It shows a page with a confirm
  button. Pressing it (`POST`) creates the Contact through
  `RESEND_CONTACTS_API_KEY`, with `unsubscribed: false`, the optional sign in
  the `sun_sign` property (or `RESEND_SIGN_PROPERTY`), and membership of
  `RESEND_SEGMENT_ID`.
- If the Contact already exists, Resend answers 409 and the site treats it as
  done. It does **not** reverse an earlier unsubscribe.
- The token is encrypted with a key derived from `EMAIL_CONFIRM_SECRET` and
  lasts 48 hours. An expired or altered token gets the "link not valid" page
  (400).
- The site's own unsubscribe endpoints serve the account digest and the daily
  list, not this list. For the Monday Note, unsubscribing is Resend's.

## Settings this procedure uses

Named here, never their values. Values are entered by the owner in Vercel →
Project `zodiacs-org` → Settings → Environment Variables, and are never pasted
into the repo, a ticket, a log or proof files.

| Setting | What it is |
| --- | --- |
| `EMAIL_PROVIDER` | Set to the Resend adapter name. |
| `RESEND_API_KEY` | Sending access key, used only to send the confirmation email. |
| `RESEND_CONTACTS_API_KEY` | A second, different key with Contact and Segment access (Resend's sending-only permission does not grant it). The capture stays hidden if the two keys are equal. |
| `RESEND_FROM_EMAIL` | The confirmation email's sender, on a domain verified in Resend. |
| `EMAIL_CONFIRM_SECRET` | A new random value of at least 32 bytes, made only for this list. |
| `RESEND_SEGMENT_ID` | The ID of the weekly Segment in Resend → Contacts → Segments. Must not equal `RESEND_DAILY_SEGMENT_ID`. |
| `STANDALONE_WEEKLY_EMAIL_ENABLED` | The release switch. `1` shows the form and opens the endpoints. |
| `EMAIL_CONFIRM_BASE_URL` | Optional. Leave unset in Production. Set it in the Preview scope only, to the Preview deployment's HTTPS origin, so the test confirmation link opens the Preview and not production. |

## Cost

Resend's marketing email (Broadcasts) is free up to 1,000 marketing contacts,
then $40 a month (Resend public pricing, fetched 11 Nov 2026; not re-checked
for this document). Check the pricing page again before the list nears 1,000
confirmed Contacts; going over is a spending decision for the owner.

## Where proof goes

Save proof in a new folder `docs/platform/evidence/monday-note-release-YYYYMMDD/`
on the P1.5 branch, one file per step (`step-1.md`, `step-2.png` and so on).
Proof never shows an email address, a key, a secret or a Segment ID. Crop or
blur addresses in screenshots, and where an address must be identified, write
the first 8 characters of its SHA-256 instead, for example
`printf '%s' 'address' | sha256sum | cut -c1-8` run locally and not saved to
shell history.

## Before you start

- A new fixture address that the owner controls and that has never been on any
  Zodiacs list (not the daily cohort, not an account). Call it fixture A.
  A second one, fixture B, is needed for the production smoke check.
- The owner-approved postal address and the Monday Note's first draft
  (P1.3) to hand.
- A Preview deployment of `main` (or of the P1.5 branch) that you can open in
  a browser. Steps 3 to 6 run there first, because the confirm endpoint does
  not answer while the switch is off.

## The procedure

Steps 1 to 6 are the six release checks in `docs/EMAIL-CAPTURE.md`, in the
same order. Step 7 switches the form on. Do not skip ahead: each step's proof
is the condition for the next.

### Step 1. Legal identity and postal address

- **Who:** the owner. An agent may do the read-only page check.
- **Where:** https://zodiacs.org/terms/ and https://zodiacs.org/privacy/ in a
  browser; `docs/OWNER-SETUP-RUNBOOK.md` §1b.
- **Do:**
  1. Confirm both live pages name Zodiacs LLC, a New Mexico limited liability
     company, as operator and data controller, and match
     `src/pages/terms/index.astro` and `src/pages/privacy/index.astro` on
     `main`.
  2. The owner chooses the postal address the note will print and confirms it
     is genuinely usable for the operator and can receive mail. A PO box or
     registered-agent address is not automatically enough (§1b).
  3. Confirm the privacy page describes this list. Today its Email section
     covers the account digest and sign-in mail only, and says nothing about a
     standalone weekly note or click counting (see Step 2). If it still does
     not, stop: the wording change is a separate legal PR that needs the
     owner's yes.
- **Proof:** `step-1.md` with the date, the deployed commit of both pages,
  the owner's written approval of the postal address (the address itself goes
  only into the Resend footer, not into the repo), and a link to the merged
  privacy wording.

### Step 2. The sender: a Resend Broadcast to one Segment

- **Who:** the owner.
- **Where:** Resend dashboard (Domains, API Keys, Contacts → Segments,
  Broadcasts) and Vercel environment variables.
- **Do:**
  1. In Resend → Domains, confirm the sending domain is verified.
  2. In Resend → Contacts → Segments, create one Segment for the Monday Note.
     Do not reuse the daily Segment. Confirm it holds 0 Contacts.
  3. In Resend → API Keys, create two keys: one with sending access only, one
     with the access that Contacts and Segments need. They must be different
     keys.
  4. Decide click counting. Resend can count clicks per Broadcast if click
     tracking is turned on for the domain; that rewrites links through
     Resend. Leave open tracking off: it is a pixel. If the owner does not
     approve click tracking (and the matching privacy line in Step 1), measure
     clicks instead with a plain tag on each link, such as
     `?src=monday-note-YYYY-MM-DD`, counted in site analytics. A tag never
     carries anything about the reader.
  5. In Resend → Broadcasts, make a reusable draft named "Monday Note
     template": From on the verified domain, a plain subject, a footer with
     the operator name, the approved postal address, a one-line reason the
     reader gets the note, and Resend's unsubscribe link (the
     `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder, or the editor's built-in
     unsubscribe footer). Use the editor's preview to check the unsubscribe
     link renders.
  6. In Vercel, Preview scope only, enter `EMAIL_PROVIDER`, `RESEND_API_KEY`,
     `RESEND_CONTACTS_API_KEY`, `RESEND_FROM_EMAIL`, a new
     `EMAIL_CONFIRM_SECRET`, `RESEND_SEGMENT_ID`,
     `EMAIL_CONFIRM_BASE_URL` (the Preview origin) and
     `STANDALONE_WEEKLY_EMAIL_ENABLED`=`1`. Nothing in the Production scope
     changes in this step.
  7. Redeploy the Preview so the form is built in.
- **Proof:** `step-2.png` showing the verified domain, the empty Segment and
  the template's preview with the footer and unsubscribe link (no addresses
  or IDs visible); `step-2.md` listing which settings were entered in which
  scope (names only), the click-counting decision, and the Preview deployment
  URL.

### Step 3. Fixture A: the confirmation email and its link create nothing

- **Who:** the owner (it uses the fixture inbox).
- **Where:** the Preview deployment; the fixture A inbox; Resend → Contacts.
- **Do:**
  1. On the Preview, find the capture form (horoscope page, footer or chart
     result) and submit fixture A, with a sign.
  2. Confirm the page says to check the inbox.
  3. In Resend → Contacts, search for fixture A: there is no Contact. The
     weekly Segment still holds 0.
  4. Open the confirmation email. Check the sender, that the link points at
     the Preview origin and that the message loads no remote images.
  5. Open the link (this is the `GET`). A page with a confirm button appears.
     Do not press it yet.
  6. In Resend → Contacts, search again: still no Contact, Segment still 0.
- **Proof:** `step-3.md` with the time of each action, fixture A's hash
  prefix, and the Contact count of the Segment after the submit and after the
  `GET` (both 0); screenshots with the address hidden.

### Step 4. The confirm button creates the Contact in the weekly Segment

- **Who:** the owner.
- **Where:** the confirm page from Step 3; Resend → Contacts → Segments.
- **Do:**
  1. Press the confirm button (this is the `POST`). The "confirmed" page
     appears.
  2. In Resend → Contacts → Segments, open the weekly Segment: it now holds 1
     Contact, fixture A, subscribed, with the chosen sign in `sun_sign`.
  3. Confirm fixture A is in no other Segment, and in particular not the
     daily one.
- **Proof:** `step-4.md` with the time of the `POST`, the Segment count
  (1), the sign property value, and a screenshot with the address hidden.

### Step 5. One live test note with a working unsubscribe

- **Who:** the owner. This sends one live email and needs the owner's
  explicit yes at the moment of sending.
- **Where:** Resend → Broadcasts; the fixture A inbox.
- **Do:**
  1. Dry run: open the weekly Segment and confirm it holds exactly 1 Contact
     (fixture A). If it holds anything else, stop.
  2. Duplicate the "Monday Note template", paste a test note, and send it to
     the weekly Segment.
  3. In the Broadcast's results, confirm 1 delivered.
  4. In the fixture inbox, check the message: sender, footer, postal address,
     and that it offers one-click unsubscribe.
  5. Press the unsubscribe link. In Resend → Contacts, fixture A now shows as
     unsubscribed.
  6. Send a second test Broadcast to the same Segment. Confirm Resend
     delivers 0 and fixture A receives nothing within an hour.
- **Proof:** `step-5.md` with both Broadcasts' times and delivered counts
  (1, then 0), fixture A's hash prefix, the unsubscribed status, and
  screenshots with the address hidden. Do not record the address.

### Step 6. Retry, duplicate, expiry, rate limit and failure

- **Who:** the owner for the inbox and dashboard parts; an agent may run the
  contract tests.
- **Where:** the Preview; the fixture inboxes; Resend; a terminal.
- **Do:**
  1. **Duplicate confirm.** Press the Step 4 confirm button again, or confirm
     a fresh link for fixture A. The page says confirmed, and fixture A stays
     **unsubscribed** in Resend: a duplicate never reverses an unsubscribe.
  2. **Duplicate submit.** Submit fixture B twice within a minute. Both
     answers say to check the inbox. Usually only one email arrives (the
     10-minute hold is per server instance, so two can occasionally arrive;
     that is acceptable, more than two is not).
  3. **Expiry.** Leave fixture B's confirmation unopened for 48 hours, then
     open it. The "link not valid" page appears and no Contact is made. Also
     change one character of the token in a fresh link: same result.
  4. **Rate limit.** From one network, submit the form (any address you own)
     11 times within 60 seconds. The 11th answers 429. A browser shows an
     error; a script sees `Retry-After: 60`. If any submit answers 503 instead,
     the Firewall rule `zodiacs-email-subscribe` is missing for this project:
     stop and see `docs/OWNER-SETUP-RUNBOOK.md` §3.
  5. **Failure and retry.** Provider failure cannot be caused safely on a live
     account, so it is covered by the contract tests. Run
     `npm test -- --run src/lib/email/email.test.ts` and confirm it passes.
     These tests prove request shape and ordering only, not live behaviour,
     which Steps 3 to 5 cover.
- **Proof:** `step-6.md` with each check's time and result, fixture B's hash
  prefix, the HTTP status seen for the 11th submit, and the test run's summary
  line.

### Step 7. Switch the form on in production

- **Who:** the owner, after Steps 1 to 6 all have proof. Log it in the Merge
  log issue (#879).
- **Where:** Vercel → Project `zodiacs-org`; Resend.
- **Do:**
  1. Remove fixture A and fixture B from the weekly Segment (delete the
     Contacts), so the list starts empty. Confirm the Segment holds 0.
  2. In Vercel, Production scope, enter the same names as Step 2 except
     `EMAIL_CONFIRM_BASE_URL` (leave unset, so links use
     `https://zodiacs.org`). Use the same weekly Segment. Then set
     `STANDALONE_WEEKLY_EMAIL_ENABLED`=`1` last.
  3. Redeploy production.
  4. Check https://zodiacs.org shows the form in its placements, submit
     fixture B, confirm it, and see it in the Segment. Then delete fixture B
     from the Segment again.
  5. Remove the Preview-scope values entered in Step 2, or keep them only if
     the owner wants the Preview to stay testable.
  6. Update the "Current release state" section of `docs/EMAIL-CAPTURE.md`
     to say the list is live, in the P1.5 PR.
- **Proof:** `step-7.md` with the deploy URL and commit, the time the switch
  was set, the smoke check result, and the #879 log link.
- **Rollback:** unset `STANDALONE_WEEKLY_EMAIL_ENABLED` in Production and
  redeploy. The form disappears and both endpoints answer 503. Confirmed
  Contacts stay in Resend; do not delete them without the owner's yes.

## The weekly routine (every Monday, after release)

About fifteen minutes. The owner, or whoever the owner names, sends it.

1. **Build the draft.** Run the weekly note builder from P1.2 once it is
   merged; until then, write the note by hand from the week's published sky
   and horoscopes. Follow the voice rules: plain, no em or en dashes, a
   "Reading confidence NN%" label on each forecast, no betting, market,
   health or election calls, and no token, market or crypto language.
2. **Paste.** In Resend → Broadcasts, duplicate "Monday Note template" and
   paste the draft. Keep the footer, postal address and unsubscribe link as
   they are. If links carry the plain `src` tag, set this week's date.
3. **Check.** Use the editor's preview and send a test to an owner address.
   Read it once on a phone.
4. **Send to the Segment.** Choose the weekly Segment and nothing else, then
   send (or schedule for Monday morning).
5. **Record.** The next day, copy from the Broadcast's results into the
   scoreboard (P6.2): send date, Segment size, delivered, unique clicks (or
   the tagged visits from site analytics), unsubscribes, bounces and
   complaints. Click rate is unique clicks divided by delivered. The T1 test
   reads its numbers from here. Record counts only, never addresses.

If a complaint rate or bounce rate looks unusual, pause the next send and tell
the owner before Monday.
