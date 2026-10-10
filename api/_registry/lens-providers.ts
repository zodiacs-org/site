/** Server-only credentials and entitlements. Never import this module into a browser island. */
import { INSTRUMENTS } from '../../src/exchange/lens/catalog.js';
import { sessionsBetween, type TradingSession, type Split } from '../../src/exchange/lens/sessions.js';
import { normalizeSessionCandles, validateSessions, type SessionDataset } from '../../src/exchange/lens/provider-contract.js';
import { MarketDataError, type MarketRequest } from '../../src/exchange/lens/market.js';
export interface ProviderMapping { symbol:string; exchange:string; currency:string; timeZone:string; actionsFrom:string; actionsThrough:string; splits:Split[]; sessions?:TradingSession[] }
export interface ProviderGrant { grantId:string; validUntil:string; instruments:Record<string,ProviderMapping> }
export interface ProviderOptions {fetch?:typeof fetch;now?:()=>number;env?:Record<string,string|undefined>}
const caches=new Map<string,{at:number;dataset:SessionDataset}>();
async function json(url:URL,key:string,fetcher:typeof fetch):Promise<any> {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
  try {
    const r=await fetcher(url,{headers:{Authorization:`apikey ${key}`,Accept:'application/json'},redirect:'error',signal:controller.signal});
    if(!r.ok) throw Error('Provider request failed.');
    // Read bounded chunks; never retain/log an unbounded vendor error or credential-bearing URL.
    const reader=r.body?.getReader(); if(!reader) throw Error('Empty response.');
    let size=0;const chunks:Uint8Array[]=[];
    try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>400000)throw Error('Response exceeds limit.');chunks.push(value);}}
    finally{await reader.cancel();}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {clearTimeout(timer);}
}
export function configuredGrant(request:MarketRequest,env:Record<string,string|undefined>,now:number):{grant:ProviderGrant;mapping:ProviderMapping} {
  if(env.MARKET_LENS_TWELVE_DATA_DISPLAY_ENABLED!=='1'||!env.TWELVE_DATA_API_KEY) throw new MarketDataError('unavailable','Twelve Data display rights and secure credentials are not configured.');
  let grant:ProviderGrant;try{grant=JSON.parse(env.MARKET_LENS_TWELVE_DATA_CONFIG??'');}catch{throw new MarketDataError('unavailable','A verified provider entitlement is required.');}
  const i=INSTRUMENTS[request.instrument],mapping=grant.instruments?.[request.instrument];
  if(!grant.grantId?.trim()||!Number.isFinite(Date.parse(grant.validUntil))||Date.parse(grant.validUntil)<=now||!mapping||mapping.symbol!==i.provider?.symbol||mapping.currency!==i.quote||mapping.timeZone!==i.timeZone||typeof mapping.exchange!=='string'||!mapping.exchange||!Array.isArray(mapping.splits)||request.interval!=='1d') throw new MarketDataError('unavailable','This instrument, interval or entitlement is unavailable.');
  if(Date.parse(mapping.actionsFrom)/1000>request.start||Date.parse(mapping.actionsThrough)/1000<request.end||!Number.isFinite(Date.parse(mapping.actionsFrom))||!Number.isFinite(Date.parse(mapping.actionsThrough))) throw new MarketDataError('unavailable','Verified corporate-action coverage is unavailable for this range.');
  return {grant,mapping};
}
/** Bounded daily adapter. Operator-reviewed discovery and entitlement precede all price requests. */
export async function collectTwelveData(request:MarketRequest,options:ProviderOptions={}):Promise<SessionDataset> {
  const env=options.env??process.env,now=(options.now??Date.now)(),i=INSTRUMENTS[request.instrument];
  const {grant,mapping}=configuredGrant(request,env,now);
  let sessions=mapping.sessions?.filter(s=>s.open>=request.start&&s.open<request.end)??sessionsBetween(i.calendar!,request.start,request.end);
  validateSessions(sessions,request.start,request.end);
  if(i.calendar==='US-equities' && JSON.stringify(sessions)!==JSON.stringify(sessionsBetween(i.calendar,request.start,request.end))) throw Error('Approved schedule differs from core sessions.');
  if(!sessions.length)throw new MarketDataError('unavailable','No verified sessions in this range.');
  const cacheKey=JSON.stringify([request,grant]);const cached=caches.get(cacheKey);
  if(!options.fetch && cached && now>=cached.at&&now-cached.at<60000) return cached.dataset;
  const url=new URL('https://api.twelvedata.com/time_series');
  url.search=new URLSearchParams({symbol:mapping.symbol,exchange:mapping.exchange,interval:'1day',start_date:sessions[0].date,end_date:sessions.at(-1)!.date,outputsize:'900',order:'asc',adjust:'none',prepost:'false',timezone:'Exchange'}).toString();
  try {
    const raw=await json(url,env.TWELVE_DATA_API_KEY!,options.fetch??fetch);
    if(raw.status!=='ok'||raw.meta?.symbol!==mapping.symbol||raw.meta?.currency!==mapping.currency||raw.meta?.exchange!==mapping.exchange||raw.meta?.exchange_timezone!==mapping.timeZone) throw Error('Provider identity differs from approved discovery.');
    const candles=normalizeSessionCandles(raw.values,sessions,now/1000,mapping.splits.filter(s=>sessions.some(session=>session.date===s.effectiveDate)));
    if(!candles.length)throw Error('No validated candles.');
    const times=new Set(candles.map(c=>c.time)),gaps=sessions.filter(s=>!times.has(s.open)).map(s=>s.open);
    const dataset:SessionDataset={schema:2,instrument:i,interval:'1d',sessions,adjustment:'unadjusted-reset-at-split',attribution:'Twelve Data',source:'https://api.twelvedata.com/time_series',fetchedAt:new Date(now).toISOString(),stale:now/1000-sessions.filter(s=>s.close+300<=now/1000).at(-1)!.close>4*86400,candles,coverage:{requestedStart:request.start,requestedEnd:request.end,start:candles[0].time,end:candles.at(-1)!.time,gaps},warnings:['Twelve Data · unadjusted regular-session prices; features restart at declared splits. Volume is reported by the feed (FX volume may be unavailable).',...(gaps.length?[`${gaps.length} expected sessions missing; no prices were filled in.`]:[])]};
    if(!options.fetch){if(caches.size>=100)caches.delete(caches.keys().next().value!);caches.set(cacheKey,{at:now,dataset});}
    return dataset;
  } catch {throw new MarketDataError('unavailable','This provider could not return verified session prices. No substitute feed was used.');}
}
/** Discovery is server-side and read-only; no browser-supplied provider URLs/symbols. */
export async function discoverTwelveData(instrumentId:string,options:ProviderOptions={}):Promise<unknown> {
  const i=INSTRUMENTS[instrumentId],env=options.env??process.env;
  if(!i||i.provider?.id!=='twelve-data'||!env.TWELVE_DATA_API_KEY)throw Error('Catalog mapping or discovery credentials unavailable.');
  const url=new URL('https://api.twelvedata.com/symbol_search');url.searchParams.set('symbol',i.provider.symbol);url.searchParams.set('outputsize','30');
  const result=await json(url,env.TWELVE_DATA_API_KEY,options.fetch??fetch);
  if(!Array.isArray(result.data)||result.data.length>30)throw Error('Invalid discovery response.');
  return result.data.filter((r:any)=>r.symbol===i.provider!.symbol).map((r:any)=>({symbol:r.symbol,exchange:r.exchange,mic:r.mic_code,currency:r.currency,country:r.country,instrumentType:r.instrument_type}));
}
