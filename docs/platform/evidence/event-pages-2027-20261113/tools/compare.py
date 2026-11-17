"""Hold what the 2027 event pages print to the instants solved on Horizons in this job.

For each solved event (horizons-event-times.json) this finds the instant the
site prints: src/data/nasa-event-times-2027.json for new and full Moons,
eclipse peaks and shadow edges, src/data/nasa-event-instants.json for
stations, sign changes and aspects, and otherwise the engine's own instant
(events of 2026, which the in-scope pages name by date only). It then checks
the printed minute (the pages cut the seconds off, they do not round) and the
printed UTC date against the fresh solve, and lists every instant within three
seconds of a minute line.

It also sets the sign and degree each in-scope page prints for its own event
beside the position Horizons gives at the solved instant.

Writes ../comparison.json and ../COMPARISON.md. Exits 1 when a printed minute,
a printed date or a printed sign differs.

Usage: python3 docs/platform/evidence/event-pages-2027-20261113/tools/compare.py
"""
import datetime
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EVIDENCE = os.path.normpath(os.path.join(HERE, os.pardir))
ROOT = os.path.normpath(os.path.join(EVIDENCE, os.pardir, os.pardir, os.pardir, os.pardir))


def load(*parts):
    with open(os.path.join(*parts)) as f:
        return json.load(f)


def parse(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))


def ms(value):
    dt = parse(value)
    return dt.strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (dt.microsecond // 1000)


solved = load(EVIDENCE, 'horizons-event-times.json')
site = load(ROOT, 'src', 'data', 'nasa-event-times-2027.json')
nasa = load(ROOT, 'src', 'data', 'nasa-event-instants.json')


def near(rows, engine):
    best = None
    for row in rows:
        gap = abs((parse(row['engine']) - parse(engine)).total_seconds())
        if gap <= 120 and (best is None or gap < best[0]):
            best = (gap, row)
    return best[1] if best else None


def listed(rows, engine):
    for row in rows:
        if any(ms(e) == ms(engine) for e in row['engine']):
            return row
    return None


def printed(event):
    kind, detail, engine = event['kind'], event['detail'], event['engine']
    if kind == 'lunation':
        row = near([r for r in site['lunations'] if r['type'] == detail['type']], engine)
        return (row['nasa'], 'nasa-event-times-2027.json') if row else (engine, 'engine (sky.json)')
    if kind == 'eclipse':
        row = near([r for r in site['eclipses'] if r['type'] == detail['type']], engine)
        return (row['nasa'], 'nasa-event-times-2027.json') if row else (engine, 'engine (eclipses.json)')
    if kind == 'shadow':
        row = near([r for r in site['shadows'] if r['body'] == detail['body'] and r['edge'] == detail['edge']], engine)
        return (row['nasa'], 'nasa-event-times-2027.json') if row else (engine, 'engine (sky.json)')
    if kind == 'station':
        row = listed([r for r in nasa['stations'] if r['body'] == detail['body']], engine)
    elif kind == 'ingress':
        row = listed([r for r in nasa['ingresses'] if r['body'] == detail['body']], engine)
    else:
        row = listed([r for r in nasa['aspects'] if r['a'] == detail['a'] and r['b'] == detail['b'] and r['type'] == detail['type']], engine)
    return (ms(row['nasa']), 'nasa-event-instants.json') if row else (engine, 'engine')


# A slow planet's station or aspect is fixed less sharply than a minute: its
# longitude changes by under a thousandth of an arcsecond in a minute there.
# The in-scope pages name those by date only, so only the date is held.
SLOW = {'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'}


def date_only(event):
    detail = event['detail']
    if event['kind'] == 'aspect':
        return True
    if event['kind'] == 'station' and detail['body'] in SLOW:
        return True
    return False


rows, failures = [], []
for key, event in solved['events'].items():
    shown, source = printed(event)
    fresh = event['horizons']
    gap = (parse(shown) - parse(fresh)).total_seconds()
    same_minute = ms(shown)[:16] == ms(fresh)[:16]
    same_date = ms(shown)[:10] == ms(fresh)[:10]
    second = parse(fresh).second + parse(fresh).microsecond / 1e6
    from_line = min(second, 60 - second)
    held = 'date' if date_only(event) else 'minute'
    ok = same_date if held == 'date' else same_minute
    row = {
        'key': key, 'kind': event['kind'], 'pages': event['pages'], 'engine': event['engine'],
        'printed': ms(shown), 'printedFrom': source, 'horizons': fresh,
        'printedMinusHorizonsSeconds': round(gap, 3),
        'held': held, 'sameMinute': same_minute, 'sameUtcDate': same_date,
        'secondsFromMinuteLine': round(from_line, 3), 'ok': ok,
    }
    rows.append(row)
    if not ok:
        failures.append(row)

# --- positions: the sign and degree a page prints for its own event -----------------------
SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra',
         'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
referenced = load(EVIDENCE, 'referenced-events.json')


def dm(lon):
    whole = int(lon % 30)
    minutes = int(((lon % 30) - whole) * 60)
    return '%d°%02d′ %s' % (whole, minutes, SIGNS[int(lon // 30) % 12].capitalize())


positions = []
for page in referenced['pages']:
    if 'longitude' not in page:
        continue
    own = [e for e in solved['events'].values() if page['id'] in e['pages']]
    if page['family'] == 'lunation':
        source = next(e for e in own if e['kind'] == 'lunation' and e['engine'][:10] == page['id'][-10:])
        fresh, what = source['moonLongitude'], 'the Moon at the full moon'
    elif page['family'] == 'eclipse':
        source = next(e for e in own if e['kind'] == 'eclipse' and e['engine'][:10] == page['id'][-10:])
        # eclipses.json gives the Sun's longitude for a solar eclipse and the Moon's for a lunar one.
        if source['detail']['type'] == 'solar':
            fresh, what = source['sunLongitude'], 'the Sun at the peak'
        else:
            fresh, what = source['moonLongitude'], 'the Moon at the peak'
    elif page['family'] == 'retrograde':
        source = next(e for e in own if e['kind'] == 'station' and e['detail']['direction'] == 'retrograde'
                      and e['engine'][:10] == page['id'][-10:])
        fresh, what = source['longitude'], 'the planet at its retrograde station'
    else:
        continue
    shown = page['longitude']
    positions.append({
        'page': page['id'], 'what': what,
        'printed': dm(shown), 'horizons': dm(fresh),
        'printedMinusHorizonsArcsec': round(((shown - fresh + 180) % 360 - 180) * 3600, 1),
        'sameSign': int(shown // 30) == int(fresh // 30),
        'sameArcminute': dm(shown) == dm(fresh),
    })
for p in positions:
    if not p['sameSign']:
        failures.append({'key': p['page'], 'printed': p['printed'], 'horizons': p['horizons']})

rows.sort(key=lambda r: (r['horizons'], r['key']))
ties = [r for r in rows if r['held'] == 'minute' and r['secondsFromMinuteLine'] < 3.0]
engine_differs = [r for r in rows if r['held'] == 'minute' and ms(r['engine'])[:16] != r['horizons'][:16]]
summary = {
    'what': 'What the 2027 event pages print, held to the instants solved on NASA JPL Horizons in this job',
    'events': len(rows),
    'heldToTheMinute': sum(1 for r in rows if r['held'] == 'minute'),
    'heldToTheDate': sum(1 for r in rows if r['held'] == 'date'),
    'failures': len(failures),
    'withinThreeSecondsOfAMinuteLine': [r['key'] for r in ties],
    'engineMinuteDiffersFromHorizons': [r['key'] for r in engine_differs],
    'positions': positions,
    'rows': rows,
}
with open(os.path.join(EVIDENCE, 'comparison.json'), 'w') as f:
    f.write(json.dumps(summary, indent=1, ensure_ascii=False) + '\n')

lines = [
    '# What the pages print, against Horizons',
    '',
    'Generated by `tools/compare.py` from `horizons-event-times.json`. Times are UTC.',
    'The pages print a time cut to the minute (the seconds are dropped, not rounded).',
    '',
    '%d events: %d held to the minute, %d held to the date (a slow planet\'s station or aspect, named on these pages by date only). %d fail.'
    % (len(rows), summary['heldToTheMinute'], summary['heldToTheDate'], len(failures)),
    '',
    '| Event | Engine | Printed | Printed from | Horizons, this job | Printed minus Horizons | Held | OK | Seconds from a minute line |',
    '| --- | --- | --- | --- | --- | ---: | --- | --- | ---: |',
]
for r in rows:
    lines.append('| `%s` | %s | %s | %s | %s | %+.1f s | %s | %s | %.1f |' % (
        r['key'].split(':20')[0],
        r['engine'][:19].replace('T', ' '), r['printed'][:19].replace('T', ' '), r['printedFrom'],
        r['horizons'][:23].replace('T', ' '), r['printedMinusHorizonsSeconds'], r['held'],
        'yes' if r['ok'] else 'NO', r['secondsFromMinuteLine']))
lines += ['', '## Within three seconds of a minute line', '']
for r in ties:
    lines.append('- `%s`: Horizons %s, printed %s' % (r['key'], r['horizons'], r['printed'][:16].replace('T', ' ')))
lines += ['', '## Where the engine\'s minute differs from Horizons', '']
for r in engine_differs:
    lines.append('- `%s`: engine %s, Horizons %s, printed %s' % (r['key'], r['engine'], r['horizons'], r['printed'][:16].replace('T', ' ')))
lines += [
    '', '## The sign and degree each page prints for its own event', '',
    'The pages take these from the site\'s engine and data files, not from Horizons, and cut the arcminute (they do not round).',
    'An eclipse\'s degree is kept to a hundredth of a degree in its data file, so it can sit up to 18″ from the engine\'s own value.',
    '',
    '| Page | What | Printed | Horizons, this job | Printed minus Horizons | Same sign | Same arcminute |',
    '| --- | --- | --- | --- | ---: | --- | --- |',
]
for p in positions:
    lines.append('| `%s` | %s | %s | %s | %+.1f″ | %s | %s |' % (
        p['page'], p['what'], p['printed'], p['horizons'], p['printedMinusHorizonsArcsec'],
        'yes' if p['sameSign'] else 'NO', 'yes' if p['sameArcminute'] else 'no'))
with open(os.path.join(EVIDENCE, 'COMPARISON.md'), 'w') as f:
    f.write('\n'.join(lines) + '\n')

print('%d events, %d positions, %d failures, %d ties' % (len(rows), len(positions), len(failures), len(ties)))
for r in failures:
    print('FAIL', r['key'], 'printed', r['printed'], 'horizons', r['horizons'])
sys.exit(1 if failures else 0)
