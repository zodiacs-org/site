# Programme status

Checkpoint 10, 2026-10-01: the first tagged engine release and permanent DOI are verified.

**Overall delivery: 24%** (23.842% to three decimals) — 43.5 of 182.45 weighted units accepted; blocked: 2% (3.5), or 1.918% to three decimals. These are derived ledger weights, not a forecast.

- **G4 accepted, released:** [engine v0.1.1-rc.15](https://github.com/zodiacs-org/engine/releases/tag/v0.1.1-rc.15) points to the exact rc.15 merge commit, includes its complete changelog, and is archived under [DOI 10.5281/zenodo.23080134](https://doi.org/10.5281/zenodo.23080134). Independent verification matched all 605 archived files byte for byte. [Public evidence and reproduction](../evidence/engine-github-release-2026-10-01/README.md).
- The owner explicitly approved the release and permanent DOI. The prerelease classification and existing license qualifications are preserved. No npm package or dist-tag changes were made.
- **A4 remains unaccepted:** the locally reviewed Agent Skill bundle cannot be pushed until the prior private birth-data pattern file is supplied for the engine's mandatory history check. Its 0.5 weight is now recorded as blocked; the private patterns themselves must never be committed.
- This checkpoint changes no other acceptance state, gate, weight or denominator. Compute privacy/production telemetry, calendar rollout and rc.16 adoption continue in separate checkpoints. The prior compute checkpoint is in [PR #610](https://github.com/zodiacs-org/site/pull/610); none of its rollout or accuracy gates is accepted here.
- Actual command: `node scripts/programme-ledger.mjs --summary` → `Overall delivery: 24% (43.5 of 182.45); blocked 2% (3.5)`.

## Earlier checkpoints

Checkpoint 8, 2026-09-30: the handoff. The compute API (P3.3) merges with this record, the owner's third report is in, and the programme passes to the next agent. **The next session should start with [HANDOFF-2026-09-30.md](HANDOFF-2026-09-30.md)**, then this file.

**Overall delivery: 23%** — 42.5 of 182.45 weighted units accepted; blocked on owner or external action: 2% (4).

The figure is computed by `node scripts/programme-ledger.mjs --summary` from [`acceptance-ledger.json`](acceptance-ledger.json). The method is in [README.md](README.md) and the unit list in [LEDGER.md](LEDGER.md).

## What changed since checkpoint 7

The figure stays at 23% (42.5); no unit changes state.

- **The compute API** (P3.3) merges with this record. It has six POST endpoints under `/api/v1/`, fails closed until its Firewall rules exist, and is bounded to about 8.7 CPU-seconds a minute per address ([`evidence/compute-api-2026-09-29/`](../evidence/compute-api-2026-09-29/README.md)). The unit stays implemented. Its gate still asks for the latency and cost of the deployed endpoints.
- **F-58: the compute API's first deploy answered 500 on every endpoint.** The function runs on Vercel's `nodejs22.x`, which does not detect module syntax, and there the engine's named imports from astronomy-engine fail to load. The PR after #605 bundles the handler with the engine into `api/_compute/compute.mjs`. A test loads the bundle with module syntax detection off, and uses the unbundled engine, which fails there, as the control. The function's other routes were not affected.
- **The owner's third report** (below): Firewall version 6 with the compute limits at 40 and 10 and the calendar feeds' write limit at 3, and System Environment Variables exposed. Bing is still preparing its export.
- **Work stopped for the handoff**, not on GitHub, delivered to the owner as git bundles ([HANDOFF-2026-09-30.md](HANDOFF-2026-09-30.md) §4 and §9):
  - the calendar feeds' release (P1.15), which nothing blocks now;
  - about half of the site's adoption of engine rc.16;
  - P4.5's version 3: FAIL on both corpora, with post-review fixes committed as work in progress;
  - the engine's eclipse and topocentric entries for rc.17;
  - the held-back Chinese-calendar entry.

## Checkpoint 7: what changed since checkpoint 6

The figure moves from 19% (34.25) to 23% (42.5).

- **Production serves engine rc.15** (#603, merged as `2197e696`; deployment `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`, READY at 13:30 UTC). The engine chunk that `/birth-chart/` loads carries `0.1.1-rc.15`. The MCP archive 0.1.0-rc.15 and the engine archive that the install lines pin download with their published digests, and npm's `latest` is the same engine bytes ([`evidence/site-engine-rc15/`](../evidence/site-engine-rc15/README.md), "In production").
  - The site's charts read an instant from 1972 to 2027-10-02 as UTC, on the IERS leap seconds and UT1 − UTC. Elsewhere its chart values agree with rc.14's within 0.000003″, the lunar nodes within 0.072″.
  - The engine chunk's budget is 32,358 gzip bytes (DECISIONS-2026-09-30.md §2).
  - The site keeps its own local-time resolver, declinations and sect (§4).
  - F-35, F-36, F-39 and F-46 are in production, and F-52 to F-55 describe production since #603.
- **The units rc.15 carries**, judged on its evidence (LEDGER.md gives each reason):
  - accepted, 8.25: the leap-second table (P1.M3a), UT1 − UTC with its fallback band in sidereal time (P1.M3b), receipts with the time scale, tzdb version and transition (P1.M3d), time-5's six flag probes (P1.M3e), Julian calendar input in the package (P1.13b), profections, firdaria, zodiacal releasing and solar arcs (P2.A.timing), nakshatras and padas (P2.B.nakshatras), and the dashas (P2.B.dashas);
  - validated, 1.75: the package's birthplace mean time and zone history (P1.01b, P1.12b) pass their lists and are on npm, but neither the site nor the MCP adapter calls them, and their gates ask for adoption;
  - partial: the vargas lack the birth-time sensitivity output (P2.B.vargas), and KP the ruling planets (P2.B.kp);
  - failed: five of the nine named ayanamsas miss the 0.01″ gate against Swiss, Krishnamurti by 0.071″, Raman 10.1″, Yukteswar 806″, True Pushya 0.54″ and the Galactic Centre 0.10″; Lahiri ICRC is not implemented (P2.B.ayanamsas).
- **The owner's steps of 2026-09-30** put `@zodiacs/engine` 0.1.1-rc.15 on npm with provenance (P3.1a accepted) and then moved `latest` to it. They set up PyPI, JSR and Zenodo, sent the NAIF question, confirmed the assistant accounts, finished the repository settings (G2 accepted), published the Firewall rules and set the calendar feeds' secret.
- **F-57**, found verifying production: the developer pages and the llms files said that the engine is not on npm and that `npm view @zodiacs/engine` returns 404, and the claims ledger marked that claim supported. Fixed in this PR: they, `vendor/README.md` and the candidate record say that npm serves 0.1.1-rc.15 under `latest` and `next`, published with SLSA provenance, with the pinned archive as the verified alternative, on a registry read of 2026-09-30 committed as evidence (`evidence/site-engine-rc15/npm-registry.json`). The released MCP archive and the engine's packed README keep the old sentence until their next versions.
- **Decisions of 2026-09-30** ([DECISIONS-2026-09-30.md](DECISIONS-2026-09-30.md)):
  1. the Chinese solar terms wait for a Sun not fitted to JPL data;
  2. the engine chunk's budget rises by rc.15's measured growth;
  3. seven reference values that equal removed Swiss values stay;
  4. declinations and sect wait for a pure entry point;
  5. the site carries the 1972 UT1 − UTC values as the engine does.

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

Done in the second report of 2026-09-30:
- **npm's `latest` tag** points at 0.1.1-rc.15, so a plain install selects the attested version.
- **Repository settings.** The site's topics (astro, astrology, birth-chart, horoscope, natal-chart, typescript). The engine allows merge commits only. Its `main` ruleset (24244836) blocks deletion and force pushes and requires the twelve checks, with no bypass and no required review. Private vulnerability reporting is on in site, engine and sdk.
- **Vercel Firewall.** Version 5 is active with five SDK rate-limit rules, each a fixed 60-second window counted by IP: `zodiacs-email-subscribe`, `registry-aura-holdings-v1` and `zodiacs-wallet-birth` at 10, `zodiacs-transit-calendar` at 120 and `zodiacs-compute-api` at 60. Twelve empty requests to the email endpoint gave eleven 400s and then a 429 with `Retry-After: 60`. The eleventh passed because the loop crossed a window boundary.
- **Calendar feeds.** `CALENDAR_FEED_SWEEP_SECRET` is in Vercel Production (sensitive) and in the GitHub environment `calendar-feed-production`, limited to `main`. `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are Production project variables.

Done in the third report of 2026-09-30:
- **Vercel Firewall.** Version 6 is active with seven SDK rate-limit rules, each a fixed 60-second window counted by IP with the `rate_limit` (429) action: the five above, with `zodiacs-compute-api` changed from 60 to 40, and two new ones, `zodiacs-compute-events` at 10 and `zodiacs-calendar-feed-write` at 3. Nothing else changed, and no endpoint was tested.
- **System Environment Variables.** "Automatically expose System Environment Variables" is on for the project, so the feed routes can read `VERCEL_ENV`. Nothing was changed.
- **Bing.** Its Search Performance still said it was preparing the data, so there was no export yet.

Completed on 2026-10-01: the first GitHub release and permanent DOI (G4), independently verified above.

Remaining:
2. **JSR (P3.1c).** A publish workflow using GitHub's OIDC token is to be added to the engine. Its first run needs the owner's authorization.
3. **Search and analytics baselines (P0.7b).** Add Bing's export when it is ready, then either attach `zodiacs-org/analytics-baselines` read-only to this work, or compute the aggregates on the owner's side. Only aggregates would be committed, to that private repository.
4. **Microsoft Copilot**, only if the monthly panel (A8) and the assistant benchmark (B4.b) are to cover five assistants: a free account for admin@zodiacs.org.

Later, once the site has rebuilt the MCP server on the published engine: the same manual first upload for `@zodiacs/mcp-server`, from its verified archive, since npm sets up a trusted publisher only for a package that exists.

## Identities verified

At checkpoint 8, before this record merged: site `main` = `acbfad2e` (#604), served by `dpl_J8wQ2hr7RwQRDbT9unq5bUc6mHSC`, whose `/developers/engine/` says `npm install @zodiacs/engine` installs 0.1.1-rc.15; engine `main` = `6807f63` (PR #22, rc.16, archive `43a72d30…15d8`, not on npm and not adopted by the site).

At checkpoint 7:

**Site.** `main` = `2197e696` (#603, a merge commit whose tree is its head `4bc853e1`'s). Production serves it: `dpl_Ax6saHNV85duCvdExDz7LpSHrLD7`, READY since 13:30:31 UTC, with the aliases `zodiacs.org` and `www.zodiacs.org`. The site vendors engine rc.15, and its engine chunk, `/_astro/full.Dc14JBf_.js`, carries `0.1.1-rc.15`.

**Engine.** `main` = `d5326a88` (PR #21: the Python alpha and its PyPI publishing; the JavaScript package is rc.15's). rc.15 is `93ebae9f` (PR #20), on the rebuilt history `104bd5a` (source), `cbad72c` (carrier) and `07ed236` (gate records).

| archive | SHA-256 | source | status |
| --- | --- | --- | --- |
| rc.14 | `adc9805e…476e` | `03db4bb6`, carried by `b221534` (merge `8deda244`) | on npm, the one manual first upload |
| rc.15 | `24eeb597…d348` | `104bd5a`, carried by `cbad72c` (merge `93ebae9f`) | the site vendors it; production serves it; on npm with provenance |

The earlier archives are as checkpoint 5 lists them. rc.15's three local builds (`3651c525…`, `554ed7ea…`, `bddfb3b7…`) were never pushed; `artifacts/README.md` records them by digest.

**npm.** `@zodiacs/engine`: `latest` and `next` are both `0.1.1-rc.15`, whose registry SHA-1 (`e4a49148…4862`) and SHA-512 integrity are those of `24eeb597…d348`. `@zodiacs/mcp-server` is not on npm.

**PyPI.** `zodiacs` 0.1.0a1. **JSR.** The scope and package exist; nothing is published.

**SDK.** `zodiacs-org/sdk` `main` = `a95dc0cf` (PR #14).

**MCP.** Production serves `0.1.0-rc.15`, `567054c6…9657`, 86,944 bytes, pinned to `218de839`; it bundles engine rc.15.

## In progress and next

[HANDOFF-2026-09-30.md](HANDOFF-2026-09-30.md) §4 lists the work in flight, with each branch's head and state, and §5 the next steps in order, each with its gate.
