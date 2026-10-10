#!/usr/bin/env python3
"""Recheck the retained exact JSON comparison against its immutable base."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
REPORT = Path(__file__).resolve().parents[1] / 'regenerated-outputs.json'


def differences(before, after, path='', counts=None):
    if counts is None:
        counts = Counter()
    if isinstance(before, dict) and isinstance(after, dict):
        for key in before.keys() | after.keys():
            child = f'{path}.{key}'
            if key not in before or key not in after:
                counts[child] += 1
            else:
                differences(before[key], after[key], child, counts)
    elif isinstance(before, list) and isinstance(after, list):
        for index in range(max(len(before), len(after))):
            if index >= len(before) or index >= len(after):
                counts[f'{path}[]'] += 1
            else:
                differences(before[index], after[index], f'{path}[]', counts)
    elif before != after:
        counts[path] += 1
    return dict(counts)


report = json.loads(REPORT.read_text())
for item in report['files']:
    prior = subprocess.check_output(
        ['git', 'show', f"{report['base']}:{item['path']}"], cwd=ROOT)
    candidate = (ROOT / item['path']).read_bytes()
    actual = {
        'sameBytes': prior == candidate,
        'baseSha256': hashlib.sha256(prior).hexdigest(),
        'candidateSha256': hashlib.sha256(candidate).hexdigest(),
        'differingPaths': differences(json.loads(prior), json.loads(candidate)),
    }
    if any(item[key] != value for key, value in actual.items()):
        raise SystemExit('FAIL: regenerated-output comparison differs from its record')
print(f"PASS: {len(report['files'])} regenerated outputs match the recorded hashes and exact JSON differences")
