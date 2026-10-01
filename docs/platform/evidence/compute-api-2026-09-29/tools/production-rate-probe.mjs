import fs from 'node:fs';
const dir='measurements/production-2026-10-01';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
while(true){const rows=fs.readFileSync(`${dir}/requests.jsonl`,'utf8').trim().split('\n').map(JSON.parse);if(rows.some(r=>r.status!==200))throw new Error('Latency probe failed; no rate test');if(rows.length===120)break;await sleep(1000)}
fs.writeFileSync(`${dir}/rate-plan.json`,JSON.stringify({method:'POST invalid empty JSON body, so allowed requests return400 before any astronomical compute. Sequential bounded rate-refusal checks, no retries or client/address changes. Wait65 seconds after prior traffic and between probes. Stop each probe at first429; hard maximum11 events and41 time requests. Expected Retry-After60; no claim exact rule count if shared client traffic affects count.'},null,2));
for(const [endpoint,max] of [['events',11],['time',41]]){
 await sleep(65000);let found=false;
 for(let index=0;index<max;index++){
  const start=performance.now(); const res=await fetch(`https://zodiacs.org/api/v1/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});const body=await res.text();
  const row={endpoint,index:index+1,status:res.status,elapsedMs:performance.now()-start,httpDate:res.headers.get('date'),headers:Object.fromEntries(res.headers),body};
  fs.appendFileSync(`${dir}/rate-requests.jsonl`,JSON.stringify(row)+'\n'); console.log(JSON.stringify({endpoint,index:index+1,status:res.status,retryAfter:res.headers.get('retry-after')}));
  if(res.status===429){if(res.headers.get('retry-after')!=='60')throw new Error('Unexpected Retry-After');found=true;break}
  if(res.status!==400)throw new Error('Unexpected rate-probe result')
 }
 if(!found){console.log(`INCONCLUSIVE ${endpoint}: bounded probe got no429, no further traffic`);break}
}
