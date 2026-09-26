"""The engine's and Swiss's apparent sidereal time against ERFA's gst06a
(IAU 2006/2000A), UT1 read as UTC and TT from the engine's ΔT. Needs pyerfa.

    python3 tools/sidereal.py "$WORK/sidereal.jsonl" > results/sidereal.json
"""
import json, math, sys
from datetime import datetime
import erfa
import swisseph as swe

rows = []
for line in open(sys.argv[1]):
    case = json.loads(line)
    t = datetime.fromisoformat(case['utc'].replace('Z', '+00:00'))
    jd = swe.julday(t.year, t.month, t.day, t.hour + t.minute / 60)
    reference = erfa.gst06a(jd, 0.0, jd + case['deltaT'] / 86400, 0.0) * 12 / math.pi
    arcsec = lambda hours: ((hours - reference + 12) % 24 - 12) * 15 * 3600
    rows.append({'utc': case['utc'], 'engineMinusErfa': round(arcsec(case['gastHours']), 3),
                 'swissMinusErfa': round(arcsec(swe.sidtime(jd)), 3)})
print(json.dumps({'swisseph': swe.version, 'pyerfa': erfa.__version__, 'unit': 'arcseconds', 'rows': rows}, indent=1))
