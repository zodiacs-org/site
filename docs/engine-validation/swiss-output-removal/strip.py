#!/usr/bin/env python3
"""Removes Swiss Ephemeris output from the tree, as DECISIONS-2026-09-28 section 3 asks.

    python3 docs/engine-validation/swiss-output-removal/strip.py           # apply, from 2ca93d41's bytes
    python3 docs/engine-validation/swiss-output-removal/strip.py --check   # verify the tree matches

Reads each file as it was at BASE (the last commit with every value), and
  * deletes the files that are Swiss output (REMOVE),
  * deletes the per-case Swiss values from the files that mix them with
    statistics (STRIP), keeping every statistic byte for byte, and records in
    the file what was removed, with its SHA-256,
then writes manifest.json beside this file: every removed file and field,
with the SHA-256 and size of what was removed and the command that
regenerates it. Nothing is computed from Swiss here; the statistics a test
reads are computed from the rows before they are removed, by the same
formulas the tests used, and recorded as statistics.

What counts as Swiss output: a value Swiss Ephemeris returned (a position,
a speed, a cusp, an angle, an event time, a Delta T), and a table that gives,
for every case of a set, Swiss's value or its difference from a reproducible
engine, arbiter or reference, since either gives Swiss's value back. What
stays: statistics (counts, means, percentiles, extremes with the case they
came from), digests, the few figures an analysis or report cites for one case
it examines, and the scripts that regenerate Swiss's values on demand.
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
DATE = '2026-09-28'
UNDER = 'docs/platform/programme/DECISIONS-2026-09-28.md §3'
RECORD = 'docs/engine-validation/SWISS-OUTPUT-REMOVAL.md'
EV = 'docs/platform/evidence/'


def git_bytes(path):
    return subprocess.run(['git', 'show', '%s:%s' % (BASE, path)], cwd=ROOT, check=True, capture_output=True).stdout


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
# What is removed, file by file
# ---------------------------------------------------------------------------

REGEN = {
    'benchmark': 'docs/platform/evidence/swiss-benchmark/tools: node dump-zodiacs.mjs > zodiacs.json; python3 dump_swiss.py zodiacs.json <ephe> > swiss.json; node compare.mjs zodiacs.json swiss.json (RESULTS.md)',
    'precision-sweep': 'docs/platform/evidence/precision-2026-09-20/numerics: node tools/t2-sweep.mjs <kernel> <swiss-measure.json> <outdir>, the Swiss side from swiss-benchmark/tools/dump_swiss.py (numerics/RESULTS.md)',
    'precision-cells': 'docs/platform/evidence/precision-2026-09-20: node tools/dump-core-controlled.mjs <swiss.json> [--pinned], swiss.json from swiss-benchmark/tools/dump_swiss.py (CONTROLLED-BASELINE.md)',
    'nutation': 'docs/platform/evidence/precision-2026-09-20/numerics: python3 tools/t1-nutation-swiss.py <t1-node.json> <ephe> (numerics/RESULTS.md)',
    'dense': 'docs/platform/evidence/precision-2026-09-20/numerics: python3 verify/v4-swiss.py, after node verify/v4-dense-dump.mjs',
    'events': 'python3 docs/platform/evidence/events-vs-swiss-2026-09-23/tools/compare.py <catalog dump> <ephe> <out.json>, on the dump tools/dump-catalog.ts writes',
    'deltat': 'DELTAT_SOURCES=<dir> python3 docs/platform/evidence/deltat-2026-09-25/tools/moon/swiss_deltat.py <ephe>',
    'sidereal': 'docs/platform/evidence/houses-2026-09-26/tools: node sidereal.mjs > sidereal.jsonl; python3 sidereal.py sidereal.jsonl (run-all.sh)',
    'holdout': 'python3 docs/platform/evidence/phase1-verdicts-2026-09-26/tools/holdout_events.py <holdout-1.4.json>, with both events-vs-swiss deltas regenerated first',
    'corpus-deltat': 'swe.deltat_ex(jdUt, swe.FLG_SWIEPH) at each corpus instant, as the audit\'s swiss_dump.py read it (engine-beyond-swiss/corpora/README.md)',
    'canon': 'the four canon events located in Swiss Ephemeris 2.10.03, as the engine audit did (engine-audit-2026-09-22/LEDGER.md, verification-honesty-3)',
    'parity': 'node scripts/platform-engine-report.mjs at commit %s, with the engine version the file names installed' % BASE,
    'uranus': 'python3 docs/platform/evidence/precision-2026-09-20/search/verify/swiss-station.py, and search/lib/swiss-longitudes.py through search/reproduce.mjs',
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
        'what': 'Statistics of the removed rows that the site\'s copy states, computed from them before they were removed (%s, %s) by the formulas scripts/methodology-accuracy-claim.test.mjs and scripts/claims-bindings.test.mjs used on the rows.' % (DATE, UNDER),
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
            'moonCases': [{'id': r['id'], 'absArcsec': abs(r['dLonArcsec'])} for r in future if r['body'] == 'Moon'],
        },
    }


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
SPEC[EV + 'swiss-benchmark/report-measure-rc8.json'] = {**strip_rows(BENCH_ROWS, 'benchmark'), 'add': ('statistics', rows_stats_rc8)}
for name in ('raw/cmp-A-core-own.json', 'raw/cmp-B-core-pinned.json', 'raw/cmp-C-proto-own.json', 'raw/cmp-D-proto-pinned.json',
             'raw/recovered-report-proto-engine-deltat.json', 'numerics/raw/repro-cellD-report.json',
             'numerics/verify/p8-report.json', 'numerics/verify/repro-cellD-report.json',
             'numerics/verify/holdout-p0-prototype-report.json', 'numerics/verify/holdout-p8-best-report.json',
             'numerics/verify/holdout-p8a-best-2000a-report.json'):
    SPEC[EV + 'precision-2026-09-20/' + name] = strip_rows(BENCH_ROWS, 'benchmark' if name.startswith('raw/') else 'precision-sweep')
for variant in ('a-aberration-first-order', 'a-aberration-off', 'a-bias-off', 'a-deflection-off', 'a-light-time-1-iteration',
                'a-light-time-2-iterations', 'a-nutation-back-to-ae', 'a-observer-velocity-h-600s', 'a-observer-velocity-h-60s',
                'a-tdb-off-tt-as-tdb-', 'p0-prototype-as-shipped', 'p1-iau2000b-nutation', 'p1a-iau2000a-nutation',
                'p2-frame-bias-only', 'p3-2000b-frame-bias', 'p4-2000b-bias-tdb', 'p5-2000b-bias-tdb-deflection',
                'p6-full-aberration-too', 'p7-analytic-observer-velocity', 'p8-best-light-time-to-1e-11', 'p8a-best-with-iau2000a'):
    SPEC[EV + 'precision-2026-09-20/numerics/raw/sweep/report-%s.json' % variant] = strip_rows(BENCH_ROWS, 'precision-sweep')

CELL_FILES = ['raw/cellA-core-own.json', 'raw/cellB-core-pinned.json']
for d in ('numerics/raw/counterfactual/', 'numerics/verify/counterfactual/'):
    for stem in ('cellA-core-own-common', 'cellA-core-own-nut2000b-common', 'cellA-core-own-nut2000b',
                 'cellB-core-pinned-common', 'cellB-core-pinned-nut2000b-common', 'cellB-core-pinned-nut2000b'):
        CELL_FILES.append(d + stem + '.json')
for name in CELL_FILES:
    SPEC[EV + 'precision-2026-09-20/' + name] = {'cases': True, 'regen': 'precision-cells'}

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
SPEC[EV + 'engine-beyond-swiss/corpora/horizons-24/corpus-tt.json'] = {
    'rowsField': ('cases', ['deltaTSeconds']), 'what': 'Swiss\'s Delta T at each corpus instant (the TT instants it gave stay, as the corpus inputs)', 'regen': 'corpus-deltat'}
SPEC[EV + 'engine-beyond-swiss/corpora/canon-events.json'] = {
    'canon': True, 'text': True, 'what': 'Swiss\'s residual from the canon for each of the four events (the engine\'s and the alpha\'s stay)', 'regen': 'canon'}
PARITY = [EV + 'independent-node-polar-node22.json', EV + 'independent-node-polar-node24.json']
for rc in ('site-engine-rc5/independent-node-polar-node', 'site-engine-rc7/node', 'site-engine-rc8/node', 'site-engine-rc9/node', 'site-engine-rc10/node'):
    for n in ('22', '24'):
        PARITY.append(EV + rc + n + ('-parity.json' if not rc.endswith('polar-node') else '.json'))
for name in PARITY:
    SPEC[name] = {'paths': [['nodes'], ['polar']], 'what': 'per-case differences from the Swiss node/polar fixture (three node epochs, three polar places in two house systems); the maxima stay',
                  'regen': 'parity'}
for base in ('search/raw/', 'search/verify/raw-original/'):
    SPEC[EV + 'precision-2026-09-20/' + base + 'decomposition.json'] = {
        'paths': [['sources', 'ephemerisModel', 'atTheTurningPointItself', 'swissLongitude']],
        'what': 'Swiss\'s longitude of Uranus at the D turning point (the differences and the margin the analysis cites stay)', 'regen': 'uranus'}
    SPEC[EV + 'precision-2026-09-20/' + base + 'reproduction.json'] = {
        'paths': [['independentReproduction', 'swiss', k] for k in ('stationUtc', 'stationLongitudeDegrees', 'stationSpeedDegPerDay')],
        'what': 'Swiss\'s instant, longitude and speed of the Uranus station of D (the margin it gives stays)', 'regen': 'uranus'}

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


def transform(path, spec, value):
    removed = []
    added = None
    if 'add' in spec:
        key, fn = spec['add']
        added = (key, fn(value))
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
    if added:
        value[added[0]] = added[1]
    marker = {
        'on': DATE,
        'under': UNDER,
        'what': spec['what'] if 'what' in spec else BENCH_ROWS,
        'removed': removed,
        'fileBefore': None,
        'lastCommitWithTheValues': BASE,
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


def main(argv):
    check = '--check' in argv
    manifest = {
        'what': 'Swiss Ephemeris output removed from the tree on %s under %s. Every file and field removed, with the SHA-256 of what was removed, the commit that still has it, and the command that regenerates it. Made by strip.py beside this file.' % (DATE, UNDER),
        'base': BASE,
        'removedFiles': [],
        'strippedFiles': [],
    }
    problems = []
    for path, (what, regen) in sorted(REMOVE.items()):
        data = git_bytes(path)
        manifest['removedFiles'].append({'path': path, 'bytes': len(data), 'sha256': sha(data), 'what': what,
                                         'lastCommitWithTheFile': BASE, 'regenerate': REGEN[regen]})
        full = os.path.join(ROOT, path)
        if check:
            if os.path.exists(full):
                problems.append('%s still exists' % path)
        elif os.path.exists(full):
            subprocess.run(['git', 'rm', '-q', path], cwd=ROOT, check=True)
    for path, spec in sorted(SPEC.items()):
        data = git_bytes(path)
        if spec.get('text'):
            out, marker, style = text_edit(data, spec)
        else:
            value, write, style = reader_writer(data)
            value, marker = transform(path, spec, value)
            marker['fileBefore'] = {'bytes': len(data), 'sha256': sha(data)}
            value['swissOutputRemoved'] = marker
            out = write(value)
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
    text = json.dumps(manifest, indent=1, ensure_ascii=False) + '\n'
    target = os.path.join(HERE, 'manifest.json')
    if check:
        if open(target).read() != text:
            problems.append('manifest.json differs from what strip.py makes')
        if problems:
            raise SystemExit('\n'.join(problems))
        print('ok: %d files removed, %d stripped' % (len(manifest['removedFiles']), len(manifest['strippedFiles'])))
    else:
        with open(target, 'w') as f:
            f.write(text)
        print('removed %d files, stripped %d' % (len(manifest['removedFiles']), len(manifest['strippedFiles'])))


if __name__ == '__main__':
    main(sys.argv[1:])
