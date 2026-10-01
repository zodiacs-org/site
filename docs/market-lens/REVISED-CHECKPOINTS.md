# Market Lens revised checkpoints

Implemented in the site checkout on 2026-10-01, extending the existing draft
[PR #619](https://github.com/zodiacs-org/site/pull/619). SDK, engine and native
app checkouts are unchanged. The site retains its pinned rc.15 engine;
`src/lib/engine/full.ts` remains the sole browser ephemeris import boundary.

The reference [Astrology Calendar](https://astrologycalendarwanton.netlify.app/)
inspired the approachable personal calendar. Lens uses its existing profile,
clock, engine, uncertainty and window adapters. Interpretive scores use fixed,
published weights and thresholds rather than scores normalized to a visible
period. They provide no price direction or measured trading probability.

## 1. Existing profile and privacy

- Automatically uses the sole chart explicitly marked `relationship: self`;
  newer charts marked other do not take precedence. Unresolved ownership uses
  the shared `LivingSelfChartChooser`.
- Full unsaved `#c=` handoffs use the existing share decoder, subject policy
  and shared birthplace-clock resolution. The fragment is consumed and
  stripped. These inputs remain in memory for this session; a Sun sign or
  positions-only demo is insufficient.
- Existing place-less date/time handoffs retain their fields and route to
  the shared editor for missing details; they do not invent a complete chart.
- Stores a canonical chart ID/revision reference, not a second copy of birth
  details. Editing uses the shared chart editor and BirthFields. The shared
  edit adapter preserves known fields when birthplace is missing, allowing
  users to complete that field without repeating onboarding.
- Uses canonical resolved UTC, known/unknown time, clock flags, birthplace,
  timezone and actual house system. The profile stores normalized birth dates;
  Lens adds no new calendar conversion or alternative birth-form policy.
- Source edits, deletion, sync/access changes, account boundaries and
  cross-tab updates cancel workers and clear structured derived context,
  including journal revision associations. Authored notes remain private
  notes. Stale journal/setup drafts cannot overwrite later revisions.
- Lens never serializes birth inputs, placements or notes into market
  requests, analytics or added external calls. The canonical profile retains
  its existing guarded account-sync behavior. Shared chart links carry an ID or
  supported input in a fragment. Existing neutral, hashed clock assets are
  loaded through the shared adapter for historical births.

Verified: explicit own vs newer other, unresolved multiple charts, no chart,
full unsaved handoff, source edits/deletion, simulated v2 guard revocation and
re-grant, stale Moon workers, cross-tab updates and outbound request inspection.
The v2 browser case exercises the real fail-closed guard with a synthetic
grant; it does not certify a live Supabase account sign-in.

## 2. Personal calendar and transit windows

- Month, week, day and agenda; mobile defaults to agenda. Shared sky, private
  personal and economic rows have separate labels/markers and filters.
- Month/week cells preview three events, prioritizing scheduled/shared events
  and exact personal contacts; ongoing windows stay accessible in the full
  day view. Dense personal timing does not expand the month into long lists.
- Sun through Pluto, configurable 0.5°, 1°, 2° or 3° orb, all five major
  aspects to supported natal planets and reliably available ASC/MC.
- Worker reuses `createTransitWindowScanner` with the full engine adapter.
  Moon probes hourly, fast bodies every six hours, outer bodies every twelve
  hours. Worker termination and generation guards reject stale completion.
- Details expose sign/degree, angular separation and deviation, applying /
  exact / separating or uncertainty, entry / model exact contacts / exit,
  clipped boundaries, topology and angular comparison budgets. Repeated
  retrograde contacts are separate linked occurrences. Personal markers and
  window boundaries appear on the existing price chart.
- Degrees and phase are sampled at 12:00 UTC on the selected date. Event
  timestamps and calendar grouping use the selected IANA display timezone.
- Unknown time or ambiguous clocks exclude natal Moon, angles and houses.
  Other natal planets retain the shared noon birth reference and explicitly
  uncertain contact timing. The existing profile has no separate approximate
  time field: users set approximate time unknown through the shared editor.
- Shared coverage now includes 481 exact Moon ingresses projected from the
  existing generated Aura catalog: 1,804 events in 60 UTC month shards.
  Moon coverage is 2026–2028. Shared Moon/fast-planet aspect pairs and other
  unsupported catalog combinations remain explicitly unavailable.

Verified: fast-body positions and window roots against independent JPL
Horizons fixtures, existing slow-window/topology fixtures, exact Moon catalog
projection/drift, all views, unknown time, ambiguous-clock flag, keyboard
interaction and 390px layout. Numerical root precision does not establish
birth-time or ephemeris accuracy outside the documented comparison budget.

## 3. Actual-house context and explanations

House themes 2 (resources), 5 (speculation/risk) and 8 (shared resources and
obligations) list natal and transiting placements through the actual natal
cusps. Placidus remains Placidus; unreliable houses remain unavailable.
Event detail separates calculation, traditional reflection, market
observations and the user's hypothesis. Events link to chart inspection,
journal and historical observations. No interpretation predicts an asset's
direction. Browser acceptance verifies actual Placidus reuse; calculation
tests also check whole-sign cusp modifiers.

## 4. Private setup and USD spot risk

The setup panel records asset/timeframe, technical levels, confirmation,
invalidation, optional target, horizon, hypothesis and associated shared,
personal or economic timing. Plans and later revisions live in the existing
IndexedDB journal; original risk inputs and user-entered outcomes remain
separate and inspectable. Export/import retains the optional setup schema and
accepts older journals. Cross-tab stale edits retain drafts for review.

Long cash spot only: entry fill = entry × (1 + slippage), stop fill = stop ×
(1 − slippage), loss/unit = entry fill × (1 + fee) − stop fill × (1 − fee).
Units are the minimum of risk-budget/loss and available-cash/entry-funding.
Fees and adverse slippage apply on both sides, including optional targets.
Cash limits, invalid inputs and negative net target rewards are explicit.
No leverage, lot-size, broker execution, financing or guaranteed stop model.

Verified: cost-aware formulas, USD/percent equivalence, cash cap, invalid
numbers/levels/costs, retained original/revised plans, backups and cross-tab
conflicts. Authored notes and device timestamps are editable, self-selected
records, not independently attested prospective evidence.

## 5. Official economics and session preparation

Public Fed monthly calendars and BLS release ICS produce the checked-in
2026 snapshot: 38 events (24 BLS, 14 Fed), verified 2026-10-01. Each record
retains source URL/hash, verification time, Eastern timezone, UTC instant,
source identity and revisions. Refresh preserves rescheduling history and
withholds disappeared releases. No customary times, consensus or actual
release values are synthesized.

Fed April retrieval returned HTTP 403 and that period is explicitly
unavailable. Other years are uncovered. Verification becomes stale after
seven days; this is a manually refreshed schedule, not a live release feed.
Run `python3 scripts/update-market-lens-economics.py --year 2026` and review
its source changes. Requirements are Python 3, curl and system timezone data;
no credentials, subscription or new runtime dependency.

The session brief shows the current instrument/timeframe, latest finalized
price and available indicators, upcoming selected context, active rules,
saved setup/risk/invalidation, session-only checklist and earlier journal
review. Crypto has no universal opening/closing session. Existing watch rules
use shared sky events and monitor only while this page is open; personal and
economic timing appears in preparation context. No background delivery.

Verified: US Eastern DST conversion, fractional display timezone, stale and
unavailable coverage, reschedule persistence/disappeared-release handling,
filters/details and brief. Historical economic release-response analysis is
explicitly unavailable.

## 6. Descriptive research and prospective record

History retains every qualifying loaded occurrence, including pending and
incomplete rows. Personal definitions preserve moving/natal roles, chart
revision and orb. Symmetric shared pairs remain symmetric. All observations
use identical bar-aligned before/after windows, with gaps/unfinalized bars
excluded from completed metrics. Returns, range, realized volatility
(`100 × sqrt(sum of squared close-to-close log returns)`), reversal, sample
counts and distributions are visible. Overlap and linked passes are flagged.

Controls are the nearest complete same-weekday, same-UTC-bucket window,
searched at ±7-day steps through 56 days, earlier first on ties, with the
same horizons. Reject overlaps with any loaded context and candidates outside
source coverage. Do not optimize against outcomes. Compare only paired event
rows with their controls; unmatched and reused/unique controls stay explicit.
Non-event means no loaded supported event, not absence of all possible
astronomical phenomena. Personal scans cover the current query, so historical
personal samples/controls can be small or unavailable. These are descriptive
observations, not an executable strategy or efficacy test.

The prior consumed lunar holdout and its negative/inconclusive result are
unchanged. The separate frozen prospective v1 protocol compares the same
cash spot SMA20/SMA50 strategy with/without its declared lunar gate and equal
costs, missing-data, sizing and execution rules. See
[PROSPECTIVE.md](../../research/market-lens/PROSPECTIVE.md). Its first decision
was recorded before October 2 execution; at this review no outcomes or trades
have settled. New personal/score hypotheses require a new declared protocol
and fresh evaluation. They are not silently added to v1.

Durable scheduling, private persistent volume/backups and independent
decision-hash witnessing remain unconfigured. This cloud session cannot be
represented as a managed 180-day service. Journal comparisons remain
self-selected/descriptive; no public model forecast is enabled.

## 7. Optional traditional outlook

Off by default. `interpretive-astrology/1` samples at 12:00 UTC on each ISO
date. Base 50; conjunction 0, sextile +1, trine +2, square/opposition −2.
Moon weight 0.5, Jupiter/Saturn 1.5, others 1; reliable natal house 2/5/8
multiplies by 1.25. Multiply each weight by `1 − deviation/selected orb`,
sum, clamp 0–100 and round to one decimal. Fixed ≥70 supportive, ≤30
challenging, otherwise mixed. Contributions and all assumptions are exposed.
No price fitting, period-relative normalization or probability claim.

All views share the same computed daily values. Monthly and seven-day
summaries describe astrology days only. Unreliable Moon/angles/houses are
omitted. Verified: known contributions/house modifiers, fixed thresholds,
settings and identical scores across all four browser views.

## Final verification and launch status

Final verification evidence is recorded in `revised-acceptance.json` and
LAUNCH.md: 6,469 tests pass, four skip; 30 built-browser checks and 18 current
Phase 1 captures pass; static checks have zero errors/warnings; production
build and unchanged bundle budgets pass. Price-free synthetic calendar
and setup screenshots are retained with this
record, cropped to the product panels with fixed navigation hidden for capture;
price-bearing screenshots remain private session artifacts pending
display rights. The production browser driver runs both legacy and revised
workflows against built assets and the real local same-origin adapter.

Hosted Coinbase prices stay disabled pending written public-display rights.
[DATA-RIGHTS.md](DATA-RIGHTS.md) contains the updated owner-send request;
no provider was contacted or purchased. Coinbase display pricing is unknown;
CoinAPI access tiers are not display-license quotes. No X or LLM API is
needed. The protected earlier preview contains the initial scope; the revised
scope is not deployed, and the absent secure preview bypass prevents a direct
deployed Lens acceptance claim. Main-only Vercel cost controls stay intact.
