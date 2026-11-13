"""Visible text of a built page: scripts, styles, templates and hidden JSON dropped.

Usage: python3 scripts/accuracy-audit/pagetext.py dist/today/index.html
"""
from __future__ import annotations

import re
import sys

from bs4 import BeautifulSoup


def page_soup(path):
    with open(path, encoding='utf-8') as f:
        html = f.read()
    return BeautifulSoup(html, 'html.parser')


def visible_text(soup):
    for tag in soup(['script', 'style', 'noscript', 'template', 'svg']):
        tag.decompose()
    text = soup.get_text('\n')
    lines = [re.sub(r'[ \t ]+', ' ', ln).strip() for ln in text.splitlines()]
    return '\n'.join(ln for ln in lines if ln)


def blocks(soup):
    """Text of each block-level element that holds text directly, for sentence-level claims."""
    out = []
    for tag in soup.find_all(['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'dd', 'dt', 'figcaption', 'caption', 'time', 'span', 'div']):
        if tag.find(['p', 'li', 'div', 'table', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4']):
            continue
        t = re.sub(r'\s+', ' ', tag.get_text(' ')).strip()
        if t:
            out.append(t)
    return out


if __name__ == '__main__':
    print(visible_text(page_soup(sys.argv[1])))
