# Developer-query guides (S4), 2026-10-13

The brief's S4 asks for pages that answer what developers type: "astrology
API", "birth chart API", "Swiss Ephemeris alternative for JavaScript",
"ephemeris npm", "Vedic astrology API", "Python astrology library" and
"astrology MCP server", "each with a snippet that runs, an honest comparison,
and receipts". Each is now a guide in the shared catalogue
(`src/data/developer-guides.json`), served at `/developers/docs/<slug>/` with
a Markdown twin, and listed in `llms.txt`, `llms-full.txt` and the sitemap:

| Query | Guide | Its snippet |
| --- | --- | --- |
| astrology API | `astrology-api` | `POST /api/v1/events`, in JavaScript |
| birth chart API | `birth-chart-api` | `POST /api/v1/chart` from a local time, in JavaScript |
| Swiss Ephemeris alternative for JavaScript | `swiss-ephemeris-alternative-javascript` | `natalChart` with Placidus houses, in Node |
| ephemeris npm | `ephemeris-npm` | `positions`, in Node |
| Vedic astrology API | `vedic-astrology-api` | `siderealChart` and `nakshatraOf` with Lahiri, in Node |
| Python astrology library | `python-astrology-library` | `POST /api/v1/chart`, in Python's standard library |
| astrology MCP server | `astrology-mcp-server` | the official SDK client against `https://zodiacs.org/mcp` |

## Snippets that run

The guide checks, which the Developer Guides workflow runs on every change to
the catalogue, now run each new snippet as the page shows it:

- the three local ones in Node, against `@zodiacs/engine` 1.0.0 installed
  from npm, with assertions on what they compute (twelve bodies and twelve
  Placidus cusps; twelve positions; the Moon in Swati, pada 4, under Lahiri);
- the two hosted JavaScript ones with `fetch` pointed at a local fixture of
  the API's committed answer to the same documented request: the request must
  be the documented one, a 200 must print the answer's first and last lines
  as the page's code reads them, and a 429 must stop the program with its
  status;
- the Python one the same way, through `ZODIACS_COMPUTE_ORIGIN`, which the
  existing Python guide already uses;
- the MCP one with `@modelcontextprotocol/client` 2.3.1 against the hosted
  server's own handler (`src/ai-tools/http.ts`) served locally, with the
  committed horoscope window as its tests inject it: the server lists the six
  tools the page names, and `check_sky_fact` answers `false` for Mercury
  retrograde at 2026-10-12T12:00Z.

[`results-local/`](results-local/) holds this run's records: Node 22.22.2,
Deno 2.9.0, Bun 1.3.11 and Python 3.9 on macOS; the workflow pins its own
versions.

## Comparisons and their receipts

Each comparison names versions, dates and licences as their publishers state
them, and says what the other software does without ranking it:

- [`registry-facts.json`](registry-facts.json), from
  [`tools/registry-facts.mjs`](tools/registry-facts.mjs): what the npm
  registry and PyPI listed for each compared package on 2026-10-13 (latest
  version, its date, its declared licence);
- [`source-checks.json`](source-checks.json): the licence files, READMEs and
  repository status behind the facts the registries do not carry, each with
  the digest of the bytes read.

Where a registry and a project disagree, the page says so: swisseph declares
no licence on npm while its repository's licence file is the GPL, version 2;
immanuel's PyPI entry names no licence while its README gives the AGPL,
version 3 or later.

The engine's own figures are claims the ledger already holds:
`acc.jpl-gate` (14.8″ against NASA JPL Horizons), `acc.swiss-multiyear`
(2.0″ median and 22.9″ at most against Swiss Ephemeris 2.10.03 to 2026,
measured on 0.1.1-rc.17, as the page says) and
`eng.house-systems-given-swiss`. The pages use no "drop-in alternative"
wording, which the brief leaves to the owner (§10, 1).

## Not done

The Compute API has no sidereal option, so the Vedic guide computes locally;
it says so. The brief's "update /developers/compare/ at every phase" refers
to the record-comparison page, which this change does not touch.
