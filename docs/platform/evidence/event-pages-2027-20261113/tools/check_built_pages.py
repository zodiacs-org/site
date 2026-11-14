"""Check the built HTML of the 22 pages against the instants solved on Horizons.

Reads dist/ after `npm run build`. For each page in referenced-events.json:

- every <time datetime> in the article is the page's Updated day or an
  instant within two seconds of one solved on Horizons in this job
  (the planets' table is rounded to the second);
- every cell of the five-clock table is recomputed here from its datetime with
  Python's zoneinfo (the IANA database, independent of the build's Intl): the
  local day, the time cut to the minute, and the UTC offset;
- every "HH:MM UTC" the article prints is the minute of a solved instant;
- the page prints an Updated day equal to its Article dateModified and its
  sitemap lastmod, and its FAQPage questions equal the visible ones.

Writes ../built-pages.json. Exits 1 on any failure.

Usage: python3 docs/platform/evidence/event-pages-2027-20261113/tools/check_built_pages.py [dist]
"""
import datetime
import html
import json
import os
import re
import sys
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
EVIDENCE = os.path.normpath(os.path.join(HERE, os.pardir))
ROOT = os.path.normpath(os.path.join(EVIDENCE, os.pardir, os.pardir, os.pardir, os.pardir))
DIST = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist')
ZONES = [('UTC', 'UTC'), ('New York', 'America/New_York'), ('London', 'Europe/London'),
         ('Kolkata', 'Asia/Kolkata'), ('Sydney', 'Australia/Sydney')]


def load(name):
    with open(os.path.join(EVIDENCE, name)) as f:
        return json.load(f)


def parse(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))


referenced = load('referenced-events.json')
solved = [parse(e['horizons']) for e in load('horizons-event-times.json')['events'].values()]
sitemap = open(os.path.join(DIST, 'sitemap.xml')).read()


def near_solved(at):
    return min(abs((at - s).total_seconds()) for s in solved)


def text_of(fragment):
    fragment = re.sub(r'<(script|style)\b.*?</\1>', ' ', fragment, flags=re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', fragment))).strip()


def offset_label(dt):
    minutes = int(dt.utcoffset().total_seconds() // 60)
    sign = '+' if minutes >= 0 else '-'
    hours, rest = divmod(abs(minutes), 60)
    return 'UTC%s%d%s' % (sign, hours, '' if rest == 0 else ':%02d' % rest)


failures, report = [], []
for page in referenced['pages']:
    path = os.path.join(DIST, page['path'].strip('/'), 'index.html')
    source = open(path).read()
    article = re.search(r'<article\b.*?</article>', source, re.S).group(0)
    fail = lambda message: failures.append('%s: %s' % (page['path'], message))

    updated = re.search(r'<p\b[^>]*data-event-updated[^>]*>.*?<time\b[^>]*datetime="([^"]+)"', article, re.S)
    if not updated:
        fail('no Updated line')
        continue
    updated_day = updated.group(1)

    instants = set()
    for value in re.findall(r'<time\b[^>]*datetime="([^"]+)"', article):
        if value == updated_day:
            continue
        at = parse(value)
        instants.add(value)
        if near_solved(at) > 2.0:
            fail('datetime %s is not an instant solved on Horizons' % value)

    cells = 0
    table = re.search(r'<table\b[^>]*wt-table.*?</table>', article, re.S)
    if not table:
        fail('no five-clock table')
    else:
        heads = [text_of(h) for h in re.findall(r'<th scope="col"[^>]*>(.*?)</th>', table.group(0), re.S)]
        if heads[1:] != [city for city, _ in ZONES]:
            fail('table columns are %r' % heads)
        for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>', table.group(0), re.S)[1:]:
            tds = re.findall(r'<td\b[^>]*data-label="([^"]+)"[^>]*>\s*<time\b[^>]*datetime="([^"]+)"[^>]*>(.*?)</time>', row, re.S)
            if len(tds) != 5:
                fail('a table row has %d cells' % len(tds))
            for (city, zone), (label, value, inner) in zip(ZONES, tds):
                cells += 1
                local = parse(value).astimezone(ZoneInfo(zone))
                want_day = '%s %s %d' % (local.strftime('%a'), local.strftime('%b'), local.day)
                want_time = local.strftime('%H:%M')
                spans = [text_of(s) for s in re.findall(r'<span\b[^>]*>(.*?)</span>', inner, re.S)]
                want = [want_day, want_time] + ([] if zone == 'UTC' else [offset_label(local)])
                if label != city or spans != want:
                    fail('%s cell for %s prints %r, zoneinfo gives %r' % (city, value, spans, want))

    plain = text_of(article)
    minutes = {(s.strftime('%H:%M'), '%s %d' % (s.strftime('%B'), s.day)) for s in solved}
    clocks = re.findall(r'(\d{2}:\d{2}) UTC on ([A-Z][a-z]+ \d{1,2})', plain)
    for clock in clocks:
        if clock not in minutes:
            fail('prints %s UTC on %s, which is no solved instant' % clock)
    solved_clock_only = {s.strftime('%H:%M') for s in solved}
    # "07:17 UTC-5" in a table cell is a local time beside its offset, not a UTC time.
    for clock in re.findall(r'(\d{2}:\d{2}) UTC(?![+\-\d])', plain):
        if clock not in solved_clock_only:
            fail('prints %s UTC, which is no solved instant' % clock)

    documents = [json.loads(html.unescape(d)) for d in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', source, re.S)]
    nodes = [n for d in documents for n in d.get('@graph', [d])]
    articles = [n for n in nodes if n.get('@type') == 'Article']
    faqs = [n for n in nodes if n.get('@type') == 'FAQPage']
    modified = articles[0].get('dateModified') if len(articles) == 1 else None
    if modified != updated_day + 'T00:00:00.000Z':
        fail('dateModified %r is not the Updated day %s' % (modified, updated_day))
    lastmod = re.search(r'<loc>https://zodiacs\.org%s</loc>\s*<lastmod>([^<]+)</lastmod>' % re.escape(page['path']), sitemap)
    if not lastmod or lastmod.group(1) != updated_day:
        fail('sitemap lastmod %r is not the Updated day %s' % (lastmod and lastmod.group(1), updated_day))
    visible = [(text_of(q), text_of(a)) for q, a in re.findall(r'<details\b[^>]*faq-item[^>]*>\s*<summary[^>]*>(.*?)</summary>\s*<p[^>]*>(.*?)</p>', article, re.S)]
    marked = [(q['name'], q['acceptedAnswer']['text']) for q in faqs[0]['mainEntity']] if len(faqs) == 1 else []
    if not visible or visible != marked:
        fail('the FAQPage data does not mirror the %d visible questions' % len(visible))
    order = [article.find(marker) for marker in ('data-event-lead', 'data-event-updated', 'data-reading-why', 'data-reading-try', 'data-reading-next', 'data-event-facts', 'data-event-clocks', 'data-event-questions')]
    if -1 in order or order != sorted(order):
        fail('the sections are out of order: %r' % order)
    if re.search(r'[–—]', text_of(re.search(r'<section\b[^>]*data-event-style-guide.*?</section>', article, re.S).group(0))):
        fail('a dash in the reading')
    report.append({
        'path': page['path'], 'updated': updated_day, 'instants': sorted(instants),
        'clockCells': cells, 'utcClockTimes': len(clocks), 'questions': len(visible),
    })

out = {
    'what': 'The built HTML of the 22 pages, checked against the instants solved on Horizons and against zoneinfo',
    'tzdata': os.environ.get('TZDATA_NOTE', 'the IANA database Python zoneinfo reads on the build machine'),
    'pages': len(report), 'failures': failures, 'report': report,
}
with open(os.path.join(EVIDENCE, 'built-pages.json'), 'w') as f:
    f.write(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
print('%d pages, %d five-clock cells, %d failures' % (len(report), sum(r['clockCells'] for r in report), len(failures)))
for failure in failures:
    print('FAIL', failure)
sys.exit(1 if failures else 0)
