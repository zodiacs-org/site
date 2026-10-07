/** Exact regression-pin witness; engine-to-engine migration, not independent accuracy. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const root=process.cwd();const work=mkdtempSync(join(tmpdir(),'rc16-registry-pin-'));const sha=b=>createHash('sha256').update(b).digest('hex');
const base='ed55dacb449ada6e4893676c80bd0d9ba73db576';const source=readFileSync('scripts/build-transits.mjs');assert.ok(source.equals(execFileSync('git',['show',base+':scripts/build-transits.mjs'])),'same generator logic');
try {
const sides=[];
for(const version of[15,16]){
 const archive=resolve(`vendor/zodiacs-engine-0.1.1-rc.${version}.tgz`),dir=join(work,'rc'+version);mkdirSync(dir);execFileSync('tar',['-xzf',archive,'--strip-components=1','-C',dir]);const pkg=JSON.parse(readFileSync(join(dir,'package.json')));
 const plugins=[{name:'exact-archive',setup(b){b.onResolve({filter:/^@zodiacs\/engine(?:\/|$)/},a=>({path:join(dir,pkg.exports[a.path==='@zodiacs/engine'?'.':'.'+a.path.slice('@zodiacs/engine'.length)].import)}));b.onResolve({filter:/^astronomy-engine$/},()=>({path:resolve('node_modules/astronomy-engine/esm/astronomy.js')}));}}];
 const generator=join(work,'generator-'+version+'.mjs'),out=join(work,'month-'+version+'.json');await build({stdin:{contents:source.toString(),sourcefile:'build-transits.mjs',resolveDir:root},bundle:true,platform:'node',format:'esm',target:'node22',outfile:generator,plugins,logLevel:'error'});execFileSync(process.execPath,[generator,'2026-08','--output',out],{encoding:'utf8'});const ingress=JSON.parse(readFileSync(out)).ingresses.find(x=>x.planet==='Mercury'&&x.sign==='leo');assert.ok(ingress);
 const probe=join(work,'probe-'+version+'.mjs');await build({stdin:{contents:`export {bodyLongitude} from '@zodiacs/engine/internal'; export {e_tilt,MakeTime,SetDeltaTFunction} from 'astronomy-engine'; export {deltaT} from '@zodiacs/engine/deltat'; export {timeBasis,tilt} from ${JSON.stringify(resolve('src/lib/engine/time-basis.mjs'))};`,resolveDir:root},bundle:true,platform:'node',format:'esm',target:'node22',outfile:probe,plugins,logLevel:'error'});
 sides.push({version:pkg.version,archiveSha256:sha(readFileSync(archive)),ingress,api:await import(pathToFileURL(probe).href)});
}
assert.equal(sides[0].ingress.at,'2026-08-09T16:28:16.308Z');assert.equal(sides[1].ingress.at,'2026-08-09T16:28:16.438Z');const at=Date.parse(sides[0].ingress.at),A=sides[0].api,B=sides[1].api;const before=A.bodyLongitude('Mercury',new Date(at)),after=B.bodyLongitude('Mercury',new Date(at));const basis=B.timeBasis(at);B.SetDeltaTFunction(()=>basis.deltaT.seconds);const time=B.MakeTime(basis.ut1Days),five=B.e_tilt(time),full=B.tilt(time.tt);B.SetDeltaTFunction(B.deltaT);const delta=after-before,expected=(full.dpsi-five.dpsi)/3600;assert.ok(Math.abs(delta-expected)<2e-10,'longitude shift independently replays through nutation');
console.log(JSON.stringify({schemaVersion:1,node:process.version,generator:'scripts/build-transits.mjs',generatorSha256:sha(source),sameGeneratorAsBase:base,test:'scripts/registry-outlook.test.mjs exact toEqual timestamp golden',sides:sides.map(({api,...s})=>s),reportedShiftMs:Date.parse(sides[1].ingress.at)-at,witness:{utc:sides[0].ingress.at,oldLongitude:before,newLongitude:after,observedDeltaDegrees:delta,nutationDeltaDegrees:expected,residualDegrees:delta-expected},limits:'Reported timestamps are the unchanged hourly-bracket/20-bisection generator output, rounded to JavaScript milliseconds. 130 ms is the exact golden-output shift, not a claimed exact mathematical-root displacement or new tolerance. No accuracy gate changed.'},null,2));
}finally{rmSync(work,{recursive:true,force:true});}
