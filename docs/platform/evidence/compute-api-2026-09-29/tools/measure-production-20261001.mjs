import fs from 'node:fs';
import crypto from 'node:crypto';
const cases = {
 chart: {utc:'2000-01-01T12:00:00Z',latitude:51.4779,longitude:-0.0015,houseSystem:'placidus'},
 positions:{instants:['2026-09-29T12:00:00Z','2026-12-31T00:00:00-05:00'],bodies:['Sun','Moon','Mercury']},
 houses:{utc:'2026-06-21T12:00:00Z',latitude:-33.8688,longitude:151.2093,houseSystem:'koch'},
 events:{from:'2026-10-01T00:00:00Z',to:'2026-11-01T00:00:00Z',bodies:['Sun','Mercury','Venus'],kinds:['ingress','station','lunation']},
 time:{local:{date:'1947-07-01',time:'12:00',zone:'Europe/Stockholm'},longitude:18.07},
 'sky-fact':{kind:'retrograde',body:'Mercury',date:'2026-10-24',zone:'America/New_York'}
};
const dir = 'measurements/production-2026-10-01'; fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(`${dir}/plan.json`,JSON.stringify({source:'9cfafa3e742de943062c9174338472781724a4b5',deployment:'dpl_6uGzGxdgxboMZ5jeFwQMTL24demr',origin:'https://zodiacs.org',endpointCases:cases,rounds:20,sample:'Sequential identical documented synthetic examples, rotating endpoint order by round; minimum 2200ms between starts; no claimed cold/warm classification without platform telemetry; client wall latency includes cloud egress/network and response body; nearest-rank percentiles; stop on any unexpected non-200 or response schema/backend mismatch. No actual birth data.',clientNode:process.version,started:new Date().toISOString()},null,2));
const endpoints=Object.keys(cases); let lastStart=0;
for(let round=0;round<20;round++) {
 for(let n=0;n<6;n++) {
  const endpoint=endpoints[(n+round)%6];
  await new Promise(r=>setTimeout(r,Math.max(0,2200-(performance.now()-lastStart))));
  const t=performance.now();lastStart=t;
  const res=await fetch(`https://zodiacs.org/api/v1/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cases[endpoint]),signal:AbortSignal.timeout(30000)});
  const headerMs=performance.now()-t;const body=await res.text();const elapsedMs=performance.now()-t;
  let json;try{json=JSON.parse(body)}catch{}
  const row={round,endpoint,clientAt:new Date().toISOString(),httpDate:res.headers.get('date'),status:res.status,headerMs,elapsedMs,bytes:Buffer.byteLength(body),headers:Object.fromEntries(res.headers),schema:json?.schema,receipt:json?.receipt,bodySha256:crypto.createHash('sha256').update(body).digest('hex')};
  fs.appendFileSync(`${dir}/requests.jsonl`,JSON.stringify(row)+'\n');
  if(round===0)fs.writeFileSync(`${dir}/${endpoint}.json`,body+'\n');
  console.log(JSON.stringify({round,endpoint,status:res.status,elapsedMs:Math.round(elapsedMs),httpDate:row.httpDate}));
  if(res.status!==200||json?.schema!==`zodiacs.compute-api.${endpoint}.v1`||!json?.receipt)throw new Error('Unexpected response; probe stopped');
 }
}
console.log('Finished 120 requests');
