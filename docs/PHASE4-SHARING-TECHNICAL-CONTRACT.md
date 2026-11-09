# Phase 4 — Sharing loop technical contract

Status: released and formally complete on 2026-07-25

Production release:
`b7075f3d1dc94282cee472decbd94a0270adb331` ·
`dpl_7S22DcjeFHkgWx5pJHDUJkcj61eU` ·
`2026-07-25T07:34:10.644Z`

Baseline: `734c36ff960d4743ac268ab6368bd915d063ed4f`

Scope: Phase 4 compatibility invitations and shareable result cards only

This contract turns the Master Plan's Phase 4 sharing loop into a bounded,
testable implementation. It preserves the site's local-first privacy model:
birth inputs stay in the visitor's browser, invite links carry no raw birth
inputs, and a recipient's chart is never written to the server unless that
person separately chooses to save it through the existing account flow.

The reader experience and final English copy remain Fable's authority.
`docs/PHASE4-SHARING-INTEGRATION-DECISIONS.md` is the binding reconciliation
between that handoff and this security contract, with one subsequent
release-hardening amendment: a non-secret, per-arrival session handle selects
one handle-scoped HttpOnly capability cookie so two open invitations cannot
overwrite each other. The released implementation includes that amendment.
Its browser, parity, CI, migration, private-canary, independent-review, public
authorization, and production evidence are recorded in
`docs/PHASE4-SHARING-CANARY.md`.

## 1. Fixed release boundary

The released feature is:

- English only.
- Available only to signed-in inviters who select one synchronized saved
  chart.
- Its reader UI is hidden unless `PUBLIC_COMPAT_INVITES_ENABLED=1`.
- Creating and opening invitations are separately disabled unless
  `COMPAT_INVITES_ENABLED=1` and the complete server contract is present.
- Creation requires either `COMPAT_INVITES_PUBLIC_ENABLED=1` or an exact
  match in `COMPAT_INVITE_TEST_USER_IDS`. Public authorization still requires
  a valid signed-in Auth user and one synchronized chart owned by that user.
  With public authorization off, a missing or empty canary allowlist denies
  every creator. Status, revocation, hiding, completion replay, and cleanup
  are not blocked by either creation authorization.
- It adds one private token path, `/c/{token}/`, which exchanges the token for
  a new non-secret 16-byte, 22-character base64url session handle, stores the
  raw capability only in that handle's scoped HttpOnly cookie, and redirects to
  `/compatibility/#invite={handle}`.
- It also adds a generic, static, noindex `/c/` fallback shell. The shell
  contains no invitation data and does not validate a token.
- One orchestrated relationship-wheel motion, plus existing native share and
  PNG download behavior.

The first release is not:

- A public directory, social graph, contact importer, referral program, or
  messaging system.
- A replacement for account sync or the existing device-local saved-pair
  feature.
- A reason to enable public Daily Email, public Sky Alerts, Phase 4 in other
  locales, or any Phase 5/6 feature.
- Permission to store either person's birth date, birth time, place,
  coordinates, timezone, email, free-text message, or complete saved chart in
  an invite.

All non-English compatibility routes and the feature-off English experience
keep their existing behavior. The full parity, preview, canary, and public
release ladder passed before formal closure.

## 2. Existing surfaces to reuse

Implementation must build on, not duplicate:

- `src/islands/SynastryCalculator.tsx` for the relationship calculator,
  bi-wheel, aspect grid, composite view, and device-local saved pairs.
- `src/lib/engine/synastry.ts` for engine-free comparison of computed body
  positions.
- `src/lib/profile/schema.ts` for the synchronized chart summary already
  available to a signed-in owner.
- `src/lib/share-card.ts` and `src/lib/compatibility-card.ts` for client-side
  PNG rendering.
- `src/lib/share.ts` for strict, fragment-only client handoff patterns.
- `src/lib/analytics.ts` and `src/lib/analytics-config.mjs` for cookieless,
  allowlisted analytics.

The current full-birth-input compatibility fragment remains available while
the new flags are off. With both Phase 4 flags on, the English invitation CTA
uses this contract. No other locale changes in this release.

## 3. Reader flow

### 3.1 Inviter

1. The inviter signs in.
2. They choose exactly one synchronized chart they own.
3. They see a concise disclosure of what will and will not be shared.
4. They optionally choose "Tell me when they finish." This consent applies
   only to this invitation and is off by default.
5. The server creates one 14-day invitation and returns its URL once.
6. The inviter may copy/share the URL, view its status, or revoke it from
   their profile.

No device-only chart is eligible. Creating an invitation never silently syncs
a chart.

### 3.2 Recipient

1. The recipient opens `/c/{token}/`.
2. The server validates the token, mints a non-secret 16-byte, 22-character
   base64url session handle, places the raw capability in a Secure HttpOnly
   cookie scoped to that handle, and redirects with `303` to
   `/compatibility/#invite={handle}`. The token is removed before the
   compatibility page or its analytics run.
3. The compatibility island reads the capability through the same-origin
   session endpoint using the validated handle to select the matching
   HttpOnly cookie. Only then does it receive the inviter-selected label, Sun
   sign, and positions-only payload. A second invitation tab uses another
   handle/cookie pair and cannot overwrite the first.
4. The recipient enters their own birth details in the existing local
   calculator.
5. Their chart and the compatibility result are computed locally.
6. Completion writes only the invitation's completion state and time.
7. The recipient may download/share a compatibility card, begin their own
   saved chart flow, or generate a positions-only private result link to send
   back.

The recipient's form submission must never make a network request containing
birth input, positions, a chart label, or calculated interpretation.

### 3.3 Return result

"Send result back" is a client-side action:

- Render the existing compatibility PNG locally.
- Offer native share when supported, with download fallback.
- Optionally create a versioned URL fragment containing the two minimum
  computed-position payloads.
- State plainly that anyone with that private link can read the result.

It performs no invitation-table update and sends no email or push.

## 4. Minimum invite payload

The only astrology payload stored for the inviter is the exact compact v2
positions wire already defined by `src/lib/share-positions.ts`:

```ts
interface CompatibilityInvitePositions {
  // Canonical order:
  // Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus,
  // Neptune, Pluto, North Node, South Node.
  b: [number, number, number, number, number, number,
      number, number, number, number, number, number];
  a?: [number, number]; // [ASC, MC]; absent for a no-time chart
  h: 'w' | 'p';        // whole-sign or Placidus
  v: string;           // bounded engine version
}
```

Validation is strict:

- The stored label is normalized and trimmed, contains no control characters,
  and is 1–24 Unicode characters and at most 96 UTF-8 bytes.
- `b` contains exactly twelve finite longitudes in canonical order, each in
  `[0, 360)` and rounded to at most three decimal places.
- `a` is present with exactly `[ASC, MC]` when `time_known=true` and is absent
  when `time_known=false`.
- `h` is exactly `w` or `p`.
- `v` is 1–32 characters and matches the existing engine-version grammar
  `[A-Za-z0-9][A-Za-z0-9._+-]{0,31}`.
- `sun_sign` must equal the sign derived from `b[0]`, the Sun longitude.
- The object has only `b`, optional `a`, `h`, and `v`; unknown keys,
  birth-shaped fields, additional bodies, retrograde flags, and oversized
  JSON are rejected.
- The stored JSON text is capped at 1,024 bytes.

The browser submits exactly `{ chartId, consent: true, notify }`. The server
authenticates the account, reads that account's synchronized chart, derives
the bounded label, Sun sign, positions wire, and time-known state, and then
discards the chart ID. It does not trust a browser-supplied payload, label,
Sun sign, email address, or owner identity.

The invite must not store:

- Birth date or time.
- Place name, latitude, longitude, timezone, or country.
- The saved chart's full birth object or flags.
- The inviter's email.
- The recipient's label, birth input, positions, email, or account identity.
- A message, note, or other free text.

## 5. Token and browser capability

- Generate 32 random bytes with the platform cryptographic generator.
- Encode as base64url without padding.
- Return the raw token only in the one successful creation response.
- Store only `SHA-256(rawToken)` as 64 lowercase hexadecimal characters.
- Never log, trace, email, analyze, or persist the raw token.
- Use constant-shape failure responses for unknown, expired, revoked, and
  already-purged tokens.

`GET /c/{token}/` is rewritten to the exchange function. On success it:

1. Hashes and validates the token.
2. Mints an independent, non-secret 16-byte, 22-character base64url session
   handle.
3. Sets one handle-scoped capability cookie named
   `zodiacs_compat_invite_{handle}` whose value is the raw bearer token using:
   `Secure; HttpOnly; SameSite=Lax; Path=/api/compatibility;
   Max-Age=<remaining>`.
4. Responds `303 See Other` to
   `/compatibility/#invite={handle}`.

The cookie lifetime never exceeds the invitation's remaining lifetime. The
validated handle is safe for the URL fragment because it is only a selector,
not authority. Session and completion calls present that handle so the server
selects exactly its matching HttpOnly cookie; the raw capability remains
unavailable to page JavaScript. The matching cookie is cleared by a
terminal/unavailable session read and after completion. Completion, revocation,
and expiry all destroy the authoritative token hash and positions in the same
database transition.

The recipient page never receives the raw token in HTML or JavaScript. Each
open invitation has a distinct handle/cookie pair, so opening a second link in
another tab cannot replace the first tab's capability. Consent-safe completion
replay uses one bounded local key per validated handle,
`zodiacs.invites.pending.v2.{handle}`, with at most 24 entries; it stores only
the non-secret handle and expiry/remembered timestamps. Fetch, replay, and
`sendBeacon` select the same handle through the `session` query.

## 6. Database contract

The implementation migration creates three server-owned tables. Every table
has RLS enabled, no browser policies, all privileges revoked from `public`,
`anon`, and `authenticated`, and only the minimum service-role privileges.

### 6.1 `compatibility_invites`

Required fields:

| Field | Contract |
| --- | --- |
| `id` | UUID primary key |
| `owner_user_id` | Auth user UUID, indexed |
| `token_hash` | Unique 64-char lowercase SHA-256 hex while active; null immediately at completion, revocation, or expiry |
| `completion_replay_hash` | Domain-separated, non-authoritative 64-char digest retained only for idempotent completion retries; present only after completion |
| `label` | Normalized 1–24-character display label |
| `sun_sign` | Twelve-value sign slug derived from the stored Sun longitude |
| `positions` | Strict compact twelve-body v2 positions wire; null immediately at every terminal transition |
| `time_known` | Boolean that must agree with the presence of ASC/MC |
| `status` | `active`, `completed`, `revoked`, or `expired` |
| `notify_on_complete` | Boolean, default false |
| `created_at` | Server UTC |
| `expires_at` | Exactly `created_at + interval '14 days'` |
| `opened_at` | First valid exchange UTC, nullable |
| `completed_at` | First valid completion UTC, nullable |
| `revoked_at` | Owner revocation UTC, nullable |
| `expired_at` | Stored expiry close UTC, nullable |
| `authority_destroyed_at` | UTC when token authority and positions were nulled |
| `delete_after` | Exactly thirty days after the terminal transition |
| `owner_hidden_at` | Owner presentation choice for a closed row; does not erase retained operational evidence early |

No saved-chart ID is stored. Ownership is verified by the server's exact
`charts?id=...&user_id=...` lookup before it derives the positions wire.
Completion, revocation, and expiry immediately null both `token_hash` and
`positions`. A completed row keeps only the domain-separated replay digest
needed to turn a lost-response retry into `duplicate`; that digest cannot open
or read the invitation. All positions-free status and delivery evidence is
deleted after the thirty-day retention boundary.

### 6.2 `compatibility_invite_delivery_claims`

One row per invite and channel:

| Field | Contract |
| --- | --- |
| `invite_id` | FK, cascade delete |
| `channel` | Initially only `email` |
| `state` | `reserved`, `sent`, or `failed` |
| `claim_token` | Random worker-claim UUID |
| `recipient_hash` | Keyed HMAC of resolved account email, never raw email |
| `provider_receipt` | Provider ID, nullable |
| `provider_status` | Bounded HTTP status, nullable |
| timestamps | Claim, finalize, and update UTC |

Primary key `(invite_id, channel)` makes completion notification at-most-once.
A failure is evidence, not permission for an unbounded automatic retry.

### 6.3 `compatibility_invite_events`

This is a bounded operational ledger, not product analytics:

| Field | Contract |
| --- | --- |
| `invite_id` | FK, cascade delete |
| `event` | `created`, `opened`, `completed`, `revoked`, or `expired` |
| `occurred_at` | Server UTC |

No IP, user agent, URL, token, label, chart ID, positions, or recipient data is
stored. At most one row per `(invite_id, event)`.

### 6.4 Transactional RPCs

The migration supplies service-role-only, `security definer` functions with a
locked `search_path`:

- `create_compatibility_invite(...)`
- `open_compatibility_invite(token_hash)`
- `read_compatibility_invite(token_hash)`
- `complete_compatibility_invite(token_hash)`
- `revoke_compatibility_invite(owner_user_id, invite_id)`
- `list_compatibility_invites(owner_user_id)`
- `hide_compatibility_invite(owner_user_id, invite_id)`
- `reserve_compatibility_invite_delivery(invite_id, recipient_hash, claim_token)`
- `finalize_compatibility_invite_delivery(invite_id, claim_token, outcome, provider_receipt, provider_status)`
- `prune_compatibility_invites(limit)`

Public, anonymous, and authenticated roles have no execute privilege.

Creation is serialized per owner and enforces both:

- Maximum 12 active invitations.
- Maximum 20 creations in the exact rolling 24 hours.

An active invite is unexpired, unrevoked, uncompleted, and still has token
authority. Completed invitations do not count toward the active cap because
completion destroys that authority.

Cleanup:

- Completed, revoked, and expired authority is destroyed immediately.
- Non-sensitive status, event, and delivery evidence remains for 30 days.
- The next prune permanently deletes the invitation and cascades its ledgers.
- The committed hourly authenticated workflow is required release
  infrastructure. Create, open/read, list, revoke, and completion also close
  touched or owner-scoped overdue records so cleanup fails safely if a single
  scheduled invocation is delayed.

## 7. Server API contract

The server contract exists only when `PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are valid. `COMPAT_INVITES_ENABLED=1` gates only
creation, exchange, and session reads. Owner status, revocation, hiding,
completion replay, delivery finalization, and cleanup remain available when
the contract exists. `COMPAT_INVITES_PUBLIC_ENABLED=1` authorizes any valid
signed-in Auth user to reach the create path; the create path independently
requires a synchronized saved chart owned by that user. When public
authorization is off, the production canary allowlist applies only to create.

### `POST /api/compatibility/invites`

Input: exactly `{ chartId: string, consent: true, notify: boolean }`

- Authenticates the owner.
- Reads the owned synchronized chart server-side.
- Constructs and validates the compact twelve-body positions wire.
- Creates the invite transactionally.
- Returns `201` with `{ id, url, expiresAt, state: "waiting" }`.
- The `url` containing the raw token is returned only here.

Errors: `400 invalid_request`, `401 sign_in_required`, `403 canary_only`,
`404 chart_not_found`, `409 active_limit`, `429 creation_rate_limit`,
`503 unavailable`.

### `GET /api/compatibility/invites`

Returns the signed-in owner's status rows only:
`{ id, label, sunSign, state, createdAt, expiresAt, openedAt, closedAt,
hiddenAt }`.

It never returns payload, token hash, raw token, recipient information, or
delivery-provider information. A browser that created an invitation may keep
the one returned URL in account-keyed local storage for Copy; another device
can manage status and revocation but cannot reconstruct that URL.

### `POST /api/compatibility/invite-revoke`

Input: exactly `{ id: string }`.

Owner-scoped and idempotent. Returns `{ status: "revoked" }`. Cross-owner and
unknown IDs return the same `404`.

### `POST /api/compatibility/invite-hide`

Input: exactly `{ id: string }`.

Owner-scoped and accepted only after authority has ended. It sets
`owner_hidden_at` without deleting the thirty-day evidence row. Active
invitations return `409`; cross-owner and unknown IDs return the same `404`.

### `GET /api/compatibility/invite-exchange`

Receives the rewritten path token, never a token supplied by page JavaScript.
Success mints a non-secret 16-byte, 22-character base64url handle, sets that
handle's capability cookie, and `303` redirects to
`/compatibility/#invite={handle}`. Terminal, invalid, server-off, and
unavailable states set no authority and redirect to
`/compatibility/#invite=unavailable`; the recipient does not receive a
token-status oracle.

Response headers include `Cache-Control: no-store` and
`Referrer-Policy: no-referrer`.

### `GET /api/compatibility/invite-session?session={handle}`

Accepts only a validated non-secret session handle, selects that handle's
HttpOnly capability cookie, hashes the cookie value, and returns only:
`{ state: "ready", payload: { version, label, sunSign, positions, timeKnown,
expiresAt } }`, or `{ state: "unavailable" }`.

It does not return owner user ID, chart ID, invite ID, token hash, or
notification preference.

### `POST /api/compatibility/invite-complete?session={handle}`

Accepts only the validated non-secret session handle needed to select that
handle's HttpOnly cookie. Birth input, positions, labels, recipient data, and
any additional field are rejected.

Atomically records the first completion. Returns:
`{ outcome: "completed" | "duplicate" | "unavailable",
notification: "queued" | "skipped" }`.

The recipient does not wait for provider delivery and never sees the
inviter's address or account state. A durable database claim and provider
idempotency key enforce the one-shot email promise.

### `POST /api/compatibility/invite-sweep`

Requires `Authorization: Bearer COMPAT_INVITE_SWEEP_SECRET` and the complete
server contract. It runs bounded cleanup batches and returns
`{ expired, pruned, batches }`. Missing or wrong configuration returns the
same `404`.

Every API:

- Allows only same-origin browser calls where applicable.
- Applies bounded body sizes and exact content types.
- Uses no request-body logging.
- Sets `Cache-Control: no-store`.
- Returns fixed error codes, not database/provider detail.

## 8. Recipient route, search, and cache contract

`/c/` and `/c/{token}/` are programmatic private routes:

- `<meta name="robots" content="noindex,nofollow,noarchive">`
- No sitemap entry.
- No hreflang alternates.
- Generic canonical to `https://zodiacs.org/c/`.
- Generic title, description, and OG image with no label, sign, or personal
  detail.
- Server and Vercel headers: `Cache-Control: private, no-store`,
  `Referrer-Policy: no-referrer`.
- The token path is a Vercel rewrite to the exchange function. It emits no
  page analytics; after the `303`, analytics sees only the canonical
  `/compatibility/` page and never the secret.
- A complete no-JavaScript explanation that calculation requires JavaScript,
  without revealing invite details.

The locale availability system must explicitly classify `/c/` and
`/c/{token}/` as English-only programmatic routes so they cannot gain selector
entries, alternates, or sitemap URLs through future locale expansion.

## 9. Completion notification

Notification consent is:

- Invitation-specific.
- Off by default.
- Reversible by revoking the invite.
- Separate from Daily Email, weekly digest, and Sky Alerts.

On first completion, the server:

1. Atomically claims the invite's email delivery.
2. Resolves the inviter's current verified Auth email by owner user ID.
3. Sends one transactional message containing no recipient identity, birth
   data, chart positions, result, score, or private link.
4. Finalizes the claim with provider evidence.

The message may say that the named invitation was completed and link to the
owner's profile invite-status area. It must not imply that the recipient
created an account or shared their data.

No push notification ships in the first release.

## 10. Positions-only return fragment

The return codec is new and versioned separately from the existing full-input
share codec.

Properties:

- URL fragment only; never query or path.
- An `s1.` wrapper contains exactly two existing canonical v2 positions
  tokens plus two labels and two time-known booleans. The wrapper keys are
  exactly `{ p, l, k }`.
- It excludes account/chart/invitation IDs, birth input, place, timezone,
  email, and retrograde state.
- Labels are optional, normalized, trimmed to 24 characters, and included only after the
  person explicitly chooses to create the link.
- Strict canonical JSON/base64url, exact-key, body, longitude, version, and
  time-known/angle checks apply. The complete token is capped at 640
  characters.
- Fragment is stripped from browser history after successful decode, matching
  the existing share hygiene.
- A decoded result can be viewed and re-rendered, but the received fragment is
  never silently re-shared.

The UI must call this a private link, not an anonymous or secret link. Anyone
who receives it can view the contained computed positions.

## 11. Share-card and motion contract

### Share cards

The release activates and polishes existing renderers:

- Big Three card from a natal result.
- Full chart-wheel card.
- Compatibility card.

Requirements:

- Render entirely client-side at 1× and 2×.
- Use the canonical pastel sign icons and existing Cosmic Void materials.
- Include a compact Zodiacs.org signature and a truthful method/engine receipt.
- Never include birth date, time, place, coordinates, email, account ID, or
  invitation URL by default.
- Native share first when supported; PNG download fallback.
- One tap from birth-chart results and compatibility results.
- Preserve reduced-motion behavior and keyboard access.

### Relationship motion

There is one orchestrated moment: the two chart rings settle together before
the result is revealed.

- SVG/CSS transform and opacity only.
- No new animation dependency.
- Short, skippable, and never blocks access to the reading.
- Instant final state under `prefers-reduced-motion`.
- Pauses when offscreen or the page is hidden.
- Does not replay on ordinary tab changes, saved-result restore, or back
  navigation.

Fable owns the final timing, spacing, and copy. Sol owns lifecycle safety,
performance, focus management, and reduced-motion enforcement.

## 12. Analytics contract

Add only these events and fixed properties:

| Event | Allowed properties |
| --- | --- |
| `invite_created` | `notify`: boolean |
| `invite_opened` | `state` |
| `invite_completed` | none |
| `invite_returned` | `method` |
| `invite_converted` | `action` |
| `invite_revoked` | none |

Allowed values are closed enums:

- `invite_opened.state`: `ready`, `invalid`, `closed`, `used`,
  `unavailable`, or `offline`
- `invite_returned.method`: `share`, `copy`, or `download`
- `invite_converted.action`: `saved_chart`, `saved_pair`, or `own_chart`

Never send a token, invitation ID, URL, chart ID, label, sign, birth input,
position, email, provider receipt, free text, query, or fragment. The analytics
shim continues to replace the browser URL with its canonical path.
A cancelled native share emits no event.

## 13. Failure and recovery matrix

| Condition | Reader outcome | Data outcome |
| --- | --- | --- |
| Both flags off | Existing compatibility experience | No invite call |
| Public flag on, server flag off | Calm unavailable/create failure state | No write |
| Signed out owner | Sign-in invitation | No write |
| Device-only chart | Sync explanation only | No write |
| Active/rate cap | Calm retry/manage message | No partial row |
| Invalid/completed/expired/revoked token | One generic unavailable state | Cookie cleared; no status oracle |
| Two invitation tabs | Each tab keeps its own non-secret handle | Each handle selects only its own HttpOnly capability cookie |
| Recipient refresh before completion | The invitation side can load again while active | Open event remains idempotent |
| Recipient refresh after completion | Generic unavailable state | Positions and token authority stay destroyed |
| Recipient calculation error | Existing honest calculator error | No completion |
| Completion replay | Same completed experience | `duplicate`, no second send |
| Email provider failure | Result remains complete | Failed claim retained; no loop |
| Database unavailable | Fail closed, preserve local form values | No guessed state |
| JavaScript disabled | Generic explanation | No personal payload in HTML |
| Reduced motion | Immediate result | Same computation |
| Offline after session load | Local calculation may continue | Completion retries only with consent-safe empty request |

## 14. Required tests

### Unit and property tests

- Stored positions accept only the exact twelve-body compact v2 shape.
- Sun sign must match Sun longitude.
- Angles/time-known invariants.
- Three-decimal precision, exact-key validation, and the 1 KiB stored-payload
  limit.
- Create input accepts only `{ chartId, consent: true, notify }`; server
  derivation rejects birth-shaped and client-supplied position fields.
- 32-byte token entropy shape and SHA-256-only persistence.
- Independent 128-bit session-handle shape, validation, handle-scoped cookie
  naming, and rejection of malformed/cross-handle selectors.
- Positions-only fragment round trip, corruption rejection, size cap, and
  received-link re-share containment.
- Analytics allowlist drops every forbidden property.
- Share-card 1×/2× deterministic fixture rendering.

### Disposable PostgreSQL tests

- Fresh migration and idempotent replay.
- RLS enabled; anon/auth forged select/insert/update/delete denied.
- Service-role grants are minimal.
- No chart ID or birth input exists in the invitation schema.
- 12-active and rolling-24-hour limits under concurrency.
- Open/complete/revoke races have one authoritative outcome.
- Completion, revocation, and expiry immediately destroy token/positions.
- Completion replay uses only its non-authoritative domain-separated digest.
- Completion and delivery claims are idempotent under concurrency.
- Owner hiding applies only to closed rows and does not erase retained
  evidence.
- Cleanup retains only bounded evidence for 30 days, then deletes it.
- Functions have fixed search paths and no public execute grants.

### API tests

- Feature-off, no-secret, malformed body, wrong origin, wrong content type.
- Signed-out and cross-owner behavior.
- Raw token appears in no database field, response after creation, log fixture,
  analytics payload, or built asset.
- Exchange produces 303, secure cookie, token-free destination, no-store, and
  no-referrer. The destination contains only the non-secret handle.
- Session response exposes only the public payload.
- Session and completion select only the handle-matched HttpOnly cookie;
  opening two invitations cannot cross-read or cross-complete them.
- Complete rejects all recipient data and sends at most one notification.

### Browser tests

- Owner creates, copies, lists, and revokes an invite.
- Recipient open strips token before analytics.
- Two invitation links opened in parallel tabs retain independent ready
  states and complete only their own records.
- Valid, completed, expired, revoked, and malformed token paths, all with the
  generic unavailable terminal treatment.
- B calculates locally with network inspection proving no birth-input write.
- Animation, skip, offscreen pause, tab visibility, and reduced motion.
- Keyboard-only and screen-reader compute-to-result path.
- Big Three, wheel, and compatibility cards at 1×/2×; native-share and
  download fallbacks.
- Positions-only return link and received-link containment.
- No-JS and offline/failure states.
- 360, 390, 781, 1280, and 1440 px with zero unexpected overflow.

### Existing release gates

Run the full build, typecheck, unit, browser, schema, bundle, visual,
Lighthouse, locale, Registry drift, thesis drift, and security gates. Existing
English and all non-English feature-off fixtures must remain byte-identical
except for files explicitly listed in the approved Phase 4 implementation
manifest.

## 15. Release ladder

Completed release record: Fable's docs/proofs were integrated, the
handle-scoped unit/API suite passed 47/47, feature-off browser coverage passed
8/8, and the fixture A→B suite passed 35/35 with simultaneous invitation tabs.
The migration, private canary, one-shot email proof, duplicate prevention,
independent Fable review, explicit owner authorization, and public
authorization all passed. PR `#159` merged as
`b7075f3d1dc94282cee472decbd94a0270adb331`; post-merge Site Check run
`30148543319` passed on attempt 1. Deployment
`dpl_7S22DcjeFHkgWx5pJHDUJkcj61eU` reached the production alias at
`2026-07-25T07:34:10.644Z`.

1. Merge the Fable design/copy handoff into the integration branch.
2. Implement schema, strict types/codecs, and disposable SQL tests.
3. Implement server APIs with both flags off.
4. Implement owner and recipient UI behind both flags.
5. Integrate Fable's final copy and visual acceptance proofs.
6. Obtain full local gates and green PR CI.
7. Apply and verify the migration through the reviewed Supabase path.
8. Deploy with both public and server flags off; verify feature-off parity.
9. Set `COMPAT_INVITE_TEST_USER_IDS` to the approved owner only.
10. Enable the server flag and public flag for the allowlisted canary.
11. Run one genuine A-to-B canary using two controlled browsers:
    creation, open, local B calculation, completion, optional email,
    duplicate prevention, return card/link, revocation, and expiry fixture.
12. Record database/RLS evidence, provider evidence, screenshots, CI SHA,
    deployment, and UTC cutover.
13. Fable reviews the live canary against its handoff.
14. After Fable's canary review and explicit owner approval, release the
    separate public-authorization change. Set
    `COMPAT_INVITES_PUBLIC_ENABLED=1` only with the existing server and reader
    flags. Retain the test allowlist so disabling public authorization
    restores the reviewed owner-only boundary. Authentication, synchronized
    saved-chart ownership, paired kill switches, and rollback remain.

Rollback is immediate: turn off the reader flag, then the server flag, then
the public authorization. Existing invites remain revocable and cleanup
remains operational; recipient endpoints return the generic unavailable
state. Do not drop tables during rollback.

## 16. Implementation order and ownership

Parallel first wave:

- Fable: design, interaction, final English copy, email, card art direction,
  motion timing, responsive states, and static proofs.
- Sol: this contract, migration/RLS design, codecs, API contracts, analytics,
  threat model, tests, and release ladder.

Sequential second wave:

1. Sol integrates Fable's single docs/proofs commit onto latest `origin/main`.
2. Sol implements the complete feature on one isolated branch.
3. Fable performs a bounded implementation review and may commit only
   taste-critical corrections.
4. Sol resolves deterministic findings, runs full gates, and releases through
   the normal PR/CI/Vercel path.

There is one implementation branch and one final release candidate. Do not
split schema, APIs, and UI across independently releasable production branches.

## 17. Formal closure

There is no open Phase 4 release blocker. The implementation and live evidence
close every item in the release ladder: green CI, Fable review, verified
migration/RLS boundary, authenticated cleanup, allowlisted A→B canary,
one-shot provider/database evidence, duplicate prevention, explicit owner
approval, separate public authorization, and live production verification.

Production keeps the reader, server, and public-authorization controls aligned.
The exact canary owner remains the rollback boundary, and the hourly cleanup
path remains mandatory. Phase 5 may proceed only as its own bounded phase; no
Phase 5 behavior is authorized by this contract.

## Amendment, 2026-11-09: invite signups (behind switches)

With `INVITE_SIGNUP_ENABLED=1` and `PUBLIC_INVITE_SIGNUP_ENABLED=1`, an invite
completes only when its recipient confirms an opt-in daily-email signup, both
sides' consent is recorded by policy version, and the recipient confirms their
own details and age before anything is worked out (under 13 refused). Section
3.2 step 6 and section 7's completion route then apply to a confirmed signup
instead of the shown result. The design, its decisions and the switch-on
steps are in `docs/INVITE-SIGNUPS.md`. Off, this contract is unchanged.
