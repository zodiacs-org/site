#!/usr/bin/env python3
"""Sends the cases in cases.json to the live hosted MCP server and records each
request and response under raw/mcp/calls/. Synthetic input only. Read-only: every
live tool declares readOnlyHint true. Usage: python3 tools/run-calls.py [id-prefix] [--resume]"""
import json, sys, time, urllib.request, urllib.error, pathlib, datetime
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = 'https://zodiacs.org/mcp'
cases = json.loads((ROOT / 'tools' / 'cases.json').read_text())
out = ROOT / 'raw' / 'mcp' / 'calls'; out.mkdir(parents=True, exist_ok=True)
only = next((a for a in sys.argv[1:] if not a.startswith('--')), '')
for c in cases:
    if not c['id'].startswith(only): continue
    if '--resume' in sys.argv and (out / (c['id'] + '.json')).exists(): continue
    if 'raw' in c: body = c['raw'].encode()
    elif 'method' in c: body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': c['method'], 'params': c.get('params', {})}).encode()
    elif c.get('http') == 'GET': body = b''
    else: body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': c['tool'], 'arguments': c['args']}}).encode()
    http = c.get('http', 'POST')
    req = urllib.request.Request(URL, data=None if http == 'GET' else body, method=http, headers={
        'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'user-agent': 'connector-dry-run/1.0'})
    sent = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
    for attempt in range(5):  # the client's own network drops a TLS handshake now and then; an HTTP answer is never retried
        try:
            r = urllib.request.urlopen(req, timeout=60); status = r.status; text = r.read().decode('utf-8', 'replace'); ctype = r.headers.get('content-type'); break
        except urllib.error.HTTPError as e:
            status = e.code; text = e.read().decode('utf-8', 'replace'); ctype = e.headers.get('content-type'); break
        except urllib.error.URLError as e:
            if attempt == 4: raise
            time.sleep(2)
    parsed = None
    for line in text.splitlines():
        if line.startswith('data: '):
            try: parsed = json.loads(line[6:])
            except ValueError: pass
    if parsed is None:
        try: parsed = json.loads(text)
        except ValueError: pass
    rec = {'id': c['id'], 'why': c['why'], 'sentAtUtc': sent, 'httpMethod': http, 'request': None if http == 'GET' else (c['raw'] if 'raw' in c else json.loads(body)),
           'httpStatus': status, 'contentType': ctype, 'response': parsed if parsed is not None else text}
    (out / (c['id'] + '.json')).write_text(json.dumps(rec, indent=1, ensure_ascii=False) + '\n')
    res = (parsed or {}).get('result', {}) if isinstance(parsed, dict) else {}
    print(c['id'], status, 'isError' if res.get('isError') else ('rpc-error' if isinstance(parsed, dict) and 'error' in parsed else 'ok'), len(text))
    time.sleep(0.4)
