"""NASA JPL Horizons API client for the independent references.

Every response is kept byte for byte under ../horizons/, named after the
request, with its query, retrieval time and SHA-256 in ../horizons/MANIFEST.json.
A later build reads the kept files and never fetches again unless asked to
(--refresh fetches every response again; --refresh-changed only those whose
query changed, as when the engine's clock moves an instant), so the
references regenerate identically from the repository.

Quantities used:
  * OBSERVER, QUANTITIES 31, CENTER 500@399, APPARENT AIRLESS, TIME_TYPE TT:
    the observer-centred ecliptic longitude and latitude of date of the
    apparent position (light-time, gravitational deflection, stellar
    aberration), in the IAU76/80 ecliptic of date Horizons documents.
  * VECTORS, CENTER 500@399, REF_SYSTEM ICRF, REF_PLANE FRAME, VEC_CORR NONE,
    TIME_TYPE TT: the Moon's geometric geocentric state, for the osculating
    node.
Targets: Sun 10, Moon 301, Mercury 199, Venus 299, and the system
barycentres Mars 4 to Pluto 9, as the conformance suite's L1 arbiter uses.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import time
import urllib.parse
import urllib.request

API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
HERE = os.path.dirname(os.path.abspath(__file__))
STORE = os.path.normpath(os.path.join(HERE, os.pardir, 'horizons'))
MANIFEST = os.path.join(STORE, 'MANIFEST.json')

TARGETS = {
    'Sun': '10', 'Moon': '301', 'Mercury': '199', 'Venus': '299', 'Mars': '4',
    'Jupiter': '5', 'Saturn': '6', 'Uranus': '7', 'Neptune': '8', 'Pluto': '9',
}

REFRESH = False  # True: fetch every response again; 'changed': only those whose query changed
USED = set()


def _load_manifest():
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            return json.load(f)
    return {'what': 'NASA JPL Horizons API responses, kept byte for byte', 'api': API, 'responses': {}}


def _save_manifest(manifest):
    manifest['responses'] = dict(sorted(manifest['responses'].items()))
    with open(MANIFEST, 'w') as f:
        f.write(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')


def request(name: str, params: dict) -> str:
    """The response text for `params`, from ../horizons/<name>.txt when kept."""
    os.makedirs(STORE, exist_ok=True)
    USED.add(name)
    path = os.path.join(STORE, name + '.txt')
    full = {'format': 'text', 'OBJ_DATA': 'NO', 'MAKE_EPHEM': 'YES'}
    full.update(params)
    query = {k: (v if k == 'format' else "'%s'" % v) for k, v in full.items()}
    manifest = _load_manifest()
    if os.path.exists(path) and REFRESH is not True:
        data = open(path, 'rb').read()
        entry = manifest['responses'].get(name)
        if entry is None or entry['query'] != full:
            if REFRESH != 'changed':
                raise SystemExit('horizons: %s is kept but its query changed; rerun with --refresh-changed' % name)
        else:
            if hashlib.sha256(data).hexdigest() != entry['sha256']:
                raise SystemExit('horizons: %s does not match its recorded SHA-256' % name)
            return data.decode()
    url = API + '?' + urllib.parse.urlencode(query)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                data = r.read()
            break
        except Exception:
            if attempt == 4:
                raise
            time.sleep(5 * (attempt + 1))
    text = data.decode()
    if '$$SOE' not in text:
        raise SystemExit('horizons: no ephemeris in the response to %s:\n%s' % (name, text[:2000]))
    with open(path, 'wb') as f:
        f.write(data)
    manifest['responses'][name] = {
        'file': name + '.txt',
        'query': full,
        'retrievedUtc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(),
        'source': _banner(text),
    }
    _save_manifest(manifest)
    return text


def prune():
    """Drop kept responses this build did not use, from the store and the manifest."""
    manifest = _load_manifest()
    for name in list(manifest['responses']):
        if name not in USED:
            del manifest['responses'][name]
    for entry in os.listdir(STORE):
        if entry.endswith('.txt') and entry[:-4] not in USED:
            os.unlink(os.path.join(STORE, entry))
    _save_manifest(manifest)


def _banner(text: str) -> dict:
    out = {}
    m = re.search(r'API VERSION:\s*(\S+)', text)
    if m:
        out['apiVersion'] = m.group(1)
    m = re.search(r'Target body name:\s*(.+?)\s*\{source:\s*([^}]+)\}', text)
    if m:
        out['target'] = m.group(1).strip()
        out['targetSource'] = m.group(2).strip()
    m = re.search(r'Center body name:\s*(.+?)\s*\{source:\s*([^}]+)\}', text)
    if m:
        out['centerSource'] = m.group(2).strip()
    m = re.search(r'EOP file\s*:\s*(\S+)', text)
    if m:
        out['eopFile'] = m.group(1)
    return out


def _rows(text: str):
    body = text[text.index('$$SOE') + 5:text.index('$$EOE')]
    return [line for line in body.strip().splitlines() if line.strip()]


def observer_table(name: str, body: str, start_jd_tt: float, stop_jd_tt: float, step: str):
    """[(jd_tt, lon_deg, lat_deg)] on a uniform TT grid."""
    text = request(name, {
        'COMMAND': TARGETS[body], 'EPHEM_TYPE': 'OBSERVER', 'CENTER': '500@399',
        'START_TIME': 'JD %.1f' % start_jd_tt, 'STOP_TIME': 'JD %.1f' % stop_jd_tt, 'STEP_SIZE': step,
        'TIME_TYPE': 'TT', 'QUANTITIES': '31', 'ANG_FORMAT': 'DEG', 'EXTRA_PREC': 'YES',
        'CAL_FORMAT': 'JD', 'APPARENT': 'AIRLESS', 'CSV_FORMAT': 'NO',
    })
    return _parse_observer(text)


def observer_points(name: str, body: str, jds_tt):
    """[(jd_tt, lon_deg, lat_deg)] at listed TT instants."""
    text = request(name, {
        'COMMAND': TARGETS[body], 'EPHEM_TYPE': 'OBSERVER', 'CENTER': '500@399',
        'TLIST': ' '.join('%.9f' % jd for jd in jds_tt), 'TLIST_TYPE': 'JD',
        'TIME_TYPE': 'TT', 'QUANTITIES': '31', 'ANG_FORMAT': 'DEG', 'EXTRA_PREC': 'YES',
        'CAL_FORMAT': 'JD', 'APPARENT': 'AIRLESS', 'CSV_FORMAT': 'NO',
    })
    return _parse_observer(text)


def _parse_observer(text: str):
    out = []
    for line in _rows(text):
        tokens = line.split()
        numbers = [t for t in tokens if re.fullmatch(r'-?\d+(?:\.\d+)?', t)]
        out.append((float(tokens[0]), float(numbers[-2]), float(numbers[-1])))
    return out


def moon_vectors(name: str, jds_tt):
    """[(jd_tt, (x, y, z, vx, vy, vz))], km and km/s, geometric, ICRF."""
    text = request(name, {
        'COMMAND': '301', 'EPHEM_TYPE': 'VECTORS', 'CENTER': '500@399',
        'TLIST': ' '.join('%.9f' % jd for jd in jds_tt), 'TLIST_TYPE': 'JD', 'TIME_TYPE': 'TT',
        'REF_PLANE': 'FRAME', 'REF_SYSTEM': 'ICRF', 'VEC_CORR': 'NONE', 'OUT_UNITS': 'KM-S',
        'VEC_TABLE': '2', 'CSV_FORMAT': 'YES', 'VEC_LABELS': 'NO',
    })
    out = []
    for line in _rows(text):
        parts = [p.strip() for p in line.split(',') if p.strip()]
        out.append((float(parts[0]), tuple(float(x) for x in parts[2:8])))
    return out
