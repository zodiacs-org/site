import re,html,json,sys
s=open('TMP/live.html',encoding='utf-8').read()
txt=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',s,flags=re.S)
attrs=' '.join(html.unescape(m.group(1)) for m in re.finditer(r'="([^"]*)"',txt))
ld=' '.join(m.group(1) for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>',s,re.S))
vis=html.unescape(re.sub(r'<[^>]+>',' ',txt))
body=json.load(open('TMP/render2.json'))['body']
def norm(t):
    t=t.replace('\u2019',"'").replace('\u2018',"'").replace('\u201c','"').replace('\u201d','"')
    t=re.sub(r'\s*[\u2013\u2014]\s*',' to ',t)
    t=re.sub(r'[^a-z0-9%$.,+]+',' ',t.lower())
    return re.sub(r'\s+',' ',t).strip()
N=norm(vis+' '+attrs+' '+ld+' '+body)
N2=N.replace(' to ',' ').replace('-',' ')
rows=[]
for line in open(sys.argv[1],encoding='utf-8'):
    if not re.match(r'\| [A-Q]\d+ \|',line): continue
    c=[x.strip() for x in line.split('|')]
    rid,live,status,verdict=c[1],c[2],c[3],c[4]
    qs=re.findall(r'"([^"]{6,})"',live)
    parts=[]
    for q in qs:
        for p in re.split(r'\.\.\.|…|\[n\]',q):
            p=norm(p)
            if len(p.split())>=3: parts.append(p)
    miss=[p for p in parts if p not in N and p.replace(' to ',' ') not in N2]
    rows.append((rid,status,verdict,len(parts),miss))
for rid,status,verdict,n,miss in rows:
    if status=='LIVE' and (miss or n==0): print(rid,status,verdict,'parts',n,'MISSING:',miss[:4])
    if status=='GONE' and not miss and n: print(rid,'GONE but all quoted parts found live!',n)
print(len(rows))
from collections import Counter
print(Counter((r[1],r[2].split('(')[0].strip()) for r in rows))
