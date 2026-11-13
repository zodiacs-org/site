"""Run the whole accuracy audit: NASA data, truth events, page text, checks, report.

Usage (from the repository root, after `npm run build` has written dist/):
  python3 scripts/accuracy-audit/run_all.py [--refresh]

--refresh fetches every Horizons response and the NASA lunar canon again;
without it the kept responses in docs/accuracy-audit-2026-11/raw/ are read
and their SHA-256 verified, so the audit reruns identically offline.
"""
from __future__ import annotations

import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, os.pardir, os.pardir))
PAGES = os.path.join(ROOT, 'docs', 'accuracy-audit-2026-11', 'results', 'full', 'pages-text.json')


def run(*args):
    print('>', ' '.join(args), flush=True)
    subprocess.run([sys.executable, *args], cwd=HERE, check=True)


def main():
    if not os.path.isdir(os.path.join(ROOT, 'dist')):
        raise SystemExit('dist/ is missing: run `npm run build` first')
    os.makedirs(os.path.dirname(PAGES), exist_ok=True)
    run('horizons_fetch.py', *(['--refresh'] if '--refresh' in sys.argv else []))
    run('nasa_lunar_catalog.py')
    run('truth.py')
    run('dump_pages.py', os.path.join(ROOT, 'dist'), PAGES)
    run('audit_data.py')
    run('audit_pages.py', PAGES)
    run('audit_people.py', PAGES)
    run('report.py')


if __name__ == '__main__':
    main()
