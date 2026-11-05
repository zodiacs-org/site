#!/usr/bin/env python3
"""Chiron's positions and their checks, from NASA JPL Horizons (README.md beside this file).

    python3 docs/engine-validation/chiron/fetch.py             # read what is kept, fetch what is missing
    python3 docs/engine-validation/chiron/fetch.py --refresh   # fetch everything again
    python3 docs/engine-validation/chiron/fetch.py --dense DIR # every day from 1799 to 2200 into DIR, not kept

Every response is kept byte for byte under horizons/, with its query, retrieval
time and SHA-256 in horizons/MANIFEST.json, through the independent
references' own client (../independent-references/tools/horizons.py), pointed
at this directory's store. The target is 2060 Chiron (Horizons record 2060;),
the quantity the independent references use for the planets: observer
quantity 31 from the geocentre (500@399), the apparent ecliptic longitude and
latitude of date, with light-time, gravitational deflection and stellar
aberration, airless, on a TT clock.

* chiron-every-24-days: the table node scripts/build-chiron.mjs encodes into
  src/data/chiron.json, every 24 days from JD 2378400.5 TT (1799-09-27) to
  JD 2524704.5 TT (2200-04-22), four steps past each end of 1800 to 2199.
* chiron-checks-1 to chiron-checks-14: fresh values at instants the table does
  not hold, each with the instants 12 hours before and after it, for its daily
  motion: 240 drawn at random over 1800 to 2199 (seed 2060) and 40 in the
  first and last 120 days of the span.
* chiron-hourly-<date>: hourly values for four days around stations and sign
  changes near them, for the station and sign-change tests.

--dense fetches every day of 1799-06-01 to 2200-07-01 into DIR, for measure.ts,
which writes the comparison's statistics to dense-check.json. Those responses
(about 7 MB) are not kept. The tests never fetch; CI reads the kept files.
Nothing here comes from Swiss Ephemeris.
"""
from __future__ import annotations

import os
import random
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, os.pardir, 'independent-references', 'tools'))
import horizons  # noqa: E402  (the independent references' client, pointed at this directory's store)

horizons.STORE = os.path.join(HERE, 'horizons')
horizons.MANIFEST = os.path.join(horizons.STORE, 'MANIFEST.json')

CHIRON = '2060;'
OBSERVER = {'COMMAND': CHIRON, 'EPHEM_TYPE': 'OBSERVER', 'CENTER': '500@399', 'TIME_TYPE': 'TT', 'QUANTITIES': '31',
            'ANG_FORMAT': 'DEG', 'EXTRA_PREC': 'YES', 'CAL_FORMAT': 'JD', 'APPARENT': 'AIRLESS', 'CSV_FORMAT': 'NO'}
# 1800-01-01T00:00 and 2200-01-01T00:00 TT; the span the site's charts and scans keep to (src/lib/engine/reference-span.ts).
SPAN = (2378496.5, 2524593.5)
STEP_DAYS = 24
PAD_STEPS = 4
TABLE = {'START_TIME': 'JD %.1f' % (SPAN[0] - PAD_STEPS * STEP_DAYS),
         'STOP_TIME': 'JD %.1f' % (SPAN[0] + (int((SPAN[1] - SPAN[0]) // STEP_DAYS) + 1 + PAD_STEPS) * STEP_DAYS),
         'STEP_SIZE': '%d d' % STEP_DAYS}
# Stations and sign changes found in the dense run, as TT dates: the 2026 to 2028 steps between Aries and Taurus,
# with the station direct of January 2028 four hundredths of a degree inside Taurus, and one at each end of the span.
HOURLY = ['1800-03-07', '1800-11-28', '1976-10-13', '2025-07-30', '2026-01-02', '2026-06-19', '2026-08-03',
          '2026-09-18', '2027-01-06', '2027-04-14', '2028-01-10', '2199-08-05']
# Horizons answers a longer TLIST with fewer rows and no warning, so a request asks for 60 instants and is counted.
CHECKS_PER_RESPONSE = 20


def jd_of(date: str) -> float:
    year, month, day = (int(x) for x in date.split('-'))
    # Fliegel and Van Flandern's Julian day number of a Gregorian date, at 0h.
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    return day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045 - 0.5


def check_instants():
    """240 instants at random over the span and 20 in each of its first and last 120 days, none within 0.6 day of a node."""
    rng = random.Random(2060)

    def draw(lo, hi):
        while True:
            jd = round(rng.uniform(lo, hi), 6)
            if 0.6 < (jd - SPAN[0]) % STEP_DAYS < STEP_DAYS - 0.6:
                return jd

    return ([draw(SPAN[0] + 1, SPAN[1] - 1) for _ in range(240)]
            + [draw(SPAN[0] + 0.01, SPAN[0] + 120) for _ in range(20)]
            + [draw(SPAN[1] - 121, SPAN[1] - 1) for _ in range(20)])


def main(argv):
    if '--dense' in argv:
        dense(argv[argv.index('--dense') + 1])
        return
    horizons.REFRESH = True if '--refresh' in argv else False
    horizons.request('chiron-every-24-days', {**OBSERVER, **TABLE})
    instants = check_instants()
    for index in range(0, len(instants), CHECKS_PER_RESPONSE):
        jds = [jd + offset for jd in instants[index:index + CHECKS_PER_RESPONSE] for offset in (-0.5, 0.0, 0.5)]
        name = 'chiron-checks-%d' % (index // CHECKS_PER_RESPONSE + 1)
        text = horizons.request(name, {**OBSERVER, 'TLIST': ' '.join('%.6f' % jd for jd in jds), 'TLIST_TYPE': 'JD'})
        if len(horizons._rows(text)) != len(jds):
            raise SystemExit('horizons: %s has %d rows for %d instants; rerun with --refresh' % (name, len(horizons._rows(text)), len(jds)))
    for date in HOURLY:
        jd = jd_of(date)
        horizons.request('chiron-hourly-%s' % date,
                         {**OBSERVER, 'START_TIME': 'JD %.1f' % (jd - 2), 'STOP_TIME': 'JD %.1f' % (jd + 2), 'STEP_SIZE': '1 h'})
    horizons.prune()


def dense(directory: str):
    """Every day of 1799-06-01 to 2200-07-01 TT, in 16,000-day requests, into `directory`; nothing is kept here."""
    os.makedirs(directory, exist_ok=True)
    start, stop = jd_of('1799-06-01'), jd_of('2200-07-01')
    jd = start
    while jd <= stop:
        end = min(jd + 15999, stop)
        path = os.path.join(directory, 'daily-%.1f.txt' % jd)
        if not os.path.exists(path):
            full = {'format': 'text', 'OBJ_DATA': 'NO', 'MAKE_EPHEM': 'YES', **OBSERVER,
                    'START_TIME': 'JD %.1f' % jd, 'STOP_TIME': 'JD %.1f' % end, 'STEP_SIZE': '1 d'}
            query = {k: (v if k == 'format' else "'%s'" % v) for k, v in full.items()}
            for attempt in range(5):
                try:
                    with urllib.request.urlopen(horizons.API + '?' + urllib.parse.urlencode(query), timeout=300) as r:
                        data = r.read()
                    break
                except Exception:
                    if attempt == 4:
                        raise
                    time.sleep(5 * (attempt + 1))
            if b'$$SOE' not in data:
                raise SystemExit('horizons: no ephemeris in the dense response from JD %.1f' % jd)
            with open(path, 'wb') as f:
                f.write(data)
        jd = end + 1


if __name__ == '__main__':
    main(sys.argv[1:])
