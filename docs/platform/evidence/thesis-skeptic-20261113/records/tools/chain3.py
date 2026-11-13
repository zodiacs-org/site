import json, urllib.request, time, sys, datetime, re
src, outp = sys.argv[1], sys.argv[2]
RPCS = ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com']
PUMP = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'


def post(u, method, params):
    req = urllib.request.Request(u, data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode(), headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
    return json.load(urllib.request.urlopen(req, timeout=25))


def rpc(method, params, tries=3):
    last = None
    for attempt in range(tries):
        for u in RPCS:
            try:
                r = post(u, method, params)
                if 'result' in r:
                    return r['result']
                last = r.get('error')
            except Exception as e:
                last = str(e)
        time.sleep(2.5)
    return {'ERROR': str(last)}


ts = lambda t: datetime.datetime.fromtimestamp(t, datetime.timezone.utc).isoformat() if t else None
reg = json.load(open(src + '/web/registry.json'))
charts = json.load(open(src + '/thesis-charts.json'))
pools = charts['twelve']['pools']
out = {'capturedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'rpcs': RPCS, 'signs': {}}
origin = dict(re.findall(r'solscan\.io/tx/([1-9A-HJ-NP-Za-km-z]+)"[^>]*>(\w+) origin receipt', open(src + '/web/disclosure.html').read()))
origin = {v.lower(): k for k, v in origin.items()}
for a in reg['assets']:
    s = a['sign']
    m = a['native']['address']
    o = {'mint': m, 'pool': pools[s]}
    r = rpc('getAccountInfo', [m, {'encoding': 'jsonParsed'}])
    try:
        o['mintInfo'] = r['value']['data']['parsed']['info']
        o['ownerProgram'] = r['value']['owner']
    except Exception:
        o['mintInfo'] = r
    r = rpc('getSignaturesForAddress', [pools[s], {'limit': 5}])
    o['poolNewest'] = [{'sig': x['signature'], 'time': ts(x['blockTime']), 'err': x['err']} for x in r] if isinstance(r, list) else r
    if s in origin:
        r = rpc('getTransaction', [origin[s], {'encoding': 'jsonParsed', 'maxSupportedTransactionVersion': 0}])
        try:
            keys = [k['pubkey'] for k in r['transaction']['message']['accountKeys']]
            o['origin'] = {'sig': origin[s], 'time': ts(r['blockTime']), 'feePayer': keys[0], 'programs': sorted(set(i.get('programId', '') for i in r['transaction']['message']['instructions'])), 'pumpFunProgramPresent': PUMP in keys, 'mintInAccounts': m in keys}
        except Exception as e:
            o['origin'] = {'sig': origin[s], 'ERROR': str(r)[:200]}
    b = [x for x in a.get('representations', []) if x.get('chain') == 'base']
    if b:
        o['base'] = b[0].get('address')
        try:
            req = urllib.request.Request('https://mainnet.base.org', data=json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'eth_call', 'params': [{'to': o['base'], 'data': '0x95d89b41'}, 'latest']}).encode(), headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
            h = json.load(urllib.request.urlopen(req, timeout=20)).get('result', '')
            o['baseSymbol'] = re.sub(r'[^A-Za-z0-9]', '', bytes.fromhex(h[2:]).decode('utf8', 'ignore')) if h and h != '0x' else h
        except Exception as e:
            o['baseSymbol'] = 'ERROR ' + str(e)[:80]
    out['signs'][s] = o
    mi = o['mintInfo']
    print(s, mi.get('supply'), mi.get('decimals'), mi.get('mintAuthority'), mi.get('freezeAuthority'), '| newest pool tx', (o['poolNewest'][0]['time'] if isinstance(o['poolNewest'], list) and o['poolNewest'] else o['poolNewest']), '| origin', o.get('origin', {}).get('time'), o.get('origin', {}).get('feePayer'), 'pump:', o.get('origin', {}).get('pumpFunProgramPresent'), len(o.get('origin', {}).get('programs', [])), '| base', o.get('baseSymbol'), flush=True)
    json.dump(out, open(outp, 'w'), indent=1)
    time.sleep(0.8)
for s in ('taurus', 'virgo', 'leo', 'capricorn'):
    sig = out['signs'][s]['poolNewest'][0]['sig']
    r = rpc('getTransaction', [sig, {'encoding': 'jsonParsed', 'maxSupportedTransactionVersion': 0}])
    try:
        keys = r['transaction']['message']['accountKeys']
        progs = sorted(set(i.get('programId', '') for i in r['transaction']['message']['instructions']))
        touched = [p for p in pools if any(k['pubkey'] == pools[p] for k in keys)]
        d = {'sig': sig, 'time': ts(r['blockTime']), 'signer': keys[0]['pubkey'], 'programs': progs, 'zodiacPoolsTouched': touched, 'logHasSwap': any('swap' in l.lower() for l in r['meta']['logMessages'])}
    except Exception as e:
        d = {'sig': sig, 'ERROR': str(r)[:200]}
    out.setdefault('newestTxDetail', {})[s] = d
    print('TX', s, d, flush=True)
    time.sleep(1)
r = rpc('getAccountInfo', ['DUK1VN3WatYKsVLwRX2JxfJfaKX6bDXvijpPtT28ed13', {'encoding': 'jsonParsed'}])
out['creationFeePayer'] = {'address': 'DUK1VN3WatYKsVLwRX2JxfJfaKX6bDXvijpPtT28ed13', 'info': (r.get('value') if isinstance(r, dict) else r)}
print('DUK', json.dumps(out['creationFeePayer'])[:300])
r = rpc('getTokenLargestAccounts', [reg['assets'][0]['native']['address']], tries=1)
out['largestAccountsAttempt'] = r if isinstance(r, dict) and 'ERROR' in r else {'ok': True, 'value': r.get('value')[:10] if isinstance(r, dict) else r}
print('LARGEST', json.dumps(out['largestAccountsAttempt'])[:300])
json.dump(out, open(outp, 'w'), indent=1)
