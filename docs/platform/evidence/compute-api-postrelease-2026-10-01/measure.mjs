import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [source, deployment, output, flag] = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/.test(source ?? '') || !/^dpl_[A-Za-z0-9]+$/.test(deployment ?? '') || !output || !['--plan-only', '--execute'].includes(flag)) throw Error('Expected verified source SHA, deployment ID, fresh output directory and explicit mode');
const cases = {
  chart: {utc:'2000-01-01T12:00:00Z',latitude:51.4779,longitude:-0.0015,houseSystem:'placidus'},
  positions:{instants:['2026-09-29T12:00:00Z','2026-12-31T00:00:00-05:00'],bodies:['Sun','Moon','Mercury']},
  houses:{utc:'2026-06-21T12:00:00Z',latitude:-33.8688,longitude:151.2093,houseSystem:'koch'},
  events:{from:'2026-10-01T00:00:00Z',to:'2026-11-01T00:00:00Z',bodies:['Sun','Mercury','Venus'],kinds:['ingress','station','lunation']},
  time:{local:{date:'1947-07-01',time:'12:00',zone:'Europe/Stockholm'},longitude:18.07},
  'sky-fact':{kind:'retrograde',body:'Mercury',date:'2026-10-24',zone:'America/New_York'}
};
fs.mkdirSync(output, {recursive:false});
const write = (name, value) => fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('plan.json',{source,intendedDeployment:deployment,origin:'https://zodiacs.org',fixtureSource:'docs/platform/evidence/compute-api-2026-09-29/tools/measure-production-20261001.mjs',fixtureSha256:crypto.createHash('sha256').update(JSON.stringify(cases)).digest('hex'),endpoints:Object.keys(cases),rounds:20,total:120,minimumStartSpacingMs:2200,timeoutMs:30000,retries:0,expectedEngine:'0.1.1-rc.15',node:process.version,mode:flag,startedAt:new Date().toISOString(),deploymentBinding:'Requires platform request-ID correlation; alias identity alone is not assigned to each response',temperature:'Unclassified until platform Start Type is observed',publicRecords:'No raw IPs, headers, request/response bodies or input-bearing receipt fields'});
if (flag === '--plan-only') {console.log('Prepared fixed 120-request plan; no request sent');process.exit(0);}
const endpoints=Object.keys(cases);let lastStart=-Infinity,completed=0;
try {
  for(let round=0;round<20;round++)for(let n=0;n<endpoints.length;n++) {
    const endpoint=endpoints[(n+round)%endpoints.length];
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,2200-(performance.now()-lastStart))));
    const startedAt=new Date().toISOString(),t=performance.now();lastStart=t;
    const response=await fetch(`https://zodiacs.org/api/v1/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cases[endpoint]),signal:AbortSignal.timeout(30000)});
    const headerMs=performance.now()-t,body=await response.text(),elapsedMs=performance.now()-t;
    let result;try{result=JSON.parse(body);}catch{}
    const engine=result?.receipt?.engine,requestId=response.headers.get('x-vercel-id');
    const safeRequestId=typeof requestId==='string'&&/^[A-Za-z0-9:._-]{1,256}$/.test(requestId)?requestId:null;
    const row={round,endpoint,startedAt,endedAt:new Date().toISOString(),requestId:safeRequestId,status:response.status,headerMs,elapsedMs,responseBytes:Buffer.byteLength(body),responseSha256:crypto.createHash('sha256').update(body).digest('hex'),noStore:(response.headers.get('cache-control')??'').split(',').some(x=>x.trim().toLowerCase()==='no-store'),openCors:response.headers.get('access-control-allow-origin')==='*',schema:result?.schema??null,receiptPresent:!!result?.receipt,engine:engine?{name:engine.name,version:engine.version,ephemeris:engine.ephemeris?{name:engine.ephemeris.name,version:engine.ephemeris.version}:null}:null};
    fs.appendFileSync(path.join(output,'requests.jsonl'),JSON.stringify(row)+'\n');completed++;
    console.log(JSON.stringify({round,endpoint,status:row.status,elapsedMs:Math.round(elapsedMs)}));
    if(row.status!==200||row.schema!==`zodiacs.compute-api.${endpoint}.v1`||!row.noStore||!row.openCors||!row.receiptPresent||engine?.version!=='0.1.1-rc.15'||!safeRequestId)throw Error('Unexpected status, receipt, privacy header or request identity; stopped without retry');
  }
  write('terminal.json',{status:'completed',completed,endedAt:new Date().toISOString()});
} catch(error) {
  write('terminal.json',{status:'stopped',completed,errorType:error?.name??'Error',endedAt:new Date().toISOString(),retries:0});
  console.error('Measurement stopped; inspect the sanitized terminal and completed response records');process.exitCode=1;
}
