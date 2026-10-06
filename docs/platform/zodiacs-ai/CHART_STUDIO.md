# Chart Studio 0.3.0 — implementation review

Chart Studio adds an interactive MCP Apps panel to the existing Zodiacs server.
`open_chart_studio` takes exactly `{}` and returns a fixed launcher result. The
panel starts with a labeled synthetic chart. It uses the existing wheel,
selection/emphasis model, engine adapter, and versioned natal-record codec.
The shared website wheel source is unchanged.

## New in 0.3.0 — 2026-10-06

The current uninstalled candidate follows main's vendored rc.17 engine, which
is not published on npm. The earlier 0.3.0 screenshots below were captured with
rc.16; the connected 0.2.0 ChatGPT deployment remains unchanged on rc.16.

The following capabilities extend the same panel and both plugin packages:

- **Local time and place:** offline search over a population-ranked subset of
  1,000 cities from the site's GeoNames index, with manual coordinates/IANA
  zone entry for other places. The site's shared local-time resolver preserves
  pinned pre-1970 history and local mean time. A separate review names the UTC
  instant, repeated/skipped-clock policy and historical uncertainty before use.
  The receipt retains the original wall time and assumptions. UTC stepping
  removes that old wall-time provenance while retaining subminute precision.

- **Time Explorer:** UTC steps of 15 minutes, one hour or one day; an explicit
  anchor and circular position differences; unknown time permits daily noon
  references only and continues to omit angles/houses. Unapplied input changes
  disable stepping. Reset removes the old anchor.
- **Birth-time windows:** two explicit UTC bounds and coordinates, up to 48
  hours, evaluated by the pinned engine's `birthWindow`. The start is
  included and end excluded. Signs and houses found, readable transitions,
  angle signs, aspects in orb, polar fallback, unresolved nodes and exceeded
  bounds remain inspectable. Verification is the engine's one-second sampling
  assessment, not a completeness proof or birth-time rectification.
- **Chart Inspector:** local file or text input, a 64 KiB codec boundary,
  same-version recalculation and the existing record comparator. Replay retains
  the instant, time scale, requested houses and pinned delta-T. Comparisons label
  reproduced explanations separately from reported facts and hypotheses.
  Claimed origin and arbitrary extensions are never authenticated or executed.

The window engine is embedded in a dedicated browser worker. Cancellation,
a 15-second deadline, stale replies, input changes and unmounting terminate work.
No calculation uses a network request. A host that blocks Blob workers receives
a visible refusal; native ChatGPT worker acceptance remains unverified for this
candidate. The standalone preview permits `worker-src blob:` while retaining
`connect-src 'none'`. Inspector file reads are revision-guarded; edits clear old
results and reset clears imported records. No new data enters the host bridge.

The notification service is implemented on a separate OAuth-protected preview
in [SKY_WATCH.md](./SKY_WATCH.md). It does not enable notifications for the
ordinary anonymous/local plugin packages. ChatGPT event arrival remains pending.

The current local-time bundle is **924,260 bytes**. Its build and package drift
checks pass, along with 132 AI unit tests, HTTP/stdio clients and published-engine
recipes. Website build and typecheck pass. The final full regression run had
6,898 passes, six skips and one unrelated 15-second build-audit timeout. All 11
tests in that file passed separately (the timed-out check took 4.7 seconds).
This is not a clean single full-suite run; exact candidate CI remains separate.

Browser checks of this bundle cover New York's skipped/repeated daylight-saving
times and Mexico City's 1907 subminute conversion. Keyboard review and explicit
sharing work in an opaque-origin synthetic host without `allow-forms`: applying
local time shares zero selections, reviewing a selection still shares zero, and
the final Share sends one. At a 360px viewport, document and scroll widths both
measure 345px. The new dedicated Watch deployment includes this Studio candidate;
the original connected Studio deployment is unchanged. See the
[current local-time evidence](evidence/studio-local-time/verification.json).

The earlier 527,473-byte standalone bundle passed its reproducibility and package
checks. Production build (4,417 pages), typecheck (zero errors/warnings), 77 AI
tests, official HTTP/stdio clients, engine recipes and the claims ledger pass.
The full regression run passed 6,836 tests, skipped five, and timed out one
existing Phase 1 source-hashing test under suite load. All five tests in that
file passed in isolation; the timed-out test took 599 ms. This is recorded as
an isolated recheck, not a clean single full-suite run.

Browser checks cover 1280px desktop and 360px mobile (345px document width),
UTC stepping, window calculation and readable transitions, unknown time,
local file import, reproduction, mismatches, invalid input, tab persistence
and reset. A sandboxed opaque-origin host calculates without `allow-forms`;
calculation buttons use local handlers, including keyboard Enter. No host data
is sent by either new workspace. Sharing still sends zero selections before
confirmation and one afterward. Actual ChatGPT acceptance of 0.3.0 remains
pending. [Verification receipt](./evidence/studio-next/verification.json) and
captures record the source hashes and scope.

## Historical 0.2.0 implementation and evidence

## Included

- UTC date/time and optional coordinate inputs; Placidus and whole-sign houses.
- Explicit unknown-time noon reference, with no houses/angles or location use.
- Pointer selection and a native keyboard-accessible element menu for bodies,
  signs, houses, angles and aspects; connected aspects show orb and motion.
- House-system comparison for the same instant/location. Requested and actual
  systems, including polar fallback, remain in each record.
- Receipt inspection and a JSON download control. Exported records contain birth
  inputs and are labeled accordingly.
- A second, explicit review-and-share action. The preview's selected facts are
  sent through `ui/update-model-context`; hosts offering only `ui/message`
  receive an explicit question with those facts. Raw date/time/coordinates and
  the full record are excluded from that projection. Derived positions remain
  personal information. Earlier shared context is not erased on chart reset.
- Embedded engine, fonts and twelve sign images: 397,635 bytes of HTML, with
  third-party notices. No external asset or calculation request is needed.

The panel does not persist charts. It does not add an account, geocoding,
local-time conversion, chart import, reminders, a new interpretation model,
or the later Event Watch/Record Vault/Verification Lab roadmap products.

## Checks

On 2026-10-05, Node 22.23.2:

- Production build after merging main: 4,417 pages; postbuild, distribution,
  schema and bundle budgets pass. The website wheel source is unchanged.
  Phase 1 captures are refreshed against the merged template source.
- Full repository suite: 6,796 passed, five skipped, 524 passing test files.
- Typecheck: zero errors and warnings (39 existing informational hints).
- AI tests: 54 tests pass; official HTTP client launches the panel, refuses
  personal arguments and retrieves its resource; official stdio client checks
  all nine tools and the packaged resource. The installed 0.2.0 developer copy
  also passes this driver after dependency installation.
- Existing synthetic adapter evaluations: 40/40 pass.
- Reproducible bundle, manifest and package-member checks pass. Both local
  marketplace candidates are installed/enabled at 0.2.0. Sky now includes
  generated compatibility manifests so the local client retains its version,
  branding, skills and MCP configuration during upgrades.
- In-app browser: 1280px desktop and 360px mobile layout; mobile document width
  345px within a 360px viewport; 12/12 sign images embedded; unknown-time controls
  and house/angle absence; house comparison; pointer Sun selection; keyboard
  Venus selection; receipt view; no observed console errors.
- Sandboxed synthetic MCP host: zero selections received on open/preview,
  one received after explicit sharing; context attachment, message fallback,
  and host refusal surfaced correctly. Unit tests also cover origin/source
  checks, timeout, unsupported capability and disposal.

The download control was exercised, but the in-app browser did not return a
completed-download event. Record serialization and codec replay pass; actual
saved-file download remains a host acceptance check. No download success is
claimed from that browser run.

Captures and the machine-readable receipt are in `evidence/chart-studio/`.
The merged source requires a regenerated minified Studio bundle. Two successive
builds produce identical SHA-256 hashes, package drift checks pass, and the
refreshed installed developer server matches the generated bundle. The final
browser capture verifies that regenerated HTML renders without console errors.

The merged-source GitHub run passed all 18 Phase 1 captures, 15 visual
comparisons, and Lighthouse across 30 routes (90 samples). Its explorer drive
reported two focus timing failures. The manual Moon-return toggle retained
its value and restored calculation; the browser drivers now wait for the
existing selected-place focus transfer and inspector animation-frame focus
before continuing. Their assertions remain intact. Browser Evidence run
37349538899 passes on `f8110d7132cbd4bb305eeae0ebd331d8b2009d9e`, including
the full navigation/explorer drive. The original failed provenance remains in
`evidence/chart-studio/merged-browser-evidence.json`.

The separately protected HTTPS preview deploys that same source as
`dpl_GqZf1PE5SX7v299CPtcftsSjaXuZ`. The official SDK passes 15 staging checks
and seven successful calls across all six tools. The Studio resource matches
the committed HTML byte-for-byte; both entrypoints, empty-only launcher input,
self-contained CSP, personal-argument refusal and recovery pass. See
`evidence/chart-studio/https-staging.json`. Unauthenticated access redirects
to Vercel SSO; temporary access credentials are excluded from this repository.

## Try it

From the repository, run `npm run ai:serve` and open
`http://127.0.0.1:8787/studio`. The current review session uses port 8794.
`/studio-test-host` is a loopback-only synthetic host fixture. It never connects
to an assistant. A standalone HTML copy is included in the owner's output kit.
Standalone mode can calculate and inspect records but cannot share context.

In a supporting MCP Apps host, invoke `open_chart_studio` with `{}`. The tool
advertises global/thread entrypoints and prefers fullscreen. Public tools now
number six; the developer server adds three local chart tools for nine total.
Only the fixed Studio resource receives the larger 2.1 MB response budget;
ordinary responses keep the 256 KiB bound and incoming requests keep 16 KiB.
The builder caps JSON-encoded HTML at 2 MB.

## Release state

The owner authorized creation and connection of **Zodiacs Chart Studio Preview**
on 2026-10-05. Its branded profile is connected, and actual ChatGPT global
calendar and Studio rendering, Sun selection and house comparison were observed.
That private connection remains frozen on source `f8110d71` (0.2.0); the new
0.3.0 features are a review candidate on a separate OAuth preview; they have
not passed native ChatGPT acceptance or replaced the installed local packages.
The original calendar connection also retains its deployment. Thread entrypoints,
assistant sharing, saved-file download, consenting beta feedback and publisher
verification still need acceptance. Production is disabled. Final submission,
merge and production activation remain owner-reserved.

## Later main-branch integration

Main's election-search release `51b64f3c` is integrated in `498b0066`. Both
branches' privacy assertions are retained and the server bundles are rebuilt.
The Studio HTML is byte-identical to the frozen HTTPS preview. The combined
build passes at 4,417 pages, typecheck reports zero errors/warnings, and 6,809
regression tests plus five refreshed evidence tests pass (6,814 total; five
skipped). All 54 AI tests, official HTTP/stdio clients, recipes and package
checks pass. Fresh GitHub captures bind the combined source; all 18 pixel hashes
match the existing screenshots, so only the receipt changes. No candidate
visual baselines were imported. `evidence/chart-studio/main-integration.json`
records this scope. Full combined-source CI is still in progress; this is not
a complete CI pass or a deployment of that later source. The connected ChatGPT
plugin continues to target the independently verified `f8110d71` preview.
