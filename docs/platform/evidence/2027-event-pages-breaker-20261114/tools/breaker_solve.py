#!/usr/bin/env python3
"""Breaker's independent solve of the 2027 event pages' instants on NASA JPL Horizons.

Written without the builder's solver. Differences on purpose: planet centres
(199, 499, 599, 799, 899, 999) instead of system barycentres, other windows,
steps and fits, and a geometric-vector second solve of each eclipse peak.
Raw responses are kept outside git (HORIZONS_RAW); each query's URL, retrieval
time and SHA-256 is written to breaker-queries.json.
"""
import hashlib, json, math, os, sys, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
RAW = os.environ.get('HORIZONS_RAW', '/workspace/runs/fable-jobs/job10/breaker-horizons-raw')
UA = 'zodiacs.org-event-pages-breaker-check/1.0 (+https://zodiacs.org; admin@zodiacs.org)'
API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
AU = 149597870.700
QUERIES = []

def iso(dt): return dt.strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (dt.microsecond // 1000)
def parse(s): return datetime.strptime(s, '%Y-%m-%dT%H:%MZ').replace(tzinfo=timezone.utc)
def jd2dt(jd): return datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=(jd - 2440587.5) * 86400)

def fetch(params):
    url = API + '?' + urllib.parse.urlencode(params)
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    path = os.path.join(RAW, key + '.txt')
    meta_path = path + '.meta.json'
    if os.path.exists(path) and os.path.exists(meta_path):
        body = open(path, 'rb').read(); meta = json.load(open(meta_path))
    else:
        time.sleep(1.0)
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    body = r.read()
                break
            except urllib.error.HTTPError as e:
                if e.code in (429, 403):
                    print('LIMIT', e.code, url); sys.exit(42)
                raise
            except urllib.error.URLError:
                # a dropped TLS connection, not a refusal: wait and ask once more
                if attempt == 4: raise
                time.sleep(6 * (attempt + 1))
        meta = {'retrievedUtc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
        open(path, 'wb').write(body); json.dump(meta, open(meta_path, 'w'))
    text = body.decode()
    if '$$SOE' not in text:
        raise RuntimeError('no table: ' + text[:600])
    head = [l.strip() for l in text.splitlines() if l.startswith(('Target body name', 'Center body name', 'Start time', 'Stop  time', 'Step-size', 'EOP file', 'Output units', 'Reference frame'))]
    QUERIES.append({'url': url, 'params': params, 'retrievedUtc': meta['retrievedUtc'], 'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest(), 'header': head})
    return text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()

def observer(body, t0, t1, step, q='31'):
    p = {'format': 'text', 'COMMAND': f"'{body}'", 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'",
         'CENTER': "'500@399'", 'START_TIME': f"'{t0:%Y-%m-%d %H:%M}'", 'STOP_TIME': f"'{t1:%Y-%m-%d %H:%M}'", 'STEP_SIZE': f"'{step}'",
         'QUANTITIES': f"'{q}'", 'ANG_FORMAT': "'DEG'", 'EXTRA_PREC': "'YES'", 'CAL_FORMAT': "'JD'", 'CSV_FORMAT': "'YES'",
         'TIME_TYPE': "'UT'", 'APPARENT': "'AIRLESS'"}
    rows = []
    for l in fetch(p):
        c = [x.strip() for x in l.split(',')]
        # JDUT, sun flag, moon flag, [delta, deldot,] lon, lat  (Horizons prints quantities in numeric order)
        vals = [float(x) for x in c[3:] if x not in ('',)]
        rows.append([float(c[0])] + vals)
    return np.array(rows)

def vectors(body, t0, t1, step):
    # geometric state, ecliptic of J2000, geocentre, TDB time tags
    p = {'format': 'text', 'COMMAND': f"'{body}'", 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'VECTORS'",
         'CENTER': "'500@399'", 'START_TIME': f"'{t0:%Y-%m-%d %H:%M}'", 'STOP_TIME': f"'{t1:%Y-%m-%d %H:%M}'", 'STEP_SIZE': f"'{step}'",
         'VEC_TABLE': "'1'", 'VEC_CORR': "'NONE'", 'CSV_FORMAT': "'YES'", 'OUT_UNITS': "'KM-S'", 'REF_PLANE': "'ECLIPTIC'", 'TIME_TYPE': "'TDB'"}
    rows = []
    for l in fetch(p):
        c = [x.strip() for x in l.split(',')]
        rows.append([float(c[0]), float(c[2]), float(c[3]), float(c[4])])
    return np.array(rows)

def secs(jd, jd0): return (jd - jd0) * 86400.0

def root(ts, f, deg=3):
    """ts seconds from centre, f values; polynomial fit, root nearest to 0 inside the window."""
    c = np.polyfit(ts, f, deg)
    res = float(np.max(np.abs(np.polyval(c, ts) - f)))
    r = [x.real for x in np.roots(c) if abs(x.imag) < 1e-9 and ts[0] <= x.real <= ts[-1]]
    if not r: return None, res
    return min(r, key=abs), res

def unwrap(a): return np.degrees(np.unwrap(np.radians(a)))
def wrap180(a): return (a + 180.0) % 360.0 - 180.0

def win(seed, minutes):
    return seed - timedelta(minutes=minutes), seed + timedelta(minutes=minutes)

def lon_table(body, seed, minutes, step):
    t0, t1 = win(seed, minutes)
    a = observer(body, t0, t1, step, '31')
    return a[:, 0], unwrap(a[:, 1]), a[:, 2]

def solve_lunation(seed, phase):
    jm, lm, _ = lon_table('301', seed, 12, '1 m'); js, ls, _ = lon_table('10', seed, 12, '1 m')
    assert np.allclose(jm, js)
    jd0 = jm[len(jm) // 2]; ts = secs(jm, jd0)
    f = wrap180(lm - ls - phase)
    r, res = root(ts, f)
    if r is None: return None
    t = jd2dt(jd0) + timedelta(seconds=r)
    moon = float(np.interp(r, ts, lm)) % 360
    return {'instant': iso(t), 'moonLon': round(moon, 6), 'fitResidualDeg': res}

def unit(lon, lat):
    lo, la = np.radians(lon), np.radians(lat)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], axis=1)

def axis_min(ts, d2):
    c = np.polyfit(ts, d2, 4); dc = np.polyder(c)
    r = [x.real for x in np.roots(dc) if abs(x.imag) < 1e-9 and ts[0] <= x.real <= ts[-1] and np.polyval(np.polyder(dc), x.real) > 0]
    return min(r, key=lambda x: np.polyval(c, x)) if r else None

def solve_eclipse(seed, kind):
    t0, t1 = win(seed, 30)
    m = observer('301', t0, t1, '1 m', '20,31'); s = observer('10', t0, t1, '1 m', '20,31')
    # columns: JD, delta(AU), deldot, lon, lat
    jd0 = m[len(m) // 2, 0]; ts = secs(m[:, 0], jd0)
    M = unit(m[:, 3], m[:, 4]) * (m[:, 1] * AU)[:, None]; S = unit(s[:, 3], s[:, 4]) * (s[:, 1] * AU)[:, None]
    out = {}
    def dist2(M, S):
        if kind == 'lunar':   # Moon's centre from the shadow axis (the line from the Sun through the geocentre)
            a = -S / np.linalg.norm(S, axis=1)[:, None]
            return np.sum((M - np.sum(M * a, axis=1)[:, None] * a) ** 2, axis=1)
        a = (M - S) / np.linalg.norm(M - S, axis=1)[:, None]  # geocentre from the Sun-Moon line
        return np.sum((M - np.sum(M * a, axis=1)[:, None] * a) ** 2, axis=1)
    r = axis_min(ts, dist2(M, S))
    out['instant'] = iso(jd2dt(jd0) + timedelta(seconds=r))
    out['axisDistanceKm'] = round(float(math.sqrt(np.interp(r, ts, dist2(M, S)))), 1)
    out['moonLon'] = round(float(np.interp(r, ts, unwrap(m[:, 3]))) % 360, 6)
    out['sunLon'] = round(float(np.interp(r, ts, unwrap(s[:, 3]))) % 360, 6)
    # second convention: geometric vectors (no light-time, no aberration), TDB tags
    mv = vectors('301', t0, t1, '1 m'); sv = vectors('10', t0, t1, '1 m')
    tv = secs(mv[:, 0], mv[len(mv) // 2, 0])
    rg = axis_min(tv, dist2(mv[:, 1:], sv[:, 1:]))
    tdb = jd2dt(mv[len(mv) // 2, 0]) + timedelta(seconds=rg)
    out['geometricVariantUtc'] = iso(tdb - timedelta(seconds=69.184))
    out['geometricVariantNote'] = 'geometric Sun and Moon (VECTORS, VEC_CORR NONE), TDB minus 69.184 s'
    # third: geometric Moon, Sun retarded by its light-time (shadow axis from where the Sun was) is not solved here
    return out

def station_fit(body, seed, hours, step, deg):
    jd, lon, _ = lon_table(body, seed, hours * 60, step)
    jd0 = jd[len(jd) // 2]; ts = secs(jd, jd0) / 3600.0
    c = np.polyfit(ts, lon, deg); dc = np.polyder(c)
    res = float(np.max(np.abs(np.polyval(c, ts) - lon)))
    r = [x.real for x in np.roots(dc) if abs(x.imag) < 1e-9 and ts[0] <= x.real <= ts[-1]]
    if not r: return None
    r = min(r, key=abs)
    return jd2dt(jd0) + timedelta(hours=r), float(np.polyval(c, r)) % 360, res

def solve_station(body, seed, slow=False):
    if slow:
        a = station_fit(body, seed, 72, '1 h', 4); b = station_fit(body, seed, 48, '1 h', 4)
    else:
        a = station_fit(body, seed, 12, '10 m', 5); b = station_fit(body, seed, 6, '10 m', 4)
    if a is None: return None
    out = {'instant': iso(a[0]), 'lon': round(a[1], 7), 'fitResidualDeg': a[2]}
    if b: out['secondFitDeltaS'] = round((b[0] - a[0]).total_seconds(), 2)
    return out

def solve_crossing(body, seed, target_lon, minutes=15, step='1 m'):
    jd, lon, _ = lon_table(body, seed, minutes, step)
    jd0 = jd[len(jd) // 2]; ts = secs(jd, jd0)
    f = wrap180(lon - target_lon)
    r, res = root(ts, f)
    if r is None: return {'instant': None, 'note': f'no crossing of {target_lon} within {minutes} min of seed', 'range': [float(lon[0]) % 360, float(lon[-1]) % 360]}
    return {'instant': iso(jd2dt(jd0) + timedelta(seconds=r)), 'lon': round(target_lon % 360, 7), 'fitResidualDeg': res,
            'direction': 'forward' if lon[-1] > lon[0] else 'backward'}

def solve_aspect(b1, b2, angle, seed):
    j1, l1, _ = lon_table(b1, seed, 180, '10 m'); j2, l2, _ = lon_table(b2, seed, 180, '10 m')
    jd0 = j1[len(j1) // 2]; ts = secs(j1, jd0)
    d = wrap180(l1 - l2)
    f = np.abs(d) - angle
    r, res = root(ts, f, 2)
    if r is None: return {'instant': None, 'sepRange': [float(abs(d[0])), float(abs(d[-1]))]}
    return {'instant': iso(jd2dt(jd0) + timedelta(seconds=r)), 'fitResidualDeg': res}

def main():
    ev = json.load(open(os.path.join(HERE, 'breaker-events.json')))
    out = []
    stations = {}
    for e in ev:
        seed = parse(e['seed']); k = e['kind']
        try:
            if k == 'lunation': r = solve_lunation(seed, 180 if e['phase'] == 'full' else 0)
            elif k == 'eclipse': r = solve_eclipse(seed, e['type'])
            elif k == 'station':
                r = solve_station(e['body'], seed, e.get('slow', False)); stations[e['id']] = r
            elif k == 'ingress': r = solve_crossing(e['body'], seed, e['lon'])
            elif k == 'shadow':
                r = solve_crossing(e['body'], seed, stations[e['stationId']]['lon'])
                r['stationId'] = e['stationId']
            elif k == 'aspect': r = solve_aspect(e['body'], e['body2'], e['angle'], seed)
        except SystemExit: raise
        except Exception as x:
            r = {'instant': None, 'error': repr(x)}
        out.append({**e, 'solved': r})
        print(e['id'], r and r.get('instant'), flush=True)
    json.dump({'what': "Breaker's independent Horizons solve (DE441, geocentre, apparent ecliptic of date, TIME_TYPE UT)", 'events': out}, open(os.path.join(OUT, 'breaker-event-times.json'), 'w'), indent=1)
    json.dump({'userAgent': UA, 'count': len(QUERIES), 'queries': QUERIES}, open(os.path.join(OUT, 'breaker-queries.json'), 'w'), indent=1)

if __name__ == '__main__': main()
