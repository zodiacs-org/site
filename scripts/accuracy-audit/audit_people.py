"""Audit the famous-people birth charts (src/data/people.json and /people/ pages).

Every chart is computed for noon civil time at the birthplace (birth times are
unknown). This checks, against Horizons positions at the chart's own UTC
instant and at the start and end of its civil day (raw/people-*.txt):
  * each placement's sign and degree, and its direction over the civil day;
  * the "stable across the civil day" flags and the Moon's day-start and
    day-end signs, which the pages turn into "the sign never changes" or
    "crossed from X into Y during that day";
  * every degree the page text prints next to a body and a sign.

Usage: python3 scripts/accuracy-audit/audit_people.py PAGES.json
Writes docs/accuracy-audit-2026-11/results/people.json
"""
from __future__ import annotations

import collections
import glob
import json
import os
import re
import sys

import common as C

RAW = os.path.join(C.ROOT, 'docs', 'accuracy-audit-2026-11', 'raw')
BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
SIGN = r'(Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)'
BODY = r'(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)'


def load_points():
    pts = {b: {} for b in BODIES}
    for path in glob.glob(os.path.join(RAW, 'people-*.txt')):
        body = os.path.basename(path).split('-')[1].capitalize()
        text = open(path).read()
        rows = text[text.index('$$SOE') + 5:text.index('$$EOE')].strip().splitlines()
        for ln in rows:
            tok = ln.split()
            nums = [t for t in tok if re.fullmatch(r'-?\d+(?:\.\d+)?', t)]
            pts[body][round(float(tok[0]), 6)] = float(nums[-2])
    return pts


def wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def main():
    pages = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}
    pts = load_points()
    people = json.load(open(os.path.join(C.ROOT, 'src', 'data', 'people.json')))['people']
    claims = C.Claims()

    def at(body, iso):
        j = round(C.jd(iso), 6)
        if j not in pts[body]:
            # tolerate float formatting differences
            k = min(pts[body], key=lambda x: abs(x - j))
            if abs(k - j) > 2e-6:
                raise KeyError((body, iso))
            j = k
        return pts[body][j]

    for p in people:
        c = p['computation']
        src = '/people/%s/' % p['slug']
        t0, t1, tu = c['civilDayStartUtc'], c['civilDayEndUtc'], c['utcInstant']
        old = tu < '1800'
        for pl in p['placements']:
            b = pl['body']
            lon = at(b, tu)
            s0, s1 = C.sign_of(at(b, t0)), C.sign_of(at(b, t1))
            diff = wrap180(pl['longitude'] - lon)
            ok = C.sign_of(lon) == pl['sign'] and abs(diff) <= 0.006 + (0.01 if b == 'Moon' and old else 0)
            claims.add('natal-position', src, '%s %s %.2f° at %s (noon civil time)' % (b, pl['signName'], pl['degree'], tu),
                       '%.2f°' % pl['longitude'], '%.4f°' % lon, '%+.4f°' % diff, ok, 'birth before 1800: UT1 depends on the Delta T model' if old else '')
            stable = s0 == s1 == C.sign_of(lon)
            claims.add('natal-day-sign', src, '%s stays in %s all civil day: %s' % (b, pl['signName'], pl['stableAcrossDay']),
                       str(pl['stableAcrossDay']), '%s (%s at day start, %s at day end)' % (stable, s0, s1), '', stable == pl['stableAcrossDay'])
            if b not in ('Sun', 'Moon'):
                d = wrap180(at(b, t1) - at(b, t0))
                if abs(d) > 0.002:
                    retro = d < 0
                    claims.add('natal-direction', src, '%s %s' % (b, 'retrograde' if pl['retrograde'] else 'direct'),
                               'R' if pl['retrograde'] else 'D', 'R' if retro else 'D', '%+.4f° over the civil day' % d, retro == pl['retrograde'])
        mo = p['moon']
        ms0, ms1 = C.sign_of(at('Moon', t0)), C.sign_of(at('Moon', t1))
        claims.add('natal-day-sign', src, 'Moon day-start sign %s, day-end sign %s' % (mo['signAtCivilDayStart'], mo['signAtCivilDayEnd']),
                   '%s / %s' % (mo['signAtCivilDayStart'], mo['signAtCivilDayEnd']), '%s / %s' % (ms0, ms1), '',
                   (ms0, ms1) == (mo['signAtCivilDayStart'], mo['signAtCivilDayEnd']))

        # page text
        lines = pages.get(src)
        if not lines:
            continue
        text = ' ¶ '.join(lines)
        lon_of = {b: at(b, tu) for b in BODIES}
        seen = set()
        pats = [
            BODY + r'(?:\'s position resolves to| holds| stands at| was at| sits at| at| stood at)? (\d{1,2}\.\d{1,2})° ' + SIGN,
            BODY + r' in ' + SIGN + r' \((\d{1,2}\.\d{1,2})°\)',
            BODY + r' in ' + SIGN + r' at (\d{1,2}\.\d{1,2})°',
            r'the ' + BODY + r' sits (\d{1,2}\.\d{1,2})° into ' + SIGN,
        ]
        for k, pat in enumerate(pats):
            for m in re.finditer(pat, text):
                if k in (1, 2):
                    b, sg, dg = m.group(1), m.group(2), m.group(3)
                else:
                    b, dg, sg = m.group(1), m.group(2), m.group(3)
                key = (b, dg, sg)
                if key in seen:
                    continue
                seen.add(key)
                lon = lon_of[b]
                pub = float(dg)
                places = len(dg.split('.')[1])
                tol = 0.5 * 10 ** -places + 0.004 + (0.01 if b == 'Moon' and old else 0)
                ok = C.sign_of(lon) == sg.lower() and abs(pub - lon % 30) <= tol
                claims.add('natal-page-degree', src, '%s %s° %s' % (b, dg, sg), '%s %s°' % (sg, dg), '%s %.3f°' % (C.sign_of(lon).capitalize(), lon % 30),
                           '%+.3f°' % (pub - lon % 30) if C.sign_of(lon) == sg.lower() else 'sign differs', ok)
        for m in re.finditer(r'The ' + BODY + r' (?:stayed|remained) in ' + SIGN, text):
            b, sg = m.group(1), m.group(2)
            s0, s1 = C.sign_of(at(b, t0)), C.sign_of(at(b, t1))
            claims.add('natal-page-day', src, 'The %s stayed in %s all civil day' % (b, sg), sg, '%s at day start, %s at day end' % (s0, s1), '', s0 == s1 == sg.lower())
        for m in re.finditer(r'The ' + BODY + r' crossed from ' + SIGN + r' into ' + SIGN, text):
            b, a, z = m.group(1), m.group(2), m.group(3)
            s0, s1 = C.sign_of(at(b, t0)), C.sign_of(at(b, t1))
            claims.add('natal-page-day', src, 'The %s crossed from %s into %s that civil day' % (b, a, z), '%s to %s' % (a, z), '%s to %s' % (s0, s1), '', (s0, s1) == (a.lower(), z.lower()))
        for m in re.finditer(BODY + r' travelled (\d+\.\d)°', text):
            b = m.group(1)
            d = abs(wrap180(at(b, t1) - at(b, t0)))
            claims.add('natal-page-motion', src, '%s travelled %s° over the civil day' % (b, m.group(2)), m.group(2) + '°', '%.3f°' % d, '%+.3f°' % (float(m.group(2)) - d),
                       abs(float(m.group(2)) - d) <= 0.053)
    path = claims.save('people.json')
    tot = collections.Counter((r['category'], r['ok']) for r in claims.rows)
    for k in sorted(tot):
        print(k, tot[k])
    print(path)


if __name__ == '__main__':
    main()
