"""Persist aggregate rc16 benchmark statistics and reproducibility metadata only.
Detailed Swiss readings stay in WORK_ROOT, outside the repository. Historical
benchmarks are read-only. Run from the site root after run.sh's measurements.
"""
from pathlib import Path
import hashlib
import json
import os

ROOT = Path(os.environ.get('SITE_ROOT', Path.cwd())).resolve()
OUT = ROOT / 'docs/platform/evidence/site-engine-rc16/accuracy-refresh'
WORK = Path(os.environ.get('WORK_ROOT', '/tmp/rc16-accuracy-refresh')).resolve()
assert ROOT not in WORK.parents and ROOT != WORK

def read(p):
    return json.loads(Path(p).read_text())

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def write(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

p103 = {}
for mode in ('default-utc', 'aligned-ut1'):
    base = WORK / mode / 's13'
    v = read(base / 'verdict-13.json')
    e = read(base / 'engine-grids.json')
    s = read(base / 'swiss-grids.json')
    extra = {}
    for name, val in v['c_extraVectors'].items():
        rule = val['rule_5arcsec_vsSwiss']
        extra[name] = {
            'n': val['n'], 'maxAbs': val['maxAbs'], 'byLatitude': val['byLatitude'],
            'original5ArcsecondGate': {
                'gateArcsec': 5, 'exceed': rule['exceed'],
                'exceedInsideSwissSidtWindow': sum(r['insideSwissSidtWindow'] for r in rule['exceeding']),
                'exceedOutsideSwissSidtWindow': sum(not r['insideSwissSidtWindow'] for r in rule['exceeding']),
                'perLatitude': rule['perLatitude'],
                'verdict': 'FAIL' if rule['exceed'] else 'PASS',
            },
        }
    gates = dict(v['a_vsSwiss']['gates'], **v['b_vsERFA']['gates'])
    gates['extraVectorsAllWithin5ArcsecVsSwiss'] = extra['gridA_63_65_66_all17epochs']['original5ArcsecondGate']['exceed'] == 0
    p103[mode] = {
        'engineVersion': e['engineVersion'], 'clockMode': mode,
        'interpretation': 'Original default UTC chart input vs Swiss reading the timestamp as UT1' if mode == 'default-utc' else 'Same original timestamp explicitly read as UT1 on both sides',
        'corpusSha256': e['corpus']['sha256'], 'packageMismatches': e['packageMismatches'],
        'diagnosticMismatches': e['diagnosticMismatches'], 'gastSourceSha256': e['gastSourceSha256'],
        'grids': {k:len(e[k]) for k in ('A','L')},
        'engineFallbacks': {k:sum('polar-fallback' in r['flags'] for r in e[k]) for k in ('A','L')},
        'swissBackendChecks': s['summary'],
        'quantiles': v['quantiles'], 'a_vsSwiss': v['a_vsSwiss'], 'b_vsERFA': v['b_vsERFA'],
        'c_extraVectors': extra, 'originalGates': gates,
        'originalGateVerdict': 'PASS' if all(gates.values()) else 'FAIL',
        'rejectedAmendmentA1Applied': False,
        'inputDigests': {name:sha(base/name) for name in ('engine-grids.json','swiss-grids.json','erfa-rebuild/angle-clock.json','erfa-rebuild/angle-grid-erfa.json')},
        'rawInstrumentDataCommitted': False,
    }
write('p103.json', {'schema':'zodiacs-rc16-p103-refresh/v1', 'modes':p103})

stat_keys={'n','p50','p95','max','min'}
def changes(a,b,path=''):
    result=[]
    if isinstance(a,dict) and isinstance(b,dict):
        for k in a.keys() & b.keys():
            p=path+'.'+k if path else k
            if k in stat_keys and isinstance(a[k],(int,float)) and isinstance(b[k],(int,float)):
                result.append(dict(path=p,rc15=a[k],rc16=b[k],changed=a[k]!=b[k]))
            else: result += changes(a[k],b[k],p)
    return result

old_multi=ROOT/'docs/platform/evidence/swiss-benchmark/multiyear-1800-2199.json'
old_gap=ROOT/'docs/platform/evidence/swiss-benchmark/deltat-gap-2100-2199.json'
m=read(OUT/'multiyear-1800-2199.json'); g=read(OUT/'deltat-gap-2100-2199.json')
assert m['engine']==g['engine']=='0.1.1-rc.16'
assert m['instants']==14610 and m['swissBackendsObserved']==['SWIEPH'] and g['n']==36524
multi_stats=changes(read(old_multi),m)
gap_stats=changes(read(old_gap),g)
comparison={}
for name,old,vals in [('multiyear',old_multi,multi_stats),('deltaTGap',old_gap,gap_stats)]:
    comparison[name]={'priorPath':str(old.relative_to(ROOT)),'priorSha256':sha(old),
                      'reportedStatisticalValuesCompared':len(vals),
                      'reportedStatisticalValuesChanged':sum(v['changed'] for v in vals),
                      'changed':[{k:v for k,v in r.items() if k!='changed'} for r in sorted(vals,key=lambda r:r['path']) if r['changed']]}
write('statistical-changes.json',comparison)

given=read(OUT/'houses-given.json')
koch_given={k:v['koch'] for k,v in given['sets'].items()}
koch={}
for mode in ('default-utc','aligned-ut1'):
    h=read(OUT/f'houses-{mode}.json')
    koch[mode]={w:{s:v['koch'] for s,v in sets.items()} for w,sets in h['windows'].items()}

headline={
 'through2026SameUt':m['allBodiesLongitude']['sameUt']['1800-2026'],
 'moon2150to2199SameUt':m['sameUt']['Moon']['lon']['byEra']['2150-2199'],
 'moon2150to2199SameTt':m['sameTt']['Moon']['lon']['byEra']['2150-2199'],
 'deltaTGapSeconds':g['swissMinusEngineSeconds'], 'engineSigmaSeconds':g['engineSigmaSeconds'],
 'moonDisplacementFromDeltaTArcsec':g['moonOffsetArcsec'],
 'publicRoundedChanges': [],
 'publicRoundedUnchanged': {'through2026MedianArcsec':'2.0','through2026MaximumArcsec':'22.9','through2026SignEdgeArcsec':23,
                          'moon2150to2199SameTtMaxArcsec':'7.2','moon2150to2199SameUtMaxArcsec':'20.5','deltaTGapSeconds':['14.3','36.7'],'moonOffsetArcsec':['7.0','23.4']},
}
summary={
 'schema':'zodiacs-rc16-accuracy-refresh/v1','date':'2026-10-01','scope':'Local measurement only; no commit, publication, deployment, acceptance-ledger edit or reference-fixture creation',
 'engine':{'version':'0.1.1-rc.16','archive':'vendor/zodiacs-engine-0.1.1-rc.16.tgz','archiveSha256':sha(ROOT/'vendor/zodiacs-engine-0.1.1-rc.16.tgz'), 'astronomyEngineVersion':read(ROOT/'node_modules/astronomy-engine/package.json')['version']},
 'runtime':read(OUT/'runtime.json'),
 'ephemeris': [{'name':n,'bytes':(ROOT.parent/'reference-swiss-ephe'/n).stat().st_size,'sha256':sha(ROOT.parent/'reference-swiss-ephe'/n)} for n in ['sepl_18.se1','semo_18.se1']],
 'configuration':'docs/platform/evidence/swiss-benchmark/CONFIGURATION.md',
 'measurements':{'multiyearInstants':14610,'multiyearSwissCalls':321420,'deltaTDays':36524,'p103GridACasesPerMode':3128,'p103ExtraVectorCasesPerMode':816,'houseEndToEndCorpusCasesPerMode':3708},
 'headline':headline, 'koch':{'givenInputs':koch_given,'endToEnd':koch,
     'givenInputsGateArcsec':0.01,'endToEndGateArcsec':3,
     'givenInputsAndPolarStatusVerdict':'PASS' if all(v['max']<=0.01 and v['onlyEngineUndefined']==v['onlySwissUndefined']==0 for v in koch_given.values()) else 'FAIL',
     'historic1850to2049LadderVerdicts':{mode:'PASS' if koch[mode]['1850-2049']['ladder']['over3']==0 else 'FAIL' for mode in koch},
     'full1800to2199LadderVerdicts':{mode:'PASS' if koch[mode]['1800-2199']['ladder']['over3']==0 else 'FAIL' for mode in koch},
     'windowQualification':'The original 2026-09-26 record judges end-to-end agreement in 1850–2049, where Swiss uses its IAU sidereal-time model; full-span failures remain recorded and are not waived.',
     'acceptance':'No unit marked accepted; package/site/MCP release and deployment conditions belong to the parent checkpoint.'},
 'p103':{mode:{'verdict':v['originalGateVerdict'],'over5Of816':v['c_extraVectors']['gridA_63_65_66_all17epochs']['original5ArcsecondGate']['exceed'],'maxArcsec':v['c_extraVectors']['gridA_63_65_66_all17epochs']['maxAbs']['engVsSwiss']} for mode,v in p103.items()},
 'recommendedBindings':{'multiyear':'docs/platform/evidence/site-engine-rc16/accuracy-refresh/multiyear-1800-2199.json','deltaTGap':'docs/platform/evidence/site-engine-rc16/accuracy-refresh/deltat-gap-2100-2199.json','p103':'docs/platform/evidence/site-engine-rc16/accuracy-refresh/p103.json','koch':'docs/platform/evidence/site-engine-rc16/accuracy-refresh/summary.json'},
 'licensing':'Swiss is an instrument. Only aggregate statistics, extrema, input/artifact digests and regeneration tools are recorded. No raw Swiss values, Swiss source/data, fitted coefficients or reference fixtures are committed.',
 'excludedWork':['Moon enclosure/P4.5 holdout','DE440','remote requests','new tokens','spending'],
 'sourceInputs': {str(p.relative_to(ROOT)):sha(p) for p in sorted([
     ROOT/'src/lib/engine/time-basis.mjs',
     ROOT/'docs/platform/evidence/engine-beyond-swiss/corpora/angle-grid-inputs.json',
     *list((ROOT/'docs/platform/evidence/swiss-benchmark/tools').glob('*multiyear*')),
     *list((ROOT/'docs/platform/evidence/swiss-benchmark/tools').glob('*deltat*')),
     ROOT/'docs/platform/evidence/phase1-verdicts-2026-09-25/tools/s13/engine_grids.mjs',
     ROOT/'docs/platform/evidence/phase1-verdicts-2026-09-25/tools/s13/swiss_grids.py',
     ROOT/'docs/platform/evidence/phase1-verdicts-2026-09-25/tools/s13/compare13.py',
     ROOT/'docs/platform/evidence/houses-2026-09-26/tools/dump-end-to-end.mjs',
     ROOT/'docs/platform/evidence/houses-2026-09-26/tools/compare-end-to-end.py',
     ROOT/'docs/platform/evidence/houses-2026-09-26/tools/dump-given.mjs',
     ROOT/'docs/platform/evidence/houses-2026-09-26/tools/compare-given.py',
 ])},
 'adaptedTools':{str(p.relative_to(ROOT)):sha(p) for p in sorted((OUT/'tools').glob('*')) if p.is_file()},
 'outputSha256':{p.name:sha(p) for p in sorted(OUT.glob('*.json')) if p.name!='summary.json'},
 'scratchInputDigests':{p.name:sha(p) for p in sorted(WORK.glob('*.jsonl'))},
}
write('summary.json',summary)
print(json.dumps({'p103':summary['p103'],'koch':summary['koch'],'headline':summary['headline'],'statisticalChanges':{k:v['reportedStatisticalValuesChanged'] for k,v in comparison.items()}},indent=2))
