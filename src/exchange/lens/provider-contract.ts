import type { Candle, MarketDataset } from './types';
import { sessionsBetween, markCorporateActions, type TradingSession, type Split } from './sessions.js';
import { INSTRUMENTS } from './catalog.js';

export interface SessionDataset extends Omit<MarketDataset,'schema'> {
  schema: 2;
  sessions: TradingSession[];
  adjustment: 'unadjusted-reset-at-split';
  attribution: string;
}
export function validateSessions(rows:TradingSession[],start:number,end:number):void {
  if(!Array.isArray(rows)||rows.length>900) throw Error('Session coverage is invalid.');
  const dates=new Set<string>();
  for(const [index,s] of rows.entries()) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||dates.has(s.date)||![s.open,s.close,s.nextOpen].every(Number.isSafeInteger)||s.open<start||s.open>=end||s.close<=s.open||s.close-s.open>86400||s.nextOpen<s.close||s.nextOpen<=s.open||s.nextOpen-s.close>12*86400||index>0&&rows[index-1].nextOpen!==s.open) throw Error('Session schedule is inconsistent.');
    dates.add(s.date);
  }
}
export function normalizeSessionCandles(rows:unknown, sessions:TradingSession[], now:number, splits:Split[]=[]):Candle[] {
  if(!Array.isArray(rows)||rows.length>900) throw Error('Invalid candle response.');
  const schedule=new Map(sessions.map(s=>[s.date,s])); const candles=new Map<number,Candle>();
  for(const row of rows) {
    if(!row||typeof row!=='object'||typeof row.datetime!=='string') throw Error('Invalid provider bar.');
    const s=schedule.get(row.datetime); if(!s) throw Error('Provider returned an unexpected session date.');
    const nums=['open','high','low','close','volume'].map(key=>key==='volume'&&row[key]===undefined?0:typeof row[key]==='string'&&/^\d+(\.\d+)?$/.test(row[key])?Number(row[key]):NaN);
    const [open,high,low,close,volume]=nums;
    if(!nums.every(Number.isFinite)||Math.min(open,high,low,close)<=0||volume<0||low>Math.min(open,close)||high<Math.max(open,close)||candles.has(s.open)) throw Error('Malformed or duplicate session price.');
    candles.set(s.open,{time:s.open,open,high,low,close,volume,complete:s.close+300<=now,closeTime:s.close,nextTime:s.nextOpen});
  }
  return markCorporateActions([...candles.values()].sort((a,b)=>a.time-b.time),sessions,splits);
}
export function validateSessionDataset(value:unknown):value is SessionDataset {
  try {
    const d=value as SessionDataset; const i=INSTRUMENTS[d.instrument.id];
    if(d.schema!==2||!i||i.provider?.id!=='twelve-data'||d.interval!=='1d'||d.adjustment!=='unadjusted-reset-at-split'||d.source!=='https://api.twelvedata.com/time_series'||d.attribution!=='Twelve Data'||!Array.isArray(d.warnings)||d.warnings.some(w=>typeof w!=='string')||typeof d.stale!=='boolean') return false;
    const start=d.coverage.requestedStart,end=d.coverage.requestedEnd,now=Date.parse(d.fetchedAt)/1000;
    if(!Number.isFinite(now)||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||end-start>900*86400||end>Math.floor(now/86400)*86400+86400) return false;
    validateSessions(d.sessions,start,end);
    if(i.calendar==='US-equities' && JSON.stringify(sessionsBetween(i.calendar,start,end))!==JSON.stringify(d.sessions)) return false;
    const schedule=new Map(d.sessions.map(s=>[s.open,s])); let previous=-Infinity;
    if(!d.candles.length||d.candles.length>900) return false;
    for(const bar of d.candles) {
      const s=schedule.get(bar.time);
      if(!s||bar.time<=previous||bar.closeTime!==s.close||bar.nextTime!==s.nextOpen||bar.complete!==(s.close+300<=now)||bar.adjustmentBreak!==undefined&&typeof bar.adjustmentBreak!=='boolean'||![bar.open,bar.high,bar.low,bar.close,bar.volume].every(Number.isFinite)||Math.min(bar.open,bar.high,bar.low,bar.close)<=0||bar.volume<0||bar.low>Math.min(bar.open,bar.close)||bar.high<Math.max(bar.open,bar.close)) return false;
      previous=bar.time;
    }
    const times=new Set(d.candles.map(c=>c.time)),gaps=d.sessions.filter(s=>!times.has(s.open)).map(s=>s.open);
    return d.coverage.start===d.candles[0].time && d.coverage.end===d.candles.at(-1)!.time && JSON.stringify(gaps)===JSON.stringify(d.coverage.gaps);
  } catch {return false;}
}
