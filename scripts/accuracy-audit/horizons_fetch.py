"""Fetch the NASA JPL Horizons tables the accuracy audit checks the site against.

Every response is kept byte for byte under docs/accuracy-audit-2026-11/raw/,
with its full query URL, retrieval time (UTC) and SHA-256 in raw/MANIFEST.json.
Once a response is kept, later runs read it from disk and verify its SHA-256;
pass --refresh to fetch everything again.

Quantity: OBSERVER table, QUANTITIES 31 (observer-centred ecliptic longitude
and latitude of date of the apparent position: light-time, gravitational
deflection, stellar aberration), CENTER 500@399 (geocentre), APPARENT AIRLESS,
EXTRA_PREC YES, TIME_TYPE UT (UTC from 1962, UT1 before; Horizons applies its
own TT minus UT), CAL_FORMAT JD. Targets follow the engine-validation arbiter:
Sun 10, Moon 301, Mercury 199, Venus 299, system barycentres 4 to 9 for Mars
to Pluto.

Usage: python3 scripts/accuracy-audit/horizons_fetch.py [--refresh]
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request

API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), os.pardir, os.pardir))
STORE = os.path.join(ROOT, 'docs', 'accuracy-audit-2026-11', 'raw')
MANIFEST = os.path.join(STORE, 'MANIFEST.json')

TARGETS = {
    'Sun': '10', 'Moon': '301', 'Mercury': '199', 'Venus': '299', 'Mars': '4',
    'Jupiter': '5', 'Saturn': '6', 'Uranus': '7', 'Neptune': '8', 'Pluto': '9',
}

# (name, body, start, stop, step). Dates are UT calendar dates.
# "dense" tables cover what the site publishes day to day (2026 to 2031,
# sky.json's station scan runs to 2031-04); "long" tables cover the long
# ingress horizons in src/data/ingresses.json and the birthday year range.
TABLES = [
    ('dense-sun', 'Sun', '2025-11-01', '2031-06-01', '6 h'),
    ('dense-moon-a', 'Moon', '2025-11-01', '2028-07-01', '1 h'),
    ('dense-moon-b', 'Moon', '2028-06-29', '2031-02-01', '1 h'),
    ('dense-mercury', 'Mercury', '2025-11-01', '2031-06-01', '6 h'),
    ('dense-venus', 'Venus', '2025-11-01', '2031-06-01', '6 h'),
    ('dense-mars', 'Mars', '2025-11-01', '2031-06-01', '6 h'),
    ('dense-jupiter', 'Jupiter', '2025-11-01', '2031-06-01', '12 h'),
    ('dense-saturn', 'Saturn', '2025-11-01', '2031-06-01', '12 h'),
    ('dense-uranus', 'Uranus', '2025-11-01', '2031-06-01', '12 h'),
    ('dense-neptune', 'Neptune', '2025-11-01', '2031-06-01', '12 h'),
    ('dense-pluto', 'Pluto', '2025-11-01', '2031-06-01', '12 h'),
    ('long-sun', 'Sun', '1939-11-01', '2041-03-01', '1 d'),
    ('long-jupiter', 'Jupiter', '2013-11-01', '2046-03-01', '2 d'),
    ('long-saturn', 'Saturn', '1979-11-01', '2080-03-01', '2 d'),
    ('long-uranus', 'Uranus', '1899-11-01', '2100-03-01', '2 d'),
    ('long-neptune', 'Neptune', '1899-11-01', '2100-03-01', '2 d'),
    ('long-pluto', 'Pluto', '1899-11-01', '2100-03-01', '2 d'),
]


def query_params(body, start, stop, step):
    return {
        'format': 'text', 'OBJ_DATA': 'NO', 'MAKE_EPHEM': 'YES',
        'COMMAND': TARGETS[body], 'EPHEM_TYPE': 'OBSERVER', 'CENTER': '500@399',
        'START_TIME': start, 'STOP_TIME': stop, 'STEP_SIZE': step,
        'TIME_TYPE': 'UT', 'QUANTITIES': '31', 'ANG_FORMAT': 'DEG', 'EXTRA_PREC': 'YES',
        'CAL_FORMAT': 'JD', 'APPARENT': 'AIRLESS', 'CSV_FORMAT': 'NO',
    }


def url_for(params):
    q = {k: (v if k == 'format' else "'%s'" % v) for k, v in params.items()}
    return API + '?' + urllib.parse.urlencode(q)


def load_manifest():
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            return json.load(f)
    return {
        'what': 'NASA JPL Horizons API responses for the 2026-11 accuracy audit, kept byte for byte',
        'api': API,
        'responses': {},
    }


def save_manifest(m):
    m['responses'] = dict(sorted(m['responses'].items()))
    with open(MANIFEST, 'w') as f:
        f.write(json.dumps(m, indent=1, ensure_ascii=False) + '\n')


def fetch(name, body, start, stop, step, refresh=False):
    os.makedirs(STORE, exist_ok=True)
    path = os.path.join(STORE, name + '.txt')
    params = query_params(body, start, stop, step)
    url = url_for(params)
    m = load_manifest()
    entry = m['responses'].get(name)
    if os.path.exists(path) and not refresh and entry and entry['url'] == url:
        data = open(path, 'rb').read()
        if hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise SystemExit('%s does not match its recorded SHA-256' % name)
        return
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                data = r.read()
            break
        except Exception:
            if attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))
    text = data.decode()
    if '$$SOE' not in text:
        raise SystemExit('no ephemeris in the response to %s:\n%s' % (name, text[:2000]))
    with open(path, 'wb') as f:
        f.write(data)
    m['responses'][name] = {
        'file': name + '.txt',
        'body': body,
        'url': url,
        'query': params,
        'retrievedUtc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(),
    }
    save_manifest(m)
    print('fetched', name, len(data), 'bytes')


def fetch_points(name, body, jds, refresh=False):
    """Apparent geocentric ecliptic longitude at listed UT Julian days (TLIST)."""
    os.makedirs(STORE, exist_ok=True)
    path = os.path.join(STORE, name + '.txt')
    params = {
        'format': 'text', 'OBJ_DATA': 'NO', 'MAKE_EPHEM': 'YES',
        'COMMAND': TARGETS[body], 'EPHEM_TYPE': 'OBSERVER', 'CENTER': '500@399',
        'TLIST': ' '.join('%.8f' % j for j in jds), 'TLIST_TYPE': 'JD',
        'TIME_TYPE': 'UT', 'QUANTITIES': '31', 'ANG_FORMAT': 'DEG', 'EXTRA_PREC': 'YES',
        'CAL_FORMAT': 'JD', 'APPARENT': 'AIRLESS', 'CSV_FORMAT': 'NO',
    }
    url = url_for(params)
    m = load_manifest()
    entry = m['responses'].get(name)
    if os.path.exists(path) and not refresh and entry and entry['url'] == url:
        data = open(path, 'rb').read()
        if hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise SystemExit('%s does not match its recorded SHA-256' % name)
        return data.decode()
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=300) as r:
                data = r.read()
            break
        except Exception:
            if attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))
    text = data.decode()
    if '$$SOE' not in text:
        raise SystemExit('no ephemeris in the response to %s:\n%s' % (name, text[:2000]))
    with open(path, 'wb') as f:
        f.write(data)
    m['responses'][name] = {
        'file': name + '.txt', 'body': body, 'url': url, 'query': params,
        'retrievedUtc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
    }
    save_manifest(m)
    print('fetched', name, len(data), 'bytes')
    return text


def people_instants():
    """{body: sorted unique UT JDs} the people audit needs, from src/data/people.json."""
    with open(os.path.join(ROOT, 'src', 'data', 'people.json')) as f:
        people = json.load(f)['people']
    def jd(iso):
        dt = datetime.datetime.fromisoformat(iso.replace('Z', '+00:00'))
        return 2451545.0 + (dt - datetime.datetime(2000, 1, 1, 12, tzinfo=datetime.timezone.utc)).total_seconds() / 86400.0
    out = {b: set() for b in TARGETS}
    for p in people:
        c = p['computation']
        base = [jd(c['utcInstant']), jd(c['civilDayStartUtc']), jd(c['civilDayEndUtc'])]
        for b in TARGETS:
            for j in base:
                out[b].add(round(j, 8))
    return {b: sorted(v) for b, v in out.items()}


def main():
    refresh = '--refresh' in sys.argv
    for t in TABLES:
        fetch(*t, refresh=refresh)
    chunk = 60  # the API answers 502 to URLs much over 1.5 kB
    for body, jds in people_instants().items():
        for k in range(0, len(jds), chunk):
            fetch_points('people-%s-%02d' % (body.lower(), k // chunk), body, jds[k:k + chunk], refresh=refresh)


if __name__ == '__main__':
    main()
