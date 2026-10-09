import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root='docs/platform/evidence/checkpoint23-20261009/results/';
const sha=b=>createHash('sha256').update(b).digest('hex');
const parsed=async name=>JSON.parse(await readFile(root+name,'utf8'));
const given=await parsed('houses-given.json');
const end=await parsed('houses-end-to-end.json');
const coGiven=await parsed('co-given.json');
const coEnd=await parsed('co-end-to-end.json');
assert.equal(given.tolerance,0.01);assert.equal(end.tolerance,3);assert.equal(coGiven.tolerance,0.01);assert.equal(coEnd.tolerance,3);
assert.equal(given.verdicts.koch,'pass');assert.equal(end.verdicts.koch,'pass');assert.equal(coGiven.verdict,'pass');assert.equal(coEnd.gate.verdict,'pass');assert.equal(coEnd.gate.window,'1850-2049');
assert.equal(coGiven.sets.L.equatorialAscendant.n,5616);assert.equal(coGiven.sets.G.equatorialAscendant.n,20000);
assert.equal(end.windows['1850-2049'].ladder.koch.compared,353);
assert.equal(coEnd.windows['1850-2049'].ladder.equatorialAscendant.compared,319);
const pkg=JSON.parse(await readFile('node_modules/@zodiacs/engine/package.json','utf8'));
assert.equal(pkg.version,'1.0.0-rc.2');
const archive=await readFile('vendor/zodiacs-engine-1.0.0-rc.2.tgz');
assert.equal(sha(archive),'4cd834b2dca085cd5732ecad6edbd82b61d7625d9a0647900c160a0747810002');
const published=[];
for(const name of ['items.json','key.json','tool-answers.json','scorer.mjs']) {
 const path='public/developers/sky-benchmark/v0/'+name;
 const source=await readFile(path);
 const url='https://zodiacs.org/developers/sky-benchmark/v0/'+name;
 const response=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200);const served=Buffer.from(await response.arrayBuffer());
 assert.ok(served.equals(source),name+' differs from canonical publication');
 published.push({path,url,bytes:source.length,sha256:sha(source)});
}
const proof={schema:'zodiacs.checkpoint23-gate.v1',producer:{source:process.env.GITHUB_SHA,head:process.env.PROGRAMME_HEAD,run:process.env.GITHUB_RUN_ID,node:process.version},engine:{version:pkg.version,archiveSha256:sha(archive)},clock:'same engine UT1 Julian day',judgedWindow:'1850-2049',givenToleranceArcseconds:0.01,endToEndToleranceArcseconds:3,benchmarkPublication:published,limitations:['Finite reference comparisons; no outside-window tolerance claim','Original failed clock and outside-window results retained','Assistant answers are separately required by B4.b','No private scan or registry/guide publication']};
await writeFile(root+'validation.json',JSON.stringify(proof,null,2)+'\n');
for(const name of ['houses-given.json','houses-end-to-end.json','co-given.json','co-end-to-end.json','validation.json']) {
 const bytes=await readFile(root+name);console.log('PROGRAMME_FILE '+JSON.stringify({path:root+name,size:bytes.length,sha256:sha(bytes),base64:bytes.toString('base64')}));
}
