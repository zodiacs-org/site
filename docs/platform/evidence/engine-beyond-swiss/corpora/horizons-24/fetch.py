"""One Horizons request per body, TLIST of the 24 corpus TT Julian dates, TIME_TYPE=TT (the fixed clock), apparent observer ecliptic lon/lat (QUANTITIES=31), geocentric (500@399). Every response is kept verbatim beside this file and the exact query string is appended to queries.log.

    python3 fetch.py

The TT dates are corpus-tt.json's, which ../tools/retime-corpus.mjs makes from
the engine's own ΔT (since 2026-09-29; before, the audit's fetch read them from
its swiss.json, UT + Swiss's ΔT). A response already here is not fetched
again: delete it to ask Horizons anew. Moon_UT.txt, the Moon at the UT
instants on Horizons's own ΔT, is not made here."""
import json, os, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
TARGETS = {'Sun': '10', 'Moon': '301', 'Mercury': '199', 'Venus': '299', 'Mars': '499', 'MarsBary': '4',
           'Jupiter': '599', 'JupiterBary': '5', 'Saturn': '699', 'SaturnBary': '6', 'Uranus': '799', 'UranusBary': '7',
           'Neptune': '899', 'NeptuneBary': '8', 'Pluto': '999', 'PlutoBary': '9'}
cases = json.load(open(os.path.join(HERE, 'corpus-tt.json')))['cases']
tlist = ' '.join(f"{c['jdTt']:.8f}" for c in cases)
log = open(os.path.join(HERE, 'queries.log'), 'a')
for label, cmd in TARGETS.items():
    params = {'format': 'text', 'COMMAND': f"'{cmd}'", 'OBJ_DATA': "'NO'", 'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'", 'CENTER': "'500@399'",
              'TLIST': f"'{tlist}'", 'TLIST_TYPE': "'JD'", 'TIME_TYPE': "'TT'", 'QUANTITIES': "'31'", 'ANG_FORMAT': "'DEG'", 'EXTRA_PREC': "'YES'", 'CSV_FORMAT': "'YES'", 'APPARENT': "'AIRLESS'"}
    url = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(params)
    out = os.path.join(HERE, f'{label}.txt')
    if os.path.exists(out): print(label, 'cached'); continue
    t0 = time.time()
    with urllib.request.urlopen(url, timeout=120) as r: body = r.read().decode()
    if '$$SOE' not in body: raise SystemExit(f'{label}: Horizons returned no ephemeris:\n{body[:2000]}')
    open(out, 'w').write(body)
    log.write(json.dumps({'label': label, 'command': cmd, 'url': url, 'seconds': round(time.time() - t0, 1), 'bytes': len(body)}) + '\n')
    print(label, 'fetched', len(body), 'bytes in', round(time.time() - t0, 1), 's')
