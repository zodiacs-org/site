import sys,re,html
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.out=[]; s.skip=0; s.href=None
    def handle_starttag(s,t,a):
        if t in('script','style','noscript','svg','template'): s.skip+=1
        if t in('p','div','li','h1','h2','h3','h4','tr','br','section','dt','dd','pre'): s.out.append('\n')
        if t in('h1','h2','h3','h4'): s.out.append('#'*int(t[1])+' ')
        if t=='li': s.out.append('- ')
        if t=='a':
            d=dict(a); s.href=d.get('href')
    def handle_endtag(s,t):
        if t in('script','style','noscript','svg','template'): s.skip=max(0,s.skip-1)
        if t=='a' and s.href and not s.skip:
            s.out.append(' <'+s.href+'>'); s.href=None
        if t in('td','th'): s.out.append(' | ')
    def handle_data(s,d):
        if not s.skip: s.out.append(d)
p=P(); p.feed(open(sys.argv[1],encoding='utf-8',errors='replace').read())
t=''.join(p.out); t=re.sub(r'[ \t]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t)
print(t.strip())
