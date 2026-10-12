# Open pull request triage

| Recommendation | Count |
| --- | ---: |
| merge | 6 |
| close | 28 |
| needs-owner | 14 |
| New, in review, excluded | 1 |
| Total supplied PRs | 49 |

As of 12 October 2026, Asia/Bangkok. Baseline: `origin/main` at `e710e574` (#710), engine 1.0.0, MCP adapter 0.1.0-rc.19 and Developer plugin 0.3.7. CLAUDE.md is authoritative; programme STATUS.md supplies the current checkpoint, while older status/handoff records are historical.

## Do first

1. **#683 (P0):** Finish review and CI of `codex/horoscope-sentence-reuse-rebased`, then close #683 in its favor. This protects publication before extending coverage into the first affected date, 9 May 2027; it is not a current outage.
2. **#684 (P1):** Choose and rebase the keep-confirmation fix shared with #672; the current calculator still overwrites the outcome during scope reopening.
3. **#672 (P1):** Preserve its separate Today parser-label correction and keep-helper protections when consolidating with #684.
4. **#691 (P1):** Review the owner-approved panel update and require green CI, including applicable staging/host checks, before merging.
5. **#713 (P1):** Review the 1.0.0 developer guides and their Linux examples/browser checks before merging.

## How to read the recommendations

`merge` means ready once reviewed and CI is green. `close` identifies landed, superseded or obsolete work. `needs-owner` identifies a product/owner decision or substantial integration/evidence rework. P0 is time-critical publication work, P1 is the next active queue, and P2 is follow-up or cleanup.

All 49 fetched heads were compared using commit logs, three-dot diff statistics, ancestry and patch-equivalence checks against main. Main history and present source were checked for claimed replacements. Conflict labels come from the supplied JSON snapshot; mergeability is not proof of review or green CI. Checks described in PR bodies are reported evidence, not newly rerun validation.

## PR inventory

| PR | Title | Recommendation | Priority | Evidence and reason |
| --- | --- | --- | --- | --- |
| [#715](https://github.com/zodiacs-org/site/pull/715) | Record engine 1.0.0 in production | merge | P1 | Two unique commits (`d2513c16`, `bcf69a77`) add production verification and correct programme records after #710; mergeable, seven files. |
| [#713](https://github.com/zodiacs-org/site/pull/713) | Publish the developer guides on engine 1.0.0 | merge | P1 | Unique 1.0.0 guide routes, Markdown twins and example verifiers (`d7492652`, `c043bb40`) follow #710; mergeable, with local checks reported. |
| [#712](https://github.com/zodiacs-org/site/pull/712) | Occasions: the calculation module for "The sky on…" and life milestones | merge | P1 | Unique, currently unimported occasions module (`bacafb4c`, `9aa42dac`) implements owner-approved scope; mergeable, with 13 independent-reference tests reported. |
| [#691](https://github.com/zodiacs-org/site/pull/691) | Chart Studio: Your week, plain chart header; quieter horoscope loading; sky calendar link | merge | P1 | Unique panel URIs and Your week implementation (`4c1f6d2b`, `1eee55f1`); mergeable, and updated body records owner approval for the 0.4.0 submission. |
| [#684](https://github.com/zodiacs-org/site/pull/684) | Fix duplicate saved charts and a missing message when two tabs keep at once | needs-owner | P1 | `164d7173` fixes a still-present keep-outcome overwrite, overlaps #672 and conflicts; choose one calculator fix and rebase with fresh lifecycle evidence. |
| [#683](https://github.com/zodiacs-org/site/pull/683) | Keep horoscope publication from stopping in May 2027 and late 2028 | close | P0 | Replace with `codex/horoscope-sentence-reuse-rebased` once green; `4c368c7f` remains unique, but this stack predates main’s #707/#711 renderer fixes. |
| [#678](https://github.com/zodiacs-org/site/pull/678) | Bump the npm-minor-patch group across 1 directory with 16 updates | close | P1 | 16 root minor/patch updates touch only package files; consolidate into `codex/deps-grouped` and regenerate from current main instead of merging this standalone lockfile. |
| [#674](https://github.com/zodiacs-org/site/pull/674) | Plan: distribution to AI assistants and the data layer (6 October 2026) | needs-owner | P1 | Unique plan (`4c275a2f`) asks for 23 owner decisions; its /mcp-404 and two-server premises need revision after #618 (`b0512605`) and current CLAUDE.md. |
| [#672](https://github.com/zodiacs-org/site/pull/672) | Fix the two drive flakes from #661: a withdrawn "Kept" invited a duplicate keep; a split edition label shifted Today | needs-owner | P1 | Unique keep-helper and parser-label fixes (`f8ed3fcd`, `8745569a`) conflict; reconcile overlapping #684 without losing the Today layout-shift correction. |
| [#649](https://github.com/zodiacs-org/site/pull/649) | Add the approved October 5 Carlos Alcaraz chart | needs-owner | P2 | October 5 Alcaraz edition (`33b6abfb`) is absent from main and conflicts; owner must decide retrospective publication and refresh its release evidence. |
| [#640](https://github.com/zodiacs-org/site/pull/640) | Load card pictures through image elements | needs-owner | P1 | `f03588fd` addresses WebKit exit errors; main still uses fetch/Blob image loads, but the branch conflicts and needs updated source-bound captures and sharing checks. |
| [#619](https://github.com/zodiacs-org/site/pull/619) | Extend Market Lens across asset classes with private research recovery | needs-owner | P1 | Unique Desk/Market Lens work spans 220 files, private research recovery and cross-asset plans; conflicts remain, and a separate owner recommendation is coming. |
| [#564](https://github.com/zodiacs-org/site/pull/564) | Bump @remotion/cli from 4.0.498 to 4.0.526 in /promo/cabinet-promo | close | P2 | Isolated Remotion CLI 4.0.498 → 4.0.526 leaves sibling Remotion packages at 4.0.498; replace with the grouped, coordinated promo update. |
| [#563](https://github.com/zodiacs-org/site/pull/563) | Bump @remotion/eslint-config-flat from 4.0.498 to 4.0.526 in /promo/cabinet-promo | close | P2 | Isolated Remotion ESLint config 4.0.498 → 4.0.526 touches only promo package files; replace with `codex/deps-grouped` alongside its Remotion siblings. |
| [#562](https://github.com/zodiacs-org/site/pull/562) | Bump actions/setup-node from 4.4.0 to 7.1.0 | close | P2 | setup-node 4.4.0 → 7.1.0 rewrites 16 workflows; retire this standalone major proposal, exclude it from the group and review runner/runtime compatibility separately. |
| [#561](https://github.com/zodiacs-org/site/pull/561) | Bump actions/upload-artifact from 4.6.2 to 7.0.2 | close | P2 | upload-artifact 4.6.2 → 7.0.2 rewrites seven workflows; retire this standalone major proposal, exclude it from the group and review artifact/runner compatibility separately. |
| [#560](https://github.com/zodiacs-org/site/pull/560) | Bump actions/checkout from 6.1.0 to 7.0.1 | close | P2 | checkout 6.1.0 → 7.0.1 rewrites 19 workflows; retire this standalone major proposal, exclude it from the group and review credentials/runner behavior separately. |
| [#469](https://github.com/zodiacs-org/site/pull/469) | Fix release advisories and current-edition Registry integration | close | P2 | Entire head `35301d24` is an ancestor of `origin/main`; `origin/main..pr/469` has no commits, so the work already landed. |
| [#438](https://github.com/zodiacs-org/site/pull/438) | Make chart and Moon reference captions match their data | close | P2 | Entire head `9912e37b` is an ancestor of `origin/main`; `origin/main..pr/438` has no commits, so the work already landed. |
| [#437](https://github.com/zodiacs-org/site/pull/437) | Withhold unverified Moon certainty for unknown birth times | close | P2 | Entire head `9d180c9f` is an ancestor of `origin/main`; `origin/main..pr/437` has no commits, so the work already landed. |
| [#435](https://github.com/zodiacs-org/site/pull/435) | Reject unknown-time references outside the selected local date | close | P2 | Entire head `f803d254` is an ancestor of `origin/main`; `origin/main..pr/435` has no commits, so the work already landed. |
| [#434](https://github.com/zodiacs-org/site/pull/434) | Prevent obsolete birth-chart results and delayed action updates | close | P2 | Entire head `3845a04b` is an ancestor of `origin/main`; `origin/main..pr/434` has no commits, so the work already landed. |
| [#431](https://github.com/zodiacs-org/site/pull/431) | Keep runtime support claims tied to current candidate evidence | close | P2 | Entire head `abcf1a44` is an ancestor of `origin/main`; `origin/main..pr/431` has no commits, so the work already landed. |
| [#430](https://github.com/zodiacs-org/site/pull/430) | Prevent stale Moon lookup results and retain regression coverage | close | P2 | Entire head `4227bb07` is an ancestor of `origin/main`; `origin/main..pr/430` has no commits, so the work already landed. |
| [#429](https://github.com/zodiacs-org/site/pull/429) | Add exact local-date intervals as an inactive prerequisite | close | P2 | Entire head `65418003` is an ancestor of `origin/main`; `origin/main..pr/429` has no commits, so the work already landed. |
| [#428](https://github.com/zodiacs-org/site/pull/428) | Correct historical seconds and adopt verified engine rc.6 | close | P2 | Entire head `30b41cd8` is an ancestor of `origin/main`; `origin/main..pr/428` has no commits, so the work already landed. Its engine candidate is also superseded by 1.0.0 in `e710e574` (#710). |
| [#427](https://github.com/zodiacs-org/site/pull/427) | Add local calculation receipt download and preserve shared birth inputs | close | P2 | Entire head `804c7030` is an ancestor of `origin/main`; `origin/main..pr/427` has no commits, so the work already landed. |
| [#426](https://github.com/zodiacs-org/site/pull/426) | Add optional immutable saved natal records with transaction guards | close | P2 | Inactive store draft at `46b36e2c` was selectively integrated and hardened through #486/#490; the complete lifecycle landed in `52ae6eeb` (#490). |
| [#425](https://github.com/zodiacs-org/site/pull/425) | Preserve complete receipts at the site calculation boundary | close | P2 | Entire head `c761a49c` is an ancestor of `origin/main`; `origin/main..pr/425` has no commits, so the work already landed. |
| [#422](https://github.com/zodiacs-org/site/pull/422) | Adopt verified engine rc.5 and preserve developer reflow | close | P2 | Entire head `6ab85278` is an ancestor of `origin/main`; `origin/main..pr/422` has no commits, so the work already landed. Its engine candidate is also superseded by 1.0.0 in `e710e574` (#710). |
| [#419](https://github.com/zodiacs-org/site/pull/419) | Add local natal receipt portability to the developer starter | close | P2 | Entire head `ba65375a` is an ancestor of `origin/main`; `origin/main..pr/419` has no commits, so the work already landed. |
| [#418](https://github.com/zodiacs-org/site/pull/418) | Reject invalid civil imports and implicit host timezones | close | P2 | Entire head `a4284d8d` is an ancestor of `origin/main`; `origin/main..pr/418` has no commits, so the work already landed. |
| [#417](https://github.com/zodiacs-org/site/pull/417) | Add reproducible developer integration paths and support matrix | close | P2 | Entire head `8343f173` is an ancestor of `origin/main`; `origin/main..pr/417` has no commits, so the work already landed. |
| [#416](https://github.com/zodiacs-org/site/pull/416) | Add Astrofolio verification with source-backed claims and failure-safe checks | needs-owner | P2 | Unique verification route/checker (`98fbf818`) pins dated sources; handoff requires repinning/integration decisions and records only 14/20 fully qualified answer fixtures. |
| [#413](https://github.com/zodiacs-org/site/pull/413) | Fix methodology redirect and clarify birthday guidance | merge | P2 | Two unique commits (`c95f4a6c`, `bf8268d2`) add missing methodology aliases and birthday guidance; main lacks both, and the supplied snapshot is mergeable. |
| [#300](https://github.com/zodiacs-org/site/pull/300) | Bump @vercel/og from 0.7.2 to 1.0.2 | close | P2 | @vercel/og 0.7.2 → 1.0.2 is a conflicting major proposal; close the old standalone PR, exclude it from the group and assess rendering/API compatibility separately. |
| [#299](https://github.com/zodiacs-org/site/pull/299) | Bump react from 18.3.1 to 19.2.8 | close | P2 | React 18.3.1 → 19.2.8 is a conflicting major proposal; close the old standalone PR, exclude it from the group and assess React DOM/renderer peers separately. |
| [#298](https://github.com/zodiacs-org/site/pull/298) | Bump @types/node from 22.20.0 to 26.5.1 | close | P2 | @types/node 22.20.0 → 26.5.1 is a conflicting major proposal beyond the repo’s Node 22 requirement; close it and exclude Node 26 types from the group. |
| [#289](https://github.com/zodiacs-org/site/pull/289) | Standardize the site footer system | close | P2 | Celestial Colophon system was superseded by `a2325595` (#306), now the mandatory shared footer in CLAUDE.md; this earlier branch conflicts. |
| [#274](https://github.com/zodiacs-org/site/pull/274) | Draft September 2026 horoscopes and almanac | close | P2 | September draft packet (`16c7fb0a`) is obsolete after published September horoscopes in `3ae802bf` (#329); its old editorial window has passed and it conflicts. |
| [#251](https://github.com/zodiacs-org/site/pull/251) | Launch Zodiac Games team standings | needs-owner | P2 | Unique weekly-question board and database migration (`56df93d8`) conflict with the released Race programme (#250/#261/#266); decide whether this distinct model is wanted. |
| [#244](https://github.com/zodiacs-org/site/pull/244) | Polish Guide mobile UX, context, and localization | needs-owner | P2 | Unique mobile/modal and auth-lifecycle changes (`909310e2`, `292037de`) conflict with Guide’s later compact interface (#611/#614); salvage requires design and integration review. |
| [#227](https://github.com/zodiacs-org/site/pull/227) | Disclose Zodiac Markets quote comparison | needs-owner | P2 | Unique quote-provider disclosures (`459a5886`, `21a8b363`) conflict with current privacy copy; native-language/legal review and #226’s identity decision remain explicit gates. |
| [#226](https://github.com/zodiacs-org/site/pull/226) | Add the flag-off Zodiac Markets workspace | needs-owner | P2 | Six unique commits add a quote-only workspace; body leaves duplicate Zodiac Markets identity, #227, provider/licensing and launch decisions unresolved despite snapshot mergeability. |
| [#212](https://github.com/zodiacs-org/site/pull/212) | Make the copy tamper test independent of the day's sky | merge | P2 | Unique two-file aspect fixture/assertion (`8542d439`) preserves specific coverage beyond main’s generic sky-event workaround (`fc2065ff`); mergeable, subject to current copy-rule CI. |
| [#209](https://github.com/zodiacs-org/site/pull/209) | Restore Ask Zodiacs as a grounded chart guide | needs-owner | P2 | Unique assistant replacement and 90-day account-memory migrations (`3e9899bc`) conflict with the later Guide protocol (#242); decide memory/provider scope before substantial integration. |
| [#206](https://github.com/zodiacs-org/site/pull/206) | Connect the Today retention loop and harden trust | needs-owner | P2 | Unique Today-chart preference, retention and people-trust changes (`81f9eede`) span 143 files and conflict with current navigation, chart ownership and Fable-owned persona. |
| [#110](https://github.com/zodiacs-org/site/pull/110) | Finish Registry icon migration, API smoke guard, and locale copy | needs-owner | P2 | Seven-probe smoke coverage exists on main, but `/assets/icons/` usage and the old ES record label remain; salvage unique icon/copy changes from this conflicting July branch. |

## Dependabot replacement

Close all nine standalone Dependabot PRs (#678, #564, #563, #562, #561, #560, #300, #299, #298) in favor of the single replacement being opened on `codex/deps-grouped`. Wait for review and green CI of that replacement before retiring the safe bumps. Group compatible root updates and coordinated promo dependencies against current main.

Risky majors are excluded from the grouped PR: React 19 (#299), @types/node 26 (#298), @vercel/og 1.0 (#300), setup-node 7 (#562), upload-artifact 7 (#561) and checkout 7 (#560). Closing those old proposals does not mean these majors landed or are included in the replacement; they need separate compatibility decisions and validation.

## New, in review

| PR or branch | Title or purpose | Status | Priority |
| --- | --- | --- | --- |
| [#714](https://github.com/zodiacs-org/site/pull/714) | Add STATUS.md orientation for coding agents | new, in review | P2 |
| `codex/horoscope-sentence-reuse-rebased` | Rebased replacement for #683; draft PR #716 | new, in review | P0 |
| `codex/deps-grouped` | Grouped dependency replacement being opened; PR number absent from supplied snapshot | new, in review | P1 |

#714 and replacement PRs opened today by this effort receive no recommendation. The two replacement branches are outside the 49-PR snapshot and its counts. #715 and #713 belong to separate production-record and guide work, so their new dates alone do not exclude them.

This file makes recommendations only. No PR was merged, closed or pushed, and no live release or CI state was changed.
