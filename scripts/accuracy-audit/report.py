"""Summarise the audit results into the committed report tables.

Reads results/full/{data,pages,people}.json (written by the audit scripts),
classifies the likely cause of every mismatch, and writes:
  results/summary.json          counts per layer and category, and by cause
  results/mismatches.json       every mismatch with its cause
  results/mismatches-pages.csv  every page-level mismatch (identical statements grouped)
  results/mismatches-data.csv   every data-file and people-data mismatch
and, when a REPORT.md with generated markers exists beside the results,
fills the count and mismatch tables between them.
"""
from __future__ import annotations

import collections
import json
import os
import re

import common as C

OUT = C.OUT_DIR
FULL = os.path.join(OUT, 'results', 'full')
SLOW = ('Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto')

LAYERS = {
    'data.json': 'Published data files (src/data)',
    'pages.json': 'Built pages (what the site says)',
    'people.json': 'People charts (src/data/people.json and /people/ pages)',
}

CAUSES = {
    'tie': 'Minute-boundary tie: NASA\'s value lies within 10″ of a minute line and the engine (a few arcseconds off) lands on the other side',
    'engine-slow': 'Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly',
    'engine-old': 'Engine outer-planet series drift for births before 1900 (Neptune and Pluto 0.006° to 0.018°)',
    'store-2dp': 'birthdays.json stores longitudes to 0.01° (36″), then the page prints arcminutes',
    'double-round': 'Double rounding: stored to 0.01°, then printed to 0.1°',
    'rounded': 'Whole degree rounded instead of truncated (fixed in this branch)',
    'eclipse-lon': 'Eclipse peak instant differs from NASA\'s greatest eclipse by tens of seconds, enough to move the Moon one arcminute',
    'shadow-model': 'Different umbral shadow enlargement from NASA\'s canon (Chauvenet 1/50)',
    'margin': '"At least" margin rounded up and measured at noon UTC only',
    'convention': 'Conventional sign date range; real ingress drifts across two days',
    'other': 'See note',
}


def cause_of(r):
    cat, note, st, src = r['category'], r.get('note') or '', r['statement'], r['source']
    if 'minute-boundary tie' in note:
        return 'tie'
    if cat == 'position' and src.startswith('/birthday/'):
        past = re.search(r'NASA value (-?[\d.]+) arcsec past', note)
        if past and min(float(past.group(1)), 60 - float(past.group(1))) <= 10:
            return 'tie'
        return 'store-2dp'
    if cat == 'natal-page-degree':
        return 'double-round'
    if cat == 'natal-position':
        return 'engine-old' if re.search(r'at 1[5-8]\d\d-', st) and st.split()[0] in ('Neptune', 'Pluto', 'Uranus', 'Saturn', 'Jupiter') else ('tie' if abs(float(r['diff'].rstrip('°'))) < 0.0005 else 'engine-old')
    if cat in ('degree-display',) and 'rounded' in note:
        return 'rounded'
    if cat == 'degree-display' and 'truncated minute differs' in note:
        return 'tie'
    if cat == 'degree-display' and 'stored 0.1°' in note:
        return 'rounded'
    if cat == 'eclipse-duration':
        return 'shadow-model'
    if cat == 'margin':
        return 'margin'
    if cat == 'sign-range':
        return 'convention'
    if cat == 'position' and src.startswith('/eclipses/'):
        return 'eclipse-lon'
    if cat == 'lunation' and 'arcsec' in r['diff']:
        return 'tie'
    if cat in ('ingress', 'aspect', 'window-date', 'prose-ingress', 'completeness', 'station', 'shadow'):
        return 'engine-slow'
    return 'other'


def load(name):
    path = os.path.join(FULL, name)
    if not os.path.exists(path):
        return []
    return json.load(open(path))


def md_escape(s):
    return str(s).replace('|', '/').replace('\n', ' ')


def main():
    summary = {}
    mismatches = []
    for name, title in LAYERS.items():
        rows = load(name)
        per = collections.OrderedDict()
        for r in rows:
            c = per.setdefault(r['category'], {'checked': 0, 'match': 0, 'mismatch': 0})
            c['checked'] += 1
            c['match' if r['ok'] else 'mismatch'] += 1
            if not r['ok']:
                mismatches.append(dict(r, layer=name, cause=cause_of(r)))
        summary[name] = {'title': title, 'categories': dict(sorted(per.items())),
                         'checked': sum(c['checked'] for c in per.values()),
                         'match': sum(c['match'] for c in per.values()),
                         'mismatch': sum(c['mismatch'] for c in per.values())}
    by_cause = collections.Counter((m['layer'], m['cause']) for m in mismatches)
    summary['byCause'] = {'%s/%s' % k: v for k, v in sorted(by_cause.items())}
    os.makedirs(os.path.join(OUT, 'results'), exist_ok=True)
    with open(os.path.join(OUT, 'results', 'summary.json'), 'w') as f:
        json.dump(summary, f, indent=1, ensure_ascii=False)
        f.write('\n')
    with open(os.path.join(OUT, 'results', 'mismatches.json'), 'w') as f:
        json.dump(mismatches, f, indent=1, ensure_ascii=False)
        f.write('\n')

    # every mismatch as CSV: pages (identical statements grouped) and data
    import csv
    groups = collections.OrderedDict()
    for m in mismatches:
        if m['layer'] != 'pages.json':
            continue
        key = (re.sub(r'\s+', ' ', m['statement']), m['ours'], m['nasa'], m['diff'], m['cause'])
        groups.setdefault(key, []).append(m['source'])
    order = ['rounded', 'engine-slow', 'eclipse-lon', 'tie', 'store-2dp', 'margin', 'convention', 'other']
    with open(os.path.join(OUT, 'results', 'mismatches-pages.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['pages', 'statement', 'our_value', 'nasa_value', 'difference', 'cause', 'cause_text'])
        for key, urls in sorted(groups.items(), key=lambda kv: (order.index(kv[0][4]) if kv[0][4] in order else 99, kv[1][0])):
            st, ours, nasa, diff, cause = key
            w.writerow([' '.join(urls), st, ours, nasa, diff, cause, CAUSES[cause]])
    with open(os.path.join(OUT, 'results', 'mismatches-data.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['source', 'category', 'statement', 'our_value', 'nasa_value', 'difference', 'cause', 'note'])
        for m in mismatches:
            if m['layer'] != 'pages.json':
                w.writerow([m['source'], m['category'], m['statement'], m['ours'], m['nasa'], m['diff'], m['cause'], m.get('note', '')])

    # count tables into REPORT.md
    t = []
    for name, s in summary.items():
        if name == 'byCause':
            continue
        t += ['', '**%s**: %d claims checked, %d match, %d mismatch.' % (s['title'], s['checked'], s['match'], s['mismatch']), '',
              '| Category | Checked | Match | Mismatch |', '| --- | ---: | ---: | ---: |']
        for cat, c in s['categories'].items():
            t.append('| %s | %d | %d | %d |' % (cat, c['checked'], c['match'], c['mismatch']))
    t += ['', '**Mismatches by likely cause**', '', '| Layer | Cause | Count |', '| --- | --- | ---: |']
    for k, v in sorted(by_cause.items(), key=lambda kv: (kv[0][0], -kv[1])):
        t.append('| %s | %s | %d |' % (LAYERS[k[0]].split(' (')[0], CAUSES[k[1]], v))
    page_rows = ['| Page | Statement as published | Our value | NASA value | Difference | Likely cause |',
                 '| --- | --- | --- | --- | --- | --- |']
    for key, urls in sorted(groups.items(), key=lambda kv: (order.index(kv[0][4]) if kv[0][4] in order else 99, kv[1][0])):
        st, ours, nasa, diff, cause = key
        where = urls[0] if len(urls) == 1 else '%s (+%d more)' % (urls[0], len(urls) - 1)
        page_rows.append('| %s | %s | %s | %s | %s | `%s` |' % tuple(md_escape(x) for x in (where, st, ours, nasa, diff, cause)))
    dgroups = collections.OrderedDict()
    for m in mismatches:
        if m['layer'] == 'pages.json':
            continue
        src = m['source'] if not m['source'].startswith('/people/') else 'src/data/people.json'
        src = re.sub(r'transits-\d{4}-\d{2}', 'transits-YYYY-MM', src)
        k = (src, m['category'], m['cause'])
        dgroups.setdefault(k, []).append(m)
    data_rows = ['| Source | Category | Count | Likely cause | Example: statement, our value, NASA value, difference |',
                 '| --- | --- | ---: | --- | --- |']
    for (src, cat, cause), ms in sorted(dgroups.items(), key=lambda kv: -len(kv[1])):
        ex = ms[0]
        data_rows.append('| %s | %s | %s | `%s` | %s; %s; %s; %s |' % tuple(md_escape(x) for x in (src, cat, len(ms), cause, ex['statement'], ex['ours'], ex['nasa'], ex['diff'])))
    report = os.path.join(OUT, 'REPORT.md')
    if os.path.exists(report):
        body = open(report).read()
        for name, rows in (('counts', t), ('pages', page_rows), ('data', data_rows)):
            a, b = '<!-- generated:%s:start -->' % name, '<!-- generated:%s:end -->' % name
            if a in body and b in body:
                body = body[:body.index(a) + len(a)] + '\n' + '\n'.join(rows) + '\n' + body[body.index(b):]
        with open(report, 'w') as f:
            f.write(body)
    print(json.dumps({k: (v['checked'], v['match'], v['mismatch']) for k, v in summary.items() if k != 'byCause'}))
    print(json.dumps(summary['byCause'], indent=0))


if __name__ == '__main__':
    main()
