import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
const read=p=>readFileSync(p);
const hash=p=>createHash('sha256').update(read(p)).digest('hex');
const base='bbba65df31aee186250bac2bf2e2de78a31785ad';
const before=JSON.parse(execFileSync('git',['show',base+':src/data/sky.json']));
const after=JSON.parse(read('src/data/sky.json'));
for(const key of['generatedAt','from','to','stationBoundaryScanTo','shadowBoundaryScanDays','moons'])assert.deepEqual(after[key],before[key],key);
assert.equal(after.retrogrades.length,before.retrogrades.length);
const months=readdirSync('src/data').filter(p=>/^transits-20(?:2[6-9]|30)-\d\d\.json$/.test(p)).sort();
const monthly=months.flatMap(p=>JSON.parse(read('src/data/'+p)).stations);
const stations=after.retrogrades.flatMap(w=>[
 ...(w.from===after.from?[]:[{planet:w.planet,type:'retrograde',at:w.from}]),
 ...(w.to?[{planet:w.planet,type:'direct',at:w.to}]:[]),
]);
const alignment=monthly.map(m=>{const candidates=stations.filter(s=>s.planet===m.planet&&s.type===m.type).sort((a,b)=>Math.abs(Date.parse(a.at)-Date.parse(m.at))-Math.abs(Date.parse(b.at)-Date.parse(m.at)));const s=candidates[0];assert.ok(s);const deltaMs=Date.parse(s.at)-Date.parse(m.at);assert.ok(Math.abs(deltaMs)<2000,JSON.stringify({m,s,deltaMs}));return{planet:m.planet,type:m.type,monthInstant:m.at,catalogInstant:s.at,deltaMs};});
const changed=[];for(let i=0;i<before.retrogrades.length;i++){const a=before.retrogrades[i],b=after.retrogrades[i];assert.equal(a.planet,b.planet);for(const field of['from','to','preShadowStart','postShadowEnd'])if(a[field]!==b[field]){assert.equal(typeof a[field],typeof b[field]);changed.push({planet:a.planet,field,before:a[field],after:b[field],deltaMs:Date.parse(b[field])-Date.parse(a[field])});}}
const oldStats=JSON.parse(read('docs/platform/evidence/site-engine-rc16/events-vs-swiss.json'));
const newStats=JSON.parse(read('docs/platform/evidence/site-engine-rc16/station-alignment/events-vs-swiss.json'));
for(const f of['lunation','eclipse','ingress','aspect'])assert.deepEqual(newStats.summary[f],oldStats.summary[f],f);
assert.equal(newStats.summary.swissFileFallbacks,0);
console.log(JSON.stringify({schemaVersion:1,sourceBaseline:base,scope:'Product station consistency; no numerical accuracy gate acceptance',node:process.version,skySha256:hash('src/data/sky.json'),generatorSha256:hash('scripts/build-sky.mjs'),transitMonths:months.length,matchedMonthlyStations:alignment.length,maxAgreementMs:Math.max(...alignment.map(x=>Math.abs(x.deltaMs))),fixedFieldsUnchanged:true,changedSkyBoundaries:changed,alignment,swiss:{stationMaxBeforeSeconds:oldStats.summary.station.maxAbsSeconds,stationMaxAfterSeconds:newStats.summary.station.maxAbsSeconds,stationEvents:newStats.summary.station.events,fallbacks:newStats.summary.swissFileFallbacks,otherFamiliesUnchanged:true,independentInstrumentLimits:newStats.provenance.limits}},null,2));
