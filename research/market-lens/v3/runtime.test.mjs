import {afterAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {cp,mkdir,mkdtemp,readFile,rm,symlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {findPackageJSON} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
// The website may advance its engine; the v3 runtime still runs the engine its draft
// and runtime-deps pin. Copy the unchanged runtime beside that archive, unpacked.
const pinned=JSON.parse(readFileSync(new URL('./runtime-deps/package.json',import.meta.url))).dependencies['@zodiacs/engine'].match(/zodiacs-engine-.+\.tgz$/)[0];
const fixtureRoot=new URL('../../../.cache/',import.meta.url);
await mkdir(fixtureRoot,{recursive:true});
const isolated=await mkdtemp(path.join(fileURLToPath(fixtureRoot),'lens-v3-test-'));
afterAll(async()=>{await rm(isolated,{recursive:true,force:true});});
await cp(new URL('./runtime.mjs',import.meta.url),path.join(isolated,'runtime.mjs'));
const engineDirectory=path.join(isolated,'node_modules/@zodiacs/engine');
await mkdir(engineDirectory,{recursive:true});
execFileSync('tar',['-xzf',fileURLToPath(new URL('../../../vendor/'+pinned,import.meta.url)),'--strip-components=1','-C',engineDirectory]);
const ephemerisPackage=findPackageJSON('astronomy-engine',import.meta.url);
expect(JSON.parse(await readFile(ephemerisPackage,'utf8')).version).toBe(JSON.parse(readFileSync(new URL('./runtime-deps/package.json',import.meta.url))).dependencies['astronomy-engine']);
await symlink(path.dirname(ephemerisPackage),path.join(isolated,'node_modules/astronomy-engine'));
const {hash,validateProtocol,decision,settle,report}=await import(/* @vite-ignore */ pathToFileURL(path.join(isolated,'runtime.mjs')).href);
const draft=JSON.parse(readFileSync(new URL('./protocol-draft.json',import.meta.url)));
const start=Date.parse('2030-01-01')/1000;
function fixture(){
 const sessions=Array.from({length:231},(_,i)=>({id:`day-${i}`,open:start+(i-51)*86400,close:start+(i-50)*86400}));
 const asset={id:'BTC-USD',kind:'spot',provider:'coinbase',currency:'USD',symbol:'BTC-USD',family:'crypto',calendarSource:'synthetic-test-only',grantReference:'synthetic-test-only',eligibilityReceiptSha256:'a'.repeat(64),acquisitionAcceptanceSha256:'b'.repeat(64),tickSize:0.01,lotSize:1e-8,multiplier:1,feeBps:10,slippageBps:5,sessions};
 const p={...draft,status:'ready',start:new Date(start*1000).toISOString(),endExclusive:new Date((start+180*86400)*1000).toISOString(),assets:[asset]};
 const s=sessions[52],now=s.open-1000;
 const snapshot={instrument:asset.id,provider:asset.provider,symbol:asset.symbol,currency:'USD',receivedAt:now,candles:sessions.slice(1,51).map((s,i)=>({time:s.open,open:100+i,high:102+i,low:99+i,close:101+i,volume:10}))};
 return {p,asset,s,now,snapshot};
}
describe('separate prospective v3 runtime',()=>{
 it('cannot freeze the blocked draft or retroactively activate',()=>{
  expect(()=>validateProtocol(draft)).toThrow('blocked');const {p}=fixture();expect(()=>validateProtocol(p,start,true)).toThrow('two days');expect(validateProtocol(p,start-3*86400,true)).toBe(p);
 });
 it('rejects missing/future feature bars and late decisions',()=>{
  const {p,asset,s,now,snapshot}=fixture();
  expect(decision(p,asset.id,s.id,snapshot,now).taLong).toBe(true);
  // Use a session with enough time after the previous close, as in real exchange calendars.
  asset.sessions.forEach(row=>row.close-=3600);snapshot.candles=asset.sessions.slice(2,52).map((s,i)=>({time:s.open,open:100+i,high:102+i,low:99+i,close:101+i,volume:10}));
  const d=decision(p,asset.id,s.id,snapshot,now);expect(d.taLong).toBe(true);expect(d.featureCutoff).toBeLessThan(now-300);
  expect(()=>decision(p,asset.id,s.id,{...snapshot,candles:snapshot.candles.slice(1)},now)).toThrow('missing');
  expect(()=>decision(p,asset.id,s.id,snapshot,s.open-899)).toThrow('window');
  expect(()=>decision(p,asset.id,s.id,{...snapshot,candles:[...snapshot.candles,{...snapshot.candles[0],time:s.open}]},now)).toThrow('unfinished');
 });
 it('requires a prospective witness, preserves missing sessions and links immutable receipts',()=>{
  const {p,asset,s,now,snapshot}=fixture();asset.sessions.forEach(row=>row.close-=3600);snapshot.candles=asset.sessions.slice(2,52).map((s,i)=>({time:s.open,open:100+i,high:102+i,low:99+i,close:101+i,volume:10}));
  const d=decision(p,asset.id,s.id,snapshot,now),at=s.close+301;
  const outcome={...snapshot,receivedAt:at,candles:[{time:s.open,open:150,high:161,low:149,close:160,volume:2}]};
  expect(()=>settle(p,d,outcome,s.open-899,at)).toThrow('witness');
  const result=settle(p,d,outcome,now+1,at);expect(result.decisionHash).toBe(hash(d));expect(result.feePerUnit).toBeGreaterThan(0);
  const summary=report(p,[d],[result],at);expect(summary.status).toBe('interim-descriptive-only');expect(summary.assets[0].settled).toBe(1);expect(summary.assets[0].coverage.some(r=>r.status==='missing-decision')).toBe(true);
  expect(()=>report(p,[d],[{...result,decisionHash:'bad'}],at)).toThrow('linkage');
 });
});
