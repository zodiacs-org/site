import type { Candle, Instrument } from './types';

export interface TradingSession { date: string; open: number; close: number; nextOpen: number }
/** Calendar snapshot: NYSE core hours, reviewed 2026-10-06. Outside coverage fails closed. */
export const CALENDAR_SOURCE = 'https://www.nyse.com/trade/hours-calendars';
const holidays = new Set(['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25','2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24']);
const halfDays = new Set(['2026-11-27','2026-12-24','2027-11-26']);
export function localInstant(date: string, hour: number, minute: number, zone: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw Error('Invalid session date.');
  const target=Date.parse(`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`);
  let candidate=target;
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for(let i=0;i<3;i++) {
    const parts=Object.fromEntries(fmt.formatToParts(candidate).map(p=>[p.type,p.value]));
    const represented=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    if(represented===target) return candidate/1000;
    candidate+=target-represented;
  }
  throw Error('Ambiguous or nonexistent local session time.');
}
export const addDate = (date:string, days:number) => new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10);
function sessionBounds(calendar:string,date:string): {open:number;close:number}|null {
  const day=new Date(date).getUTCDay();
  if(calendar==='24x7') return {open:Date.parse(date)/1000,close:Date.parse(addDate(date,1))/1000};
  if(calendar==='US-equities') {
    if(date<'2026-01-01'||date>'2027-12-31') throw Error('Verified equity calendar covers 2026–2027 only.');
    if(day===0||day===6||holidays.has(date)) return null;
    return {open:localInstant(date,9,30,'America/New_York'),close:localInstant(date,halfDays.has(date)?13:16,0,'America/New_York')};
  }
  if(calendar==='FX-NY17') {
    // Close-date convention: Monday's session opens Sunday at 17:00 New York.
    // Feed-specific holidays must be supplied before a provider mapping is enabled.
    if(day===0||day===6) return null;
    return {open:localInstant(addDate(date,-1),17,0,'America/New_York'),close:localInstant(date,17,0,'America/New_York')};
  }
  throw Error('This exchange calendar has not been verified.');
}
export function sessionFor(calendar:string,date:string): TradingSession|null {
  const current=sessionBounds(calendar,date); if(!current) return null;
  for(let offset=1;offset<12;offset++) {
    const next=sessionBounds(calendar,addDate(date,offset));
    if(next) return {date,...current,nextOpen:next.open};
  }
  throw Error('Next session is unavailable.');
}
export function sessionsBetween(calendar:string,start:number,end:number): TradingSession[] {
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>902*86400) throw Error('Session range is invalid.');
  const result:TradingSession[]=[];
  for(let date=new Date((start-86400)*1000).toISOString().slice(0,10);Date.parse(date)/1000<end+86400;date=addDate(date,1)) {
    // Bound padding at verified coverage; the actual query cannot be silently truncated.
    if(calendar==='US-equities' && (date<'2026-01-01'||date>'2027-12-31')) continue;
    const s=sessionFor(calendar,date); if(s && s.open>=start && s.open<end) result.push(s);
  }
  if(calendar==='US-equities' && (start<Date.parse('2026-01-01')/1000 || end>Date.parse('2027-12-24')/1000)) throw Error('Requested range exceeds complete verified calendar coverage.');
  return result;
}
export interface Split { effectiveDate:string; ratio:number }
/** Unadjusted prices remain executable; reset features at each split. No future restatement. */
export function markCorporateActions(candles:Candle[], sessions:TradingSession[], splits:Split[]): Candle[] {
  const dates=new Map(sessions.map(s=>[s.date,s.open])); const breaks=new Set<number>();
  for(const split of splits) {
    if(!Number.isFinite(split.ratio)||split.ratio<=0||!dates.has(split.effectiveDate)) throw Error('Corporate action is outside verified sessions.');
    breaks.add(dates.get(split.effectiveDate)!);
  }
  return candles.map(c=>({...c,...(breaks.has(c.time)?{adjustmentBreak:true}:{})}));
}
export function contractUsable(instrument:Instrument, at:number): boolean {
  return instrument.kind==='future' && !!instrument.expiry && Number.isFinite(Date.parse(instrument.expiry)) && at<Date.parse(instrument.expiry)/1000 && instrument.roll==='no-roll';
}
export const consecutive = (previous:Candle,current:Candle,seconds:number):boolean => !current.adjustmentBreak && current.time===(previous.nextTime??previous.time+seconds);
