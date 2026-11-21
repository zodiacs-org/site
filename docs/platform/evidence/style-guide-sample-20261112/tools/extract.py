#!/usr/bin/env python3
"""Plain-text extraction of the <main> region of a saved page. usage: extract.py in.html out.txt"""
import sys, re, html
from html.parser import HTMLParser
BLOCK={'p','div','section','article','h1','h2','h3','h4','h5','li','ul','ol','br','tr','table','details','summary','figure','figcaption','header','footer','form','label','button','dt','dd','dl','blockquote','time','nav','aside','option','select'}
SKIP={'script','style','svg','noscript','template'}
class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.out=[]; s.skip=0; s.inmain=0
    def handle_starttag(s,t,a):
        if t=='main': s.inmain+=1
        if t in SKIP: s.skip+=1
        if t in BLOCK and s.inmain and not s.skip: s.out.append('\n')
        if t in('h1','h2','h3','h4') and s.inmain and not s.skip: s.out.append('#'*int(t[1])+' ')
    def handle_endtag(s,t):
        if t in SKIP and s.skip: s.skip-=1
        if t=='main': s.inmain-=1
        if t in BLOCK and s.inmain and not s.skip: s.out.append('\n')
    def handle_data(s,d):
        if s.inmain and not s.skip: s.out.append(d)
p=P(); p.feed(open(sys.argv[1],encoding='utf-8').read())
t=''.join(p.out)
t=re.sub(r'[ \t\r\f\v]+',' ',t); t=re.sub(r' *\n *','\n',t); t=re.sub(r'\n{2,}','\n',t).strip()
open(sys.argv[2],'w',encoding='utf-8').write(t+'\n')
