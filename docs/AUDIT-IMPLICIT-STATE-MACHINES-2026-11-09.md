# Implicit state machines audit (2026-11-09)

A read-only audit of the flows that track their state with scattered booleans,
nullable fields, string flags, try/catch branches or ad hoc status checks
instead of one explicit model. It was judged on three things together: the
people using the site (UX), the people working on it (DX), and how predictably
ChatGPT, Claude and other agents can call the hosted MCP tools at `/mcp` (AX).

Nothing in the code was changed. This document is the only file the audit adds.
Findings marked **Verified** were re-read in the code by the auditor. Findings
marked **Reported** come from four parallel read-only investigations and were
not re-traced line by line. Line numbers are as of `main` at `a67b7c9a`.

## Summary

- **Account tables are mostly explicit already.** Invites, email confirmation
  and account v2 status have status columns with check constraints. The
  implicit state machines are in the browser islands, the MCP result envelope
  and the locale lists.
- **Privacy has one real problem, and it is live in production.** No birth
  details reach logs or analytics. But two save paths write birth details to
  the database in plain text: the legacy v1 chart sync and the compatibility
  saves in `saved_pages` (Decision B).
- **The under-13 refusal from #915 only covers the hosted tools.** The browser
  calculators and the compute API do not check age and compute charts for
  future dates. The hosted check works out "today" in UTC, so a child can be
  accepted about a day before their 13th birthday in western time zones.

## Owner decisions (delegated by Dias, decided toward the stricter option)

### Decision A. Do "Copy details link" and the `#c=` handoff links carry birth details? Yes.

The rule applied: a link carries birth details if a birth year, a birth time,
a birthplace or a name the person gave can be read from it or worked back out
of it. Putting the data after the `#` does not change that.

Reasons:

1. AGENTS.md says "Links never carry a birth year, a birth time, a birthplace
   or the names you give", with no exception for fragments. The fragment never
   reaches our server, but people paste links into chats, email and notes,
   chat apps fetch link previews, and browsers sync history. All of those keep
   the fragment.
2. `encodeChartLink` (`src/lib/share.ts:70-84`) writes the date, the time,
   coordinates to 4 decimals, the zone, the place name and the person's name.
3. The MCP tools already work this way: they tell agents never to put birth
   details in a link, and their own links carry only signs, scores or month
   and day. The site should follow the same rule as the tools.
4. Chart cards are covered too. `src/lib/profile/card-link.ts:1-16` says a
   card "gives the birth date and time to the minute" and carries "the name
   the sender chose".

What has to change:

- "Copy details link" and chart card links are retired. Shared links carry
  sign-level content only (big three signs, sign placements, or month and day).
- Moving a chart between pages on the same device uses the opaque
  `profileChartHandoffFragment` (`src/lib/chart-handoff.ts:66`) for saved
  charts, and sessionStorage behind a random key for unsaved ones.
  `WelcomeBack.tsx:50-60` and `chartHandoffFragment` stop writing `c=`.
- Links people already shared keep working: the site still reads an incoming
  `#c=` link and strips it at once, but never makes a new one.
- The cost: a person can no longer send their exact chart to an astrologer by
  link. The replacements are a sign-level link, or an account-mediated invite
  that never puts details in the URL.

### Decision B. Is the plaintext `charts.payload` v1 sync reachable in production? Yes, checked: it is live.

Evidence from the production deployment `dpl_DGrctqozBzgmCgD2xGpvcL6NQzWV`
(main at `5e9e166a`), read through the Vercel connector on 2026-11-09:

| Check | Evidence |
|---|---|
| The live profile page renders the v1 branch | `/profile/` gives `ProfileManager` the props `{"dailyEmailEnabled":true}` with no `accountSyncV2Enabled`, so it defaults to `false`, and gives `AccountSyncV2Panel` `{"enabled":false}`. Source branch: `src/pages/profile/index.astro:72-86`. |
| The v2 flags are off in the client bundle | The live `feature-flags` chunk inlines `PUBLIC_ACCOUNT_SYNC_V2_ENABLED` and `PUBLIC_ACCOUNT_SYNC_V2_PREVIEW_ACK` as `void 0`. |
| Supabase is configured | `ProfileSafety` gets `{"syncConfigured":true}`, and the live CSP allows the project's Supabase host. |
| The live client loads the v1 sync | The live ProfileManager chunk imports the `sync` chunk unless `accountSyncV2Enabled` is true, then calls `syncNow()` when the session is restored and on every auth change. |
| Any saved chart triggers an upload | `src/lib/profile/store.ts:55-66` `queueCloudSync()` runs after each profile save while the v2 flag is off. |
| The database still accepts the writes | Since migration `20260811153303` (`:579-648`), the `charts` write policies require `account_v2_legacy_sync_allowed()`, which is true for every signed-in user with no `private.account_states` row: everyone while v2 is off. |
| What gets written | The whole `SavedChart` (birth date, time, place and name) into `charts.payload` as plain JSONB (`src/lib/profile/sync.ts:204-212`). |

Second production finding: `SavedPagesPanel` renders with `{"enabled":true}`,
so account saves are on (`src/pages/profile/index.astro:39-41,91`).
Compatibility saves write both people's full birth details into
`saved_pages.href` as plain text (`src/lib/profile/comparison-link.ts:41-46`,
`src/lib/profile/saved-pages-cloud.ts:47`), with no age check.

Dependency to handle (partly checked): the weekly digest reads `public.charts`
on the server (`supabase/migrations/20260827090000_weekly_digest_unsubscribe_capability.sql:212,336`),
and the daily brief needs a synced chart (its preference row references
`charts`). Stopping v1 uploads therefore also stops personalised emails for
charts saved after that point. Whether the encrypted v2 path can feed those
emails was not verified.

### Decision C. Should the calculators and the compute API refuse under-13 birth dates? Calculators yes, compute API no.

**Calculators: yes, and future birth dates too.** This applies to every form
that builds a person's chart from a birth date: birth chart, Big Three,
someone else's chart, synastry (both people), personal transits, solar, lunar
and Saturn returns, numerology, chart twins and life milestones.

Reasons:

1. One policy everywhere. The privacy policy says Zodiacs is not directed at
   children under 13 (`src/pages/privacy/index.astro:611`), and the hosted
   tools already refuse. A person should not get different answers from the
   site and from ChatGPT or Claude.
2. The data does leave the device. The calculators compute in the browser,
   but their results feed save-to-account (which uploads plain text today,
   Decision B), share links and email.
3. Synastry also gets the under-18 romance guard, matching `get_compatibility`.

How the check works:

- "Today" is the date at UTC-12, the earliest calendar date anywhere, so
  nobody is accepted before their 13th birthday in any time zone. The cost is
  that someone east of UTC can be refused for up to one extra day. The hosted
  tools switch to the same rule.
- A future date gets its own code and copy instead of the message about
  children.
- Exempt: date-only sky readers that take no name, place or save, such as the
  due-date `BabyZodiac`, `BabyShowerSky` and the Moon phase tool. Neither baby
  tool uses `PlaceSearch`, `BirthFields`, a name field, saving or chart
  handoff. A test should keep it that way, since the MCP 0.6.5 removal of the
  baby occasion was triggered by names, places and coordinates.

**Compute API: no.** Its operations (`chart`, `houses`, `positions`,
`events`, `time`, `sky-fact`, `elections`; `src/lib/compute-api/handler.ts:251-257`)
take an instant and a place, not a person's birth date. Future instants are
its purpose, and refusing anything in the last 13 years would refuse today's
sky. The handler logs nothing, and the MCP tools built on it keep their
refusal. Its documentation should say not to send children's details.

Suggested copy:

- Under 13: "Zodiacs is for people 13 and over, so it doesn't read charts for
  birth dates less than 13 years ago."
- Future date: "That birth date hasn't happened yet. Check the year and try
  again."
- Synastry under 18: "Zodiacs doesn't give romantic or attraction readings for
  anyone under 18."
- Sync paused: "Chart sync is paused while it moves to encrypted storage. Your
  charts are still saved on this device."

## 1. Calculator flows: input, result, share, save

**Birth chart (`src/islands/ChartCalculator.tsx`, 2960 lines).** More than
70 `useState` values. The flow is held in `busy`, `error: string` (`''` means
no error), `chart | null`, `computedInput`, `shareInput`; the share card in
`card: 'idle'|'busy'|'saved'|'error'`; saving in
`saved: 'idle'|'saved'|'full'|'error'`, `savePromptOpen`, `saveDraft`;
records in `recordKeep` (13 strings, `:130`); staleness in five refs compared
by hand. `clearResult()` (`:430-458`) resets about 25 setters by hand.

- **Verified race.** For dates before 1924, the calendar conversion checks
  staleness on success but not on failure (`:1569-1575`). An edit followed by
  a failed import shows the error against the new input, and an existing chart
  can be shown together with the error.
- **Reported.** The pre-1924 conversion runs while `busy === false`, so the
  button stays enabled. `saved` has no in-flight value, so two quick
  confirmations call `commitSave` (`:1828`) twice. `card === 'busy'` can be set
  while `chart === null` (`:1287`).
- **Verified.** `CalculationReload.tsx:12` tells a load error from other
  errors by comparing translated text.

**Other calculators** all repeat `busy`, `error`, `result` and a generation ref.

- **Verified.** `SaturnReturnCalculator.tsx:57-65` never clears `result` when
  a run starts, so an old result can sit next to a new error.
- **Reported.** BigThreeQuick allows `cardState === 'ready' && card === null`.
  SynastryCalculator holds about 30 state values.
- **Verified.** No browser calculator refuses any birth date.

**Under-13 refusal (#915).**

- **Verified.** Today's date is taken in UTC (`src/ai-tools/tools.ts:253`).
  At 02:00 UTC on 10 November, a Los Angeles child born 2013-11-10 is accepted
  while still 12 locally.
- **Verified.** The refusal returns `invalid-request`, the same code as
  malformed input.
- **Reported.** A future date gets the message about children. Account stores
  use 18, 13 or no age check depending on the path.

**Privacy.**

| Path | Status |
|---|---|
| `saved_pages.href` holds both people's full birth input | Verified, live in production |
| v1 `charts.payload` plaintext sync | Verified, live in production |
| Copy details link, `#c=` handoffs, chart card links | Breach under Decision A |
| v2 sync | Encrypted, 18+ gate. Fine |
| History API, analytics, console, MCP logs | Clean |
| MCP birthday and big three links | Signs, or month and day only. Clean |
| MCP `occasionCardUrl` for a new home | Coordinates to about 1 km. Not a birth detail; low priority |

**Proposed model.** A shared `useCalculation()` reducer that drops any action
whose run key is out of date, with the age and date rules from one shared
`birthDatePolicy()`:

```ts
type Calc<I, R> =
  | { s: 'idle' }
  | { s: 'invalid'; fields: FieldErrors }
  | { s: 'refused'; code: 'under_13' | 'future_birth_date' | 'under_18_romance' }
  | { s: 'converting'; key: RunKey }
  | { s: 'computing'; key: RunKey; input: I }
  | { s: 'failed'; key: RunKey; kind: 'load' | 'input' | 'compute' }
  | { s: 'ready'; key: RunKey; input: I; result: R; card: CardState;
      save: { s: 'closed' } | { s: 'naming'; draft: string } | { s: 'saving' }
          | { s: 'done'; outcome: 'saved' | 'full' | 'error' } };
```

## 2. Hosted MCP tool outcomes

**Verified.** There is one envelope for every tool (`src/ai-tools/server.ts:126-127`):
`isError: !ok`, the text is the JSON, and `structuredContent` is the same
object. The meaning inside it is inconsistent.

| Concept | How it shows up today |
|---|---|
| Refusal | `invalid-request`, the same code as a malformed field (under 13, under 18, future dates) |
| Missing detail | Four forms: a schema error, a degraded result (`timeKnown:false`), a status string (`choose-sign`, `sky-only`), or `found:false`. `find_birthplace` never says "ambiguous" |
| Sign missing | `get_horoscope` returns a result (`choose-sign`); `get_horoscope_period` returns an error |
| Unknown time zone | `invalid-timezone` in three tools, `invalid-request` in four |
| Window too long | `budget-exhausted` in one tool, `invalid-request` in another |
| Contract bug | Verified: an output ZodError (`tools.ts:726`) becomes `calculation-failed` with "try again" (`:730-731`); retrying can never help |
| Schema failure | `invalid-arguments` in the published tools, `invalid-request` in the others. Verified: with no named refusal the reply has no `structuredContent` (`sanitize.ts:5-10`) |
| JSON-RPC errors | Verified: all have the same message (`sanitize.ts:3`). Suspected: `unavailable` may never be reachable over HTTP |
| Quota | Sometimes HTTP 429/503 with a body that is not a tool result, sometimes `isError` with `retryAfterSeconds` |
| OAuth outage | Verified: a `getClaims` error becomes 401 `invalid_token` (`auth/oauth.ts:76-78`, `http.ts:179-183`), so agents restart sign-in during an outage |

**Proposed model.** Published schemas stay byte-identical: the 13 published
tools carry the outcome in `_meta['zodiacs/outcome']`; the other tools declare
it in `structuredContent`.

```ts
type Outcome<D> =
  | { status: 'result'; data: D; links: Link[] }
  | { status: 'needs_input'; code: 'sign' | 'birth_time' | 'time_zone' | 'place_ambiguous'
      | 'place_not_found' | 'not_in_directory' | 'topic_not_covered'; fields: string[]; options?: unknown[] }
  | { status: 'refused'; code: 'under_13' | 'future_birth_date' | 'under_18_pairing'
      | 'withdrawn_occasion' | 'out_of_scope'; retryable: false }
  | { status: 'error'; code: 'invalid_arguments' | 'invalid_timezone' | 'out_of_range' | 'rate_limited'
      | 'unavailable' | 'contract_violation' | 'internal'; retryable: boolean; retryAfterSeconds?: number };
```

## 3. Locale page lifecycle

**Verified: there is no model.** The lifecycle is spread across about 25 lists:
`src/lib/i18n/core.ts:1-17`, `src/lib/i18n/index.ts:94-127`, literal
`getStaticPaths` arrays, `src/content.config.ts:219,246`, hard-coded sitemap
arrays, `scripts/i18n-hreflang-policy.mjs` with magic counts,
`astro.config.mjs:66` (`['en','es']`, stale) and 82 `locale ===/!== 'ru'`
branches.

State per locale (reported):

| Family | en | es, pt | fr, it | ru | zh-hans, zh-hant | ar |
|---|---|---|---|---|---|---|
| Core tools | live | live | live | live | English link | none |
| Sign guides | live | live | live | rendered, noindex | English link | none |
| Daily horoscopes | live | live | English link | English link | English link | none |
| Birthdays | live | noindex | noindex | English link | English link | none |
| Learn | live | noindex stub | noindex stub | 404 | 404 | none |

- "reviewed" is not represented anywhere. `RELEASED_LOCALES` excludes ru, yet
  Russian core pages are indexed. Arabic `dir:'rtl'` cannot be reached because
  `Base.astro` maps `ar` to `en`.
- **Verified ship path.** The `...GROWTH_UI_EN` spreads (`src/lib/i18n/ui/fr.ts:425`,
  `it.ts:491`, `pt.ts`, `growth.ts:37`) let a new English key ship inside the
  French, Portuguese and Italian UI with no failure.
- **Reported.** Russian falls back to English chrome if one ad hoc guard is
  removed. **Verified.** `i18n-additions.md:3` is stale.
- **Proposal.** One `src/lib/i18n/registry.ts` holding
  `Record<Locale, Partial<Record<Family, { status: 'absent' | 'stub' | 'translated' | 'reviewed' | 'live'; reviewedAt?: string }>>>`,
  from which routes, noindex, hreflang, sitemap, fallback and the check-dist
  counts are all derived.

## 4. Auth, account, payment and share cards

- **Payment:** none exists. The wing only looks up addresses a person pastes.
- **Auth, verified.** `src/lib/profile/sync.ts:49` drops the auth event type
  and nothing handles `TOKEN_REFRESHED`. On each hourly token refresh the
  bootstrap revokes profile access first (`AccountProfileAccessBootstrap.tsx:130`)
  and ProfileInvites clears its busy and error state (`:425-429`); reported:
  the account panel re-initialises and cuts off a deletion in progress.
  ProfileInvites `getSession().then(setSession)` has no ordering guard
  (`:412-418`), so a late reply can restore a signed-out session.
- **Reported.** AccountSaveAction reads sign-in state from localStorage.
  Suspected race between the OAuth callback and the bootstrap island.
- **Account panel (reported).** `view` is held alongside nullable `account`,
  `boundary` and `session`, and the delete buttons call `setView('deleting')`
  directly.
- **Email.** The database model is explicit. Verified: user-facing em dashes in
  `api/email/_confirm.ts:255,273,287,315,359`. Suggested replacement: "This
  link may have expired (links work for 48 hours) or it was already used. Ask
  for a fresh one from any daily signup on the site." Reported: provider
  failures are never counted.
- **Push (reported).** State lives in four places; it shows "on" when the
  server cannot be reached; turning a topic off is a DELETE then a PATCH.
- **Share cards (reported).** `ChartShareDialog` keeps parallel maps, so
  "ready with no card" is representable; a double tap shares twice and the
  second becomes a silent download; analytics fold "shared" into
  "downloaded"; `ProfileIdentity` swallows every share error.
- **Proposed models.** `AuthState = unknown | signed-out | signed-in { userId, token, epoch } | unavailable`,
  where `TOKEN_REFRESHED` swaps the token and keeps the epoch; a per-card
  union in which every ready state carries its blob; a three-way OAuth check
  `ok | invalid | unavailable`.

## Ranked fix plan (one draft PR each)

| # | Fix | UX | DX | AX | Risk | Effort |
|---|---|---|---|---|---|---|
| 1 | Stop new birth details reaching the server in plain text: v1 sync becomes read-and-delete only with the "sync paused" copy; compatibility saves store an opaque chart reference or sign-level content; same for the pending localStorage copy; a test that no stored href or upload decodes to a date, time or place | High | Med | n/a | Med: personalised emails for newly saved charts lose their source until v2 | M |
| 2 | Retire birth-detail links (Decision A) | High | Med | Med | Med: a feature is removed on purpose | M |
| 3 | Shared `birthDatePolicy()` (Decision C) for calculators, hosted tools, the AI save and both account stores; under-18 romance guard on synastry; test that date-only sky readers stay free of name, place and save | High | High | High | Low | M |
| 4 | MCP outcome codes: typed `OutcomeError`, `contract_violation` with `retryable:false`, `refused` in `_meta['zodiacs/outcome']`, unified argument and zone codes, ambiguity flag on `find_birthplace`, always return `structuredContent` | Low | High | Highest | Low to Med (pinned schemas guarded by tests) | M |
| 5 | MCP transport honesty: OAuth outage gives 503, quota limits come back as tool results, a switched-off tool comes back as `unavailable` | Low | Med | High | Low | S |
| 6 | One site-wide `AuthState` store | High | High | n/a | Med | M |
| 7 | `useCalculation` reducer, ChartCalculator first, then Saturn, Solar, Lunar and BigThree | Med | High | n/a | Med | M to L |
| 8 | Share card union, synchronous double-tap guard, separate shared and downloaded analytics | Med | Med | n/a | Low | S |
| 9 | Locale registry, step 1, plus replacing the `...GROWTH_UI_EN` spreads | Med | High | Low | Low | M, then follow-ups |
| 10 | Copy and docs: em dashes in `_confirm.ts`, stale `i18n-additions.md` header and `astro.config.mjs` `i18n.locales`, the comment at `tools.ts:565`, a compute API docs line about children's details | Low | Low | Low | Very low | XS |
| 11 | Atomic push toggle (additive migration); show "unknown" when the server cannot be reached | Low | Med | n/a | Low | S |

## Needs Dias's yes (recommended here, not actioned)

1. **Scrub the birth details already stored on the server**: the payloads in
   `charts.payload` and the fragments in `saved_pages.href`. This deletes data,
   so AGENTS.md reserves it for the owner. Recommended after fix 1 lands.
2. **Choose where synced charts go next**: cut over to v2 encrypted sync (both
   `PUBLIC_ACCOUNT_SYNC_V2_*` flags), or accept that cross-device sync and
   personalised emails stay paused for newly saved charts. This is a product
   cutover, not a fix for a live problem.
3. **Accept the cost of Decision A**: exact-chart sharing by link goes away,
   replaced by sign-level links or account-mediated invites.
