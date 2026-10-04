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
| F-59 | major | privacy | Hosted ephemeris retains exact input time in a module-private warm-process cache | deployed in fd1ce88a; scoped post-release verification complete |
| F-60 | major | rate-limit verification | Aligned general-counter probe returned 41 successes without the expected refusal | open; counted identity/configuration not visible; no live 40-request spending bound established |
| F-62 | major | CI | The authorship guards missed wrapped or capitalised persona names, other spellings of the editor anchor and single-quoted Person markup in `src/`, and the source guard failed open | fixed in the 2026-10-04 audit PR: shared bounded detectors, `scripts/check-source-authorship.mjs`, one recorded People-subject allowance, 210 tests; known limits recorded |
| F-63 | major | licensing | The engine repository description says "MIT-licensed" and `.zenodo.json` says `mit`; the package is MIT AND CC-BY-4.0 | owner action: prepared description wording; the Zenodo licence representation is the owner's decision |
| F-67 | major | adoption | P2.E.returns was accepted while `src/lib/engine/year-scan.ts`, the year ahead on `/profile/`, still found solar returns with the site's own Sun crossing scan | fixed in the 2026-10-04 audit PR: the package's search, parity on 1,000 synthetic windows (max 3 ms), a regression test; P2.E.returns is `validated` until production serves it; in production since #639 (merged as `67aa32d8`, deployment `dpl_Av6FTWYa2iFZzT2WZuWeCsRDg2oV`), and accepted again at checkpoint 14 |
| F-71 | major | process | Checkpoint 14 first accepted the co-ascendants and Koch on a clock reading and, for the co-ascendants, a window chosen after the residuals were seen, and its preregistrations said nothing had been measured | owner decision: both units `validated` until the owner ratifies the shared-UT1 reading and the window; they fail as measured if not |
| F-06 | major | engine rc.11 | Configured-aspect "exact orb" claim fails on general decimal inputs | fix in engine rc.13 (in progress); fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
| F-17 | major | privacy | Share code of a chart without a birth time reveals the birthplace's longitude or zone | open: code fix planned; copy wrong until then; fixed in #599: a chart without a birth time is shared as the sky at 12:00 UTC on its date, and the copy is corrected in six locales; in production since #599 (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`) |
| F-18 | major | privacy | Sign-icon requests reveal Sun, Moon and rising signs to the server; privacy page silent | open: fix planned; fixed in #599: a chart's page asks for all twelve sign pictures of a size before showing its own; in production since #599 (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`) |
| F-19 | major | privacy | Guide chart attachment carries angles to the arcminute; copy says time and place are never attached | open: feature appears off; fix planned; fixed in #599: Guide gets the ascendant and midheaven to the whole degree, and a chart without a birth time as the sky at 12:00 UTC; the consent text and the privacy page say so; in production since #599 (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`) |
| F-20 | major | privacy | §6's "nothing in a URL from which a birth can be recovered" is broken by the calendar feed | owner decision (§10.4); decided 2026-09-28: opaque feed ids (P1.15), not yet built; meanwhile #599 makes feed codes carry a timed birth only to its whole UTC minute |
| F-21 | major | boundary | Token and ownership framing on engine and developer surfaces (R6, R7) | open: engine part in rc.13; site part planned; engine part fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; site part planned; the engine part in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
| F-22 | major | licensing | Swiss Ephemeris output committed in `src/lib/engine/fixtures/` and in evidence folders | owner decision; no new Swiss output; decided 2026-09-28 (§3) and 2026-09-29 (§2); removed in #602: 10 files, per-case values from 133 files, 21 files rebuilt on the engine's clock, and a receipt's `swetest.c` patch; `strip.py --check` runs in CI and `scripts/swiss-output-guard.test.mjs` fails if any comes back; `2ca93d41` is the last commit with every value |
| F-29 | major | process | Rule amendments A1 and A3 were adopted by an agent after the residuals were seen | owner ratification; the affected units count as validated, not accepted |
| F-32 | major | evidence | rc.10's Swiss figures for the points existed only in a PR description; Equal-MC never measured | fixed: `evidence/points-2026-09-26/` published and rerun |
| F-33 | major | engine | Koch fails the end-to-end 3″ gate in one ladder case (3.73″) | FAIL recorded; waits for better sidereal-time agreement; on rc.16 within 3″ only with Swiss given the engine's UT1 (0.035″), so `validated` from checkpoint 14 until the owner rules on that reading (F-71) |
| F-34 | major | records | Seven major audit findings have no recorded disposition | open: triage recorded below |
| F-35 | major | engine | The package's `resolveBirth` lacks steps 1.1 and 1.12: Buffalo 1870 −4:56:02 and Stockholm 1947 +2:00, where the site gives −5:15:31 and +1:00 | open: port into the engine (P1.01b, P1.12b); fixed in engine rc.15 (zodiacs-org/engine#20, merged 2026-09-30 as `93ebae9f`); reaches production when the site adopts it (branch `rc15-adoption`, not yet merged): before 1970 the package reads the tzdb 2025c history with backzone, and with a longitude a zone's local mean time era on the birthplace's own mean time; Buffalo 1870 gives −5:15:31 and Stockholm 1947 +1:00, and on 264,455 wall times the site and the package give the same instants (`evidence/site-engine-rc15/local-time.json`); in production since #603 (merged as `2197e696`, deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`), in the package the site vendors; the site's forms keep their own resolver and the MCP adapter resolves no zones, so P1.01b and P1.12b are validated, not adopted |
| F-36 | major | engine | `resolveBirth` silently ignores `calendar: 'julian'`: Petrograd 1917-10-25 O.S. comes back 13 days off | open: add the input or refuse unknown keys (P1.13b); fixed in engine rc.15 (zodiacs-org/engine#20, merged 2026-09-30 as `93ebae9f`); reaches production when the site adopts it (branch `rc15-adoption`, not yet merged): `calendar: "julian"` converts an Old Style date (Petrograd 1917-10-25 12:00 O.S. is 1917-11-07 N.S.), and unknown keys and options throw `RangeError`; in production since #603 (merged as `2197e696`, deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`), in the package the site vendors (P1.13b accepted); the site's forms keep their own Julian conversion |
| F-40 | major | privacy | The share copy's "region about 500 km across" does not hold at high latitude: 49 × 49 km at 64.98° N | open: correct the figure with the share-code fix; fixed in #599: the privacy page gives the area's size by latitude; in production since #599 (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`) |
| F-43 | major | privacy | The solar return card printed the return instant to the second, which gives the birth instant to about a second: before standard time, strips of longitude about 3 km wide; without a birth time, the zone | fixed in #599: the whole minute, whole-degree angles, whole-sign houses; without a birth time, from 12:00 UTC; in production since #599 (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`) |
| F-44 | major | privacy | The lunar return card was cast at the birthplace unless another place was chosen, and it showed the angles, which put the birthplace within kilometres | fixed in #599: the whole minute, whole-degree angles, whole-sign houses; in production since #599 (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`) |
| F-45 | major | privacy | The composite card printed the Moon midpoint to the arcminute when one person had no birth time; anyone who knows the other chart could recover that person's local noon, and so their zone | fixed in #599: a person without a birth time is drawn at 12:00 UTC without the Moon; in production since #599 (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`) |
| F-61 | minor | CI reliability | A WebKit sharing drive failed once on main: a background share-card decode raced the drive's navigation | preserved; one unchanged retry passed; handoff prepared for the frontend session; no assertion changed |
| F-64 | minor | documentation | A dead `http://LICENSING.md` link in the API reference, which its checker skipped, and discovery files that did not link the rc.16 reference | fixed in the 2026-10-04 audit PR; the checker resolves every link and checks wording |
| F-65 | minor | sky API | Tests did not hold `nextByKind` entries to the first event of their kind; `daysAway`'s tenth-of-a-day rounding was undocumented | fixed in the 2026-10-04 audit PR; no computed value changes |
| F-68 | minor | records | The Moon candidates' parity figure (5,147 cases) mixes the adopted sharing path, section M-A (3,002 of 3,005), with sections for helpers #620 removed | dated ledger note; acceptance unchanged |
| F-69 | minor | records | Checkpoint 12 called the returns removal complete, and two P2.A notes still described the package before rc.16's returns, composite and Davison | dated notes and a correction section; no gate re-judged |
| F-72 | minor | evidence | The house and point tools' random generator repeats: of the given-input sets' 20,000 broad draws, 12,515 (houses) and 12,076 (points) are distinct | disclosed in `houses-2026-10-04`; no verdict changes; earlier records keep their text |
| F-73 | minor | records | The engine's birth-window record names six commits that are in no published history, and the rc.9 houses README understates Koch's out-of-window difference | the site's records cite the published commits and the right figure, and the rc.9 README carries an appended note; an appended note in the engine is open |
| F-01 | minor | provenance | Two different archives both named 0.1.1-rc.11 | fix in rc.13 (artifact list; one version, one byte sequence); fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
| F-02 | minor | provenance | Engine CI never binds an artifact to its source | fix in rc.13 (CI rebuild-and-compare); fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; CI on the merge ran the check; in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
| F-03 | minor | provenance | Site CI does not run `mcp:pack:check` | open: site CI change planned; fixed by the rc.14 adoption (2026-09-29): the Legacy wing drift job runs it; merged in #600 (`6cc4d477`) |
| F-04 | minor | docs | The engine install snippet can install into a parent directory | open: guard in the snippet planned; fixed by the rc.14 adoption (2026-09-29): the snippet stops without a package.json; in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
| F-07 | minor | engine rc.11 | The Sun is flagged out of bounds at about half of all solstices | fix in rc.13; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; the chart's own Sun is exempt by a stated convention; in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
| F-13–F-16 | minor | engine rc.12 | Follow-ups from the PR #8 review (tolerance derivation, RangeError at Date limits, wording, script isolation) | fix in rc.13; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
| F-23 | minor | claims | The claims ledger does not read developer docs (`public/sdk/**`, example READMEs, the engine's README and CHANGELOG) | open |
| F-24 | minor | claims | Accuracy wording without figures in four locales; `acc.qualitative` rests on the Swiss benchmark; the methodology page lacks the Horizons figure | open |
| F-25 | minor | licensing | GeoNames attribution lacks the licence link and a modification note | open |
| F-26 | minor | claims | `/ask/` and `/about/` describe Guide chart attachment as available | open (ties to F-19); fixed in #599: `/ask/` and `/about/` describe the attachment as it is sent; in production since #599 (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`) |
| F-27 | minor | privacy | The privacy page does not say that platform logs keep full request URLs | open (ties to F-20); fixed in #599: the privacy page says platform logs keep each request's full address, and what that address carries; in production since #599 (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`) |
| F-28 | minor | repository | Repository basics missing (R7); site README still leads with the token registry | open (P3.11, G2, G3); basics fixed: the site's README and files in #597, the engine's in zodiacs-org/engine#12 (`b0ddb886`), the SDK's in zodiacs-org/sdk#14 (`a95dc0cf`), all merged by 2026-09-29; the site's topics (G2) and the site's scanning, releases and badges (G3) remain |
| F-37 | minor | wing | `src/islands/WalletChart.tsx:189` passes no longitude and never calls `prepareLocalTime`, so it gets the host's zone history | open |
| F-38 | minor | time | A gap at the end of a local-mean-time era drops the `localMeanTime` field (Buffalo 1883-11-18 11:50), so the notice does not show | open |
| F-39 | minor | copy | `lmtNotice` also fires for legal mean times (Galway 1885, Amsterdam to 1937, Monrovia to 1972), where the birthplace's own mean time was not used | open; fixed by the rc.15 adoption (branch `rc15-adoption`, not yet merged): `lmt` now means that a local mean time read the wall time, so a legal mean time carries no flag and the notice no longer shows (Amsterdam 1930, Galway 1885 and Monrovia 1950 checked); in production since #603 (merged as `2197e696`, deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`) |
| F-41 | minor | tests | The committed round-trip scan covers only the host path, not the pinned tables production uses; `build-transits.test.mjs` runs 110.7 s against a 120 s timeout | timeout: fixed in #596 after it timed out in CI (one test per month; `build-event-horizon.test.mjs`, at 4.0 s of a 5 s default, likewise split); round-trip scan: open |
| F-46 | minor | engine | Placidus cusps failed to converge at isolated instants within about 1e-8° of the polar limit, so `natalChart` fell back to whole signs there (and said so), although Placidus exists there | open: a bisection fallback is on the birth-time window branch, for the next candidate; fixed in engine rc.15 (zodiacs-org/engine#20, merged 2026-09-30 as `93ebae9f`); reaches production when the site adopts it (branch `rc15-adoption`, not yet merged): where the iteration does not settle, the cusp is found by bisection; in production since #603 (merged as `2197e696`, deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`) |
| F-47 | minor | engine | ΔT is discontinuous at its 1941 seam: TT steps back 13.95 ms at 1940-12-31T18:00Z | open; the window search splits at the seam meanwhile |
| F-48 | minor | engine | The true node's finite-difference jitter (up to 4.83e-5°) makes some node ingresses too costly to partition to the millisecond | open: the window search reports them unresolved; a smoother node is planned |
| F-49 | major | licensing | The MCP adapter's archives 0.1.0-rc.8, rc.9 and rc.10 inline the engine's 32 ΔT values of Table S15, which are CC BY 4.0, under an MIT-only label and without a notice | open: 0.1.0-rc.14 carries the licence expression and a NOTICE; the released archives stay as released, and whether to add attribution beside them or stop serving them is for the owner; decided 2026-09-29 under the owner's delegation (DECISIONS-2026-09-29.md §1): the three archives stay as released, and #602 publishes their notice beside them and links it from `/developers/mcp/` |
| F-50 | major | licensing | The site's own chart code carries the engine's ΔT module, and so 32 values of Table S15 (CC BY 4.0), but no page gave the licence or a link to the work: the methodology page named the authors only, and the terms page listed GeoNames and the fonts | fixed in #602: the terms page and the methodology page give the work, its DOI and the licence, and say the values are rounded to 0.01 s |
| F-51 | minor | ci | Site Check's Lighthouse gate takes the worst of three samples per route and fails any sample over 200 ms of blocking time, so one runner stall fails a change that did not cause it: on #600, one `/lunar-return/` sample measured 416 ms and the other two passed | open: the gate is unchanged; a fix must tell a runner stall from the page's own blocking time without widening the budget; fixed in the checkpoint 7 PR (2026-09-30): a sample that misses a timing budget while its trace shows the page's main thread held off the CPU is retaken in a fresh browser, up to three more per route, and a route that cannot collect three valid samples fails; the gate still takes the worst of three valid samples, and the 200 ms budget is unchanged. Over 270 CI samples the rule sets aside exactly the five that failed on blocking time |
| F-52 | minor | time | The generators that call astronomy-engine directly (eclipses, sign-change windows, retrograde windows, the Moon-ingress table) read an instant as UT1 with the ΔT model, while charts and the engine-derived data read 1972 to 2027-10-02 as UTC since rc.15: the site's committed times are on two clocks, up to 0.689 s apart | open: no displayed minute or date moves (`evidence/site-engine-rc15/model-clock.json`); moving them needs the time basis in each generator; in production since #603 (merged as `2197e696`, deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`) |
| F-53 | minor | engine | rc.15 exports no function for its time basis, so the site bundles the package's own compiled one into `src/lib/engine/time-basis.mjs` (`scripts/build-time-basis.mjs`, drift-checked in CI) for the calendar function and its tools; CLAUDE.md's list of generated files does not name it | open: an export in the engine's next candidate; the CLAUDE.md line is for the owner; CLAUDE.md names the generated file since the rc.15 adoption, 2026-09-30; in production since #603 (merged as `2197e696`, deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`) |
| F-54 | minor | engine | The package's declination parallels and sect (`findDeclinationAspects`, `declinationOf`, `sectOf`) are only in the root entry's shared chunk, which imports astronomy-engine, and their conventions differ from the site's | open: P2.E.declinations and P2.E.sect not adopted with rc.15; needs a pure entry point and a decision on the conventions; decided 2026-09-30 (DECISIONS-2026-09-30.md §4): the site keeps its own until the package exports them from an entry point that loads no ephemeris; in production since #603 (merged as `2197e696`, deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`) |
| F-55 | major | licensing | The site's chart bundle and the MCP archive 0.1.0-rc.15 now carry the engine's UT1 − UTC table, part of it derived from IERS EOP 20 C04, for which the engine's LICENSING.md found no statement of terms | owner decision (open in the engine's LICENSING.md); NOTICE and the developer pages name the source; decided 2026-09-30 (DECISIONS-2026-09-30.md §5): the decision of 2026-09-29 §4 covers the site's and the archive's copies; in production since #603 (merged as `2197e696`, deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`) |
| F-66 | info | records | STATUS.md's living sections and four ledger notes described an earlier state | corrected by dated notes in the 2026-10-04 audit PR |
| F-70 | info | adoption | The People pilot's frozen tools compute Moon-sign uncertainty and two aspect patterns themselves; smaller notes from the adoption audit | recorded; the pilot's 501 Moon verdicts equal the package's |
| F-56 | info | evidence | Seven digests of removed Swiss values now equal independent reference values on rc.15's clock (five TT instants of UTC cases and one Horizons lunar crossing) and moved from "gone" to "kept" | recorded in `SWISS-OUTPUT-REMOVAL.md`; `strip.py --check` still holds; for the owner to confirm; confirmed 2026-09-30 under the owner's delegation (DECISIONS-2026-09-30.md §3): the seven values stay; merged in #603 (`2197e696`), in the references and digests only, which production does not serve |
| F-57 | major | claims | The developer pages and the llms files say the engine is not on npm: `/developers/engine/`, `/developers/support/`, `/llms.txt` and `/llms-full.txt` that "npm view @zodiacs/engine returns 404", and `/developers/` and `/developers/support/` that it is an unpublished candidate; npm has had 0.1.1-rc.15 with provenance under `latest` since 2026-09-30 | open: found verifying #603 in production (deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`); the copy, `releaseStatus` and `releaseLabel` in `src/data/platform-engine-candidate.json`, the claims ledger's `product.engine-package`, and the test that requires the status (`scripts/platform-candidate-docs.test.mjs`) change together; fixed in the checkpoint 7 PR: the developer pages, the llms files, `vendor/README.md` and the candidate record say that npm serves 0.1.1-rc.15 under `latest` and `next`, published with SLSA provenance, with the pinned archive as the verified alternative; the claim and the test rest on the registry read of 2026-09-30 (`evidence/site-engine-rc15/npm-registry.json`); the released MCP archive 0.1.0-rc.15 (`get_capabilities`, its README and `candidate.json`) and the engine's own packed README still say otherwise, and change with their next versions |
| F-58 | major | release | Every compute endpoint answered 500 in production after #605: the compute handler could not load the engine, whose named imports from `astronomy-engine` fail on a Node that does not detect module syntax | fixed in the PR that follows #605: `api/_compute/compute.mjs` bundles the handler with the engine (`scripts/build-compute-handler.mjs`), and `tests/api/compute-api-bundle.test.ts` loads it with module syntax detection off, with the unbundled engine failing there as the control |
| F-08 | info | engine | The physical declination rule (≤ 0.01″ vs Swiss FLG_EQUATORIAL) is not met: median 1.71″, max 20.76″ | FAIL recorded on P2.A.aspects.declination-accuracy; waits for P4.1 |
| F-09 | info | engine | astronomy-engine's five-term nutation puts true obliquity up to 0.082″ from ERFA | noted for P4.1 |
| F-10 | info | engine tests | Some rc.11 tests confirm the implementation with itself | rc.13 adds independent oracles; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
| F-11 | info | engine | Label validation differs between the declination and aspect APIs | fix in rc.13; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
| F-12 | info | engine scripts | `verify-packed-consumer.mjs` picks up `@types` from parent directories | fix in rc.13; fixed in engine rc.14 (zodiacs-org/engine#10, merged 2026-09-29 as `8deda244`); reaches production when the site adopts it; in production since #600 (merged as `6cc4d477`, deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`) |
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

### F-03 — the MCP archive's drift gate is not in CI (minor)

- **Reproduction.** `.github/workflows/site-check.yml` at `145d36e3` runs neither `npm run mcp:pack:check` nor `npm run mcp:build:check`. `scripts/mcp-artifact.test.mjs` checks the committed bundle and archive against their manifest, but not that a fresh `npm pack` of `examples/mcp-server` still gives the archive's bytes.
- **Fix.** In the rc.14 adoption (2026-09-29), the Legacy wing drift job, which checks the other generated files, runs `npm run mcp:pack:check`. That script rebuilds `server.mjs` from `src/mcp/` and fails if it differs, packs the example afresh and compares the archive byte for byte, rebuilds the manifest from the package, and requires a 40-hex `artifactCommit`. `npm pack` reads only the example's files, so the job stays offline.
- **Regression test.** The step itself. It passes with the rc.14 archive.
- **Residual risk.** npm's pack output is deterministic for one npm version; a different npm on the CI runner could pack other bytes and fail the step without any change here. The all-zero `artifactCommit` placeholder passes the pattern, so the step does not show that the commit is pinned; the adoption record says when it is.

### F-04 — the engine install snippet and a parent package.json (minor)

- **Reproduction.** Run the block from `/developers/engine/` at `145d36e3` in a new, empty directory whose parent holds a `package.json`. It verifies the archive and then runs `npm install`, which takes the nearest directory above with a `package.json` or `node_modules` as the project: the package lands in the parent's `node_modules` and the parent's manifest, and the block reports success (`../evidence/site-engine-rc14/f04-install-guard.log`, case 1, with the real curl and npm).
- **Fix.** In the rc.14 adoption (2026-09-29), the block stops before downloading anything unless the directory it runs in has a `package.json` file, and says to run it in the project's directory or create one with `npm init -y`. The page says so beside the block.
- **Regression test.** `scripts/engine-install-block.test.mjs`: the real npm's `npm prefix` names the parent from a child without a `package.json` and the child once it has one; in bash, dash and sh, the block downloads nothing, installs nothing and leaves the parent untouched without a `package.json`, and refuses a directory named `package.json`. The same log's cases 2 and 3 run the new block with the real curl and npm: it stops in that layout, and installs into the directory once it has a `package.json`, leaving the parent unchanged.
- **Residual risk.** Inside an npm workspace, a member directory has a `package.json` and npm still installs through the workspace root, as a workspace install should.

### F-49 — the MCP adapter's earlier archives and the ΔT values (major, licensing)

- **Found.** By the independent review of the rc.14 adoption, 2026-09-29, for the rc.14 archive; the scan below extends it to the archives already released.
- **What.** Since engine rc.8 the ΔT module carries 32 values of Table S15 of Stephenson, Morrison and Hohenkerk (2016), published under CC BY 4.0. The MCP adapter's `server.mjs` inlines the engine, so its archives carry them too. A search of every archive under `public/examples/` for the table's opening values finds them in `zodiacs-mcp-server` 0.1.0-rc.8, rc.9 and rc.10 and in the rc.14 candidate, and in no other archive. Each labelled itself `MIT` and carried no notice.
- **Fixed for rc.14.** The archive declares `MIT AND CC-BY-4.0` and carries a NOTICE that ends with the engine's NOTICE unchanged; `scripts/mcp-artifact.test.mjs` checks both.
- **Still open.** The released archives are immutable and pinned by digest, so they are not repacked. `/developers/mcp/` offers only the current archive, but the earlier ones stay reachable at their URLs. Adding attribution beside them, or no longer serving them, is the owner's decision.

### F-49 — disposition, 2026-09-29 (#602)

- **Decision.** Under the owner's delegation of 2026-09-28, recorded in `DECISIONS-2026-09-29.md` §1: the archives `zodiacs-mcp-server` 0.1.0-rc.8, rc.9 and rc.10 stay as released, byte for byte, and a notice is published beside them.
- **Why not repack or withdraw them.** Their digests are published and pinned, and a version names one byte sequence, so they cannot be repacked. Withdrawing them would break every pinned link and reach no copy already downloaded.
- **What changed.** `public/examples/zodiacs-mcp-server-0.1.0-rc.8-to-rc.10-NOTICE.txt` names the three archives by digest. It says their MIT label covers the adapter's code, gives the attribution and licence of the ΔT values each bundles, cites IERS and the US Naval Observatory as the engine's NOTICE does, and asks that it be kept with any copy. `/developers/mcp/` links it.
- **The other archives.** Checked on 2026-09-29, in the archives the site serves. The adapter's 0.1.0-rc.1 to rc.7 bundle engine 0.1.1-rc.6 and rc.7, whose ΔT module predates Table S15: none of their `server.mjs` files contains the table's values or the curve of equation (5.1). The 0.1.0-rc.8, rc.9 and rc.10 archives each contain all 32 values. 0.1.0-rc.14 contains them too, under its own NOTICE.

### F-22 — disposition, 2026-09-30 (#602)

- **Decisions.** `DECISIONS-2026-09-28.md` §3 removes the raw fixtures and raw values and keeps statistics and digests. `DECISIONS-2026-09-29.md` §2 covers code, data and the product. Figures quoted in dated records stay as written.
- **What left.**
  - 10 files;
  - per-case values from 133 files, each of which now says what left it;
  - 21 files rebuilt on the engine's own clock, where Swiss's ΔT could be read back from them;
  - the 148 lines of `swetest.c` in a commit receipt's patch field.

  The tests that read the fixtures hold the engine to NASA JPL Horizons and ERFA references instead. The pages give the two clocks' difference as statistics over 2100–2199, not Swiss's value at a date.
- **Kept on record.** `docs/engine-validation/SWISS-OUTPUT-REMOVAL.md`, with `swiss-output-removal/manifest.json` and the digests of 40,604 removed values. `strip.py --check` rebuilds every stripped file from the commit that last had its values; CI runs it. The guard test fails on a removed file's bytes under any name, a removed value in any data file or in `src/`, Swiss provenance in `src/`, and Swiss source code.
- **Not rewritten.** The history: `2ca93d41` is the last commit with every value.

### F-50 — the site's own attribution for the ΔT values (major, licensing)

- **Found.** While deciding F-49, 2026-09-29. The site's chart code bundles the engine, whose ΔT module carries 32 values of Table S15 of Stephenson, Morrison and Hohenkerk (2016), published under CC BY 4.0. Every chart page serves them. The methodology page named the authors, but no page gave the licence or a link to the work, and the terms page's list of third-party material named only GeoNames and the fonts.
- **Fixed in #602.** The terms page's "Content and intellectual property" paragraph and the methodology page's ΔT paragraph give the work, its DOI and the licence, and say the values are rounded to 0.01 s.
- **Not changed.** The footer's credits stay as they are; adding a line there means regenerating every static page that shares the footer.

### F-51 — Lighthouse blocking time and runner stalls (minor, ci)

- **Found.** On #600, 2026-09-29. Site Check's Lighthouse job audits each route three times and keeps the worst sample; blocking time over 200 ms fails the route. One of three `/lunar-return/` samples measured 416 ms, and the other two passed. The same run's re-run passed that route.
- **Why it matters.** The audit throttles the CPU four times, so a short stall on the shared runner becomes a long task in the trace. Earlier runs failed the gate the same way on other routes; for example, one `/ru/birth-chart/` sample measured 483 ms, and ten local loads of that page held to 9 ms or less. A red run is then not evidence against the change, and a real regression can hide among the stalls.
- **Not changed.** The gate and its 200 ms budget stay as they are. A fix must tell a runner stall from the page's own blocking time, for example by measuring the runner's own stall in the same job, and must not widen the budget.
- **Fixed in the checkpoint 7 PR, 2026-09-30.** Each sample's trace, which Lighthouse already records, now shows whether the runner stalled the load. `tests/visual/runner-stalls.mjs` reads it, and `tests/visual/lighthouse-gate.mjs` decides which samples count. The gate and its 200 ms budget are unchanged.
- **Method.**
  - Chrome records two clocks for every task: its wall time and the CPU time of its thread. Lighthouse simulates the phone from the wall time alone, multiplied by four, so a task the runner held off the CPU becomes a long task.
  - A stall task is a task on the page's renderer main thread, the thread Lighthouse measures, that lasted at least 50 ms and spent less than 25 % of it on the CPU.
  - A sample is set aside only when it misses a budget, every budget it misses is performance, LCP or TBT, and its trace has at least one stall task. A stall cannot change accessibility, SEO, noindex or CLS, so a miss there always counts.
  - A set-aside sample keeps its report and trace as `<route>-stalled-<n>.json` and `<route>-stalled-<n>.trace.json`. The log gives each stall task's wall and CPU time, and the sample is retaken in a fresh browser, up to three extra samples per route. The run ends with a count of the retakes.
  - A sample with a stall that still meets every budget counts. The gate takes the worst of three valid samples, with the same budgets and calibrations. A route that cannot collect three valid samples fails, with the message "runner stalled in N of M samples"; it never passes on fewer.
- **Evidence.** Three Site Check runs, 270 samples.
  - #603, run 36712798339: four routes failed on blocking time. The rule sets aside exactly those four samples: `/horoscopes/` at 2,518 ms, with eight stall tasks; `/thesis/` at 354 ms; `/horoscopes/aries/love/` at 369 ms; and `/ru/aries/` at 204 ms, with one each. 17 more samples had a stall task and met every budget, among them `/thesis/` at 144 ms, so they count.
  - #600, run 36602076607, first attempt: the `/lunar-return/` sample of 416 ms holds two stall tasks, 61.4 ms wall with 2.3 ms CPU and 68.9 ms with 1.1 ms, and is the only sample set aside. Seven passing samples had stall tasks.
  - #600, the same run's second attempt: no sample had a stall task. The homepage's CLS of 0.056, a page fault that `bf2ca59e` fixed, still fails the route.
  - Every task of 50 ms or more on the page's main thread, 38 in all, spent 0.1–16.3 % of its time on the CPU. The page's own work runs on the CPU: the longest task above half CPU in any sample lasted 42.9 ms, at 99.9 %. A control page whose tasks are fixed amounts of JavaScript ran tasks of 124–519 ms at 95.3–99.0 %; its 2.9 s of blocking time shows no stall task, so it counts.
  - In each stall task, one stretch with no trace event covers 83–100 % of the task. In 17 of the 38 it falls inside `ScriptCatchup`, where V8 copies a script's source into the trace, a step whose median is 3 µs. None falls inside the page's script.
  - Locally, with real Chrome and Lighthouse, a helper that paused the page's renderer gave samples of 818–1,800 ms, and each was set aside. With the first sample paused, `/horoscopes/` passed on three valid samples; with every sample paused, it failed with "runner stalled in 4 of 4 samples".
- **Why it cannot hide a real regression.** A set-aside sample is replaced, not dropped, and the route passes only on three valid samples that each meet the unchanged budgets. A regression that is in every load fails its retakes too. A retake that stalls is set aside again, and after three the route fails. The page cannot pass its own work off as a stall, because that work runs on the CPU. The rule looks for stalls only in samples that already fail, and never excuses a miss that a stall cannot cause.
- **What it cannot see.**
  - The trace shows that the thread was not running, not why. A synchronous wait of the page's own, such as a synchronous XMLHttpRequest or creating a WebGL context, would look like a stall. The audited routes make none. The site's client code has no XMLHttpRequest, and `tests/visual/runner-stalls.test.mjs` fails if one appears. The only one in the built bundles, Phoenix's long-poll fallback inside Supabase's client, opens its requests asynchronously, and no audited load fetched that chunk. The one WebGL call, `/thesis/`'s gallery probe, ran for 1.0–2.6 ms in each of the nine `/thesis/` samples.
  - A regression that shows in only some loads would get a retake whenever a load that shows it also stalls, and the retake might not show it. The old gate let such a regression through whenever none of its three samples showed it. Stall tasks were in 29 of the 270 samples.
  - Stalls shorter than 50 ms are not recognised, so several short ones can still fail a route, as before. A local run on a loaded machine showed one: a retake measured 202 ms from tasks of 17–35 ms, none of them a stall task, so it counted and the route failed.
  - A trace without the thread's CPU time, from a platform that lacks the clock, shows no stalls, and the gate then counts every sample, as before.
  - The widget gate, `tests/visual/widget-lighthouse.mjs`, is unchanged. It gates the desktop performance and accessibility scores at an unthrottled CPU and has no blocking-time budget.

### F-52 — two clocks in the committed times (minor, time)

- **Found.** Adopting engine rc.15, 2026-09-30. From 1972 to 2027-10-02 rc.15 reads an instant as UTC, with TT from the IERS leap seconds and UT1 from IERS UT1 − UTC. The site's charts, its transit months, lunations, daily edition and events catalogue come from the engine and moved with it. `scripts/build-eclipses.mjs`, `build-ingresses.mjs`, the retrograde windows of `build-sky.mjs` and the Moon-ingress table's generator call astronomy-engine directly, which reads the instant as UT1 with the ΔT model the site installs.
- **Size.** For the same Terrestrial Time the two clocks give instants up to 0.689 s apart (a sign-change window end); 0.196 s for the Moon's ingresses in 2026–2028. No committed time would change its UTC minute or date, apart from two retrograde periods clamped to the catalogue's start, 2026-01-01T00:00Z, which are range ends, not events (`evidence/site-engine-rc15/model-clock.json`).
- **Fix plan.** Give each generator the engine's time basis, as the calendar function's ephemeris has it (`src/lib/engine/time-basis.mjs`), and regenerate; the Moon-ingress table is protected and needs its own change.

### F-53 — the time basis is not exported (minor, engine)

- **Found.** Adopting engine rc.15. The calendar function computes with astronomy-engine on the server (`src/lib/engine/server-ephemeris.ts`), held to the browser within 1e-12°; the independent references and the angle arbiter evaluate at the engine's own UT1 and TT. rc.15 exports no function that gives them.
- **Workaround.** `scripts/build-time-basis.mjs` bundles the package's own compiled `timeBasis`, `elapsedDays` and `EPHEMERIS_SPAN` from `dist/` into `src/lib/engine/time-basis.mjs`, checks it against `natalChart` at 14,765 instants, and runs with `--check` in CI's drift job. CLAUDE.md's list of generated files does not name it.
- **Fix plan.** An export in the engine's next candidate, after which the generated module goes; until then the CLAUDE.md line is the owner's to add.
- **Recorded.** CLAUDE.md names the generated file since the rc.15 adoption, 2026-09-30.

### F-54 — declinations and sect from the package (minor, engine)

- **Found.** Adopting engine rc.15, which was to take P2.E.declinations and P2.E.sect if they fit cleanly. They do not:
  - `findDeclinationAspects`, `declinationOf` and `sectOf` are exported only from the root entry, whose shared chunk imports astronomy-engine. The site's chart view (`EclipticView`) computes parallels and sect in the page's own bundle; importing them there would either put astronomy-engine in a chunk only `src/lib/engine/full.ts` may load (`scripts/report-bundles.mjs`) or pull the root entry into the engine chunk.
  - The conventions differ. The package's `sectOf` judges day or night by the Sun's ecliptic arc from the descendant to the ascendant; the site's by the Sun's altitude at the frame shown, with Mercury's orientality and the planets in and out of sect. The site takes a body's declination with the mean obliquity of date, or a fixed obliquity where there is no instant.
- **Fix plan.** A pure entry point (like `/internal/math`) for the two in a later candidate, and a decision on which convention the site shows.

### F-55 — IERS C04 in the site's bundle and the MCP archive (major, licensing)

- **Found.** Adopting engine rc.15. The engine's LICENSING.md leaves three questions open for the owner; the first is that no statement of terms was found for IERS EOP 20 C04, from which the package derives its UT1 − UTC table for 1972. The site's chart code inlines that table (every chart page serves it), and so does the MCP adapter's `server.mjs`, packed as 0.1.0-rc.15.
- **What is done.** The MCP archive's NOTICE ends with the engine's NOTICE unchanged, which names the IERS products; `/developers/mcp/`, `/developers/engine/`, `/developers/support/`, `LICENSE` and `README.md` say that the package carries the leap-second list and a UT1 − UTC table derived from IERS series, and point to NOTICE and LICENSING.md.
- **Decision needed.** Whether the C04-derived values may be served and redistributed on the terms found so far, as the engine's own release awaits.

### F-56 — Swiss digests that the rebuilt references now equal (info, evidence)

- **Found.** Rebuilding the independent references on rc.15's clock, 2026-09-30. rc.15 computes TT from UTC as Swiss's `swe_utc_to_jd` does, so five TT instants of UTC cases in `independent-node-polar.json` now equal values the removed node and polar fixture carried, and one Horizons lunar crossing carried to UTC falls on the millisecond Swiss's return did. The guard matched them by value.
- **Disposition.** Their seven digests moved from "gone" to "kept" in `value-digests.json`, with the reason in `SWISS-OUTPUT-REMOVAL.md` ("The independent references on engine rc.15's clock"); `strip.py --check` confirms the lists still hold exactly the digests of what was removed. None of the values came from Swiss. Recorded for the owner to confirm, since the decision of 2026-09-29 governs what may stay.

### F-57 — the engine is on npm, and the site says it is not (major, claims)

- **Found.** Verifying #603 in production, 2026-09-30 (`evidence/site-engine-rc15/README.md`, "In production"). npm has had `@zodiacs/engine` 0.1.1-rc.15 with provenance since the owner's steps of that morning, under `latest` and `next` (P3.1a). Production says it has not:
  - `/developers/engine/`: "@zodiacs/engine is not on npm yet — npm view @zodiacs/engine returns 404, and the support page says why."
  - `/developers/support/`: "Local engine · unpublished candidate", and "It is not on npm yet: npm view @zodiacs/engine returns 404", followed by the two things said to be outstanding, one of them the operator authority to publish.
  - `/developers/`: "Unpublished candidate · engine 0.1.1-rc.15".
  - `/llms.txt`: "an unpublished release candidate distributed as a digest-pinned archive, `npm view @zodiacs/engine` returns 404".
  - `/llms-full.txt`: "It is an unpublished candidate, not an npm release: `npm view @zodiacs/engine` returns 404."
- **Cause.** The copy was written before the publication. #603 recorded the publication in the programme's records but left the pages, the llms files and `src/data/platform-engine-candidate.json` (`releaseStatus: "unpublished-candidate"`, `releaseLabel: "Unpublished candidate"`) as they were. The checks hold the old state in place: `scripts/platform-candidate-docs.test.mjs` ("keeps the public distribution explicitly unpublished") requires that status, and the claims ledger's `product.engine-package` ("… is an unpublished, digest-pinned candidate (npm view returns 404) …"), to which the llms sentences are bound, is marked supported on a registry read of 2026-09-23 and on that test.
- **Fix plan.** A published status for 0.1.1-rc.15 in the candidate record, with the test changed to require it; the claim restated on a new registry read; the pages and the llms files saying what the registry shows, with the verified archive kept as a second route. The MCP adapter is not on npm, and its label stays.
- **Fixed** in the checkpoint 7 PR, 2026-09-30.
  - `docs/platform/evidence/site-engine-rc15/tools/npm-registry-read.mjs` read the registry and wrote `npm-registry.json`: `latest` and `next` are 0.1.1-rc.15; npm's tarball has the vendored archive's SHA-1 and SHA-512; the SLSA provenance names `zodiacs-org/engine`, `.github/workflows/release.yml` on `main` and commit `d5326a88` for that tarball; and `npm audit signatures` verified the registry signatures and the attestation.
  - `/developers/engine/`, `/developers/support/`, `llms.txt` and `llms-full.txt` say that `npm install @zodiacs/engine` installs 0.1.1-rc.15, the version under `latest` and `next`; that it was published from `release.yml` with SLSA provenance, which names the source repository, the workflow and the commit and does not show that the results are correct; and that the pinned archive, checked against its SHA-256, installs the same bytes. `/developers/` labels the engine "On npm", `/developers/mcp/` no longer calls it unpublished, and `vendor/README.md` records the release.
  - `src/data/platform-engine-candidate.json` records `releaseStatus: "published"` and `releaseLabel: "On npm"`; `scripts/platform-engine-candidate.mjs` accepts only those, and `scripts/platform-candidate-docs.test.mjs` requires them and the registry read. The claims ledger's `product.engine-package` is restated on that read, with the evidence file pinned by SHA-256 and its dist-tags bound.
  - Not changed: the MCP adapter 0.1.0-rc.15 reports the engine as `unpublished-candidate` in `get_capabilities`, and its packed README and `candidate.json` say the engine is not on npm. They are inside an archive whose digest is published, so they change with the adapter's next version. The engine's README in 0.1.1-rc.15, on npm too, says a lookup returned 404 on 2026-09-26; that changes with the engine's next candidate.

### F-58 — the compute API's first deploy could not load the engine (major, release)

- **Found.** Verifying #605 in production, 2026-09-30 at 18:16 UTC (deployment `dpl_7dy6sHBVkeKAHdMPvjMfPP1VhSWm`). Every compute endpoint answered 500, "A server error has occurred". The runtime log gave `SyntaxError: The requested module 'astronomy-engine' does not provide an export named 'Body'`, from `node_modules/@zodiacs/engine/dist/chunk-ZZPITHQS.js`, imported through `api/compatibility.ts` line 51. The function's other routes (chart previews, the Games, Registry news, invites) do not load the compute handler, and were not affected.
- **Cause.** `@zodiacs/engine` imports named values from `astronomy-engine`. That package's `import` condition points at `esm/astronomy.js`, in a package with no `"type": "module"`.
  - A Node that detects module syntax loads that file as ESM. Node 22.7 and later do by default, including this machine's 22.22.2 and CI's 22.23.2.
  - The function's runtime, `nodejs22.x`, read it as CommonJS. It found no named exports, and failed before any request code ran.
  - The calendar function met the same problem earlier, and avoids it with `createRequire` (`src/lib/engine/server-ephemeris.ts`).
  - The branch's tests run the handler under Vitest, which resolves modules itself. The cold start measured through `vercel build` on 2026-09-29 ran on this machine's Node. Nothing ran the packaged function on a Node that does not detect module syntax.
- **Reproduced.** A functions-only `vercel build` (CLI 62.0.0) of `421fca3d`. Importing the packaged `api/_compute/handler.js` succeeds on Node 22.22.2. With `--no-experimental-detect-module` it fails: "Named export 'Body' not found. The requested module 'astronomy-engine' is a CommonJS module".
- **Fix.** `scripts/build-compute-handler.mjs` bundles `src/lib/compute-api/handler.ts`, with the engine and astronomy-engine's ESM build, into `api/_compute/compute.mjs` (242,117 bytes). At run time the bundle loads only Node's own modules and `@vercel/firewall`, and `api/_compute/handler.ts` takes the handler from it. Checked on a new `vercel build`, with detection off in every process:
  - the packaged function loads;
  - the six documented examples answer 200 through `api/compatibility.js` (the evidence's `tools/cold-start.mjs`, ten runs each).
- **Regression test.** `tests/api/compute-api-bundle.test.ts` checks that:
  - the bundle rebuilds byte for byte;
  - it loads nothing else at run time;
  - it loads with module syntax detection off, while importing `@zodiacs/engine` there fails (the control);
  - it answers every documented example as the source handler does.
- **Remaining risk.** A function that imports `@zodiacs/engine`'s root or `astronomy-engine` by name is exposed the same way. No file under `api/` does so now, and the calendar's server path loads astronomy-engine through `createRequire`. Before merging a change to what a function imports, run the packaged function on a Node without module syntax detection (HANDOFF-2026-09-30.md §8).


### F-58 — production verification, 2026-10-01

The fix is verified deployed at `9cfafa3e` / `dpl_6uGzGxdgxboMZ5jeFwQMTL24demr`: all six endpoints returned 200 for twenty documented synthetic requests each. See `evidence/compute-api-2026-09-29/production-2026-10-01/`. This closes the import failure, not the separate latency/cost or private-cache gates.

### F-59 — the hosted ephemeris retains an exact request timestamp (major, privacy)

- **Found.** A fresh-context source audit of site `9cfafa3e` recovered two synthetic input UTC timestamps with zero millisecond error from astronomy-engine's module-private `cache_e_tilt.tt`, after the handler returned and after an unrelated local-time request. The local-only probe reads committed bundles at that revision; see `evidence/compute-api-2026-09-29/tools/probe-module-retention-20261001.mjs` and the baseline's `module-retention.json`.
- **Scope.** Application-process memory retention, not an observed external disclosure. The prior global-name test did not inspect private module state. The probe did not measure all possible network/disk/log channels.
- **Fix.** The server-only compute bundle clears the exact-time and epoch-selected Pluto memos in a `finally`. Each production request gets an isolated timezone resolver and disposes its selected-zone maps. Generated code comes from the build scripts; released engine archives and browser calculators remain unchanged.
- **Regression.** `tests/api/compute-api-private-state.test.ts` exposes actual generated-module state in a local test, reconstructs the timestamp with cleanup bypassed as its positive control, then checks all six endpoints, refusals, resolver and writer failures and interleaved historical requests. Dependency byte pins require a fresh cache audit on upgrades. This is not a promise of cryptographic heap erasure.
- **Disposition, 2026-10-01 20:58 UTC.** The reviewed server-only fix was merged as fd1ce88a and is served by READY production deployment dpl_AsJc5MrDgH4PpgoZSGMe7XTZePe4. All120 post-release synthetic requests joined to this deployment and succeeded; their exported application-message fields are empty. This verifies release and bounded live behavior, not runtime heap inspection or comprehensive absence of sensitive data. The local private-state regression remains the direct cache-cleanup proof. P3.3 stays unaccepted because Cold measurements and F60 remain open. See `../evidence/compute-api-postrelease-2026-10-01/README.md`.

### F-60 — the expected general compute rate-limit refusal is not observed (major, verification)

- **Found.** A bounded live probe of the deployed baseline, after more than 65 seconds idle and scheduled away from a minute boundary, received 41 HTTP 200 responses from the minimal `/api/v1/time` shape within one server minute. The expected 41st-request 429 under the stated 40/60-second rule was absent. Events separately gave ten 200s then 429 with `Retry-After: 60`.
- **Evidence.** `evidence/compute-api-2026-09-29/production-2026-10-01/rate-aligned-requests.jsonl`, its plan, prior preserved inconclusive probes, and the README.
- **Limits.** The response metadata does not reveal the Firewall's counted client address or active rule configuration. This fails the requested verification; it does not establish the actual threshold, a specific configuration error, or unbounded access. No higher-volume probing followed.
- **Disposition.** Open: reconcile the live counted identity/rule and repeat a bounded check with verifiable identity before relying on the 40/10 production cost envelope. No Firewall/security settings were changed. P3.3 remains unaccepted.

- **Read-only follow-up, checkpoint 11.** The active dashboard rule matches the stated SDK ID, fixed-window 40/60-second/IP/429 configuration. Exact request-ID joins place all 41 API successes inside 5.938 seconds. A CDN aggregate shows one source IP; the corresponding SDK path has 41 HTTP 204/allow responses in iad1 and the same deployment. This weakens simple client-IP rotation, missing SDK calls and observed CDN-region splitting, without revealing the effective derived key, counter or bucket boundary. An isolated offline replay confirms that the production-source guard awaits the installed SDK and fails closed, with stable synthetic keys; it does not identify a live provider defect. The rule-filtered view's No Data and SDK rows' unset WAF-rule attribution are not numeric zero counters. No extra probe or security setting change was made. See `evidence/compute-api-2026-10-01/observability/f60-cdn-identity-supplement.md`.

### F-54 addition — rc.16 composite needs a lightweight entry (2026-10-01)

The local rc.16 composite port uses the package's single techniques entry.
That makes the saved-chart RelationshipWheel acquire the shared ephemeris
(52,000 → 96,188 gzip bytes in its static closure) and puts production-flags
`/compatibility/` 51 bytes above its unchanged 36,864-byte route allowance.
Initial-route ephemeris isolation remains intact, but the saved-chart view's
existing no-ephemeris path does not. The bounded import audit found no safe
trim preserving that published entry and lazy boundary.

Under `DECISIONS-2026-10-01-rc16-composite.md`, only the composite adapter is
restored to current main. Its prior package parity evidence is preserved;
adoption waits for a lightweight published composite entry. No route allowance
or immutable archive changes, and P2.E.composite remains unaccepted in the
fixed denominator. This is local preparation, not a released change.


### F-52 rc.16 local preparation update (2026-10-01)

Only the product station/shadow catalogue now shares the monthly generator's
engine longitude and UTC/IERS time basis, as recorded in
`DECISIONS-2026-10-01-rc16-stations.md`. The ±0.25-day derivative and existing
physical definition are unchanged; all 90 stations agree within 1,237 ms
under the unchanged 2,000 ms gate. Independent Swiss statistics still show
up to 419.451 s, so this does not accept a general accuracy claim.

Other direct-astronomy generators remain unchanged. The fresh clock-only
margin check (`evidence/site-engine-rc16/model-clock.json`) records maxima
0.186 s for eclipse peaks, 0.689 s for ingress-window ends and 0.196 s for
Aura Moon ingress times, with no minute/date moves. It does not measure
full-nutation root displacement or authorize changes to protected tables.

### F-53 rc.16 local preparation update (2026-10-01)

rc.16 still lacks public time-basis, frame-of-date and nutation exports. The
site's drift-checked generated module now carries the package's own frame
and full nutation as well as its clock, so the server calendar and independent
reference instruments can use the same defined inputs. The generator verifies
14,765 instants / 177,180 longitudes. A supported package export remains the
remedy; no immutable archive is patched. Separately, the compute-only bundle
clears the new request-bearing frame memo in its server lifetime boundary;
see the rc.16 private-state audit. This is local preparation, not deployment.

### F-54 rc.16 dignities qualification (2026-10-01)

Dignities also remain unadopted. The existing WIP experiment measures the
techniques entry pulling ephemeris into eager code and its pure dignity
portion exceeding the site's prior headroom. The bounded final integration
therefore retains the site implementation rather than relaxing a route or
lazy-load gate. Declinations and sect still need an ephemeris-free entry and
resolution of their recorded convention differences. Composite is additionally
deferred above. Only returns, void-of-course, aspect-patterns and Moon-sign
candidates have locally integrated package adapters; none is accepted here.

### F-61 — a WebKit sharing drive failed once on main (minor, CI reliability; frontend-owned)

- **Found.** On 2026-10-04 the post-merge Site Check of `9d7dd31d` (#637, documentation only) failed in "Build with production's feature flags": WebKit at 1280 px, after the compatibility-invitation journey, logged `Cannot load blob:… due to access control checks` from the built `share-card-brand` chunk, and `tests/sharing-phase2-drive.mjs:147` (`assert.deepEqual(errors, [])`) failed. The 18 other jobs passed, as had the same commit's pre-merge run.
- **Preserved.** Run 37198913984 attempt 1, job 111426380320, artifact 11301863009 (SHA-256 `44e512b1…1721`, equal to the digest the upload step printed). [The record](../evidence/programme-audit-2026-10-04/postmerge-ci-37198913984.json) quotes the log lines.
- **Retry.** One unchanged re-run of the failed job, issued once the run had finished and after confirming none had been made: attempt 2 passed on the same commit.
- **Cause, as far as the evidence goes.** Column 838 of that chunk is the `createImageBitmap(blob)` call in `loadShareBrandIcon` (`src/lib/share-card-brand.ts`). After the comparison appears, `SendBackExperience` prepares share cards in the background; the drive navigates away right after its screenshot. WebKit refuses a blob read still in flight in the departing document and logs it as a console error, which Playwright's WebKit driver reports as a page error. The page code catches the failure and does not throw. Not reproduced here: this environment has no WebKit.
- **Disposition.** The drive and the share-card code belong to the sharing feature (#630, #631), not to this programme. A precise handoff was prepared for the frontend session: load the brand icon without a blob round trip, or stop background card work on `pagehide`, and keep the assertion. No assertion, test or frontend file was changed here.

### F-62 — the authorship guards had realistic gaps (major, CI; fixed here)

- **Found** by the 2026-10-04 audit of S6 ([record](../evidence/programme-audit-2026-10-04/README.md)).
  - The served-documentation scanner matched the persona only with one plain space. The generated reference keeps the engine's comment line breaks between words (`functions/calc.calc.html` among many pages), and `public/sdk/index.html` is hand-wrapped, so `Rowan` and `Vale` on two lines passed, as did `&nbsp;`, a double space and capitals.
  - `/about#editor`, `/about/index.html#editor` and `/about/?…#editor` passed; `/about` redirects to `/about/` with its fragment.
  - The source guard, `! grep … '"@type"[[:space:]]*:[[:space:]]*"Person"' src`, matched double-quoted keys only; `src/` writes `'@type'`. The brief's "CI already blocks … any schema.org Person markup in src/" was therefore not true: the People pilot's page template carries one. `! grep` also passed when grep itself errored.
  - File types were matched case-sensitively and `.jsonld`, `.yaml`, `.svg`, `.js` and extensionless files were never read; `/widgets/`, `/examples/` and `assets/README.md` were not scanned.
- **Fix.** The detectors in `scripts/check-developer-authorship.mjs` are pattern scanners for accidental reintroduction, not HTML, JSON-LD or JavaScript parsers. A repeat that could otherwise run on without a match is bounded (the persona's gaps, the about page's query, a type array) or stops at a delimiter (a bracket, a quote, the end of a line), so repeated starts do not make a scan quadratic.
  - **Persona.** The name in any case: its words apart by up to sixteen gaps a page renders as one (white space, a non-breaking, zero-width or soft-hyphen character, an HTML entity, a JSON or JavaScript escape, an inline tag); joined by nothing, a hyphen, an underscore or a dot, as a slug, a file name, an address or a handle writes it; or inverted, "Vale, Rowan", as a citation writes it.
  - **Editor anchor.** The about path with or without a trailing slash, `index.html`, `./` segments or JSON-escaped slashes, a query of up to 512 characters, `#` written as itself or as an entity, and a fragment that decodes to `editor` (percent-encoding included). `#editorial` stays allowed.
  - **Person markup.** JSON-LD types under a quoted, bare, escaped (`"\u0040type"`) or computed (`['@type']`) key, as a string or as an array of up to 4,096 characters that holds no other bracket, with JSON and JavaScript escapes in the value; microdata `itemtype` and RDFa `typeof`, quoted either way or bare.
  - **Files.** The served-documentation scanner reads every regular file in its five trees and three root documents, whatever the extension, and skips only files with a NUL byte in their first 8 KiB. A symlink or a special file anywhere in its scope is an error. It requires `widgets/index.html` and `examples/mcp-server.json`.
  - **Source guard.** `scripts/check-source-authorship.mjs` replaces the grep with the same detectors over every text file under `src/`, fails closed on symlinks, special files and unreadable directories, and is pinned in the workflow by its test (uncommented, not `continue-on-error`).
- **One recorded allowance.** The People pilot's template describes its subject, a person who has died, as a schema.org `Person` that the page is `about`. That is the page's subject, not an author or editor; the guard allows exactly one such type in `src/pages/people/[slug].astro` and none anywhere else. The owner may withdraw it.
- **Regression.** 210 tests across the two guards: every bypass above and the forms the two pre-publication reviews added, 40,000 repeated starts of each pattern in under two seconds (the earlier patterns took about eleven on an unclosed type array or about-page query), binary, special-file and symlink cases, and the workflow pins. Each of these mutations fails at least one test: reverting either quadratic fix (the query's 512-character bound, the array's no-bracket class), dropping RDFa `typeof`, the entity `#`, percent-decoding, the tag gap, the joined or the inverted persona, and restoring an extension allowlist. The built site scans 702 text files (676 with the previous trees and extension list) and skips 16 binary ones; `src/` 2,102 files.
- **Known limits.** Not caught: a name split inside a word or by a tag that spans lines, its words reversed without a comma, letters written as entities or escapes, an editor fragment encoded in ways other than percent-encoding or an entity `#`, a type supplied through a variable or concatenation, and anything a script assembles at run time. The guards stop the retired signals from coming back by accident; they are not an adversarial filter.

### F-63 — the engine's repository description and Zenodo metadata say MIT alone (major, licensing; owner action)

- **Found.** `gh api repos/zodiacs-org/engine` returns the description "MIT-licensed astrology calculation engine: …", and the engine's `.zenodo.json` has `"license": "mit"`, the licence of the DOI record for v0.1.1-rc.15. The package as distributed is `MIT AND CC-BY-4.0`: its `package.json`, `LICENSING.md`, `NOTICE`, `CITATION.cff`, the API reference and every site page say so. GitHub's sidebar reads the MIT `LICENSE` file; that is GitHub's detection, not a statement by the project.
- **Why it matters.** The owner's rule is never to label the package MIT alone. G1 asked for the repository's description to be set; it is set, and it says this. The brief's suggested description predates the CC BY ΔT values (rc.8).
- **Not changed here.** Repository settings and a DOI record's metadata are the owner's. Prepared wording: "Astrology calculation engine (MIT code; its ΔT data are CC BY 4.0): positions, houses, points and timing techniques, with receipts and a public conformance suite." For Zenodo, which takes one licence in `.zenodo.json`, the owner chooses how to state both (for example the licence the code carries, with the data licence in the record's notes) before the next release mints a DOI; the published record's metadata can be edited without new files.

### F-64 — a dead link and stale pointers around the API reference (minor, documentation; fixed here)

- **Found.** The reference overview linked `http://LICENSING.md`: the Markdown renderer turned the bare file name in `scripts/engine-reference/README.md` into a link to a host on the `.md` domain, and the checker skipped every absolute link. `llms.txt` linked no API reference, and `llms-full.txt` and `/developers/support/` linked only the archived rc.1 one.
- **Fix.** The file name is code, not a link (only `index.html` changes; the drift check passes).
  - **Links.** `scripts/check-engine-reference.mjs` resolves every `href`, `src` and `srcset` value against its page, quoted either way or bare. A link to zodiacs.org, relative or absolute, must reach a file in the build, and its fragment an anchor. Any other link must be HTTPS to `github.com`, `raw.githubusercontent.com` or `developer.mozilla.org`, so protocol-relative, padded, `http:` and `javascript:` links fail. A link to the historical token SDK, on zodiacs.org or any other host, fails too, and a malformed percent-escape is reported as such.
  - **Wording.** It rejects token, market and ownership words in the pages and the release notices: NFT, cryptocurrency, crypto beside a market noun (assets, coins, exchanges, markets, tokens, wallets), blockchain, wallet, Astrofolio, Solana, Ethereum, minted, minting, airdrop, on-chain and web3. A bare "token" or "crypto" is allowed, because an API reference can mean a cancellation or format token, or the Web Crypto API that checks a digest.
  - **Tests.** 40 tests cover each link form, absolute zodiacs.org links that miss, a historical-SDK link however written, a malformed escape, both senses of "crypto", and the notices.
  - **Discovery.** `llms.txt` now links the rc.16 reference; `llms-full.txt` and the support page link it beside the archived rc.1 one. The support page names the version from the candidate record, which the reference build refuses to differ from its own pin.

### F-65 — the sky API's tests and schema left two contracts open (minor; fixed here)

- **Found.** `upcoming.json`'s test checked that `nextByKind.nextNewMoon` is a new Moon but not that `nextFullMoon`, the eclipses, the ingress and the station are of their own kind: pointing `nextFullMoon` at a new Moon passed every test. The schemas declared `daysAway` a bare number, though it is rounded to the nearest tenth of a day, so 0 means less than 72 minutes ahead; the test that read 0 as "not ahead" failed CI on 2026-10-04 (run 37163965698).
- **Fix.**
  - **First events.** The test holds every `nextByKind` entry to its kind and to the first such event after the snapshot across all the data, not only the 60-day window. It checks a build whose window spans the data, and checks the eclipses against their source records too. Pointing the full Moon, an eclipse or the station at another event now fails it.
  - **Rounding.** `daysAway` states the rounding in its description wherever a schema declares it (today, upcoming, and the moon-phase records, which never carry it) and in the OpenAPI document. A test holds every declaration to it.
  - No computed value changes.

### F-66 — programme records that described an earlier state (info; corrected here)

`STATUS.md`'s owner steps, identities and "In progress and next" still described 2026-09-30. P3.3's ledger notes said the F-59 fix was not deployed after it shipped, P3.1c's omitted the JSR attempt, P3.4's called the compute API unmerged and P3.6's named the rc.15 adapter. Each is corrected by a dated note beside the original text, and no status, weight or gate changes.

### F-67 — returns was accepted while the year ahead still searched solar returns itself (major, adoption; fixed here)

- **Found** by the 2026-10-04 audit of the rc.16 adoption ([record](../evidence/programme-audit-2026-10-04/README.md)). P2.E.returns' gate requires the site's "own implementation is removed". #620 replaced the solar-return search in `src/lib/engine/solar-return.ts` with the package's, but `src/lib/engine/year-scan.ts` kept the same construction, `findLongitudeCrossings('Sun', natal Sun, window, 1)`, for the solar return in the year ahead on `/profile/`, in all six locales. Production served it: its `year-scan` chunk never loads the package's techniques. Neither the parity record, nor #620, nor checkpoint 12 named this path, so the acceptance counted a clause that was not met, and delivery was overstated by 0.5 of 182.45.
- **Effect on users.** None measurable: both searches run the same shared solver, and the year ahead shows the return to the minute.
- **Fix.** `year-scan.ts` asks the package's `mostRecentSolarReturnInstant` for the latest return at or before the window's end and steps back a day past each one it finds, keeping the window `(from, to]` and the reference span as before. On 1,000 seeded synthetic windows every window has the same returns as the replaced scan; 999 of 1,002 are identical to the millisecond and the other three 1 to 3 ms apart, within the solver's bisection resolution of about 5 ms ([year-scan-parity.json](../evidence/programme-audit-2026-10-04/year-scan-parity.json)).
- **Regression.** `src/lib/engine/year-scan-returns.test.ts`: the scan must ask the package and must not scan the Sun itself (it fails with the old line restored); parity on 48 seeded windows; both ends of the window; a window holding two returns; and the end of the reference span.
- **Disposition.** P2.E.returns returns to `validated`, release `merged`: 47 of 182.45 (25.760%). It is accepted again only once production serves this change. The other three adoptions keep their acceptance: no production path in `src/` runs a site implementation of void-of-course, aspect patterns or Moon-sign candidates. When the year ahead loads, it now also loads the package's techniques chunk (about 9.7 KB gzipped), which other tools already share; it stays lazy, and `/profile/` has no size budget.

### F-68 — the Moon candidates' parity figure mixes in removed helpers (minor, records)

- **Found.** The ledger quotes 5,147 cases, 5,134 agreeing and 13 differing for P2.E.moon-sign-candidates. Only section M-A, 3,005 cases with 3,002 agreeing, compares the path #620 adopted, the share card's `untimedMoonSign`; its three differences are dates in years 0 to 99, which the site's own date guard refuses. Sections M-Z and M-P (2,142 cases, 10 differences) compare `moonCandidatesFromEndpoints` and `localDateEndpointsUtc`, which #620 removed, with the package's time-zone mode, which production does not call.
- **Disposition.** The gate's "parity recorded" holds for the adopted path. A dated ledger note states the M-A figure; acceptance unchanged.

### F-69 — records that described the rc.16 adoption too broadly, or the package before it (minor, records)

- **Found.** Checkpoint 12's STATUS entry ("Package imports/removals … meet these adoption gates") and its acceptance README ("Current source retains the package imports and removals") were not true for returns (F-67). P2.A.timing.returns' note still said the package has only Saturn returns, and P2.A.composite-davison's that composite exists only in the site and Davison nowhere, though rc.16 exports solar, lunar and planetary returns, `compositeChart` and `davisonChart`.
- **Disposition.** Dated ledger notes, a correction section at the end of the checkpoint 12 README, and checkpoint 13's STATUS entry. No gate is re-judged.

### F-70 — notes from the adoption audit (info)

- The People pilot's frozen tools compute two adopted techniques themselves: `docs/phase5/people-pilot/tools/compute-astro.mjs` samples the Moon's sign at both ends of the civil day, and `compose-copy.mjs` finds grand trines and T-squares among aspects that hold for the whole civil day. Both are outside the brief's `src/lib` scope, and the released copy is frozen. Their Moon signs, verdicts and day bounds equal the package's `moonSignCandidates` on all 501 pages ([people-moon-parity.json](../evidence/programme-audit-2026-10-04/people-moon-parity.json), from `tools/people-moon-parity.mjs`). The pattern statements, built only from day-stable aspects, hold whatever the birth time, although the chart panel leaves the Moon out of patterns when the time is unknown. Moving both to the package belongs to the pilot's next unfreezing.
- For the same window the package's `voidOfCourseAt` ends 1 ms before `voidOfCourseWindows` does (22:54:12.357Z against .358Z on 4 October); the page shows minutes. An engine note.
- The void-of-course page's "about 5 seconds" for the Moon's ingress was measured on rc.8; rc.16's Swiss comparison does not cover Moon ingresses.
- `stableBodySignSlug` and `bodySignIsAmbiguous` in `src/lib/chart-date-certainty.ts` have no caller outside their tests.

### F-67 — production verification, 2026-10-04

Production `dpl_Av6FTWYa2iFZzT2WZuWeCsRDg2oV` (ready 2026-10-04T17:54:58Z,
aliased to zodiacs.org) serves #639, merged as `67aa32d8`. On `/profile/` the
year ahead loads `year-scan.BK5ZoljG.js` (SHA-256 `39dda0a9…a43b`), which
imports the package's `techniques.AoBtvjde.js` (`1e15aec5…f4f8`); both equal a
local build of the merged tree byte for byte. P2.E.returns is accepted again
at checkpoint 14, with the full digests in its ledger evidence.

### F-71 — two checkpoint 14 verdicts rest on choices made after the residuals were seen (major, process)

- **Found** by the two independent reviews of checkpoint 14's records, before they were merged.
- **The clock reading.** Since rc.15 the engine reads a UTC instant through the IERS tables' UT1 − UTC. Swiss's `swe_houses_ex` reads the Julian day it is given as UT1, and the rc.9 houses tool gave it the UTC instant's. On 2026-10-01 the rc.16 accuracy refresh ([record](../evidence/site-engine-rc16/accuracy-refresh/README.md)) measured the house systems on rc.16 both ways. With Swiss reading the UTC instant as UT1, every original system but whole sign exceeds 3″ on the 1850–2049 ladder, in 33 to 51 cases each, Koch in 48 of 353 (82.677″). With both programs given the same UT1, all are within 3″. The site's rc.16 record kept Koch failed: "an aligned-clock pass does not substitute for the original failed comparison". Checkpoint 14's two preregistrations then gave Swiss the engine's UT1 Julian day without citing that record, and the houses preregistration said no measurement on rc.16 had been run.
- **The window.** A scratch comparison made earlier the same day, while rc.16's gates were judged, had found the co-ascendants' RAMC within 0.00091″ of Swiss's before 2050 and up to 1.91″ after it, and Munkasey's co-ascendant up to 6.07″. The co-ascendants preregistration, written three hours later, said the end-to-end half had not been measured and fixed the 1850–2049 window, the one the house systems and points were judged in.
- **Effect.** As first written, checkpoint 14 counted both units: 0.45 of 182.45 that the rule below does not allow.
- **Disposition.** Under the programme's rule that a gate passing only under a change adopted after its residual was seen counts as `validated` until the owner ratifies the change (README, *Status and release*; the precedent is F-29), both are `validated`. Their records say so and keep every reading's numbers: Koch 82.677″ and the co-ascendants 88.5″ with Swiss reading the UTC instant as UT1 ([clock readings](../evidence/co-ascendants-2026-10-04/results/clock-readings.json)). The owner decides two questions:
  1. Does an end-to-end comparison with an engine that applies UT1 − UTC give Swiss the engine's UT1 Julian day?
  2. Does the 1850–2049 window, where Swiss's sidereal time is the IAU one, apply to the co-ascendants as it does to the house systems?
- **What each answer does.** Koch depends on question 1 alone: its window is the rc.9 record's. The co-ascendants need both. A yes to question 1 accepts Koch (0.2); yes to both also accepts the co-ascendants (0.25). A no to question 1 fails both, as measured.
- **The other house systems.** The other twelve keep their acceptance, which rests on the rc.9 and rc.10 records, where both programs read the UTC instant as UT1. On rc.16, whole sign is within 3″ under either reading, and Equal-MC was not measured with Swiss reading the UTC instant as UT1. The other ten are within 3″ end to end only with the shared reading, so the answer to question 1 decides their standing on rc.16 too.
- **The programme's recommendation**, for the owner to accept or reject:
  - **Question 1: ratify.** The shared reading compares both programs at the same instant. Swiss reading the UTC instant as UT1 compares instants up to 0.9 s apart, which measures Swiss's input convention rather than either program's houses. The engine's UTC-to-UT1 conversion is judged by the time units.
  - **Question 2: ratify.** Outside 1850–2050 Swiss uses its long-term sidereal time, and no point is judged against it there.
  - **Either way**, the original results stay recorded beside the new.

### F-72 — the house and point tools' generator repeats its draws (minor, evidence)

- **Found** by review A of checkpoint 14. The tools of `houses-2026-09-26`, `points-2026-09-26`, `houses-2026-10-04` and `co-ascendants-2026-10-04` draw cases with `seed = (seed × 1103515245 + 12345) mod 2³¹` in double precision. The product exceeds 2⁵³, so digits are lost, and the sequence falls into a cycle of 10,466 draws. With seed 20260926, the houses given-input set's 20,000 broad draws (60,000 numbers) hold 12,515 distinct cases, and 3,258 distinct cases among its 5,199 undefined on both sides. `points-2026-09-26/tools/dump-given.mjs` draws its 20,000 broad cases from seed 20260927, into the same cycle: 12,076 are distinct.
- **Effect.** No verdict changes: the gates take the largest difference and agreement in every case, which repeats cannot worsen. The counts overstate the coverage. The end-to-end sets of `houses-2026-10-04` and `co-ascendants-2026-10-04` (10,416 numbers each) stay within one cycle: all 3,708 cases are distinct.
- **Disposition.** Disclosed in `houses-2026-10-04`; the earlier records keep their text. A new preregistered version can draw in exact integer arithmetic.

### F-73 — commits that cannot be found, and an understated figure (minor, records)

- The engine's `docs/evidence/birth-window/RESULTS.md` names the preregistration and the measured build as `d1000e66` and `670db8a6`, and four later commits of its review rounds as `94b9fa2`, `e0833ee`, `87bed02` and `f9ae1de`. All six are hashes from before the branch was rebased; for each, GitHub answers "No commit found". The published commits are [`d03f60c0`](https://github.com/zodiacs-org/engine/commit/d03f60c0f69d4dd4e7dc722876fd704b6cfde665), the preregistration (authored 2026-09-28T17:29:42Z), and its child [`09f8aa18`](https://github.com/zodiacs-org/engine/commit/09f8aa1813551bd8a9b61ff0e16b0135fc44aebf), the PASS (authored 19:10:39Z). The rebase committed both at 2026-09-30T06:46:40Z, so their order shows in the parent line and the author times. The rc.16 rerun, on `704cadc`, does not depend on them.
- `houses-2026-09-26/README.md` gives the ladder differences outside 1850–2049 as 13″. Its own `results/end-to-end.json` has Koch at 31.6″ and Regiomontanus at 15.2″; 13.2″ is that of the other systems that use the ascendant.
- **Disposition.** The site's records now cite the published commits and the right figures (`rc16-gates-2026-10-04`, `houses-2026-10-04`), and `houses-2026-09-26/README.md` carries an appended note. The engine's record needs an appended note in an engine pull request (open).

### F-33 — update, 2026-10-04

On rc.16 the preregistered rerun ([record](../evidence/houses-2026-10-04/README.md)) finds Koch within 3″ end to end on the ladder from 1850 to 2049 (largest 0.035″) when Swiss is given the engine's UT1 Julian day, and within 0.000000005″ given Swiss's inputs. With Swiss reading the UTC instant as UT1, as this finding's measurement did, the rc.16 accuracy refresh found 48 of 353 cases over 3″ (82.677″). The ledger records Koch as `validated` until the owner rules on the reading (F-71); if the owner declines it, Koch returns to failed.
