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
  Search (4.6 KB gzip). A page imports it only when `modelContext` exists.
- **Calculations.** `/assets/webmcp-calculators.js` holds the calculations
  (120.6 KB gzip, under a 512 KB budget). It loads on the first call to a
  calculator tool, never before.
- **Input.** Each tool reads its input strictly, as its JSON Schema states it.
  Places are coordinates and an IANA time zone. Birth dates run from
  1800-01-01 through 2199-12-31, as the pages' date fields do.
- **Answers.** The answer is the result the page computes, in a stable shape:
  longitudes cut to four decimals (a degree just short of a sign's end stays
  in that sign), with the page's own label, such as `24°11′ Gemini`.
- **Refusals.** A refusal is `{ ok: false, error: { code, message } }`, with a
  fixed sentence that repeats nothing it was given. The codes are
  `INVALID_INPUT`, `TIME_NEEDS_PLACE`, `LOCAL_DATE_REFERENCE`, `CLOCK_CHANGE`,
  `UNSUPPORTED_NAME`, `DUPLICATE_PERSON`, `DIRECTORY_UNAVAILABLE`,
  `CALCULATION_FAILED` and `UNKNOWN_TOOL`.
- **Nothing is sent.** Everything is computed in the browser. Chart twins reads
  the public directory it matches against from `/data/chart-twins.json`
  (names and signs). The page's own list now comes from the same module.

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
  - All 213 tests pass.
- **Schemas and readers agree.** `calculator-tools.test.ts` compiles each
  schema with Ajv. A valid input passes both the schema and the tool; each
  invalid one fails both. It also checks that each refusal names the problem
  without echoing the input.
- **check-dist.** It checks that every calculator page in every locale
  imports the registration with `registerWebMcpPage`. It checks that the
  bundles carry every tool and that `/data/chart-twins.json` lists names and
  signs only.
- **The WebMCP drive** (`tests/webmcp-drive.mjs`, local build of `HEAD`)
  visits 81 calculator pages with the MCP-B 4.0.0 polyfill. On each it
  checks:
  - the tools registered;
  - that the calculations do not load before the first call;
  - one answer;
  - a refusal by the schema;
  - a refusal by the tool itself.

  On `/birth-chart/` it also opens the page on the same birth through a
  chart link. The page shows `24°11′ Gemini`, `16°11′ Pisces` and
  `11°14′ Libra`, and the tool says the same. Pages without a calculator
  outside English, the wings, and `/birth-chart/someone-else/` register
  nothing new.
- **Native Chrome.** Chrome 155 exposes `modelContext` under its WebMCP flags
  but not `modelContextTesting`, so the native pass cannot enumerate or call
  tools. It is reported as unavailable, as in the pilot.

## In production

To be recorded after the merge.
