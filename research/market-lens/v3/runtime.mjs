import {createHash} from 'node:crypto';
import {moonPhase,ENGINE_VERSION} from '@zodiacs/engine';
export const hash = value => createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const epoch=value=>Date.parse(value)/1000;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function validateProtocol(p,now=Date.now()/1000,freezing=false) {
  if(p.version!==3||p.experimentId!=='market-lens-cross-asset-v3'||p.status!=='ready'||p.engineVersion!==ENGINE_VERSION) throw Error('v3 activation is blocked: complete the draft prerequisites.');
  if(!finite(epoch(p.start))||epoch(p.endExclusive)-epoch(p.start)!==180*86400||freezing&&epoch(p.start)<now+2*86400) throw Error('Freeze requires a fresh 180-day window at least two days ahead.');
  if(p.leadSeconds!==900||p.publicationDelaySeconds!==300||p.featureSessions!==50||p.initialCapitalPerArm!==10000||p.publicForecastsEnabled!==false)throw Error('Unexpected v3 method constants.');
  if(!Array.isArray(p.assets)||!p.assets.length||p.assets.length>50||new Set(p.assets.map(a=>a.id)).size!==p.assets.length)throw Error('Fix a unique eligible asset set.');
  for(const a of p.assets) {
    if(!p.candidateAssets.includes(a.id)||!['spot','stock','etf'].includes(a.kind)||!['coinbase','twelve-data'].includes(a.provider)||!a.currency||!a.symbol||!a.calendarSource||!a.grantReference||!a.eligibilityReceiptSha256?.match(/^[a-f0-9]{64}$/)||!a.acquisitionAcceptanceSha256?.match(/^[a-f0-9]{64}$/)||![a.tickSize,a.lotSize,a.multiplier].every(n=>finite(n)&&n>0)||a.multiplier!==1)throw Error('Asset eligibility, rights, acceptance and instrument metadata are required.');
    if(!finite(a.feeBps)||!finite(a.slippageBps)||a.feeBps<0||a.slippageBps<0||a.feeBps>1000||a.slippageBps>1000)throw Error('Invalid fixed costs.');
    if(!Array.isArray(a.sessions)||a.sessions.length<51||a.sessions.length>500||new Set(a.sessions.map(s=>s.id)).size!==a.sessions.length)throw Error('Freeze the complete session schedule including warmup.');
    for(const [n,s] of a.sessions.entries()) if(!/^[a-zA-Z0-9_-]{1,40}$/.test(s.id)||![s.open,s.close].every(Number.isSafeInteger)||s.close<=s.open||s.close-s.open>86400||n>0&&s.open<a.sessions[n-1].close||s.adjustmentBreak!==undefined&&typeof s.adjustmentBreak!=='boolean')throw Error('Invalid session schedule.');
    if(a.sessions.filter(s=>s.close+300<epoch(p.start)).length<50||!a.sessions.some(s=>s.open>=epoch(p.start)&&s.open<epoch(p.endExclusive)))throw Error('Insufficient warmup or study session coverage.');
  }
  return p;
}
export function eligibleSessions(p,a) {return a.sessions.filter(s=>s.open>=epoch(p.start)&&s.open<epoch(p.endExclusive));}
export function validateSnapshot(snapshot,a,now) {
  if(snapshot.instrument!==a.id||snapshot.provider!==a.provider||snapshot.symbol!==a.symbol||snapshot.currency!==a.currency||!finite(snapshot.receivedAt)||snapshot.receivedAt>now||snapshot.receivedAt<now-900||!Array.isArray(snapshot.candles)||snapshot.candles.length>900)throw Error('Fresh identified acquisition receipt required.');
  const sessions=new Map(a.sessions.map(s=>[s.open,s])),seen=new Set();
  for(const c of snapshot.candles) {
    const s=sessions.get(c.time);
    if(!s||seen.has(c.time)||![c.time,c.open,c.high,c.low,c.close,c.volume].every(finite)||Math.min(c.open,c.high,c.low,c.close)<=0||c.volume<0||c.low>Math.min(c.open,c.close)||c.high<Math.max(c.open,c.close)||s.close+300>snapshot.receivedAt)throw Error('Invalid, future, duplicate or unfinished acquisition bar.');
    seen.add(c.time);
  }
}
export function decision(p,assetId,sessionId,snapshot,now=Date.now()/1000) {
  validateProtocol(p,now);const a=p.assets.find(a=>a.id===assetId),s=a&&eligibleSessions(p,a).find(s=>s.id===sessionId);
  if(!s||now>s.open-p.leadSeconds||now<s.open-48*3600)throw Error('Decision outside prospective recording window.');
  validateSnapshot(snapshot,a,now);
  const required=a.sessions.filter(row=>row.close+300<=now&&row.open<s.open).slice(-50);
  if(required.length!==50||required.some(row=>row.close+300>now||row.adjustmentBreak))throw Error('Fifty finalized sessions after the last adjustment are required.');
  const bars=required.map(row=>snapshot.candles.find(c=>c.time===row.open));
  if(bars.some(b=>!b))throw Error('Feature sessions are missing.');
  const avg=rows=>rows.reduce((n,c)=>n+c.close,0)/rows.length;
  const ta=avg(bars.slice(-20))>avg(bars),angle=moonPhase(new Date(s.open*1000)).angle;
  if(!finite(angle)||angle<0||angle>=360)throw Error('Invalid pinned engine phase.');
  const lunar=Math.min(angle,360-angle)<=12||Math.abs(angle-180)<=12;
  return {protocolHash:hash(p),instrument:a.id,session:s.id,recordedAt:now,executionAt:s.open,closeAt:s.close,featureCutoff:required.at(-1).close,snapshotHash:hash(snapshot),taLong:ta,lunarLong:ta&&lunar};
}
export function settle(p,d,snapshot,witnessAt,now=Date.now()/1000) {
  validateProtocol(p,now);const a=p.assets.find(a=>a.id===d.instrument),s=a&&eligibleSessions(p,a).find(s=>s.id===d.session);
  if(!s||d.protocolHash!==hash(p)||!finite(witnessAt)||witnessAt>d.executionAt-p.leadSeconds||witnessAt<d.recordedAt-60||now<s.close+300)throw Error('Settlement requires an on-time independent witness and finalized session.');
  validateSnapshot(snapshot,a,now);const c=snapshot.candles.find(c=>c.time===s.open);if(!c)throw Error('Outcome session missing.');
  // Return per fully cash-funded unit including outward tick rounding and both costs.
  const fee=a.feeBps/10000,slip=a.slippageBps/10000;
  const entry=Math.ceil(c.open*(1+slip)/a.tickSize-1e-9)*a.tickSize,exit=Math.floor(c.close*(1-slip)/a.tickSize+1e-9)*a.tickSize;
  return {protocolHash:hash(p),decisionHash:hash(d),instrument:a.id,session:s.id,settledAt:now,snapshotHash:hash(snapshot),entry,exit,feePerUnit:(entry+exit)*fee,slippagePerUnit:entry-c.open+c.close-exit,taLong:d.taLong,lunarLong:d.lunarLong};
}
export function report(p,decisions,settlements,now=Date.now()/1000) {
  validateProtocol(p,now);
  const assets=p.assets.map(a=>{
    const due=eligibleSessions(p,a).filter(s=>s.close+300<=now),rows=[];
    const arms={ta:{equity:10000,peak:10000,drawdown:0,trades:0,fees:0,slippage:0},lunar:{equity:10000,peak:10000,drawdown:0,trades:0,fees:0,slippage:0}};
    for(const s of due) {
      const d=decisions.find(d=>d.instrument===a.id&&d.session===s.id),out=settlements.find(r=>r.instrument===a.id&&r.session===s.id);
      if(!d||!out){rows.push({session:s.id,status:d?'unsettled-or-unwitnessed':'missing-decision'});continue;}
      if(out.decisionHash!==hash(d)||out.protocolHash!==hash(p))throw Error('Receipt linkage mismatch.');
      for(const [name,arm]of Object.entries(arms))if(out[name==='ta'?'taLong':'lunarLong']) {
        const units=Math.floor(arm.equity/(out.entry*(1+a.feeBps/10000))/a.lotSize)*a.lotSize;
        arm.equity+=units*(out.exit-out.entry-out.feePerUnit);arm.fees+=units*out.feePerUnit;arm.slippage+=units*out.slippagePerUnit;arm.trades+=Number(units>0);arm.peak=Math.max(arm.peak,arm.equity);arm.drawdown=Math.max(arm.drawdown,1-arm.equity/arm.peak);
      }
      rows.push({session:s.id,status:'settled'});
    }
    return {id:a.id,family:a.family,currency:a.currency,due:due.length,settled:rows.filter(r=>r.status==='settled').length,coverage:rows,arms,deltaReturn:(arms.lunar.equity-arms.ta.equity)/10000};
  });
  return {experimentId:p.experimentId,protocolHash:hash(p),at:now,status:now<epoch(p.endExclusive)+300?'interim-descriptive-only':'fixed-window-complete',assets,inference:p.inference};
}
