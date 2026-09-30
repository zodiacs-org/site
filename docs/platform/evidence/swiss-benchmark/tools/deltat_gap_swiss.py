"""
How far Swiss Ephemeris's ΔT and @zodiacs/engine's differ from 2100 to 2199,
and how far that difference alone moves the Moon, from the lines
deltat-gap-zodiacs.mjs writes. Swiss's ΔT is computed here, on demand, and
only statistics are written: no daily value, and no date for an extreme.

  node deltat-gap-zodiacs.mjs > <outside the repository>/deltat-gap-zodiacs.jsonl
  venv/bin/python deltat_gap_swiss.py <outside the repository>/deltat-gap-zodiacs.jsonl <ephe-dir> \
      > ../deltat-gap-2100-2199.json

Swiss's ΔT is swe.deltat_ex(jd_ut, FLG_SWIEPH) with the .se1 files of
../CONFIGURATION.md on the ephemeris path, as the benchmark's calls read it:
Swiss takes its tidal acceleration from those files. deltat_ex has no return
flag; it raises on error. The Moon's offset is |Swiss − engine| times the
engine's Moon speed at that instant, which is how far the difference alone
moves the Moon at the same UT; over at most 31 s its error from the Moon's
changing speed is under 0.001″.
"""
import hashlib
import json
import os
import sys

import swisseph as swe

J2000 = 2451545.0


def extremes(values, digits):
    return {'min': round(min(values), digits), 'max': round(max(values), digits)}


def main():
    path, ephe = sys.argv[1], sys.argv[2]
    raw = open(path, 'rb').read()
    lines = raw.decode('utf8').splitlines()
    header = json.loads(lines[0])
    swe.set_ephe_path(ephe)
    gaps, sigmas, speeds, offsets = [], [], [], []
    for line in lines[1:]:
        row = json.loads(line)
        swiss = swe.deltat_ex(J2000 + row['ut'], swe.FLG_SWIEPH) * 86400
        gap = swiss - row['deltaT']
        gaps.append(gap)
        sigmas.append(row['sigma'])
        speeds.append(row['moonArcsecPerSecond'])
        offsets.append(abs(gap) * row['moonArcsecPerSecond'])
    files = {name: hashlib.sha256(open(os.path.join(ephe, name), 'rb').read()).hexdigest()
             for name in ('semo_18.se1', 'sepl_18.se1')}
    json.dump({
        'what': 'Swiss Ephemeris\'s ΔT minus @zodiacs/engine\'s, and the Moon\'s displacement from that difference alone, every day from %s to %s at %s UTC. Statistics only: no daily value and no date of an extreme is written.' % (header['from'], header['to'], header['atUtc']),
        'engine': header['engine'],
        'deltaTModel': header['deltaTModel'],
        'deltaTTable': header['deltaTTable'],
        'deltaTTableDigest': header['deltaTTableDigest'],
        'node': header['node'],
        'swissBinding': swe.version,
        'swissCall': 'swe.deltat_ex(jd_ut, swe.FLG_SWIEPH), the ephemeris path holding the .se1 files below',
        'ephemerisFiles': files,
        'zodiacsDumpSha256': hashlib.sha256(raw).hexdigest(),
        'from': header['from'],
        'to': header['to'],
        'cadenceDays': header['cadenceDays'],
        'n': len(gaps),
        'swissMinusEngineSeconds': extremes(gaps, 3),
        'engineSigmaSeconds': extremes(sigmas, 3),
        'moonArcsecPerSecond': extremes(speeds, 4),
        'moonOffsetArcsec': {
            **extremes(offsets, 3),
            'what': '|Swiss minus engine| times the engine\'s Moon speed: how far the ΔT difference alone moves the Moon at the same UT',
        },
    }, sys.stdout, indent=1, ensure_ascii=False)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
