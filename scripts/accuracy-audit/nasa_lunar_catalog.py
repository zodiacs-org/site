"""Keep NASA's lunar eclipse canon page (2001 to 2100) and read its 2026 to 2030 rows.

Saves raw/nasa-LE2001-2100.html with its URL, retrieval time and SHA-256 in
raw/MANIFEST.json (fetches once; later runs verify the hash), and returns, per
eclipse date, the type, umbral magnitude and the penumbral, partial and total
durations in minutes as the catalogue prints them.
"""
from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import urllib.request

import horizons_fetch as H

URL = 'https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html'
NAME = 'nasa-LE2001-2100'
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def keep():
    path = os.path.join(H.STORE, NAME + '.html')
    m = H.load_manifest()
    entry = m['responses'].get(NAME)
    if os.path.exists(path) and entry:
        data = open(path, 'rb').read()
        if hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise SystemExit('%s does not match its recorded SHA-256' % NAME)
        return data.decode('latin-1')
    with urllib.request.urlopen(URL, timeout=120) as r:
        data = r.read()
    with open(path, 'wb') as f:
        f.write(data)
    m['responses'][NAME] = {
        'file': NAME + '.html', 'url': URL,
        'what': 'Five Millennium Catalog of Lunar Eclipses: 2001 to 2100, F. Espenak and J. Meeus, NASA GSFC',
        'retrievedUtc': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
    }
    H.save_manifest(m)
    return data.decode('latin-1')


def rows():
    out = {}
    for ln in keep().splitlines():
        s = re.sub(r'<[^>]+>', '', ln)
        m = re.match(r'\s*\d{5}\s+(\d{4})\s+(\w{3})\s+(\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\S+)\s+(.*)$', s)
        if not m or not ('2026' <= m.group(1) <= '2030'):
            continue
        rest = m.group(9).split()
        # columns after the type: QSE, Gamma, Pen.Mag, Um.Mag, Pen.Dur, Par.Dur, Total.Dur, ...
        nums = [x for x in rest if re.fullmatch(r'-?\d+(?:\.\d+)?|-', x)]
        date = '%s-%02d-%s' % (m.group(1), MONTHS.index(m.group(2)) + 1, m.group(3))
        out[date] = {'type': m.group(8), 'raw': s.strip(), 'fields': nums}
    return out


if __name__ == '__main__':
    for d, r in rows().items():
        print(d, r['type'], r['fields'][:10])
