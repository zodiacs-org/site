"""Shared helpers for the accuracy audit: the Horizons truth, tolerances, claim records."""
from __future__ import annotations

import datetime
import json
import math
import os

import truth as T

ROOT = T.ROOT
OUT_DIR = os.path.join(ROOT, 'docs', 'accuracy-audit-2026-11')
SIGNS = T.SIGNS
SIGN_NAMES = [s.capitalize() for s in SIGNS]

# Tolerances (from the audit brief)
TOL_INSTANT_S = 60.0       # lunations, ingresses, eclipses
TOL_STATION_S = 30 * 60.0  # stations are flat
TT_MINUS_UTC_S = 69.184    # 37 leap seconds + 32.184 s; no leap second announced through 2027


_bodies = None
_events = None


def bodies():
    global _bodies
    if _bodies is None:
        _bodies = T.load_bodies()
    return _bodies


def events():
    global _events
    if _events is None:
        _events = T.load()
    return _events


def jd(iso):
    return T.iso_to_jd(iso)


def iso(jd_):
    return T.jd_to_iso(jd_)


def lon(body, iso_or_jd):
    j = iso_or_jd if isinstance(iso_or_jd, float) else jd(iso_or_jd)
    return bodies()[body].lon(j)


def speed(body, iso_or_jd):
    j = iso_or_jd if isinstance(iso_or_jd, float) else jd(iso_or_jd)
    return bodies()[body].speed(j)


def sign_of(lon_):
    return SIGNS[int(math.floor(lon_ % 360 / 30)) % 12]


def deg_in_sign(lon_):
    return lon_ % 30.0


def dms_trunc(deg):
    """(degrees, minutes) truncated, the astrologer's notation."""
    total_min = math.floor(deg * 60 + 1e-9)
    return total_min // 60, total_min % 60


def fmt_dm(deg, sign=None):
    d, m = dms_trunc(deg)
    s = '%d°%02d′' % (d, m)
    return s + (' ' + sign.capitalize() if sign else '')


def nearest(evlist, jd_, pred=lambda e: True):
    best = None
    for e in evlist:
        if not pred(e):
            continue
        d = abs(e['jd'] - jd_)
        if best is None or d < best[0]:
            best = (d, e)
    return best[1] if best else None


def secs(a_jd, b_jd):
    return (a_jd - b_jd) * 86400.0


class Claims:
    def __init__(self):
        self.rows = []

    def add(self, category, source, statement, ours, nasa, diff, ok, note='', kind='check'):
        self.rows.append({
            'category': category, 'source': source, 'statement': statement,
            'ours': ours, 'nasa': nasa, 'diff': diff, 'ok': bool(ok), 'note': note, 'kind': kind,
        })

    def extend(self, other):
        self.rows.extend(other.rows)

    def save(self, name):
        path = os.path.join(OUT_DIR, 'results', 'full', name)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            json.dump(self.rows, f, indent=1, ensure_ascii=False)
        return path


def date_utc(jd_):
    return iso(jd_)[:10]


def hhmm_utc(jd_):
    return iso(jd_)[11:16]


def parse_date(s):
    return datetime.date.fromisoformat(s)
