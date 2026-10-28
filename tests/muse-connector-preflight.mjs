/** Direct read-only MCP preflight. This cannot verify Muse routing, permissions or card rendering. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
const args=process.argv.slice(2);
assert.ok(args.includes('--out'), 'Use --out <local receipt folder>.');
const root=args[args.indexOf('--out')+1];
assert.ok(root && !root.startsWith('--'), 'Output folder is required.');
await mkdir(root,{recursive:true});
const fixture=JSON.parse(await readFile(new URL('../src/ai-tools/accounts/flag-off.fixture.json',import.meta.url),'utf8'));
const baseline=JSON.parse(fixture.occasions.toolsList.text.split('\n').find(line=>line.startsWith('data: ')).slice(6)).result;
const origin='https://zodiacs.org';
const report={checkedAt:new Date().toISOString(),source:origin+'/mcp',scope:'Generic MCP preflight, not a Muse host result',clientCapabilities:{},museHost:{status:'not-run',toolSelection:'unverified',cards:'unverified',investmentRefusal:'unverified'},checks:[],tools:[],resources:[],rateLimitWaits:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const ajv=new Ajv({strict:false,allErrors:true}); formats(ajv);
const digest=x=>createHash('sha256').update(x).digest('hex');
const canonical=x=>JSON.stringify(x,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
let id=0,session;
async function rpc(method,params={},notification=false){
 await delay(5000);
 const headers={'content-type':'application/json',accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'};
 if(session)headers['mcp-session-id']=session;
 let res;
 for (let attempt=0; attempt<3; attempt++) {
  res=await fetch(origin+'/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...(notification?{}:{id:++id}),method,params}),signal:AbortSignal.timeout(60000)});
  if (res.status!==429 || attempt===2) break;
  const seconds=Number(res.headers.get('retry-after'));
  assert.ok(Number.isFinite(seconds)&&seconds>0&&seconds<=300,'Honor a bounded server Retry-After');
  await res.arrayBuffer(); report.rateLimitWaits.push({method,seconds});
  console.log(`Server request budget reached; respecting Retry-After ${seconds}s.`);
  await delay(seconds*1000);
 }
 assert.ok(res.ok,`${method}: HTTP ${res.status}`); session=res.headers.get('mcp-session-id')??session;
 const text=await res.text(); if(notification)return {status:res.status};
 const data=text.split('\n').filter(l=>l.startsWith('data: ')).map(l=>l.slice(6));
 const reply=JSON.parse(data.at(-1)??text); assert.equal(reply.error,undefined,`${method}: JSON-RPC error`);
 return reply.result;
}
try{
 const health=await fetch(origin+'/mcp/health').then(r=>r.json());assert.equal(health.version,'0.5.1');
 const init=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'zodiacs-connector-preflight',version:'1.0.0'}});
 assert.equal(init.serverInfo.version,'0.5.1'); report.initialize=init;
 report.initializedNotification=await rpc('notifications/initialized',{},true);
 const listing=await rpc('tools/list'); await writeFile(root+'/tools.json',JSON.stringify(listing,null,2)+'\n');
 const contract=t=>t.map(({name,inputSchema})=>({name,inputSchema})).sort((a,b)=>a.name.localeCompare(b.name));
 assert.equal(listing.tools.length,13);assert.equal(canonical(contract(listing.tools)),canonical(contract(baseline.tools)));
 report.checks.push('health and initialize version 0.5.1','all 13 tool names and input schemas match release baseline');
 const cases={get_capabilities:{},get_sky:{instant:'2026-10-28T12:00:00Z',zone:'Asia/Bangkok',bodies:['Sun','Moon','Mercury']},get_upcoming_events:{from:'2026-10-28T00:00:00Z',to:'2026-11-04T00:00:00Z',zone:'Asia/Bangkok',kinds:['lunation']},check_sky_fact:{kind:'retrograde',body:'Mercury',instant:'2026-10-28T12:00:00Z'},get_horoscope:{sign:'leo',zone:'Asia/Bangkok'},open_chart_studio:{},get_occasion_sky:{occasion:'wedding',date:'2027-06-12',time:'17:00',zone:'Europe/Rome',latitude:43.7696,longitude:11.2558,place:'Florence, Italy'},get_life_milestones:{birthDate:'1997-03-15'},get_compatibility:{a:{birthDate:'1990-05-03',time:'08:30',zone:'Europe/Madrid',latitude:40.4168,longitude:-3.7038,place:'Madrid, Spain'},b:{birthDate:'1992-08-10'}},find_chart_twins:{birthDate:'1990-05-03'},get_famous_chart:{name:'Frida Kahlo'},get_birthday:{birthDate:'1990-05-03'},get_sky_calendar:{language:'en'}};
 for(const tool of listing.tools){
  assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.annotations.destructiveHint,false);
  const input=cases[tool.name];assert.ok(input,tool.name);assert.ok(ajv.validate(tool.inputSchema,input),JSON.stringify(ajv.errors));
  const result=await rpc('tools/call',{name:tool.name,arguments:input});
  assert.equal(result.isError,false,tool.name);assert.equal(result.structuredContent.ok,true,tool.name);
  assert.ok(ajv.validate(tool.outputSchema,result.structuredContent),`${tool.name}: ${JSON.stringify(ajv.errors)}`);
  assert.ok(result.content.some(c=>c.type==='text'&&c.text.trim().length>0),tool.name+' text result');
  await writeFile(root+'/'+tool.name+'.json',JSON.stringify(result,null,2)+'\n');
  report.tools.push({name:tool.name,input,readOnly:true,outputSchemaValid:true,textFallbackPresent:true,resourceUri:tool._meta?.ui?.resourceUri??null});
  console.log('PASS '+tool.name);
 }
 const listed=await rpc('resources/list');
 for(const uri of [...new Set(listing.tools.map(t=>t._meta?.ui?.resourceUri).filter(Boolean))]){
  assert.ok(listed.resources.some(r=>r.uri===uri),uri);
  const panel=(await rpc('resources/read',{uri})).contents[0];
  assert.ok(panel.text.toLowerCase().startsWith('<!doctype html>'));assert.ok(Buffer.byteLength(JSON.stringify(panel.text)) < (uri.includes('chart-studio-') ? 2_000_000 : 600_000), 'Existing repository panel budget');
  const file=uri.split('/').at(-1);await writeFile(root+'/'+file,panel.text);
  report.resources.push({uri,mimeType:panel.mimeType,bytes:Buffer.byteLength(panel.text),sha256:digest(panel.text),htmlAvailable:true,museRendering:'unverified'});
 }
 const bad=await rpc('tools/call',{name:'get_sky',arguments:{unrecognizedTestField:'synthetic-canary'}});
 assert.equal(bad.isError,true);assert.ok(bad.content.some(c=>c.type==='text'&&c.text.length>0));assert.ok(!JSON.stringify(bad).includes('synthetic-canary'));
 report.checks.push('all tools declare read-only, non-destructive access','all synthetic tool calls satisfy published output schemas and have text content','4 existing card resources satisfy their repository budgets (Studio 2 MB, other panels 600 KB)','invalid input refused without echoing canary');
 report.preflight='passed';
}catch(error){report.preflight='failed';report.failure=String(error.stack??error);console.error(report.failure);process.exitCode=1;}
await writeFile(root+'/preflight.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({preflight:report.preflight,tools:report.tools.length,resources:report.resources.length,museHost:report.museHost}));
