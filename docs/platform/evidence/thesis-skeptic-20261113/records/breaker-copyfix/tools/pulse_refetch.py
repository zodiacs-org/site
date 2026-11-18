#!/usr/bin/env python3
"""Breaker refetch for ZOD-219: Wikimedia pageviews, user traffic, en.wikipedia.
Usage: pulse_refetch.py <outdir>. Standard library only."""
import json, sys, time, urllib.request, urllib.parse, datetime, statistics, os
out = sys.argv[1]
SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
TOKENS = ['Dogecoin','Ethereum','Solana_(blockchain_platform)','Shiba_Inu_(cryptocurrency)','Bitcoin']
UA = 'evidence-check/1.0 (pageview audit; standard library)'
def get(title, a, b, tag):
    url = ('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/'
           + urllib.parse.quote(title, safe='') + '/daily/' + a + '/' + b)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    raw = urllib.request.urlopen(req, timeout=30).read()
    open(os.path.join(out, tag + '-' + title.replace('(', '').replace(')', '') + '.json'), 'wb').write(raw)
    time.sleep(0.15)
    items = json.loads(raw)['items']
    return [i['views'] for i in items], items[0]['timestamp'][:8], items[-1]['timestamp'][:8]
def window(a, b, tag):
    print('== window', a, 'to', b, '(' + tag + ')')
    per = {}; byday = None
    for s in SIGNS:
        v, f, l = get(s + '_(astrology)', a, b, tag)
        per[s] = v
        byday = v[:] if byday is None else [x + y for x, y in zip(byday, v)]
        print(f'{s:12s} days {len(v)} {f}..{l} total {sum(v):7d} avg/day {sum(v)/len(v):8.1f} rounded {round(sum(v)/len(v))}')
    tot = sum(sum(v) for v in per.values()); n = len(byday)
    print(f'twelve total {tot} over {n} days: {tot/n:.1f} a day (rounded {round(tot/n)})')
    avgs = sorted(round(sum(v)/len(v)) for v in per.values())
    med = statistics.median(avgs)
    print('sorted rounded sign averages', avgs, 'median', med, 'seventh value', avgs[6], 'max', avgs[-1], 'min', avgs[0])
    tk = {}
    for t in TOKENS:
        v, f, l = get(t, a, b, tag)
        tk[t] = round(sum(v)/len(v))
        print(f'{t:30s} days {len(v)} total {sum(v):7d} avg/day {sum(v)/len(v):8.1f} twelve/this {round(tot/n)/tk[t]:.2f} median/this {med/tk[t]:.3f} seventh/this {avgs[6]/tk[t]:.3f}')
    days_bitcoin_below_top_sign = None
    return per, tk
print('fetched', datetime.datetime.utcnow().isoformat() + 'Z')
window('20261010', '20261108', 'snapshot')
end = datetime.datetime.utcnow() - datetime.timedelta(days=1)
start = end - datetime.timedelta(days=29)
window(start.strftime('%Y%m%d'), end.strftime('%Y%m%d'), 'live')
