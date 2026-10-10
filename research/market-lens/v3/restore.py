#!/usr/bin/env python3
"""Restore a checked v3 backup into a NEW private directory; never overwrite receipts."""
import argparse, hashlib, json, os, tarfile
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('archive', type=Path); parser.add_argument('destination', type=Path)
args=parser.parse_args(); archive=args.archive.resolve(); dest=args.destination.resolve()
expected=Path(str(archive)+'.sha256').read_text().split()[0]
assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected,'Archive checksum mismatch'
assert not dest.exists(),'Destination must not exist'
with tarfile.open(archive) as t:
    members=t.getmembers(); seen=set()
    assert sum(m.size for m in members)<200_000_000,'Archive too large'
    for m in members:
        p=Path(m.name)
        assert not p.is_absolute() and '..' not in p.parts and (m.isdir() or m.isfile()),'Unsafe archive member'
        if m.isfile():
            assert str(p) not in seen and m.size<25_000_000,'Duplicate or oversized member'
            seen.add(str(p))
    os.umask(0o077); dest.mkdir(mode=0o700)
    for m in members:
        out=dest/Path(m.name)
        if m.isdir(): out.mkdir(parents=True,exist_ok=True,mode=0o700)
        else:
            out.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
            with out.open('xb') as f: f.write(t.extractfile(m).read())
    hashes={str(p.relative_to(dest)):hashlib.sha256(p.read_bytes()).hexdigest() for p in dest.rglob('*') if p.is_file()}
    (dest/'restore-checksums.json').write_text(json.dumps(hashes,indent=2)+'\n')
print('Restored original bytes. Install the pinned minimal runtime; then verify protocol, receipts and original RFC3161 signatures before any cycle.')
