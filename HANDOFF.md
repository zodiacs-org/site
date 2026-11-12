# HANDOFF, P6.2 eight tests scoreboard

Branch `docs/eight-tests-scoreboard`, three commits by Zodiacs Admin <admin@zodiacs.org>, no trailers:
- `470f2078a` the scoreboard;
- `d99ce9cfc` (coordinator) records the content-page fetch: Plausible is live on content pages such as /moon-phase/, Vercel Web Analytics is off;
- the latest commit, fixes from the Codex review.

Not pushed, no PR (the coordinator opens the draft PR). HANDOFF.md and STATUS.md were committed by the coordinator's commit and are kept tracked.

## What changed
- `docs/growth/records/2026/GROWTH-2026-11-16-eight-tests.md` (growth record, type experiment, status approved). Nothing else outside this file, HANDOFF.md and STATUS.md.
- It holds:
  - the "reach problem" rule at the top, with each kill condition judged separately against its own named volume (per-test table);
  - the key dates (16 Nov planned start, 7 Dec three-week read or start plus 21 days, 16 Dec verdict or day 30, 10 Jan 2027 owned reach with target 500 and floor 150);
  - the live analytics check and the settings Dias would set;
  - the T1 to T8 pass and fail numbers, word for word from final-audit.md section 4;
  - one weekly table per test, all cells null, naming the P6.1 events;
  - a null baseline for 1 Sep to 15 Nov 2026;
  - "What Dias needs to provide";
  - proposals A to E.

## Codex review fixes (latest commit)
- **Blocker:** `/year-score/` and `/your-2027-sky/` are `privateSurface`, so analytics never loads on them.
  - The T2 inputs that depend on them are marked "not measurable" in the feeds list and the table headers: `year_score_completed`, `year_pack_cta` on the year_score, year_sky and birthday_report surfaces, `email_subscribed` with placement year_score, and landing visits on those pages.
  - Only paid orders, from the payment provider, can be read.
  - Proposal A now covers privateSurface pages as well as account surfaces.
- **Privacy line:** now limited to the scoreboard and its analytics events. It notes that the email provider keeps confirmed contacts' addresses and may keep a chosen sign.
- **Kill conditions:** each is judged on its own volume. T1's click rate and T3's calendar adds have no volume gate. T2's 1,000 landing visits is independent of its 500 completers. "Reach problem" and "not measurable" are kept apart.
- **Dates:** T3, T4 and T7 starts are "planned 16 Nov, actual null". Their weekly tables count days from the actual start, with the 16 Nov dates marked provisional. T3, T4 and T7 three-week reads now carry the "otherwise start plus 21 days" rule.
- **Handoff:** this file now reflects the second commit, and the content-page fetch is no longer listed as open.

## Live check result (12 Nov 2026)
- 11:35 UTC: https://zodiacs.org/ and https://zodiacs.org/birth-chart/ return HTTP 200 with neither loader. Both are account surfaces with account sync v2 on, so they are excluded by design.
- 11:50 UTC (coordinator): /moon-phase/ has the Plausible loader, so `PUBLIC_PLAUSIBLE_SCRIPT_URL` is set in production. /your-2027-sky/ has no loader (privateSurface). No Vercel loader was found anywhere.
- Disclosure: I made one extra fetch of https://zodiacs.org/registry/, a static wing page that is analytics-free by design. It is not used as evidence.

## Tests
- No code changed. A script checked that all 24 duration, success and kill strings from section 4 appear verbatim, and that the file, HANDOFF.md and STATUS.md contain no em or en dashes. It also found no crypto words in the scoreboard.
- `node_modules` is not installed in this worktree, so `npm test` was not run. No test reads the new file.
- The verbatim T2 cells say "buying" (paid orders for the 2027 calendar). They are kept because the copy must be word for word; my own text says "paid orders".

## Flags or production settings (none set by this ticket)
- `PUBLIC_PLAUSIBLE_SCRIPT_URL` is already set. `PUBLIC_PLAUSIBLE_ENDPOINT` and `PUBLIC_PLAUSIBLE_DOMAIN` are optional.
- `PUBLIC_VERCEL_WEB_ANALYTICS=1` is optional. It also needs Web Analytics enabled on the Vercel project and the steps in GROWTH-2026-09-01-vercel-web-analytics-flag, and needs Dias's yes.
- Plausible goals are needed for each P6.1 event and `assistant_arrival` (Proposal E).

## Open
- **Proposal A**, Dias decides before 16 Nov; the recommendation is (a) now and (b) before T2 goes on sale. Analytics is off on account surfaces (home, birth chart, horoscope sign pages, today, transits and others) and on privateSurface pages (/year-score/, /your-2027-sky/, /birthday-report/). As a result:
  - T1 kill condition (a) cannot be judged;
  - neither T2 kill condition can be judged;
  - T8 undercounts referred visits;
  - the good day and birthday card pages (T3 and T4, not yet built) must be built without either flag for their events to count.
- **Proposal B:** Plausible sources read Direct / None by design. Sources come from the P6.1 `source` value.
- **Proposal C:** confirm whether Vercel's script sends the referrer before switching it on.
- **Proposal D:** docs/ANALYTICS.md lists wing_record_view and wing_acquisition_click, which cannot fire, and omits assistant_arrival. This may overlap with P6.1, which edits ANALYTICS.md.
- **Exports:** Dias supplies the baseline exports in section 6. The repo doesn't record which tool produced the July and August exports.
- **Start dates:** T2, T3, T4, T7 and T8 have null start dates until they actually start.
