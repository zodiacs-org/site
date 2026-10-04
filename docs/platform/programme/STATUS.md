# Programme status

Checkpoint 14, 2026-10-04: engine rc.16's capability gates judged, the
co-ascendants measured end to end and the house systems rerun on rc.16, against
main `67aa32d8b3f112a08aebe5f7b52db9a331ecbaf1` (#639).

**Overall delivery: 30%** (29.570% to three decimals) — 53.95 of 182.45
weighted units accepted; blocked 2% (3), or 1.644%. Up 6.95 from checkpoint 13.
Gates, weights and the denominator are unchanged.
[Gate record](../evidence/rc16-gates-2026-10-04/README.md).

- **Accepted (6.95).**
  - B2.a (4), the birth-time window partition: the engine's preregistered
    1,000-window check, rerun on rc.16's build, matched all 24,188 one-second
    transitions and missed none.
  - P2.D.frames (2): the uniform API's twelve frame-transform checks pass
    against an independent pyerfa chain, and the engine's 25 round-trip
    fixtures replay exactly on the released archive.
  - P2.A.houses.co-ascendants (0.25): the engine's evidence covered only
    Swiss's given-inputs half. Measured here end to end, after a
    preregistration, they are within 0.021″ of Swiss on the ladder
    ([record](../evidence/co-ascendants-2026-10-04/README.md)).
  - P2.A.house.koch (0.2): failed on rc.9 at 3.73″, where Koch magnified the
    two programs' small difference in sidereal time near the polar circle.
    Rerun on rc.16 with all thirteen systems, after a preregistration, it is
    within 0.035″ ([record](../evidence/houses-2026-10-04/README.md)).
  - P2.E.returns (0.5), again: production `dpl_Av6FTWYa2iFZzT2WZuWeCsRDg2oV`
    serves #639, and the year ahead on `/profile/` takes its solar returns from
    the package (F-67).
- **Partial.** P3.2 (3): `calc()` types the sidereal zodiac but refuses it,
  while Phase 2 ships it in `@zodiacs/engine/vedic`. Planetary returns (0.75):
  complete verdicts and agreement with JPL Horizons, but no cited worked
  example beyond the Sun.
- **Failed as worded.** House positions (0.75): Porphyry and Topocentric over
  0.01″. Cusp speeds (0.75): five systems against Swiss's speeds, though they
  agree with the engine's own derivatives. Rise and set (1.5): 192 events of
  Uranus over 5 s, and 2 events over USNO's 30 s. Planetary hours (0.75): they
  divide the rise and set times exactly, and those fail.
- **Held.** The other twelve house systems pass both halves on rc.16, the
  engine the site and the MCP adapter run.
- Actual command: `node scripts/programme-ledger.mjs --summary` →
  `Overall delivery: 30% (53.95 of 182.45); blocked 2% (3)`.
- Next: the engine work behind the partial and failed units: the sidereal
  zodiac in `calc()` (P3.2), rise and set at grazing crossings and at USNO's
  margin (with planetary hours), and house positions for Porphyry and
  Topocentric. They need a candidate after rc.16, whose publication needs the
  owner's approval.

## Earlier checkpoints

Checkpoint 13, 2026-10-04: an independent audit of checkpoints 9 to 12, and its
corrections, against main `9d7dd31daa673fd1a21675ce359f9f4a69eac1cd` (#637).

**Overall delivery: 26%** (25.760% to three decimals) — 47 of 182.45 weighted
units accepted; blocked 2% (3), or 1.644%. Down 0.5 from checkpoint 12: one of
its acceptances was premature (F-67). Gates, weights and the denominator are
unchanged. [Audit record](../evidence/programme-audit-2026-10-04/README.md).

- **Withdrawn (F-67).** P2.E.returns requires the site's own return search to
  be gone, but the year ahead on `/profile/` still found solar returns with
  the site's own Sun crossing scan. This change moves it to the package's
  search: on 1,000 synthetic windows it finds the same returns, none more than
  3 ms apart. The unit is validated, not accepted, until production serves it.
- **What held.** The other six acceptances of checkpoint 12, their CI runs,
  the production deployment, rc.16's identity on npm and in production, the
  rerun adoption parity, the A4 skill manifest, the API reference's
  byte-identical rebuild, and that the sky API repair changed tests only. A new
  private history check for A4, run outside every repository, found no birth
  data in the engine commits and trees published since rc.16 (`6807f632` to
  `23660f5`); it is not the missing receipt of 1 October.
- **Fixed here.** F-62: the authorship guards now catch the retired persona
  split by line breaks, entities, invisible characters or tags in any case, or
  joined or inverted, the editor link however its path and fragment are
  commonly written, and Person
  markup in JSON-LD, microdata and RDFa; they read every text file, and the
  `src/` guard is a tested script that fails closed, with one recorded
  allowance for the People template's subject. F-64: the reference's dead
  `http://LICENSING.md` link is gone, its checker resolves every link and
  accepts one off zodiacs.org only over HTTPS to a named host, and the llms
  files and the support page point at the rc.16 reference. F-65: the sky API's
  tests hold every `nextByKind` entry to the first event of its kind, eclipses
  included, and `daysAway`'s rounding is documented; no computed value
  changes.
- **Owner action (F-63).** The engine repository's description says
  "MIT-licensed" and its `.zenodo.json` says `mit`; the package is MIT AND
  CC-BY-4.0. Wording that names both licences is prepared.
- **Frontend (F-61).** One WebKit sharing-drive failure in main's post-merge
  run is preserved; one unchanged retry passed, and a handoff is prepared for
  the frontend session. No assertion was changed.
- **Records (F-66, F-68, F-69, F-70).** Dated notes correct this file's living
  sections and ledger notes that described 30 September or the package before
  rc.16, and state the Moon candidates' parity for the path actually adopted
  (3,002 of 3,005).
- Actual command: `node scripts/programme-ledger.mjs --summary` →
  `Overall delivery: 26% (47 of 182.45); blocked 2% (3)`.
- Next: once production serves this change, accept P2.E.returns again; then
  judge the nine rc.16 capability units against their own gates.

Checkpoint 12, 2026-10-04: seven published or deployed gates reconciled against
current main `b1636359d7f79351b5fb2b477a57e6dafb7c0a3c`.

**Overall delivery: 26%** (26.035% to three decimals) — 47.5 of 182.45 weighted
units accepted; blocked 2% (3), or 1.644%. The denominator, weights and calculator
are unchanged. This adds exactly 4.0, without importing the missing October 2
private acceptance checkpoint. [Evidence and limits](../evidence/programme-acceptance-2026-10-04/README.md)
and the [verified producer input](../evidence/programme-acceptance-2026-10-04/reconciliation.json).

- **S6 accepted, deployed (+0.5):** PR632 extended the existing persona/editor/
  Person-markup guard to served developer docs, with post-build CI and negative
  controls. It remains a bounded scanner, not a general JSON-LD semantic processor.
- **A4 accepted, merged (+0.5):** engine PR23 published the skill bundle. Three
  manifest hashes match; the producer recovered 21 successful postmerge checks.
  Only its stale 0.5 publication blocker is removed. The final private rescan
  receipt remains unavailable; no private patterns or logs are reconstructed.
- **Four rc16 adoptions accepted, deployed (+2.0):** returns, void-of-course,
  aspect patterns and Moon candidates in sharing. Package imports/removals,
  recorded parity, npm release and production source binding meet these adoption
  gates. Returns retains 50 span discrepancies; Moon retains 13 differences
  (date-form 3, skipped-date 1, before-1970 9). The main calculator still leaves
  unknown-time Moon certainty unresolved. This is not new accuracy evidence.
- **G1 accepted, deployed (+1.0):** PR635 merged as `b1636359`, with all 19 premerge
  and all 19 postmerge checks passing. READY deployment
  `dpl_4LmaXAGm8YJFF6vastJQ5WWXSTE8` serves the linked rc16 reference outside
  `/sdk/`; the producer verified live canonical, provenance and license bytes and
  neutral repository metadata. Historical SDK bytes and both MIT AND CC-BY-4.0
  obligations remain unchanged.
- The original October 2 six-request live receipt and private acceptance commit
  remain missing. Current source/provider evidence is not a reconstructed
  original receipt or a fresh computation replay. Known conformance results
  remain 267 passed, 192 failed and 41 unsupported.
- **Still unaccepted:** JSR (license issue; no retry), P3.3/F60 and cold telemetry,
  and the shelved calendar unit. No new credit for composite, dignities,
  declinations or sect. No frontend, Guide, package or runtime work is included.
- Actual command: `node scripts/programme-ledger.mjs --summary` →
  `Overall delivery: 26% (47.5 of 182.45); blocked 2% (3)`.
- Next: independently review this bounded accounting diff, publish its PR and
  run required CI before normal merge. Other historical blockers below retain
  their dated context; they are not silently treated as current accomplishments.

Checkpoint 11, 2026-10-01: warm compute timing and usage-cost evidence recovered.

**Overall delivery: 24%** (23.842% to three decimals) — 43.5 of 182.45 weighted units accepted; blocked 2% (3.5), or 1.918%. G4's independently verified release remains accepted; no new unit is accepted in this checkpoint.

- The original 120 synthetic requests now have exact request-ID matches to platform execution records. Read-only dashboard queries identify all 120 as Hot: 20 per endpoint. [Observability supplement](../evidence/compute-api-2026-10-01/observability/README.md).
- Hot execution p50/p95 milliseconds: chart 22/44, positions 25/49, houses 38/72, events 116/168, time 26/45, sky-fact 47/76. Original client latencies and the 6.2-second chart outlier remain unchanged; that chart executed in 42 ms on the platform.
- Approximate gross compute plus invocation USD per 1,000, from rounded observed CPU/GB-hour aggregates at verified iad1 Fluid rates: chart 0.00118, positions 0.00120, houses 0.00131, events 0.00445, time 0.00114, sky-fact 0.00242. These exclude Firewall, network/transfer, routing, observability, base fees, tax and credits; they are not invoices or whole-request bills.
- **P3.3 remains unaccepted:** no Cold samples were found, the general 40-request limiter's 41-success probe remains unresolved, and F59's reviewed cache cleanup has not been deployed. Required CI still has owner-managed frontend failures; this programme does not alter Guide/homepage source or tests to clear them.
- The expanded read-only start-type query found 227 API requests, all Hot, over 06:00–10:40 UTC; its broader project/path scope is separate from the exact 120-request baseline. No cold sample, cost, counter behavior or acceptance is invented.
- Historical connector/export evidence remains unchanged. Public records contain only matched synthetic observations and aggregates; private logs and dashboard authentication material are excluded.
- Actual command: `node scripts/programme-ledger.mjs --summary` → `Overall delivery: 24% (43.5 of 182.45); blocked 2% (3.5)`.

Checkpoint 10, 2026-10-01: the first tagged engine release and permanent DOI are verified.

**Overall delivery: 24%** (23.842% to three decimals) — 43.5 of 182.45 weighted units accepted; blocked: 2% (3.5), or 1.918% to three decimals. These are derived ledger weights, not a forecast.

- **G4 accepted, released:** [engine v0.1.1-rc.15](https://github.com/zodiacs-org/engine/releases/tag/v0.1.1-rc.15) points to the exact rc.15 merge commit, includes its complete changelog, and is archived under [DOI 10.5281/zenodo.23080134](https://doi.org/10.5281/zenodo.23080134). Independent verification matched all 605 archived files byte for byte. [Public evidence and reproduction](../evidence/engine-github-release-2026-10-01/README.md).
- The owner explicitly approved the release and permanent DOI. The prerelease classification and existing license qualifications are preserved. No npm package or dist-tag changes were made.
- **A4 remains unaccepted:** the locally reviewed Agent Skill bundle cannot be pushed until the prior private birth-data pattern file is supplied for the engine's mandatory history check. Its 0.5 weight is now recorded as blocked; the private patterns themselves must never be committed.
- This checkpoint changes no other acceptance state, gate, weight or denominator. Compute privacy/production telemetry, calendar rollout and rc.16 adoption continue in separate checkpoints. The prior compute checkpoint is in [PR #610](https://github.com/zodiacs-org/site/pull/610); none of its rollout or accuracy gates is accepted here.
- Actual command: `node scripts/programme-ledger.mjs --summary` → `Overall delivery: 24% (43.5 of 182.45); blocked 2% (3.5)`.

Checkpoint 9, 2026-10-01: production compute verification and private-cache audit.

**Overall delivery: 23%** — 42.5 of 182.45 weighted units accepted; blocked on owner or external action: 2% (4).

- Both owner-supplied WIP bundles passed SHA-256, byte-count and prerequisite verification in current full-history clones. All five fetched branch heads match `BUNDLES.md`; no engine WIP branch was pushed.
- Production now serves site `9cfafa3e742de943062c9174338472781724a4b5` through READY deployment `dpl_6uGzGxdgxboMZ5jeFwQMTL24demr`. All six compute endpoints returned 200 for twenty documented synthetic requests each, naming engine rc.15 and astronomy-engine 2.1.19. This verifies the deployed F-58 fix from #607.
- [Production baseline](../evidence/compute-api-2026-09-29/production-2026-10-01/README.md): client p50/p95 milliseconds were chart 93.6/129.5, positions 89.6/147.9, houses 106.2/161.3, events 182.2/238.0, time 90.1/116.9 and sky-fact 118.0/140.4. The maximum chart sample was 6220.7 ms and remains included. These are unclassified client latencies, not proven warm/cold timings or an SLA.
- Returned production logs corroborate all samples and show no application-output line or distinctive synthetic input value in the observed window. This is limited observation, not proof about every platform log.
- **F-59:** an independent local probe recovered two synthetic input UTC timestamps from the bundled ephemeris's private cache after requests ended. Existing global-name checks missed it. The server-only lifetime fix and new direct cache regression are described in [the fix evidence](../evidence/compute-api-2026-10-01/README.md). Source fix `9d6d36ad`, together with this checkpoint’s generated-context and historical-claim binding repairs, passes the full required-Node-22 suite (6,352 tests; four skipped), build, check, scope, artifact checks and the packaged-function probe. Its release is still pending. No immutable engine archive is changed.
- **F-60:** events returned ten 200s then 429 with `Retry-After: 60`; the aligned general-counter probe returned 41 200s within one minute. Its counted client identity/configuration is not visible, so the stated general 40-request limit is not verified and the production spending envelope is not established.
- **P3.3 stays unaccepted.** It is now recorded as merged/deployed rather than unmerged, but the fixed-cache release and production warm/cold and metered-cost evidence remain outstanding. The available connection exposes no start type, active CPU or billed memory; no cost was invented from network elapsed. The denominator and all accepted units stay unchanged.
- Baseline gate repairs: regenerate the assistant's stale monthly context from its source; bind the historical rc.15 browser claim to its dated rc.15 validation record rather than today's mutable screenshot manifest.
- Next: finish the cache-fix release checks, record the remaining telemetry limit, then continue the opaque calendar-feed release from `wip/feed-ids`. No new owner action is requested outside handoff §6.

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
   *Update 2026-10-04:* the OIDC publish workflow exists (engine #24 and #25, `23660f5`). With the owner's authorization, its dry run [37111251733](https://github.com/zodiacs-org/engine/actions/runs/37111251733) passed on 2026-10-03, and the publish run [37111638537](https://github.com/zodiacs-org/engine/actions/runs/37111638537) failed at its publish step. The owner's report to JSR, [jsr-io/jsr#1563](https://github.com/jsr-io/jsr/issues/1563), says JSR answered `invalidLicense` to the SPDX expression `MIT AND CC-BY-4.0`. On 2026-10-04 that issue was open, untriaged and without comments, and JSR's API listed no version of `@zodiacs/engine`. There is no retry until JSR accepts an expression that states both licences, or the owner decides on a faithful alternative. The package is never to be labelled MIT alone.
3. **Search and analytics baselines (P0.7b).** Add Bing's export when it is ready, then either attach `zodiacs-org/analytics-baselines` read-only to this work, or compute the aggregates on the owner's side. Only aggregates would be committed, to that private repository.
4. **Microsoft Copilot**, only if the monthly panel (A8) and the assistant benchmark (B4.b) are to cover five assistants: a free account for admin@zodiacs.org.

Later, once the site has rebuilt the MCP server on the published engine: the same manual first upload for `@zodiacs/mcp-server`, from its verified archive, since npm sets up a trusted publisher only for a package that exists.

## Identities verified

At checkpoint 13, 2026-10-04, before this record merged: site `main` = `9d7dd31d` (#637), served by READY production deployment `dpl_9pVLB8brkRDrtKu2cA5zLMnf6eKM`; its post-merge Site Check [37198913984](https://github.com/zodiacs-org/site/actions/runs/37198913984) passed on its second attempt after one WebKit failure in a sharing drive (F-61). Engine `main` = `23660f5` (#25). npm `@zodiacs/engine`: `latest` 0.1.1-rc.15, `next` 0.1.1-rc.16, whose registry SHA-1 `f57e312b…3afa` and SHA-512 integrity are those of the archive the site vendors, `43a72d30…15d8`, published by the trusted publisher with SLSA provenance. JSR: no version. PyPI: `zodiacs` 0.1.0a1. `@zodiacs/mcp-server` is not on npm; the site serves the MCP archive 0.1.0-rc.16, `dfc9177e…aeb9`, 89,871 bytes. The tag `v0.1.1-rc.15` points at `93ebae9`, and DOI 10.5281/zenodo.23080134 resolves.

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

*Update 2026-10-04:* that list describes 30 September. The state of the same work on 4 October:

- The compute API is deployed and the F-59 cache fix is live (`fd1ce88a`). P3.3 stays unaccepted: no Cold sample has been observed, and F-60 is open.
- The calendar feeds (`feed-ids`, then #613) are shelved: #613 was closed unmerged on 2026-10-03 after the owner's #628 retired personal calendar feeds and kept local calendar downloads. Server-side personal subscriptions are not to be revived without a new owner decision.
- The rc.16 adoption landed in #620. Void-of-course, aspect patterns and Moon candidates are accepted (checkpoint 12); returns is validated until production serves the year-ahead change of checkpoint 13 (F-67); composite waits for a lightweight entry (F-54); dignities, declinations and sect are not adopted.
- Engine rc.16 is on npm under `next`; G4 is done; the JSR publish failed on the licence expression (above); `@zodiacs/mcp-server` is not published.
- `moon-enclosure`, `feature-eclipses` and `chinese-heldback` exist only in the owner's bundles, unchanged.
- Next: accept P2.E.returns again once production serves its completed adoption; then judge the rc.16 capability units (P3.2, P2.D.frames, B2.a, house positions, co-ascendants, cusp speeds, planetary returns and hours, rise and set) against their gates, now that rc.16 is released and served.
