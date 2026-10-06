import {readFile,writeFile,mkdir,readdir,realpath,stat,mkdtemp,cp,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {hash,validateProtocol,decision,settle,report} from '../research/market-lens/v3/runtime.mjs';
const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sources=['scripts/market-lens-paper-v3.mjs','research/market-lens/v3/runtime.mjs','research/market-lens/v3/acquire.mjs','research/market-lens/v3/cycle.mjs','vendor/zodiacs-engine-0.1.1-rc.15.tgz','research/market-lens/v3/runtime-deps/package.json','research/market-lens/v3/runtime-deps/package-lock.json','research/market-lens/v3/install-runtime.sh','research/market-lens/v3/restore.py','research/market-lens/ops/freetsa-ca.pem'];
const [command,...pairs]=process.argv.slice(2),args={};
for(let i=0;i<pairs.length;i+=2){if(!/^--(dir|manifest|input|instrument|session|archive|ca)$/.test(pairs[i])||!pairs[i+1]||args[pairs[i]])throw Error('Invalid or duplicate CLI argument.');args[pairs[i]]=pairs[i+1];}
if(!args['--dir'])throw Error('Use --dir with an isolated private state directory.');
const directory=path.resolve(args['--dir']);
await mkdir(directory,{recursive:true,mode:0o700});const root=await realpath(directory);
if(root===runtime||root.startsWith(runtime+path.sep))throw Error('Private state must be outside the source checkout.');
const json=async f=>{if((await stat(f)).size>10_000_000)throw Error('Input exceeds size limit.');return JSON.parse(await readFile(f,'utf8'));};
const append=async(relative,payload)=>{const p=path.join(root,relative);await mkdir(path.dirname(p),{recursive:true,mode:0o700});const receipt={sha256:hash(payload),payload};await writeFile(p,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});return receipt;};
const receipt=async f=>{const r=await json(f);if(r.sha256!==hash(r.payload))throw Error('Receipt hash mismatch. Preserve bytes for review.');return r.payload;};
const exists=async f=>stat(f).then(()=>true).catch(e=>{if(e.code==='ENOENT')return false;throw e;});
const acquisition=async(digest,snapshot)=>{const file=path.join(root,'acquisitions',digest+'.json');if(await exists(file)){if(hash(await receipt(file))!==digest)throw Error('Acquisition identity mismatch.');}else await append(`acquisitions/${digest}.json`,snapshot);};
const records=async name=>{const files=await readdir(path.join(root,name)).catch(e=>{if(e.code==='ENOENT')return [];throw e;});return Promise.all(files.filter(f=>f.endsWith('.json')).sort().map(f=>receipt(path.join(root,name,f))));};
const runtimeHashes=async()=>Object.fromEntries(await Promise.all(sources.map(async f=>[f,hash(await readFile(path.join(runtime,f)))])));
if(command==='freeze') {
  const p=validateProtocol(await json(args['--manifest']),Date.now()/1000,true);
  // Protocol and source bytes are sealed before any decision. Existing files refuse overwrite.
  await append('protocol.json',{protocol:p,sourceHashes:await runtimeHashes()});
  console.log(JSON.stringify({status:'frozen',protocolHash:hash(p)}));
} else {
  const frozen=await receipt(path.join(root,'protocol.json')),p=validateProtocol(frozen.protocol);
  if(JSON.stringify(frozen.sourceHashes)!==JSON.stringify(await runtimeHashes()))throw Error('Frozen runtime integrity failure.');
  const verifyState=async()=>{
    const decisions=await records('decisions'),settlements=await records('settlements'),witnesses=new Map();
    const ca=path.join(runtime,'research/market-lens/ops/freetsa-ca.pem');
    for(const d of decisions){
      const input=await receipt(path.join(root,'acquisitions',d.snapshotHash+'.json'));
      if(hash(decision(p,d.instrument,d.session,input,d.recordedAt))!==hash(d))throw Error('Decision does not reproduce from its original acquisition.');
      const base=path.join(root,'witnesses',`${hash(d.instrument).slice(0,16)}-${d.session}`);
      if(await exists(base+'.tsr')){
        const run=args=>execFileSync('openssl',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
        run(['ts','-verify','-queryfile',base+'.tsq','-in',base+'.tsr','-CAfile',ca]);
        run(['ts','-verify','-digest',hash(d),'-in',base+'.tsr','-CAfile',ca]);
        const at=Date.parse(run(['ts','-reply','-in',base+'.tsr','-text']).match(/^Time stamp: (.+)$/m)?.[1])/1000;
        if(!Number.isFinite(at)||at>d.executionAt-p.leadSeconds||at<d.recordedAt-60)throw Error('Original witness violates prospective timing.');
        if(await exists(base+'.json')){const w=await receipt(base+'.json');if(w.at!==at||w.decisionHash!==hash(d)||w.queryHash!==hash(await readFile(base+'.tsq'))||w.responseHash!==hash(await readFile(base+'.tsr'))||w.caHash!==hash(await readFile(ca)))throw Error('Witness metadata differs from original signature bytes.');}
        witnesses.set(hash(d),at);
      }
    }
    for(const out of settlements){const d=decisions.find(d=>hash(d)===out.decisionHash);if(!d||!witnesses.has(out.decisionHash))throw Error('Settlement lacks an original witnessed decision.');const input=await receipt(path.join(root,'acquisitions',out.snapshotHash+'.json'));if(hash(settle(p,d,input,witnesses.get(out.decisionHash),out.settledAt))!==hash(out))throw Error('Settlement does not reproduce from original evidence.');}
    return {decisions,settlements,witnessed:witnesses.size};
  };
  const now=Date.now()/1000;
  const safeKey=()=>{if(!p.assets.some(a=>a.id===args['--instrument'])||!/^[a-zA-Z0-9_-]{1,40}$/.test(args['--session']??''))throw Error('Unknown instrument/session.');return `${hash(args['--instrument']).slice(0,16)}-${args['--session']}`;};
  if(command==='record') {
    const key=safeKey();
    if(await exists(path.join(root,'decisions',key+'.json'))){await receipt(path.join(root,'decisions',key+'.json'));console.log(JSON.stringify({status:'already-recorded'}));process.exit(0);}
    const snapshot=await json(args['--input']),d=decision(p,args['--instrument'],args['--session'],snapshot,now);
    await acquisition(d.snapshotHash,snapshot);
    await append(`decisions/${key}.json`,d);console.log(JSON.stringify({status:'recorded',sha256:hash(d)}));
  } else if(command==='witness'||command==='settle') {
    const key=safeKey(),d=await receipt(path.join(root,'decisions',key+'.json')),base=path.join(root,'witnesses',key),ca=args['--ca'];
    if(!ca||hash(await readFile(ca))!==frozen.sourceHashes['research/market-lens/ops/freetsa-ca.pem'])throw Error('Use the original preserved timestamp CA with --ca.');
    await mkdir(path.dirname(base),{recursive:true,mode:0o700});
    const run=(args)=>execFileSync('openssl',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});
    const queryExists=await exists(base+'.tsq'),responseExists=await exists(base+'.tsr');
    if(queryExists!==responseExists)throw Error('Incomplete original witness; preserve it for review.');
    if(command==='witness'&&!queryExists) {
      if(now>d.executionAt-p.leadSeconds)throw Error('No late or retroactive witnesses.');
      // Never regenerate an existing original query/response, including partial failures.
      const bytes=execFileSync('openssl',['ts','-query','-digest',hash(d),'-sha256','-cert'],{stdio:['ignore','pipe','pipe']});
      await writeFile(base+'.tsq',bytes,{flag:'wx',mode:0o600});
      const res=await fetch('https://freetsa.org/tsr',{method:'POST',headers:{'Content-Type':'application/timestamp-query'},body:bytes,signal:AbortSignal.timeout(30000)});
      if(!res.ok)throw Error('Timestamp request failed; preserve original query.');
      const response=Buffer.from(await res.arrayBuffer());if(response.length>50000)throw Error('Timestamp response too large.');
      await writeFile(base+'.tsr',response,{flag:'wx',mode:0o600});
    }
    run(['ts','-verify','-queryfile',base+'.tsq','-in',base+'.tsr','-CAfile',ca]);
    run(['ts','-verify','-digest',hash(d),'-in',base+'.tsr','-CAfile',ca]);
    const text=run(['ts','-reply','-in',base+'.tsr','-text']),timestamp=text.match(/^Time stamp: (.+)$/m)?.[1],at=Date.parse(timestamp)/1000;
    if(!Number.isFinite(at)||at>d.executionAt-p.leadSeconds)throw Error('Independent witness missed the deadline.');
    if(command==='witness'&&!await exists(base+'.json'))await append(`witnesses/${key}.json`,{decisionHash:hash(d),at,queryHash:hash(await readFile(base+'.tsq')),responseHash:hash(await readFile(base+'.tsr')),caHash:hash(await readFile(ca))});
    else if(command==='settle'&&!await exists(path.join(root,'settlements',key+'.json'))) {const snapshot=await json(args['--input']),out=settle(p,d,snapshot,at,now);await acquisition(out.snapshotHash,snapshot);await append(`settlements/${key}.json`,out);}
    console.log(JSON.stringify({status:command==='witness'?'verified-witness':'settled',decisionHash:hash(d)}));
  } else if(command==='report') {
    const verified=await verifyState();console.log(JSON.stringify({...report(p,verified.decisions,verified.settlements,now),verifiedWitnesses:verified.witnessed},null,2));
  } else if(command==='verify') {
    const verified=await verifyState();console.log(JSON.stringify({status:'verified',decisions:verified.decisions.length,settlements:verified.settlements.length,witnesses:verified.witnessed}));
  } else if(command==='backup') {
    await verifyState();
    if(!args['--archive']||path.resolve(args['--archive']).startsWith(root+path.sep))throw Error('Provide a new backup outside state.');
    const archive=path.resolve(args['--archive']);await writeFile(archive,'',{flag:'wx',mode:0o600});
    // Source payload separately included; dependencies must be installed from the pinned minimal lock on restore.
    const staging=await mkdtemp(path.join(tmpdir(),'lens-v3-backup-'));
    try {
      await cp(root,path.join(staging,'state'),{recursive:true,dereference:false});
      for(const f of sources){const target=path.join(staging,'frozen',f);await mkdir(path.dirname(target),{recursive:true,mode:0o700});await cp(path.join(runtime,f),target);}
      execFileSync('tar',['-czf',archive,'-C',staging,'state','frozen'],{stdio:'pipe'});
    } finally {await rm(staging,{recursive:true,force:true});}
    await writeFile(archive+'.sha256',hash(await readFile(archive))+'  '+path.basename(archive)+'\n',{flag:'wx',mode:0o600});
    console.log(JSON.stringify({status:'backup-created',sha256:hash(await readFile(archive))}));
  } else throw Error('Commands: freeze, record, witness, settle, report, verify, backup. Restore into a new isolated directory using the documented guarded restore script.');
}
