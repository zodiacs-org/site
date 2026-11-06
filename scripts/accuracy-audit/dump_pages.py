"""Write the visible text of every English consumer page in dist/ to one JSON file.

Skips the localized trees (es, fr, it, pt, ru, zh-*), the registry wing and
developer reference pages, which publish no sky claims. Output:
{"/today/": ["line", ...], ...}

Usage: python3 scripts/accuracy-audit/dump_pages.py dist OUT.json
"""
from __future__ import annotations

import json
import os
import re
import sys
from multiprocessing import Pool

from bs4 import BeautifulSoup

SKIP_TOP = {'es', 'fr', 'it', 'pt', 'ru', 'zh-hans', 'zh-hant', 'terminal', 'registry', 'sdk',
            'developers', 'astrofolio', 'archive', 'thesis', 'embed', 'fomo', 'bio', '_astro', 'assets'}

# The site header and footer repeat on every page; drop them so claims come from the body.
NAV_END = re.compile(r'^(Home)$')


def text_of(path):
    with open(path, encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'lxml')
    for tag in soup(['script', 'style', 'noscript', 'template', 'svg']):
        tag.decompose()
    main = soup.find('main')
    if main is None:
        main = soup.body or soup
        for tag in main.find_all(['header', 'footer', 'nav'], recursive=False):
            tag.decompose()
    text = main.get_text('\n')
    lines = [re.sub(r'[ \t  ]+', ' ', ln).strip() for ln in text.splitlines()]
    return [ln for ln in lines if ln]


def work(args):
    root, path = args
    rel = '/' + os.path.relpath(os.path.dirname(path), root).replace(os.sep, '/') + '/'
    rel = rel.replace('/./', '/')
    try:
        return rel, text_of(path)
    except Exception as e:  # pragma: no cover
        return rel, ['__ERROR__ %s' % e]


def main():
    root, out = sys.argv[1], sys.argv[2]
    jobs = []
    for dirpath, dirnames, filenames in os.walk(root):
        rel = os.path.relpath(dirpath, root)
        top = rel.split(os.sep)[0]
        if top in SKIP_TOP:
            dirnames[:] = []
            continue
        if 'index.html' in filenames:
            jobs.append((root, os.path.join(dirpath, 'index.html')))
    with Pool(4) as p:
        pages = dict(p.map(work, jobs, chunksize=8))
    with open(out, 'w') as f:
        json.dump(pages, f)
    print(len(pages), 'pages')


if __name__ == '__main__':
    main()
