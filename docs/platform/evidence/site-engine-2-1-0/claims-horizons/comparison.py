"""Replay the DE440 longitude and Moon ingress claims without network access."""

import argparse
import csv
import gzip
import json
import math
import re
import subprocess
import sys
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
sys.path.insert(0, str(ROOT / 'docs/engine-validation/independent-references/tools'))
from series import J2000, Series

BODIES = 'Sun Moon Mercury Venus Mars Jupiter Saturn Uranus Neptune Pluto'.split()
SIGNS = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split()
DAY_SECONDS = 86400
FIXTURE = HERE / 'horizons-values.json.gz'
DENSE_UT = [f'dense-ut-{body}' for body in BODIES]
DENSE_TT = [f'dense-tt-{body}-{index}' for body in BODIES for index in range(3)]
NODE_UT = 'dense-node-UT-1200'
NODE_TT = [f'dense-node-TT-{start}' for start in ('1200', '1201', '1203')]
STRATIFIED = [f'stratified-ut-{body}' for body in BODIES]
INGRESS = [f'voc-moon-{year}' for year in range(2026, 2029)]
CLOCK = 'clock-2100-2199'
TABLES = [*DENSE_UT, *DENSE_TT, NODE_UT, *NODE_TT, *STRATIFIED, *INGRESS, CLOCK]


def parse_horizons(response, vectors):
    text = response.decode('utf-8')
    if 'API SOURCE: NASA/JPL Horizons API' not in text or '{source: DE441}' not in text:
        raise ValueError('Expected a NASA JPL Horizons DE441 response')
    rows = text.split('$$SOE', 1)[1].split('$$EOE', 1)[0].strip().splitlines()
    for row in csv.reader(rows):
        fields = row[:1] + row[2:8] if vectors else [value for value in row if value.strip()]
        yield [float(value) for value in fields]


def extract_values(directory):
    """Keep the fields used by the comparison from the digest-pinned live responses."""
    requests = {item['name']: item for item in json.loads((HERE / 'requests.json').read_bytes())}
    tables = {}
    for name in TABLES:
        response = (directory / f'{name}.txt').read_bytes()
        if sha256(response).hexdigest() != requests[name]['sha256']:
            raise ValueError(f'{name} does not match its live response receipt')
        vectors = name == NODE_UT or name in NODE_TT
        rows = parse_horizons(response, vectors)
        if vectors or name == CLOCK:
            tables[name] = list(rows)
        elif name == 'dense-ut-Sun':
            tables[name] = [[row[0], row[1], row[-2]] for row in rows]
        elif name in DENSE_UT or name in DENSE_TT:
            tables[name] = [[row[0], row[-2]] for row in rows]
        else:
            tables[name] = [row[:2] for row in rows]
    payload = json.dumps(tables, separators=(',', ':'), allow_nan=False).encode('utf-8')
    FIXTURE.write_bytes(gzip.compress(payload, mtime=0))


def jd(label):
    return datetime.fromisoformat(label).timestamp() / DAY_SECONDS + 2440587.5


def utc_label(day):
    milliseconds = round((day - 2440587.5) * DAY_SECONDS * 1000)
    return datetime.fromtimestamp(milliseconds / 1000, timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def arcseconds(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


def statistics(samples):
    ordered = sorted(samples)
    count = len(ordered)
    largest, at, body, *_ = ordered[-1]
    return dict(n=count, p50=ordered[count // 2][0], p95=ordered[int(count * .95)][0],
                max=largest, maxAt=at, maxBody=body)


def stratified_summary(reference, cases):
    residuals = []
    for body in BODIES:
        readings = dict(reference[f'stratified-ut-{body}'])
        for row in cases:
            at = jd(row['utc'])
            closest = min(readings, key=lambda instant: abs(instant - at))
            if abs(closest - at) >= 1e-7:
                raise ValueError(f'No matching Horizons date for {row["id"]}')
            difference = arcseconds(row['bodies'][body][0], readings[closest])
            residuals.append((difference, row['utc'], body, row['stratum'], row['id']))
    return {
        'within': statistics([row for row in residuals if row[3] != 'future']),
        'moon': statistics([row for row in residuals if row[3] != 'future' and row[2] == 'Moon']),
        'future': statistics([row for row in residuals if row[3] == 'future']),
        'cases': [{key: row[key] for key in ('id', 'utc', 'stratum')} for row in cases],
    }


def quadratic(offset, a, b, c, wrap=False):
    """Interpolate between Horizons samples at 0, 60 and 180 seconds in TT."""
    if wrap:
        b = a + (b - a + 180) % 360 - 180
        c = a + (c - a + 180) % 360 - 180
    return (a * (offset - 60) * (offset - 180) / 10800
            - b * offset * (offset - 180) / 7200
            + c * offset * (offset - 60) / 21600)


def dense_summary(reference, engine_rows):
    from geometry import node_longitude

    obs = {body: reference[f'dense-ut-{body}'] for body in BODIES}
    tt = {body: [reference[f'dense-tt-{body}-{index}'] for index in range(3)] for body in BODIES}
    node_ut = reference[NODE_UT]
    node_tt = [reference[name] for name in NODE_TT]
    residuals = {'ut': [], 'tt': []}
    for index, row in enumerate(engine_rows):
        day = jd(row['utc'])
        offset = (row['ttDays'] - (day - J2000)) * DAY_SECONDS
        if not -10 <= offset <= 180 or obs['Sun'][index][0] != day:
            raise ValueError(f'The dense grid does not match {row["utc"]}')
        for body in BODIES:
            longitude = row['bodies'][body][0]
            reference_ut = obs[body][index][-1]
            reference_tt = quadratic(offset, *(table[index][1] for table in tt[body]), wrap=True)
            residuals['ut'].append((arcseconds(longitude, reference_ut), row['utc'], body))
            residuals['tt'].append((arcseconds(longitude, reference_tt), row['utc'], body))
        state_ut = node_ut[index][1:]
        state_tt = [quadratic(offset, *(table[index][coordinate] for table in node_tt))
                    for coordinate in range(1, 7)]
        # Rotate the vector-derived ascending node to the true ecliptic of date
        # with ERFA, using the corresponding TT for each clock.
        tt_for_ut = day + obs['Sun'][index][1] / DAY_SECONDS
        for mode, frame, state in [('ut', tt_for_ut, state_ut), ('tt', J2000 + row['ttDays'], state_tt)]:
            difference = arcseconds(row['bodies']['North Node'][0], node_longitude(frame, state))
            residuals[mode].append((difference, row['utc'], 'North Node'))
    return {mode: {
        'all': statistics(samples),
        'through2026': statistics([row for row in samples if row[1] < '2027']),
        'futureMoon': statistics([row for row in samples if row[2] == 'Moon' and row[1] >= '2150']),
    } for mode, samples in residuals.items()}


def clock_summary(reference, engine_rows):
    rows = reference[CLOCK]
    offsets = [abs((engine['ttDays'] - (day - J2000)) * DAY_SECONDS - horizon)
               for (day, horizon), engine in zip(rows, engine_rows, strict=True)]
    motion = [gap * row['moonArcsecPerSecond'] for gap, row in zip(offsets, engine_rows, strict=True)]
    return dict(n=len(rows), offset=[min(offsets), max(offsets)], motion=[min(motion), max(motion)],
                sigma=[engine_rows[0]['sigma'], engine_rows[-1]['sigma']])


def moon_ingress_summary(reference):
    payload = (ROOT / 'src/data/aura-moon-ingresses.json').read_bytes()
    ingresses = json.loads(payload)
    years = {year: Series(reference[f'voc-moon-{year}']) for year in range(2026, 2029)}
    pairs = []
    for row in ingresses['ingresses']:
        instant = jd(row['at']) - J2000
        series = years[int(row['at'][:4])]
        lo, hi = max(series.start, instant - 1 / 48), min(series.stop, instant + 1 / 48)
        target = 30 * SIGNS.index(row['sign'])
        target += 360 * round((series.at(instant) - target) / 360)
        crossing = series.solve(target, lo, hi)
        pairs.append({**row, 'horizonsAt': utc_label(crossing + J2000),
                      'differenceSeconds': (instant - crossing) * DAY_SECONDS})
    differences = sorted(abs(row['differenceSeconds']) for row in pairs)
    return dict(n=len(pairs), fromUtc=ingresses['from'], toUtc=ingresses['to'],
                medianAbsSeconds=differences[len(differences) // 2], maxAbsSeconds=differences[-1],
                tableSha256=sha256(payload).hexdigest(), rows=pairs)


def replay():
    payload = gzip.decompress(FIXTURE.read_bytes())
    reference = json.loads(payload)
    if set(reference) != set(TABLES):
        raise ValueError('The Horizons fixture does not contain the exact requested tables')
    engine = json.loads(subprocess.check_output(['node', HERE / 'engine.mjs'], cwd=ROOT))
    result = {key: engine[key] for key in ('engine', 'ephemeris', 'archiveSha256', 'deltaTTableDigest')}
    result.update(reference='NASA JPL Horizons DE441', referenceValuesSha256=sha256(payload).hexdigest(),
                  stratified=stratified_summary(reference, engine['stratified']),
                  dense=dense_summary(reference, engine['dense']), clock=clock_summary(reference, engine['clock']),
                  moonIngress=moon_ingress_summary(reference))
    return result


def prose(path):
    text = (ROOT / path).read_text()
    text = text.replace("{' '}", ' ')
    text = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+([.,])', r'\1', ' '.join(text.split()))


def upper_hundredth(value):
    return f'{math.ceil(value * 100) / 100:.2f}'


def check(result):
    recorded = json.loads((HERE / 'results.json').read_bytes())
    for key, actual in result.items():
        if actual != recorded[key]:
            raise AssertionError(f'The replayed {key} differs from results.json')

    methodology = prose('src/pages/methodology/index.astro')
    void_page = prose('src/pages/void-of-course-moon/index.astro')
    stratified = result['stratified']['within']
    stratified_moon = result['stratified']['moon']
    far_future = result['stratified']['future']
    dense = result['dense']['ut']['through2026']
    uniform_moon = result['dense']['tt']['futureMoon']
    clock_moon = result['dense']['ut']['futureMoon']
    ingress = result['moonIngress']
    first_offset, last_offset = result['clock']['offset']
    for text in (
        f"Across the {stratified['n']} measurements from 1801 to 2026, the median disagreement in longitude was {stratified['p50']:.2f} arcseconds",
        f"the 95th percentile was {stratified['p95']:.2f} arcseconds, and the largest was {stratified['max']:.2f} arcseconds",
        f"the {stratified_moon['n']} Moon measurements in that span the median was {stratified_moon['p50']:.2f} arcseconds and the largest was {stratified_moon['max']:.2f} arcseconds",
        f"the {far_future['n']} far-future measurements was {far_future['max']:.2f} arcseconds",
        f"that was {dense['n']:,} comparisons, with a median of {dense['p50']:.2f} arcseconds and a largest of {upper_hundredth(dense['max'])} arcseconds",
        f"the calculation within {upper_hundredth(last_offset)} seconds of Horizons",
        f"{upper_hundredth(uniform_moon['max'])} arcseconds at matched Terrestrial Time and {upper_hundredth(clock_moon['max'])} arcseconds at the same input time",
    ):
        if text not in methodology:
            raise AssertionError(f'The methodology page does not match the replay: {text}')
    for text in (
        f"all {ingress['n']} published Moon ingresses from 2026 through 2028 against live NASA JPL Horizons",
        f"The largest difference was {upper_hundredth(ingress['maxAbsSeconds'])} seconds at the end of a void",
    ):
        if text not in void_page:
            raise AssertionError(f'The void-of-course page does not match the replay: {text}')
    print('Horizons claims: offline replay matches the results and both pages')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--extract-raw', type=Path, metavar='DIRECTORY')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.extract_raw:
        extract_values(args.extract_raw)
    else:
        check(replay())


if __name__ == '__main__':
    main()
