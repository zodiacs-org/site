import {it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {hash} from './runtime.mjs';
it('backs up a synthetic frozen protocol, safely restores source/state, and refuses overwrites and tampering',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'lens-v3-synthetic-recovery-'));
 try {
  const p=JSON.parse(await readFile(new URL('./protocol-draft.json',import.meta.url))),start=Math.floor(Date.now()/86400000)*86400+4*86400;
  p.status='ready';p.start=new Date(start*1000).toISOString();p.endExclusive=new Date((start+180*86400)*1000).toISOString();
  p.assets=[{id:'BTC-USD',kind:'spot',family:'crypto',provider:'coinbase',symbol:'BTC-USD',currency:'USD',calendarSource:'SYNTHETIC TEST ONLY',grantReference:'SYNTHETIC TEST ONLY',eligibilityReceiptSha256:'a'.repeat(64),acquisitionAcceptanceSha256:'b'.repeat(64),tickSize:0.01,lotSize:1e-8,multiplier:1,feeBps:10,slippageBps:5,sessions:Array.from({length:232},(_,n)=>({id:`day-${n}`,open:start+(n-52)*86400,close:start+(n-51)*86400}))}];
  const manifest=path.join(temp,'synthetic.json'),state=path.join(temp,'state'),archive=path.join(temp,'backup.tar.gz');await writeFile(manifest,JSON.stringify(p));
  const cli=path.resolve('scripts/market-lens-paper-v3.mjs');
  execFileSync(process.execPath,[cli,'freeze','--dir',state,'--manifest',manifest]);
  const before=await readFile(path.join(state,'protocol.json'));
  expect(()=>execFileSync(process.execPath,[cli,'freeze','--dir',state,'--manifest',manifest],{stdio:'pipe'})).toThrow();
  execFileSync(process.execPath,[cli,'backup','--dir',state,'--archive',archive]);
  const restored=path.join(temp,'restored');execFileSync('python3',['research/market-lens/v3/restore.py',archive,restored]);
  expect(await readFile(path.join(restored,'state/protocol.json'))).toEqual(before);
  const source=await readFile(path.join(restored,'frozen/scripts/market-lens-paper-v3.mjs'));expect(hash(source)).toBe(hash(await readFile(cli)));
  expect(()=>execFileSync('python3',['research/market-lens/v3/restore.py',archive,restored],{stdio:'pipe'})).toThrow();
  await writeFile(archive,'tampered');expect(()=>execFileSync('python3',['research/market-lens/v3/restore.py',archive,path.join(temp,'bad')],{stdio:'pipe'})).toThrow();
 }finally{await rm(temp,{recursive:true,force:true});}
},15000);
