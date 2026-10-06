import type { Instrument, SetupPlan } from './types';
import { INSTRUMENTS } from './catalog';
import { contractUsable } from './sessions';
export type RiskInput = SetupPlan['risk'];
export interface RiskEstimate {
  currency: string; budget:number; units:number; notional:number; funding:number; stopLoss:number; costsAtStop:number; reward:number|null; rewardRisk:number|null; equityCapped:boolean;
  /** Legacy callers are USD-only; new views use the explicitly named currency. */
  notionalUSD:number; fundingUSD:number; stopLossUSD:number; costsAtStopUSD:number; rewardUSD:number|null;
}
/** Long planning, quote-currency equity. No implicit FX conversion or leverage. */
export function estimateRisk(input:RiskInput, contract?:Instrument, now=Date.now()/1000):RiskEstimate {
  if(!input || !['percent','usd','quote'].includes(input.riskMode)) throw Error('Choose percent or quote-currency risk.');
  const i=contract??(input.instrumentId?INSTRUMENTS[input.instrumentId]:undefined);
  if(input.instrumentId&&!i) throw Error('Unknown risk instrument.');
  if(i && (i.kind==='reference'||i.kind==='continuous'||i.lifecycle==='expired')) throw Error('Choose a tradable instrument; reference and continuous series cannot be sized.');
  if(i && (![i.tickSize,i.lotSize,i.multiplier].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0))) throw Error('Verified tick, lot and multiplier metadata are required for sizing.');
  const currency=i?.quote??'USD';
  if((input.currency&&input.currency!==currency)||(input.riskMode==='usd'&&currency!=='USD')) throw Error('Equity and risk budget must use the instrument quote currency. No currency conversion is assumed.');
  const derivative=i?.kind==='future';
  if(derivative && (!contractUsable(i!,now)||input.funding!=='derivative'||!Number.isFinite(input.marginPerContract)||input.marginPerContract!<=0)) throw Error('An unexpired individual contract, no-roll policy and explicit margin per contract are required.');
  if(!derivative&&input.funding==='derivative') throw Error('This instrument uses cash funding; derivative leverage is unavailable.');
  if([input.equity,input.riskValue,input.entry,input.stop].some(n=>!Number.isFinite(n)||n<=0||n>1e12)) throw Error('Equity, risk and prices must be positive finite numbers.');
  if(input.stop>=input.entry) throw Error('For a long position, the stop must be below entry.');
  if(input.target!==undefined&&(!Number.isFinite(input.target)||input.target<=input.entry||input.target>1e12)) throw Error('The optional target must be above entry.');
  if([input.feeBps,input.slippageBps].some(n=>!Number.isFinite(n)||n<0||n>1000)) throw Error('Fees and slippage must each be between 0 and 1,000 basis points per side.');
  const budget=input.riskMode==='percent'?input.equity*input.riskValue/100:input.riskValue;
  if(budget>input.equity) throw Error('Risk cannot exceed cash equity.');
  const fee=input.feeBps/10000, slip=input.slippageBps/10000, multiplier=i?.multiplier??1;
  const round=(n:number,up:boolean)=>i?Number(((up?Math.ceil(n/i.tickSize!-1e-9):Math.floor(n/i.tickSize!+1e-9))*i.tickSize!).toPrecision(14)):n;
  const entryFill=round(input.entry*(1+slip),true),stopFill=round(input.stop*(1-slip),false);
  const loss=(entryFill*(1+fee)-stopFill*(1-fee))*multiplier;
  const unitFunding=derivative?input.marginPerContract!+entryFill*multiplier*fee:entryFill*(1+fee)*multiplier;
  const riskUnits=budget/loss,cashUnits=input.equity/unitFunding;
  let units=Math.min(riskUnits,cashUnits);
  if(i) units=Number((Math.floor(units/i.lotSize!)*i.lotSize!).toPrecision(14));
  const stopLoss=units*loss,reward=input.target===undefined?null:units*multiplier*(round(input.target*(1-slip),false)*(1-fee)-entryFill*(1+fee));
  const notional=units*input.entry*multiplier,funding=units*unitFunding,costsAtStop=stopLoss-units*multiplier*(input.entry-input.stop);
  return {currency,budget,units,notional,funding,stopLoss,costsAtStop,reward,rewardRisk:reward===null||stopLoss===0?null:reward/stopLoss,equityCapped:cashUnits<riskUnits,
    notionalUSD:currency==='USD'?notional:NaN,fundingUSD:currency==='USD'?funding:NaN,stopLossUSD:currency==='USD'?stopLoss:NaN,costsAtStopUSD:currency==='USD'?costsAtStop:NaN,rewardUSD:currency==='USD'?reward:null};
}
