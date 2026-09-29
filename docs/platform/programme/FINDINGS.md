# Findings ledger

This ledger records the defects and unsupported claims found when the
engine/platform work was audited again on 2026-09-28. Each entry states its
severity, how to reproduce it, its root cause, the fix, the regression test, the
risk that remains, and its disposition. Entries are appended and never
rewritten. When a disposition changes, the new one is written beside the old.

**Audits and what they read.** Seven independent reviews ran, each in its own
worktree. Each was given the artifacts and the claims but not the authors'
reasoning, and was asked to list the premises and attack them by running code:

| id | review |
| --- | --- |
| A1 | Release provenance: source → archive → site → MCP → production. |
| A2 | Engine rc.11: configured aspects and declinations. |
| A3 | Engine rc.12 (PR #8): secondary progressions. |
| A4 | Phase 1, steps 1.1–1.15. |
| A5 | Privacy, trust and public claims. |
| A6 | The version 1 rules version 2 retains, and the dispositions of the audit findings. |
| A7 | The programme's status, item by item. |

All of these reviewers are AI agents with fresh contexts and separate prompts,
not people and not another model family. Their raw logs are working files,
not committed.

Severity follows the audit's scale:

| severity | meaning |
| --- | --- |
| blocker | Stops the dependent work. |
| major | A wrong result, a false public claim, or a broken rule of the brief. |
| minor | A defect with a narrow effect. |
| info | A note. |

## Summary

| id | severity | area | finding | disposition |
| --- | --- | --- | --- | --- |
| F-06 | major | engine rc.11 | Configured-aspect "exact orb" claim fails on general decimal inputs | fix in engine rc.13 (in progress); fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it |
| F-17 | major | privacy | Share code of a chart without a birth time reveals the birthplace's longitude or zone | open: code fix planned; copy wrong until then; fixed in #599: a chart without a birth time is shared as the sky at 12:00 UTC on its date, and the copy is corrected in six locales |
| F-18 | major | privacy | Sign-icon requests reveal Sun, Moon and rising signs to the server; privacy page silent | open: fix planned; fixed in #599: a chart's page asks for all twelve sign pictures of a size before showing its own |
| F-19 | major | privacy | Guide chart attachment carries angles to the arcminute; copy says time and place are never attached | open: feature appears off; fix planned; fixed in #599: Guide gets the ascendant and midheaven to the whole degree, and a chart without a birth time as the sky at 12:00 UTC; the consent text and the privacy page say so |
| F-20 | major | privacy | §6's "nothing in a URL from which a birth can be recovered" is broken by the calendar feed | owner decision (§10.4); decided 2026-09-28: opaque feed ids (P1.15), not yet built; meanwhile #599 makes feed codes carry a timed birth only to its whole UTC minute |
| F-21 | major | boundary | Token and ownership framing on engine and developer surfaces (R6, R7) | open: engine part in rc.13; site part planned; engine part fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; site part planned |
| F-22 | major | licensing | Swiss Ephemeris output committed in `src/lib/engine/fixtures/` and in evidence folders | owner decision; no new Swiss output |
| F-29 | major | process | Rule amendments A1 and A3 were adopted by an agent after the residuals were seen | owner ratification; the affected units count as validated, not accepted |
| F-32 | major | evidence | rc.10's Swiss figures for the points existed only in a PR description; Equal-MC never measured | fixed: `evidence/points-2026-09-26/` published and rerun |
| F-33 | major | engine | Koch fails the end-to-end 3″ gate in one ladder case (3.73″) | FAIL recorded; waits for better sidereal-time agreement |
| F-34 | major | records | Seven major audit findings have no recorded disposition | open: triage recorded below |
| F-35 | major | engine | The package's `resolveBirth` lacks steps 1.1 and 1.12: Buffalo 1870 −4:56:02 and Stockholm 1947 +2:00, where the site gives −5:15:31 and +1:00 | open: port into the engine (P1.01b, P1.12b) |
| F-36 | major | engine | `resolveBirth` silently ignores `calendar: 'julian'`: Petrograd 1917-10-25 O.S. comes back 13 days off | open: add the input or refuse unknown keys (P1.13b) |
| F-40 | major | privacy | The share copy's "region about 500 km across" does not hold at high latitude: 49 × 49 km at 64.98° N | open: correct the figure with the share-code fix; fixed in #599: the privacy page gives the area's size by latitude |
| F-43 | major | privacy | The solar return card printed the return instant to the second, which gives the birth instant to about a second: before standard time, strips of longitude about 3 km wide; without a birth time, the zone | fixed in #599: the whole minute, whole-degree angles, whole-sign houses; without a birth time, from 12:00 UTC |
| F-44 | major | privacy | The lunar return card was cast at the birthplace unless another place was chosen, and it showed the angles, which put the birthplace within kilometres | fixed in #599: the whole minute, whole-degree angles, whole-sign houses |
| F-45 | major | privacy | The composite card printed the Moon midpoint to the arcminute when one person had no birth time; anyone who knows the other chart could recover that person's local noon, and so their zone | fixed in #599: a person without a birth time is drawn at 12:00 UTC without the Moon |
| F-01 | minor | provenance | Two different archives both named 0.1.1-rc.11 | fix in rc.13 (artifact list; one version, one byte sequence); fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it |
| F-02 | minor | provenance | Engine CI never binds an artifact to its source | fix in rc.13 (CI rebuild-and-compare); fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; CI on the merge ran the check |
| F-03 | minor | provenance | Site CI does not run `mcp:pack:check` | open: site CI change planned |
| F-04 | minor | docs | The engine install snippet can install into a parent directory | open: guard in the snippet planned |
| F-07 | minor | engine rc.11 | The Sun is flagged out of bounds at about half of all solstices | fix in rc.13; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; the chart's own Sun is exempt by a stated convention |
| F-13–F-16 | minor | engine rc.12 | Follow-ups from the PR #8 review (tolerance derivation, RangeError at Date limits, wording, script isolation) | fix in rc.13; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it |
| F-23 | minor | claims | The claims ledger does not read developer docs (`public/sdk/**`, example READMEs, the engine's README and CHANGELOG) | open |
| F-24 | minor | claims | Accuracy wording without figures in four locales; `acc.qualitative` rests on the Swiss benchmark; the methodology page lacks the Horizons figure | open |
| F-25 | minor | licensing | GeoNames attribution lacks the licence link and a modification note | open |
| F-26 | minor | claims | `/ask/` and `/about/` describe Guide chart attachment as available | open (ties to F-19); fixed in #599: `/ask/` and `/about/` describe the attachment as it is sent |
| F-27 | minor | privacy | The privacy page does not say that platform logs keep full request URLs | open (ties to F-20); fixed in #599: the privacy page says platform logs keep each request's full address, and what that address carries |
| F-28 | minor | repository | Repository basics missing (R7); site README still leads with the token registry | open (P3.11, G2, G3); basics fixed: the site's README and files in #597, the engine's in zodiacs-org/engine#12 (`b0ddb886`), the SDK's in zodiacs-org/sdk#14 (`a95dc0cf`), all merged by 2026-09-29; the site's topics (G2) and the site's scanning, releases and badges (G3) remain |
| F-37 | minor | wing | `src/islands/WalletChart.tsx:189` passes no longitude and never calls `prepareLocalTime`, so it gets the host's zone history | open |
| F-38 | minor | time | A gap at the end of a local-mean-time era drops the `localMeanTime` field (Buffalo 1883-11-18 11:50), so the notice does not show | open |
| F-39 | minor | copy | `lmtNotice` also fires for legal mean times (Galway 1885, Amsterdam to 1937, Monrovia to 1972), where the birthplace's own mean time was not used | open |
| F-41 | minor | tests | The committed round-trip scan covers only the host path, not the pinned tables production uses; `build-transits.test.mjs` runs 110.7 s against a 120 s timeout | timeout: fixed in #596 after it timed out in CI (one test per month; `build-event-horizon.test.mjs`, at 4.0 s of a 5 s default, likewise split); round-trip scan: open |
| F-46 | minor | engine | Placidus cusps failed to converge at isolated instants within about 1e-8° of the polar limit, so `natalChart` fell back to whole signs there (and said so), although Placidus exists there | open: a bisection fallback is on the birth-time window branch, for the next candidate |
| F-47 | minor | engine | ΔT is discontinuous at its 1941 seam: TT steps back 13.95 ms at 1940-12-31T18:00Z | open; the window search splits at the seam meanwhile |
| F-48 | minor | engine | The true node's finite-difference jitter (up to 4.83e-5°) makes some node ingresses too costly to partition to the millisecond | open: the window search reports them unresolved; a smoother node is planned |
| F-08 | info | engine | The physical declination rule (≤ 0.01″ vs Swiss FLG_EQUATORIAL) is not met: median 1.71″, max 20.76″ | FAIL recorded on P2.A.aspects.declination-accuracy; waits for P4.1 |
| F-09 | info | engine | astronomy-engine's five-term nutation puts true obliquity up to 0.082″ from ERFA | noted for P4.1 |
| F-10 | info | engine tests | Some rc.11 tests confirm the implementation with itself | rc.13 adds independent oracles; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it |
| F-11 | info | engine | Label validation differs between the declination and aspect APIs | fix in rc.13; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it |
| F-12 | info | engine scripts | `verify-packed-consumer.mjs` picks up `@types` from parent directories | fix in rc.13; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it |
| F-05 | info | release | rc.9 never served production; three deploys failed on the `/birth-chart/` budget until #588 reached main through #593 | recorded; the CI job now builds production's page |
| F-30 | info | process | Most §10 owner decisions have no recorded outcome | listed in STATUS.md with prepared actions |
| F-31 | info | process | Engine PRs #1–#7 were merged without a recorded independent review | PR #8 carries one; later candidates will too |
| F-42 | info | process | The site's Phase 1 steps landed as one squashed commit (#556), not as the separate commits the brief asked for | recorded |

## Details

### F-06 — configured-aspect exactness (major)

- **Reproduction.** Engine rc.11, `createAspectPolicy({bodies:["A","B"],aspects:[{type:"square",orb:0}]})`, with A = 188.86 and B = 98.86 (both speed 0), returns `[]`. The pre-repair commit 00bdae7 returned a square at orb 0. With a semisquare orb of 7.3, Jupiter 6.3 against the Sun at 314 is rejected, but the same geometry at 52.3 / 0 matches. Under the default policy, Mars 7.6999999999999895 against Saturn 359.7 is reported as a conjunction at orb 8, although the exact separation is 8.0000000000000009°.
- **Scale.** On a 0.01° grid of pairs lying exactly at a named angle with zero orb, rc.11 matches 79.8%, the pre-repair build 94.6%, and exact binary arithmetic 50.7%. Every flip lies within 2.84e-14° of a boundary. This does not matter for computed charts, whose positions are never exact decimals. It does matter for the documented guarantee and for positions users type in.
- **Root cause.** Subtracting two doubles derived from decimals exposes their representation errors. The repair's tests all used b = 0, and the independent harness used only values exact in binary, so it passes on the pre-repair build too.
- **Fix.** rc.13 computes the separation exactly (double-double) and compares it with the orb exactly, for matching, for motion and for declination aspects. It has tests against an exact rational oracle on decimal grids with b ≠ 0, and a proof that the harness fails on the rc.11 arithmetic. The README and CHANGELOG state the semantics.
- **Residual risk.** Inputs are exact as binary values, so a typed 188.86 is not exactly 90° from 98.86. The docs say this.

### F-17 — share code of a chart without a birth time (major, privacy)

- **Reproduction.** A share link from the live dialog for 1870-06-15, no time, Buffalo, carries no ascendant or midheaven. The planets are computed at 12:00 local time at the birthplace (`src/islands/ChartCalculator.tsx:1339-1340`). Before standard time that is the birthplace's own solar clock, so the positions give the instant to ±3 s and the longitude to −78.918° (true −78.88°, 3.1 km). For modern charts they give the zone (Kathmandu +5:45, Adelaide +9:30).
- **Why it matters.** The copy says the code reveals "a region about 500 km across". That is true for timed charts, where it comes from the coarsened angles, but not here. Affected: `PositionsShareSurface.tsx`, `CalendarSubscribe.tsx` (six locales), `privacy/index.astro`, `llms-full.txt`, and ledger claim `priv.positions-token`.
- **Fix plan.** Build time-unknown share codes at an instant that does not depend on the place (12:00 UTC on the date) and say so. Add pre-standard-time and half-hour-zone cases to the decoder test, and correct the copy in every locale. The locale files are Phase 1 protected paths and need a one-time scope allowance.

### F-18 — sign icons reveal the chart (major, privacy)

- **Reproduction.** The first computation requests `/assets/zodiac-icons/{128,48}/{sun,moon,rising}.avif` in order: for Tucson 1955, scorpio, cancer, libra.
- **Why it matters.** `/privacy/` lists what file requests reveal (the city's first letter, a zone group) and omits this. The site already treats the Sun sign as birth data: it removed it from analytics for that reason.
- **Fix plan.** Make the request set identical for every chart (all twelve icons of a size, in a fixed order, or one sprite), and test that two different charts produce identical request sets.

### F-19 — Guide chart attachment (major, privacy)

- **Reproduction.** `src/lib/assistant/open-assistant.ts:776-825` sends every body plus the ascendant and midheaven to the arcminute. Over 300 seeded births the time is recovered within ±64 s and the place to about 12 km (median). The consent text and the privacy page say time and place are never attached.
- **State.** It needs the account-v2 "self chart", which is off in production, so it appears unreachable today. That has not been confirmed with a signed-in session.
- **Fix plan.** Send the angles to whole degrees or omit them, and make the copy match. Until then, claim `priv.guide` is overstated.

### F-20 — URLs that carry a recoverable birth (major, owner decision)

- **Reproduction.** The calendar feed is `GET /api/calendar/transits?token=…`. The token gives the birth instant to about 4 s, and the URL reaches platform logs, a 6-hour shared cache and the calendar provider. Preview links carry whole-degree Sun, Moon and rising. Feed URLs made before 23 September still carry the angles to 0.001°.
- **Why it's the owner's.** §10.4 leaves the choice to the owner: coarsen, or move out of URLs. The coarsening recorded on 2026-09-25 was adopted under a general delegation and leaves the instant recoverable.
- **Prepared for the owner.** Two options:
  - (a) Coarsen feed tokens to a stated window, with a decoder test.
  - (b) Replace them with random opaque feed ids stored server-side with an expiry. That makes the feed stateful, so it needs its own privacy text.

  Until then, the privacy page must say what the URL carries (F-27).

### F-21 — token framing on engine and developer surfaces (major)

- **Engine surfaces.** `/sdk/engine/` serves an rc.1 reference that links "Registry" and ends "accurate, private, free". The engine's `package.json` homepage points there. The CHANGELOG mentions the "ownership SDK".
- **Site surfaces.** `/developers/` and `/developers/support/` advertise the ownership SDK and send engine issues to the SDK repository. `llms-full.txt` files the engine under "Astrofolio, Terminal, Registry, and Developer Wing".
- **Fix.** Engine: homepage, TypeDoc footer and links, and CHANGELOG wording in rc.13. Site: a reference home outside `/sdk/` generated from the current release, developer pages without the ownership SDK, and a developer section of its own in the llms files.

### F-22 — committed Swiss output (major, owner decision)

- **Where.** Four fixtures in `src/lib/engine/fixtures/swiss-*.fixture.json` (about 190 KB of positions and cusps), `docs/platform/evidence/precision-2026-09-20/numerics/raw/t1-swiss.json`, and three values in `docs/platform/evidence/deltat-2026-09-25/outputs/swiss-deltat.json`. `swiss-benchmark/LICENSING.md` has listed them as awaiting an owner decision since 23 September.
- **Rule.** v1 NN3 forbids further bulk Swiss output and asks that the licensing record describe what is committed. That record does.
- **Prepared for the owner.** Keep statistics and hashes public, move the raw fixtures to a private store, and replace the tests' use of them with statistics or independent arbiters. A CI guard against new Swiss output is planned either way.

### F-29 — amendments adopted after the results (major, process)

- **What happened.** On 2026-09-25 an agent adopted amendments A1 (rule 1b: 8″ at 66° instead of 5″) and A3 (rule 1g: 1.5″/day instead of 1″/day) under "stop asking me for permissions". Both gates were set after their residuals were seen. The record says so and keeps the original verdicts.
- **Disposition.** Steps 1.3 and 1.8 count as validated, not accepted, until the owner ratifies or rejects A1 and A3. The original gates return with the DE backend (P4.1) in either case.

### F-33 — Koch end to end (major)

- **Reproduction.** `evidence/houses-2026-09-26/`: 3.73″ at 65.6° N in 1 of 353 ladder cases. Given Swiss's inputs it agrees to 4e-10″.
- **Cause.** The engine's and Swiss's sidereal times differ by about 0.1″, and Koch near the polar circle magnifies that.
- **Disposition.** FAIL recorded, and the other eleven rc.9 systems are unaffected. Tightening the input agreement belongs to Phase 4 (full nutation in the angle path is on the brief's deferred list), so the gate stays failed until then.

### F-34 — audit findings without a recorded disposition

These major findings from the 2026-09-22 audit have none:

| finding | where it is tracked now |
| --- | --- |
| alpha-search-partition-1, -2 | P4.5 |
| data-toolchain-packaging-1, -5 | P3.1 and P4.2 |
| production-event-search-8 | P4.4 |
| production-positions-6 | P4.1 |
| swiss-parity-12 | P4.1 |

They are now tracked by the units named, and will get a disposition when those units are worked. The mapping of all 128 audit findings to their recorded dispositions is in [`extracts/audit-dispositions.json`](extracts/audit-dispositions.json).

### F-35, F-36 — the package's time resolution (major)

- **Reproduction.** Run the engine's `resolveBirth` from rc.10 or rc.11 on the step 1.1 and 1.12 cases:

  | case | engine | site | rule |
  | --- | --- | --- | --- |
  | Buffalo 1870 | −4:56:02 | −5:15:31 | −5:15:31 |
  | Brest 1880 | +0:09:21 | −0:17:58 | −0:17:58 |
  | Omaha 1880 | −5:50:36 | −6:23:46 | −6:23:46 |
  | Bergen 1894 | +1:00 | its own mean time | its own mean time |
  | Stockholm 1947-07-01 12:00 | +2:00 | +1:00 | +1:00 |

  The engine also accepts `calendar: 'julian'` and ignores it.
- **Why it matters.** The developer pages point developers to the package. For births before 1970 it and the site give different answers, and the package's are the wrong ones.
- **Fix plan.** Move the site's birthplace clock and its pinned per-zone shards into the engine, which is what "inside the engine" in 1.12 asks. Add the calendar input, record the time basis and the tzdb version in receipts (P1.M3d), and rerun the round-trip and 98-zone checks through the package.

### F-40 — the region figure at high latitude (major, privacy)

- **Reproduction.** Decode the share code of a timed chart at 64.98° N. The recoverable region is about 49 × 49 km. The copy says "only within a region about 500 km across". That figure comes from a 37° S–64° N sample.
- **Fix.** State the figure as a range that depends on latitude, and test it at high latitude. This ships with F-17.

### F-17, F-18, F-19, F-26, F-27, F-40 and F-43–F-45 — disposition, 2026-09-29 (#599)

- **Share codes and calendar feeds.** Every producer rounds a timed chart's UTC instant to the whole minute before encoding. A chart without a birth time is encoded as the sky at 12:00 UTC on its date, which does not depend on the place. `src/lib/share-positions.test.ts` covers births before standard time and in half-hour zones, and shows that every longitude rounding to the same minute gets the same code.
- **Shared images with birth details hidden.** Every image is drawn no more precisely than its link: bodies and aspects at the whole minute, angles at the middle of their whole degree, whole-sign houses. A chart without a birth time is drawn at 12:00 UTC on its date, with the Moon's sign unknown unless it held one sign that whole date in every time zone. The Big Three, placement, reading and aspect cards, the chart sheet, and the solar return, lunar return, composite and compatibility pictures all go through this path.
- **Sign pictures.** A chart's page asks for all twelve pictures of a size before showing its own, so the requests are the same for every chart.
- **Guide.** The ascendant and midheaven are sent to the whole degree. A chart without a birth time is sent as the sky at 12:00 UTC, with the Moon's sign marked as needing a birth time.
- **Copy.** The privacy page, the notes beside the image options and share buttons, the calendar sentence and the Guide consent text say what each carries, in every locale that has them. The privacy page also says what platform logs keep, and gives the size of the area a link narrows the birthplace to, by latitude.
- **Tests that hold the line.** A test follows the module graph and the TypeScript syntax tree to list every call of the exact positions encoder. Aliases, re-exports, `.call`, `.apply`, `.bind` and bracket access are all caught, in `.astro` and `.mdx` files too.
- **Reviews.** The first independent check found two blockers:
  - the chart sheet still carried the seconds;
  - the image paragraph was false for the return and composite cards (F-43–F-45, found while the fixes were made).

  It also found one major, the encoder list could be bypassed. Both blockers and the major are fixed, and a second independent check verified them.
- **What remains.** Codes and feeds made before this change still carry what they carried; the privacy page says so. The feed's opaque ids (F-20, P1.15) are not built yet.

### F-46, F-47, F-48 — found by the review of the birth-time window search (minor, engine)

- **Found.** By the independent review of the birth-time window branch (B2.a), 2026-09-28. The review reproduced the preregistered gate exactly: 1,000 windows, 0 missed, 0 extra.
- **Placidus near the polar limit (F-46).** The Placidus iteration allows 64 steps with a 1e-9° tolerance. Within about 1e-8° of the limit, near the sidereal times at which a cusp's right ascension reaches 90° or 270°, the rounding of `asin` near ±1 moves each step by about that tolerance, and the iteration could give up. The review saw it happen within a few 1e-9° of the limit, and a finer scan on the branch found it up to 9.5e-9° below.
  - Reproduction: latitude 66.56186339751429, t0 = 2000-03-20T00:00Z, RAMC 269.999°. `natalChart` used whole signs at 26 separate milliseconds within ±1.1 s of t0, although Placidus exists there.
  - Effect: the chart said it fell back, so nothing was presented as Placidus that was not. But the fallback was wrong.
  - Fix on the window branch: bisection where the iteration does not settle, with results unchanged wherever it does. A sweep of 14,140 inputs near the limit went from 540 fallbacks to none.
- **ΔT seam (F-47).** At 1941 the spline gives 24.834 s and the table 24.820 s, so TT steps back 13.95 ms at 1940-12-31T18:00Z. The positions jump by the motion in 14 ms, about 0.0002° for the Moon.
  - Fix plan: make ΔT continuous at the seam, in a reviewed engine change with a conformance run.
- **Node jitter (F-48).** The true node comes from astronomy-engine's 1.728 s velocity difference. Its jitter reaches 4.83e-5° (scanned, 1800–2200), so every millisecond near a node ingress has to be evaluated. 24 of the 294 node ingresses in 1800–2200 exceed the search's budget.
  - Fix plan: the search reports those intervals as unresolved instead of failing. A smoother node, from a proper lunar velocity, is planned as its own reviewed change.
