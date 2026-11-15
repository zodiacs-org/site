import re,html,json
s=open('TMP/live.html',encoding='utf-8').read()
body=json.load(open('TMP/render2.json'))['body']
claims=open('/workspace/wt/fable-job4/docs/platform/evidence/thesis-skeptic-20261113/claims.md',encoding='utf-8').read()
def norm(t):
    t=t.replace('\u2019',"'").replace('\u2018',"'")
    t=re.sub(r'\s*[\u2013\u2014]\s*',' ',t)
    t=re.sub(r'[^a-z0-9%]+',' ',t.lower())
    return re.sub(r'\s+',' ',t).strip()
C=norm(claims).replace(' to ',' ')
items=[]
for l in body.split('\n'):
    for sent in re.split(r'(?<=[.?!])\s+',l.strip()):
        if sent: items.append(('BODY',sent))
nos=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',s,flags=re.S)
for m in re.finditer(r'\b(aria-label|title|alt|content)="([^"]*)"',nos): items.append((m.group(1),html.unescape(m.group(2))))
for m in re.finditer(r'<(title|desc)>(.*?)</\1>',nos,re.S): items.append((m.group(1),html.unescape(m.group(2))))
seen=set()
for k,t in items:
    n=norm(t).replace(' to ',' '); w=n.split()
    if len(w)<5 or n in seen: continue
    seen.add(n)
    grams=[' '.join(w[i:i+4]) for i in range(len(w)-3)]
    hit=sum(g in C for g in grams)/len(grams)
    if hit<0.5: print(f'{hit:.2f}\t{k}\t{t[:260]}')
