"""NASA JPL Horizons for P4.1's holdout, and the carry of its directions out of
Horizons's frame (../PREREGISTRATION.md: "Oracles and their receipts", rule
(i)'s holdout and "The holdout").

    venv/bin/python -I horizons_holdout.py fetch CASES.json OUTDIR
    venv/bin/python -I horizons_holdout.py carry CASES.json RESPONSES_DIR OUT.json

CASES.json is {"cases": [{"id": "<string>", "jdTt": <TT Julian date>,
"jdUt": <UTC Julian date, optional>}]}. Each jdTt must be given to the 1e-8 day
that the request carries (as corpus-tt.json gives it), so that the TT Horizons
is asked for is the case's jdTt exactly; the cases must be more than 4 ms
apart, so that every response row belongs to one case. jdUt, on every case or
on none, is the day decompose.py looks the EOP offsets up at (its corpus's
jdUt); without it, carry finds the UTC of each jdTt with ERFA (tttai, taiutc).

fetch asks Horizons as ../../engine-beyond-swiss/corpora/horizons-24/fetch.py
does (format text, OBSERVER, CENTER 500@399, TLIST of the TT Julian dates with
TIME_TYPE TT, QUANTITIES 31, ANG_FORMAT DEG, EXTRA_PREC YES, CSV_FORMAT YES,
APPARENT AIRLESS) for ten targets: Sun 10, Moon 301, Mercury 199, Venus 299 and
the system barycentres 4 to 9 for Mars to Pluto (labelled MarsBary to
PlutoBary, as that corpus names them). Each target's TLIST is the cases' jdTt
in ascending order, cut into consecutive chunks of at most CHUNK (50) dates,
one request per chunk with the same parameters otherwise: on 2026-11-10
Horizons answered GETs of 24 and 60 dates and HTTP 502 for 100 and 200. Chunk
k (from 1) is kept as <Label>.<k>.txt, so 200 cases give Sun.1.txt to
Sun.4.txt, and so on to PlutoBary.4.txt. Then it fetches JPL's EOP2 file
(latest_eop2.long, the URL decompose.py records). Each GET goes through
/usr/bin/curl (see http_get). Each request is tried at most 3 times; every
attempt, failed or not, is a line of queries.log (label, chunk, command, url,
seconds, bytes, sha256, and the file it was kept as or the error of a failed
one). A response is kept only if it passes the checks below; if any chunk or
the EOP2 file has no valid response after its attempts, fetch exits 1 and
OUTDIR holds queries.log alone, ending in the refusal. Otherwise OUTDIR
receives every chunk verbatim, latest_eop2.long and queries.log in one rename,
so it never holds a part of a set. OUTDIR must not exist or be empty.

The checks of each chunk, in fetch and again in carry: $$SOE and $$EOE; a
banner naming API VERSION 1.2 (the preregistration's rule), the target of the
request and the Earth (399) both with {source: DE441}, a geocentric site, no
refraction (AIRLESS) and an EOP file with its coverage; the columns
Date__(TT)__HR:MN:SC.fff, ObsEcLon and ObsEcLat; as many rows as the chunk's
cases; and each of them once, within 2 ms of a row's printed TT (Horizons
prints the millisecond). Every chunk of the ten targets must name the same EOP
file and coverage, and the targets must print the same TT for each case.

carry reads each target's chunks, <Label>.1.txt onwards in k order, as one
response (each chunk checked as above, its rows joined to the others'; the
chunk files must be exactly those the cases make) and carries each direction
from Horizons's frame into the IAU 2006/2000A ecliptic of date by
decompose.py's eopJpl model, with RESPONSES_DIR/latest_eop2.long and the EOP
span of the responses' banner, as decompose.py does. It writes OUT.json:

    {"eop": {"file", "bytes", "sha256", "span": {...}, "series": {...}},
     "responses": {"<body>": {"command", "chunks": [{"file", "bytes", "sha256"}],
                              "banner"}},
     "instants": [{"id", "jdTt", "horizonsTt", "horizonsTtMinusJdTtMs", "eopMjdUtc",
                   "offsetsMas", "held"}],
     "rows": [{"id", "body", "jdTt", "raw": {"lon", "lat"}, "carried": {"lon", "lat"},
               "sunSeparationDeg"}], ...}

raw is Horizons's printed longitude and latitude (degrees, IAU76/80 ecliptic
of date as Horizons labels it), carried the same direction in the IAU
2006/2000A ecliptic of date. sunSeparationDeg is the great-circle angle,
atan2(|u x w|, u . w), between the body's raw direction and the Sun's at the
same instant, for the preregistration's rule on Mercury to Pluto within 0.5
degrees of the Sun (the Sun and the Moon are always scored; the caller applies
the rule). The rows are the cases in order, each by Sun, Moon, Mercury, Venus,
Mars, Jupiter, Saturn, Uranus, Neptune, Pluto (Mars to Pluto: barycentres).
These are public NASA data and hold no Swiss Ephemeris value.

Exit status: 0 done, 1 refused (an instrument failure or a check that does not
hold: nothing but fetch's queries.log is written), 2 a usage error.
"""
import bisect
import hashlib
import json
import math
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import warnings
from datetime import datetime, timezone

import erfa
import numpy as np

HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api?'
EOP2_URL = 'https://eop2-external.jpl.nasa.gov/eop2/latest_eop2.long'
EOP2_FILE = 'latest_eop2.long'
DECOMPOSE = 'docs/platform/evidence/engine-beyond-swiss/horizons-frame/decompose.py'
DECOMPOSE_SHA256 = 'cd141148527a585778b6c5d008da8c9fadde4b9fef4de285ef0fd61f38da15ba'
# (body, label, COMMAND): label is the response's file name, as fetch.py names the horizons-24 corpus's.
TARGETS = [('Sun', 'Sun', '10'), ('Moon', 'Moon', '301'), ('Mercury', 'Mercury', '199'), ('Venus', 'Venus', '299'),
           ('Mars', 'MarsBary', '4'), ('Jupiter', 'JupiterBary', '5'), ('Saturn', 'SaturnBary', '6'),
           ('Uranus', 'UranusBary', '7'), ('Neptune', 'NeptuneBary', '8'), ('Pluto', 'PlutoBary', '9')]
CHUNK = 50            # dates per request: on 2026-11-10 Horizons answered GETs of 24 and 60 dates, and HTTP 502 for 100 and 200
ATTEMPTS = 3          # tries per request, the first included
TIMEOUT_S = 120       # fetch.py's
PAUSE_S = 10          # before the second try; twice that before the third
DAY_MS = 86400000.0
MATCH_MS = 2.0        # a row's printed TT (to the millisecond) against the case's jdTt
GREGORIAN_JD = 2299160.5  # 1582-10-15: Horizons's mixed calendar is Gregorian from here
MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()


class Refusal(Exception):
    """An input or a response that does not pass a check: nothing is written."""


class Usage(Exception):
    """A command line or an output directory the tool will not use."""


# ---------------------------------------------------------------------------
# From decompose.py (DECOMPOSE above, SHA-256 DECOMPOSE_SHA256, last changed in
# commit 71859470). Importing that file is not clean: at import it reads the
# horizons-24 corpus's Sun.txt into its constants EOP_FIRST and EOP_LAST and
# imports swisseph, and its eopJpl lookup is a closure inside main(). So these
# are copies. MJD0, MAS, eop2_series, at, tt_parts, to_ecliptic,
# old_equatorial, old_ecliptic, new_ecliptic, implied_offsets, unit, lonlat and
# day are verbatim. Two are adapted, each marked ADAPTED: eop_span takes the
# banner instead of opening the corpus's Sun.txt, and eop_jpl_offsets is the
# eopJpl branch of main()'s offsets() with the span passed in.
# ---------------------------------------------------------------------------
MJD0 = 2400000.5
MAS = math.pi / (180 * 3600 * 1000)


def eop_span(banner):
    """The first day and the last prediction of Horizons's EOP file, as MJD, from the corpus banner.

    ADAPTED: the banner is passed in (decompose.py reads the corpus's Sun.txt), and a banner
    without the line is refused (decompose.py would fail on None)."""
    m = re.search(r'EOP coverage\s*:\s*DATA-BASED (\d{4})-([A-Z]{3})-(\d{2}) TO .*?PREDICTS-> (\d{4})-([A-Z]{3})-(\d{2})', banner)
    if m is None:
        raise Refusal('the banner has no "EOP coverage" line in the form decompose.py reads')
    months = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split()
    mjd = lambda y, mo, d: float(erfa.cal2jd(int(y), months.index(mo) + 1, int(d))[1])
    return mjd(*m.group(1, 2, 3)), mjd(*m.group(4, 5, 6))


def eop2_series(path):
    """(MJD, dX, dY in mas) from a JPL EOP2 file; its offsets are relative to IAU 2006/2000A."""
    text = open(path).read().split('EOP2=', 1)[1].split('$END', 1)[0]
    series = []
    for line in text.strip().splitlines():
        cells = [c.strip() for c in line.split('$')[0].split(',')]
        series.append((float(cells[0]), float(cells[10]), float(cells[11])))
    return series


def at(series, mjd):
    """Linear interpolation in a daily series; the end values outside it."""
    days = [row[0] for row in series]
    if mjd <= days[0]:
        return series[0][1:]
    if mjd >= days[-1]:
        return series[-1][1:]
    i = bisect.bisect_right(days, mjd) - 1
    f = (mjd - days[i]) / (days[i + 1] - days[i])
    return tuple(a + f * (b - a) for a, b in zip(series[i][1:], series[i + 1][1:]))


def tt_parts(mjd_utc):
    """A UTC MJD as a TT two-part Julian date."""
    return erfa.taitt(*erfa.utctai(MJD0, mjd_utc))


def to_ecliptic(eps):
    """Equatorial to ecliptic coordinates: R1(eps)."""
    return erfa.rx(eps, np.identity(3))


def old_equatorial(d1, d2, dpsi, deps, bias):
    """The 1976/1980 GCRS-to-true-equator matrix with nutation offsets (radians), and its true obliquity."""
    dpsi80, deps80 = erfa.nut80(d1, d2)
    epsa = erfa.obl80(d1, d2)
    matrix = erfa.numat(epsa, dpsi80 + dpsi, deps80 + deps) @ erfa.pmat76(d1, d2)
    if bias:
        matrix = matrix @ erfa.bp06(d1, d2)[0]
    return matrix, epsa + deps80 + deps


def old_ecliptic(d1, d2, dpsi=0.0, deps=0.0, bias=False):
    matrix, eps = old_equatorial(d1, d2, dpsi, deps, bias)
    return to_ecliptic(eps) @ matrix


def new_ecliptic(d1, d2):
    return to_ecliptic(erfa.obl06(d1, d2) + erfa.nut06a(d1, d2)[1]) @ erfa.pnm06a(d1, d2)


def implied_offsets(d1, d2, dx_mas, dy_mas):
    """The IAU 1980 offsets (radians) that put the 1976/1980 pole on the 2006/2000A pole plus (dX, dY)."""
    x, y = erfa.bpn2xy(erfa.pnm06a(d1, d2))
    target = np.array([x + dx_mas * MAS, y + dy_mas * MAS])
    pole = lambda c: np.array(erfa.bpn2xy(old_equatorial(d1, d2, c[0], c[1], False)[0]))
    c = np.zeros(2)
    for _ in range(6):
        miss = pole(c) - target
        step = 1e-8
        jacobian = np.column_stack([(pole(c + step * e) - target - miss) / step for e in np.identity(2)])
        c = c - np.linalg.solve(jacobian, miss)
    assert np.max(np.abs(pole(c) - target)) < 1e-6 * MAS
    return c


def unit(lon, lat):
    lon, lat = math.radians(lon), math.radians(lat)
    return np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])


def lonlat(v):
    return math.degrees(math.atan2(v[1], v[0])) % 360.0, math.degrees(math.asin(v[2] / np.linalg.norm(v)))


def day(mjd):
    y, m, d, _ = erfa.jd2cal(MJD0, mjd)
    return f'{y:04d}-{m:02d}-{d:02d}'


def eop_jpl_offsets(eop2, eop_first, eop_last, d1, d2, mjd):
    """(dpsi, deps) in radians for the eopJpl model at one instant, and whether they are held end values.

    ADAPTED: decompose.py's main(), the eopJpl branch of offsets(), with EOP_FIRST and EOP_LAST passed in."""
    clamped = min(max(mjd, eop_first), eop_last)
    dx, dy = at(eop2, clamped)
    if clamped != mjd:
        return tuple(implied_offsets(*tt_parts(clamped), dx, dy)), True
    return tuple(implied_offsets(d1, d2, dx, dy)), False


EOP_JPL_MODEL = ('bare with dpsi, deps added to the IAU 1980 nutation: the offsets that put its pole on the '
                 'IAU 2006/2000A pole plus JPL EOP2 dX, dY; held at %s and %s')  # decompose.py's 'models' entry
# ---------------------------------------------------------------------------


def is_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def sha256_bytes(raw):
    return hashlib.sha256(raw).hexdigest()


def now_utc():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def load_cases(path):
    """The cases, checked, and whether they give jdUt."""
    try:
        with open(path) as f:
            data = json.load(f)
    except (OSError, ValueError) as exc:
        raise Refusal(f'{path}: {exc}')
    cases = data.get('cases') if isinstance(data, dict) else None
    if not isinstance(cases, list) or not cases:
        raise Refusal(f'{path}: no "cases" list')
    out, seen = [], set()
    for n, case in enumerate(cases):
        if not isinstance(case, dict):
            raise Refusal(f'case {n} is not an object')
        cid = case.get('id')
        if not isinstance(cid, str) or not cid or cid in seen:
            raise Refusal(f'case {n}: id {cid!r} is missing, not a string or repeated')
        seen.add(cid)
        jd = case.get('jdTt')
        if not is_number(jd) or jd < GREGORIAN_JD:
            raise Refusal(f'case {cid}: jdTt {jd!r} is not a finite Julian date after 1582-10-15')
        if float(f'{jd:.8f}') != jd:
            raise Refusal(f'case {cid}: jdTt {jd!r} is not given to the 1e-8 day the request carries '
                          f'({jd:.8f}); round it first, as corpus-tt.json does')
        entry = {'id': cid, 'jdTt': float(jd)}
        if 'jdUt' in case:
            if not is_number(case['jdUt']):
                raise Refusal(f'case {cid}: jdUt {case["jdUt"]!r} is not a finite number')
            entry['jdUt'] = float(case['jdUt'])
        out.append(entry)
    with_ut = sum('jdUt' in c for c in out)
    if with_ut not in (0, len(out)):
        raise Refusal(f'{with_ut} of {len(out)} cases give jdUt: give it on every case or on none')
    ordered = sorted(out, key=lambda c: c['jdTt'])
    for a, b in zip(ordered, ordered[1:]):
        if (b['jdTt'] - a['jdTt']) * DAY_MS <= 2 * MATCH_MS:
            raise Refusal(f'cases {a["id"]} and {b["id"]} are {2 * MATCH_MS:g} ms apart or less: '
                          'a response row could not be told apart')
    return out, with_ut == len(out)


def chunks(cases):
    """The cases in ascending TT, cut into consecutive chunks of at most CHUNK: one request each."""
    ordered = sorted(cases, key=lambda c: c['jdTt'])
    return [ordered[i:i + CHUNK] for i in range(0, len(ordered), CHUNK)]


def chunk_file(label, k):
    """The file a target's k-th chunk (from 1) is kept as."""
    return f'{label}.{k}.txt'


def joined(parts):
    """A target's chunks read as one response: the first chunk's banner and span, every chunk's rows."""
    rows = {}
    for part in parts:
        rows.update(part['rows'])
    return {'banner': parts[0]['banner'], 'span': parts[0]['span'], 'rows': rows}


def horizons_url(command, cases):
    """fetch.py's request for one target, with the cases' TT in ascending order."""
    tlist = ' '.join(f"{c['jdTt']:.8f}" for c in sorted(cases, key=lambda c: c['jdTt']))
    params = {'format': 'text', 'COMMAND': f"'{command}'", 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'", 'CENTER': "'500@399'",
              'TLIST': f"'{tlist}'", 'TLIST_TYPE': "'JD'", 'TIME_TYPE': "'TT'", 'QUANTITIES': "'31'", 'ANG_FORMAT': "'DEG'", 'EXTRA_PREC': "'YES'", 'CSV_FORMAT': "'YES'", 'APPARENT': "'AIRLESS'"}
    return HORIZONS_API + urllib.parse.urlencode(params)


API_LINE = re.compile(r'^API VERSION:\s*(\S+)\s*$', re.M)
BODY_LINE = re.compile(r'^(Target|Center) body name:\s*(.*?)\s*\((-?\d+)\)\s*\{source:\s*([^}]*?)\s*\}', re.M)
SITE_LINE = re.compile(r'^Center-site name:\s*(.*?)\s*$', re.M)
REFRACTION_LINE = re.compile(r'^Atmos refraction:\s*(.*?)\s*$', re.M)
EOP_FILE_LINE = re.compile(r'^EOP file\s*:\s*(\S+)', re.M)
EOP_COVERAGE_LINE = re.compile(r'^EOP coverage\s*:\s*(.*?)\s*$', re.M)
ROW_TIME = re.compile(r'^(\d{4})-(' + '|'.join(MONTHS) + r')-(\d{2}) (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$')
COLUMNS = ['Date__(TT)__HR:MN:SC.fff', '', '', 'ObsEcLon', 'ObsEcLat']


def row_jd(match):
    """The Julian date of a row's printed TT (Gregorian calendar)."""
    y, mon, d, hh, mm, ss = match.groups()
    djm0, djm = erfa.cal2jd(int(y), MONTHS.index(mon) + 1, int(d))
    return float(djm0) + float(djm) + (int(hh) * 3600 + int(mm) * 60 + float(ss)) / 86400


def parse_response(text, label, command, cases):
    """One Horizons response checked against its request and the cases: its banner, its EOP span
    and its rows by case id. Raises Refusal on anything that does not hold."""
    if '$$SOE' not in text:
        raise Refusal(f'{label}: no $$SOE, so Horizons gave no ephemeris')
    head, rest = text.split('$$SOE', 1)
    if '$$EOE' not in rest:
        raise Refusal(f'{label}: no $$EOE after $$SOE, so the response is cut short')
    block = rest.split('$$EOE', 1)[0]
    api = API_LINE.search(head)
    # PREREGISTRATION.md: each banner must name DE441 and API 1.2, or the run stops as an instrument failure.
    if not api or api.group(1) != '1.2':
        raise Refusal(f'{label}: the banner does not name API VERSION 1.2 ({api.group(0) if api else "no API line"})')
    named = {kind: (name, code, source) for kind, name, code, source in BODY_LINE.findall(head)}
    target, center = named.get('Target'), named.get('Center')
    if not target or target[1] != command or target[2] != 'DE441':
        raise Refusal(f'{label}: the banner names target {target}, not COMMAND {command} from DE441')
    if not center or center[1] != '399' or center[2] != 'DE441':
        raise Refusal(f'{label}: the banner names center {center}, not the Earth (399) from DE441')
    site, refraction = SITE_LINE.search(head), REFRACTION_LINE.search(head)
    if not site or site.group(1) != 'GEOCENTRIC':
        raise Refusal(f'{label}: the banner does not name a geocentric site')
    if not refraction or refraction.group(1) != 'NO (AIRLESS)':
        raise Refusal(f'{label}: the banner does not say "Atmos refraction: NO (AIRLESS)"')
    eop_file, coverage = EOP_FILE_LINE.search(head), EOP_COVERAGE_LINE.search(head)
    if not eop_file or not coverage:
        raise Refusal(f'{label}: the banner names no EOP file or no EOP coverage')
    try:
        span = eop_span(head)
    except Refusal as exc:
        raise Refusal(f'{label}: {exc}')
    header = [line for line in head.splitlines() if line.strip().startswith('Date__(')]
    if len(header) != 1 or [c.strip() for c in header[0].split(',')][:5] != COLUMNS:
        raise Refusal(f'{label}: the columns are not {", ".join(c for c in COLUMNS if c)}')
    lines = [line for line in block.splitlines() if line.strip()]
    if len(lines) != len(cases):
        raise Refusal(f'{label}: {len(lines)} rows for {len(cases)} cases')
    order = sorted(cases, key=lambda c: c['jdTt'])
    keys = [c['jdTt'] for c in order]
    rows = {}
    for line in lines:
        cells = [c.strip() for c in line.split(',')]
        when = ROW_TIME.match(cells[0]) if len(cells) >= 5 else None
        if not when or int(when.group(1)) < 1583:
            raise Refusal(f'{label}: the row {line.strip()!r} is not a Gregorian A.D. TT with two angles')
        try:
            lon, lat, jd = float(cells[3]), float(cells[4]), row_jd(when)
        except (ValueError, erfa.ErfaError) as exc:
            raise Refusal(f'{label}: the row {line.strip()!r} does not parse ({exc})')
        if not (math.isfinite(lon) and math.isfinite(lat) and 0.0 <= lon < 360.0 and -90.0 <= lat <= 90.0):
            raise Refusal(f'{label}: the row {line.strip()!r} has an angle out of range')
        i = bisect.bisect_left(keys, jd)
        near = [j for j in (i - 1, i) if 0 <= j < len(keys) and abs(keys[j] - jd) * DAY_MS <= MATCH_MS]
        if len(near) != 1:
            raise Refusal(f'{label}: the row at {cells[0]} TT is no case\'s jdTt (within {MATCH_MS:g} ms)')
        cid = order[near[0]]['id']
        if cid in rows:
            raise Refusal(f'{label}: case {cid} has two rows')
        rows[cid] = {'lon': lon, 'lat': lat, 'printed': cells[0], 'offsetMs': (jd - keys[near[0]]) * DAY_MS}
    banner = {'api': api.group(1), 'target': f'{target[0]} ({target[1]})', 'targetSource': target[2],
              'center': f'{center[0]} ({center[1]})', 'centerSource': center[2], 'site': site.group(1),
              'refraction': refraction.group(1), 'eopFile': eop_file.group(1), 'eopCoverage': coverage.group(1)}
    return {'banner': banner, 'span': span, 'rows': rows}


def same_eop(parsed):
    """The EOP file, coverage and span that every response names, or a refusal."""
    named = {}
    for label, p in parsed.items():
        named.setdefault((p['banner']['eopFile'], p['banner']['eopCoverage'], p['span']), []).append(label)
    if len(named) != 1:
        raise Refusal('the responses name different EOP files or coverages: '
                      + '; '.join(f'{", ".join(labels)}: {key[0]} {key[1]}' for key, labels in named.items()))
    return next(iter(named))


def same_times(parsed, cases):
    """Every response prints the same TT for each case."""
    for case in cases:
        printed = {p['rows'][case['id']]['printed'] for p in parsed.values()}
        if len(printed) != 1:
            raise Refusal(f'case {case["id"]}: the responses print different TT: {sorted(printed)}')


def eop2_text_series(text):
    """eop2_series (decompose.py) on the file's text, so that fetch can check a download before it keeps it."""
    try:
        body = text.split('EOP2=', 1)[1].split('$END', 1)[0]
        series = []
        for line in body.strip().splitlines():
            cells = [c.strip() for c in line.split('$')[0].split(',')]
            series.append((float(cells[0]), float(cells[10]), float(cells[11])))
    except (IndexError, ValueError) as exc:
        raise Refusal(f'not a JPL EOP2 file that decompose.py can read ({type(exc).__name__}: {exc})')
    return series


def check_series(series, what):
    if len(series) < 2:
        raise Refusal(f'{what}: fewer than two EOP2 rows')
    if not all(all(math.isfinite(x) for x in row) for row in series):
        raise Refusal(f'{what}: an EOP2 value is not finite')
    if any(b[0] <= a[0] for a, b in zip(series, series[1:])):
        raise Refusal(f'{what}: the EOP2 days do not increase')


def series_notes(series, span):
    first, last = span
    return {'rows': len(series), 'first': day(series[0][0]), 'last': day(series[-1][0]),
            'coversHorizonsSpan': series[0][0] <= first and series[-1][0] >= last}


# --- fetch --------------------------------------------------------------------------------------------------

def http_get(url):
    """The body of a GET by the system's curl, which verifies TLS against the
    operating system's trust store. Python's own stores here lack the root
    that JPL's chain ends in (Sectigo Public Server Authentication Root R46),
    so urllib refuses a genuine chain; curl checks the same chain fully."""
    import subprocess
    result = subprocess.run(['/usr/bin/curl', '--silent', '--show-error', '--fail-with-body', '--proto', '=https',
                             '--max-time', str(TIMEOUT_S), url], capture_output=True)
    if result.returncode != 0:
        raise OSError(f'curl exit {result.returncode}: {result.stderr.decode("utf-8", "replace").strip()[:300]}'
                      + (f': {result.stdout[:300].decode("utf-8", "replace")}' if result.stdout else ''))
    return result.stdout


def describe(exc):
    if isinstance(exc, urllib.error.HTTPError):
        try:
            body = exc.read()[:300].decode('utf-8', 'replace')
        except Exception:  # the error carries no readable body
            body = ''
        return f'HTTP {exc.code} {exc.reason}' + (f': {body}' if body else '')
    if isinstance(exc, urllib.error.URLError):
        return f'URLError: {exc.reason}'
    return f'{type(exc).__name__}: {exc}'


def get_with_retries(label, file, command, url, check, log, opener=http_get, pause=PAUSE_S, chunk=None):
    """The body of the first of ATTEMPTS tries that check accepts; every try is logged.
    check(raw) returns notes for the log or raises."""
    for attempt in range(1, ATTEMPTS + 1):
        fetched, started = now_utc(), time.time()
        entry = {'label': label, **({'chunk': chunk} if chunk is not None else {}),
                 **({'command': command} if command else {}), 'url': url}
        raw, problem, notes, excerpt = None, None, None, None
        try:
            raw = opener(url)
        except Exception as exc:  # a failed request: recorded, then tried again
            problem = describe(exc)
        seconds = round(time.time() - started, 1)
        if raw is not None:
            try:
                notes = check(raw)
            except Exception as exc:  # a response that does not pass: recorded, then tried again
                problem = str(exc) if isinstance(exc, Refusal) else describe(exc)
                excerpt = raw[:400].decode('utf-8', 'replace')
        entry.update({'seconds': seconds})
        if raw is not None:
            entry.update({'bytes': len(raw), 'sha256': sha256_bytes(raw)})
        entry.update({'attempt': attempt, 'fetchedUtc': fetched})
        if problem is None:
            entry.update({'file': file, **(notes or {})})
            log.append(entry)
            return raw
        entry.update({'error': problem, **({'excerpt': excerpt} if excerpt is not None else {})})
        log.append(entry)
        if attempt < ATTEMPTS:
            time.sleep(pause * attempt)
    raise Refusal(f'{file}: no valid response in {ATTEMPTS} attempts (queries.log has each)')


def log_text(log):
    return ''.join(json.dumps(entry) + '\n' for entry in log)


def write_refusal_log(outdir, log):
    """On a refusal: queries.log alone, written whole, and no response."""
    os.makedirs(outdir, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.queries-', dir=outdir)
    with os.fdopen(fd, 'w') as f:
        f.write(log_text(log))
    os.replace(tmp, os.path.join(outdir, 'queries.log'))


def keep(outdir, files, log):
    """Every file and queries.log into outdir in one rename (outdir is absent or empty)."""
    target = os.path.abspath(outdir)
    parent = os.path.dirname(target)
    os.makedirs(parent, exist_ok=True)
    staging = tempfile.mkdtemp(prefix=f'.{os.path.basename(target)}.partial-', dir=parent)
    try:
        for name, raw in files.items():
            with open(os.path.join(staging, name), 'wb') as f:
                f.write(raw)
        with open(os.path.join(staging, 'queries.log'), 'w') as f:
            f.write(log_text(log))
        os.chmod(staging, 0o755)
        os.replace(staging, target)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def fetch(cases_path, outdir, opener=http_get, pause=PAUSE_S):
    cases, _ = load_cases(cases_path)
    if os.path.lexists(outdir) and not (os.path.isdir(outdir) and not os.listdir(outdir)):
        raise Usage(f'{outdir} exists and is not an empty directory: fetch keeps its responses only in a new one')
    log, files, parsed = [], {}, {}
    parts = chunks(cases)
    try:
        for _body, label, command in TARGETS:
            for k, part in enumerate(parts, 1):
                name = chunk_file(label, k)

                def check(raw, name=name, command=command, part=part):
                    parsed[name] = parse_response(raw.decode(), name, command, part)
                    return {'eopFile': parsed[name]['banner']['eopFile']}

                files[name] = get_with_retries(label, name, command, horizons_url(command, part), check, log, opener,
                                               pause, chunk=k)
                print(f'{name}: {len(files[name])} bytes', flush=True)
        _file, _coverage, span = same_eop(parsed)   # every chunk of every target
        same_times({label: joined([parsed[chunk_file(label, k)] for k in range(1, len(parts) + 1)])
                    for _body, label, _command in TARGETS}, cases)

        def check_eop2(raw):
            series = eop2_text_series(raw.decode())
            check_series(series, EOP2_FILE)
            return series_notes(series, span)

        files[EOP2_FILE] = get_with_retries('EOP2', EOP2_FILE, None, EOP2_URL, check_eop2, log, opener, pause)
        print(f'EOP2: {len(files[EOP2_FILE])} bytes', flush=True)
    except Refusal as exc:
        log.append({'refused': str(exc), 'at': now_utc()})
        write_refusal_log(outdir, log)
        print(f'horizons_holdout.py fetch: refused: {exc}', file=sys.stderr)
        return 1
    try:
        keep(outdir, files, log)
    except OSError as exc:  # OUTDIR filled up meanwhile, or the disk: nothing kept, and the queries go to stderr
        print(f'horizons_holdout.py fetch: refused: could not keep the responses in {outdir} ({exc}); the queries:\n'
              + log_text(log), file=sys.stderr, end='')
        return 1
    print(f'kept {len(files)} files and queries.log in {outdir}', flush=True)
    return 0


# --- carry --------------------------------------------------------------------------------------------------

def utc_mjd_from_tt(jd_tt):
    """The UTC MJD of a TT Julian date by ERFA, for the EOP day of a case without jdUt. Before 1960 and
    after ERFA's leap-second table this is ERFA's 'dubious year', and outside the EOP span the day only
    decides the hold, so the warning is not shown."""
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', erfa.ErfaWarning)
        u1, u2 = erfa.taiutc(*erfa.tttai(MJD0, jd_tt - MJD0))
    return float((u1 - MJD0) + u2)


def separation_deg(u, w):
    return math.degrees(math.atan2(float(np.linalg.norm(np.cross(u, w))), float(u @ w)))


def carry(cases_path, responses_dir, out_path):
    if not os.path.isdir(os.path.dirname(os.path.abspath(out_path))):
        raise Usage(f'the directory of {out_path} does not exist')
    cases, with_ut = load_cases(cases_path)
    parts = chunks(cases)
    try:
        listed = os.listdir(responses_dir)
    except OSError as exc:
        raise Refusal(f'{responses_dir}: {exc}')
    by_chunk, parsed, responses = {}, {}, {}
    for body, label, command in TARGETS:
        names = [chunk_file(label, k) for k in range(1, len(parts) + 1)]
        present = sorted(n for n in listed if re.fullmatch(re.escape(label) + r'\.\d+\.txt', n))
        if sorted(names) != present:
            raise Refusal(f'{label}: the chunk files are {present}, not {names} '
                          f'({len(cases)} cases in chunks of at most {CHUNK})')
        kept = []
        for name, part in zip(names, parts):
            try:
                with open(os.path.join(responses_dir, name), 'rb') as f:
                    raw = f.read()
                text = raw.decode()
            except (OSError, UnicodeDecodeError) as exc:
                raise Refusal(f'{name}: {exc}')
            by_chunk[name] = parse_response(text, name, command, part)
            kept.append({'file': name, 'bytes': len(raw), 'sha256': sha256_bytes(raw)})
        parsed[label] = joined([by_chunk[name] for name in names])
        responses[body] = {'command': command, 'chunks': kept, 'banner': parsed[label]['banner']}
    eop_file, coverage, (eop_first, eop_last) = same_eop(by_chunk)   # every chunk of every target
    same_times(parsed, cases)
    eop2_path = os.path.join(responses_dir, EOP2_FILE)
    try:
        with open(eop2_path, 'rb') as f:
            eop2_raw = f.read()
        eop2 = eop2_series(eop2_path)
    except (OSError, IndexError, ValueError, UnicodeDecodeError) as exc:
        raise Refusal(f'{eop2_path}: not a JPL EOP2 file decompose.py can read ({type(exc).__name__}: {exc})')
    check_series(eop2, eop2_path)

    instants, rows = [], []
    for case in cases:
        d1, d2 = MJD0, case['jdTt'] - MJD0
        mjd = case['jdUt'] - MJD0 if with_ut else utc_mjd_from_tt(case['jdTt'])
        new = new_ecliptic(d1, d2)
        (dpsi, deps), held = eop_jpl_offsets(eop2, eop_first, eop_last, d1, d2, mjd)
        matrix = new @ old_ecliptic(d1, d2, dpsi, deps, False).T
        sun_row = parsed['Sun']['rows'][case['id']]
        sun = unit(sun_row['lon'], sun_row['lat'])
        instants.append({'id': case['id'], 'jdTt': case['jdTt'], 'horizonsTt': sun_row['printed'],
                         'horizonsTtMinusJdTtMs': sun_row['offsetMs'], 'eopMjdUtc': float(mjd),
                         'offsetsMas': {'dpsi': float(dpsi) / MAS, 'deps': float(deps) / MAS}, 'held': held})
        for body, label, _command in TARGETS:
            row = parsed[label]['rows'][case['id']]
            u = unit(row['lon'], row['lat'])
            lon_n, lat_n = lonlat(matrix @ u)
            rows.append({'id': case['id'], 'body': body, 'jdTt': case['jdTt'],
                         'raw': {'lon': row['lon'], 'lat': row['lat']},
                         'carried': {'lon': lon_n, 'lat': lat_n},
                         'sunSeparationDeg': 0.0 if body == 'Sun' else separation_deg(u, sun)})

    out = {
        'what': ('NASA JPL Horizons (DE441) QUANTITIES=31 apparent geocentric ecliptic longitude and latitude at each case, '
                 'as Horizons printed them (raw), and carried out of its IAU 1976/1980 frame into the IAU 2006/2000A ecliptic '
                 'of date by the eopJpl model of decompose.py (carried); with each body\'s great-circle separation from the Sun '
                 'in the raw directions. Mars to Pluto are the system barycentres.'),
        'model': {'name': 'eopJpl', 'source': DECOMPOSE, 'sha256': DECOMPOSE_SHA256,
                  'what': EOP_JPL_MODEL % (day(eop_first), day(eop_last)),
                  'eopDay': 'the case\'s jdUt, as decompose.py' if with_ut else 'the UTC of jdTt by ERFA (tttai, taiutc): the cases give no jdUt'},
        'eop': {'file': EOP2_FILE, 'bytes': len(eop2_raw), 'sha256': sha256_bytes(eop2_raw),
                'span': {'horizonsEopFile': eop_file, 'coverage': coverage, 'first': day(eop_first), 'last': day(eop_last)},
                'series': series_notes(eop2, (eop_first, eop_last))},
        'responses': responses,
        'python': sys.version.split()[0], 'numpy': np.__version__, 'pyerfa': erfa.__version__, 'erfa': erfa.version.erfa_version,
        'instants': instants,
        'rows': rows,
    }
    directory = os.path.dirname(os.path.abspath(out_path))
    fd, tmp = tempfile.mkstemp(prefix='.carry-', suffix='.json', dir=directory)
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(out, f, indent=1)
            f.write('\n')
        os.replace(tmp, out_path)
    except BaseException:
        os.unlink(tmp)
        raise
    return 0


USAGE = __doc__.split('\n\n')[1]


def main(argv):
    try:
        if len(argv) == 3 and argv[0] == 'fetch':
            return fetch(argv[1], argv[2])
        if len(argv) == 4 and argv[0] == 'carry':
            return carry(argv[1], argv[2], argv[3])
        raise Usage('usage:\n' + USAGE)
    except Usage as exc:
        print(f'horizons_holdout.py: {exc}', file=sys.stderr)
        return 2
    except Refusal as exc:
        print(f'horizons_holdout.py {argv[0]}: refused: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
