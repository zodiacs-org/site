#!/usr/bin/env python3
"""Public references for the sky events tests (tests/sky-events-references.test.ts).

    python3 docs/engine-validation/sky-events-references/fetch.py            # read what is kept, fetch what is missing
    python3 docs/engine-validation/sky-events-references/fetch.py --refresh  # fetch everything again

* NASA JPL Horizons API responses, through the independent references' own
  client (../independent-references/tools/horizons.py), kept byte for byte
  under horizons/ with their queries, retrieval times and SHA-256 in
  horizons/MANIFEST.json: the Sun over the two hourly windows whose Moon that
  pipeline already keeps (moon-from-2025-12-31, moon-from-2026-03-01), and the
  Sun and Moon from 2028-12-15 to 2029-01-21, past the end of the engine's
  IERS table. Same quantities as the pipeline: observer 500@399, quantity 31
  (apparent ecliptic longitude and latitude of date), airless, on a TT clock.
* NASA Goddard's Five Millennium Canon eclipse catalogs for 2001 to 2100
  (F. Espenak and J. Meeus): the rows for 2025 to 2030, with each page's
  address, retrieval date and SHA-256, in nasa-eclipses-2025-2030.json.

Nothing here comes from Swiss Ephemeris or from the engine the tests check.
The tests never fetch; CI reads the kept files.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, os.pardir, 'independent-references', 'tools'))
import horizons  # noqa: E402  (the independent references' client, pointed at this directory's store)

horizons.STORE = os.path.join(HERE, 'horizons')
horizons.MANIFEST = os.path.join(horizons.STORE, 'MANIFEST.json')

OBSERVER = {'EPHEM_TYPE': 'OBSERVER', 'CENTER': '500@399', 'STEP_SIZE': '1 h', 'TIME_TYPE': 'TT', 'QUANTITIES': '31',
            'ANG_FORMAT': 'DEG', 'EXTRA_PREC': 'YES', 'CAL_FORMAT': 'JD', 'APPARENT': 'AIRLESS', 'CSV_FORMAT': 'NO'}
RESPONSES = {
    'sun-from-2025-12-31': {'COMMAND': '10', 'START_TIME': 'JD 2461040.0', 'STOP_TIME': 'JD 2461083.0'},
    'sun-from-2026-03-01': {'COMMAND': '10', 'START_TIME': 'JD 2461099.0', 'STOP_TIME': 'JD 2461142.0'},
    'sun-from-2028-12-15': {'COMMAND': '10', 'START_TIME': 'JD 2462121.0', 'STOP_TIME': 'JD 2462158.0'},
    'moon-from-2028-12-15': {'COMMAND': '301', 'START_TIME': 'JD 2462121.0', 'STOP_TIME': 'JD 2462158.0'},
}
CATALOGS = {
    'solar': ('Five Millennium Catalog of Solar Eclipses: 2001 to 2100, F. Espenak and J. Meeus, NASA Goddard Space Flight Center',
              'https://eclipse.gsfc.nasa.gov/SEcat5/SE2001-2100.html'),
    'lunar': ('Five Millennium Catalog of Lunar Eclipses: 2001 to 2100, F. Espenak and J. Meeus, NASA Goddard Space Flight Center',
              'https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html'),
}
MONTHS = {name: index + 1 for index, name in enumerate(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])}
# Catalog number, calendar date, TD of greatest eclipse, Delta T (s), lunation number, Saros number, eclipse type.
ROW = re.compile(r'^(\d{5})\s+(\d{4}) (\w{3}) (\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(\d+)\s+(-?\d+)\s+(\d+)\s+(\S+)')


def catalog_rows(kind: str, html: str):
    rows = []
    for line in html.splitlines():
        text = re.sub(r'<[^>]*>', '', line)
        match = ROW.match(text)
        if not match or not 2025 <= int(match.group(2)) <= 2030:
            continue
        number, year, month, day, td, delta_t, _luna, saros, kind_code = match.groups()
        rows.append({'catalog': number, 'date': '%s-%02d-%s' % (year, MONTHS[month], day), 'greatestEclipseTD': td,
                     'deltaTSeconds': int(delta_t), 'saros': int(saros), 'type': kind_code})
    return rows


def eclipses(refresh: bool):
    path = os.path.join(HERE, 'nasa-eclipses-2025-2030.json')
    if os.path.exists(path) and not refresh:
        return
    out = {
        'what': 'Every solar and lunar eclipse from 2025 to 2030 as NASA\'s Five Millennium Canon catalogs list it: the catalog number, the date, the instant of greatest eclipse in Terrestrial Dynamical Time (TD, which is TT), the Delta T the canon used, the Saros series and the eclipse type (first letter: T total, A annular, H hybrid, P partial, N penumbral).',
        'sources': [],
    }
    for kind, (title, url) in CATALOGS.items():
        with urllib.request.urlopen(url, timeout=120) as response:
            data = response.read()
        out['sources'].append({'catalog': kind, 'title': title, 'url': url,
                               'retrievedUtc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                               'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        out[kind] = catalog_rows(kind, data.decode('latin-1'))
    with open(path, 'w') as f:
        f.write(json.dumps(out, indent=1, ensure_ascii=True) + '\n')


def main(argv):
    refresh = '--refresh' in argv
    horizons.REFRESH = True if refresh else False
    for name, params in RESPONSES.items():
        horizons.request(name, {**params, **OBSERVER})
    eclipses(refresh)


if __name__ == '__main__':
    main(sys.argv[1:])
