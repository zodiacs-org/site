#!/usr/bin/env python3
"""Check the hero's season line ("Scorpio season · day 21 of 30") on the thesis page.

Usage: season_clock_check.py <thesis index.html> <src/data/sun-ingresses.json> <out-dir> [--horizons]
1. Reads the script's own table of sign entries out of the page.
2. Compares it with the site's sun-ingresses.json.
3. Applies the script's two rules (day = floor(elapsed days) + 1; total = round(span in days))
   to every window and reports where "day" can exceed "of".
4. With --horizons, asks NASA JPL Horizons for the Sun's apparent geocentric ecliptic
   longitude, minute by minute, around four boundaries and saves the raw answers.
"""
import re, sys, json, datetime, urllib.request, urllib.parse, os, math
page, ingresses, out = sys.argv[1:4]
html = open(page, encoding='utf8').read()
block = html[html.index('data-season-clock]'):]
block = block[:block.index('})();')]
rows = re.findall(r"\['([a-z]+)', '([0-9T:\.\-Z]+)'\]", block)
end = re.search(r"END = Date.parse\('([^']+)'\)", block).group(1)
P = lambda s: datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
print(f"table rows in the page script: {len(rows)}; END {end}")
site = {(w['sign'], w['from'][:10]): w['from'] for w in json.load(open(ingresses))['windows']}
worst = 0
for sign, t in rows:
    s = site.get((sign, t[:10]))
    if s is None: print('no site row for', sign, t); continue
    diff = (P(s) - P(t)).total_seconds(); worst = max(worst, abs(diff))
print(f"largest difference between the page's table and src/data/sun-ingresses.json: {worst:.3f} s")
print("\nwindow            from (UTC)                span days  'of' printed  highest 'day' printed  day can exceed 'of'")
bad = 0
for i, (sign, t) in enumerate(rows):
    a = P(t); b = P(rows[i+1][1]) if i + 1 < len(rows) else P(end)
    span = (b - a).total_seconds() / 86400
    total = int(math.floor(span + 0.5)); maxday = int(math.floor(span - 1e-12)) + 1
    over = maxday > total
    if over:
        bad += 1
        start_over = a + datetime.timedelta(days=total)
        note = f"yes: 'day {maxday} of {total}' from {start_over:%Y-%m-%d %H:%M} to {b:%Y-%m-%d %H:%M} UTC ({(b-start_over).total_seconds()/3600:.1f} h)"
    else: note = 'no'
    print(f"{sign:12s} {a:%Y-%m-%d %H:%M:%S}  {span:8.3f}  {total:4d}  {maxday:4d}  {note}")
print(f"\nwindows where the script can print a day number above the total: {bad} of {len(rows)}")
for label, now in (('breaker render', '2026-11-13T09:26:07Z'), ('this run', datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))):
    n = P(now)
    for i, (sign, t) in enumerate(rows):
        a = P(t); b = P(rows[i+1][1]) if i + 1 < len(rows) else P(end)
        if a <= n < b:
            print(f"{label} {now}: {sign.capitalize()} season · day {int((n-a).total_seconds()//86400)+1} of {int(math.floor((b-a).total_seconds()/86400+0.5))}")

if '--horizons' in sys.argv:
    def horizons(start, stop):
        q = {'format': 'text', 'COMMAND': "'10'", 'OBJ_DATA': 'NO', 'MAKE_EPHEM': 'YES', 'EPHEM_TYPE': 'OBSERVER',
             'CENTER': "'500@399'", 'START_TIME': f"'{start}'", 'STOP_TIME': f"'{stop}'", 'STEP_SIZE': "'1 m'",
             'QUANTITIES': "'31'", 'ANG_FORMAT': 'DEG', 'TIME_DIGITS': 'SECONDS'}
        url = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(q)
        req = urllib.request.Request(url, headers={'User-Agent': 'thesis-evidence-check/1.0'})
        return url, urllib.request.urlopen(req, timeout=60).read().decode()
    print("\nNASA JPL Horizons, Sun, geocentric, apparent ecliptic longitude of date (quantity 31), 1-minute steps")
    for name, target, t in (('scorpio-2026', 210, '2026-10-23T09:38:21.771Z'), ('sagittarius-2026', 240, '2026-11-22T07:23:27.992Z'),
                            ('gemini-2026', 60, '2026-05-21T00:37:22.918Z'), ('cancer-2026', 90, '2026-06-21T08:25:08.400Z')):
        c = P(t); a = c - datetime.timedelta(minutes=3); b = c + datetime.timedelta(minutes=3)
        saved = os.path.join(out, f'horizons-sun-{name}.txt')
        if os.path.exists(saved):   # a saved answer is read again, not fetched again
            text = open(saved).read()
        else:
            url, text = horizons(a.strftime('%Y-%m-%d %H:%M'), b.strftime('%Y-%m-%d %H:%M'))
            open(saved, 'w').write(f"# {url}\n# fetched {datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\n" + text)
        body = text[text.index('$$SOE') + 5:text.index('$$EOE')].strip().splitlines()
        pts = []
        for line in body:
            parts = line.split()
            if len(parts) >= 4:
                fmt = '%Y-%b-%d %H:%M:%S' if parts[1].count(':') == 2 else '%Y-%b-%d %H:%M'
                ts = datetime.datetime.strptime(parts[0] + ' ' + parts[1], fmt).replace(tzinfo=datetime.timezone.utc)
                pts.append((ts, float(parts[-2])))
        cross = None
        for (t0, l0), (t1, l1) in zip(pts, pts[1:]):
            if l0 < target <= l1:
                cross = t0 + (t1 - t0) * ((target - l0) / (l1 - l0))
        print(f"{name}: page table {t}; Horizons crossing of {target} deg {cross.strftime('%Y-%m-%dT%H:%M:%S') if cross else 'not in range'}Z; difference {(cross - c).total_seconds():+.0f} s" if cross else f"{name}: no crossing found ({len(pts)} points)")
