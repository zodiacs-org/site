/** Serialized private scheduler entry point; never deployed by the site build. */
import {readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {hash,validateProtocol,eligibleSessions} from './runtime.mjs';
export function planCycle(protocol,now,hasDecision,hasSettlement){
 const tasks=[];
 for(const asset of protocol.assets)for(const session of eligibleSessions(protocol,asset)){
  const key=`${hash(asset.id).slice(0,16)}-${session.id}`;
  if(session.open-now>=protocol.leadSeconds&&session.open-now<=3600)tasks.push({kind:'record-witness',asset:asset.id,session:session.id,key});
  if(session.close+protocol.publicationDelaySeconds<=now&&hasDecision(key)&&!hasSettlement(key))tasks.push({kind:'settle',asset:asset.id,session:session.id,key});
 }
 return tasks;
}
async function main(){
 const state=path.resolve(process.argv[2]??'');if(!process.argv[2])throw Error('Use: node cycle.mjs private-state-directory');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),cli=path.join(root,'scripts/market-lens-paper-v3.mjs'),ca=path.join(root,'research/market-lens/ops/freetsa-ca.pem');
 const run=(...args)=>execFileSync(process.execPath,[cli,...args,'--dir',state],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});
 // Integrity validation precedes network acquisition, including this scheduler and adapter.
 run('report');
 const lock=path.join(state,'.cycle-lock');await mkdir(lock,{mode:0o700});
 try{
  const frozen=JSON.parse(await readFile(path.join(state,'protocol.json'),'utf8')),p=validateProtocol(frozen.payload.protocol),now=Date.now()/1000;
  const exists=async f=>stat(f).then(()=>true).catch(e=>{if(e.code==='ENOENT')return false;throw e;});
  const decisions=new Set(),settlements=new Set();
  for(const a of p.assets)for(const s of eligibleSessions(p,a)){const key=`${hash(a.id).slice(0,16)}-${s.id}`;if(await exists(path.join(state,'decisions',key+'.json')))decisions.add(key);if(await exists(path.join(state,'settlements',key+'.json')))settlements.add(key);}
  const tasks=planCycle(p,now,key=>decisions.has(key),key=>settlements.has(key)),outcomes=[],inputs=new Map();
  const runId=new Date().toISOString().replaceAll(':','-'),dir=path.join(state,'cycles',runId);await mkdir(dir,{recursive:true,mode:0o700});
  const manifest=path.join(dir,'manifest.json');await writeFile(manifest,JSON.stringify(p),{flag:'wx',mode:0o600});
  for(const task of tasks){
   try{
    const already=decisions.has(task.key);
    let input=inputs.get(task.asset);
    if(task.kind==='settle'||!already){if(!input){input=path.join(dir,hash(task.asset).slice(0,16)+'.json');execFileSync(process.execPath,[path.join(root,'research/market-lens/v3/acquire.mjs'),manifest,task.asset,input],{stdio:['ignore','pipe','pipe'],timeout:120000});inputs.set(task.asset,input);}}
    if(task.kind==='record-witness'){
     if(!already)run('record','--instrument',task.asset,'--session',task.session,'--input',input);
     run('witness','--instrument',task.asset,'--session',task.session,'--ca',ca);
    }else run('settle','--instrument',task.asset,'--session',task.session,'--input',input,'--ca',ca);
    outcomes.push({...task,status:'passed'});
   }catch{outcomes.push({...task,status:'failed',message:'Inspect the private preserved inputs/receipts. No backfill or source replacement was attempted.'});}
  }
  const report=JSON.parse(run('report'));await writeFile(path.join(dir,'report.json'),JSON.stringify({at:now,outcomes,report},null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({tasks:outcomes.length,failed:outcomes.filter(t=>t.status==='failed').length,report:path.join(dir,'report.json')}));
  if(outcomes.some(t=>t.status==='failed'))process.exitCode=1;
 }finally{await rm(lock,{recursive:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
