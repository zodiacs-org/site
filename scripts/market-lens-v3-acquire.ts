/** Private acquisition bridge. Bundled for the minimal frozen runtime by build-market-lens-v3.mjs. */
import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectMarketDataset} from '../api/_registry/lens-handler';
import {validateProtocol, hash} from '../research/market-lens/v3/runtime.mjs';
const [manifestFile,instrumentId,output]=process.argv.slice(2);
if(!manifestFile||!instrumentId||!output)throw Error('Use: node acquire.mjs manifest.json catalog-id new-private-output.json');
const p=validateProtocol(JSON.parse(await readFile(manifestFile,'utf8'))),a=p.assets.find((a:any)=>a.id===instrumentId);
if(!a)throw Error('Instrument is not in frozen study.');
if(process.env.MARKET_LENS_V3_PRIVATE_ACQUISITION_ENABLED!=='1')throw Error('Private v3 acquisition is not enabled. Verify the frozen rights and acceptance evidence first.');
// Works from scripts/source.ts and research/market-lens/v3/acquire.mjs.
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,here.endsWith(`${path.sep}scripts`)?'..':'../../..');
await mkdir(path.dirname(path.resolve(output)),{recursive:true,mode:0o700});
const parent=await realpath(path.dirname(path.resolve(output)));if(parent===root||parent.startsWith(root+path.sep))throw Error('Raw acquisition must stay outside the public checkout.');
const now=Date.now()/1000,eligible=a.sessions.filter((s:any)=>s.close+300<=now),last=eligible.at(-1);
if(!last)throw Error('No finalized sessions.');
const start=Math.floor(eligible.slice(-60)[0].open/86400)*86400,end=Math.min(Math.ceil((last.close+1)/86400)*86400,Math.floor(now/86400)*86400+86400);
// Retain exact successful response bodies privately, before normalization; never headers/credentials.
const rawResponses:any[]=[];
const captureFetch:typeof fetch=async(input,init)=>{
 const url=new URL(String(input));if(!['api.exchange.coinbase.com','api.twelvedata.com'].includes(url.hostname)||url.protocol!=='https:')throw Error('Unexpected provider origin.');
 const response=await fetch(input,init),reader=response.body?.getReader();if(!reader)throw Error('Empty provider response.');
 const chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>400000)throw Error('Provider response exceeds limit.');chunks.push(value);}}finally{await reader.cancel();}
 const body=Buffer.concat(chunks);if(response.ok)rawResponses.push({url:url.toString(),receivedAt:Date.now()/1000,sha256:hash(body),bodyBase64:body.toString('base64')});
 return new Response(body,{status:response.status,headers:{'content-type':'application/json',...(response.headers.has('retry-after')?{'retry-after':response.headers.get('retry-after')!}:{})}});
};
const dataset=await collectMarketDataset({instrument:instrumentId,interval:'1d',start,end},{fetch:captureFetch,cache:new Map()});
if(dataset.stale||!rawResponses.length)throw Error('Stale or unreceipted data cannot enter prospective acquisition.');
if(dataset.instrument.quote!==a.currency||dataset.instrument.provider?.id!==a.provider||dataset.instrument.provider?.symbol!==a.symbol)throw Error('Provider identity differs from frozen protocol.');
const acceptedSessions=new Map(a.sessions.map((s:any)=>[s.open,s]));
const snapshot={instrument:instrumentId,provider:a.provider,symbol:a.symbol,currency:a.currency,receivedAt:Date.now()/1000,source:dataset.source,sourceDatasetHash:hash(dataset),rawResponsesHash:hash(rawResponses),candles:dataset.candles.filter(c=>c.complete&&acceptedSessions.has(c.time)&&(acceptedSessions.get(c.time) as any).close+300<=Date.now()/1000).map(({time,open,high,low,close,volume})=>({time,open,high,low,close,volume}))};
// Refuse a mismatch between frozen sessions/actions and returned feed semantics.
for(const c of dataset.candles.filter(c=>acceptedSessions.has(c.time))){const s:any=acceptedSessions.get(c.time);if((c.closeTime??c.time+86400)!==s.close||Boolean(c.adjustmentBreak)!==Boolean(s.adjustmentBreak))throw Error('Acquired session or corporate action differs from the frozen schedule.');}
const target=path.join(parent,path.basename(output));
await writeFile(target+'.dataset.json',JSON.stringify({dataset,rawResponses})+'\n',{flag:'wx',mode:0o600});
await writeFile(target,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'acquired',instrument:instrumentId,sha256:hash(snapshot),bars:snapshot.candles.length}));
