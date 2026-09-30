# Programme status

Checkpoint 6: production serves engine rc.14, Swiss Ephemeris output is out of the site's tree, and the ΔT values carry their attribution, 2026-09-30. The next session should start here.

Addendum, 2026-09-30: the owner's steps of the same day put `@zodiacs/engine` on npm, 0.1.1-rc.15 with provenance (P3.1a accepted), set up PyPI, JSR and Zenodo, sent the NAIF question and confirmed the assistant accounts. The list below keeps only what remains.

**Overall delivery: 18%** — 33.75 of 182.45 weighted units accepted; blocked on owner or external action: 2% (4.5).

The figure is computed by `node scripts/programme-ledger.mjs --summary` from [`acceptance-ledger.json`](acceptance-ledger.json). The method is in [README.md](README.md) and the unit list in [LEDGER.md](LEDGER.md).

## What changed since checkpoint 5

- **Production serves engine rc.14** (#600, merged as `6cc4d477`; deployment `dpl_2JtJjuE2bU8CYTBMxKF3kco43qcN`). The production engine chunk reports `0.1.1-rc.14`, and both pinned downloads match their published digests. The site takes secondary progressions from the package. Its chart calculations give the same numbers as on rc.10: 572,767 calls and 33,069,705 values compared exactly, with only the engine version and five invalid-date refusals differing.
  - F-01, F-02, F-04, F-06, F-07, F-10–F-16 and the engine part of F-21 are in production;
  - F-03 (`mcp:pack:check` in CI) is merged;
  - the MCP adapter is `0.1.0-rc.14`, labelled `MIT AND CC-BY-4.0` with a NOTICE.

  Three units are accepted: secondary progressions in the package (P2.A.timing.progressions), the site importing them (P2.E.progressions) and the declination and out-of-bounds functions (P2.A.aspects.declination-oob). Configurable aspects (P2.A.aspects.configurable) move from failed to partial.
- **The privacy fixes of #599 are in production** (merged as `aca257ad`, deployment `dpl_AuGvEUL1oJPenrfbFq3FkGH5V9s9`): F-17, F-18, F-19, F-26, F-27, F-40 and F-43–F-45.
- **Swiss Ephemeris output is out of the site's tree** (F-22, #602), under the decisions of 2026-09-28 §3 and 2026-09-29 §2. History is not rewritten: `2ca93d41` is the last commit with every value.
  - Removed: 10 files, per-case values from 133 files, 21 files rebuilt on the engine's own clock, and 148 lines of `swetest.c` in a receipt.
  - `strip.py --check` runs in CI, and a guard test fails if any of it comes back under any name.
  - The pages give the two programs' ΔT difference over 2100–2199 as statistics.
  - `docs/engine-validation/SWISS-OUTPUT-REMOVAL.md` is the record.
- **The ΔT values carry their attribution.**
  - F-49: the MCP archives 0.1.0-rc.8 to rc.10 stay as released, and a notice beside them gives the attribution.
  - F-50: the terms and methodology pages give the work, its DOI and its licence.
- **F-51**, the Lighthouse gate failing on runner stalls, is recorded; the gate is unchanged.
- **Decisions of 2026-09-29** ([DECISIONS-2026-09-29.md](DECISIONS-2026-09-29.md)):
  1. the F-49 notice;
  2. what removing Swiss output covers;
  3. published worked examples in tests;
  4. the IERS C04 values in the engine;
  5. the hosted compute API's first version.
- **Engine rc.15 is on the engine's `main`** ([zodiacs-org/engine#20](https://github.com/zodiacs-org/engine/pull/20), merged as `93ebae9f`): the time basis, Hellenistic timing and the Vedic techniques.
  - A re-check found living people's birth data in commits of its local history. The history was rebuilt before the first push, so no commit carries it.
  - The archive is `24eeb597…d348`, 190,974 bytes, and every gate passes.

## Steps that need the owner's accounts

The owner, or Codex working on the owner's computer, can do these. Each says what to report back. None needs a password or token to be shared.

Done on 2026-09-30, by the owner's report:
- **npm.** `@zodiacs/engine` 0.1.1-rc.14 was uploaded by hand with two-factor authentication, and 0.1.1-rc.15 was published from `release.yml` on main with provenance (run 36711081147). The trusted publisher, the `npm` environment limited to main, and publishing access that requires two-factor authentication and disallows tokens are set. The registry's tarballs match their archive receipts.
- **PyPI.** The trusted publisher exists, and `zodiacs` 0.1.0a1 was published from `pypi.yml` (run 36701023131).
- **JSR.** The scope `@zodiacs` and the package `engine` exist, linked to `zodiacs-org/engine`. Nothing is published.
- **Zenodo.** Its GitHub integration is on for `zodiacs-org/engine`. No release exists yet, so no DOI.
- **Search and analytics.** The Search Console and Plausible exports are in the private `zodiacs-org/analytics-baselines` under `2026-09-28/`. Bing imported the site from Search Console; its export was not yet available.
- **NAIF.** The question was sent once, on 2026-09-30 at 10:54 UTC, to the manager the contact page names for general requests. No answer yet. Do not resend it.
- **Assistants.** Free accounts exist on ChatGPT, Claude, Gemini and Perplexity for admin@zodiacs.org, with no payment method. Microsoft Copilot has no signed-in account.

Remaining:

1. **npm's `latest` tag.** It points at 0.1.1-rc.14, the manual first upload, so a plain `npm install @zodiacs/engine` installs the version without provenance. With the owner's authorization, move it: `npm dist-tag add @zodiacs/engine@0.1.1-rc.15 latest`, signed in with two-factor authentication. Until a stable version exists, `latest` should follow each reviewed, attested candidate.
2. **Repository settings** on GitHub.
   - `zodiacs-org/site`: add the topics (the gear beside About): astrology, birth-chart, natal-chart, horoscope, astro, typescript. On 2026-09-30 a GitHub search found none.
   - `zodiacs-org/engine`:
     - Settings, then General, then Pull Requests: keep "Allow merge commits", and turn off "Allow squash merging" and "Allow rebase merging". The archive record names source commits that only a merge commit keeps.
     - Settings, then Rules, then Rulesets: a branch ruleset for the default branch that blocks force pushes and deletions, and requires these status checks to pass:
       - Engine (Node 20), Engine (Node 22), Engine (Node 24);
       - Every carried archive rebuilds from its source commit;
       - Pack;
       - Packed consumer (Node 20.19.0), Packed consumer (Node 22.7.0), Packed consumer (Node 22), Packed consumer (Node 24);
       - Conformance suite; Conformance vectors rebuild from their sources;
       - Time atlas checks.

       All of them run on every pull request.
   - In each public repository (`site`, `engine` and `sdk`): open Settings, then Code security, and turn on **Private vulnerability reporting**. Every SECURITY.md already offers its **Report a vulnerability** button beside email to admin@zodiacs.org.
   - Report a screenshot of each.
3. **The first GitHub release of the engine (G4).** A published GitHub release on `zodiacs-org/engine` makes Zenodo mint a DOI, and a DOI is permanent. With the owner's authorization, the first release is 0.1.1-rc.15, tagged at its merge commit, with its CHANGELOG entry as the notes.
4. **JSR (P3.1c).** A publish workflow using GitHub's OIDC token is to be added to the engine. Its first run needs the owner's authorization.
5. **Search and analytics baselines (P0.7b).** Add Bing's export when it is ready, then either attach `zodiacs-org/analytics-baselines` read-only to this work, or compute the aggregates on the owner's side. Only aggregates would be committed, to that private repository.
6. **Vercel Firewall rate limits.** Four live endpoints call Vercel's rate-limit SDK, and no rule exists for any of them, so none is limited today. The site's runbook (§3) makes publishing them the owner's step. In the project's Firewall tab, add one custom rule per ID: If "@vercel/firewall" Rate limit ID equals the ID; Then Rate Limit, fixed window, 60 seconds, counted by IP.
   - 10 requests: `zodiacs-email-subscribe`, `registry-aura-holdings-v1`, `zodiacs-wallet-birth`;
   - 120 requests: `zodiacs-transit-calendar`, because calendar apps fetch many subscribers' feeds from a few shared addresses (runbook §3);
   - 60 requests: `zodiacs-compute-api`, for the compute endpoints when they ship.

   No Deny or Challenge rule, and no rule on a path. The team is on Pro, whose rate limiting is billed from the plan's monthly credit. Publish, then run the two checks in `docs/OWNER-SETUP-RUNBOOK.md` §3 and report their output.
7. **Calendar feeds, before their release.** The opaque feed ids (P1.15) are ready on a branch. They need, in this order:
   1. `CALENDAR_FEED_SWEEP_SECRET`, a random value of at least 32 characters, stored without printing it in Vercel Production and as a secret of a GitHub environment `calendar-feed-production` limited to `main`;
   2. confirmation that Production has `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

   On 2026-09-30 the project listed `PUBLIC_SUPABASE_URL` for Preview and Development only, and no production page bundle carried the Supabase address. Report where Production gets it, if anywhere, without its value.
8. **Microsoft Copilot**, only if the monthly panel (A8) and the assistant benchmark (B4.b) are to cover five assistants: a free account for admin@zodiacs.org.

Later, once the site has rebuilt the MCP server on the published engine: the same manual first upload for `@zodiacs/mcp-server`, from its verified archive, since npm sets up a trusted publisher only for a package that exists.

## Identities verified at this checkpoint

**Site.** `main` = `23dd8cb7` (the daily sky of 2026-09-30, after #600 `6cc4d477`). Production serves it: `dpl_GhqWmtsbsk17JCsKC5ohHUtC5GFd`, READY. The site vendors engine rc.14.

**Engine.** `main` = `93ebae9f` (PR #20): rc.15 on the rebuilt history `104bd5a` (source), `cbad72c` (carrier) and `07ed236` (gate records). CI passed every job on the PR's head.

| archive | SHA-256 | source | status |
| --- | --- | --- | --- |
| rc.14 | `adc9805e…476e` | `03db4bb6`, carried by `b221534` (merge `8deda244`) | the site vendors it; production serves it; npm waits for step 1 |
| rc.15 | `24eeb597…d348` | `104bd5a`, carried by `cbad72c` (merge `93ebae9f`) | merged; not adopted |

The earlier archives are as checkpoint 5 lists them. rc.15's three local builds (`3651c525…`, `554ed7ea…`, `bddfb3b7…`) were never pushed; `artifacts/README.md` records them by digest.

**SDK.** `zodiacs-org/sdk` `main` = `a95dc0cf` (PR #14).

**MCP.** Production serves `0.1.0-rc.14`, `40936e28…2f0f`, 75,220 bytes, pinned to `0f7e0cf2`.

**Registries.** Nothing of the engine or platform is published. On 2026-09-29, npm returned 404 for `@zodiacs/engine`.

## In progress

- **The site's adoption of engine rc.15.** rc.15 grows the site's engine chunk by about 5 KB gzip over its 27,648-byte budget, from the time basis's tables; the adoption has to shrink that or raise the budget with its reason.
- **Full IAU 2000B nutation**, on branch `feature-nutation` for rc.16. Against ERFA over 1800–2200, the nutation's share of every longitude falls from 0.252″ to 0.0037″ at most, and the ascendant's error from 0.824″ to 0.0063″. The planets' own series still dominate their longitudes, at up to about 19″. Against Swiss over 1850–2049 the ascendant is within 0.004″. The Koch ladder's worst case falls from 3.73″ to 0.035″ (F-33, P2.A.house.koch).
- **The hosted compute API** (P3.3), on branch `compute-api`: six POST endpoints, a privacy negative-control test, budgets, a switch and receipts, per decision §5. Its PR follows this one.
- **Opaque calendar feed ids** (P1.15), on branch `feed-ids`: the review's findings are fixed; the release waits for step 10.
- **rc.16's pieces**, each on its own branch: the calculation API and frames, birth-time windows, the site's techniques in the package, house extras, and rise/set with planetary hours. The Chinese solar terms fit the Sun to DE430, which cannot ship before NAIF answers (step 7); they need another source first.

## Next

1. Merge this PR and verify production.
2. The site's adoption of engine rc.15, with the chunk-size decision.
3. The compute API PR, then its latency and cost on production.
4. rc.16: integrate the branches onto rc.15 and review them.
5. The calendar feeds' release, once step 10 is done.
