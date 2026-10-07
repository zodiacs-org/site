"""Step 1.3 (brief v1 rule 1b) on the vendored @zodiacs/engine 0.1.1-rc.16.

Inputs, under $WORK unless named otherwise (all produced by run-all.sh, nothing hand-edited):
  s13/engine-grids.json          the SHIPPED chart path (site full.ts computeChart), grids A and L
  s13/swiss-grids.json           Swiss 2.10.03 houses_ex readings (flags checked; instrument only)
  corpora/angle-grid-erfa.json   the committed ERFA arbiter (rebuilt byte-identically in s13/erfa-rebuild/)
  s13/erfa-rebuild/angle-clock.json  the engine's clock the arbiter was built on
and pyerfa 2.0.1.5 for the decomposition (same construction as tools/angle-arbiter.py).

Measures:
  (a) ASC vs Swiss houses_ex over the 3,128 cases: p50/p95/max (gates p95 <= 3", max <= 75");
  (b) ASC vs the ERFA arbiter: max <= 8", and <= 0.5" for |lat| <= 45;
  (c) the rule's extra vectors at 63/65/66 degrees, both hemispheres, 5" gates, against Swiss;
      which exceed and why (engine IAU 2000B nutation vs ERFA; Swiss long-term sidereal time
      outside 1850-2050), and amendment A1 (8" at 66, judged against ERFA outside 1850-2050).

  $PYTHON tools/s13/compare13.py > $WORK/s13/compare13.log
Writes $WORK/s13/verdict-13.json (statistics, and a decomposition of every vector over a gate)
and rows-13.json (per-case angles from Swiss: never committed).
"""
import hashlib, json, math
import erfa
import os, sys
sys.dont_write_bytecode = True  # no __pycache__ beside lib/paths.py in the repository
sys.path.insert(0, os.path.join(os.environ['SITE_ROOT'], 'docs/platform/evidence/phase1-verdicts-2026-09-25/tools/lib'))
from paths import CORPORA, WORK, out_dir  # noqa: E402

CORPORA = os.path.join(WORK, 's13/erfa-rebuild')
O = WORK
out_dir('s13')
J2000 = 2451545.0
AS = 3600.0
# Swiss's long-term sidereal-time switch (swephlib.c SIDT_LTERM_T0/T1, JD UT): 1850-01-01 and 2050-01-01.
SIDT_LTERM_T0, SIDT_LTERM_T1 = 2396758.5, 2469807.5

eng = json.load(open(O + '/s13/engine-grids.json'))
sw = json.load(open(O + '/s13/swiss-grids.json'))
erfa_bytes = open(CORPORA + '/angle-grid-erfa.json', 'rb').read()
arb = json.loads(erfa_bytes)
clock = json.load(open(O + '/s13/erfa-rebuild/angle-clock.json'))
assert eng['corpus']['sha256'] == sw['corpus']['sha256'] == arb['corpus']['sha256']
assert len(eng['A']) == len(sw['A']) == len(arb['A']) == len(clock['A']) == 3128


def wrap(d):
    """Signed a - b (degrees) folded into [-180, 180)."""
    return (d + 180.0) % 360.0 - 180.0


def sdiff(a, b):
    return wrap(a - b) * AS


def asc_of(ramc_deg, eps_deg, lat):
    r, e, p = math.radians(ramc_deg), math.radians(eps_deg), math.radians(lat)
    return math.degrees(math.atan2(math.cos(r), -(math.sin(r) * math.cos(e) + math.tan(p) * math.sin(e)))) % 360.0


def mc_of(ramc_deg, eps_deg):
    r, e = math.radians(ramc_deg), math.radians(eps_deg)
    return math.degrees(math.atan2(math.sin(r), math.cos(r) * math.cos(e))) % 360.0


def q_audit(v, p):  # the audit's convention (engine_grid.mjs): v[min(n-1, floor(p (n-1)))]
    v = sorted(v); return v[min(len(v) - 1, int(math.floor(p * (len(v) - 1))))]


def q_site(v, p):  # scripts/angles-grid.test.mjs: v[min(n-1, floor(p n))]
    v = sorted(v); return v[min(len(v) - 1, int(math.floor(p * len(v))))]


def stats(v):
    v = [x for x in v if x is not None]
    if not v:
        return None
    return dict(n=len(v), p50=round(q_audit(v, 0.5), 4), p95=round(q_audit(v, 0.95), 4), max=round(max(v), 4),
                p50_site=round(q_site(v, 0.5), 4), p95_site=round(q_site(v, 0.95), 4))


rows = []
for e, s, a, c in zip(eng['A'], sw['A'], arb['A'], clock['A']):
    assert e['utc'] == s['utc'] and e['lat'] == s['lat'] and s['status'] == 0
    assert abs(e['ut'] - c[0]) < 1e-12 and abs(e['tt'] - c[1]) < 1e-12  # same clock as the arbiter
    ut, tt, lat, lon = e['ut'], e['tt'], e['lat'], e['lon']
    # ERFA arbiter pieces, same construction as tools/angle-arbiter.py, on the engine's clock.
    gast = erfa.gst06a(J2000, ut, J2000, tt)
    gmst = erfa.gmst06(J2000, ut, J2000, tt)
    ee = erfa.ee06a(J2000, tt)
    eps0 = erfa.obl06(J2000, tt)
    dpsi, deps = erfa.nut06a(J2000, tt)
    eps_e = math.degrees(eps0 + deps)
    ramc_e = (math.degrees(gast) + lon) % 360.0
    asc_e, mc_e = asc_of(ramc_e, eps_e, lat), mc_of(ramc_e, eps_e)
    assert abs(sdiff(asc_e, a[0])) < 1e-5 and abs(sdiff(mc_e, a[1])) < 1e-5  # reproduces the committed arbiter
    # Engine inputs (astronomy-engine SiderealTime and e_tilt, as computeChart uses them).
    ramc_g = (e['gastHours'] * 15.0 + lon) % 360.0
    eps_g = e['tobl']
    formula_gap = abs(sdiff(asc_of(ramc_g, eps_g, lat), e['asc']))
    # Swiss inputs (houses_ex's ARMC and ECL_NUT's true obliquity, confirmed by houses_armc).
    ramc_s, eps_s = s['ascmc'][2], s['eps_true']
    jd = s['jd_ut']
    inside = SIDT_LTERM_T0 < jd < SIDT_LTERM_T1
    # Gains (arcsec of ASC per arcsec of input) at the arbiter's point.
    h = 0.01 / AS
    gR = (asc_of(ramc_e + h, eps_e, lat) - asc_of(ramc_e - h, eps_e, lat))
    gR = wrap(gR) / (2 * h)
    gE = wrap(asc_of(ramc_e, eps_e + h, lat) - asc_of(ramc_e, eps_e - h, lat)) / (2 * h)
    # ERFA on Swiss's clock (TT = UT + Swiss deltaT), to size the clock's share of Swiss - ERFA.
    tt_sw = jd + s['deltat_days'] - J2000
    ramc_e_sw = (math.degrees(erfa.gst06a(J2000, jd - J2000, J2000, tt_sw)) + lon) % 360.0
    eps_e_sw = math.degrees(erfa.obl06(J2000, tt_sw) + erfa.nut06a(J2000, tt_sw)[1])
    rows.append(dict(
        i=e['i'], utc=e['utc'], year=int(e['utc'][:4]), hour=int(e['utc'][11:13]), lat=lat,
        insideSwissSidtWindow=inside,
        asc_eng=e['asc'], asc_sw=s['ascmc'][0], asc_erfa=a[0], mc_eng=e['mc'], mc_sw=s['ascmc'][1], mc_erfa=a[1],
        dAsc_eng_sw=sdiff(e['asc'], s['ascmc'][0]), dAsc_eng_erfa=sdiff(e['asc'], a[0]), dAsc_sw_erfa=sdiff(s['ascmc'][0], a[0]),
        dMc_eng_sw=sdiff(e['mc'], s['ascmc'][1]), dMc_eng_erfa=sdiff(e['mc'], a[1]), dMc_sw_erfa=sdiff(s['ascmc'][1], a[1]),
        cusps_eng_sw=max(abs(sdiff(x, y)) for x, y in zip(e['cusps'], s['cusps'])),
        intermediate_cusps_eng_sw=max(abs(sdiff(e['cusps'][k], s['cusps'][k])) for k in (1, 2, 4, 5, 7, 8, 10, 11)),
        formulaGapArcsec=formula_gap,
        # input differences, arcsec
        dR_eng_erfa=sdiff(ramc_g, ramc_e), dEps_eng_erfa=(eps_g - eps_e) * AS,
        dR_sw_erfa=sdiff(ramc_s, ramc_e), dEps_sw_erfa=(eps_s - eps_e) * AS,
        dR_sw_erfaSwissClock=sdiff(ramc_s, ramc_e_sw), dEps_sw_erfaSwissClock=(eps_s - eps_e_sw) * AS,
        dR_erfaClock=sdiff(ramc_e_sw, ramc_e), dEps_erfaClock=(eps_e_sw - eps_e) * AS,
        # engine GAST - ERFA GAST split: nutation in longitude (2000B vs 2000A) and the rest
        dDpsi_eng_erfa=e['dpsi'] - math.degrees(dpsi) * AS,
        dDeps_eng_erfa=e['deps'] - math.degrees(deps) * AS,
        eeComplementaryArcsec=math.degrees(ee - dpsi * math.cos(eps0)) * AS,
        dGmst_eng_erfa=sdiff((e['gastHours'] * 15.0 - e['ee'] * 15.0 / AS * 1.0) % 360.0, math.degrees(gmst) % 360.0),
        dMobl_eng_erfa=(e['mobl'] - math.degrees(eps0)) * AS,
        # ASC shares: RAMC alone, obliquity alone (the other input held at ERFA's)
        dAsc_eng_R=sdiff(asc_of(ramc_g, eps_e, lat), asc_e), dAsc_eng_eps=sdiff(asc_of(ramc_e, eps_g, lat), asc_e),
        dAsc_sw_R=sdiff(asc_of(ramc_s, eps_e, lat), asc_e), dAsc_sw_eps=sdiff(asc_of(ramc_e, eps_s, lat), asc_e),
        gainR=gR, gainEps=gE,
    ))

absv = lambda key, sel=lambda r: True: [abs(r[key]) for r in rows if sel(r)]
band = lambda lo, hi: (lambda r: lo <= abs(r['lat']) <= hi)
inside = lambda r: r['insideSwissSidtWindow']
outside = lambda r: not r['insideSwissSidtWindow']


def worst(key, sel=lambda r: True, n=1):
    cand = sorted((r for r in rows if sel(r)), key=lambda r: -abs(r[key]))[:n]
    return [dict(utc=r['utc'], lat=r['lat'], value=round(r[key], 4)) for r in cand]


# ---------- (a) vs Swiss ----------
a = dict(
    asc=stats(absv('dAsc_eng_sw')), asc_worst=worst('dAsc_eng_sw', n=3),
    asc_lat_le45=stats(absv('dAsc_eng_sw', band(0, 45))), asc_lat_50_60=stats(absv('dAsc_eng_sw', band(50, 60))),
    asc_lat_ge63=stats(absv('dAsc_eng_sw', band(63, 90))),
    asc_inside1850_2050=stats(absv('dAsc_eng_sw', inside)), asc_outside1850_2050=stats(absv('dAsc_eng_sw', outside)),
    mc=stats(absv('dMc_eng_sw')), mc_worst=worst('dMc_eng_sw'),
    placidusCuspsAll12=stats(absv('cusps_eng_sw')), placidusIntermediateCusps=stats(absv('intermediate_cusps_eng_sw')),
    swissMinusErfa_asc=stats(absv('dAsc_sw_erfa')),
    swissMinusErfa_ramc_inside=stats(absv('dR_sw_erfa', inside)), swissMinusErfa_ramc_outside=stats(absv('dR_sw_erfa', outside)),
    swissMinusErfa_eps=stats(absv('dEps_sw_erfa')),
    swissClockShare_ramc=stats(absv('dR_erfaClock')), swissClockShare_eps=stats(absv('dEps_erfaClock')),
)
a['gates'] = dict(p95_le_3=a['asc']['p95'] <= 3 and a['asc']['p95_site'] <= 3, max_le_75=a['asc']['max'] <= 75)

# ---------- (b) vs ERFA ----------
b = dict(
    asc=stats(absv('dAsc_eng_erfa')), asc_worst=worst('dAsc_eng_erfa', n=3),
    asc_lat_le45=stats(absv('dAsc_eng_erfa', band(0, 45))), asc_lat_le45_worst=worst('dAsc_eng_erfa', band(0, 45)),
    mc=stats(absv('dMc_eng_erfa')), mc_worst=worst('dMc_eng_erfa'),
    formulaGapMaxArcsec=max(r['formulaGapArcsec'] for r in rows),
    engineInputs=dict(dR=stats(absv('dR_eng_erfa')), dEps=stats(absv('dEps_eng_erfa')),
                      dDpsi=stats(absv('dDpsi_eng_erfa')), dDeps=stats(absv('dDeps_eng_erfa')),
                      eeComplementary=stats(absv('eeComplementaryArcsec')), dGmst=stats(absv('dGmst_eng_erfa')),
                      dMobl=stats(absv('dMobl_eng_erfa'))),
)
b['gates'] = dict(max_le_8=b['asc']['max'] <= 8, lat_le45_max_le_0_5=b['asc_lat_le45']['max'] <= 0.5)

# ---------- (c) the extra vectors at 63/65/66, both hemispheres ----------
EXTRA_LATS = (63, 65, 66)
LEDGER_YEARS = (1800, 1950, 2200)  # ledger angles-houses-aspects-1 "fix": 1800/1950/2200


def vec_rows(years=None):
    return [r for r in rows if abs(r['lat']) in EXTRA_LATS and (years is None or r['year'] in years)]


def decomp(r):
    return dict(
        utc=r['utc'], lat=r['lat'], insideSwissSidtWindow=r['insideSwissSidtWindow'],
        engMinusSwiss=round(r['dAsc_eng_sw'], 3), engMinusErfa=round(r['dAsc_eng_erfa'], 3),
        swissMinusErfa=round(r['dAsc_sw_erfa'], 3),
        gainR=round(r['gainR'], 2), gainEps=round(r['gainEps'], 2),
        eng=dict(dR=round(r['dR_eng_erfa'], 4), dEps=round(r['dEps_eng_erfa'], 4),
                 ascFromR=round(r['dAsc_eng_R'], 3), ascFromEps=round(r['dAsc_eng_eps'], 3),
                 dDpsi=round(r['dDpsi_eng_erfa'], 4), dDeps=round(r['dDeps_eng_erfa'], 4),
                 eeComplementary=round(r['eeComplementaryArcsec'], 5), dGmst=round(r['dGmst_eng_erfa'], 5)),
        swiss=dict(dR=round(r['dR_sw_erfa'], 4), dEps=round(r['dEps_sw_erfa'], 4),
                   ascFromR=round(r['dAsc_sw_R'], 3), ascFromEps=round(r['dAsc_sw_eps'], 3),
                   dR_clockShare=round(r['dR_erfaClock'], 5)),
        mc=dict(engMinusSwiss=round(r['dMc_eng_sw'], 3), engMinusErfa=round(r['dMc_eng_erfa'], 3)),
        placidusIntermediateCusps_engMinusSwiss_max=round(r['intermediate_cusps_eng_sw'], 3),
    )


def gate_eval(vs, rule):
    """rule(r) -> (oracle key, gate arcsec). Returns counts and the exceeding cases."""
    fails = []
    for r in vs:
        key, gate = rule(r)
        if abs(r[key]) > gate:
            fails.append(dict(decomp(r), oracle='Swiss' if key == 'dAsc_eng_sw' else 'ERFA', gate=gate))
    per_lat = {}
    for lat in sorted({r['lat'] for r in vs}):
        sel = [r for r in vs if r['lat'] == lat]
        per_lat[str(lat)] = dict(n=len(sel), maxVsOracle=round(max(abs(r[rule(r)[0]]) for r in sel), 3),
                                 gate=rule(sel[0])[1], exceed=sum(1 for r in sel if abs(r[rule(r)[0]]) > rule(r)[1]))
    return dict(n=len(vs), exceed=len(fails), perLatitude=per_lat, exceeding=fails)


original = lambda r: ('dAsc_eng_sw', 5.0)
a1 = lambda r: ('dAsc_eng_sw' if r['insideSwissSidtWindow'] else 'dAsc_eng_erfa', 8.0 if abs(r['lat']) == 66 else 5.0)
a1_narrow = lambda r: (('dAsc_eng_erfa' if (abs(r['lat']) == 66 and not r['insideSwissSidtWindow']) else 'dAsc_eng_sw'),
                       8.0 if abs(r['lat']) == 66 else 5.0)
erfa_only_5 = lambda r: ('dAsc_eng_erfa', 5.0)
erfa_a1 = lambda r: ('dAsc_eng_erfa', 8.0 if abs(r['lat']) == 66 else 5.0)

c = {}
for label, years in (('gridA_63_65_66_all17epochs', None), ('ledger_1800_1950_2200', LEDGER_YEARS)):
    vs = vec_rows(years)
    c[label] = dict(
        n=len(vs),
        maxAbs=dict(engVsSwiss=round(max(abs(r['dAsc_eng_sw']) for r in vs), 3),
                    engVsErfa=round(max(abs(r['dAsc_eng_erfa']) for r in vs), 3),
                    swissVsErfa=round(max(abs(r['dAsc_sw_erfa']) for r in vs), 3)),
        byLatitude={str(l): dict(
            engVsSwiss_inside=round(max([abs(r['dAsc_eng_sw']) for r in vs if abs(r['lat']) == l and r['insideSwissSidtWindow']] or [0]), 3),
            engVsSwiss_outside=round(max([abs(r['dAsc_eng_sw']) for r in vs if abs(r['lat']) == l and not r['insideSwissSidtWindow']] or [0]), 3),
            engVsErfa_inside=round(max([abs(r['dAsc_eng_erfa']) for r in vs if abs(r['lat']) == l and r['insideSwissSidtWindow']] or [0]), 3),
            engVsErfa_outside=round(max([abs(r['dAsc_eng_erfa']) for r in vs if abs(r['lat']) == l and not r['insideSwissSidtWindow']] or [0]), 3),
            swissVsErfa_inside=round(max([abs(r['dAsc_sw_erfa']) for r in vs if abs(r['lat']) == l and r['insideSwissSidtWindow']] or [0]), 3),
            swissVsErfa_outside=round(max([abs(r['dAsc_sw_erfa']) for r in vs if abs(r['lat']) == l and not r['insideSwissSidtWindow']] or [0]), 3),
            mcEngVsSwiss=round(max(abs(r['dMc_eng_sw']) for r in vs if abs(r['lat']) == l), 3),
            cuspsEngVsSwiss_inside=round(max([r['intermediate_cusps_eng_sw'] for r in vs if abs(r['lat']) == l and r['insideSwissSidtWindow']] or [0]), 3),
            cuspsEngVsSwiss_outside=round(max([r['intermediate_cusps_eng_sw'] for r in vs if abs(r['lat']) == l and not r['insideSwissSidtWindow']] or [0]), 3),
        ) for l in EXTRA_LATS},
        rule_5arcsec_vsSwiss=gate_eval(vs, original),
        A1_8at66_ERFAoutside1850_2050=gate_eval(vs, a1),
        A1narrow_8at66_ERFAoutsideOnlyAt66=gate_eval(vs, a1_narrow),
        vsERFA_everywhere_5=gate_eval(vs, erfa_only_5),
        vsERFA_everywhere_A1gates=gate_eval(vs, erfa_a1),
    )

# The Swiss sidereal-time window, checked empirically: Swiss - ERFA RAMC per epoch.
per_epoch = {}
for y in sorted({r['year'] for r in rows}):
    sel = [r for r in rows if r['year'] == y]
    per_epoch[str(y)] = dict(inside=sel[0]['insideSwissSidtWindow'],
                             swissMinusErfaRamc=[round(min(r['dR_sw_erfa'] for r in sel), 4), round(max(r['dR_sw_erfa'] for r in sel), 4)],
                             engineMinusErfaRamc=[round(min(r['dR_eng_erfa'] for r in sel), 4), round(max(r['dR_eng_erfa'] for r in sel), 4)],
                             swissMinusErfaEps=[round(min(r['dEps_sw_erfa'] for r in sel), 5), round(max(r['dEps_sw_erfa'] for r in sel), 5)],
                             engineMinusErfaEps=[round(min(r['dEps_eng_erfa'] for r in sel), 4), round(max(r['dEps_eng_erfa'] for r in sel), 4)])

out = dict(
    what='Step 1.3 (rule 1b) verdict measurements on @zodiacs/engine 0.1.1-rc.16 through the site computeChart',
    inputs={'engine-grids.json': hashlib.sha256(open(O + '/s13/engine-grids.json', 'rb').read()).hexdigest(),
            'swiss-grids.json': hashlib.sha256(open(O + '/s13/swiss-grids.json', 'rb').read()).hexdigest(),
            'angle-grid-erfa.json': hashlib.sha256(erfa_bytes).hexdigest(),
            'angle-clock.json': hashlib.sha256(open(O + '/s13/erfa-rebuild/angle-clock.json', 'rb').read()).hexdigest()},
    pyerfa=erfa.__version__, erfa=erfa.version.erfa_version,
    quantiles='p50/p95 as the audit computed them (v[floor(p(n-1))]); *_site as scripts/angles-grid.test.mjs (v[floor(pn)])',
    a_vsSwiss=a, b_vsERFA=b, c_extraVectors=c, perEpoch=per_epoch,
)
json.dump(out, open(O + '/s13/verdict-13.json', 'w'), indent=1)
json.dump(rows, open(O + '/s13/rows-13.json', 'w'))
summary = dict(
    a=dict(asc=a['asc'], asc_worst=a['asc_worst'], mc=a['mc'], gates=a['gates'],
           asc_inside=a['asc_inside1850_2050'], asc_outside=a['asc_outside1850_2050']),
    b=dict(asc=b['asc'], asc_worst=b['asc_worst'], asc_lat_le45=b['asc_lat_le45'], mc=b['mc'], gates=b['gates'],
           formulaGapMaxArcsec=b['formulaGapMaxArcsec']),
    c={k: dict(n=v['n'], maxAbs=v['maxAbs'], rule5=v['rule_5arcsec_vsSwiss']['exceed'],
               A1=v['A1_8at66_ERFAoutside1850_2050']['exceed'], A1narrow=v['A1narrow_8at66_ERFAoutsideOnlyAt66']['exceed'],
               erfa5=v['vsERFA_everywhere_5']['exceed'], erfaA1=v['vsERFA_everywhere_A1gates']['exceed'])
       for k, v in c.items()},
)
print(json.dumps(summary, indent=1))
