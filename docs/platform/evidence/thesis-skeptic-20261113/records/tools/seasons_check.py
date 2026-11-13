"""Independent recomputation of the thesis season figures.

Inputs: a directory of twelve Wikimedia per-article daily responses fetched in
this job, the raw file committed on main, and the live thesis-seasons.json.
Sun signs come from a low-precision solar longitude (Meeus, Astronomical
Algorithms ch. 25), not from the site's engine.
"""
import json, math, sys, datetime as dt, statistics as st

wm_dir, raw_main, live_json = sys.argv[1], sys.argv[2], sys.argv[3]
SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
YEARS = list(range(2016, 2026))
D0 = dt.date(2016, 1, 1)


def sun_lon(d, hour=12.0):
    """Apparent geocentric longitude of the Sun, degrees, at `hour` UTC."""
    a = (14 - d.month) // 12
    y = d.year + 4800 - a
    m = d.month + 12 * a - 3
    jdn = d.day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
    jd = jdn + (hour - 12) / 24.0
    T = (jd - 2451545.0) / 36525.0
    L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
    M = math.radians(357.52911 + 35999.05029 * T - 0.0001537 * T * T)
    C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * math.sin(M) + (0.019993 - 0.000101 * T) * math.sin(2 * M) + 0.000289 * math.sin(3 * M)
    om = math.radians(125.04 - 1934.136 * T)
    return (L0 + C - 0.00569 - 0.00478 * math.sin(om)) % 360


def sign_of(d):
    return int(sun_lon(d) // 30)


views = {}
for i, s in enumerate(SIGNS):
    items = json.load(open(f'{wm_dir}/{s.capitalize()}.json'))['items']
    v = {}
    for it in items:
        t = it['timestamp']
        v[dt.date(int(t[:4]), int(t[4:6]), int(t[6:8]))] = it['views']
    views[s] = v

raw = json.load(open(raw_main))
live = json.load(open(live_json))
print('raw file fetchedAt', raw['fetchedAt'], 'from', raw['from'], 'to', raw['to'])
mism = 0
tot = 0
for s in SIGNS:
    arr = raw['signs'][s]['views']
    for k, val in enumerate(arr):
        d = D0 + dt.timedelta(days=k)
        if d.year > 2025:
            continue
        tot += 1
        if views[s].get(d) != val:
            mism += 1
print(f'days 2016-2025 compared against committed raw: {tot}, mismatches: {mism}')
missing = {s: sum(1 for y in YEARS for k in range((dt.date(y + 1, 1, 1) - dt.date(y, 1, 1)).days) if (dt.date(y, 1, 1) + dt.timedelta(days=k)) not in views[s]) for s in SIGNS}
print('missing days per sign 2016-2025:', missing)

print()
print('sign        live  mine(norm-mean)  raw-mean  median  yrsLifted(live) yrs(median) yrs(mean)  ownSeasonRank  peakDay inSeason  failing years (median rule)')
tot_med = tot_mean = 0
allrows = []
for i, s in enumerate(SIGNS):
    ins, outs, rin, rout = [], [], [], []
    ymed = ymean = 0
    fails = []
    bydoy = {}
    # mean normalised reads in each of the twelve sun-sign windows
    win = [[] for _ in range(12)]
    for y in YEARS:
        days = [(dt.date(y, 1, 1) + dt.timedelta(days=k)) for k in range((dt.date(y + 1, 1, 1) - dt.date(y, 1, 1)).days)]
        days = [d for d in days if d in views[s]]
        typ = st.median(views[s][d] for d in days)
        yin, yout = [], []
        for d in days:
            v = views[s][d]
            sg = sign_of(d)
            (ins if sg == i else outs).append(v / typ)
            (rin if sg == i else rout).append(v)
            (yin if sg == i else yout).append(v)
            win[sg].append(v / typ)
            if not (d.month == 2 and d.day == 29):
                bydoy.setdefault((d.month, d.day), []).append(v / typ)
        if st.median(yin) > st.median(yout):
            ymed += 1
        else:
            fails.append((y, st.median(yin), st.median(yout)))
        if st.mean(yin) > st.mean(yout):
            ymean += 1
    tot_med += ymed
    tot_mean += ymean
    lift = (st.mean(ins) / st.mean(outs) - 1) * 100
    rawlift = (st.mean(rin) / st.mean(rout) - 1) * 100
    medlift = (st.median(ins) / st.median(outs) - 1) * 100
    wmeans = [st.mean(w) for w in win]
    rank = sorted(range(12), key=lambda k: -wmeans[k]).index(i) + 1
    typday = {k: st.median(v) for k, v in bydoy.items()}
    pk = max(typday, key=typday.get)
    pk_in = sign_of(dt.date(2025, pk[0], pk[1])) == i
    L = live['signs'][i]
    assert L['sign'] == s
    allrows.append((s, L['lift'], lift))
    print(f"{s:11s} {L['lift']:4d}  {lift:8.2f}       {rawlift:7.2f}  {medlift:6.2f}   {L['yearsLifted']:3d}            {ymed:3d}        {ymean:3d}        {rank:2d}            {pk[0]:02d}-{pk[1]:02d}  {pk_in}   {fails}")
print('sign-years lifted, median rule:', tot_med, 'of', 12 * len(YEARS), '| mean rule:', tot_mean, '| live file:', live['liftedYears'], 'of', live['signYears'])
print('rounded lifts match live:', all(round(m) == l for _, l, m in allrows), '| range', min(round(m) for *_, m in allrows), max(round(m) for *_, m in allrows))

# sun entries 2026 by this formula, to the minute, for the page script's table
print()
print('2026 sun entries by the Meeus formula (UTC), against the page script:')
script = {'aquarius': '2026-01-20T01:44', 'aries': '2026-03-20T14:45', 'cancer': '2026-06-21T08:25', 'libra': '2026-09-23T00:05', 'scorpio': '2026-10-23T09:38', 'sagittarius': '2026-11-22T07:23', 'capricorn': '2026-12-21T20:50'}
for name, stamp in script.items():
    target = SIGNS.index(name) * 30
    d = dt.date(int(stamp[:4]), int(stamp[5:7]), int(stamp[8:10]))
    lo, hi = 0.0, 24.0
    f = lambda h: ((sun_lon(d, h) - target + 180) % 360) - 180
    if f(lo) > 0 or f(hi) < 0:
        print(name, 'entry not on that UTC day by this formula', f(lo), f(hi))
        continue
    for _ in range(40):
        mid = (lo + hi) / 2
        if f(mid) < 0:
            lo = mid
        else:
            hi = mid
    print(f'{name:12s} page {stamp}Z  formula {int(lo):02d}:{int((lo % 1) * 60):02d}')

# --- curves, spans and peak bins against the live reduced file
print()
print('curve check (73 five-day bins): max abs difference from the live file, peak bin, season span in the live file')
MD = [(m, d) for m, dim in zip(range(1, 13), [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]) for d in range(1, dim + 1)]
for i, s in enumerate(SIGNS):
    bydoy = [[] for _ in range(365)]
    for y in YEARS:
        days = [dt.date(y, 1, 1) + dt.timedelta(days=k) for k in range((dt.date(y + 1, 1, 1) - dt.date(y, 1, 1)).days)]
        typ = st.median(views[s][d] for d in days)
        for d in days:
            if d.month == 2 and d.day == 29:
                continue
            bydoy[MD.index((d.month, d.day))].append(views[s][d] / typ)
    daily = [st.median(x) for x in bydoy]
    curve = [round(st.mean(daily[b * 5:b * 5 + 5]) * 100) / 100 for b in range(73)]
    L = live['signs'][i]
    diff = max(abs(a - b) for a, b in zip(curve, L['curve']))
    pb = max(range(73), key=lambda b: L['curve'][b])
    span = L['season']
    days_in = [d for d in range(pb * 5, pb * 5 + 5) if any(a <= d < b for a, b in span)]
    mine = sorted(k for k in range(365) if sign_of(dt.date(2025, 1, 1) + dt.timedelta(days=k)) == i)
    print(f"{s:11s} maxdiff {diff:.3f}  peak bin {pb} (days {pb*5}-{pb*5+4}, value {L['curve'][pb]})  days of peak bin inside season: {len(days_in)}/5  live span {span}  formula 2025 span first/last day {mine[0] if mine[0] else [k for k in mine if k-1 not in mine]}..{mine[-1]}")
