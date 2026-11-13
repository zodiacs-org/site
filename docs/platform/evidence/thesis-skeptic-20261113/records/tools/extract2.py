import sys,re,json
from html.parser import HTMLParser
BLOCK={'p','h1','h2','h3','h4','h5','li','figcaption','div','section','figure','tr','title','details','summary','blockquote','table','svg','text','desc','aside','footer','nav','header','main','article','dt','dd','td','th','g','button','label','caption','ol','ul','dl'}
class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.skip=0; s.out=[]; s.ld=None; s.lds=[]; s.script_type=None
    def handle_starttag(s,t,a):
        a=dict(a)
        if t=='script':
            s.skip+=1; s.script_type=a.get('type')
            if s.script_type in('application/ld+json','application/json'): s.ld=[]; s.out.append(f"\n[SCRIPT {s.script_type} id={a.get('id')}] ")
            return
        if t=='style': s.skip+=1; return
        if t=='meta' and (a.get('name') or a.get('property')): s.out.append(f"\n[META {a.get('name') or a.get('property')}] {a.get('content')}")
        if t=='link' and a.get('rel') in('canonical','alternate'): s.out.append(f"\n[LINK {a.get('rel')} {a.get('hreflang','')}] {a.get('href')}")
        if t in BLOCK: s.out.append("\n")
        for k in('aria-label','title','alt','placeholder','data-tip','data-label','data-note','aria-description'):
            if a.get(k): s.out.append(f"\n[{t} {k}] {a[k]}\n")
        for k,v in a.items():
            if k.startswith('data-') and v and re.search(r'[A-Za-z]{3,} [A-Za-z]{2,}',v) and k not in('data-tip','data-label','data-note'): s.out.append(f"\n[{t} {k}] {v}\n")
        if t=='a': s.out.append('[a '+str(a.get('href'))+']')
        if t=='time' and a.get('datetime'): s.out.append(f"[time {a['datetime']}]")
    def handle_endtag(s,t):
        if t=='script':
            s.skip-=1
            if s.ld is not None:
                s.out.append(''.join(s.ld).strip()); s.ld=None
        if t=='style': s.skip-=1
        if t=='a': s.out.append('[/a]')
        if t in BLOCK: s.out.append("\n")
    def handle_data(s,d):
        if s.ld is not None: s.ld.append(d); return
        if not s.skip and d.strip(): s.out.append(re.sub(r'\s+',' ',d))
p=P(); p.feed(open(sys.argv[1],encoding='utf8').read())
t=''.join(p.out); t=re.sub(r'[ \t]+\n','\n',t); t=re.sub(r'\n[ \t]+','\n',t); t=re.sub(r'\n{2,}','\n',t)
print(t.strip())
