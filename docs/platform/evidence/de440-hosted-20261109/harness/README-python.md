# The harness's Python instruments

Two tools that the harness's Node orchestrator calls with JSON files, for the
rules and the holdout of `../PREREGISTRATION.md`. Both run on the pinned venv
beside the clones (`toolchain/py311-oq6/venv/bin/python`: Python 3.11.16,
pyswisseph 2.10.3.2, pyerfa 2.0.1.5, numpy 2.4.6), always with `-I`.

## `swiss.py`: Swiss Ephemeris

    venv/bin/python -I swiss.py REQUEST.json OUT.json

`REQUEST.json`:

    {"ephePath": "<directory holding semo_18.se1 and sepl_18.se1>",
     "jplFile": "<absolute path of linux_p1550p2650.440>",
     "calls": [{"id": "<string>", "mode": "se1" | "jpl", "jdTt": <TT Julian date>,
                "body": "Sun" | "Moon" | "Mercury" | "Venus" | "Mars" | "Jupiter" |
                        "Saturn" | "Uranus" | "Neptune" | "Pluto" | "TrueNode"}]}

Each call is `swe.calc` at the TT given (never `calc_ut`) with the ephemeris
flag alone: `FLG_SWIEPH` for `"se1"`, `FLG_JPLEPH` for `"jpl"`. That is Swiss's
default place, apparent geocentric ecliptic and equinox of date, with no
`TRUEPOS`, `NOABERR` or `NOGDEFL`. `TrueNode` is `SE_TRUE_NODE`. Mars to Pluto
are what Swiss gives by default, the system barycentres: only
`FLG_CENTER_BODY`, never set here, moves Swiss to a planet's centre, and asks
for its planetary-moon files to do it (`sepm9599.se1` for Jupiter).

Swiss keeps only the base name of the JPL file and looks for it in the
ephemeris path. With the file anywhere else it answers from the `.se1` files
and says so only in the returned flag, so the `"jpl"` calls run with the path
set to the JPL file's own directory, after the `"se1"` calls have run with
`ephePath`. `SE_EPHE_PATH`, which Swiss would put first, is removed from the
environment at start (and named in OUT if it was set).

The returned flag of every call is checked. A `"jpl"` call whose ephemeris bits
are not `FLG_JPLEPH`, or a `"se1"` call whose ephemeris bits are not
`FLG_SWIEPH`, is not a valid row: `ok` is false and `error` says why. Swiss
falls back to its Moshier series without raising (outside a file's span, or
with a file missing), so this is how the preregistration's "a Swiss call
returning a flag other than the one asked for" shows. A call that raises is
`ok` false with the exception's message. A malformed request is refused whole:
exit 2, nothing written.

`OUT.json`:

    {"swisseph": "2.10.03", "pyswisseph": "2.10.3.2", "python": "3.11.16",
     "jplFile": {"name", "bytes", "sha256"}, "ephePath": "...",
     "se1Files": {"semo_18.se1": {"bytes", "sha256"}, "sepl_18.se1": {...}},
     "flags": {"se1": 2, "jpl": 1},
     "calls": [{"id", "ok", "lon", "lat", "retflag", "error" (only when not ok)}]}

The calls keep the request's order. `lon` and `lat` are degrees as Swiss
returns them (null when not ok); `retflag` is null when the call raised. OUT
holds per-case Swiss values, which are never committed (DECISIONS-2026-09-29
section 2, F-22): the tool refuses an OUT path inside a git working tree. It
prints one summary line on stderr and nothing per row. The digests in OUT are
for the caller to hold to the preregistration's pins.

## `horizons_holdout.py`: Horizons for the holdout, and its frame

    venv/bin/python -I horizons_holdout.py fetch CASES.json OUTDIR
    venv/bin/python -I horizons_holdout.py carry CASES.json RESPONSES_DIR OUT.json

`CASES.json` is `{"cases": [{"id", "jdTt", "jdUt" (optional)}]}`.

- `jdTt` is the TT Julian date Horizons is asked for. It must be given to the
  1e-8 day that the request carries (`round(x, 8)`, as `corpus-tt.json` does),
  so that the TLIST holds the case's own number; and the cases must be more
  than 4 ms apart.
- `jdUt` is the case's UTC as a Julian date, on every case or on none.
  `decompose.py` looks its EOP offsets up at that day (its corpus's `jdUt`), so
  passing the holdout's drawn UTC reproduces it exactly. Without it, `carry`
  finds the UTC of each `jdTt` with ERFA (`tttai`, `taiutc`) and says so in
  OUT. On horizons-24, with a synthetic EOP2 file, that moved the EOP day by up
  to 37 s, no carried longitude, and latitudes by about 1e-8 mas.

### `fetch`

Ten targets, each asked as
`../../engine-beyond-swiss/corpora/horizons-24/fetch.py` asks (its parameters,
its URL encoding, a TLIST of the TT Julian dates to eight decimals): Sun 10,
Moon 301, Mercury 199, Venus 299, and the system barycentres 4 to 9 for Mars
to Pluto, labelled `MarsBary` to `PlutoBary` as that corpus names them.

Each target's TLIST is the cases' `jdTt` in ascending order, cut into
consecutive chunks of at most 50 dates (`CHUNK`), one request per chunk with
the same parameters otherwise. On 2026-11-10 Horizons answered GETs with 24
and 60 dates (URLs of 723 and 1,335 characters) and HTTP 502 with 100 and 200
(2,015 and 3,715). Chunk k, counted from 1, is kept as `<Label>.<k>.txt`. For
the holdout's 200 cases that is four chunks of 50 per target, 40 files:

    Sun.1.txt ... Sun.4.txt          Moon.1.txt ... Moon.4.txt
    Mercury.1.txt ... Mercury.4.txt  Venus.1.txt ... Venus.4.txt
    MarsBary.1.txt ... MarsBary.4.txt, and the same for JupiterBary,
    SaturnBary, UranusBary, NeptuneBary and PlutoBary

Then JPL's EOP2 file, from the URL `decompose.py` records
(`https://eop2-external.jpl.nasa.gov/eop2/latest_eop2.long`), kept as
`latest_eop2.long`, and `queries.log`: 42 files in all.

Each GET goes through the system's `/usr/bin/curl` (HTTPS only, TLS verified
against the operating system's trust store: Python's own stores on the
recording machine lack the root JPL's chain ends in, Sectigo Public Server
Authentication Root R46). Each request (each chunk, and the EOP2 file) is
tried at most three times, 10 s and then 20 s apart. Every attempt is a JSON
line of `queries.log`: `label`, `chunk` (not on the EOP2 file's lines),
`command`, `url`, `seconds`, `bytes`, then `sha256`, `attempt`, `fetchedUtc`,
and either the `file` it was kept as or the `error` (with an `excerpt` of a
response that failed a check). So every kept file, each chunk and
`latest_eop2.long`, has one line with its `file` and `sha256`. A response is
kept only if it passes every check below. If a chunk or the EOP2 file has no
valid response after three attempts, or the banners disagree, `fetch` exits 1
and OUTDIR holds `queries.log` alone, ending in a `refused` line. Otherwise
every file arrives in OUTDIR in one rename, so it never holds part of a set.
OUTDIR must be absent or empty, so a re-run (which the preregistration
records) goes to a new directory and the failed one stays as it was.

The checks of each chunk, in `fetch` and again in `carry`:

- `$$SOE` and `$$EOE`;
- a banner naming `API VERSION: 1.2` (the preregistration's rule), the requested
  target and the Earth (399),
  each `{source: DE441}`, a `GEOCENTRIC` site, `Atmos refraction: NO (AIRLESS)`,
  and an EOP file with its coverage in the form `decompose.py` reads;
- the columns `Date__(TT)__HR:MN:SC.fff`, `ObsEcLon`, `ObsEcLat`;
- as many rows as the chunk's cases, and each of those cases' `jdTt` exactly
  once, within 2 ms of a row's printed TT (Horizons prints the millisecond,
  rounded);
- across every chunk of the ten targets: one EOP file and coverage; and across
  the targets, the same printed TT for each case.

### `carry`

Reads each target's chunks, `<Label>.1.txt` onwards in k order, as one
response: each chunk is checked as above against its own cases, and the rows
of the chunks are joined. The chunk files in RESPONSES_DIR must be exactly
those the cases make (a missing or an extra `<Label>.<k>.txt` is refused). Then,
with `RESPONSES_DIR/latest_eop2.long`, it carries each direction out of
Horizons's frame into the IAU 2006/2000A ecliptic of date by the `eopJpl`
model of
`../../engine-beyond-swiss/horizons-frame/decompose.py`, with the EOP span read
from the responses' banner, as `decompose.py` does. OUT, which holds only
public NASA data:

    {"what", "model": {"name": "eopJpl", "source", "sha256", "what", "eopDay"},
     "eop": {"file", "bytes", "sha256",
             "span": {"horizonsEopFile", "coverage", "first", "last"},
             "series": {"rows", "first", "last", "coversHorizonsSpan"}},
     "responses": {"<body>": {"command", "chunks": [{"file", "bytes", "sha256"}],
                              "banner"}},
     "python", "numpy", "pyerfa", "erfa",
     "instants": [{"id", "jdTt", "horizonsTt", "horizonsTtMinusJdTtMs", "eopMjdUtc",
                   "offsetsMas": {"dpsi", "deps"}, "held"}],
     "rows": [{"id", "body", "jdTt", "raw": {"lon", "lat"}, "carried": {"lon", "lat"},
               "sunSeparationDeg"}]}

`raw` is what Horizons printed (degrees), `carried` the same direction in the
IAU 2006/2000A ecliptic of date, every number at full precision. `rows` take the
cases in order, each by Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn,
Uranus, Neptune, Pluto (Mars to Pluto: barycentres). `sunSeparationDeg` is
atan2(|u x w|, u . w) between the body's raw direction and the Sun's at the
same instant: the input of the holdout's rule that leaves out Mercury to Pluto
within 0.5 degrees of the Sun, which the caller applies (the Sun and the Moon
are always scored). `series.coversHorizonsSpan` is false if the EOP2 file stops
before Horizons's last prediction; the model then holds the file's last
values, as `decompose.py` would.

`decompose.py` is not imported: at import it reads the horizons-24 corpus's
`Sun.txt` into its constants `EOP_FIRST` and `EOP_LAST` and imports swisseph,
and its eopJpl lookup is a closure inside `main()`. Its functions are copied
instead, under a comment naming the file and its SHA-256 (`cd141148...`):
`MJD0`, `MAS`, `eop2_series`, `at`, `tt_parts`, `to_ecliptic`,
`old_equatorial`, `old_ecliptic`, `new_ecliptic`, `implied_offsets`, `unit`,
`lonlat` and `day` verbatim; `eop_span` (given the banner) and
`eop_jpl_offsets` (the eopJpl branch of `main()`'s `offsets`, given the span)
adapted and marked.

## Checked offline, before the run

Nothing here was run against a network: in the tests of `fetch`, sockets,
`urlopen` and curl were disabled and a fake opener stood in for Horizons and
JPL.

- `swiss.py`: both modes at nine TT dates from 1800 to 2199 for all eleven
  bodies gave the asked-for flag on every call; a missing `.se1` directory, a
  file that is not a JPL ephemeris and dates outside the files each gave
  `ok` false; malformed requests, and an OUT inside a git working tree, were
  refused with nothing written; Swiss's default Jupiter, Saturn and Pluto
  matched Horizons's barycentre responses of horizons-24, not its body-centre
  responses.
- `carry` on horizons-24 (the barycentre responses for Mars to Pluto, laid
  out as the one chunk its 24 cases make): JPL's EOP2 file of 2026-09-29 is
  not kept, so it was run on a synthetic EOP2 file beside `decompose.py`'s own
  `main()` on the same file, and the 240 carried directions were
  bit-identical. With an EOP2 file rebuilt from the offsets that
  `results-2026-09-29.json` records, its eopJpl summary came back to its
  rounding. Every check above refused a damaged copy, with nothing written, and
  so did a missing or an extra chunk file.
- `fetch`: for the corpus's 24 cases (one chunk) its URL equals `fetch.py`'s,
  byte for byte, in the corpus's `queries.log` for all ten targets. Its success
  path, with the committed responses served in place of Horizons, kept every
  file verbatim with one `queries.log` line (`file`, `sha256`) per kept file,
  and `carry` accepted the directory. With chunks of 10 (10, 10 and 4), each
  chunk's rows cut out of the committed responses, `carry` gave the same rows
  bit for bit. For 200 synthetic cases (not the holdout) it wrote the 42 files
  listed above, each request's URL at most 1,166 characters, and `carry`
  accepted them. Its refusal paths (no `$$SOE`, a row short, an unreadable
  EOP2 file, two EOP coverages) left `queries.log` alone in OUTDIR, and a
  non-empty OUTDIR was refused before any request.

## Limits known before the run

- The `.se1` files begin on 1800-01-01 TT. A body whose light-time reaches back
  into 1799 (from 1.3 s for the Moon and 8 min for the Sun to 5.8 h for Pluto)
  cannot be placed from them, and Swiss answers from Moshier or raises: such a
  `"se1"` row comes back `ok` false. The JPL file covers 1550 to 2650.
- Chunks of 50 dates make URLs of about 1,165 characters, between the 60-date
  GET Horizons answered (1,335) and `fetch.py`'s 24 (723). If Horizons refused a
  chunk, `fetch` would refuse as above.
