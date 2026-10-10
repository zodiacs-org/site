import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const output='docs/platform/evidence/solar-term-reference-20261010';
const planBytes=readFileSync(output+'/reference-plan.json'),plan=JSON.parse(planBytes);
assert.equal(plan.terms.length,24);
assert.equal(new Set(plan.terms.map(t=>t.longitude)).size,24);
assert.deepEqual(plan.referenceRequest.offsetsSeconds,[-120,-60,0,60,120]);
mkdirSync(output,{recursive:true});
const observations=[];let failure=null;
function retain(path,bytes){writeFileSync(path,bytes);console.log('PROGRAMME_FILE '+JSON.stringify({path,size:bytes.length,sha256:sha(bytes),base64:bytes.toString('base64')}));}
try{
 for(let batch=0;batch<4;batch++){
  const terms=plan.terms.slice(batch*6,(batch+1)*6);
  const epochs=terms.flatMap(term=>plan.referenceRequest.offsetsSeconds.map(offset=>({longitude:term.longitude,utc:new Date(Date.parse(term.utcSearchCentre)+offset*1000).toISOString()})));
  const params={format:'json',COMMAND:"'10'",CENTER:"'500@399'",EPHEM_TYPE:"'OBSERVER'",MAKE_EPHEM:"'YES'",OBJ_DATA:"'NO'",QUANTITIES:"'30,31'",TIME_TYPE:"'UT'",TIME_DIGITS:"'FRACSEC'",TLIST_TYPE:"'JD'",CSV_FORMAT:"'YES'",EXTRA_PREC:"'YES'",APPARENT:"'AIRLESS'",REF_SYSTEM:"'ICRF'",CAL_TYPE:"'GREGORIAN'",TLIST:epochs.map(e=>"'"+(Date.parse(e.utc)/86400000+2440587.5).toFixed(12)+"'").join(' ')};
  const url=new URL('https://ssd.jpl.nasa.gov/api/horizons.api');for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  const response=await fetch(url,{redirect:'error',headers:{accept:'application/json','user-agent':'Zodiacs-private-reference-acquisition'},signal:AbortSignal.timeout(20000)});
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;assert.ok(size<=1024*1024,'Response bound');chunks.push(next.value);}}finally{await reader.cancel();}
  const bytes=Buffer.concat(chunks),path=output+'/horizons-batch-'+(batch+1)+'.json';
  retain(path,bytes);
  const observation={batch:batch+1,status:response.status,url:url.href,parameters:params,epochs,path,bytes:bytes.length,sha256:sha(bytes)};observations.push(observation);
  assert.equal(response.status,200);
  const json=JSON.parse(bytes);observation.signature=json.signature??null;
  assert.equal(json.error,undefined);
  assert.equal(typeof json.result,'string');
  assert.match(json.result,/Target body name:\s*Sun \(10\)/);
  assert.match(json.result,/Center body name:\s*Earth \(399\)/);
  assert.match(json.result,/Center-site name:\s*GEOCENTRIC/);
  const table=json.result.match(/\$\$SOE([\s\S]*?)\$\$EOE/);assert.ok(table,'Native ephemeris table');
  observation.rows=table[1].trim().split(/\r?\n/).filter(Boolean).length;
  assert.equal(observation.rows,epochs.length,'All requested source rows');
  observation.sourceHeader=json.result.slice(0,json.result.indexOf('$$SOE'));
 }
}catch(error){failure={name:error.name,message:String(error.message).slice(0,1200)};}
const report={schema:'zodiacs.solar-term-reference-acquisition.v1',observedAt:new Date().toISOString(),producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},plan:{path:output+'/reference-plan.json',bytes:planBytes.length,sha256:sha(planBytes)},observations,passed:failure===null&&observations.length===4,failure,limitations:['Raw independent source acquisition only; no engine was loaded or evaluated.','PMO minute values are search centres, not second-level fixtures.','Horizons IAU76/80 apparent ecliptic frame has not been equated to the engine frame.','The programme two-second gate and standard calendar-date one-second requirement remain unvalidated.']};
retain(output+'/acquisition.json',Buffer.from(JSON.stringify(report,null,2)+'\n'));
if(!report.passed)process.exitCode=1;
