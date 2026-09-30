# Programme status

Checkpoint 7: production serves engine rc.15 and the MCP adapter 0.1.0-rc.15, and the units rc.15 carries are judged on its evidence, 2026-09-30. The next session should start here.

**Overall delivery: 23%** — 42.5 of 182.45 weighted units accepted; blocked on owner or external action: 2% (4).

The figure is computed by `node scripts/programme-ledger.mjs --summary` from [`acceptance-ledger.json`](acceptance-ledger.json). The method is in [README.md](README.md) and the unit list in [LEDGER.md](LEDGER.md).

## What changed since checkpoint 6

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

Remaining:

1. **The first GitHub release of the engine (G4).** A published GitHub release on `zodiacs-org/engine` makes Zenodo mint a DOI, and a DOI is permanent. With the owner's authorization, the first release is 0.1.1-rc.15, tagged at its merge commit, with its CHANGELOG entry as the notes.
2. **JSR (P3.1c).** A publish workflow using GitHub's OIDC token is to be added to the engine. Its first run needs the owner's authorization.
3. **Search and analytics baselines (P0.7b).** Add Bing's export when it is ready, then either attach `zodiacs-org/analytics-baselines` read-only to this work, or compute the aggregates on the owner's side. Only aggregates would be committed, to that private repository.
4. **Before the calendar feeds' release (P1.15).** Add one more SDK rule the same way: `zodiacs-calendar-feed-write`, 3 requests per 60 seconds, counted by IP, for creating and removing feeds. At most 3 a minute from one address makes at most 183 an hour, against the 500 all visitors share. Confirm in the project's settings that "Automatically expose System Environment Variables" is on, since the feed routes read `VERCEL_ENV`.
5. **The compute API's rule** may change once its review fixes land. Its worst case is being bounded per address, and any new number will come with its arithmetic.
6. **Microsoft Copilot**, only if the monthly panel (A8) and the assistant benchmark (B4.b) are to cover five assistants: a free account for admin@zodiacs.org.

Later, once the site has rebuilt the MCP server on the published engine: the same manual first upload for `@zodiacs/mcp-server`, from its verified archive, since npm sets up a trusted publisher only for a package that exists.

## Identities verified at this checkpoint

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

## In progress

- **Full IAU 2000B nutation**, on branch `feature-nutation` for rc.16. Against ERFA over 1800–2200, the nutation's share of every longitude falls from 0.252″ to 0.0037″ at most, and the ascendant's error from 0.824″ to 0.0063″. The planets' own series still dominate their longitudes, at up to about 19″. Against Swiss over 1850–2049 the ascendant is within 0.004″. The Koch ladder's worst case falls from 3.73″ to 0.035″ (F-33, P2.A.house.koch).
- **The hosted compute API** (P3.3), on branch `compute-api`: six POST endpoints, a privacy negative-control test, budgets, a switch and receipts, per the decision of 2026-09-29 §5.
- **Opaque calendar feed ids** (P1.15), on branch `feed-ids`: the review's findings are fixed; the release waits for the owner's step 4.
- **rc.16's pieces**, each on its own branch: the calculation API and frames, birth-time windows, the site's techniques in the package, house extras, and rise/set with planetary hours. The Chinese solar terms are left out of rc.16, and return with a Sun that is not derived from a JPL ephemeris or when NAIF answers (DECISIONS-2026-09-30.md §1).

## Next

1. The compute API PR, then its latency and cost on production.
2. rc.16: integrate the branches onto rc.15 and review them. The units judged here also ask of a next candidate: an export for the time basis (F-53), declinations and sect from an entry point that loads no ephemeris (P2.E.declinations, P2.E.sect), the vargas' birth-time sensitivity (P2.B.vargas) and KP's ruling planets (P2.B.kp). Its README's release paragraph should say what the registry shows (F-57).
3. The MCP adapter's next version, whose `get_capabilities`, README and `candidate.json` report the engine as published (F-57).
4. Decide whether the site's forms resolve local times through `@zodiacs/engine/geo`, which P1.01b and P1.12b need; the two already agree on 264,455 wall times.
5. The calendar feeds' release, once the owner's step 4 is done.
