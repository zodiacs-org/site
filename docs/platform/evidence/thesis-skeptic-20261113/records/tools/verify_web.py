import json, re, sys, html, os
d = sys.argv[1]


def text(name):
    raw = open(os.path.join(d, name), encoding='utf8', errors='replace').read()
    raw = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', raw, flags=re.S)
    t = html.unescape(re.sub(r'<[^>]+>', ' ', raw))
    t = t.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace(' ', ' ')
    return re.sub(r'\s+', ' ', t)


def raw(name):
    return open(os.path.join(d, name), encoding='utf8', errors='replace').read()


def want(name, *needles, src=None):
    t = src if src is not None else text(name)
    for n in needles:
        ok = n in t
        print(('  OK   ' if ok else '  MISS ') + name + ' :: ' + n[:110])


def ctx(name, needle, w=220, src=None):
    t = src if src is not None else text(name)
    i = t.find(needle)
    print('  CTX  ' + name + ' :: ' + (t[max(0, i - 60):i + w] if i >= 0 else 'NOT FOUND: ' + needle))


print('YouGov')
want('yougov.html', 'One in four Americans say they believe in astrology', '(27%)', '90% of Americans select one of them', '3,472 U.S. adults', 'April 21 - 22, 2022')
ctx('yougov.html', 'offered the 12 signs', 300)
ctx('yougov.html', 'Methodology', 260)
t = text('yougov.html')
print('  mentions of crosstab between knowing and believing:', [m for m in re.findall(r'[^.]*know[^.]*believ[^.]*\.', t)][:3])
print('CoinGecko')
want('coingecko.html', 'The Average Lifespan of Pump.fun Memecoins Is Less Than a Day', '68.67%', '80.37%', '4.55%', '18.67', 'Updated June 23 2026', 'January 14, 2024 to June 18, 2026', 'bonding curve trades and not external DEX activity', '18,675,645', 'likely understated')
ctx('coingecko.html', '68.67%', 330)
ctx('coingecko.html', '80.37%', 120)
ctx('coingecko.html', 'likely understated', 330)
ctx('coingecko.html', 'Updated ', 40)
print('Smithsonian')
want('smithsonian.html', 'August 24, 1930', 'the first real newspaper horoscope column, was born', 'By 1937', 'widely credited', "wasn't the first of its kind", 'Following the interest the public showed')
print('Disclosure')
want('disclosure.html', 'Operator update (2026-08-23)', 'The operator attests (2026-08-02)', 'not enumerated', 'All twelve receipts are dated 5 July 2024', 'does not connect wallets, request signatures', 'astrofolio.xyz redirects to that page', 'does not establish who controls token deployment', 'Registry classification only', 'treasury', 'Wormhole', 'fees', 'confirmation', '10 Nov 2026', '2026-11-10')
ctx('disclosure.html', 'The operator attests', 420)
print('Home / apps / about / fomo / astrofolio')
want('home.html', 'Free birth charts, moon signs, compatibility, and horoscopes', 'Official Zodiac token collection')
print('  hreflang:', sorted(set(re.findall(r'hreflang="([^"]+)"', raw('home.html')))))
want('apps.html', 'Made for ChatGPT and Claude', 'Directory listings are currently in review', 'Directory listing in review')
ctx('apps.html', 'Made for ChatGPT', 200)
want('about.html', 'formed on August 11, 2026', 'Zodiacs LLC owns and operates this website', 'maintained by automated systems', 'without a traditional human editorial staff')
want('fomo.html', 'no referral deal with fomo and earns nothing when you trade there', 'Zodiacs.org adds nothing and receives nothing')
want('astrofolio.html', 'may fall to zero', 'Fomo')
print('  fomo buy links with ref-like params:', len(re.findall(r'fomo\.family/coin\?address=', raw('astrofolio.html'))), sorted(set(re.findall(r'fomo\.family/coin\?[^"&]*&amp;([a-zA-Z]+)=', raw('astrofolio.html')))))
print('Locale horoscopes')
for n in ('hor-fr.html', 'hor-it.html', 'hor-es.html', 'hor-pt.html', 'hor-en.html'):
    r = raw(n)
    print('  ', n, '| title:', (re.search(r'<title>(.*?)</title>', r, re.S) or [0, ''])[1][:90], '| robots:', re.findall(r'<meta name="robots" content="([^"]+)"', r), '| h1:', html.unescape(re.sub(r'<[^>]+>', '', (re.search(r'<h1[^>]*>(.*?)</h1>', r, re.S) or [0, ''])[1]))[:90])
print('Data files')
dist = json.loads(raw('distribution.json'))
print('  distribution generatedAt', dist.get('generatedAt'), 'capturedAt', dist.get('capturedAt'))
rows = dist.get('signs') or dist.get('assets') or dist.get('rows')
vals = []
if isinstance(rows, dict):
    rows = [dict(v, sign=k) for k, v in rows.items()]
for r in rows or []:
    vals.append((r.get('sign') or r.get('slug'), r.get('top10Pct'), r.get('status') or r.get('observedAt') or r.get('capturedAt')))
print('  ', vals)
nums = sorted(v[1] for v in vals if v[1] is not None)
if nums:
    print('   min', nums[0], 'max', nums[-1], 'median', (nums[5] + nums[6]) / 2)
print('   method note has token accounts sentence:', 'Token accounts are not verified people or unique wallet owners' in raw('distribution.json'))
pulse = json.loads(raw('pulse.json'))
print('  pulse capturedAt', pulse.get('capturedAt'), '| keys', list(pulse.keys()))
print('  pulse estimates', json.dumps(pulse.get('estimates'))[:500])
print('  pulse wikipedia', json.dumps(pulse.get('wikipedia') or pulse.get('pageviews'))[:300])
print('  pulse trends', json.dumps(pulse.get('trends'))[:400])
reg = json.loads(raw('registry.json'))
print('  registry', reg.get('name'), reg.get('version'), len(reg['assets']), 'assets;', 'leo', [a['native']['address'] for a in reg['assets'] if a['sign'] == 'leo'], 'libra', [a['native']['address'] for a in reg['assets'] if a['sign'] == 'libra'], 'base reps', sum(1 for a in reg['assets'] for x in a.get('representations', []) if x.get('chain') == 'base'))
feed = json.loads(raw('archive-feed.json'))
items = feed.get('items', feed)
print('  archive feed entries', len(items), [(i.get('date_published') or i.get('date') or '')[:10] for i in items])
print('Solflare title:', (re.search(r'<title>(.*?)</title>', raw('solflare-leo.html'), re.S) or [0, ''])[1][:100])
print('USNO', [(x['phenom'], x['month'], x['day'], x['time']) for x in json.loads(raw('usno-2026.json'))['data'] if x['phenom'] in ('Equinox', 'Solstice')])
print('Pew')
want('pew.html', 'at least once or twice a year (28%)', 'Oct. 21 to 27, 2024', 'Oct. 21-27, 2024')
ctx('pew.html', '(28%)', 200)
print('Unicode')
want('unicode-derivedage.txt', '261A..266F    ; 1.1', src=raw('unicode-derivedage.txt'))
ctx('unicode-pubdates.html', '1.1.0', 60)
print('Sensor Tower')
want('sensortower.html', 'nearly $40 million')
ctx('sensortower.html', 'nearly $40 million', 120)
print('Wikipedia Zodiac')
w = json.loads(raw('wikipedia-zodiac.json'))['query']['pages'][0]['revisions'][0]
wt = w['slots']['main']['content']
print('  revision', w['revid'], w['timestamp'])
for n in ('end of the fifth century BC', '409 and 398 BC', '401 BC', 'Dendera zodiac', 'c. 50 BC'):
    i = wt.find(n)
    print('  ', 'OK  ' if i >= 0 else 'MISS', n, '::', wt[max(0, i - 80):i + 120].replace('\n', ' ') if i >= 0 else '')
print('npm')
print('  ', raw('npm-window.json'), raw('npm-last-month.json'))
nr = json.loads(raw('npm-registry.json'))
print('  created', nr['time'].get('created'), 'versions', {k: v for k, v in nr['time'].items() if k not in ('created', 'modified')}, 'maintainers', nr.get('maintainers'))
print('Wayback')
cdx = json.loads(raw('wayback-cdx.json'))
print('  rows', len(cdx) - 1)
for r in cdx[1:]:
    print('   ', r)
print('  thesis first', json.loads(raw('wayback-thesis-cdx.json'))[1:3])
print('Posts')
for n in ('tweet-portnoy.json', 'tweet-portnoy3.json', 'tweet-wanton.json', 'tweet-friggin1.json', 'tweet-friggin2.json'):
    try:
        j = json.loads(raw(n))
        print('  ', n, j.get('created_at'), '@' + j.get('user', {}).get('screen_name', '?'), '::', j.get('text', '')[:330].replace('\n', ' '), '| quoted:', (j.get('quoted_tweet') or {}).get('text', '')[:160].replace('\n', ' '))
    except Exception as e:
        print('  ', n, 'ERR', e, raw(n)[:200])
try:
    fx = json.loads(raw('fx-portnoy.json'))['tweet']
    print('  fx views', fx.get('views'), 'created', fx.get('created_at'), 'likes', fx.get('likes'))
except Exception as e:
    print('  fx ERR', e, raw('fx-portnoy.json')[:200])
print('Wikimedia Virgo', [(i['timestamp'][:8], i['views']) for i in json.loads(raw('wm-20260323-virgo.json'))['items']])
