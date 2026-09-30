#!/usr/bin/env python3
"""Removes Swiss Ephemeris output from the tree, as DECISIONS-2026-09-28 section 3
and DECISIONS-2026-09-29 section 2 ask.

    python3 docs/engine-validation/swiss-output-removal/strip.py           # apply, from 2ca93d41's bytes
    python3 docs/engine-validation/swiss-output-removal/strip.py --check   # verify the tree matches

Reads each file as it was at BASE (the last commit with every value), and
  * deletes the files that are Swiss output (REMOVE),
  * deletes the per-case Swiss values from the files that mix them with
    statistics (STRIP), keeping every statistic byte for byte, and records in
    the file what was removed, with its SHA-256,
  * records the files whose Swiss-derived content was replaced by an
    independent rebuild (REPLACED: the Horizons corpus, re-timed on the
    engine's own Delta T), with their SHA-256 before and after,
then writes manifest.json beside this file: every removed file and field,
with the SHA-256 and size of what was removed and the command that
regenerates it. Nothing is computed from Swiss here; the statistics a test
reads are computed from the rows before they are removed, by the same
formulas the tests used, and recorded as statistics.

It also writes value-digests.json: a digest of every distinctive number and
timestamp in what was removed (see TOKENS below), split into those no data
file and nothing under src/ holds any more ("gone", which
scripts/swiss-output-guard.test.mjs fails on) and those that still appear
there as inputs, statistics or reference values ("kept"). Applying scans the
tree for that split; --check only confirms that the two lists together are
exactly the digests of what was removed, which takes no scan.

What counts as Swiss output: a value Swiss Ephemeris returned (a position,
a speed, a cusp, an angle, an event time, a Delta T), a table that gives,
for every case of a set, Swiss's value or its difference from a reproducible
engine, arbiter or reference, since either gives Swiss's value back, and a
value that arithmetic on what remains gives back (a difference kept beside
the other term, a TT instant kept beside its UT, a position computed at UT +
Swiss's Delta T beside the same program's at its own clock). What stays:
statistics (counts, means, percentiles, extremes with the case they came
from), digests, and the scripts that regenerate Swiss's values on demand. No
Swiss Ephemeris source code stays anywhere.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, os.pardir, os.pardir, os.pardir))
BASE = '2ca93d4174822e2ba4b8fc3de0db6551d0c5ba83'
# The commit of #600 that added the rc.14 parity reports, after BASE, with the
# same per-case rows as rc.5 to rc.10's.
MAIN_RC14 = 'a9d3d9e85c9293b1a8b809d072b3a0c3edde1a76'
ROUND_1 = {'on': '2026-09-28', 'under': 'docs/platform/programme/DECISIONS-2026-09-28.md §3'}
ROUND_2 = {'on': '2026-09-29', 'under': 'docs/platform/programme/DECISIONS-2026-09-29.md §2'}
DATE, UNDER = ROUND_1['on'], ROUND_1['under']
# The first removal's four commits, whose deletions in src/ (the Swiss vectors
# some tests carried inline) count as removed values too.
FIRST_ROUND_END = '5fbb5c199148082018d27463bcb2423b48a925cd'
RECORD = 'docs/engine-validation/SWISS-OUTPUT-REMOVAL.md'
EV = 'docs/platform/evidence/'


def git_bytes(path, commit=BASE):
    return subprocess.run(['git', 'show', '%s:%s' % (commit, path)], cwd=ROOT, check=True, capture_output=True).stdout


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value) -> bytes:
    """The removed value as compact JSON, so its SHA-256 can be checked against
    a regenerated run."""
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()


# ---------------------------------------------------------------------------
# Serialisers. Each file is written back the way it was written: by Python's
# json module or by JavaScript's JSON.stringify, with its indent, so the
# statistics it keeps do not change by a byte.
# ---------------------------------------------------------------------------

def js_number(x) -> str:
    if isinstance(x, bool):
        return 'true' if x else 'false'
    if isinstance(x, int):
        return str(x)
    if math.isnan(x) or math.isinf(x):
        return 'null'
    if x == 0:
        return '0'
    if x == int(x) and abs(x) < 1e21:
        return str(int(x))
    r = repr(abs(x))
    sign = '-' if x < 0 else ''
    if 'e' in r:
        mant, exp = r.split('e')
        exp = int(exp)
    else:
        mant, exp = r, 0
    if '.' in mant:
        ip, fp = mant.split('.')
    else:
        ip, fp = mant, ''
    digits = (ip + fp).lstrip('0')
    point = len(ip) + exp  # value = 0.<ip fp> * 10^point, before stripping
    lead = len(ip + fp) - len((ip + fp).lstrip('0'))
    n = point - lead
    digits = digits.rstrip('0') or '0'
    k = len(digits)
    if k <= n <= 21:
        return sign + digits + '0' * (n - k)
    if 0 < n <= 21:
        return sign + digits[:n] + '.' + digits[n:]
    if -6 < n <= 0:
        return sign + '0.' + '0' * (-n) + digits
    e = n - 1
    mantissa = digits[0] + ('.' + digits[1:] if k > 1 else '')
    return sign + mantissa + 'e' + ('+' if e >= 0 else '-') + str(abs(e))


def js_dumps(value, indent, level=0):
    pad = ' ' * (indent * (level + 1)) if indent else ''
    close = ' ' * (indent * level) if indent else ''
    nl = '\n' if indent else ''
    sep = ': ' if indent else ':'
    if isinstance(value, dict):
        if not value:
            return '{}'
        items = [pad + json.dumps(k, ensure_ascii=False) + sep + js_dumps(v, indent, level + 1) for k, v in value.items()]
        return '{' + nl + (',' + nl).join(items) + nl + close + '}'
    if isinstance(value, list):
        if not value:
            return '[]'
        items = [pad + js_dumps(v, indent, level + 1) for v in value]
        return '[' + nl + (',' + nl).join(items) + nl + close + ']'
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if value is None:
        return 'null'
    return js_number(value)


def serialisers():
    out = []
    for indent in (2, 1, None):
        for ascii_ in (False, True):
            out.append(('py', indent, ascii_, lambda v, i=indent, a=ascii_: json.dumps(v, indent=i, ensure_ascii=a)))
            if indent is None:
                out.append(('py-compact', indent, ascii_, lambda v, a=ascii_: json.dumps(v, separators=(',', ':'), ensure_ascii=a)))
        out.append(('js', indent, False, lambda v, i=indent: js_dumps(v, i or 0)))
    return out


def reader_writer(data: bytes):
    """Find the serialiser that reproduces the original bytes exactly."""
    text = data.decode()
    value = json.loads(text)
    for name, indent, ascii_, dump in serialisers():
        body = dump(value)
        for tail in ('\n', ''):
            if (body + tail) == text:
                return value, (lambda v, dump=dump, tail=tail: (dump(v) + tail).encode()), name
    raise SystemExit('no serialiser reproduces the original bytes')


# ---------------------------------------------------------------------------
# TOKENS: the distinctive numbers and timestamps a removed value is made of.
# scripts/lib/swiss-output-scan.mjs reads text the same way; the calibration
# list in value-digests.json holds the two to the same digests.
#
#   number     digits, a point, digits, an optional exponent, not inside a
#              word or a longer number; its absolute value, written as
#              JavaScript's Number#toString writes it; distinctive with at
#              least 7 significant digits
#   integer    12 or more digits (a millisecond clock), not a whole minute
#   timestamp  YYYY-MM-DD[T ]hh:mm:ss.f (ISO) or YYYY-Mon-DD hh:mm:ss.f
#              (Horizons), written YYYY-MM-DDThh:mm:ss.fff; distinctive
#              unless it falls on a whole minute or is 23:59:59.999
#
# The digest is the first 16 hexadecimal digits of the SHA-256 of that
# canonical text in UTF-8: a membership test over the tree, not a way back
# to the value.
# ---------------------------------------------------------------------------

NUMBER = re.compile(r'(?<![0-9A-Za-z_.])[0-9]+\.[0-9]+(?:[eE][-+]?[0-9]+)?(?![0-9A-Za-z_.])')
INTEGER = re.compile(r'(?<![0-9A-Za-z_.])[0-9]{12,}(?![0-9A-Za-z_.])')
ISO_TIME = re.compile(r'([0-9]{4})-([0-9]{2})-([0-9]{2})[T ]([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]+)')
MONTHS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
HORIZONS_TIME = re.compile(r'([0-9]{4})-(%s)-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]+)' % '|'.join(MONTHS))
DIGEST_HEX = 16


def canonical_number(text):
    x = abs(float(text))
    if math.isinf(x) or math.isnan(x):
        return None
    c = js_number(x)
    digits = c.split('e')[0].replace('.', '').strip('0')
    return c if len(digits) >= 7 else None


def canonical_integer(text):
    n = int(text)
    return str(n) if n % 60000 else None


def canonical_time(y, mo, d, h, mi, s, frac):
    ms = (frac + '000')[:3]
    if (s == '00' and ms == '000') or (h, mi, s, ms) == ('23', '59', '59', '999'):
        return None
    return '%s-%s-%sT%s:%s:%s.%s' % (y, mo, d, h, mi, s, ms)


def text_tokens(text):
    """The canonical distinctive tokens in a text, as a set."""
    out = set()
    for m in NUMBER.finditer(text):
        c = canonical_number(m.group(0))
        if c:
            out.add(c)
    for m in INTEGER.finditer(text):
        c = canonical_integer(m.group(0))
        if c:
            out.add(c)
    for m in ISO_TIME.finditer(text):
        c = canonical_time(*m.groups())
        if c:
            out.add(c)
    for m in HORIZONS_TIME.finditer(text):
        g = list(m.groups())
        g[1] = '%02d' % (MONTHS.index(g[1]) + 1)
        c = canonical_time(*g)
        if c:
            out.add(c)
    return out


def value_tokens(value):
    """The tokens of a removed JSON value: its numbers as numbers, its long
    integers as integers, and whatever its strings hold."""
    out = set()
    if isinstance(value, dict):
        for v in value.values():
            out |= value_tokens(v)
    elif isinstance(value, list):
        for v in value:
            out |= value_tokens(v)
    elif isinstance(value, str):
        out |= text_tokens(value)
    elif isinstance(value, bool) or value is None:
        pass
    elif isinstance(value, int):
        if len(str(abs(value))) >= 12:
            c = canonical_integer(str(abs(value)))
            if c:
                out.add(c)
    elif isinstance(value, float):
        c = canonical_number(repr(value))
        if c:
            out.add(c)
    return out


def token_digest(token):
    return hashlib.sha256(token.encode()).hexdigest()[:DIGEST_HEX]


CALIBRATION = ['0.00001234567891', '123.4567891', '-2397195.69247366', '1.2345678e-7', '6.02214076e23', '1500000.000000',
               '1579658400123', '2020-01-11T02:10:47.8Z', '2020-01-11 02:10:47.833456', '2148-Dec-30 07:32:35.5909',
               '1999-12-31T23:59:59.999Z', '2000-01-01T12:00:00.000Z']

# ---------------------------------------------------------------------------
# What is removed, file by file
# ---------------------------------------------------------------------------

REGEN = {
    'benchmark': 'docs/platform/evidence/swiss-benchmark/tools: node dump-zodiacs.mjs > zodiacs.json; python3 dump_swiss.py zodiacs.json <ephe> > swiss.json; node compare.mjs zodiacs.json swiss.json (RESULTS.md)',
    'precision-sweep': 'docs/platform/evidence/precision-2026-09-20/numerics: node tools/t2-sweep.mjs <kernel> <swiss-measure.json> <outdir>, the Swiss side from swiss-benchmark/tools/dump_swiss.py (numerics/RESULTS.md)',
    'precision-cells': 'docs/platform/evidence/precision-2026-09-20: node tools/dump-core-controlled.mjs <swiss.json> [--pinned], swiss.json from swiss-benchmark/tools/dump_swiss.py (CONTROLLED-BASELINE.md)',
    'precision-prototype': 'node docs/platform/evidence/swiss-benchmark/prototype/dump-prototype.mjs <de440s.bsp> <swiss.json>, swiss.json from swiss-benchmark/tools/dump_swiss.py (numerics/RESULTS.md, "the published cell D, reproduced exactly")',
    'precision-counterfactual': 'docs/platform/evidence/precision-2026-09-20/numerics: node tools/t2-core-counterfactual.mjs <outdir>, with the four cells where it reads them (tools/dump-core-controlled.mjs and swiss-benchmark/prototype/dump-prototype.mjs write them) and Swiss\'s run at /tmp/claude-0/swisslab/swiss-measure.json from swiss-benchmark/tools/dump_swiss.py (numerics/RESULTS.md)',
    'precision-holdout': 'docs/platform/evidence/precision-2026-09-20/numerics: node verify/v3-holdout.mjs, with Swiss\'s hold-out run at /tmp/claude-0/swisslab/swiss-hold.json from swiss-benchmark/tools/dump_swiss.py',
    'nutation': 'docs/platform/evidence/precision-2026-09-20/numerics: python3 tools/t1-nutation-swiss.py <t1-node.json> <ephe> (numerics/RESULTS.md)',
    'dense': 'docs/platform/evidence/precision-2026-09-20/numerics: python3 verify/v4-swiss.py, after node verify/v4-dense-dump.mjs',
    'events': 'python3 docs/platform/evidence/events-vs-swiss-2026-09-23/tools/compare.py <catalog dump> <ephe> <out.json>, on the dump tools/dump-catalog.ts writes',
    'deltat': 'DELTAT_SOURCES=<dir> python3 docs/platform/evidence/deltat-2026-09-25/tools/moon/swiss_deltat.py <ephe>',
    'sidereal': 'docs/platform/evidence/houses-2026-09-26/tools: node sidereal.mjs > sidereal.jsonl; python3 sidereal.py sidereal.jsonl (run-all.sh)',
    'holdout': 'python3 docs/platform/evidence/phase1-verdicts-2026-09-26/tools/holdout_events.py <holdout-1.4.json>, with both events-vs-swiss deltas regenerated first',
    'corpus-deltat': 'from the repository root, python3 -c "import json, sys, swisseph as swe; swe.set_ephe_path(sys.argv[1]); [print(c[\'id\'], swe.deltat_ex(c[\'jdUt\'], swe.FLG_SWIEPH) * 86400) for c in json.load(open(\'docs/platform/evidence/engine-beyond-swiss/corpora/horizons-24/corpus-tt.json\'))[\'cases\']]" <ephe>, which prints Swiss\'s Delta T at each corpus instant',
    'canon': 'no committed command: the engine audit located the four events in Swiss Ephemeris 2.10.03 with its swiss-anchors.py, which it did not commit (engine-audit-2026-09-22/LEDGER.md, verification-honesty-3, gives the method); the values are only in commit %s' % BASE,
    'parity': 'node scripts/platform-engine-report.mjs at commit %s, with the engine version the file names installed' % BASE,
    'parity-rc14': 'node scripts/platform-engine-report.mjs at commit %s, with the engine version the file names installed' % MAIN_RC14,
    'uranus': 'python3 docs/platform/evidence/precision-2026-09-20/search/verify/swiss-station.py, and search/lib/swiss-longitudes.py through search/reproduce.mjs, decompose.mjs and uranus-d.mjs, each given the fixture of commit %s from outside the repository (SWISS_WINDOW_FIXTURE or its first argument) and writing outside it' % BASE,
    'patch': 'the commit receipt as GitHub gives it: https://api.github.com/repos/aloistr/swisseph/commits/3fd0f956d73898b91cc4f67cf18b21af656d1342; its patch is Swiss Ephemeris source code and stays out of the tree',
    'vectors-tt': 'the TT of each instant as the corpus was first fetched: git show %s:docs/platform/evidence/engine-beyond-swiss/corpora/horizons-24/corpus-tt.json, or UT + Swiss\'s Delta T as under the corpus\'s own entry' % BASE,
    'retimed-horizons': 'the response as first fetched, at UT + Swiss\'s Delta T: git show %s:<path>. The one in the tree is Horizons\'s answer at UT + the engine\'s Delta T: delete it and run python3 fetch.py beside it (horizons-24/ or horizons-frame/vectors/fetch_vectors.py)' % BASE,
    'fixture-node-polar': 'docs/engine-validation/swiss-node-polar/README.md (acquire.py, generate-references.py)',
    'fixture-eight': 'python3 docs/engine-validation/swiss-eight-cases/extract-fixture.py <retained evidence> <out.json> (its README)',
    'fixture-lunar': 'python3 docs/engine-validation/swiss-lunar-return/extract-fixture.py and extract-returned-charts.py <retained evidence> <out.json> (its README)',
    'fixture-windows': 'python3 docs/engine-validation/transit-windows/project-fixtures.py <extracted archive> --output <out.json> (its README)',
}


def drop(value, path):
    """Delete value[path...] and return what was there."""
    *head, last = path
    target = value
    for key in head:
        target = target[key]
    return target.pop(last)


def rows_stats_rc8(value):
    """The statistics scripts/methodology-accuracy-claim.test.mjs and
    scripts/claims-bindings.test.mjs computed from the rows, by their own
    formulas (the comparator's quantile convention; the median of an even
    count as the mean of the middle two)."""
    rows = value['rows']

    def quantile(s, q):
        i = (len(s) - 1) * q
        lo, hi = math.floor(i), math.ceil(i)
        return s[lo] if lo == hi else s[lo] + (s[hi] - s[lo]) * (i - lo)

    within = [r for r in rows if r['stratum'] != 'future']
    future = [r for r in rows if r['stratum'] == 'future']
    a = sorted(abs(r['dLonArcsec']) for r in within)
    worst = within[0]
    for r in within:
        if abs(r['dLonArcsec']) > abs(worst['dLonArcsec']):
            worst = r
    fworst = future[0]
    for r in future:
        if abs(r['dLonArcsec']) > abs(fworst['dLonArcsec']):
            fworst = r
    moon = sorted(abs(r['dLonArcsec']) for r in within if r['body'] == 'Moon')
    return {
        'what': 'Statistics of the removed rows that the site\'s copy states, computed from them before they were removed (%s, %s) by the formulas scripts/methodology-accuracy-claim.test.mjs and scripts/claims-bindings.test.mjs used on the rows. The far-future Moon\'s two differences, first listed here case by case, left on %s (%s); the count of those cases stays.' % (DATE, UNDER, ROUND_2['on'], ROUND_2['under']),
        'withinRecord': {
            'what': 'the rows outside the far-future stratum', 'n': len(within),
            'caseIds': sorted({r['id'] for r in within}),
            'p50AbsArcsec': quantile(a, 0.5), 'p95AbsArcsec': quantile(a, 0.95), 'maxAbsArcsec': a[-1],
            'worstCase': {'id': worst['id'], 'body': worst['body']},
            'moon': {'n': len(moon), 'maxAbsArcsec': moon[-1], 'medianAbsArcsec': (moon[len(moon) // 2 - 1] + moon[len(moon) // 2]) / 2},
        },
        'farFuture': {
            'what': 'the far-future stratum', 'n': len(future),
            'overOneArcminute': sum(1 for r in future if abs(r['dLonArcsec']) > 60),
            'worstCase': {'id': fworst['id'], 'body': fworst['body'], 'absArcsec': abs(fworst['dLonArcsec'])},
            'moon': {'n': sum(1 for r in future if r['body'] == 'Moon')},
        },
    }


def rc8_moon_cases(value):
    """What the statistics block listed case by case until 2026-09-29: each
    far-future Moon row's difference, which with the engine's own Moon gives
    Swiss's back. Recorded here as removed, by its digest."""
    future = [r for r in value['rows'] if r['stratum'] == 'future']
    return ('.statistics.farFuture.moonCases', [{'id': r['id'], 'absArcsec': abs(r['dLonArcsec'])} for r in future if r['body'] == 'Moon'],
            'the far-future Moon\'s difference from Swiss at each of its two epochs, which the statistics listed case by case')


def sidereal_stats(value):
    rows = value['rows']
    worst = max(rows, key=lambda r: abs(r['swissMinusErfa']))
    return {
        'what': 'Swiss\'s apparent sidereal time minus ERFA\'s over the %d dates, in arcseconds: the largest difference, with its date, which README.md quotes. The per-date differences were removed on %s (%s).' % (len(rows), DATE, UNDER),
        'n': len(rows),
        'largest': {'utc': worst['utc'], 'swissMinusErfa': worst['swissMinusErfa']},
    }


def strip_rows(what, regen):
    return {'paths': [['rows']], 'what': what, 'regen': regen}


BENCH_ROWS = 'per-case engine-minus-Swiss differences in longitude, latitude and speed'
SPEC = {}
for name in ('report-measure.json', 'report-holdout-core.json', 'report-holdout-prototype.json', 'report-prototype-matched.json'):
    SPEC[EV + 'swiss-benchmark/' + name] = strip_rows(BENCH_ROWS, 'benchmark')
SPEC[EV + 'swiss-benchmark/report-measure-rc8.json'] = {**strip_rows(BENCH_ROWS, 'benchmark'), 'add': ('statistics', rows_stats_rc8),
                                                         'dropped': rc8_moon_cases}
for name in ('raw/cmp-A-core-own.json', 'raw/cmp-B-core-pinned.json', 'raw/cmp-C-proto-own.json', 'raw/cmp-D-proto-pinned.json',
             'raw/recovered-report-proto-engine-deltat.json', 'numerics/raw/repro-cellD-report.json',
             'numerics/verify/p8-report.json', 'numerics/verify/repro-cellD-report.json',
             'numerics/verify/holdout-p0-prototype-report.json', 'numerics/verify/holdout-p8-best-report.json',
             'numerics/verify/holdout-p8a-best-2000a-report.json'):
    SPEC[EV + 'precision-2026-09-20/' + name] = strip_rows(BENCH_ROWS, 'benchmark' if name.startswith('raw/') else 'precision-sweep')
SWEEP_VARIANTS = ('a-aberration-first-order', 'a-aberration-off', 'a-bias-off', 'a-deflection-off', 'a-light-time-1-iteration',
                  'a-light-time-2-iterations', 'a-nutation-back-to-ae', 'a-observer-velocity-h-600s', 'a-observer-velocity-h-60s',
                  'a-tdb-off-tt-as-tdb-', 'p0-prototype-as-shipped', 'p1-iau2000b-nutation', 'p1a-iau2000a-nutation',
                  'p2-frame-bias-only', 'p3-2000b-frame-bias', 'p4-2000b-bias-tdb', 'p5-2000b-bias-tdb-deflection',
                  'p6-full-aberration-too', 'p7-analytic-observer-velocity', 'p8-best-light-time-to-1e-11', 'p8a-best-with-iau2000a')
for variant in SWEEP_VARIANTS:
    SPEC[EV + 'precision-2026-09-20/numerics/raw/sweep/report-%s.json' % variant] = strip_rows(BENCH_ROWS, 'precision-sweep')

CELL_FILES = ['raw/cellA-core-own.json', 'raw/cellB-core-pinned.json']
for d in ('numerics/raw/counterfactual/', 'numerics/verify/counterfactual/'):
    for stem in ('cellA-core-own-common', 'cellA-core-own-nut2000b-common', 'cellA-core-own-nut2000b',
                 'cellB-core-pinned-common', 'cellB-core-pinned-nut2000b-common', 'cellB-core-pinned-nut2000b'):
        CELL_FILES.append(d + stem + '.json')
for name in CELL_FILES:
    SPEC[EV + 'precision-2026-09-20/' + name] = {'cases': True, 'what': 'Swiss\'s Delta T for each case',
                                                 'regen': 'precision-cells' if name.startswith('raw/') else 'precision-counterfactual'}

# Positions computed on Swiss's clock. To hold the clock fixed against Swiss,
# cell B ran the engine, and cell D, the sweep, the reproduction of cell D and
# the hold-out runs ran the DE prototype, at each case's UT + Swiss's Delta T.
# Beside the same program at its own clock (cells A and C), the Moon's
# difference over its speed gives that Delta T back: to 0.012 s from cell B
# and 0.0034 s from cell D.
PINNED_CORE = ('the engine\'s positions and angles at each case\'s UT + Swiss\'s Delta T; beside cell A\'s, at the engine\'s '
               'own clock, the Moon\'s difference over its speed gives that Delta T back to within 0.012 s')
PINNED_PROTOTYPE = ('the DE prototype\'s positions at each case\'s UT + Swiss\'s Delta T; beside cell C\'s, at the prototype\'s '
                    'own clock, the Moon\'s difference over its speed gives that Delta T back to within 0.0034 s')
PINNED_SWEEP = ('the variant\'s positions at each case\'s UT + Swiss\'s Delta T: the DE prototype under the variant\'s settings, '
                'on the clock of cell D, whose positions give that Delta T back')
PINNED_HOLDOUT = ('the DE prototype\'s positions at each hold-out case\'s UT + Swiss\'s Delta T, the clock of cell D on the '
                  'hold-out set; the prototype run at each case\'s UT gives that Delta T back from them')
for name in CELL_FILES:
    if 'cellB-' in name:
        SPEC[EV + 'precision-2026-09-20/' + name]['later'] = [('.cases[].bodies|angles', PINNED_CORE)]
PINNED_FILES = {'raw/cellD-proto-pinned.json': ('precision-prototype', PINNED_PROTOTYPE),
                'numerics/raw/repro-cellD-dump.json': ('precision-prototype', PINNED_PROTOTYPE),
                'numerics/verify/repro-cellD-dump.json': ('precision-prototype', PINNED_PROTOTYPE)}
for d in ('numerics/raw/counterfactual/', 'numerics/verify/counterfactual/'):
    for stem in ('cellD-proto-pinned-common', 'cellD-proto-pinned-nut2000b-common', 'cellD-proto-pinned-nut2000b'):
        PINNED_FILES[d + stem + '.json'] = ('precision-counterfactual', PINNED_PROTOTYPE)
for d in ('numerics/raw/sweep/', 'numerics/verify/sweep/'):
    for variant in SWEEP_VARIANTS:
        PINNED_FILES[d + 'sweep-%s.json' % variant] = ('precision-sweep', PINNED_SWEEP)
for name in ('holdout-p0-prototype', 'holdout-p8-best', 'holdout-p8a-best-2000a'):
    PINNED_FILES['numerics/verify/%s.json' % name] = ('precision-holdout', PINNED_HOLDOUT)
for name, (regen, what) in PINNED_FILES.items():
    SPEC[EV + 'precision-2026-09-20/' + name] = {'round': ROUND_2, 'regen': regen, 'what': what,
                                                 'take': [('.cases[].bodies', None)]}

for folder in ('events-vs-swiss-2026-09-23', 'events-vs-swiss-2026-09-25'):
    SPEC[EV + folder + '/deltas.json'] = {'rowsField': ('deltas', ['deltaSeconds']), 'paths': [['summary', 'swissDeltaTSeconds2026']],
                                         'what': 'the published instant minus Swiss\'s, per event (deltaSeconds), and Swiss\'s Delta T in 2026', 'regen': 'events'}
SPEC[EV + 'deltat-2026-09-25/outputs/swiss-deltat.json'] = {
    'paths': [['seconds'], ['before1962', 'swissMinusS15_2016_at'], ['at1000']],
    'what': 'Swiss\'s Delta T at 2026-09-22, 2050 and 2100, and its differences from the S15 reconstructions at 1800, 1850, 1900 and 1000',
    'regen': 'deltat'}
SPEC[EV + 'houses-2026-09-26/results/sidereal.json'] = {'rowsField': ('rows', ['swissMinusErfa']), 'what': 'Swiss\'s apparent sidereal time minus ERFA\'s, per date',
                                                         'regen': 'sidereal', 'add': ('swissMinusErfaStatistics', sidereal_stats)}
SPEC[EV + 'phase1-verdicts-2026-09-26/results/holdout-1.4-events.json'] = {
    'rowsField': ('rows', ['minusSwissSeconds', 'rc7MinusSwissSeconds']), 'what': 'each drawn event\'s instant minus Swiss\'s, for rc.8 and rc.7', 'regen': 'holdout'}
SPEC[EV + 'engine-beyond-swiss/corpora/canon-events.json'] = {
    'canon': True, 'text': True, 'what': 'Swiss\'s residual from the canon for each of the four events (the engine\'s and the alpha\'s stay)', 'regen': 'canon'}
PARITY = [EV + 'independent-node-polar-node22.json', EV + 'independent-node-polar-node24.json']
for rc in ('site-engine-rc5/independent-node-polar-node', 'site-engine-rc7/node', 'site-engine-rc8/node', 'site-engine-rc9/node', 'site-engine-rc10/node'):
    for n in ('22', '24'):
        PARITY.append(EV + rc + n + ('-parity.json' if not rc.endswith('polar-node') else '.json'))
for name in PARITY:
    SPEC[name] = {'paths': [['nodes'], ['polar']], 'what': 'per-case differences from the Swiss node/polar fixture (three node epochs, three polar places in two house systems); the maxima stay',
                  'regen': 'parity'}
for n in ('22', '24'):
    SPEC[EV + 'site-engine-rc14/node' + n + '-parity.json'] = {
        'paths': [['nodes'], ['polar']], 'round': ROUND_2, 'base': MAIN_RC14, 'regen': 'parity-rc14',
        'what': 'per-case differences from the Swiss node/polar fixture (three node epochs, three polar places in two house systems), which #600 recorded for rc.14 on 2026-09-29 after the second round began and which were removed on 2026-09-30; the maxima stay'}
COMPONENT_ENDS = 'Swiss\'s component ends, the ends of an hourly Swiss scan of the 3-degree orb'
for base in ('search/raw/', 'search/verify/raw-original/'):
    SPEC[EV + 'precision-2026-09-20/' + base + 'decomposition.json'] = {
        'paths': [['sources', 'ephemerisModel', 'atTheTurningPointItself', 'swissLongitude']],
        'what': 'Swiss\'s longitude of Uranus at the D turning point (the differences and the margin the analysis cites stay)', 'regen': 'uranus',
        'later': [
            ('.sources.ephemerisModel.overComponent.fromUtc|toUtc', 'the 6-hourly grid over the second component, which starts at Swiss\'s component start and so ends at a fixed step from it'),
            ('.sources.ephemerisModel.atTheTurningPointItself.deMinusSwissArcsec|coreMinusSwissArcsec', 'the DE prototype\'s and the engine\'s difference from Swiss at the turning point, which with their longitudes beside them give Swiss\'s back'),
            ('.sources.timeModel.thisWindowIsHistorical.swissReturnedTtMinusUtcSeconds|residualSeconds', 'Swiss\'s own TT - UTC for the window, and its difference from 69.184 s'),
            ('.stationaryGeometryAudit.theRightTreatment.recordedPossibleExactRegionUtc', 'the ends of the region Swiss\'s scan found the second component\'s exact passes possible in (its width and the DE level set\'s difference from it stay)'),
        ]}
    SPEC[EV + 'precision-2026-09-20/' + base + 'reproduction.json'] = {
        'paths': [['independentReproduction', 'swiss', k] for k in ('stationUtc', 'stationLongitudeDegrees', 'stationSpeedDegPerDay')],
        'what': 'Swiss\'s instant, longitude and speed of the Uranus station of D (the margin it gives stays)', 'regen': 'uranus',
        'later': [
            ('.recordedContract.components[].startUtc|endUtc|possibleExactRegionUtc|possibleMinimumRegionUtc', COMPONENT_ENDS + ', and the regions its exact passes and minimum were possible in'),
            ('.independentReproduction.swiss.signedStationMinusTargetDegrees|ttMinusUtcSeconds', 'Swiss\'s station minus the target, which with the target beside it gives Swiss\'s station longitude back, and Swiss\'s own TT - UTC'),
        ]}
    SPEC[EV + 'precision-2026-09-20/' + base + 'uranus-d.json'] = {
        'round': ROUND_2, 'regen': 'uranus',
        'what': 'Swiss\'s figures for the D case that the DE-prototype search was run beside: the component ends it searched between, the crop-boundary orbs, and Swiss\'s offset from the level at the 2020-01-01 boundary (the DE figures, the margins and the verdicts stay)',
        'take': [
            ('.results.perComponentExactLevel[].fromUtc|toUtc', COMPONENT_ENDS + ', used as the searched intervals'),
            ('.results.crops.halves[].recordedBoundaryOrbDegrees', 'Swiss\'s orb at each crop boundary'),
            ('.results.crops.theBoundaryEvent.swissOffsetFromLevelDegrees|swissOffsetFromLevelArcsec|recordedCropBoundaryOrbDegrees|deMinusSwissAtTheBoundaryArcsec|rootOffsetFromBoundarySecondsSwiss', 'Swiss\'s offset from the level at the crop boundary, in degrees, arcseconds and seconds of motion, and the DE prototype\'s difference from it'),
        ]}
SPEC['docs/engine-validation/swiss-node-polar/receipts/swisseph-master-commit.json'] = {
    'round': ROUND_2, 'regen': 'patch', 'patches': True,
    'what': 'the patch of each file the commit changed, as GitHub\'s API returns it: 148 lines of swetest.c, Swiss Ephemeris source code (the commit\'s identity, author, date and statistics stay; acquire.py reads only its sha)',
    'take': [('.files[].patch', None)]}
SPEC[EV + 'engine-beyond-swiss/horizons-frame/vectors/results.json'] = {
    'round': ROUND_2, 'regen': 'vectors-tt',
    'what': 'the TT of each corpus instant as first fetched, UT + Swiss\'s Delta T, which beside the UT instant gives that Delta T back (the ephemeris differences stay)',
    'take': [('.instants[].jdTdb', None)]}

EB = EV + 'engine-beyond-swiss/'
RETIMED = 'Horizons\'s answer at the corpus\'s TT instants as first fetched, UT + Swiss\'s Delta T, which its time column gave back beside the UT instants of corpus.json; replaced by its answer at UT + the engine\'s Delta T'
REPLACED = {EB + 'corpora/horizons-24/%s.txt' % name: (RETIMED, 'retimed-horizons')
            for name in ('Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'MarsBary', 'Jupiter', 'JupiterBary', 'Saturn', 'SaturnBary',
                         'Uranus', 'UranusBary', 'Neptune', 'NeptuneBary', 'Pluto', 'PlutoBary')}
for name in ('Moon', 'Mars', 'MarsBary'):
    REPLACED[EB + 'horizons-frame/vectors/%s.txt' % name] = (RETIMED.replace('Horizons\'s answer', 'Horizons\'s geometric state vectors'), 'retimed-horizons')
REPLACED[EB + 'horizons-frame/vectors/queries.log'] = ('the queries of the first fetch, whose TLIST carried the TT instants at UT + Swiss\'s Delta T; replaced by the queries at UT + the engine\'s Delta T', 'retimed-horizons')
REPLACED[EB + 'corpora/horizons-24/corpus-tt.json'] = (
    'the corpus\'s TT instants at UT + Swiss\'s Delta T, and that Delta T; replaced by TT at UT + the engine\'s Delta T (node docs/platform/evidence/engine-beyond-swiss/corpora/tools/retime-corpus.mjs)',
    'corpus-deltat')
# What left corpus-tt.json, with the round it left in.
CORPUS_REMOVED = [('.cases[].deltaTSeconds', ROUND_1, None), ('.cases[].jdTt', ROUND_2, 'the TT instants at UT + Swiss\'s Delta T')]

REMOVE = {
    'src/lib/engine/fixtures/swiss-node-polar.fixture.json': ('Swiss true node (three epochs) and whole-sign angles and cusps (three polar places)', 'fixture-node-polar'),
    'src/lib/engine/fixtures/swiss-eight-cases.fixture.json': ('Swiss positions at three epochs, two stations, a solar return with two charts and a Saturn return', 'fixture-eight'),
    'src/lib/engine/fixtures/swiss-lunar-returns.fixture.json': ('Swiss lunar-return instants, bands and charts for six cases', 'fixture-lunar'),
    'src/lib/engine/fixtures/swiss-lunar-returned-charts.fixture.json': ('Swiss charts at the seven instants the product returned', 'fixture-lunar'),
    'src/lib/engine/fixtures/transit-window-independent.json': ('Swiss transit-window components, bands, minima and crops for the nine A-I cases', 'fixture-windows'),
    'src/lib/engine/fixtures/swiss-lunar-return-policy.json': ('the lunar-return policy, whose L-wrap birth instant was the first 0-degree crossing of Swiss\'s Moon after 2000-01-01; superseded by independent-lunar-return-policy.json, which carries its other cases, its gates and its conditioning unchanged', 'fixture-lunar'),
    EV + 'precision-2026-09-20/numerics/raw/t1-swiss.json': ('Swiss nutation and obliquity at 1,964 instants', 'nutation'),
    EV + 'precision-2026-09-20/numerics/verify/t1-swiss.json': ('the same 1,964 instants, rerun', 'nutation'),
    EV + 'precision-2026-09-20/numerics/verify/v1-swiss.json': ('Swiss nutation and obliquity at 2,945 instants', 'nutation'),
    EV + 'precision-2026-09-20/numerics/verify/v4-dense-diff.json': ('prototype minus Swiss for ten bodies at 600 instants, beside the prototype\'s own values in v4-dense.json', 'dense'),
}


def path_text(path):
    return ''.join('.%s' % p for p in path)


def removal_entry(label, value, what=None):
    data = canonical(value)
    count = len(value) if isinstance(value, (list, dict)) else 1
    entry = {'path': label, 'count': count, 'sha256': sha(data), 'bytes': len(data)}
    if what:
        entry['what'] = what
    return entry


def take(value, pathspec):
    """Remove the fields a path names and return them. '.a.b' descends, 'x[]'
    takes every element of an array, and the last segment names one key or
    several joined by '|'. Through an array it returns one object per element,
    holding the fields taken from it; to one key, its value; to several, an
    object."""
    segments = pathspec[1:].split('.')

    def walk(node, segs):
        if len(segs) == 1:
            return {k: node.pop(k) for k in segs[0].split('|') if k in node}
        if segs[0].endswith('[]'):
            return [walk(item, segs[1:]) for item in node[segs[0][:-2]]]
        return walk(node[segs[0]], segs[1:])
    got = walk(value, segments)
    if '[]' not in pathspec and '|' not in segments[-1]:
        return got[segments[-1]]
    return got


def dated(entry, round_):
    """A removal made after the file's first one carries its own date and decision."""
    return {**entry, **round_}


def transform(path, spec, value):
    removed = []
    added = None
    round_ = spec.get('round', ROUND_1)
    if 'add' in spec:
        key, fn = spec['add']
        added = (key, fn(value))
    dropped = spec['dropped'](value) if 'dropped' in spec else None
    if spec.get('cases'):
        pinned = value.get('timePolicy') == 'matched-to-reference'
        fields = ['deltaTReferenceSeconds'] + (['deltaTAppliedSeconds'] if pinned else [])
        taken = []
        for case in value['cases']:
            taken.append({f: case.pop(f) for f in fields if f in case})
        removed.append(removal_entry('.cases[].' + '|'.join(fields), taken,
                                     'Swiss\'s Delta T for each case' + (', which this pinned cell also applied' if pinned else '')))
    if 'rowsField' in spec:
        array, fields = spec['rowsField']
        taken = []
        for row in value[array]:
            taken.append({f: row.pop(f) for f in fields if f in row})
        removed.append(removal_entry('.%s[].%s' % (array, '|'.join(fields)), taken))
    if spec.get('canon'):
        taken = {}
        for event, row in value['baseline'].items():
            if isinstance(row, dict) and 'swiss' in row:
                taken[event] = row.pop('swiss')
        removed.append(removal_entry('.baseline.<event>.swiss', taken))
    for p in spec.get('paths', []):
        removed.append(removal_entry(path_text(p), drop(value, p)))
    for pathspec, what in spec.get('take', []):
        patches = None
        if spec.get('patches'):
            patches = [{'file': f['filename'], 'sha256': sha(f['patch'].encode()), 'bytes': len(f['patch'].encode()),
                        'lines': f['patch'].count('\n') + 1} for f in value['files'] if 'patch' in f]
        entry = removal_entry(pathspec, take(value, pathspec), what)
        if patches is not None:
            entry['patches'] = patches
        removed.append(entry)
    for pathspec, what in spec.get('later', []):
        removed.append(dated(removal_entry(pathspec, take(value, pathspec), what), ROUND_2))
    if dropped:
        removed.append(dated(removal_entry(*dropped), ROUND_2))
    if added:
        value[added[0]] = added[1]
    marker = {
        'on': round_['on'],
        'under': round_['under'],
        'what': spec['what'] if 'what' in spec else BENCH_ROWS,
        'removed': removed,
        'fileBefore': None,
        'lastCommitWithTheValues': spec.get('base', BASE),
        'regenerate': REGEN[spec['regen']],
        'record': RECORD,
    }
    return value, marker


def text_edit(data, spec):
    """canon-events.json is laid out by hand, one event per line; its Swiss
    column is cut from the text so every other byte stays."""
    text = data.decode()
    taken = {}

    def cut(m):
        taken[m.group(1)] = json.loads(m.group(2))
        return m.group(0)[:m.start(2) - m.start(0) - len(', "swiss": ')] + ' }'
    text = re.sub(r'"([\w-]+)": \{ "engine": [-0-9.]+, "alpha": [-0-9.]+, "swiss": (-?[0-9.]+) \}', cut, text)
    marker = {'on': DATE, 'under': UNDER, 'what': spec['what'], 'removed': [removal_entry('.baseline.<event>.swiss', taken)],
              'fileBefore': {'bytes': len(data), 'sha256': sha(data)}, 'lastCommitWithTheValues': BASE,
              'regenerate': REGEN[spec['regen']], 'record': RECORD}
    block = json.dumps({'swissOutputRemoved': marker}, indent=1, ensure_ascii=False)
    inner = block[block.index('\n') + 1:block.rindex('\n')]
    assert text.endswith('\n }\n}\n')
    text = text[:-len('\n}\n')] + ',\n' + inner + '\n}\n'
    json.loads(text)
    return text.encode(), marker, 'text'


# The removed transit-window fixture's own fields that hold no Swiss value:
# the pack's status and its sources' digests, which its test still checks.
REMOVED_FILE_FIELDS = {
    'src/lib/engine/fixtures/transit-window-independent.json': ['originalPackStatus', 'qualifiedDSourceAcceptedByRoot', 'sourceHashes'],
}

# ---------------------------------------------------------------------------
# The tree, read as scripts/lib/swiss-output-scan.mjs reads it: every file
# under src/ and every data or code file elsewhere that is tracked or would be
# added (not ignored), with the members of archives, three levels deep.
# ---------------------------------------------------------------------------

SELF = 'docs/engine-validation/swiss-output-removal/'
DATA_EXTENSIONS = {'.json', '.jsonl', '.ndjson', '.geojson', '.csv', '.tsv', '.txt', '.log', '.dat', '.yml', '.yaml', '.xml',
                   '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx', '.py', '.sh', '.c', '.h', '.patch', '.diff',
                   '.raw', '.out', '.err', '.stderr', '.query', '.html', '.htm', '.svg', '.astro', '.sql', '.toml'}


def scanned(name, top):
    return top.startswith('src/') or os.path.splitext(name.lower())[1] in DATA_EXTENSIONS


def tree_tokens():
    import gzip
    import io
    import tarfile
    import zipfile
    import zlib
    found = set()

    def visit(name, top, data, depth):
        low = name.lower()
        if depth < 3:
            try:
                if low.endswith(('.tgz', '.tar.gz')):
                    raw = gzip.decompress(data)
                    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as tar:
                        for m in tar.getmembers():
                            if m.isfile():
                                visit(m.name, top, tar.extractfile(m).read(), depth + 1)
                    return
                if low.endswith('.tar'):
                    with tarfile.open(fileobj=io.BytesIO(data), mode='r:') as tar:
                        for m in tar.getmembers():
                            if m.isfile():
                                visit(m.name, top, tar.extractfile(m).read(), depth + 1)
                    return
                if low.endswith('.gz'):
                    visit(name[:-3], top, gzip.decompress(data), depth + 1)
                    return
                if low.endswith('.zip'):
                    with zipfile.ZipFile(io.BytesIO(data)) as z:
                        for info in z.infolist():
                            if not info.is_dir():
                                visit(info.filename, top, z.read(info), depth + 1)
                    return
            except (OSError, EOFError, tarfile.TarError, zipfile.BadZipFile, ValueError, zlib.error):
                pass  # not the archive its name says: read it as a plain file
        if not scanned(name, top if depth == 0 else name):
            return
        found.update(text_tokens(data.decode('utf-8', errors='replace')))

    listed = subprocess.run(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT, check=True,
                            capture_output=True).stdout.decode().split('\0')
    files = sorted(set(listed))
    for path in files:
        full = os.path.join(ROOT, path)
        if path.startswith(SELF):
            continue  # this record: its digests are not values
        if path and os.path.isfile(full) and not os.path.islink(full):
            with open(full, 'rb') as f:
                visit(path, path, f.read(), 0)
    return found


def removed_tokens(stripped_values):
    """Every distinctive token of what was removed: the removed files, the
    fields taken from the stripped ones, the replaced files as first
    committed, and the lines the first removal deleted under src/."""
    tokens = set()
    for path in REMOVE:
        data = git_bytes(path)
        try:
            tokens |= value_tokens(json.loads(data))
        except ValueError:
            tokens |= text_tokens(data.decode('utf-8', errors='replace'))
    for value in stripped_values:
        tokens |= value_tokens(value)
    for path in REPLACED:
        tokens |= text_tokens(git_bytes(path).decode('utf-8', errors='replace'))
    diff = subprocess.run(['git', 'diff', '-U0', BASE, FIRST_ROUND_END, '--', 'src'], cwd=ROOT, check=True, capture_output=True).stdout
    for line in diff.decode('utf-8', errors='replace').splitlines():
        if line.startswith('-') and not line.startswith('---'):
            tokens |= text_tokens(line[1:])
    return tokens


def main(argv):
    check = '--check' in argv
    manifest = {
        'what': 'Swiss Ephemeris output removed from the tree on %s under %s and on %s under %s. Every file and field removed, and every file replaced by an independent rebuild, with the SHA-256 of what was removed, the commit that still has it, and the command that regenerates it; value-digests.json holds the digests of the distinctive values removed. Made by strip.py beside this file.' % (ROUND_1['on'], ROUND_1['under'], ROUND_2['on'], ROUND_2['under']),
        'base': BASE,
        'rounds': [ROUND_1, ROUND_2],
        'removedFiles': [],
        'strippedFiles': [],
        'replacedFiles': [],
        'valueDigests': None,
    }
    problems = []
    stripped_values = []
    for path, (what, regen) in sorted(REMOVE.items()):
        data = git_bytes(path)
        entry = {'path': path, 'bytes': len(data), 'sha256': sha(data), 'what': what,
                 'lastCommitWithTheFile': BASE, 'regenerate': REGEN[regen]}
        if path in REMOVED_FILE_FIELDS:
            value = json.loads(data)
            entry['nonSwissFields'] = {k: value[k] for k in REMOVED_FILE_FIELDS[path]}
        manifest['removedFiles'].append(entry)
        full = os.path.join(ROOT, path)
        if check:
            if os.path.exists(full):
                problems.append('%s still exists' % path)
        elif os.path.exists(full):
            subprocess.run(['git', 'rm', '-q', path], cwd=ROOT, check=True)
    for path, spec in sorted(SPEC.items()):
        data = git_bytes(path, spec.get('base', BASE))
        if spec.get('text'):
            out, marker, style = text_edit(data, spec)
            stripped_values.append([json.loads(m.group(1)) for m in re.finditer(r'"swiss": (-?[0-9.]+)', data.decode())])
        else:
            value, write, style = reader_writer(data)
            before = json.loads(data)
            value, marker = transform(path, spec, value)
            marker['fileBefore'] = {'bytes': len(data), 'sha256': sha(data)}
            value['swissOutputRemoved'] = marker
            out = write(value)
            stripped_values.append(removed_values(before, spec))
        manifest['strippedFiles'].append({'path': path, 'serialiser': style, 'before': marker['fileBefore'],
                                          'after': {'bytes': len(out), 'sha256': sha(out)},
                                          'removed': marker['removed'], 'regenerate': marker['regenerate']})
        full = os.path.join(ROOT, path)
        if check:
            if open(full, 'rb').read() != out:
                problems.append('%s differs from what strip.py makes' % path)
        else:
            with open(full, 'wb') as f:
                f.write(out)
    for path, (what, regen) in sorted(REPLACED.items()):
        before = git_bytes(path)
        full = os.path.join(ROOT, path)
        now = open(full, 'rb').read() if os.path.exists(full) else b''
        if sha(now) == sha(before):
            problems.append('%s is still the file that gave Swiss\'s values back' % path)
        entry = {'path': path, **ROUND_2, 'what': what, 'before': {'bytes': len(before), 'sha256': sha(before)},
                 'after': {'bytes': len(now), 'sha256': sha(now)}}
        if path.endswith('corpus-tt.json'):
            base = json.loads(before)
            entry['removed'] = []
            for pathspec, round_, note in CORPUS_REMOVED:
                taken = take(json.loads(before), pathspec)
                stripped_values.append(taken)
                item = removal_entry(pathspec, taken, note)
                entry['removed'].append(item if round_ is ROUND_1 else dated(item, round_))
            assert base['cases']
        entry.update({'lastCommitWithTheValues': BASE, 'regenerate': REGEN[regen]})
        manifest['replacedFiles'].append(entry)

    gone_and_kept = sorted({token_digest(t) for t in removed_tokens(stripped_values)})
    digests_path = os.path.join(HERE, 'value-digests.json')
    if check:
        committed = json.load(open(digests_path))
        gone, kept = committed['gone'], committed['kept']
        if sorted(gone + kept) != gone_and_kept or set(gone) & set(kept):
            problems.append('value-digests.json is not the digests of what was removed')
        if committed['calibration'] != [{'text': t, 'digests': sorted(token_digest(x) for x in text_tokens(t))} for t in CALIBRATION]:
            problems.append('value-digests.json\'s calibration is not what strip.py makes')
    else:
        present = {token_digest(t) for t in tree_tokens()}
        committed = {
            'what': 'Digests of the distinctive numbers and timestamps of every value removed from the tree under %s and %s (strip.py beside this file; TOKENS there says what a token is). "gone": no data file and nothing under src/ holds them, and scripts/swiss-output-guard.test.mjs fails if one comes back. "kept": they still appear there, as the inputs, reference values and statistics SWISS-OUTPUT-REMOVAL.md lists.' % (ROUND_1['under'], ROUND_2['under']),
            'digest': 'the first %d hexadecimal digits of the SHA-256 of the canonical token in UTF-8' % DIGEST_HEX,
            'calibration': [{'text': t, 'digests': sorted(token_digest(x) for x in text_tokens(t))} for t in CALIBRATION],
            'gone': [d for d in gone_and_kept if d not in present],
            'kept': [d for d in gone_and_kept if d in present],
        }
        with open(digests_path, 'w') as f:
            f.write(json.dumps(committed, indent=0, ensure_ascii=False) + '\n')
    manifest['valueDigests'] = {'path': rel_here('value-digests.json'), 'sha256': sha(open(digests_path, 'rb').read()),
                                'gone': len(committed['gone']), 'kept': len(committed['kept'])}
    text = json.dumps(manifest, indent=1, ensure_ascii=False) + '\n'
    target = os.path.join(HERE, 'manifest.json')
    if check:
        if open(target).read() != text:
            problems.append('manifest.json differs from what strip.py makes')
        if problems:
            raise SystemExit('\n'.join(problems))
        print('ok: %d files removed, %d stripped, %d replaced; %d value digests gone, %d kept' % (
            len(manifest['removedFiles']), len(manifest['strippedFiles']), len(manifest['replacedFiles']),
            len(committed['gone']), len(committed['kept'])))
    else:
        if problems:
            raise SystemExit('\n'.join(problems))
        with open(target, 'w') as f:
            f.write(text)
        print('removed %d files, stripped %d, replaced %d; %d value digests gone, %d kept' % (
            len(manifest['removedFiles']), len(manifest['strippedFiles']), len(manifest['replacedFiles']),
            len(committed['gone']), len(committed['kept'])))


def rel_here(name):
    return os.path.relpath(os.path.join(HERE, name), ROOT).replace(os.sep, '/')


def removed_values(before, spec):
    """What transform takes from a file, taken again from a fresh copy of it."""
    taken = []
    original = json.loads(json.dumps(before))
    if spec.get('cases'):
        fields = ['deltaTReferenceSeconds'] + (['deltaTAppliedSeconds'] if original.get('timePolicy') == 'matched-to-reference' else [])
        taken.append([{k: c.get(k) for k in fields} for c in original['cases']])
    if 'rowsField' in spec:
        array, fields = spec['rowsField']
        taken.append([{f: r.get(f) for f in fields} for r in original[array]])
    for p in spec.get('paths', []):
        node = original
        for key in p:
            node = node[key]
        taken.append(node)
    for pathspec, _ in spec.get('take', []) + spec.get('later', []):
        taken.append(take(json.loads(json.dumps(original)), pathspec))
    if 'dropped' in spec:
        taken.append(spec['dropped'](original)[1])
    return taken


if __name__ == '__main__':
    main(sys.argv[1:])
