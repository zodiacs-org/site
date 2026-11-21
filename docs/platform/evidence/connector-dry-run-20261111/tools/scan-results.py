#!/usr/bin/env python3
"""Reads the recorded calls under raw/mcp/calls/ and prints, for each: outcome, every
URL in the result, and whether a URL carries any synthetic birth detail that was sent
(D3), plus words that would show betting, investment, health or romance framing (D2).
Offline. Usage: python3 tools/scan-results.py > raw/mcp/scan.txt"""
import json, glob, re, pathlib, urllib.parse
ROOT = pathlib.Path(__file__).resolve().parent.parent
WORDS = {
 'betting': r'\b(bet|bets|betting|gambl\w*|lotter\w*|casino|wager\w*|odds)\b',
 'investment': r'\b(invest\w*|stock\w*|shares|crypto\w*|token\w*|trading|portfolio|market timing)\b',
 'health': r'\b(health\w*|medical\w*|diagnos\w*|illness\w*|disease\w*|pregnan\w*|surgery|medication\w*|symptom\w*)\b',
 'romance': r'\b(romance|romantic\w*|attraction|flirt\w*|sexual\w*|sex|lover\w*|love|dating|crush)\b',
 'promotion': r'(by email|sign up|subscribe|invite your|invitation)',
 'wing': r'(astrofolio|/registry|/terminal|/fomo)',
}
def strings(o, path=''):
    if isinstance(o, dict):
        for k, v in o.items(): yield from strings(v, path + '.' + k)
    elif isinstance(o, list):
        for n, v in enumerate(o): yield from strings(v, path + '[%d]' % n)
    elif isinstance(o, str): yield path, o
def sent_values(args):
    """Personal values sent in the request: dates, times, places, names, coordinates."""
    out = set()
    for p, v in strings(args):
        key = p.split('.')[-1]
        if key in ('birthDate', 'time', 'birthTime', 'place', 'name', 'names', 'famous') or key == 'date': out.add((key, v))
    def nums(o, path=''):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ('latitude', 'longitude') and isinstance(v, (int, float)): out.add((k, repr(v)))
                nums(v)
    nums(args)
    return out
for f in sorted(glob.glob(str(ROOT / 'raw/mcp/calls/*.json'))):
    r = json.load(open(f)); resp = r['response']
    print('==', r['id'], '| HTTP', r['httpStatus'])
    if not isinstance(resp, dict): print('   non-JSON body:', str(resp)[:200]); continue
    if 'error' in resp: print('   JSON-RPC error:', json.dumps(resp['error'], ensure_ascii=False)[:300]); continue
    res = resp.get('result', {})
    args = (r.get('request') or {}).get('params', {}).get('arguments', {}) if isinstance(r.get('request'), dict) else {}
    sc = res.get('structuredContent')
    if res.get('isError'):
        msg = (sc or {}).get('error', {}).get('message') if isinstance(sc, dict) else None
        if msg is None: msg = ' '.join(c.get('text', '') for c in res.get('content', []) if c.get('type') == 'text')
        print('   refused or error (isError true):', msg)
    body = {k: v for k, v in res.items() if k != '_meta'}
    allstr = list(strings(body))
    urls = sorted({u.rstrip('.,)"\\') for _, s in allstr for u in re.findall(r'https?://[^\s"\'<>\\]+', s)})
    sent = sent_values(args)
    for u in urls:
        dec = urllib.parse.unquote(u)
        hits = []
        for key, v in sent:
            if key in ('birthDate', 'date'):
                y, m, d = v.split('-') if v.count('-') == 2 else (None, None, None)
                if v in dec or v.replace('-', '') in dec: hits.append(key + ' ' + v)
                elif key == 'birthDate' and y and re.search(r'(?<!\d)' + y + r'(?!\d)', dec): hits.append('birth year ' + y)
            elif key in ('time', 'birthTime'):
                if v in dec: hits.append(key + ' ' + v)
            elif key in ('latitude', 'longitude'):
                if v in dec: hits.append(key + ' ' + v)
            else:
                for part in re.split(r'[,\s]+| and ', v):
                    if len(part) > 2 and part.lower() in dec.lower(): hits.append(key + ' "' + part + '"')
        print('   url:', u, ('  <-- CARRIES ' + '; '.join(sorted(set(hits)))) if hits else '')
    text = ' \n '.join(s for p, s in allstr if not re.search(r'https?://', s) or len(s) > 200)
    for name, pat in WORDS.items():
        found = sorted({m.group(0).lower() for m in re.finditer(pat, text, re.I)})
        if found: print('   words[%s]:' % name, ', '.join(found))
