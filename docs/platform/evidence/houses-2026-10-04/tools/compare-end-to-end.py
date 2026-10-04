"""Compare dump-end-to-end.mjs's cusps with Swiss's swe_houses_ex at the
engine's UT1 Julian day, for all of 1800-2199 and for 1850-2049 alone, where
Swiss's sidereal time is the IAU one, with the rc.9 record's statistics and
the gate's verdict for each system (../PREREGISTRATION.md). Prints statistics
only. With a second argument, also writes the worst Koch ladder case from 1850
to 2049, with Swiss's RAMC, true obliquity and cusps there, to that scratch
file for worst-koch.mjs; it is never committed.

    python3 tools/compare-end-to-end.py "$WORK/end-to-end.jsonl" "$WORK/worst-koch.json" > results/end-to-end.json
"""
import json, sys
import swisseph as swe

CODES = {'whole': 'W', 'placidus': 'P', 'porphyry': 'O', 'equal': 'E', 'equal-mc': 'D', 'vehlow': 'V',
         'koch': 'K', 'regiomontanus': 'R', 'campanus': 'C', 'topocentric': 'T', 'alcabitius': 'B',
         'morinus': 'M', 'meridian': 'X'}
TOLERANCE = 3.0  # arcseconds


def gap(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


stats, refusals, worst = {}, {}, None
for line in open(sys.argv[1]):
    case = json.loads(line)
    year = int(case['utc'][:4])
    windows = ['1800-2199'] + (['1850-2049'] if 1850 <= year < 2050 else [])
    for name in case.get('refused', {}):
        for window in windows:
            refusals.setdefault((window, case['set'], name), 0)
            refusals[(window, case['set'], name)] += 1
    for name, cusps in case['systems'].items():
        if cusps is None:
            continue
        swiss, ascmc = swe.houses_ex(case['jdUt1'], case['lat'], case['lon'], CODES[name].encode())
        difference = max(gap(cusps[i], swiss[i]) for i in range(12))
        for window in windows:
            stats.setdefault((window, case['set'], name), []).append(difference)
        if name == 'koch' and case['set'] == 'ladder' and 1850 <= year < 2050 and (worst is None or difference > worst['endToEndArcsec']):
            worst = {'utc': case['utc'], 'latitude': case['lat'], 'longitude': case['lon'], 'endToEndArcsec': difference,
                     'swissRamc': ascmc[2], 'swissTrueObliquity': swe.calc_ut(case['jdUt1'], swe.ECL_NUT)[0][0],
                     'swissCusps': list(swiss)}
out = {'swisseph': swe.version, 'unit': 'arcseconds, largest of the twelve cusps per case', 'tolerance': TOLERANCE,
       'windows': {}, 'verdicts': {}}
for (window, name_set, name), e in sorted(stats.items()):
    e.sort()
    out['windows'].setdefault(window, {}).setdefault(name_set, {})[name] = {
        'compared': len(e), 'max': round(e[-1], 3), 'p95': round(e[int(len(e) * 0.95)], 3),
        'p50': round(e[len(e) // 2], 3), 'over3': sum(1 for x in e if x > TOLERANCE),
        'refused': refusals.get((window, name_set, name), 0)}
for name in CODES:
    judged = out['windows'].get('1850-2049', {}).get('ladder', {}).get(name)
    ok = judged is not None and judged['over3'] == 0 and judged['refused'] == 0
    out['verdicts'][name] = 'pass' if ok else 'fail'
print(json.dumps(out, indent=1))

if len(sys.argv) > 2 and worst is not None:
    with open(sys.argv[2], 'w') as f:
        json.dump(worst, f)
