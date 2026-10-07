# Zodiacs Desk: trade window and plan ledger

Added 7 October 2026, Asia/Bangkok, on draft PR #619 after validated commit
`1f1f7a1382ad3922195f391b3a57dcd220f5d63f`. The owner chose the product name
Zodiacs Desk. Market Lens remains the internal name of the code, storage and
research records; dated documents keep the old name.

## What changed

**Name and route.** The workspace is `/terminal/desk/` and its experiment page
is `/terminal/desk/research/`. `vercel.json` permanently redirects
`/terminal/lens`, `/terminal/lens/` and `/terminal/lens/:path(.*)` to the same
paths under `/terminal/desk/`. The Terminal page and the research hub link to
the new route. The route budget key moves with the page; the 32 KB limit is
unchanged. Internal identifiers stay as they were so saved browser data and
frozen research receipts are untouched: the `zodiacs-market-lens-v1` IndexedDB
database, `zodiacs-market-lens-*` preference keys, `MARKET_LENS_*` settings,
`/api/registry/lens` and every `research/market-lens/` file.

**Trade window.** Setup & risk and the Session brief show the plan's holding
window. It opens at the planned entry (new and optional, typed in the display
time zone) or when the plan was first saved, and closes at the end of the
horizon. The planned entry is resolved with the Desk's Intl-based session-time
helper, `localInstant` in `sessions.ts`: a time skipped by a clock change is
refused and a repeated time uses its earlier instant. A planned entry is a
present-day market time, not a birthplace, and this keeps `src/lib/` unchanged,
so the Phase 1 capture receipt still matches its template sources.

- One strip marks official releases as tall labelled marks, sky events as short
  marks and personal transit windows as bands with their exact contacts.
  Arrowheads show a band that starts before or continues after the window. Each
  kind also has its own shape and is named in text in the list, so color never
  carries the meaning alone.
- The list gives minute-precision times relative to entry. Spans that cover the
  whole window are folded under "In effect for the whole window (n)".
- A linked context window ten or more times longer than the trade is called out
  as background rather than timing. Coverage limits of the loaded sky months and
  of the economic snapshot are stated.
- "Export window (.ics)" downloads one calendar with the trade window and each
  exact event once. The trade-window entry carries no plan text.

**Plan ledger.** The Journal view opens with the ledger.

- It grades saved setups only, because a result in R needs the planned entry
  and stop. Journal notes without a setup stay notes.
- Saving a TA + astrology setup requires one answer to "What did the timing
  change?": nothing, a larger size, a smaller size, the decision to trade, or
  the decision to pass. The answer is then fixed with the plan, like the method
  and horizon.
- The plan can change until 15 minutes after its window opens. A revision saved
  before the window opens may move the planned entry; once it is open, later
  revisions cannot move it again.
- A review records what happened: target, stop, horizon exit, early exit, no
  confirmation, or passed. An exit price gives the result in R from the setup in
  force when the window opened, with the sizing estimate's fills, tick rounding,
  fees and slippage, so the planned stop is −1 R and the planned target is the
  plan's net reward : risk. Target and stop prefill their prices. Without an
  exit price the trader can enter R directly, for example after scaling. A
  passed plan may record where it would have exited; plan adherence belongs to
  trades that were taken. Reviews are revisions; earlier versions remain.
- Plans saved more than 15 minutes after their planned entry, or whose
  expectation, plan or setup changed after the window opened or after review,
  are listed and left out of the figures. Setup & risk warns before such a save.
  Device clocks are self-reported; this is a self-check, not an attestation.
- Each group (TA only, and each timing answer) shows plans, reviews and
  outcomes, R statistics from 5 graded results, and a dot strip on one shared R
  axis; hollow dots are would-have results, kept apart from real trades. Two
  comparisons open at 20 graded results on each side: TA-only trades against
  trades the timing enlarged or started, and would-have results of vetoed plans
  against TA-only trades.

The ledger is descriptive. It compares the trader's own self-recorded,
self-selected plans; it cannot show that timing predicts prices, and the copy
says so. Deleting a plan removes it from the figures.

## Storage

Workspace schema 3 adds optional `timingRole` to journal entries, `review`
(`status`, `exit`, `r`, `followedPlan`, stored in that key order) to entries and
revisions, and `entryAt` to setups. Schemas 1 and 2 are read unchanged and
become schema 3 only through the existing atomic compare-and-save; exports are
schema 3. A schema 1 or 2 file that contains schema 3 fields is refused. An older
build reading a schema 3 workspace refuses it and leaves it unchanged rather
than overwriting it. Validation also rejects a timing answer on TA-only plans,
an exit or R on a plan whose confirmation never came, plan adherence on a plan
that was not traded, an exit without its R, R outside ±100, and a latest review
that differs from its latest revision.

## Bundle

The selected-event detail moved into a lazily loaded `EventDetail` component,
and the trade window, ledger and review form load with the panels that use
them. A local esbuild estimate of the island's static closure as one gzip
stream went from 21.30 KB to 21.36 KB (minified size fell by 0.31 KB). The route
measured 31.8 of 32 KB at the validated commit; Site Check's bundle gate is the
authority.

## Verification

The session's network policy blocked the npm registry, so the project's
dependencies could not be installed locally. Local checks used tools already on
the machine:

- 205 tests through a local stand-in for the vitest API, itself checked to
  report failures: 108 in the Lens storage, ledger, window, events, history,
  rules, indicators, cross-asset and market suites, and 97 in the local-time
  caller guard, route, terminal notice, workflow, authorship and Swiss-output
  guard suites. `revised.test.ts` needs the engine's ephemeris dependency and
  was not run.
- TypeScript over the Lens sources with stand-in Preact types: no errors in the
  new or changed files.
- The consumer boundary, voice, stale-wording and source-authorship gates.
- `tests/zodiacs-desk-drive.mjs` passed all ten checks in headless Chromium
  against the real island, bundled onto a React stand-in for Preact, with real
  IndexedDB, the economic snapshot and sky shards, and prices disabled.

Site Check now runs that drive and the existing cross-asset drive against the
built site; their screenshots are uploaded with the browser evidence. The real
build, full suite, Astro check and bundle gate are verified there, not here.

**Integration with main.** Main moved four commits past the integrated base
`8e0b849e`. Both sides regenerated `docs/acceptance/phase1/screenshots/`, so the
pull request reports a conflict and GitHub skips its `pull_request` checks until
main is integrated again. Integration needs the 18 Phase 1 captures refreshed
for the merged sources with the supported drive (`npm run test:phase1:acceptance`
after a build, or the Browser Evidence workflow), which this session could not
run. Until then, Site Check runs on the branch head by manual dispatch.
The protected preview still serves application `54fd2609` without these
changes. No preview was redeployed, no protection changed, and prices remain
disabled.
