#!/usr/bin/env python3
"""Fetch the Wikimedia daily pageviews behind the thesis page's Pulse block.

Usage: pulse_fetch.py <out-dir>
Writes one raw response per article and window into <out-dir>/wikimedia/ and
prints a summary table. Windows:
  snapshot  20261010 to 20261108  (the window in public/assets/pulse.json, captured 2026-11-09)
  live      20261014 to 20261112  (what the page's script requests on 13 Nov 2026 UTC:
                                   yesterday minus 29 days, to yesterday)
Same endpoint and access/agent path as the page and scripts/build-pulse.mjs
(en.wikipedia, all-access, user).
"""
import json, sys, time, urllib.parse, urllib.request, hashlib, os, datetime

OUT = sys.argv[1]
SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces']
PAGE_SET = ['Dogecoin','Ethereum','Solana_(blockchain_platform)','Shiba_Inu_(cryptocurrency)']
OTHERS = ['Bitcoin','Cryptocurrency','Tether_(cryptocurrency)','XRP_Ledger','Binance','BNB_(cryptocurrency)',
          'Cardano_(blockchain_platform)','Tron_(blockchain)','USD_Coin','Litecoin','Monero','Pepe_(cryptocurrency)',
          '$Trump','Chainlink_(blockchain_oracle)','Avalanche_(blockchain_platform)','Polkadot_(blockchain_platform)',
          'Hyperliquid','Pi_Network','Bitcoin_Cash','Toncoin','Stablecoin','Memecoin','Satoshi_Nakamoto']
WINDOWS = {'snapshot': ('20261010','20261108'), 'live': ('20261014','20261112')}
UA = 'thesis-evidence-check/1.0 (pageview read; no contact)'

def fetch(article, a, b):
    url = ('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/'
           + urllib.parse.quote(article, safe='') + f'/daily/{a}/{b}')
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return url, r.status, r.read()
    except urllib.error.HTTPError as e:
        return url, e.code, e.read()

log = []
res = {}
for wname, (a, b) in WINDOWS.items():
    for art in [s + '_(astrology)' for s in SIGNS] + PAGE_SET + OTHERS:
        url, status, body = fetch(art, a, b)
        at = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        name = f"{wname}-{art.replace('$','S_').replace('(','').replace(')','')}.json"
        open(os.path.join(OUT, 'wikimedia', name), 'wb').write(body)
        days = total = 0
        if status == 200:
            items = json.loads(body).get('items', [])
            days = len(items); total = sum(i['views'] for i in items)
        log.append(f"{at}\t{status}\t{len(body)}\t{hashlib.sha256(body).hexdigest()}\t{url}")
        res[(wname, art)] = (status, days, total)
        time.sleep(0.15)
open(os.path.join(OUT, 'wikimedia-fetch-log.tsv'), 'w').write('fetched_at_utc\tstatus\tbytes\tsha256\turl\n' + '\n'.join(log) + '\n')

for wname, (a, b) in WINDOWS.items():
    print(f"\n== window {wname}: {a} to {b}")
    per = {}
    for s in SIGNS:
        st, d, t = res[(wname, s + '_(astrology)')]
        per[s] = round(t / max(d, 1))
        print(f"{s:14s} status {st} days {d} total {t:7d} avg/day {per[s]}")
    twelve_total = sum(res[(wname, s + '_(astrology)')][2] for s in SIGNS)
    twelve = round(twelve_total / 30)
    vals = sorted(per.values())
    median_page = vals[len(vals)//2]            # the page's rule: upper of the two middle values
    median_true = (vals[5] + vals[6]) / 2
    print(f"twelve together avg/day {twelve}; highest sign {max(per, key=per.get)} {max(vals)}; lowest {min(per, key=per.get)} {min(vals)}")
    print(f"median sign, page's rule (7th of 12) {median_page}; mean of the two middle values {median_true}")
    for art in PAGE_SET + OTHERS:
        st, d, t = res[(wname, art)]
        if st != 200:
            print(f"{art:36s} status {st} (no data)"); continue
        avg = round(t / max(d, 1))
        print(f"{art:36s} days {d} avg/day {avg:6d}  twelve/article {twelve/max(avg,1):6.1f} (rounded {round(twelve/max(avg,1))})  median sign/article {median_page/max(avg,1):.2f}  signs above it {sum(1 for v in vals if v > avg)}")
