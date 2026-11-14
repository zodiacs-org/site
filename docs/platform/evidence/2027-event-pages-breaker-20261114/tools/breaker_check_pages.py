#!/usr/bin/env python3
"""Breaker's check of the built HTML of the 22 pages against the breaker's own Horizons solve.

Reads dist/ (npm run build) and breaker-event-times.json. Uses nothing of the builder's evidence.
"""
import html, json, os, re, sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(OUT, '../../../..')); DIST = os.path.join(ROOT, 'dist')
PAGES = ['full-moon/2027-%s' % d for d in ['01-22','02-20','03-22','04-20','05-20','06-19','07-18','08-17','09-15','10-15','11-14','12-13']] + \
        ['eclipses/2027-%s' % d for d in ['02-06','02-20','07-18','08-02','08-17']] + \
        ['mars-retrograde/2027-01-10','mercury-retrograde/2027-02-09','mercury-retrograde/2027-06-10','mercury-retrograde/2027-10-07','events/jupiter-enters-virgo-2027-07-26']
ZONES = {'UTC': 'UTC', 'New York': 'America/New_York', 'London': 'Europe/London', 'Kolkata': 'Asia/Kolkata', 'Sydney': 'Australia/Sydney'}
MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

def pdt(s): return datetime.strptime(s.replace('Z', '+0000'), '%Y-%m-%dT%H:%M:%S.%f%z')
solved = [(e['id'], pdt(e['solved']['instant']), e.get('slow') or e['kind'] == 'aspect') for e in json.load(open(os.path.join(OUT, 'breaker-event-times.json')))['events']]

def nearest(t):
    return min(solved, key=lambda s: abs((s[1] - t).total_seconds()))

def offs(dt):
    o = dt.utcoffset().total_seconds() / 3600
    h = int(abs(o)); m = int(round((abs(o) - h) * 60))
    return 'UTC%s%d%s' % ('+' if o >= 0 else '-', h, (':%02d' % m) if m else '')

def day(dt): return '%s %s %d' % (dt.strftime('%a'), dt.strftime('%b'), dt.day)
def longday(dt): return '%s %d' % (MONTHS[dt.month - 1], dt.day)

report = {'pages': [], 'failures': [], 'counts': {'timeElements': 0, 'zoneCells': 0, 'utcStrings': 0, 'proseClockSets': 0, 'datesNamed': 0}}
def fail(page, what): report['failures'].append({'page': page, 'what': what})

for page in PAGES:
    raw = open(os.path.join(DIST, page, 'index.html')).read()
    main = re.search(r'<main.*?</main>', raw, re.S).group(0)
    P = {'page': '/' + page + '/', 'instants': [], 'cells': 0}
    used = {}
    # 1. every machine-readable instant
    for dt_s in sorted(set(re.findall(r'<time[^>]*datetime="([^"]+T[^"]+)"', raw))):
        t = pdt(dt_s if '.' in dt_s else dt_s.replace('Z', '.000Z'))
        sid, st, dateonly = nearest(t)
        d = (t - st).total_seconds()
        same_min = t.replace(second=0, microsecond=0) == st.replace(second=0, microsecond=0)
        ok = (abs(d) < 90 and t.date() == st.date()) if dateonly else (same_min and abs(d) <= 5)
        P['instants'].append({'datetime': dt_s, 'breakerEvent': sid, 'breakerInstant': st.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z', 'pageMinusBreakerS': round(d, 3), 'sameMinute': same_min, 'heldTo': 'date' if dateonly else 'minute', 'ok': ok})
        used[dt_s] = st
        if not ok: fail(page, 'instant %s vs breaker %s (%s), %+.1f s' % (dt_s, st.isoformat(), sid, d))
        report['counts']['timeElements'] += 1
    # 2. the five-clock cells, recomputed from the breaker's instant
    for cell in re.finditer(r'<td class="wt-cell" data-label="([^"]+)"[^>]*><time datetime="([^"]+)"[^>]*>(.*?)</time></td>', main, re.S):
        zone, dt_s, inner = cell.groups()
        st = used[dt_s].astimezone(ZoneInfo(ZONES[zone]))
        got_day = re.search(r'wt-cell__day[^>]*>([^<]+)<', inner).group(1)
        got_time = re.search(r'wt-cell__time[^>]*>([^<]+)<', inner).group(1)
        got_off = re.search(r'wt-cell__off[^>]*>([^<]+)<', inner)
        want = (day(st), st.strftime('%H:%M'), None if zone == 'UTC' else offs(st))
        got = (got_day, got_time, got_off.group(1) if got_off else None)
        P['cells'] += 1; report['counts']['zoneCells'] += 1
        if got != want: fail(page, 'cell %s %s: page %s, breaker %s' % (zone, dt_s, got, want))
    text = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', re.sub(r'<(script|style|svg).*?</\1>', '', main, flags=re.S))))
    minutes = {st.strftime('%H:%M') for st in used.values()} | {s[1].strftime('%H:%M') for s in solved}
    page_minutes = {st.strftime('%Y-%m-%d %H:%M') for st in used.values()}
    # 3. every "HH:MM UTC" and "YYYY-MM-DD HH:MM UTC"
    for m in re.finditer(r'(\d{4}-\d\d-\d\d )?(\d\d:\d\d) UTC(?![+\-\d])', text):
        report['counts']['utcStrings'] += 1
        if m.group(1):
            if (m.group(1) + m.group(2)) not in {s[1].strftime('%Y-%m-%d %H:%M') for s in solved}: fail(page, 'UTC string not a breaker minute: ' + m.group(0))
        elif m.group(2) not in minutes: fail(page, 'UTC string not a breaker minute: ' + m.group(0))
    # 4. prose clock sets: "HH:MM UTC on Month D, which is A in New York, B in London, C in Kolkata and D in Sydney"
    pat = re.compile(r'(\d\d:\d\d) UTC on (\w+ \d+), which is (\d\d:\d\d)( on \w+ \d+)? in New York, (\d\d:\d\d)( on \w+ \d+)? in London, (\d\d:\d\d)( on \w+ \d+)? in Kolkata and (\d\d:\d\d)( on \w+ \d+)? in Sydney')
    for m in pat.finditer(text):
        report['counts']['proseClockSets'] += 1
        g = m.groups()
        cands = [s for s in solved if s[1].strftime('%H:%M') == g[0] and longday(s[1]) == g[1]]
        if len(cands) != 1: fail(page, 'prose clock set matches %d breaker events: %s' % (len(cands), m.group(0))); continue
        st = cands[0][1]
        for i, z in enumerate(['New York', 'London', 'Kolkata', 'Sydney']):
            loc = st.astimezone(ZoneInfo(ZONES[z])); t_txt, d_txt = g[2 + 2 * i], g[3 + 2 * i]
            want_d = None if loc.date() == st.date() else ' on ' + longday(loc)
            if t_txt != loc.strftime('%H:%M') or d_txt != want_d: fail(page, 'prose %s: page %s%s, breaker %s%s' % (z, t_txt, d_txt or '', loc.strftime('%H:%M'), want_d or ''))
    # any clock time in prose not caught by the pattern
    leftover = pat.sub('', text)
    for m in re.finditer(r'\d\d:\d\d(?! UTC)(?=\D)', re.sub(r'<table.*?</table>', '', leftover)):
        pass
    # 5. every calendar date named in words must be the UTC date of a breaker event (or the Updated day)
    # the UTC date of a breaker event, or its date on one of the five clocks
    known = set(); kn_md = set()
    for s_ in solved:
        for z in ZONES.values():
            l = s_[1].astimezone(ZoneInfo(z)); known.add((l.year, l.month, l.day)); kn_md.add((l.month, l.day))
    for m in re.finditer(r'\b(%s|%s) (\d{1,2})(?!\d)(?:, (\d{4}))?' % ('|'.join(MONTHS), '|'.join(x[:3] for x in MONTHS)), text):
        mo = [x[:3] for x in MONTHS].index(m.group(1)[:3]) + 1; d = int(m.group(2)); y = m.group(3)
        report['counts']['datesNamed'] += 1
        if (mo, d, y) == (11, 14, '2026'): continue
        okd = ((int(y), mo, d) in known) if y else ((mo, d) in kn_md)
        if not okd:
            ctx = text[max(0, m.start() - 70):m.end() + 40]
            P.setdefault('datesNotABreakerEventUtcDate', []).append(ctx)
    # 6. Updated day, dateModified, FAQ mirror
    upd = re.search(r'Updated\s*<time datetime="([^"]+)"', main)
    ld = [json.loads(x) for x in re.findall(r'<script type="application/ld\+json">(.*?)</script>', raw, re.S)]
    nodes = [n for g in ld for n in (g.get('@graph') or [g])]
    art = [n for n in nodes if 'dateModified' in n]; faq = [n for n in nodes if n.get('@type') == 'FAQPage']
    P['updated'] = upd.group(1) if upd else None; P['dateModified'] = art[0]['dateModified'] if art else None
    if not upd or not art or not art[0]['dateModified'].startswith(upd.group(1)): fail(page, 'Updated/dateModified disagree or missing')
    if not faq: fail(page, 'no FAQPage')
    else:
        P['questions'] = len(faq[0]['mainEntity'])
        for q in faq[0]['mainEntity']:
            a = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', q['acceptedAnswer']['text']))).strip()
            if q['name'] not in text: fail(page, 'FAQ question not visible: ' + q['name'])
            if re.sub(r'\s+', '', a) not in re.sub(r'\s+', '', text): fail(page, 'FAQ answer not visible: ' + a[:80])
    if re.search(r'[\u2013\u2014]', text): P['dashes'] = re.findall(r'.{30}[\u2013\u2014].{30}', text)[:5]
    report['pages'].append(P)

json.dump(report, open(os.path.join(OUT, 'breaker-built-pages.json'), 'w'), indent=1, ensure_ascii=False)
print(json.dumps(report['counts'])); print(len(report['failures']), 'failures')
for f in report['failures']: print(' FAIL', f)
for p in report['pages']:
    for c in p.get('datesNotABreakerEventUtcDate', []): print(' DATE?', p['page'], '|', c)
    if p.get('dashes'): print(' DASH', p['page'], p['dashes'])
    print(p['page'], len(p['instants']), 'instants', p['cells'], 'cells', p.get('questions'), 'questions', 'max|d|', max(abs(i['pageMinusBreakerS']) for i in p['instants']))
