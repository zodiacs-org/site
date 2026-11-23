# DE440 follow up verification

| Full `npm test` run | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Original main baseline | 9,431 | 2 | 14 |
| Draft before the follow up | 9,378 | 59 | 13 |
| Fetched main | 9,439 | 0 | 13 |
| Draft after the follow up | 9,426 | 11 | 13 |

The follow up commands used the repository Node release line. The latest main and draft full suites ran from separate directories, with the build completed before each suite. Earlier comparison attempts were discarded after Git fixture and dependency resolution problems in the local setup. The shared local Git metadata was restored. The reported comparison used a separate Git directory and a fresh package install. Each full run is reported as observed. The branch used the default npm directory for its test run, while the comparison on fetched main inherited the writable directory from its install. The branch stays on its original base. [Run counts, revisions and focused runs](followup-results.json)

The fresh `npm ci`, `npm run build`, `npm run check`, `npm run ai:check` and publication link verification passed. Browser acceptance evidence was captured against the production receipt on loopback with remote hosts blocked. The capture script and assertions stayed as they were. [Browser capture and production build receipt](../../../acceptance/phase1/screenshots/manifest.json)

The recorded browser bundle inventory measures all built scripts, styles and standalone browser panels. The report compares the follow up with the original base build and points back to the earlier inventories. [Follow up sizes](bundles-followup.tsv) [Comparisons](followup-bundle-summary.json) [Original measurements](RUNS.md)

## Original main failures

The original full run reported these tests. Both passed when run in isolation. Their assertions are unchanged.

- `scripts/home-first-paint.test.mjs`, homepage first-paint assets discovers the poster first and installs client copy after the hero
- `scripts/registry-research-pause.test.mjs`, the builders, run on a copy of the tree writes no draft, item, feed or index while paused, in build mode or --check, without reading the Daily Sky

## Failures still present in the draft

### Published connector format

- `src/ai-tools/http.test.ts`, stateless MCP HTTP boundary works with the official SDK client: list, call, widget read and close
- `src/ai-tools/schema-types.test.ts`, the tools' schemas give the values the compute API returns exactly the schemas the API documents for them
- `src/ai-tools/schema-types.test.ts`, what the tools return validates against the schemas they advertise, as a client checks it
- `src/ai-tools/sky-events.test.ts`, the sky events switch on answers with results that validate against the output schemas tools/list advertises, as a client checks them

### Sky Watch event identity

- `src/ai-tools/clear-time.test.ts`, times an assistant can read one way only Sky Watch hashes the same events as main, so its event ids do not move

### Swiss Ephemeris measurements

- `scripts/claims-bindings.test.mjs`, event times against Swiss Ephemeris were measured on the catalog the site publishes now
- `scripts/claims-bindings.test.mjs`, the Moon ingresses on the void-of-course calendar are within about 5 seconds of Swiss Ephemeris, measured on the table the site publishes
- `scripts/methodology-accuracy-claim.test.mjs`, the accuracy claim on /methodology/ gives the two clocks' difference as statistics over 2100 to 2199, from the committed run
- `scripts/methodology-accuracy-claim.test.mjs`, the every-tenth-day comparison, 1800 to 2199 was measured on the engine the site runs, with every call answered from the Swiss data files

### Named host evidence

- `scripts/mcp-artifact.test.mjs`, the recorded evidence host-drive.json was measured against the bundle that ships

### Local npm directory, reproduced on main

- `scripts/mcp-pack-permissions.test.mjs`, packs the complete npm file selection identically from private and Git checkout permissions

### Why the failures remain

- The pack permissions test failed when npm could not create its default working directory. It reproduced on fetched main with the same settings. Both isolated runs passed with fresh writable npm directories and npm offline mode. The test and package code are unchanged. [Isolated outcomes](followup-results.json)

- The rules keep the published connector definitions byte identical. The live reply identifies DE440 truthfully, which the published tool formats reject. The SDK validation and comparison assertions are unchanged. [Repository release rule](../../../../AGENTS.md)

- Sky Watch includes the exact calculated event time in the ID. The original continuity test still catches the different ID. [Sky Watch worker](../../../../src/ai-tools/watch/worker.ts)

- The catalog, void of course, multiyear and clock comparisons need fresh Swiss Ephemeris evidence. The first needed official file returned HTTP 403 at the URL below. The request stopped there.

https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1

- The named host evidence requires access to the approved host for a fresh run against the new adapter. The recorded hash was left intact. [Artifact evidence check](../../../../scripts/mcp-artifact.test.mjs)

The existing published NASA observations and fixture values were kept. The event link generator emits only current engine timestamps and their corresponding archived keys. The follow up made no Horizons request. [Numerical evidence](followup-numerics.json) [Connector regression](connector-times.json)

## Tests edited in the follow up

- `scripts/build-moon-distances.test.mjs` adds exact DE440 root checks to “covers every new and full Moon in sky.json, at the catalog instant.” The two distance cases, “matches the committed JPL Horizons (DE441) distances within 2 km” and “stays within 4 km of JPL DE421 at every lunation, and its apsides within 4 km and 5 minutes,” replay the exact earlier clock used to choose the reference samples. It keeps the order, Moon phase and UTC day checks and all the original distance and apsis limits. [Numerical evidence](followup-numerics.json)
- `scripts/claims-bindings.test.mjs` runs “narrow the birthplace about five times with one solar return image, as the privacy page says” in the same astronomy engine mode as the browser. “Is the largest residual of the reference values the browser engine test uses” measures the earlier Horizons figure in that mode too. Both tests keep their original fixtures and bounds.
- `src/ai-tools/accounts/flag-off.test.ts`, `src/ai-tools/numerology.test.ts`, `src/ai-tools/sky-events.test.ts`, and `src/ai-tools/year-score.test.ts` allow only the measured DE440 engine version, source and conventions to differ in the prior capability response fixtures. The assertions compare the structured response and its text representation. All other captured response bytes stay pinned. [DE440 capability evidence](de440-receipt-conventions.json)
- `src/lib/events/catalog.test.ts`, “maps every monthly lunation, station, and slow-pair aspect into the unified facts,” checks the exact DE440 catalog row against its published event identity, reference time and source. The page address and publication receipt date keep their existing values. [Event link evidence](followup-numerics.json)
- `src/lib/nasa-event-times-2027.test.ts`, “lists every 2027 full moon and eclipse, and each shadow edge of the 2027 Mercury and Mars retrogrades,” matches the same archived Moon rows to the current catalog keys and requires one to one correspondence. It preserves the original reference instants. [Event link evidence](followup-numerics.json)
- `tests/api/mcp-warm-up.test.ts` keeps both cases, “answers initialize and tools/list inside the instance without reaching the network” and “resolves, without throwing, while the server is switched off.” It checks the same handler with Node loading the shipped runtime directly. The request status codes, zero network calls and original time limit still apply.
- `tests/benchmarks/sky-benchmark.test.ts`, the generator and archived response comparison, replays only the immutable v0 response comparison with astronomy engine. The current engine still checks the benchmark answers and sampled search cases, with the archival files and numerical tolerance intact. [Published benchmark source](../../../../public/developers/sky-benchmark/v0/)
- `tests/sky-events-references.test.ts` changes the Sun and slow planet sign edge cases. Both retain every original Horizons ceiling and check that the returned instant also lies on the DE440 sign edge using the installed release's smaller bound. [Numerical evidence](followup-numerics.json)

## Every failure from the previous branch run

The result beside each original test comes from the follow up full run. [Raw suite counts and original test titles](followup-results.json).

### Published event identity and times

The generated catalogs moved to new clock values. The site now links each current engine key to the same published observation. Existing reference values, page addresses and approved publication receipts are preserved.

- Passes, `scripts/claims-bindings.test.mjs`, event times against Swiss Ephemeris print the planets' station, sign change and alignment times from NASA JPL, as the events pages say
- Passes, `scripts/event-shorts.test.ts`, the sky event short videos prints NASA's station time for a retrograde, as its page does
- Passes, `src/lib/horoscope-page-data.test.ts`, horoscope page sky strip lists an event on the UTC day of NASA’s instant when NASA moves it across midnight
- Passes, `src/lib/horoscope-page-data.test.ts`, horoscope page sky strip leaves out of “Also in this sky” the events the sky rows show, and keeps the rest
- Passes, `src/lib/nasa-event-times-2027.test.ts`, the 2027 event pages print NASA’s instants lists every 2027 full moon and eclipse, and each shadow edge of the 2027 Mercury and Mars retrogrades
- Passes, `src/lib/nasa-event-times-2027.test.ts`, the 2027 event pages print NASA’s instants prints, on each style-guide page, the minute Horizons gives
- Passes, `src/lib/nasa-instants.test.ts`, every planet event the pages print has its NASA instant in the monthly catalogs
- Passes, `src/lib/nasa-instants.test.ts`, every planet event the pages print has its NASA instant in the sign windows of ingresses.json, inside its horizons
- Passes, `src/lib/nasa-instants.test.ts`, every planet event the pages print has its NASA instant in sky.json's retrograde windows, whose stations never change UTC day
- Passes, `src/lib/nasa-instants.test.ts`, every planet event the pages print has its NASA instant in the event pages' publication receipt
- Passes, `src/lib/nasa-instants.test.ts`, every planet event the pages print has its NASA instant in the horoscope program's dated events
- Passes, `src/lib/nasa-instants.test.ts`, the helpers refine a month's planet events and keep its lunations and the Sun
- Passes, `src/lib/nasa-instants.test.ts`, the helpers move both edges of a sign window and keep the clipped ones
- Passes, `src/lib/nasa-instants.test.ts`, the helpers move retrograde stations and leave a window clipped at the table's start
- Passes, `src/lib/sky-calendar-feed.test.ts`, the website sky calendar feed starts and ends each retrograde window at NASA JPL Horizons station instants
- Passes, `src/lib/today-sky.test.ts`, Sky today facts links every published event page in its window, on any edition date
- Passes, `src/lib/events/catalog.test.ts`, events catalog , derivation agreement maps every monthly lunation, station, and slow-pair aspect into the unified facts
- Passes, `src/lib/events/year-format.test.ts`, the year-page format on the style-guide event pages puts every instant a page prints on five clocks
- Passes, `src/lib/events/year-format.test.ts`, the year-page format on the style-guide event pages says the times are NASA’s on every page, because every page prints NASA’s instant
- Passes, `src/lib/events/year-format.test.ts`, the year-page format on the style-guide event pages prints only clock times and dates solved on Horizons

### Numerical comparisons and historical fixtures

The lunar reference keeps its original sample times and distance gates. The sign change tests retain the original independent ceilings and also test the returned DE440 roots. The browser and immutable benchmark are replayed with astronomy engine; the current connector checks still run on DE440.

- Passes, `scripts/build-moon-distances.test.mjs`, moon distances matches the committed JPL Horizons (DE441) distances within 2 km
- Passes, `scripts/build-moon-distances.test.mjs`, moon distances stays within 4 km of JPL DE421 at every lunation, and its apsides within 4 km and 5 minutes
- Passes, `scripts/claims-bindings.test.mjs`, images of one birth shared together narrow the birthplace about five times with one solar return image, as the privacy page says
- Passes, `scripts/claims-bindings.test.mjs`, the NASA JPL Horizons figure is the largest residual of the reference values the engine test uses
- Passes, `tests/sky-events-references.test.ts`, new and full Moons and the Sun's sign changes against JPL Horizons puts the Sun on the sign's edge, within the engine's 3 arcseconds of Horizons, at each sign change it lists
- Passes, `tests/sky-events-references.test.ts`, stations and the slow planets' sign changes against JPL Horizons puts each planet on the sign's edge, within the engine's own bound against Horizons, at the sign changes in the ingress table
- Passes, `tests/benchmarks/sky-benchmark.test.ts`, the sky-fact benchmark, v0 is what the generator draws, the questions and key byte for byte and check_sky_fact's answers and facts, and with another engine the generator refuses to draw it again

### Public accuracy wording and claims ledger

Historical figures now identify which calculation produced them. The ledger binds the updated claims to the installed release, its receipt and the original reference tests.

- Passes, `scripts/claims-bindings.test.mjs`, how event times are checked, on the methodology page gives the Neptune example from the NASA table and the engine instant it replaced
- Passes, `scripts/claims-bindings.test.mjs`, how event times are checked, on the methodology page bounds the Sun's sign changes by the measured maxima, each with its range
- Passes, `scripts/claims-bindings.test.mjs`, how event times are checked, on the methodology page bounds the Moon's event times by the 2026 to 2030 sample and says the pages print the minute
- Passes, `scripts/claims-ledger.test.mjs`, claims ledger R1 lists every sentence the extractor selects
- Passes, `scripts/claims-ledger.test.mjs`, claims ledger R2 finds every listed sentence in its file, still selected
- Passes, `scripts/claims-ledger.test.mjs`, claims ledger R3 resolves every claim's evidence
- Passes, `scripts/claims-ledger.test.mjs`, claims ledger R4 finds every binding in its code or data
- Passes, `scripts/claims-ledger.test.mjs`, claims ledger R7 matches the conventions and coverage the engine's receipt states

### Connector capability evidence

The DE440 capability fields come from the recorded release receipt. Both encodings are tested, with the original protocol and account bytes held exactly.

- Passes, `src/ai-tools/numerology.test.ts`, the numerology switch off leaves every scenario's initialize, tools/list, resources/list, get_capabilities and account routes byte for byte as main answers them
- Passes, `src/ai-tools/sky-events.test.ts`, the sky events switch off leaves every scenario's initialize, tools/list, resources/list, get_capabilities and account routes byte for byte as main answers them
- Passes, `src/ai-tools/year-score.test.ts`, the Year Ahead Score switch off leaves tools/list and get_capabilities byte for byte as main answers them, and refuses the tool as unknown
- Passes, `src/ai-tools/accounts/flag-off.test.ts`, the account switch off leaves initialize, tools/list, resources/list and every account route byte-for-byte as the 0.5.0 server answers them

### Published connector schema

The frozen tool definitions allow only astronomy engine in affected fields. DE440 replies correctly identify their actual source. Strict validation and the API schema comparison still fail until the owner chooses a rollout.

- Still fails, `src/ai-tools/http.test.ts`, stateless MCP HTTP boundary works with the official SDK client: list, call, widget read and close
- Still fails, `src/ai-tools/schema-types.test.ts`, the tools' schemas give the values the compute API returns exactly the schemas the API documents for them
- Still fails, `src/ai-tools/schema-types.test.ts`, what the tools return validates against the schemas they advertise, as a client checks it
- Still fails, `src/ai-tools/sky-events.test.ts`, the sky events switch on answers with results that validate against the output schemas tools/list advertises, as a client checks them

### Sky Watch event identity

The identifier hashes the query start and the entire event, including its instant. New instants change the identifier. The continuity test stays visible pending the owner decision.

- Still fails, `src/ai-tools/clear-time.test.ts`, times an assistant can read one way only Sky Watch hashes the same events as main, so its event ids do not move

### Independent Swiss Ephemeris measurement

The original measurement belongs to an earlier engine or catalog. A new measurement needs the official data file. Its request returned HTTP 403 and stopped.

- Still fails, `scripts/claims-bindings.test.mjs`, event times against Swiss Ephemeris were measured on the catalog the site publishes now
- Still fails, `scripts/claims-bindings.test.mjs`, the Moon ingresses on the void-of-course calendar are within about 5 seconds of Swiss Ephemeris, measured on the table the site publishes
- Still fails, `scripts/methodology-accuracy-claim.test.mjs`, the accuracy claim on /methodology/ gives the two clocks' difference as statistics over 2100,2199, from the committed run
- Still fails, `scripts/methodology-accuracy-claim.test.mjs`, the every-tenth-day comparison, 1800 to 2199 was measured on the engine the site runs, with every call answered from the Swiss data files

### Named host evidence

The packaged local adapter changed in the first migration. The recorded run names an older artifact. Fresh evidence requires named host access and credentials, so the existing evidence check remains in place.

- Still fails, `scripts/mcp-artifact.test.mjs`, the recorded evidence host-drive.json was measured against the bundle that ships

### Built pages and browser evidence

The checks use the completed production build. They cover the browser locale payload, the public controls and the acceptance capture receipt.

- Passes, `scripts/phase1-acceptance-evidence.test.mjs`, Phase 1 durable acceptance evidence contains exact 360px and 1280px captures for every new template
- Passes, `tests/thesis-contract.test.mjs`, thesis feedback simplification contract exposes the committed measured chart without scripts or opening a drawer
- Passes, `src/lib/i18n/ui/build-audit.test.ts`, built client UI payloads installs one locale catalog before every island that uses shared UI copy

### Previously fixed values or full run conditions

The first migration updated the public Almanac facts and preserved the browser scene comparisons. Test output distinguishes passing reruns from any checks that still hit their original time limit.

- Passes, `scripts/registry-outlook.test.mjs`, Registry symbolic outlook builds reproducible daily and weekly editions from committed astronomy facts
- Passes, `scripts/sitemap-rendered-changes.test.mjs`, a pull request that rolls the daily edition the plan step accepts only an exact, base-pinned allowance (existing: false)
- Passes, `scripts/sitemap-rendered-changes.test.mjs`, a pull request that rolls the daily edition the plan step accepts only an exact, base-pinned allowance (existing: true)
- Passes, `src/data/almanac.test.ts`, Almanac launch corpus pins the cited August dates and degrees to the committed calculation
- Passes, `src/lib/zodiac-dates.test.ts`, living correspondence chart data derives the current and next publication years from the committed receipt
- Passes, `tests/api/mcp-warm-up.test.ts`, the /mcp warm-up answers initialize and tools/list inside the instance without reaching the network
- Passes, `src/lib/scene/scene.test.ts`, buildSceneModel parity matches the committed Kahlo scene snapshot
