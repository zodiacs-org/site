"""Audit what the built pages SAY against NASA (Horizons tables and the eclipse canon).

Reads the visible text of every English consumer page (dump_pages.py output),
extracts each checkable astronomical statement with a set of template
extractors and a prose scanner, and checks every one against truth.py's
Horizons series and events, never against the site's data or engine.

Usage: python3 scripts/accuracy-audit/audit_pages.py PAGES.json
Writes docs/accuracy-audit-2026-11/results/pages.json
"""
from __future__ import annotations

import collections
import datetime
import json
import math
import re
import sys

import common as C
from audit_data import ASPECT_ANGLE, aspect_exact, aspect_tolerance_s, wrap180

BODY = r'(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)'
PLANET = r'(Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)'
SIGN = r'(Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)'
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
MON3 = [m[:3] for m in MONTHS]
MONTH_RE = r'(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)'
DM = r'(\d{1,2})°(\d{2})′'

EPH_END = datetime.date(2031, 1, 25)
EPH_START = datetime.date(2025, 11, 3)


def month_num(s):
    s = s[:3]
    return MON3.index(s) + 1


def mkdate(y, m, d):
    try:
        return datetime.date(int(y), int(m), int(d))
    except ValueError:
        return None


def in_range(d):
    return d is not None and EPH_START <= d <= EPH_END


def noon_jd(d):
    return C.jd('%sT12:00:00Z' % d.isoformat())


def hm_jd(d, hh, mm):
    return C.jd('%sT%02d:%02d:00Z' % (d.isoformat(), int(hh), int(mm)))


def trunc_dm(lon):
    return C.dms_trunc(lon % 30)


class Ctx:
    def __init__(self, url, lines):
        self.url = url
        self.lines = lines
        self.text = ' ¶ '.join(lines)
        self.page_date = self._page_date()

    def _page_date(self):
        m = re.search(r'(\d{4}-\d{2}-\d{2}) noon-UTC sky', self.text)
        if m:
            return datetime.date.fromisoformat(m.group(1))
        m = re.search(r'Noon UTC, ' + MONTH_RE + r' (\d{1,2}), (\d{4})', self.text)
        if m:
            return mkdate(m.group(3), month_num(m.group(1)), m.group(2))
        m = re.search(r'As of ' + MONTH_RE + r' (\d{1,2}), (\d{4})', self.text)
        if m:
            return mkdate(m.group(3), month_num(m.group(1)), m.group(2))
        m = re.search(r'/(\d{4}-\d{2}-\d{2})/$', self.url)
        if m:
            return datetime.date.fromisoformat(m.group(1))
        return None


# --- truth lookups -------------------------------------------------------------
def truth_station(planet, kind, near_jd, max_days=40):
    ev = C.nearest(C.events()['stations'][planet], near_jd, lambda e: e['type'] == kind)
    if ev is None or abs(ev['jd'] - near_jd) > max_days:
        return None
    return ev


def truth_ingress(body, sign, near_jd, max_days=40):
    ev = C.nearest(C.events()['ingresses'][body], near_jd, lambda e: e['sign'] == sign.lower())
    if ev is None or abs(ev['jd'] - near_jd) > max_days:
        return None
    return ev


def truth_lunation(kind, near_jd, max_days=20):
    ev = C.nearest(C.events()['lunations'], near_jd, lambda e: e['type'] == kind)
    if ev is None or abs(ev['jd'] - near_jd) > max_days:
        return None
    return ev


NASA_ECL = None


def nasa_eclipses():
    global NASA_ECL
    if NASA_ECL is None:
        n = json.load(open(C.ROOT + '/docs/engine-validation/sky-events-references/nasa-eclipses-2025-2030.json'))
        out = []
        kinds = {'T': 'total', 'A': 'annular', 'H': 'hybrid', 'P': 'partial', 'N': 'penumbral'}
        for t in ('solar', 'lunar'):
            for r in n[t]:
                td = C.jd(r['date'] + 'T' + r['greatestEclipseTD'] + 'Z')
                utc = td - C.TT_MINUS_UTC_S / 86400.0
                body = 'Sun' if t == 'solar' else 'Moon'
                lon = C.lon(body, utc) if utc > C.jd('2025-11-05T00:00:00Z') else None
                out.append({'type': t, 'kind': kinds[r['type'][0]], 'jd': utc, 'at': C.iso(utc), 'lon': lon, 'catalog': r['catalog']})
        NASA_ECL = out
    return NASA_ECL


# --- claim helpers -----------------------------------------------------------------
class Out:
    def __init__(self):
        self.claims = C.Claims()
        self.seen = set()

    def add(self, cat, ctx, statement, ours, nasa, diff, ok, note=''):
        key = (cat, ctx.url, statement)
        if key in self.seen:
            return
        self.seen.add(key)
        self.claims.add(cat, ctx.url, statement, ours, nasa, diff, ok, note)


def check_position(out, ctx, body, sign, deg, minute, jd_, label, decimal=None):
    """deg/minute: published D°MM′ (truncation expected); decimal: a published D.D value."""
    if not (C.jd(EPH_START.isoformat() + 'T00:00:00Z') < jd_ < C.jd(EPH_END.isoformat() + 'T00:00:00Z')):
        return
    lon = C.lon(body, jd_)
    tsign = C.sign_of(lon)
    td, tm = trunc_dm(lon)
    note = ''
    margin = min(lon % 30, 30 - lon % 30)
    if margin < abs(C.speed(body, jd_)) * 3 / 24:
        note = 'within 3 h of a sign boundary'
    if decimal is not None:
        ok = tsign == sign.lower() and abs(decimal - lon % 30) <= 0.05 + 0.003
        rounded = round(lon % 30 + 1e-9, 1)
        if rounded >= 30.0:
            note = (note + '; ' if note else '') + 'rounds to 30.0'
        out.add('position', ctx, label, '%s %.1f°' % (sign, decimal), '%s %.4f° (%s)' % (tsign.capitalize(), lon % 30, C.fmt_dm(lon % 30)),
                '%+.3f°' % (decimal - lon % 30) if tsign == sign.lower() else 'sign differs', ok, note)
        return
    ok = tsign == sign.lower() and (deg, minute) == (td, tm)
    exact_s = ((lon % 30) * 60 - (td * 60 + tm)) * 60  # arcsec past the truncated minute
    if not ok and tsign == sign.lower():
        if exact_s < 10 or exact_s > 50:
            note = (note + '; ' if note else '') + 'minute-boundary tie: NASA value %.1f arcsec past %d°%02d′' % (exact_s, td, tm)
        else:
            note = (note + '; ' if note else '') + 'NASA value %.1f arcsec past %d°%02d′' % (exact_s, td, tm)
        out.add('position', ctx, label, '%s %d°%02d′' % (sign, deg, minute), '%s %s' % (tsign.capitalize(), C.fmt_dm(lon % 30)),
                '%+.1f arcsec' % ((deg + minute / 60.0 - lon % 30) * 3600), ok, note)
    else:
        out.add('position', ctx, label, '%s %d°%02d′' % (sign, deg, minute), '%s %s' % (tsign.capitalize(), C.fmt_dm(lon % 30)),
                '' if ok else 'sign differs', ok, note)


def check_instant(out, ctx, cat, label, pub_jd, truth, tol_s, precision_s=60, extra_ok=True, note=''):
    """pub_jd is a minute-precision published instant (HH:MM): accept truncation or rounding of the true time."""
    if truth is None:
        out.add(cat, ctx, label, C.iso(pub_jd + 0.5 / 86400)[:16].replace('T', ' ') + ' UTC', 'no such event within range', '', False, note)
        return
    d = C.secs(pub_jd, truth['jd'])
    # a published HH:MM can represent any true instant in [HH:MM, HH:MM+60s) (truncation) or ±30 s (rounding)
    if precision_s == 60:
        # the site truncates times to the minute: HH:MM stands for [HH:MM, HH:MM+60 s)
        d_eff = 0.0 if -60 < d <= 0 else (-60 - d if d <= -60 else d)
    elif precision_s == 86400:
        d_eff = 0.0 if -86400 < d <= 0 else (d + 86400 if d <= -86400 else d)
    else:
        d_eff = d
    ok = abs(d_eff) <= tol_s and extra_ok
    if precision_s == 86400:
        diff = '%+.2f h' % (d / 3600) if abs(d_eff) > 0 else 'same UTC date'
        ours = C.iso(pub_jd)[:10]
    else:
        diff = '%+.0f s' % d
        ours = C.iso(pub_jd + 0.5 / 86400)[:16].replace('T', ' ') + ' UTC'
    out.add(cat, ctx, label, ours, truth['at'], diff, ok, note)


def check_date(out, ctx, cat, label, d, truth, note=''):
    """A published calendar date (UTC basis) for an event."""
    if truth is None:
        out.add(cat, ctx, label, d.isoformat(), 'no such event within range', '', False, note)
        return
    tdate = truth['at'][:10]
    ok = tdate == d.isoformat()
    n = note
    hrs = ((truth['jd'] + 0.5) % 1) * 24  # hour of day UTC
    if not ok:
        diff = '%+d day' % (datetime.date.fromisoformat(tdate) - d).days
    else:
        diff = ''
        if hrs < 3 or hrs > 21:
            n = (n + '; ' if n else '') + 'within 3 h of a UTC day boundary (%s UTC)' % truth['at'][11:16]
    out.add(cat, ctx, label, d.isoformat(), truth['at'], diff, ok, n)


# --- extractors ------------------------------------------------------------------
def ex_positions_noon_tables(out, ctx):
    """Where the planets are / sky-behind-this-reading tables at noon UTC."""
    L = ctx.lines
    pd = ctx.page_date
    if pd is None:
        return
    for i, ln in enumerate(L):
        m = re.fullmatch(r'Noon UTC, ' + MONTH_RE + r' (\d{1,2}), (\d{4})\.', ln)
        if m:
            d = mkdate(m.group(3), month_num(m.group(1)), m.group(2))
            j = noon_jd(d)
            k = i + 1
            while k < len(L) - 4 and k < i + 80:
                if re.fullmatch(BODY, L[k]) and re.fullmatch(SIGN, L[k + 2]) and re.fullmatch(DM, L[k + 3]):
                    mm = re.fullmatch(DM, L[k + 3])
                    check_position(out, ctx, L[k], L[k + 2], int(mm.group(1)), int(mm.group(2)), j,
                                   '%s %s %s at noon UTC %s' % (L[k], L[k + 3], L[k + 2], d))
                    status = L[k + 4]
                    if L[k] not in ('Sun', 'Moon') and status in ('Direct', 'Retrograde'):
                        retro = C.speed(L[k], j) < 0
                        out.add('direction', ctx, '%s %s at noon UTC %s' % (L[k], status.lower(), d), status,
                                'Retrograde' if retro else 'Direct', '', (status == 'Retrograde') == retro)
                    k += 5
                else:
                    k += 1
    # "Also in this sky: Sun 14°05′ Scorpio", "Sun 14°05′ Scorpio" header lines (noon UTC of the page date)
    if re.search(r'noon UTC|Noon UTC|12 UTC|Positions for noon UTC', ctx.text):
        j = noon_jd(pd)
        for m in re.finditer(BODY + r' ' + DM + r' ' + SIGN, ctx.text):
            check_position(out, ctx, m.group(1), m.group(4), int(m.group(2)), int(m.group(3)), j,
                           '%s %s°%s′ %s (noon UTC %s)' % (m.group(1), m.group(2), m.group(3), m.group(4), pd))
        for m in re.finditer(r'(?:¶|^) ?(?:Moon|Sun) in ' + SIGN + r' ¶ [^¶]{0,200}¶ ' + DM, ctx.text):
            pass
        # the sky behind a daily reading: "Moon in Libra ¶ ... ¶ 11°33′"
        for m in re.finditer(BODY + r' in ' + SIGN + r' ¶ ((?:Retrograde\.|Waning|Waxing|Full|New|First|Last|Direct)[^¶]{0,200}) ¶ ' + DM, ctx.text):
            check_position(out, ctx, m.group(1), m.group(2), int(m.group(4)), int(m.group(5)), j,
                           '%s in %s %s°%s′ (sky behind the reading, noon UTC %s)' % (m.group(1), m.group(2), m.group(4), m.group(5), pd))
            if m.group(1) not in ('Sun', 'Moon'):
                retro = C.speed(m.group(1), j) < 0
                says = m.group(3).startswith('Retrograde')
                out.add('direction', ctx, '%s %s at noon UTC %s' % (m.group(1), 'retrograde' if says else 'not marked retrograde', pd),
                        'R' if says else 'D', 'R' if retro else 'D', '', says == retro)
    # "Moon 11.6° Libra at 12:00 UTC", "Mercury 9.8° Scorpio, retrograde at 12:00 UTC"
    for m in re.finditer(BODY + r' (\d{1,2}\.\d)° ' + SIGN + r'(, retrograde)? at (\d{2}):(\d{2}) UTC', ctx.text):
        j = hm_jd(pd, m.group(5), m.group(6))
        check_position(out, ctx, m.group(1), m.group(3), None, None, j,
                       '%s %s° %s%s at %s:%s UTC %s' % (m.group(1), m.group(2), m.group(3), m.group(4) or '', m.group(5), m.group(6), pd),
                       decimal=float(m.group(2)))
        if m.group(1) not in ('Sun', 'Moon'):
            retro = C.speed(m.group(1), j) < 0
            out.add('direction', ctx, '%s %s at %s:%s UTC %s' % (m.group(1), 'retrograde' if m.group(4) else 'direct', m.group(5), m.group(6), pd),
                    'R' if m.group(4) else 'D', 'R' if retro else 'D', '', bool(m.group(4)) == retro)


def ex_coming_up(out, ctx):
    """Calendar rows: Mon ¶ D ¶ Title ¶ detail · HH:MM UTC."""
    pd = ctx.page_date
    if pd is None:
        return
    L = ctx.lines
    for i in range(len(L) - 3):
        if L[i] in MON3 and re.fullmatch(r'\d{1,2}', L[i + 1]):
            mon = month_num(L[i])
            y = pd.year + (1 if mon < pd.month - 6 else 0)
            d = mkdate(y, mon, L[i + 1])
            title, detail = L[i + 2], L[i + 3]
            tm = re.search(r'(\d{2}):(\d{2}) UTC', detail)
            if not tm or d is None:
                continue
            pj = hm_jd(d, tm.group(1), tm.group(2))
            lab = '%s, %s %s' % (title, d, detail)
            m = re.fullmatch(r'(New|Full) moon in ' + SIGN, title)
            if m:
                tr = truth_lunation(m.group(1).lower(), pj)
                check_instant(out, ctx, 'lunation', lab, pj, tr, C.TOL_INSTANT_S, extra_ok=tr is not None and tr['sign'] == m.group(2).lower())
                dm = re.match(DM + ' ' + SIGN, detail)
                if dm and tr:
                    check_position(out, ctx, 'Moon', dm.group(3), int(dm.group(1)), int(dm.group(2)), tr['jd'], 'Moon at the %s moon %s: %s' % (m.group(1).lower(), d, detail))
                continue
            m = re.fullmatch(PLANET + r' stations (direct|retrograde)', title)
            if m:
                tr = truth_station(m.group(1), m.group(2), pj)
                check_instant(out, ctx, 'station', lab, pj, tr, C.TOL_STATION_S)
                dm = re.match(DM + ' ' + SIGN, detail)
                if dm and tr:
                    check_position(out, ctx, m.group(1), dm.group(3), int(dm.group(1)), int(dm.group(2)), tr['jd'], '%s station degree %s: %s' % (m.group(1), d, detail))
                continue
            m = re.fullmatch(BODY + r' enters ' + SIGN, title)
            if m:
                tr = truth_ingress(m.group(1), m.group(2), pj)
                check_instant(out, ctx, 'ingress', lab, pj, tr, C.TOL_INSTANT_S)
                continue
            m = re.fullmatch(BODY + r' (conjunct|sextile|square|trine|opposite|opposition) ' + BODY, title)
            if m:
                typ = {'conjunct': 'conjunction', 'opposite': 'opposition'}.get(m.group(2), m.group(2))
                tx = aspect_exact(m.group(1), m.group(3), ASPECT_ANGLE[typ], pj)
                tr = {'jd': tx, 'at': C.iso(tx)} if tx else None
                check_instant(out, ctx, 'aspect', lab, pj, tr, aspect_tolerance_s(m.group(1), m.group(3), tx) if tx else 60)
                continue
            m = re.search(r'(solar|lunar) eclipse', title, re.I)
            if m:
                ne = min(nasa_eclipses(), key=lambda e: abs(e['jd'] - pj))
                check_instant(out, ctx, 'eclipse', lab, pj, ne if abs(ne['jd'] - pj) < 2 else None, C.TOL_INSTANT_S)


def ex_marker_lines(out, ctx):
    """'New moon in Scorpio ¶ Exact Nov 9, 07:02 UTC. ... ¶ 16°53′' and
    'Mercury in Scorpio ¶ Stations direct Nov 13, 15:53 UTC. ... ¶ 5°02′' (horoscope sky markers)."""
    pd = ctx.page_date
    if pd is None:
        return
    t = ctx.text
    pat = r'(?:(New|Full) moon in ' + SIGN + r'|' + BODY + r' in ' + SIGN + r') ¶ (Exact|Stations direct|Stations retrograde|Enters ' + SIGN + r')\.? ' + MONTH_RE + r' (\d{1,2}), (\d{2}):(\d{2}) UTC\.[^¶]* ¶ ' + DM
    for m in re.finditer(pat, t):
        mon = month_num(m.group(7))
        y = pd.year + (1 if mon < pd.month - 6 else 0) - (1 if mon > pd.month + 6 else 0)
        d = mkdate(y, mon, m.group(8))
        pj = hm_jd(d, m.group(9), m.group(10))
        lab = m.group(0).replace(' ¶ ', ' / ')[:160]
        deg, minute = int(m.group(11)), int(m.group(12))
        if m.group(1):
            tr = truth_lunation(m.group(1).lower(), pj)
            check_instant(out, ctx, 'lunation', lab, pj, tr, C.TOL_INSTANT_S, extra_ok=tr is not None and tr['sign'] == m.group(2).lower())
            if tr:
                check_position(out, ctx, 'Moon', m.group(2), deg, minute, tr['jd'], 'degree of the %s moon %s' % (m.group(1).lower(), d))
        else:
            body, sign, what = m.group(3), m.group(4), m.group(5)
            if what.startswith('Stations'):
                tr = truth_station(body, what.split()[1], pj)
                check_instant(out, ctx, 'station', lab, pj, tr, C.TOL_STATION_S)
                if tr:
                    check_position(out, ctx, body, sign, deg, minute, tr['jd'], '%s station degree %s' % (body, d))
            elif what.startswith('Enters'):
                tr = truth_ingress(body, m.group(6), pj)
                check_instant(out, ctx, 'ingress', lab, pj, tr, C.TOL_INSTANT_S)


def ex_event_detail(out, ctx):
    """/full-moon/, /new-moon/, /eclipses/<date>/, /events/ detail pages."""
    t = ctx.text
    m = re.search(r'Exact instant ¶ (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)', t)
    if not m:
        return
    iso = m.group(1)
    pj = C.jd(iso)
    if not (C.jd('2025-11-05T00:00:00Z') < pj < C.jd('2031-01-20T00:00:00Z')):
        return
    url = ctx.url
    lonm = re.search(r'Ecliptic longitude ¶ (\d{1,3}\.\d{2})° · ' + DM + ' ' + SIGN, t)
    tm = re.search(r'Exact at ¶ \w+day, ' + MONTH_RE + r' (\d{1,2}), (\d{4}) at (\d{2}):(\d{2}) UTC', t)
    if url.startswith('/full-moon/') or url.startswith('/new-moon/'):
        kind = 'full' if url.startswith('/full-moon/') else 'new'
        tr = truth_lunation(kind, pj)
        sm = re.search(r'In the sign ¶ ' + SIGN, t)
        check_instant(out, ctx, 'lunation', '%s moon exact instant %s' % (kind, iso), pj, tr, C.TOL_INSTANT_S, precision_s=0,
                      extra_ok=bool(tr and sm and tr['sign'] == sm.group(1).lower()))
        if tr and lonm:
            check_position(out, ctx, 'Moon', lonm.group(4), int(lonm.group(2)), int(lonm.group(3)), tr['jd'], '%s moon at %s %s' % (kind, lonm.group(2) + '°' + lonm.group(3) + '′', lonm.group(4)))
        if tr and tm:
            d = mkdate(tm.group(3), month_num(tm.group(1)), tm.group(2))
            check_instant(out, ctx, 'lunation', '%s moon %s at %s:%s UTC' % (kind, d, tm.group(4), tm.group(5)), hm_jd(d, tm.group(4), tm.group(5)), tr, C.TOL_INSTANT_S)
        if tr and url.rstrip('/').split('/')[-1] != tr['at'][:10]:
            out.add('lunation-date', ctx, 'page dated %s' % url.rstrip('/').split('/')[-1], url.rstrip('/').split('/')[-1], tr['at'], '', False, 'URL date differs from the UTC date')
    elif url.startswith('/eclipses/20'):
        ne = min(nasa_eclipses(), key=lambda e: abs(e['jd'] - pj))
        d = C.secs(pj, ne['jd'])
        out.add('eclipse', ctx, 'eclipse peak %s' % iso, iso, ne['at'] + ' (NASA canon %s, greatest eclipse)' % ne['catalog'], '%+.1f s' % d, abs(d) <= C.TOL_INSTANT_S)
        if lonm and ne['lon'] is not None:
            check_position(out, ctx, 'Sun' if ne['type'] == 'solar' else 'Moon', lonm.group(4), int(lonm.group(2)), int(lonm.group(3)), ne['jd'],
                           '%s eclipse position %s°%s′ %s' % (ne['type'], lonm.group(2), lonm.group(3), lonm.group(4)))
        km = re.search(r'This one is (total|annular|partial|penumbral|hybrid)', t)
        if km:
            out.add('eclipse-type', ctx, 'This one is %s (%s eclipse)' % (km.group(1), ne['type']), km.group(1), ne['kind'] + ' (NASA canon)', '', km.group(1) == ne['kind'])
        if ne['type'] == 'solar' and re.search(r'The Moon stands at', t):
            out.add('wording', ctx, 'solar eclipse page labels the eclipse degree "The Moon stands at"', 'The Moon stands at', 'Sun and Moon conjunct at the eclipse; label is correct but an astrologer quotes the Sun', '', True, 'not an error')


def ex_eclipse_tables(out, ctx):
    """/eclipses/ list: 'Tue, February 17, 2026 ¶ 12:11 ¶ Annular solar ¶ Aquarius'."""
    t = ctx.text
    for m in re.finditer(r'\w{3}, ' + MONTH_RE + r' (\d{1,2}), (\d{4}) ¶ (\d{2}):(\d{2}) ¶ (Total|Annular|Partial|Penumbral|Hybrid) (solar|lunar) ¶ ' + SIGN, t):
        d = mkdate(m.group(3), month_num(m.group(1)), m.group(2))
        pj = hm_jd(d, m.group(4), m.group(5))
        ne = min(nasa_eclipses(), key=lambda e: abs(e['jd'] - pj))
        lab = '%s %s eclipse %s %s:%s UTC in %s' % (m.group(6), m.group(7), d, m.group(4), m.group(5), m.group(8))
        ok_sign = ne['lon'] is not None and C.sign_of(ne['lon']) == m.group(8).lower()
        check_instant(out, ctx, 'eclipse', lab, pj, ne if abs(ne['jd'] - pj) < 1 else None, C.TOL_INSTANT_S,
                      extra_ok=ok_sign and ne['kind'] == m.group(6).lower() and ne['type'] == m.group(7))
    # "at 18° Aquarius" eclipse lines on the year page
    for m in re.finditer(r'(Total|Annular|Partial|Penumbral|Hybrid) (solar|lunar) eclipse ¶ A (?:new|full) Moon with extra weight at (\d{1,2})° ' + SIGN, t):
        pd = None
        # the date line precedes the title
        pre = t[:m.start()].rstrip(' ¶').split(' ¶ ')
        dm = re.fullmatch(MONTH_RE + r' (\d{1,2})', pre[-1].strip()) if pre else None
        yr = 2027 if ctx.url.startswith('/your-2027-sky') else (ctx.page_date.year if ctx.page_date else None)
        if dm and yr:
            pd = mkdate(yr, month_num(dm.group(1)), dm.group(2))
        if pd is None:
            continue
        ne = min(nasa_eclipses(), key=lambda e: abs(e['jd'] - noon_jd(pd)))
        lon = ne['lon']
        tdeg = int(math.floor(lon % 30))
        pub = int(m.group(3))
        ok = pub == tdeg and C.sign_of(lon) == m.group(4).lower()
        out.add('degree-display', ctx, '%s %s eclipse %s "at %d° %s"' % (m.group(1), m.group(2), pd, pub, m.group(4)), '%d° %s' % (pub, m.group(4)),
                '%s (astrologers write %d°)' % (C.fmt_dm(lon % 30, C.sign_of(lon)), tdeg), '%+d°' % (pub - tdeg) if not ok else '', ok,
                'rounded, not truncated' if not ok else '')


def ex_station_windows(out, ctx):
    """Retrograde windows: 'Feb 26, 2026 to Mar 20, 2026 ¶ 22°33′ Pisces ¶ 8°29′ Pisces' under a planet heading."""
    L = ctx.lines
    planet = None
    if ctx.url.startswith('/mercury-retrograde'):
        planet = 'Mercury'
    elif ctx.url.startswith('/venus-retrograde'):
        planet = 'Venus'
    elif ctx.url.startswith('/mars-retrograde'):
        planet = 'Mars'
    rng = re.compile(MONTH_RE + r' (\d{1,2}), (\d{4}) to ' + MONTH_RE + r' (\d{1,2}), (\d{4})$')
    until = re.compile(r'already retrograde as (\d{4}) opened, until ' + MONTH_RE + r' (\d{1,2}), (\d{4})')
    for i, ln in enumerate(L):
        if ctx.url.startswith('/retrogrades/') and re.fullmatch(PLANET, ln) and i + 1 < len(L) and (L[i + 1].startswith('every') or L[i + 1].startswith('yearly') or L[i + 1] == 'retrograde now'):
            planet = ln
        if planet is None:
            continue
        m = rng.fullmatch(ln)
        if m and i + 2 < len(L):
            d1 = mkdate(m.group(3), month_num(m.group(1)), m.group(2))
            d2 = mkdate(m.group(6), month_num(m.group(4)), m.group(5))
            if not (in_range(d1) and in_range(d2)):
                continue
            tr1 = truth_station(planet, 'retrograde', noon_jd(d1))
            tr2 = truth_station(planet, 'direct', noon_jd(d2))
            check_date(out, ctx, 'station-date', '%s stations retrograde %s' % (planet, d1), d1, tr1)
            check_date(out, ctx, 'station-date', '%s stations direct %s' % (planet, d2), d2, tr2)
            for k, tr, kind in ((i + 1, tr1, 'retrograde'), (i + 2, tr2, 'direct')):
                dm = re.fullmatch(DM + ' ' + SIGN, L[k])
                if dm and tr:
                    check_position(out, ctx, planet, dm.group(3), int(dm.group(1)), int(dm.group(2)), tr['jd'], '%s %s station at %s' % (planet, kind, L[k]))
        m = until.search(ln)
        if m and i + 2 < len(L):
            d2 = mkdate(m.group(4), month_num(m.group(2)), m.group(3))
            tr2 = truth_station(planet, 'direct', noon_jd(d2))
            check_date(out, ctx, 'station-date', '%s stations direct %s' % (planet, d2), d2, tr2)
            dm = re.fullmatch(DM + ' ' + SIGN, L[i + 2])
            if dm and tr2:
                check_position(out, ctx, planet, dm.group(3), int(dm.group(1)), int(dm.group(2)), tr2['jd'], '%s direct station at %s' % (planet, L[i + 2]))
    # detail pages: "N.N° · D°MM′ Sign"
    for m in re.finditer(r'(\d{1,3}\.\d{1,2})° · ' + DM + ' ' + SIGN, ctx.text):
        pass


def ex_seasons(out, ctx):
    t = ctx.text
    # season page: 'The Sun enters ¶ Friday, October 23, 2026 ¶ 09:38 UTC'
    for m in re.finditer(r'The Sun (enters|leaves) ¶ \w+day, ' + MONTH_RE + r' (\d{1,2}), (\d{4}) ¶ (\d{2}):(\d{2}) UTC', t):
        sign = re.search(r'The Sun in ' + SIGN, t)
        if not sign:
            continue
        s = sign.group(1)
        d = mkdate(m.group(4), month_num(m.group(2)), m.group(3))
        target = s if m.group(1) == 'enters' else C.SIGN_NAMES[(C.SIGN_NAMES.index(s) + 1) % 12]
        pj = hm_jd(d, m.group(5), m.group(6))
        check_instant(out, ctx, 'ingress', 'The Sun %s %s %s %s:%s UTC' % (m.group(1), s, d, m.group(5), m.group(6)), pj, truth_ingress('Sun', target, pj), C.TOL_INSTANT_S)
    # year table: '2026 ¶ Oct 23, 2026 ¶ 09:38 ¶ Nov 22, 2026 ¶ 07:23 ¶ 30'
    sign = re.search(r'The Sun in ' + SIGN, t)
    if sign:
        s = sign.group(1)
        nxt = C.SIGN_NAMES[(C.SIGN_NAMES.index(s) + 1) % 12]
        for m in re.finditer(r'(\d{4}) ¶ ' + MONTH_RE + r' (\d{1,2}), (\d{4}) ¶ (\d{2}):(\d{2}) ¶ ' + MONTH_RE + r' (\d{1,2}), (\d{4}) ¶ (\d{2}):(\d{2}) ¶ (\d+)', t):
            d1 = mkdate(m.group(4), month_num(m.group(2)), m.group(3))
            d2 = mkdate(m.group(9), month_num(m.group(7)), m.group(8))
            p1 = hm_jd(d1, m.group(5), m.group(6))
            p2 = hm_jd(d2, m.group(10), m.group(11))
            t1, t2 = truth_ingress('Sun', s, p1), truth_ingress('Sun', nxt, p2)
            check_instant(out, ctx, 'ingress', 'Sun enters %s %s %s:%s UTC' % (s, d1, m.group(5), m.group(6)), p1, t1, C.TOL_INSTANT_S)
            check_instant(out, ctx, 'ingress', 'Sun leaves %s %s %s:%s UTC' % (s, d2, m.group(10), m.group(11)), p2, t2, C.TOL_INSTANT_S)
            if t1 and t2:
                days = (t2['jd'] - t1['jd'])
                out.add('duration', ctx, '%s season %s lasts %s days' % (s, m.group(1), m.group(12)), m.group(12), '%.2f days' % days, '',
                        int(m.group(12)) == round(days), '')
        for m in re.finditer(r'The Sun enters ' + SIGN + r' on ' + MONTH_RE + r' (\d{1,2}), (\d{4}), (\d{2}):(\d{2}) UTC and leaves on ' + MONTH_RE + r' (\d{1,2}), (\d{4}), (\d{2}):(\d{2}) UTC', t):
            d1 = mkdate(m.group(4), month_num(m.group(2)), m.group(3))
            p1 = hm_jd(d1, m.group(5), m.group(6))
            check_instant(out, ctx, 'ingress', 'The Sun enters %s on %s, %s:%s UTC (FAQ)' % (m.group(1), d1, m.group(5), m.group(6)), p1, truth_ingress('Sun', m.group(1), p1), C.TOL_INSTANT_S)
    # hub: 'Scorpio season ¶ October 23 to November 22, 2026'
    if ctx.url == '/seasons/':
        for m in re.finditer(SIGN + r' season ¶ ' + MONTH_RE + r' (\d{1,2}) to ' + MONTH_RE + r' (\d{1,2}), (\d{4})', t):
            s = m.group(1)
            nxt = C.SIGN_NAMES[(C.SIGN_NAMES.index(s) + 1) % 12]
            y2 = int(m.group(6))
            m1, m2 = month_num(m.group(2)), month_num(m.group(4))
            y1 = y2 - 1 if m1 > m2 else y2
            d1, d2 = mkdate(y1, m1, m.group(3)), mkdate(y2, m2, m.group(5))
            check_date(out, ctx, 'ingress-date', 'Sun enters %s on %s (%s season hub)' % (s, d1, s), d1, truth_ingress('Sun', s, noon_jd(d1)))
            check_date(out, ctx, 'ingress-date', 'Sun leaves %s on %s (%s season hub)' % (s, d2, s), d2, truth_ingress('Sun', nxt, noon_jd(d2)))


def ex_zodiac_dates(out, ctx):
    for m in re.finditer(SIGN + r' ¶ [^¶]+ ¶ U\+26[0-9A-F]{2} ¶ .*?(\d{4})-(\d{2})-(\d{2}) · (\d{2}):(\d{2}) UTC ¶ (\d{4})-(\d{2})-(\d{2}) · (\d{2}):(\d{2}) UTC', ctx.text):
        s = m.group(1)
        for k in (2, 7):
            d = mkdate(m.group(k), m.group(k + 1), m.group(k + 2))
            pj = hm_jd(d, m.group(k + 3), m.group(k + 4))
            check_instant(out, ctx, 'ingress', 'Sun enters %s %s %s:%s UTC (zodiac dates table)' % (s, d, m.group(k + 3), m.group(k + 4)), pj, truth_ingress('Sun', s, pj), C.TOL_INSTANT_S)


def ex_sign_ranges(out, ctx, ranges_seen):
    """Conventional date ranges ('Aries ¶ Mar 21 to Apr 19'): how often 1940 to 2030 the Sun is in the sign
    at noon UTC on the first and last day."""
    for m in re.finditer(SIGN + r' ¶ ' + MONTH_RE + r' (\d{1,2}) to ' + MONTH_RE + r' (\d{1,2})(?= ¶)', ctx.text):
        key = (m.group(1), m.group(2), m.group(3), m.group(4), m.group(5))
        ranges_seen[key].add(ctx.url)


def range_stats(key):
    s, m1, d1, m2, d2 = key
    idx = C.SIGN_NAMES.index(s)
    a = b = n = 0
    for y in range(1940, 2031):
        j1 = C.jd('%04d-%02d-%02dT12:00:00Z' % (y, month_num(m1), int(d1)))
        if C.sign_of(C.lon('Sun', j1)) == s.lower():
            a += 1
        y2 = y + (1 if month_num(m2) < month_num(m1) else 0)
        j2 = C.jd('%04d-%02d-%02dT12:00:00Z' % (y2, month_num(m2), int(d2)))
        if y2 <= 2030 and C.sign_of(C.lon('Sun', j2)) == s.lower():
            b += 1
        n += 1
    # day after the end and day before the start
    return a, b, n


# --- prose scanner -------------------------------------------------------------------
PROSE_EVENT = [
    ('station', re.compile(PLANET + r'(?:,[^,.;]{1,40},)? (?:stations|turns|goes|went|stationed|turned) (direct|retrograde)')),
    ('ingress', re.compile(BODY + r'(?:,[^,.;]{1,40},)? (?:enters|moves into|moved into|entered|slips into|crosses into|arrives in|reaches|returns to|re-enters|into) ' + SIGN)),
    ('lunation', re.compile(r'\b(new|full) moon(?: in ' + SIGN + r')?(?: at (\d{1,2}(?:\.\d)?)° ' + SIGN + r')?', re.I)),
    ('aspect', re.compile(BODY + r'(?:, [^,.;]{1,30},)? (conjoins|conjunct|meets|sextiles|sextile|squares|square|trines|trine|opposes|opposite) ' + BODY + r'(?: at (\d{1,2}(?:\.\d)?)°)?')),
]
DATE_IN_TEXT = re.compile(MONTH_RE + r' (\d{1,2})(?:st|nd|rd|th)?(?:, (\d{4}))?\b')
SECTION_YEAR = re.compile(r'\b(20[2-3]\d)\b')


def ex_prose(out, ctx):
    pd = ctx.page_date
    url = ctx.url
    year_hint = None
    m = re.search(r'/(20\d\d)/?', url)
    if m:
        year_hint = int(m.group(1))
    for ln in ctx.lines:
        if len(ln) < 40:
            continue
        for sent in re.split(r'(?<=[.!?])\s+| · |; ', ln):
            dates = list(DATE_IN_TEXT.finditer(sent))
            if not dates:
                continue
            teaser = sent.rstrip().endswith('…')
            for kind, rx in PROSE_EVENT:
                for em in rx.finditer(sent):
                    # nearest date mention in the same sentence
                    best = min(dates, key=lambda dm: min(abs(dm.start() - em.end()), abs(em.start() - dm.end())))
                    mon = month_num(best.group(1))
                    if best.group(3):
                        y = int(best.group(3))
                    elif year_hint and not teaser:
                        y = year_hint
                    elif pd:
                        y = pd.year + (1 if mon < pd.month - 6 else 0) - (1 if mon > pd.month + 6 else 0)
                    else:
                        continue
                    d = mkdate(y, mon, best.group(2))
                    if not in_range(d):
                        continue
                    lab = '%s [%s]' % (sent.strip()[:220], kind)
                    nj = noon_jd(d)
                    if kind == 'station':
                        tr = truth_station(em.group(1), em.group(2), nj)
                        check_date(out, ctx, 'prose-station', lab, d, tr)
                    elif kind == 'ingress':
                        body, sign = em.group(1), em.group(2)
                        if body == 'Moon' and not re.search(r'\bthe Moon (?:enters|moves into|slips into|crosses into)', sent):
                            continue
                        if body == 'Moon':
                            tr = truth_ingress('Moon', sign, nj, max_days=3)
                        else:
                            tr = truth_ingress(body, sign, nj)
                        check_date(out, ctx, 'prose-ingress', lab, d, tr)
                    elif kind == 'lunation':
                        k = em.group(1).lower()
                        tr = truth_lunation(k, nj)
                        sign = em.group(2) or em.group(4)
                        if tr is not None and sign and tr['sign'] != sign.lower():
                            out.add('prose-lunation', ctx, lab, sign, tr['sign'], '', False, 'sign differs')
                        check_date(out, ctx, 'prose-lunation', lab, d, tr)
                        if em.group(3) and tr:
                            pub = float(em.group(3))
                            okd = abs(pub - tr['degree']) <= (0.05 + 0.003 if '.' in em.group(3) else 0.0) or ('.' not in em.group(3) and int(pub) == math.floor(tr['degree']))
                            out.add('prose-degree', ctx, lab, '%s°' % em.group(3), C.fmt_dm(tr['degree'], tr['sign']), '%+.2f°' % (pub - tr['degree']), okd,
                                    '' if okd else ('rounded, not truncated' if '.' not in em.group(3) and round(tr['degree']) == pub else ''))
                    elif kind == 'aspect':
                        a, verb, b = em.group(1), em.group(2), em.group(3)
                        typ = {'conjoins': 'conjunction', 'conjunct': 'conjunction', 'meets': 'conjunction', 'sextiles': 'sextile', 'sextile': 'sextile',
                               'squares': 'square', 'square': 'square', 'trines': 'trine', 'trine': 'trine', 'opposes': 'opposition', 'opposite': 'opposition'}[verb]
                        if a == b or (a == 'Sun' and b == 'Moon') or (a == 'Moon' or b == 'Moon'):
                            continue
                        tx = aspect_exact(a, b, ASPECT_ANGLE[typ], nj, span=10)
                        tr = {'jd': tx, 'at': C.iso(tx)} if tx else None
                        check_date(out, ctx, 'prose-aspect', lab, d, tr)
                        if em.group(4) and tx:
                            pub = float(em.group(4))
                            la = C.lon(a, tx) % 30
                            lb = C.lon(b, tx) % 30
                            okd = min(abs(pub - la), abs(pub - lb)) <= 0.053 if '.' in em.group(4) else int(pub) in (math.floor(la), math.floor(lb))
                            out.add('prose-degree', ctx, lab, '%s°' % em.group(4), '%s %.2f°, %s %.2f°' % (a, la, b, lb), '', okd)


def ex_moon_sign_prose(out, ctx):
    """Daily readings: 'Moon in Libra' headings on a dated edition (noon UTC basis)."""
    pd = ctx.page_date
    if pd is None or not (ctx.url.startswith('/horoscopes/') or ctx.url.startswith('/today/')):
        return
    if '/monthly' in ctx.url or '/weekly' in ctx.url or re.search(r'/20\d\d/', ctx.url):
        return
    d = pd
    if ctx.url.rstrip('/').endswith('tomorrow'):
        d = pd + datetime.timedelta(days=0)  # tomorrow pages carry their own date in the text
        m = re.search(r'follows the (\d{4}-\d{2}-\d{2}) noon-UTC sky', ctx.text)
        if m:
            d = datetime.date.fromisoformat(m.group(1))
    j = noon_jd(d)
    for m in set(re.findall(r'\bMoon in ' + SIGN, ctx.text)):
        lon = C.lon('Moon', j)
        ok = C.sign_of(lon) == m.lower()
        start = C.sign_of(C.lon('Moon', C.jd(d.isoformat() + 'T00:00:00Z')))
        end = C.sign_of(C.lon('Moon', C.jd(d.isoformat() + 'T23:59:59Z')))
        note = '' if start == end else 'the Moon changes sign that UTC day (%s to %s)' % (start, end)
        out.add('moon-sign', ctx, 'Moon in %s (edition %s, noon UTC)' % (m, d), m, '%s %s' % (C.sign_of(lon).capitalize(), C.fmt_dm(lon % 30)), '', ok, note)


COVER = {
    'Sun': ('1939-11-05', '2041-02-20'), 'Moon': ('2025-11-03', '2031-01-25'),
    'Mercury': ('2025-11-05', '2031-05-25'), 'Venus': ('2025-11-05', '2031-05-25'), 'Mars': ('2025-11-05', '2031-05-25'),
    'Jupiter': ('2013-11-15', '2046-02-15'), 'Saturn': ('1979-11-15', '2080-02-15'),
    'Uranus': ('1899-11-15', '2100-02-15'), 'Neptune': ('1899-11-15', '2100-02-15'), 'Pluto': ('1899-11-15', '2100-02-15'),
}


def covered(body, d):
    a, b = COVER[body]
    return d is not None and a <= d.isoformat() <= b


def ex_placement_windows(out, ctx):
    m = re.match(r'/learn/placements/(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)-in-(\w+)/$', ctx.url)
    if not m:
        return
    body, sign = m.group(1).capitalize(), m.group(2)
    if body == 'Moon':
        return
    rx = re.compile(MONTH_RE + r' (\d{1,2}), (\d{4}) to ' + MONTH_RE + r' (\d{1,2}), (\d{4})')
    only = re.compile(r'(?:' + rx.pattern + r')(?: · (?:' + rx.pattern + r'))*')
    for ln in ctx.lines:
        if not only.fullmatch(ln):
            continue
        for w in rx.finditer(ln):
            d1 = mkdate(w.group(3), month_num(w.group(1)), w.group(2))
            d2 = mkdate(w.group(6), month_num(w.group(4)), w.group(5))
            if covered(body, d1):
                tr = truth_ingress(body, sign, noon_jd(d1), max_days=5)
                check_date(out, ctx, 'window-date', '%s enters %s %s (placement window)' % (body, sign.capitalize(), d1), d1, tr)
            if covered(body, d2):
                ev = C.nearest(C.events()['ingresses'][body], noon_jd(d2), lambda e: e['sign'] != sign)
                tr = ev if ev and abs(ev['jd'] - noon_jd(d2)) < 5 else None
                check_date(out, ctx, 'window-date', '%s leaves %s %s (placement window)' % (body, sign.capitalize(), d2), d2, tr)


def ex_long_prose(out, ctx):
    """Long-range ingress prose: 'Neptune enters Taurus on May 21, 2038', 'Pluto ... into Aquarius in November 2024'."""
    rx = re.compile(PLANET + r'(?:[^.;]{0,40}?) (?:enters|entered|crosses into|crossed into|moves into|moved into|returns to|re-enters|settles in|arrives in) ' + SIGN
                    + r'(?: for good)?(?: on| in)? ' + MONTH_RE + r'(?: (\d{1,2}),)? (\d{4})')
    for ln in ctx.lines:
        for m in rx.finditer(ln):
            body, sign = m.group(1), m.group(2)
            y = int(m.group(5))
            mon = month_num(m.group(3))
            if m.group(4):
                d = mkdate(y, mon, m.group(4))
                if in_range(d) or not covered(body, d):
                    continue  # in-range dated claims are checked by ex_prose
                tr = truth_ingress(body, sign, noon_jd(d), max_days=400)
                check_date(out, ctx, 'prose-ingress', '%s [long-range ingress]' % m.group(0)[:200], d, tr)
            else:
                d = mkdate(y, mon, 15)
                if not covered(body, d):
                    continue
                evs = [e for e in C.events()['ingresses'][body] if e['sign'] == sign.lower() and e['at'][:7] == '%04d-%02d' % (y, mon)]
                near = truth_ingress(body, sign, noon_jd(d), max_days=400)
                out.add('prose-ingress-month', ctx, '%s [month-level ingress]' % m.group(0)[:200], '%s %d' % (m.group(3), y),
                        evs[0]['at'] if evs else (near['at'] if near else 'none'), '', bool(evs))


def ex_retro_detail(out, ctx):
    m = re.match(r'/(mercury|venus|mars)-retrograde/(\d{4}-\d{2}-\d{2})/$', ctx.url)
    if not m:
        return
    planet = m.group(1).capitalize()
    t = ctx.text
    mm = re.search(r'Retrograde station ¶ (\S+Z) ¶ Direct station ¶ (\S+Z) ¶ Pre-shadow begins ¶ (\S+Z) ¶ Post-shadow ends ¶ (\S+Z) ¶ Ecliptic longitude ¶ (\d+\.\d+)° · ' + DM + ' ' + SIGN, t)
    if not mm:
        return
    import audit_data as AD
    r_iso, d_iso, pre_iso, post_iso = mm.group(1), mm.group(2), mm.group(3), mm.group(4)
    tr_r = truth_station(planet, 'retrograde', C.jd(r_iso))
    tr_d = truth_station(planet, 'direct', C.jd(d_iso))
    check_instant(out, ctx, 'station', '%s retrograde station %s' % (planet, r_iso), C.jd(r_iso), tr_r, C.TOL_STATION_S, precision_s=0)
    check_instant(out, ctx, 'station', '%s direct station %s' % (planet, d_iso), C.jd(d_iso), tr_d, C.TOL_STATION_S, precision_s=0)
    if tr_r:
        check_position(out, ctx, planet, mm.group(8), int(mm.group(6)), int(mm.group(7)), tr_r['jd'], '%s retrograde station at %s°%s′ %s' % (planet, mm.group(6), mm.group(7), mm.group(8)))
    if tr_d:
        t0 = AD.last_crossing(planet, tr_d['lon'], tr_r['jd'] - 400, tr_r['jd'] - 0.01)
        check_instant(out, ctx, 'shadow', '%s pre-shadow starts %s' % (planet, pre_iso), C.jd(pre_iso), {'jd': t0, 'at': C.iso(t0)}, C.TOL_STATION_S, precision_s=0)
    if tr_r and tr_d:
        t1 = AD.crossing(planet, tr_r['lon'], tr_d['jd'] + 0.01, tr_d['jd'] + 400)
        if t1:
            check_instant(out, ctx, 'shadow', '%s post-shadow ends %s' % (planet, post_iso), C.jd(post_iso), {'jd': t1, 'at': C.iso(t1)}, C.TOL_STATION_S, precision_s=0)
    # the visible minute lines must be the truncated instants
    for iso_ in (r_iso, d_iso, pre_iso, post_iso):
        dd = datetime.date.fromisoformat(iso_[:10])
        vis = '%s %d, %d · %s UTC' % (MONTHS[dd.month - 1], dd.day, dd.year, iso_[11:16])
        out.add('render', ctx, 'instant %s shown as "%s"' % (iso_, vis), 'shown' if vis in t else 'not shown', 'truncated minute', '', vis in t)


def ex_lunation_lists(out, ctx):
    t = ctx.text
    # moon-phase list: 'Nov 9, 2026 ¶ 16°53′ Scorpio'
    if ctx.url == '/moon-phase/':
        for m in re.finditer(r'(?:¶|^) ?' + MONTH_RE + r' (\d{1,2}), (\d{4}) ¶ ' + DM + ' ' + SIGN, t):
            d = mkdate(m.group(3), month_num(m.group(1)), m.group(2))
            if not in_range(d):
                continue
            cands = [e for e in C.events()['lunations'] if e['type'] in ('new', 'full') and e['at'][:10] == d.isoformat()]
            if not cands:
                out.add('lunation-date', ctx, 'lunation on %s at %s°%s′ %s' % (d, m.group(4), m.group(5), m.group(6)), d.isoformat(), 'no new or full moon that UTC day', '', False)
                continue
            e = cands[0]
            check_position(out, ctx, 'Moon', m.group(6), int(m.group(4)), int(m.group(5)), e['jd'], '%s moon %s at %s°%s′ %s' % (e['type'], d, m.group(4), m.group(5), m.group(6)))
    # full / new moon calendars: 'Sat, January 3, 2026 ¶ 10:02 ¶ 13°01′ Cancer ¶ Wolf Moon'
    if ctx.url.startswith('/full-moon-calendar') or ctx.url.startswith('/new-moon'):
        kind = 'full' if 'full' in ctx.url else 'new'
        rows = []
        for m in re.finditer(r'\w{3}, ' + MONTH_RE + r' (\d{1,2}), (\d{4}) ¶ (\d{2}):(\d{2}) ¶ ' + DM + ' ' + SIGN + r'(?: ¶ ([^¶]+))?', t):
            d = mkdate(m.group(3), month_num(m.group(1)), m.group(2))
            pj = hm_jd(d, m.group(4), m.group(5))
            tr = truth_lunation(kind, pj)
            check_instant(out, ctx, 'lunation', '%s moon %s %s:%s UTC' % (kind, d, m.group(4), m.group(5)), pj, tr, C.TOL_INSTANT_S,
                          extra_ok=bool(tr and tr['sign'] == m.group(8).lower()))
            if tr:
                check_position(out, ctx, 'Moon', m.group(8), int(m.group(6)), int(m.group(7)), tr['jd'], '%s moon %s at %s°%s′ %s' % (kind, d, m.group(6), m.group(7), m.group(8)))
                rows.append((tr, (m.group(9) or '').strip()))
        if kind == 'full':
            for tr, name in rows:
                same = [e for e in C.events()['lunations'] if e['type'] == 'full' and e['at'][:7] == tr['at'][:7] and e['jd'] < tr['jd']]
                is_blue = bool(same)
                says = name.lower().startswith('blue moon')
                out.add('blue-moon', ctx, 'full moon %s labelled "%s"' % (tr['at'][:10], name), 'blue moon' if says else 'not blue', 'second full moon of its UTC month' if is_blue else 'first full moon of its UTC month', '', says == is_blue)


def moon_aspects(t0, t1):
    """Exact Moon aspects (0, 60, 90, 120, 180) to Sun..Pluto in [t0, t1]: [(jd, body, type)]."""
    names = {0: 'conjunction', 60: 'sextile', 90: 'square', 120: 'trine', 180: 'opposition'}
    out = []
    for b in ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']:
        for ang in (0, 60, -60, 90, -90, 120, -120, 180):
            def f(t):
                return wrap180(C.lon('Moon', t) - C.lon(b, t) - ang)
            step = 1 / 24.0
            t = t0
            f0 = f(t)
            while t < t1:
                tt = min(t + step, t1)
                f1 = f(tt)
                if (f0 <= 0 < f1 or f1 <= 0 < f0) and abs(f1 - f0) < 90:
                    lo, hi, flo = t, tt, f0
                    while hi - lo > 1e-8:
                        mid = 0.5 * (lo + hi)
                        fm = f(mid)
                        if (fm > 0) == (flo > 0):
                            lo, flo = mid, fm
                        else:
                            hi = mid
                    out.append((0.5 * (lo + hi), b, names[abs(ang)]))
                t, f0 = tt, f1
    return sorted(out)


def ex_void_of_course(out, ctx):
    if ctx.url != '/void-of-course-moon/':
        return
    L = ctx.lines
    head_year = head_month = None
    rowrx = re.compile(r'\w{3} (\d{1,2}) ' + MONTH_RE + r' · (\d{2}):(\d{2})')
    checked = 0
    for i, ln in enumerate(L):
        hm = re.fullmatch(r'(' + '|'.join(MONTHS) + r') (\d{4})', ln)
        if hm:
            head_month, head_year = month_num(hm.group(1)), int(hm.group(2))
            continue
        if head_year is None or i + 4 >= len(L):
            continue
        a = rowrx.fullmatch(ln)
        asp = re.fullmatch(r'Moon (conjunct|conjunction|sextile|square|trine|opposite|opposition) ' + BODY, L[i + 1])
        b = rowrx.fullmatch(L[i + 2])
        if not (a and asp and b and re.fullmatch(SIGN, L[i + 3])):
            continue
        if checked >= 60:
            break
        checked += 1

        def dt(mx):
            mon = month_num(mx.group(2))
            y = head_year - (1 if mon > head_month + 6 else 0) + (1 if mon < head_month - 6 else 0)
            return hm_jd(mkdate(y, mon, mx.group(1)), mx.group(3), mx.group(4))
        vb, ve = dt(a), dt(b)
        sign = L[i + 3]
        ing = truth_ingress('Moon', sign, ve, max_days=1)
        check_instant(out, ctx, 'moon-ingress', 'void ends: Moon enters %s %s' % (sign, L[i + 2]), ve, ing, C.TOL_INSTANT_S)
        if ing is None:
            continue
        prev = C.nearest(C.events()['ingresses']['Moon'], ing['jd'] - 2.3)
        asps = moon_aspects(prev['jd'] + 1e-6, ing['jd'] - 1e-6)
        last = asps[-1] if asps else None
        typ = {'conjunct': 'conjunction', 'opposite': 'opposition'}.get(asp.group(1), asp.group(1))
        if last is None:
            out.add('void', ctx, 'void begins %s with Moon %s %s' % (ln, typ, asp.group(2)), ln, 'no aspect in the sign', '', False)
            continue
        same = last[1] == asp.group(2) and last[2] == typ
        check_instant(out, ctx, 'void', 'void begins %s, last aspect Moon %s %s' % (ln, typ, asp.group(2)), vb,
                      {'jd': last[0], 'at': '%s (Moon %s %s)' % (C.iso(last[0]), last[2], last[1])}, C.TOL_INSTANT_S, extra_ok=same)
    m = re.search(r'The next void begins \w{3} (\d{1,2}) ' + MONTH_RE + r' · (\d{2}):(\d{2}) UTC and ends when the Moon enters ' + SIGN + r' at \w{3} (\d{1,2}) ' + MONTH_RE + r' · (\d{2}):(\d{2}) UTC', ctx.text)
    if m and ctx.page_date:
        y = ctx.page_date.year
        ve = hm_jd(mkdate(y, month_num(m.group(7)), m.group(6)), m.group(8), m.group(9))
        check_instant(out, ctx, 'moon-ingress', 'next void ends: Moon enters %s' % m.group(5), ve, truth_ingress('Moon', m.group(5), ve, max_days=1), C.TOL_INSTANT_S)


def ex_events(out, ctx):
    m = re.match(r'/events/(\w+)-(conjunction|sextile|square|trine|opposition)-(\w+)-(\d{4}-\d{2}-\d{2})/$', ctx.url)
    if not m:
        return
    a, typ, b = m.group(1).capitalize(), m.group(2), m.group(3).capitalize()
    iso = re.search(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)', ctx.text)
    if not iso:
        return
    pj = C.jd(iso.group(1))
    tx = aspect_exact(a, b, ASPECT_ANGLE[typ], pj, span=6)
    tol = aspect_tolerance_s(a, b, tx) if tx else 60
    check_instant(out, ctx, 'aspect', '%s %s %s exact %s' % (a, typ, b, iso.group(1)), pj, {'jd': tx, 'at': C.iso(tx)} if tx else None, tol, precision_s=0)
    hm = re.search(r'Exact, universal time ¶ (\d{2}):(\d{2}) UTC', ctx.text)
    if hm and tx:
        check_instant(out, ctx, 'aspect', '%s %s %s at %s:%s UTC on %s' % (a, typ, b, hm.group(1), hm.group(2), iso.group(1)[:10]),
                      hm_jd(datetime.date.fromisoformat(iso.group(1)[:10]), hm.group(1), hm.group(2)), {'jd': tx, 'at': C.iso(tx)}, tol)
    sm = re.search(a + r' ¶ ' + SIGN + r' ¶ ' + b + r' ¶ ' + SIGN + r' ¶ Both near ¶ (\d{1,2})° of their signs', ctx.text)
    if sm and tx:
        la, lb = C.lon(a, tx), C.lon(b, tx)
        ok = C.sign_of(la) == sm.group(1).lower() and C.sign_of(lb) == sm.group(2).lower() and int(sm.group(3)) in (math.floor(la % 30), math.floor(lb % 30))
        out.add('position', ctx, '%s in %s, %s in %s, both near %s°' % (a, sm.group(1), b, sm.group(2), sm.group(3)), sm.group(0).replace(' ¶ ', ' / ')[:80],
                '%s %s, %s %s' % (a, C.fmt_dm(la % 30, C.sign_of(la)), b, C.fmt_dm(lb % 30, C.sign_of(lb))), '', ok,
                '' if ok else ('rounded, not truncated' if int(sm.group(3)) == round(la % 30) else ''))


def ex_birthday(out, ctx):
    m = re.match(r'/birthday/(\w+)-(\d{1,2})/$', ctx.url)
    if not m:
        return
    mon, day = MONTHS.index(m.group(1).capitalize()) + 1, int(m.group(2))
    t = ctx.text
    # 'In 2026 ¶ Pisces until 14:45 UTC, then Aries'
    mm = re.search(r'In (\d{4}) ¶ ' + SIGN + r' until (\d{2}):(\d{2}) UTC, then ' + SIGN, t)
    if mm:
        d = mkdate(mm.group(1), mon, day)
        pj = hm_jd(d, mm.group(3), mm.group(4))
        check_instant(out, ctx, 'ingress', 'Sun %s until %s:%s UTC then %s, %s' % (mm.group(2), mm.group(3), mm.group(4), mm.group(5), d), pj, truth_ingress('Sun', mm.group(5), pj), C.TOL_INSTANT_S)
    # 'March 20, 2026: ¶ Sun 29°53′ Pisces, Moon in Aries at noon UTC'
    mm = re.search(MONTH_RE + r' (\d{1,2}), (\d{4}): ¶ Sun ' + DM + ' ' + SIGN + r', Moon in ' + SIGN + ' at noon UTC', t)
    if mm:
        d = mkdate(mm.group(3), month_num(mm.group(1)), mm.group(2))
        j = noon_jd(d)
        check_position(out, ctx, 'Sun', mm.group(6), int(mm.group(4)), int(mm.group(5)), j, 'Sun %s°%s′ %s at noon UTC %s' % (mm.group(4), mm.group(5), mm.group(6), d))
        ml = C.lon('Moon', j)
        out.add('moon-sign', ctx, 'Moon in %s at noon UTC %s' % (mm.group(7), d), mm.group(7), '%s %s' % (C.sign_of(ml).capitalize(), C.fmt_dm(ml % 30)), '', C.sign_of(ml) == mm.group(7).lower())
    # 'Sun degrees ¶ 29°00′ Pisces to 0°23′ Aries' (noon UTC, 1940 to 2030)
    mm = re.search(r'Sun degrees ¶ ' + DM + ' ' + SIGN + ' to ' + DM + ' ' + SIGN, t)
    if mm:
        years = [y for y in range(1940, 2031) if mkdate(y, mon, day)]
        lons = [C.lon('Sun', noon_jd(mkdate(y, mon, day))) for y in years]
        ref = lons[0]
        un = [ref + wrap180(x - ref) for x in lons]
        lo, hi = min(un) % 360, max(un) % 360
        for (dg, mn, sg), val, which in (((mm.group(1), mm.group(2), mm.group(3)), lo, 'lowest'), ((mm.group(4), mm.group(5), mm.group(6)), hi, 'highest')):
            td, tm = trunc_dm(val)
            ok = C.sign_of(val) == sg.lower() and (int(dg), int(mn)) == (td, tm)
            exact_s = ((val % 30) * 60 - (td * 60 + tm)) * 60
            note = ''
            if not ok:
                note = 'NASA value %.1f arcsec past %d°%02d′' % (exact_s, td, tm)
            out.add('position', ctx, '%s noon-UTC Sun degree 1940 to 2030 on %s %d: %s°%s′ %s' % (which, MONTHS[mon - 1], day, dg, mn, sg),
                    '%s°%s′ %s' % (dg, mn, sg), C.fmt_dm(val % 30, C.sign_of(val)), '%+.0f arcsec' % ((int(dg) + int(mn) / 60 - val % 30) * 3600) if C.sign_of(val) == sg.lower() else 'sign', ok, note)
    # per-year table rows: '1940 ¶ Pisces → Aries 18:23 UTC' or '1941 ¶ Aries'
    for mm in re.finditer(r'(?:¶|^) ?(19[4-9]\d|20[0-3]\d) ¶ (?:' + SIGN + r' → ' + SIGN + r' (\d{2}):(\d{2}) UTC|' + SIGN + r')(?= ¶)', t):
        y = int(mm.group(1))
        d = mkdate(y, mon, day)
        if d is None:
            continue
        if mm.group(2):
            pj = hm_jd(d, mm.group(4), mm.group(5))
            check_instant(out, ctx, 'ingress', 'Sun %s → %s %s %s:%s UTC (birthday table)' % (mm.group(2), mm.group(3), d, mm.group(4), mm.group(5)), pj, truth_ingress('Sun', mm.group(3), pj), C.TOL_INSTANT_S)
        else:
            s0 = C.sign_of(C.lon('Sun', C.jd(d.isoformat() + 'T00:00:00Z')))
            s1 = C.sign_of(C.lon('Sun', C.jd(d.isoformat() + 'T23:59:59Z')))
            ok = s0 == s1 == mm.group(6).lower()
            out.add('birthday-sign', ctx, '%s: Sun in %s all UTC day (birthday table)' % (d, mm.group(6)), mm.group(6), s0 if s0 == s1 else '%s then %s' % (s0, s1), '', ok)
    # 'sits at least N.N° inside SIGN'
    mm = re.search(r'The Sun sits at least (\d+(?:\.\d)?)° inside ' + SIGN, t)
    if mm:
        years = [y for y in range(1940, 2031) if mkdate(y, mon, day)]
        lo_margin = 99
        for y in years:
            d = mkdate(y, mon, day)
            for hhmm in ('T00:00:00Z', 'T12:00:00Z', 'T23:59:59Z'):
                lon = C.lon('Sun', C.jd(d.isoformat() + hhmm))
                if C.sign_of(lon) != mm.group(2).lower():
                    lo_margin = -1
                lo_margin = min(lo_margin, lon % 30, 30 - lon % 30) if lo_margin >= 0 else lo_margin
        pub = float(mm.group(1))
        noon = min(min(C.lon('Sun', noon_jd(mkdate(y, mon, day))) % 30, 30 - C.lon('Sun', noon_jd(mkdate(y, mon, day))) % 30) for y in years)
        ok = lo_margin >= 0 and (pub <= noon + 0.051)
        out.add('margin', ctx, 'Sun at least %s° inside %s on %s %d (1940 to 2030)' % (mm.group(1), mm.group(2), MONTHS[mon - 1], day), '%s°' % mm.group(1),
                'noon-UTC minimum %.3f°, whole-day minimum %.3f°' % (noon, lo_margin), '', ok, 'the margin is a noon-UTC figure' if pub > lo_margin + 0.051 and ok else '')


def ex_sky_calendar(out, ctx):
    if ctx.url != '/sky-calendar/' or ctx.page_date is None:
        return
    t = ctx.text
    pd = ctx.page_date
    for m in re.finditer(r'(New|Full) moon ¶ ' + MONTH_RE + r' (\d{1,2}) · (\d{1,2}):(\d{2}) (AM|PM)', t):
        hh = int(m.group(4)) % 12 + (12 if m.group(6) == 'PM' else 0)
        mon = month_num(m.group(2))
        d = mkdate(pd.year + (1 if mon < pd.month - 6 else 0), mon, m.group(3))
        pj = hm_jd(d, hh, m.group(5))
        check_instant(out, ctx, 'lunation', '%s moon %s %s:%s %s (sky calendar, UTC)' % (m.group(1), d, m.group(4), m.group(5), m.group(6)), pj, truth_lunation(m.group(1).lower(), pj), C.TOL_INSTANT_S)
    for m in re.finditer(PLANET + r' retrograde ¶ ' + MONTH_RE + r' (\d{1,2}) to ' + MONTH_RE + r' (\d{1,2})', t):
        m1, m2 = month_num(m.group(2)), month_num(m.group(4))
        y1 = pd.year - (1 if m1 > pd.month + 2 and m1 > m2 and pd.month < m2 + 3 else 0)
        y1 = pd.year if m1 <= pd.month or m1 <= m2 else pd.year
        d1 = mkdate(y1, m1, m.group(3))
        d2 = mkdate(y1 + (1 if m2 < m1 else 0), m2, m.group(5))
        check_date(out, ctx, 'station-date', '%s retrograde from %s (sky calendar)' % (m.group(1), d1), d1, truth_station(m.group(1), 'retrograde', noon_jd(d1)))
        check_date(out, ctx, 'station-date', '%s retrograde to %s (sky calendar)' % (m.group(1), d2), d2, truth_station(m.group(1), 'direct', noon_jd(d2)))


def main():
    pages = json.load(open(sys.argv[1]))
    out = Out()
    ranges_seen = collections.defaultdict(set)
    for url, lines in sorted(pages.items()):
        if url.startswith('/people/'):
            continue  # natal pages are audited from people.json with Horizons point queries
        ctx = Ctx(url, lines)
        ex_positions_noon_tables(out, ctx)
        ex_coming_up(out, ctx)
        ex_marker_lines(out, ctx)
        ex_event_detail(out, ctx)
        ex_eclipse_tables(out, ctx)
        ex_station_windows(out, ctx)
        ex_seasons(out, ctx)
        ex_zodiac_dates(out, ctx)
        ex_sign_ranges(out, ctx, ranges_seen)
        ex_prose(out, ctx)
        ex_moon_sign_prose(out, ctx)
        ex_placement_windows(out, ctx)
        ex_long_prose(out, ctx)
        ex_retro_detail(out, ctx)
        ex_lunation_lists(out, ctx)
        ex_void_of_course(out, ctx)
        ex_events(out, ctx)
        ex_birthday(out, ctx)
        ex_sky_calendar(out, ctx)
    for key, urls in sorted(ranges_seen.items()):
        a, b, n = range_stats(key)
        s, m1, d1, m2, d2 = key
        ok = a * 2 > n and b * 2 > n
        out.claims.add('sign-range', '%d pages, e.g. %s' % (len(urls), sorted(urls)[0]), '%s %s %s to %s %s' % key,
                       'first day %s %s, last day %s %s' % (m1, d1, m2, d2),
                       'Sun in %s at noon UTC on the first day in %d of %d years 1940 to 2030, on the last day in %d of %d' % (s, a, n, b, n),
                       '', ok, 'conventional range; checked at noon UTC')
    path = out.claims.save('pages.json')
    tot = collections.Counter((r['category'], r['ok']) for r in out.claims.rows)
    for k in sorted(tot):
        print(k, tot[k])
    print(path)


if __name__ == '__main__':
    main()
