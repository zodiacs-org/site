# WebMCP tools on every calculator page (A2), 2026-10-15

A2 (Track A, weight 1.5) asks for a WebMCP tool on every calculator in every
released locale. Its gate: "each calculator registers its tool when
modelContext exists". The brief adds that each tool page registers its own
tool, "so agents in the browser operate the page through typed tools instead of
scraping it".

## The calculators

A calculator here is a page whose own code computes a result from what a
person types: a birth, a date or a name. Sixteen pages do.

Each registers one tool when the browser or an extension provides
`modelContext`. It does so in every locale the page is built in: the released
locales (es, pt, fr, it) and the Russian preview wherever that is built.
English pages also register `zodiacs.search`, as before.

Three calculators are also embedded in other pages, and those pages register
the same tool (Codex's first review of #772 found them):

- ChartCalculator, in rising mode, in each rising sign's profile
  (`/rising-sign/aries/` and the other eleven), in English and the released
  locales: `zodiacs.rising_sign`.
- SynastryCalculator on each of the 78 compatibility pairs
  (`/compatibility/aries-taurus/` and so on), in English and the released
  locales: `zodiacs.compatibility`.
- NumerologyCalculator on each Life Path page (`/numerology/life-path/7/` and
  the other eleven), in English: `zodiacs.numerology`.

With them, 543 pages register a calculator tool: the 81 calculator pages and
the 462 that embed one. Each finds its tool from every address the host serves
as the page: Vercel serves `/birth-chart/index.html` and `/birth%2Dchart/` as
`/birth-chart/`, and a preview serves `/birth-chart` as well, while the page
reads its address as it was opened (Codex's fifth review found the slashless
one).

| Tool | Page | Built in | The page's code the tool runs |
| --- | --- | --- | --- |
| `zodiacs.birth_chart` | `/birth-chart/` | en es pt fr it ru | ChartCalculator's `runChart`, with the chart its calculation receipt carries |
| `zodiacs.moon_sign` | `/moon-sign/` | en es pt fr it ru | `runChart`, Moon mode |
| `zodiacs.rising_sign` | `/rising-sign/` | en es pt fr it ru | `runChart`, rising mode |
| `zodiacs.big_three` | `/big-three/` | en es pt fr it ru | BigThreeQuick's `compute` |
| `zodiacs.compatibility` | `/compatibility/` | en es pt fr it ru | SynastryCalculator's `resolveForm`, then `summarizePair` |
| `zodiacs.transits` | `/transits/` | en es pt fr it ru | TransitTracker's `natalFromForm`, then the ring's contacts within 3° |
| `zodiacs.saturn_return` | `/saturn-return/` | en es pt fr it ru | SaturnReturnCalculator's `compute`, then `saturnReturns` |
| `zodiacs.solar_return` | `/solar-return/` | en | the island's `computeSolarReturn` module |
| `zodiacs.lunar_return` | `/lunar-return/` | en | the island's `computeLunarReturn` module |
| `zodiacs.numerology` | `/numerology/` | en | `numerologyProfile`, with the page's fallback for an empty name |
| `zodiacs.moon_phase` | `/moon-phase/` | en es pt fr it ru | MoonPhaseTool's `lookup` |
| `zodiacs.baby_zodiac` | `/baby-zodiac/` | en es pt fr it ru | BabyZodiac's `compute` |
| `zodiacs.chart_twins` | `/chart-twins/` | en es pt fr it ru | `calculateEntry`, `twinSigns`, `matchTwins` |
| `zodiacs.group_chart` | `/group-charts/` | en es pt fr it ru | `calculateEntry`, `groupReading` |
| `zodiacs.chart_pdf` | `/astrologer-kit/` | en es pt fr it ru | ReturnPersonal (Chart PDF): the chart its PDF prints |
| `zodiacs.year_wrapped` | `/your-sky-wrapped/` | en es pt fr it ru | ReturnPersonal (wrapped) and its worker's year scan |

These pages are not calculators, and register no tool of their own:

- **`/birth-chart/someone-else/`** computes nothing itself. It hands the
  details to `/birth-chart/` or `/compatibility/`, whose tools answer. It
  registers Search alone.
- **`/today/`** shows the day's published reading for the chart saved in this
  browser, or for a Sun sign chosen from a list. It calculates nothing from
  typed input.
- **Tables made at build time** take no input: the void-of-course Moon, the
  full-moon calendar, eclipses, retrogrades, Mercury retrograde, the birthday
  pages, the sky calendar, events and the chart of the day.
- **`/compatibility/invite/`** makes an invitation; it calculates nothing.

## How a tool works

- **Descriptors.** `/assets/webmcp-register.js` holds the descriptors and
  Search (5.1 KB gzip). A page imports it only when `modelContext` exists.
- **Calculations.** `/assets/webmcp-calculators.js` holds the calculations
  (121.1 KB gzip, under a 512 KB budget). It loads on the first call to a
  calculator tool, never before.
- **Input.** Each tool reads its input strictly, as its JSON Schema states it.
  Places are coordinates and an IANA time zone. Birth dates run from
  1800-01-01 through 2199-12-31, as the pages' date fields do. Instants run
  through the same span in Universal Time; a lunar return's reference runs
  from 1800-01-02 through 2199-11-21, so the 40-day scan for the return stays
  inside it.
- **Answers.** The answer is the result the page computes, in a stable shape:
  longitudes cut to four decimals (a degree just short of a sign's end stays
  in that sign), with the page's own label, such as `24°11′ Gemini`.
- **Refusals.** A refusal is `{ ok: false, error: { code, message } }`, with a
  fixed sentence that repeats nothing it was given. The codes are
  `INVALID_INPUT`, `TIME_NEEDS_PLACE`, `LOCAL_DATE_REFERENCE`, `CLOCK_CHANGE`,
  `UNSUPPORTED_NAME`, `DUPLICATE_PERSON`, `OUTSIDE_REFERENCE_SPAN`,
  `REFERENCE_BEFORE_BIRTH`, `DIRECTORY_UNAVAILABLE`, `CALCULATION_FAILED` and
  `UNKNOWN_TOOL`. A birth on 1800-01-01 east of Greenwich or on 2199-12-31
  west of it falls outside 1800-2199 in Universal Time: the birth chart
  answers with the flag `outside-reference-span`, as its page does, and the
  calculations that cannot run there (Chart PDF, Your sky wrapped, a lunar
  return, a solar return the span cuts off) refuse with
  `OUTSIDE_REFERENCE_SPAN`. A lunar return asked for before the birth refuses
  with `REFERENCE_BEFORE_BIRTH`.
- **Nothing is sent.** Everything is computed in the browser. Chart twins reads
  the public directory it matches against from `/data/chart-twins.json`
  (names and signs). The page's own list now comes from the same module.
  The site's service worker fetches that file from the network and keeps
  its copy only for offline use: the file can change while the worker's
  cache version stands, which covers the hashed bundles and the city shards
  alone, and those are the only data it serves cache-first (Codex's sixth
  review; `scripts/build-service-worker.test.mjs`).

## Evidence

- **Each tool computes what its page computes.** Tests in
  `src/lib/webmcp/calculators/*.test.ts` run each island's own code beside its
  tool and compare the results. The code is taken from the island's source
  file, as `ChartCalculator.reference-sun.test.ts` and
  `MoonPhaseTool.reference.test.ts` already do.
  - The synthetic births cover a timed and an untimed birth, local mean time
    before standard time, a clock-change gap and fold, the southern
    hemisphere, the far north (the Placidus fallback), a day the clock
    skipped and the range's last day.
  - On the day the clock skipped, page and tool both refuse an untimed
    chart, because local noon is not in that date.
  - All 250 tests under `src/lib/webmcp/` pass.
- **Schemas and readers agree.** `calculator-tools.test.ts` compiles each
  schema with Ajv. A valid input passes both the schema and the tool; each
  invalid one fails both. It also checks that each refusal names the problem
  without echoing the input. The date
  fields state the calendar as their readers do, leap days included: the
  test checks every date from 1799 through 2200, the due dates' range, and
  instants across edge years and clock times against the readers, and they
  agree on each. Codex's second review found that the patterns had bounded
  month and day apart, so `1990-02-30` passed a schema whose reader refused
  it. Instants run from 00:00 through 23:59, and `24:00`, which `Date` would
  roll into the next day, is refused. Text fields count their length in code
  points, as JSON Schema's `maxLength` does, so a group member's name of 24
  emoji fits both. Codex's fourth review found the tool counting UTF-16 code
  units, which refused a name the schema accepted. The test lists every
  bounded text field in the schemas and checks the free-text ones at their
  limits.
- **At the extremes.** `calculators/edges.test.ts` runs every tool at the
  extremes its schema accepts: the first and last dates, at the start and end
  of the day, east and west of Greenwich, and the first and last instants.
  Each answers or refuses with a code that names the reason; none fails with
  `CALCULATION_FAILED`. With the code before Codex's third review, 26 of those
  calls failed that way, among them a lunar return asked for in 2200, which
  the schema then accepted.
- **check-dist.** It checks that every calculator page in every locale
  imports the registration with `registerWebMcpPage`. It checks that the
  bundles carry every tool and that `/data/chart-twins.json` lists names and
  signs only. It also reads every built page: a page that renders a
  calculator island must register that calculator's tool, as the shipped
  bundle's own lookup finds it, and a page that registers a calculator tool
  must render its calculator. On a build from before Codex's review it names
  the 462 pages that embed a calculator and register no tool.
- **The WebMCP drive** (`tests/webmcp-drive.mjs`, local build of `HEAD`)
  visits 543 pages with the MCP-B 4.0.0 polyfill: the 81 calculator pages
  and the 462 that embed one. On a build from before Codex's review it stops
  at `/rising-sign/aries/`, whose tool never registers. On each page it
  checks:
  - the tools registered;
  - that the calculations do not load before the first call;
  - one answer;
  - a refusal by the schema;
  - a refusal by the tool itself, where the tool checks more than its schema
    states: an unknown time zone, a clock change or a name in another script.

  On `/birth-chart/` it also opens the page on the same birth through a
  chart link. The page shows `24°11′ Gemini`, `16°11′ Pisces` and
  `11°14′ Libra`, and the tool says the same. Pages without a calculator
  outside English, the wings, and `/birth-chart/someone-else/` register
  nothing new. It also opens seven other addresses of calculator pages, with
  `index.html`, with a character percent-encoded and without the trailing
  slash, in English and three locales, and checks each as above. On a build
  from before Codex's fifth review it stops at `/birth-chart/index.html`,
  whose tool never registers. `calculator-tools.test.ts` checks the same
  three forms for every route in every locale.
- **Native Chrome.** Chrome 155 exposes `modelContext` under its WebMCP flags
  but not `modelContextTesting`, so the native pass cannot enumerate or call
  tools. It is reported as unavailable, as in the pilot.

## Phase 1 captures

`src/layouts/Base.astro` and `src/lib` are in the Phase 1 capture digest, so
CI took the 18 captures again.

- **Committed captures.** Browser Evidence run 39024415260 took them on
  `753ec8cc`, this branch with main `013b93d5` merged in, with Chromium
  149.0.7827.55 at 2026-10-17T10:22:36Z, for the 2026-10-17 edition, bound to
  template source digest `86e20838…`, the digest the local build's Phase 1
  receipt gives. Its build, acceptance captures, receipt, visual comparison,
  Lighthouse and explorer drive passed
  ([browser-evidence-provenance.json](browser-evidence-provenance.json) is the
  run's own record). Its 18 images are identical, pixel for pixel, to the ones
  run 39001094966 took on `48592f4e` and run 39016692892 on `bd622793` for the
  same edition, before and between Codex's later reviews of `src/lib`; only
  the digest and the time changed.
- **Against main's captures**, which the same Chromium took for the
  2026-10-16 edition: the monthly, weekly and yearly pages are identical,
  pixel for pixel. The pages that show the day's readings changed with the
  edition. The daily page holds 76 characters less text and is 16 px
  shorter; the love page holds 4 more and the horoscope hub 1 more; today's,
  tomorrow's and the career pages keep their layout. Each differs in 0.07% to
  3.20% of its pixels. None of these pages is a calculator, and none
  registers a tool.

## In production

#772 merged as `069ef13e` at 2026-10-17T13:08:29Z. zodiacs.org serves it from
`dpl_64gyTAnwkNLdFsEUnD9s3WoVkmNB`, built from the merge and ready at
13:12:17Z ([alias-at-merge.json](production/alias-at-merge.json)).

- **The drive against zodiacs.org**
  ([drive-production.json](production/drive-production.json)):
  `node tests/webmcp-drive.mjs --base-url https://zodiacs.org`, from
  13:14:57Z to 13:32:05Z, with the MCP-B 4.0.0 polyfill. The alias pointed at
  the same deployment before and after it.
  - All 543 pages registered their tools: the 81 calculator pages and the 462
    that embed one. On each, the calculations loaded only on the first call,
    the tool answered, and it refused an input its schema refuses. Where the
    tool checks more than its schema states, it also refused an input it
    cannot read, with its own code: on every page but the six of the baby
    zodiac, whose schema states all it checks.
  - The seven other addresses found their tools too. Production served the
    `index.html` and percent-encoded ones as typed, and redirected the two
    without a trailing slash to the page.
  - On `/birth-chart/` the page and the tool gave the same chart
    (`24°11′ Gemini`, `16°11′ Pisces`, `11°14′ Libra`).
  - The home page registered Search alone. The pages without a calculator
    outside English, the wings and `/birth-chart/someone-else/` registered
    nothing new.
- **Before the merge** ([control-before.json](production/control-before.json)):
  the same drive against zodiacs.org at 09:14:55Z stopped at once, because
  the page loaded no bundle with the calculator tools. That was
  `dpl_5t9bGxgd9bEVHzcN3v3yVsL3Kx74`, built from `a0b56074`
  ([alias-before.json](production/alias-before.json)).
- **Main's Site Check** passed on the merge (run 39035340598).
