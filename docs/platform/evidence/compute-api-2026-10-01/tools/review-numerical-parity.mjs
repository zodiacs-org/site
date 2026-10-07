import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root=fileURLToPath(new URL('../../../../../', import.meta.url));
const require=createRequire(pathToFileURL(path.join(root,'package.json')));
const dir=fs.mkdtempSync('/tmp/private-cache-review-');
const rewrite=source=>source.replace('from "@vercel/firewall";',`from ${JSON.stringify(pathToFileURL(require.resolve('@vercel/firewall')).href)};`);
const baseline=rewrite(execFileSync('git',['show','9cfafa3e742de943062c9174338472781724a4b5:api/_compute/compute.mjs'],{cwd:root,encoding:'utf8'}));
const current=rewrite(fs.readFileSync(path.join(root,'api/_compute/compute.mjs'),'utf8'))+'\nexport function auditState(){return {tilt:cache_e_tilt??null,pluto:Object.keys(pluto_cache),moonCounter:CalcMoonCount,deltaTFunction:DeltaT.name};}\n';
let n=0;
async function create(source){const file=path.join(dir,`compute-${n++}.mjs`);fs.writeFileSync(file,source); const m=await import(pathToFileURL(file));const handler=m.createComputeApiHandler({localTime:{canonicalZoneName:async n=>n},env:{},rateLimit:async()=> 'allowed'});handler.auditState=m.auditState;return handler;}
async function run(handler,endpoint,body){let output;const res={statusCode:0,setHeader(){},end(text){output=JSON.parse(text)}};await handler({method:'POST',query:{__zodiacs_compute:endpoint},headers:{'content-type':'application/json'},body:JSON.stringify(body)},res);assert.equal(res.statusCode,200);return output;}
const target={utc:'2082-03-14T05:29:17.001Z',latitude:-31.55537,longitude:159.07735};
const preceding={...target,utc:'2082-03-14T05:29:17.000Z'};
function differences(a,b,p=''){const out=[];if(typeof a==='number'&&typeof b==='number'&&a!==b){out.push({path:p,a,b,absolute:Math.abs(a-b)});}else if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of Object.keys(a))out.push(...differences(a[key],b[key],`${p}/${key}`));}else if(JSON.stringify(a)!==JSON.stringify(b))out.push({path:p,a,b});return out;}
try {
const old=await create(baseline);await run(old,'chart',preceding);const oldAnswer=await run(old,'chart',target);
const updated=await create(current);await run(updated,'chart',preceding);const newAnswer=await run(updated,'chart',target);
const fresh=await create(baseline);const freshAnswer=await run(fresh,'chart',target);
assert.deepEqual(newAnswer,freshAnswer);
const diff=differences(oldAnswer,newAnswer);
const overlapping=await create(current);const completionStates=[];const observed=body=>run(overlapping,'chart',body).then(result=>{completionStates.push(overlapping.auditState());return result;});const overlapAnswers=await Promise.all([observed(preceding),observed(target)]);for(const state of completionStates){assert.equal(state.tilt,null);assert.deepEqual(state.pluto,[]);}assert.equal(overlapping.auditState().deltaTFunction,'deltaT');
const overlapDiff=differences(overlapAnswers[1],freshAnswer);
const json={node:process.version,baseline:'9cfafa3e742de943062c9174338472781724a4b5',preceding,target,oldWarmedVersusUpdated:diff,updatedSequentialEqualsFreshBaseline:true,oldAndNewReceiptEqual:JSON.stringify(oldAnswer.receipt)===JSON.stringify(newAnswer.receipt),oldAndNewCiteEqual:JSON.stringify(oldAnswer.cite)===JSON.stringify(newAnswer.cite),maxRawAngularDeltaArcsec:Math.max(...diff.filter(d=>/\/(lon|lat|degree|orb|angle)$/.test(d.path)).map(d=>d.absolute))*3600,overlappingCurrentVersusFresh:overlapDiff,overlappingCompletionStates:completionStates};
console.log(JSON.stringify(json,null,2));
} finally{fs.rmSync(dir,{recursive:true,force:true});}
