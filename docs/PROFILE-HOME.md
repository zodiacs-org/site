# Your page: /profile/ as a personal, bookmarkable home

Status: built on `claude/zodiacs-profile-network-3znuca`. It is local-first and
needs no new server surface, flag, or migration. The connected, account-backed
circle in §5 is a proposal only, and needs owner decisions first.

## 1. What changed for a visitor

Once a saved chart is marked as theirs, `/profile/` stops being a generic list
and becomes their page:

- **Header** (`ProfileIdentity`). It shows:
  - their initial (see **Initials** below);
  - their name, or "Your chart";
  - their Sun, Moon and rising (see §3 for when these are withheld);
  - one line from today's reading (`todayLead` in
    `src/lib/profile/today-reading.ts`, the same computation as the Today
    card): the Moon's house when the birth time is known and the houses are
    whole sign, else today's closest aspect, under the edition's date and
    Moon phase. The house lines say "today", so the line is left out
    whenever the committed edition is not the current UTC day;
  - the site's usual trio of actions: one white primary ("Open my full
    daily brief"), one ghost ("Send your card"), and a quiet link ("Edit
    your name"). Editing opens in place of that row, so the header never
    shows two primaries. While you type a name, the header shows it and its
    initial live. "Send your card" opens the sign-level big three card at
    `/big-three/` for the chart marked as yours, by its opaque saved-chart id
    (`#profileChartId=`), never by birth details.

  Before hydration, and on any profile without an explicit self chart, it
  renders the page's existing introduction and H1 unchanged. When charts
  exist but none is marked as theirs, it asks which one is. It shows names
  and initials only, never birth details. The choice goes through the
  existing `markPrimarySelfChart`.
- **Initials** (`Initial`). Everyone on the page, you included, is shown by
  the first letter of the name they chose, in EB Garamond on their Sun
  sign's pastel colour: a sibling of the sign icons. There are no pictures
  and no photo upload (an earlier preview had a drawn chart mark, the Sun
  sign disc, and a device-only photo; the owner chose the initial alone).
  - No chosen name (an automatic chart name, or a card sent without one)
    means no letter: the colour stays as a ring. Your own header shows a
    dashed ring with "+" that opens "Add your name".
  - A Sun sign the chart cannot settle (see §3) takes neutral ink.
- **Your people** (`ProfilePeople`). This lists charts explicitly saved for
  someone else, plus received chart cards. Each gets:
  - an initial;
  - the next date: a birthday for a saved chart, or the Sun's return for a
    card;
  - Compare, via the existing `?a=&b=` link or, for cards, a saved
    comparison opened with `?pair=`;
  - Chart;
  - Remove (cards only; two-step).

  Rows are ordered by the next date, and each row's stamp says how far off
  it is ("in 8 days"), brighter within 14 days. That replaces a separate
  "Coming up" list.
- **Chart cards** (retired as links on 14 November 2026). Card links are no
  longer made. A card link, `/profile/#card=c1.…`, carried the name the
  sender chose and positions that give the birth date and time to the
  minute, and the 9 November 2026 audit (Decision A) found that links must
  never carry those. "Send your card", in the header, in Your people and
  after a received card is added, now opens the sign-level big three card
  instead. Cards people already sent still open: the recipient's
  `/profile/` reads one once, strips it from the address bar, shows the card,
  and stores it only if they press "Add to your people". Cards already kept
  stay in Your people with Compare, Chart and Remove.
  `src/lib/profile/card-link-writers.test.ts` keeps any page from calling the
  card link builder, which stays only to make test fixtures.
- **Keep it close** (`ProfileKeepClose`). A one-time, dismissible note:
  - browser install when offered;
  - Share → Add to Home Screen on iOS;
  - the menu route on Android Chrome;
  - ⌘D / Ctrl+D on desktop;
  - the short address.
- **Bookmarkability.** Four pieces:
  - `zodiacs.org/me` redirects to `/profile/` (`vercel.json`, a
    non-permanent redirect so the alias can change later).
  - The web app manifest gains shortcuts to Your page and Today, generated
    by `scripts/build-pwa-icons.mjs` from `src/strings/pwa.en.mjs`.
  - On `/profile/` the tab title becomes the person's name, and the tab
    icon becomes their initial, drawn in the browser. A bookmark made there
    is personal.
  - The nav's Saved charts link shows their initial sitewide once a chart
    is marked as theirs and named. The label stays for screen readers.
- **Onboarding.** Saving your own chart on the English calculator now
  confirms "Saved as your chart. Open your page — it's at zodiacs.org/me…".

## 2. Where it lives

| Piece | File |
|---|---|
| Settled signs (pure, no ephemeris) | `src/lib/profile/settled-signs.ts` |
| Initials | `src/lib/profile/initial.ts`, `src/components/Initial.tsx` |
| Name store (`zodiacs.me.v1`) | `src/lib/profile/me.ts`, `page-keys.ts` |
| Card codec (`c1.`) | `src/lib/profile/card-link.ts` |
| Received cards (`zodiacs.circle.v1`) | `src/lib/profile/circle.ts` |
| People, dates, compare | `src/lib/profile/your-people.ts`, `people-compare.ts` |
| v2 account gate signal | `src/lib/profile/surface-gate.ts` |
| Islands | `src/islands/ProfileIdentity.tsx`, `ProfileCardInbox.tsx`, `ProfilePeople.tsx`, `ProfileKeepClose.tsx` |
| Styles | `src/styles/profile-home.css` |
| Nav initial | `src/components/SiteNav.astro`. This is a classic inline script, because the processed nav script is ~4 KB and must stay under Vite's inline limit, or every zero-JS page would gain a nav chunk. |

## 3. Rules this follows

- **Only the explicit self chart is "you".** A friend's chart never becomes
  the header or the nav initial, however recently it was saved. An
  unclassified legacy chart is never listed as a person.
- **No birth-data fields in a card.** The `c1.` grammar wraps one v2
  positions token with a name and a time-known bit. It has no field for
  date, time, place, coordinates or timezone.
  - A card leaves the device, so its token comes from
    `encodeSharedPositionsLink`, like every other code that does: ASC and MC
    to the whole degree, planets to 0.001°. The decoder refuses a card
    whose angles are any finer.
  - The planets still give the birth date and time, which is why card
    links are no longer made. The privacy page says so (claims ledger
    `priv.chart-cards`).
  - Angles travel only when the birth time is known.
  - An automatic chart name ("Leo Sun · 1990-08-14") contains the birth
    date, so it is never used as a person's name or as a card label.
- **Received cards are never re-shared.** They can be compared and opened
  read-only (`/birth-chart/#p=`), but never made into a card.
- **Unsettled placements are not shown as settled.** Without a birth time:
  - the Moon gets no sign;
  - a Sun within a day's motion of a cusp gets no sign or sign colour;
  - there is no rising sign.
- **Storage stays inside the account boundary.**
  - `zodiacs.me.v1` and `zodiacs.circle.v1` are read and written only
    through `profileAccessAllowed()`.
  - Both keys are in `ACCOUNT_BOUNDARY_PROFILE_KEYS`, so account switches
    archive them and "clear all" removes them.
  - `cutover.test.ts` now polices direct access to both.
  - With account sync v2 on, the new surfaces reveal only after
    `AccountBoundProfileSurface` does (`surface-gate.ts`).
- **No analytics.** `/profile/` is already a private surface. No event was
  added.
- **Design.** It reuses the site's shared primitives rather than new ones.
  - Buttons follow the homepage's "recommended next" hierarchy: one white
    `btn--primary` with its orb (↗ to go somewhere, + to add, ✓ to save),
    at most one `btn--ghost` with its orb, and quiet underlined text links
    for everything else. On phones, buttons go full width.
  - Sun, Moon and rising use the homepage's `.wb__three` grammar: mono
    labels beside the site's sign chips (`PlacementList`).
  - A received card is the shared `.next-action` card, with the sender's
    initial beside it.
  - Your people, and the "which chart is yours" question, are hairline rows
    inside one bezel card. Row actions keep the saved-charts pills, with a
    44px hit area.
  - The twelve pastel hues are the only chroma, reaching surfaces through
    `--sign`. The only wash is the site's own `.tinted` treatment.
  - Panels open inline; there are no modals. Touch targets are 44px or
    larger.

## 4. Verifying by hand

1. Build, then preview. Save your own chart on `/birth-chart/` using "Save my
   chart", then open `/profile/`. Check the header, the tab title and icon,
   the nav initial, and the keep-close note.
2. Choose "Add your name" (or "Edit your name"). Type a name and watch the
   header's initial follow it; save, reload, and check the nav.
3. Choose "Send your card": it opens `/big-three/` with your Sun, Moon and
   rising, and nothing with `card=` reaches the clipboard, a share sheet or
   the address bar. Open a card link made before the change in a private
   window: the card shows at the top of the page, the address bar loses
   `#card=`, and "Add to your people" adds it. Open your own old link on your
   device: it reports "This is your own card."
4. On the recipient side, open Compare from the person's row. It lands on
   `/compatibility/?pair=…` and the comparison appears under Saved
   comparisons.
5. Visit `/me` on a preview deployment; it lands on `/profile/`.

## 5. Proposal, not built: a connected circle (Supabase)

Cards give the network loop today with no server. What an account could add
is **continuity**: a card that updates itself, a circle that follows you to a
new device, and optional birthday or Sun-return reminders.

Status of the loops those reminders would use, as of 2026-09-24:

- The **daily email** is deployed and verified (confirmation, Inbox
  delivery, unsubscribe), with its schedules still off pending release
  acceptance.
- The **weekly digest** has passed a one-recipient dry run; live testing
  waits until 2026-09-28.
- **Account sync v2** is not deployed.

The repository's contracts currently exclude this:

- `docs/ACCOUNT-SYNC-V2-TECHNICAL-CONTRACT.md` §Product boundary: "no public
  profile, discovery, followers…".
- The same contract, invariant 4: public presentation is "a future, separate
  projection".
- `docs/PHASE4-SHARING-TECHNICAL-CONTRACT.md`: "not a social graph".

So the proposal below needs explicit owner decisions before any code:

- **Shape.** It is private, mutual and invite-only. There is no directory,
  search, follower count, feed or public profile page.
  - A person publishes one **card projection** derived from their self
    chart: display name, positions, and time-known. Consistent with
    invariant 4, it never reads the owner's private payload server-side; the
    client submits the derived projection.
  - A connection exists only after both sides accept.
- **Tables** (RLS on, no browser grants; service-role RPCs, the Phase 4
  pattern):
  - `circle_cards`: owner, display name, positions JSON, time-known,
    revision, timestamps.
  - `circle_links`: requester card, recipient card, status (pending /
    accepted / removed), timestamps.
  - `circle_invites`: SHA-256 of a one-shot token, expiry, and
    `delete_after`, mirroring `compatibility_invites`.
- **API.** New `action=` branches on an existing function. The Vercel Hobby
  plan is at its function cap (`docs/GAMES-SITE-MAP.md`).
- **Consent.** A new purpose, e.g. `circle_card`, with its own policy
  version and copy. It may not reuse `chart_sync`.
  - Withdrawal deletes the card and all links.
  - Account deletion cascades.
- **Never on the server:** pictures of any kind (people are shown by
  initials, so there is no moderation surface or storage bucket), birth
  inputs, or other people's saved charts.
- **Privacy page.** A new section, gated by the same flag.
- **Where it would live.** On the account-sync v2 foundation, once that is
  deployed. The live v1 sync stores birth data in plain text, and
  `docs/SITE-AUDIT-2026-08-24.md` already advises against building new
  clients on it ("never point the app at v1").
- **Owner decisions needed.**
  1. Amend the two contracts to allow a private mutual circle.
  2. Pick the consent purpose and wording.
  3. Decide whether reminders ride the daily email and push loops.
  4. Choose the rollout flag and canary cohort.

Other decisions this work surfaced, deliberately not taken here:

- Whether the installed app's `start_url` should become `/profile/`. Today it
  is `/`, and the manifest shortcuts cover the gap.
- Localized versions of the header and people. The locale page trees and
  catalogs are frozen by `scripts/phase1-scope-guard.mjs`.
- `navigator.storage.persist()`, previously deferred as a product decision.
  It would protect these local-only saves from Safari's storage eviction.
- Whether the name the visitor chooses should also rename the self chart. It
  does not today; the two are kept separate.

## 6. CI note

Every change under `src/islands`, `src/components`, `src/lib` or `src/styles`
moves the Phase 1 template hash. `scripts/phase1-acceptance-evidence.test.mjs`
fails until the Browser Evidence workflow re-drives the Phase 1 captures on
the pinned Chromium (open the PR with `<!-- browser-evidence -->` in its
body) and the refreshed `docs/acceptance/phase1/screenshots/` is committed.
The working environment's Chromium (141) is not the pinned runner (149), so
the captures are not produced locally. See
`docs/platform/evidence/precision-2026-09-20/PHASE1-RECEIPT-GATE.md`.
