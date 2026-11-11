#!/usr/bin/env python3
"""Reads the recorded initialize and tools/list answers and prints, for every live tool:
name length, annotations, and each sentence of its description that addresses the
assistant with an order or a ban. The match is by wording only, so a plain fact such as
"Zodiacs never stores birth details" is listed too; the verdict per tool is in REPORT.md. Offline.
Usage: python3 tools/check-descriptions.py > raw/mcp/descriptions-check.txt"""
import json, re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
def sse(p):
    for line in (ROOT / p).read_text().splitlines():
        if line.startswith('data: '): return json.loads(line[6:])
DIRECT = re.compile(r"^(?:if [^,]+, |when [^,]+, |for [^,]+, |without [^,]+, )?(?:do not|don't|never|lead with|offer|share|give|tell|decline|present|use|call|copy|pass|leave|ask|add|say|answer|keep|mention|supply)\b", re.I)
EMBED = re.compile(r"\b(?:do not|never|lead with|offer once|share (?:the|each)|give them|tell the person|decline those|present (?:it|each)|plainly and confidently|copy the returned|say plainly|ask before)\b", re.I)
def sentences(t): return [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z"\'{])', t) if s.strip()]
init = sse('raw/mcp/00-initialize.response.txt')['result']
tools = sse('raw/mcp/01-tools-list.response.txt')['result']['tools']
print('server', init['serverInfo'], 'protocol', init['protocolVersion'], '| tools listed:', len(tools))
print('\n## server instructions (%d characters)' % len(init['instructions']))
for s in sentences(init['instructions']):
    print(('  candidate (order or ban wording): ' if DIRECT.search(s) or EMBED.search(s) else '  describes: ') + s)
for n, t in enumerate(tools, 1):
    a = t.get('annotations', {})
    print('\n## %d. %s  (name %d chars; title %r; readOnlyHint %s; destructiveHint %s; openWorldHint %s; idempotentHint %s; description %d chars; outputSchema %s)' % (
        n, t['name'], len(t['name']), t.get('title'), a.get('readOnlyHint'), a.get('destructiveHint'), a.get('openWorldHint'), a.get('idempotentHint'), len(t['description']), 'yes' if 'outputSchema' in t else 'no'))
    for s in sentences(t['description']):
        print(('  candidate (order or ban wording): ' if DIRECT.search(s) or EMBED.search(s) else '  describes: ') + s)
    dashes = [k for k, v in t['inputSchema'].get('properties', {}).items() if re.search('[–—]', json.dumps(v, ensure_ascii=False))]
    if re.search('[–—]', t['description']): dashes.append('(description)')
    if dashes: print('  en or em dash in:', ', '.join(dashes))
