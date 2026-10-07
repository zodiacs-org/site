import {describe,it,expect,vi} from 'vitest';
import {INSTRUMENTS,searchCatalog} from './catalog';
import {sessionFor,sessionsBetween,markCorporateActions,contractUsable} from './sessions';
import {normalizeSessionCandles,validateSessionDataset} from './provider-contract';
import {calculateIndicators} from './indicators';
import {estimateRisk} from './risk';
import {emptyStore,validateStore,exportStore,importStore,createJournalEntry} from './storage';
import {collectTwelveData,discoverTwelveData} from '../../../api/_registry/lens-providers';
import {collectMarketDataset} from '../../../api/_registry/lens-handler';
import {loadMarketDataset} from './market';
const epoch=(s:string)=>Date.parse(s)/1000;
const risk={equity:10000,riskMode:'percent' as const,riskValue:1,entry:100,stop:90,feeBps:10,slippageBps:5};
describe('cross-asset catalog and planning',()=>{
 it('keeps references, proxies and futures research distinct and searches the actual selection',()=>{
  expect(searchCatalog('Nikkei','indices').map(i=>i.kind)).toEqual(['reference','etf']);
  expect(searchCatalog('SOL','crypto')[0].id).toBe('SOL-USD');
  expect(searchCatalog('','fx')).toHaveLength(11);
  expect(searchCatalog('','stocks',['XETR:SAP']).map(i=>i.id)).toEqual(['XETR:SAP']);
  for(const i of Object.values(INSTRUMENTS))expect(i.rights).toBe('pending-written-grant');
  expect(()=>estimateRisk({...risk,instrumentId:'INDEX:SPX'})).toThrow('tradable');
  expect(()=>estimateRisk({...risk,instrumentId:'CONT:GC'})).toThrow('tradable');
  expect(()=>estimateRisk({...risk,instrumentId:'XTKS:7203'})).toThrow('metadata');
 });
 it('rounds lots down and adverse prices outward while respecting costs and the cash cap',()=>{
  const r=estimateRisk({...risk,instrumentId:'XNAS:AAPL',entry:100.005,stop:99.995,feeBps:0,slippageBps:0});
  expect(r.units).toBe(99);expect(r.equityCapped).toBe(true);expect(r.funding).toBeLessThanOrEqual(10000);expect(r.stopLoss).toBeLessThanOrEqual(100);
 });
 it('uses JPY per unit and rejects implicit USD or derivative conversion',()=>{
  const r=estimateRisk({...risk,instrumentId:'FX:USD/JPY',currency:'JPY',equity:1000000,entry:150,stop:149,riskValue:1});
  expect(r.currency).toBe('JPY');expect(r.units%1000).toBe(0);expect(r.notionalUSD).toBeNaN();expect(r.stopLoss).toBeLessThanOrEqual(r.budget);
  expect(()=>estimateRisk({...risk,instrumentId:'FX:USD/JPY',currency:'USD'})).toThrow('quote currency');
  expect(()=>estimateRisk({...risk,instrumentId:'BTC-USD',funding:'derivative'})).toThrow('cash');
 });
 it('requires explicit unexpired contracts and applies multiplier and margin',()=>{
  const contract={...INSTRUMENTS['CONT:GC'],id:'TEST:GC',kind:'future' as const,expiry:'2026-12-01T00:00:00Z',roll:'no-roll',lifecycle:'active' as const};
  expect(contractUsable(contract,epoch('2026-12-01'))).toBe(false);
  expect(()=>estimateRisk(risk,contract,epoch('2026-10-01'))).toThrow('margin');
  const r=estimateRisk({...risk,entry:2000,stop:1990,equity:100000,riskValue:2,feeBps:0,slippageBps:0,funding:'derivative',marginPerContract:15000},contract,epoch('2026-10-01'));
  expect(r.units).toBe(2);expect(r.notional).toBe(400000);expect(r.stopLoss).toBe(2000);expect(r.funding).toBe(30000);
 });
});
describe('session and corporate action boundaries',()=>{
 it('excludes exchange holidays and respects half days and both DST boundaries',()=>{
  expect(sessionFor('US-equities','2026-04-03')).toBeNull();
  expect(sessionFor('US-equities','2026-07-03')).toBeNull();
  expect(sessionFor('US-equities','2026-11-27')!.close).toBe(epoch('2026-11-27T18:00:00Z'));
  expect(sessionFor('US-equities','2026-03-06')!.open).toBe(epoch('2026-03-06T14:30:00Z'));
  expect(sessionFor('US-equities','2026-03-09')!.open).toBe(epoch('2026-03-09T13:30:00Z'));
  expect(sessionFor('US-equities','2026-11-02')!.open).toBe(epoch('2026-11-02T14:30:00Z'));
  expect(()=>sessionFor('US-equities','2028-01-04')).toThrow('covers');
  expect(()=>sessionFor('XHKG','2026-10-01')).toThrow('not been verified');
 });
 it('treats FX Monday as Sunday NY17 through Monday NY17, with weekend and DST',()=>{
  const monday=sessionFor('FX-NY17','2026-03-09')!;
  expect(monday.open).toBe(epoch('2026-03-08T21:00:00Z'));expect(monday.close).toBe(epoch('2026-03-09T21:00:00Z'));
  expect(sessionFor('FX-NY17','2026-03-07')).toBeNull();
  expect(sessionFor('FX-NY17','2026-03-06')!.nextOpen).toBe(monday.open);
 });
 it('requires publication delay; rejects duplicate bars and never bridges missing sessions or splits',()=>{
  const sessions=sessionsBetween('US-equities',epoch('2026-02-02'),epoch('2026-04-01'));
  const rows=sessions.map(s=>({datetime:s.date,open:'100',high:'102',low:'99',close:'101',volume:'5'}));
  const candles=normalizeSessionCandles(rows,sessions,sessions.at(-1)!.close+299);
  expect(candles.at(-1)!.complete).toBe(false);
  expect(calculateIndicators(candles,86400).sma20.length).toBeGreaterThan(0);
  const split=markCorporateActions(candles,sessions,[{effectiveDate:sessions[25].date,ratio:2}]);
  expect(split[24].close).toBe(101);expect(split[25].adjustmentBreak).toBe(true);
  expect(calculateIndicators(split,86400).sma50).toHaveLength(0);
  expect(()=>normalizeSessionCandles([...rows,rows[0]],sessions,epoch('2026-04-01'))).toThrow('duplicate');
  const missing=candles.filter((_,i)=>i!==20);expect(calculateIndicators(missing,86400).sma50).toHaveLength(0);
 });
});
describe('migration, provider rights and source identity',()=>{
 it('migrates BTC/ETH without mutating authored records and round-trips cross-asset notes',()=>{
  const entry=createJournalEntry({instrument:'BTC-USD',eventIds:[],horizonHours:24,method:'TA only',hypothesis:'Original',plan:'Before outcome',outcome:''});
  const legacy={schema:1,rules:[],entries:[entry],seenMatches:['original']},before=JSON.stringify(legacy);
  const upgraded=validateStore(legacy);expect(upgraded.schema).toBe(3);expect(upgraded.entries[0]).toEqual(entry);expect(JSON.stringify(legacy)).toBe(before);
  const fx=createJournalEntry({...entry,instrument:'FX:EUR/USD',hypothesis:'FX plan'});
  const store={...upgraded,entries:[...upgraded.entries,fx]};expect(importStore(exportStore(store)).store).toEqual(store);
  expect(()=>validateStore({...store,schema:1})).toThrow('BTC/ETH');
  expect(()=>validateStore({...emptyStore(),catalogVersion:'future'})).toThrow('catalog');
 });
 it('makes no price request when rights, credentials, mapping or instrument coverage is absent',async()=>{
  const fetcher=vi.fn();const request={instrument:'XNAS:AAPL',interval:'1d' as const,start:epoch('2026-03-02'),end:epoch('2026-03-10')};
  await expect(collectTwelveData(request,{fetch:fetcher,env:{},now:()=>epoch('2026-03-11')*1000})).rejects.toThrow('rights');
  await expect(collectMarketDataset({...request,instrument:'INDEX:SPX'},{fetch:fetcher,now:()=>epoch('2026-03-11')*1000})).rejects.toThrow('coverage');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('bounds and identifies a licensed session response, keeps secrets in headers, and rejects wrong asset replies',async()=>{
  const request={instrument:'XNAS:AAPL',interval:'1d' as const,start:epoch('2026-03-02'),end:epoch('2026-03-10')};
  const mapping={symbol:'AAPL',exchange:'NASDAQ',currency:'USD',timeZone:'America/New_York',actionsFrom:'2026-01-01',actionsThrough:'2027-01-01',splits:[]};
  const env={MARKET_LENS_TWELVE_DATA_DISPLAY_ENABLED:'1',TWELVE_DATA_API_KEY:'TEST_ONLY_NOT_A_SECRET',MARKET_LENS_TWELVE_DATA_CONFIG:JSON.stringify({grantId:'synthetic-test-grant',validUntil:'2027-01-01',instruments:{'XNAS:AAPL':mapping}})};
  const sessions=sessionsBetween('US-equities',request.start,request.end);
  const raw={status:'ok',meta:{symbol:'AAPL',exchange:'NASDAQ',currency:'USD',exchange_timezone:'America/New_York'},values:sessions.map(s=>({datetime:s.date,open:'100',high:'102',low:'99',close:'101',volume:'5'}))};
  const fetcher=vi.fn(async()=>new Response(JSON.stringify(raw)));
  const d=await collectTwelveData(request,{fetch:fetcher,env,now:()=>epoch('2026-03-11')*1000});
  expect(validateSessionDataset(d)).toBe(true);expect(d.coverage.gaps).toHaveLength(0);
  const [url,options]=fetcher.mock.calls[0] as unknown as [URL,RequestInit];expect(url.searchParams.get('adjust')).toBe('none');expect(url.href).not.toContain(env.TWELVE_DATA_API_KEY);expect(options.headers).toMatchObject({Authorization:'apikey TEST_ONLY_NOT_A_SECRET'});
  const client=await loadMarketDataset({instrument:request.instrument,interval:'1d'},{fetch:async()=>new Response(JSON.stringify(d))});expect(client.instrument.id).toBe('XNAS:AAPL');
  await expect(loadMarketDataset({instrument:'XNAS:MSFT',interval:'1d'},{fetch:async()=>new Response(JSON.stringify(d))})).rejects.toThrow('Wrong instrument');
  expect(validateSessionDataset({...d,candles:d.candles.map(c=>({...c,complete:false}))})).toBe(false);
  raw.meta.symbol='MSFT';await expect(collectTwelveData(request,{fetch:fetcher,env,now:()=>epoch('2026-03-11')*1000})).rejects.toThrow('verified');
  await expect(collectTwelveData(request,{fetch:fetcher,env,now:()=>epoch('2027-02-01')*1000})).rejects.toThrow('entitlement');
 });
});
