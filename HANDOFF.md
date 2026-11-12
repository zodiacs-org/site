# HANDOFF, P6.2 eight tests scoreboard

Branch `docs/eight-tests-scoreboard`, one commit `470f2078a` by Zodiacs Admin <admin@zodiacs.org>. Not pushed, no PR (coordinator opens the draft PR).

## What changed
- New file `docs/growth/records/2026/GROWTH-2026-11-16-eight-tests.md` (growth record, type experiment, status approved). Nothing else.
- Contents: the "reach problem" rule at the top; key dates (16 Nov start, 7 Dec three-week read, 16 Dec verdict or day 30, 10 Jan 2027 owned reach, target 500, floor 150); the live analytics check; the settings Dias would set; T1 to T8 pass and fail numbers copied word for word from final-audit.md section 4; one weekly table per test (all cells null) naming the P6.1 events and the non-analytics sources; a baseline table for 1 Sep to 15 Nov 2026 (all null); "What Dias needs to provide" (Plausible, Vercel Web Analytics, Google Search Console, each with export path and read-only alternative); five proposals A to E.

## Live check result (12 Nov 2026, 11:35 UTC)
- https://zodiacs.org/ and https://zodiacs.org/birth-chart/: HTTP 200, no Plausible loader, no Vercel `/_vercel/insights/script.js` loader, no `data-guide-analytics-boundary`; only the no-op `zodiacsAnalytics` stub.
- Both pages are `accountSurface` and live HTML shows `data-account-sync-v2`, so Base.astro excludes analytics on them regardless of env. The check therefore cannot tell whether `PUBLIC_PLAUSIBLE_SCRIPT_URL` / `PUBLIC_VERCEL_WEB_ANALYTICS` are set for other pages. Next step: fetch one non-account content page (a sign guide or /your-2027-sky/) to settle it.
- Disclosure: I also made one extra public fetch of https://zodiacs.org/registry/ (grep for "plausible", no match). It is a static wing page that is analytics-free by design, so it is not used as evidence in the document.

## Tests
- No code changed. Verified by script that all 24 success/kill/duration strings from section 4 appear verbatim, and that the file has no em or en dashes and no crypto words. `node_modules` is not installed in this worktree, so the npm test suite was not run; no test reads this new file (only `trust-surface-consistency.test.mjs` reads two other growth docs).
- The verbatim T2 cells contain "buying" (paid orders for the 2027 calendar); kept because the ticket requires word for word copying. My own text uses "paid orders".

## Flags or production settings needed (none set)
- `PUBLIC_PLAUSIBLE_SCRIPT_URL` (required for every product event), optional `PUBLIC_PLAUSIBLE_ENDPOINT`, `PUBLIC_PLAUSIBLE_DOMAIN`; optional `PUBLIC_VERCEL_WEB_ANALYTICS=1` plus enabling Web Analytics on the Vercel project and the steps in GROWTH-2026-09-01-vercel-web-analytics-flag. All need Dias's yes.
- Plausible goals for each P6.1 event and `assistant_arrival` (Proposal E).

## Open
- Proposal A (needs Dias's decision before 16 Nov): with account sync v2 on, analytics is off on home, birth chart, horoscope sign pages, today, transits and other account surfaces, so T1's chart and horoscopes placements, T1's result-page denominator and some T8 arrivals cannot be counted; /birthday-report/ is privateSurface so `year_pack_cta` surface birthday_report never counts.
- Proposal B: Plausible sources read Direct/None by design (referrer nulled, canonical URL). Sources must come from the P6.1 `source` value.
- Proposal C: confirm whether Vercel's script sends the referrer before switch-on; the 2026-09-01 record says it does not receive referrer-derived data.
- Proposal D: docs/ANALYTICS.md lists wing_record_view / wing_acquisition_click that cannot fire and omits assistant_arrival. Could overlap with P6.1, which edits ANALYTICS.md.
- Dias to supply the baseline exports listed in section 6; the July/August exports' tool is not recorded in the repo.
- T2, T3, T4, T8 start dates are null until those features ship or a listing is approved.
