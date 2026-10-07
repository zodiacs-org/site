import type { AssetClass, Instrument } from './types';

export const CATALOG_VERSION = '2026-10-06.1';
export const ASSET_CLASSES: AssetClass[] = ['crypto', 'stocks', 'indices', 'fx', 'commodities'];
export const LIQUIDITY_RULE = 'Before activation: dated benchmark membership and 60 completed sessions; median daily traded value ≥ USD 20m equivalent, ≥95% session coverage; FX/crypto venue-specific notional ≥ USD 50m. No eligibility claim without the measured snapshot.';
const source = 'https://www.msci.com/indexes/index-resources/index-methodology';
function item(id: string, name: string, assetClass: AssetClass, symbol: string, quote: string, venue: string, calendar: string, timeZone: string, kind: Instrument['kind'], url: string, extra: Partial<Instrument> = {}): Instrument {
  return { id, name, symbol, base: symbol, quote, venue, calendar, timeZone, kind, sourceUrl: url, catalogVersion: CATALOG_VERSION,
    tickSize: 0.01, lotSize: 1, multiplier: 1, provider: { id: 'twelve-data', symbol, exchange: venue, coverage: 'mapping-pending' },
    eligibility: { asOf: '2026-10-06', source, benchmark: 'Candidate universe; membership and liquidity must be verified', status: 'candidate', liquidity: LIQUIDITY_RULE },
    lifecycle: 'candidate', rights: 'pending-written-grant', freshnessSeconds: 900, assetClass, ...extra };
}
const crypto = ['BTC', 'ETH', 'SOL', 'XRP'].map(symbol => item(`${symbol}-USD`, ({BTC:'Bitcoin', ETH:'Ethereum', SOL:'Solana', XRP:'XRP'})[symbol]!, 'crypto', symbol, 'USD', 'Coinbase Exchange', '24x7', 'UTC', 'spot', `https://exchange.coinbase.com/trade/${symbol}-USD`, {
  base: symbol, lotSize: symbol === 'BTC' ? 1e-8 : 1e-6, tickSize: symbol === 'XRP' ? 0.0001 : 0.01,
  provider: {id:'coinbase',symbol:`${symbol}-USD`,coverage:'adapter'}, lifecycle:'active',
}));
const stocks = [
  ['XNAS:AAPL','Apple','AAPL','USD','NASDAQ','US-equities','America/New_York','S&P 500'],
  ['XNAS:MSFT','Microsoft','MSFT','USD','NASDAQ','US-equities','America/New_York','S&P 500'],
  ['XNAS:NVDA','NVIDIA','NVDA','USD','NASDAQ','US-equities','America/New_York','S&P 500'],
  ['XNYS:JPM','JPMorgan Chase','JPM','USD','NYSE','US-equities','America/New_York','S&P 500'],
  ['XETR:SAP','SAP','SAP','EUR','XETRA','XETR','Europe/Berlin','DAX'],
  ['XLON:AZN','AstraZeneca','AZN','GBX','LSE','XLON','Europe/London','FTSE 100'],
  ['XPAR:MC','LVMH','MC','EUR','Euronext Paris','XPAR','Europe/Paris','CAC 40'],
  ['XTKS:7203','Toyota Motor','7203','JPY','JPX','XTKS','Asia/Tokyo','Nikkei 225'],
  ['XHKG:0700','Tencent','0700','HKD','HKEX','XHKG','Asia/Hong_Kong','Hang Seng'],
  ['XASX:BHP','BHP Group','BHP','AUD','ASX','XASX','Australia/Sydney','ASX 200'],
].map(([id,name,symbol,quote,venue,calendar,zone,benchmark]) => item(id,name,'stocks',symbol,quote,venue,calendar,zone,'stock',source, {
  eligibility:{asOf:'2026-10-06',source,benchmark,status:'candidate',liquidity:LIQUIDITY_RULE},
  // Variable tick tables and overseas board lots require provider discovery.
  ...(calendar !== 'US-equities' ? {tickSize:undefined,lotSize:undefined} : {}),
}));
const indexRows = [
  ['SPX','S&P 500','USD','SPY','NYSE','US-equities','America/New_York'],
  ['NDX','Nasdaq-100','USD','QQQ','NASDAQ','US-equities','America/New_York'],
  ['DJI','Dow Jones Industrial Average','USD','DIA','NYSE','US-equities','America/New_York'],
  ['DAX','DAX','EUR','EXS1','XETRA','XETR','Europe/Berlin'],
  ['UKX','FTSE 100','GBP','ISF','LSE','XLON','Europe/London'],
  ['N225','Nikkei 225','JPY','1321','JPX','XTKS','Asia/Tokyo'],
  ['HSI','Hang Seng','HKD','2800','HKEX','XHKG','Asia/Hong_Kong'],
  ['AS51','ASX 200','AUD','STW','ASX','XASX','Australia/Sydney'],
];
const indices = indexRows.flatMap(([symbol,name,quote,etf,venue,calendar,zone]) => [
  item(`INDEX:${symbol}`,`${name} reference`,'indices',symbol,quote,'Index administrator',calendar,zone,'reference',source,{provider:{id:'none',symbol,coverage:'unsupported'},tickSize:undefined,lotSize:undefined}),
  item(`ETF:${venue}:${etf}`,`${etf} · ${name} exposure`,'indices',etf,symbol==='UKX'?'GBX':quote,venue,calendar,zone,'etf',source,{proxyFor:`INDEX:${symbol}`, ...(calendar !== 'US-equities' ? {tickSize:undefined,lotSize:undefined} : {})}),
]);
const fx = ['EUR/USD','GBP/USD','USD/JPY','USD/CHF','AUD/USD','USD/CAD','NZD/USD','EUR/GBP','EUR/JPY','GBP/JPY','AUD/JPY'].map(pair => item(`FX:${pair}`,pair,'fx',pair,pair.slice(4),'OTC composite','FX-NY17','America/New_York','spot','https://twelvedata.com/forex',{
  base:pair.slice(0,3),tickSize:pair.endsWith('JPY')?0.001:0.00001,lotSize:1000,provider:{id:'twelve-data',symbol:pair,coverage:'mapping-pending'},
}));
const commodities = [
  ['GLD','Gold','https://www.spdrgoldshares.com/'], ['SLV','Silver','https://www.ishares.com/us/products/239855/ishares-silver-trust-fund'],
  ['USO','WTI crude oil','https://www.uscfinvestments.com/uso'], ['BNO','Brent crude oil','https://www.uscfinvestments.com/bno'],
  ['UNG','Natural gas','https://www.uscfinvestments.com/ung'], ['CPER','Copper','https://www.uscfinvestments.com/cper'],
].map(([symbol,name,url]) => item(`ETF:NYSE:${symbol}`,`${name} · ${symbol} proxy`,'commodities',symbol,'USD','NYSE','US-equities','America/New_York','etf',url,{proxyFor:name,roll:'Fund-managed exposure; fund price is not commodity spot or a futures settlement.'}));
const futures = [ ['GC','Gold',100,0.1],['SI','Silver',5000,0.005],['CL','WTI crude oil',1000,0.01],['NG','Natural gas',10000,0.001],['HG','Copper',25000,0.0005] ] as const;
const researchSeries = futures.map(([symbol,name,multiplier,tickSize]) => item(`CONT:${symbol}`,`${name} continuous research series`,'commodities',`${symbol}.c.0`,'USD','CME','CME-contract','America/Chicago','continuous','https://databento.com/docs/standards-and-conventions/symbology',{
  multiplier,tickSize,provider:{id:'databento',symbol:`${symbol}.c.0`,coverage:'unsupported'},roll:'Calendar-ranked unadjusted series. Not tradable. Select and verify an individual expiry before sizing or research activation.',
}));
export const INSTRUMENTS: Record<string, Instrument> = Object.fromEntries([...crypto,...stocks,...indices,...fx,...commodities,...researchSeries].map(row=>[row.id,row]));
export const isInstrumentId = (id: unknown): id is string => typeof id === 'string' && Object.hasOwn(INSTRUMENTS,id);
export function searchCatalog(query: string, assetClass?: AssetClass, favorites?: readonly string[]): Instrument[] {
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return Object.values(INSTRUMENTS).filter(i=>(!assetClass || i.assetClass===assetClass) && (!favorites || favorites.includes(i.id)) && words.every(w=>`${i.id} ${i.name} ${i.symbol} ${i.venue} ${i.proxyFor??''}`.toLocaleLowerCase().includes(w)));
}
export function instrumentAvailability(i: Instrument): string {
  if (i.kind==='reference') return 'Reference index; not a tradable instrument. Choose an explicitly identified ETF for planning.';
  if (i.kind==='continuous') return 'Research series only. Individual contract discovery, expiry and roll verification are required.';
  if (i.calendar!=='24x7' && i.calendar!=='US-equities') return 'Planning available. Verified provider mapping, session calendar and display rights are pending.';
  return i.provider?.id==='coinbase' ? 'Price display awaits written provider permission. Manual planning and calendars remain available.' : 'Planning available. Provider mapping, corporate actions and written display rights are pending.';
}
