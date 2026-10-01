#!/usr/bin/env python3
"""Read-only exact ZIP-to-Git binding; Python standard library and git only."""
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

TARGET = "93ebae9fa54597aeaafbb346873f7f51e3cc6cb6"
EXPECTED_SHA256 = "d1c050ed6fa103aa8fbafec60a37a08e0d7d5270c16bf7c14cf5636ae6c79e0c"
archive, checkout = map(Path, sys.argv[1:3])
raw = archive.read_bytes()
assert hashlib.sha256(raw).hexdigest() == EXPECTED_SHA256
listing = subprocess.check_output(["git", "-C", str(checkout), "ls-tree", "-r", "--full-tree", TARGET]).decode()
tracked = {}
for line in listing.splitlines():
    metadata, name = line.split("\t", 1)
    mode, kind, sha = metadata.split()
    assert kind == "blob", "No unverified submodule/archive omission allowed"
    tracked[name] = sha
with zipfile.ZipFile(archive) as zipped:
    files = [entry for entry in zipped.infolist() if not entry.is_dir()]
    prefix = "zodiacs-org-engine-93ebae9/"
    names = [entry.filename.removeprefix(prefix) for entry in files]
    assert len(names) == len(set(names)), "Duplicate archive entries"
    assert set(names) == set(tracked), "Missing/extra archive entries"
    for entry, name in zip(files, names):
        assert entry.filename.startswith(prefix)
        expected = subprocess.check_output(["git", "-C", str(checkout), "cat-file", "blob", tracked[name]])
        assert zipped.read(entry) == expected, name
print(json.dumps({"target": TARGET, "files": len(tracked), "byteMismatches": 0, "sha256": EXPECTED_SHA256}))
