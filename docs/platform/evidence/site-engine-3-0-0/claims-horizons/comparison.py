"""Replay the DE440 longitude and Moon ingress claims on engine 3.0.0, without network access.

The NASA JPL Horizons answers, their acquisition receipts and the comparison
are the 2.1.0 record's (../../site-engine-2-1-0/claims-horizons), unchanged.
Only the engine adapter beside this file differs: 3.0.0 computes on
astronomy-engine until useDe440() installs its DE440 pack, as the site's
server does (src/lib/engine/server-de440.mjs).

  python3 docs/platform/evidence/site-engine-3-0-0/claims-horizons/comparison.py --check
"""

import argparse
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
RECORD = HERE.parents[1] / 'site-engine-2-1-0' / 'claims-horizons'
spec = importlib.util.spec_from_file_location('recorded_comparison', RECORD / 'comparison.py')
recorded = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recorded)
# The recorded fixture stays the 2.1.0 record's; engine.mjs and results.json are this directory's.
recorded.HERE = HERE


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    parser.parse_args()
    recorded.check(recorded.replay())


if __name__ == '__main__':
    main()
