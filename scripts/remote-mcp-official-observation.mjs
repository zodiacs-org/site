import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),temp=mkdtempSync(join(tmpdir(),'zodiacs-mcp-conformance-')),hash=b=>createHash('sha256').update(b).digest('hex');
const scenarios=['server-initialize','tools-list'],records=[];let failure=null,lockDigest=null,framework=null,stage='metadata';
function run(args,timeout=180000){
 const r=spawnSync('npm',args,{cwd:temp,encoding:'utf8',shell:false,timeout,maxBuffer:4*1024*1024});
 if(r.error)throw r.error;if(r.status!==0)throw Error('npm command exit '+r.status+': '+r.stderr.slice(-1800));return r.stdout;
}
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.isFile()?[join(dir,e.name)]:[]);}
try{
 const metadata=JSON.parse(run(['view','@modelcontextprotocol/conformance@0.2.0-alpha.12','--json']));
 assert.equal(metadata.name,'@modelcontextprotocol/conformance');assert.equal(metadata.version,'0.2.0-alpha.12');
 framework={name:metadata.name,version:metadata.version,gitHead:metadata.gitHead??null,distIntegrity:metadata.dist.integrity,distTarball:metadata.dist.tarball,distTags:metadata['dist-tags']??null,researchSource:'c37eec888e1c6ff140af79987a40008548b7cc5f'};
 stage='isolated-install';
 writeFileSync(join(temp,'package.json'),JSON.stringify({name:'zodiacs-private-conformance-observation',version:'0.0.0',private:true,type:'module',dependencies:{'@modelcontextprotocol/conformance':'0.2.0-alpha.12'}},null,2)+'\n');
 run(['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund']);
 const lock=readFileSync(join(temp,'package-lock.json'));lockDigest=hash(lock);
 run(['ci','--ignore-scripts','--no-audit','--no-fund']);
 const installed=JSON.parse(readFileSync(join(temp,'node_modules/@modelcontextprotocol/conformance/package.json')));
 assert.equal(installed.version,'0.2.0-alpha.12');
 const cli=join(temp,'node_modules/@modelcontextprotocol/conformance/dist/index.js');
 stage='protocol-scenarios';
 for(const scenario of scenarios){
  const resultDir=join(temp,'results',scenario);
  const args=[cli,'server','--url','https://zodiacs.org/mcp','--scenario',scenario,'--spec-version','2025-11-25','--timeout','30000','--output-dir',resultDir];
  const result=spawnSync(process.execPath,args,{cwd:temp,shell:false,encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});
  mkdirSync(resolve(root,'protocol-observation-results',scenario),{recursive:true});
  writeFileSync(resolve(root,'protocol-observation-results',scenario,'stdout.txt'),result.stdout??'');
  writeFileSync(resolve(root,'protocol-observation-results',scenario,'stderr.txt'),result.stderr??'');
  const checkFiles=files(resultDir).filter(p=>p.endsWith('/checks.json'));
  assert.equal(checkFiles.length,1,scenario+' actual checks');
  const bytes=readFileSync(checkFiles[0]),checks=JSON.parse(bytes);
  writeFileSync(resolve(root,'protocol-observation-results',scenario,'checks.json'),bytes);
  records.push({scenario,exitCode:result.status,processError:result.error?.message??null,checksSha256:hash(bytes),checks:checks.map(c=>({id:c.id,status:c.status,name:c.name,errorMessage:c.errorMessage??null,details:c.details??null}))});
  if(result.error||result.status!==0)failure={stage,scenario,message:result.error?.message??'Official scenario failed; retained actual checks.'};
 }
} catch(error){failure={stage,name:error.name,message:String(error.message).slice(0,2000)};}
finally{rmSync(temp,{recursive:true,force:true});}
const report={schema:'zodiacs.remote-mcp-official-scenarios.v1',observedAt:new Date().toISOString(),endpoint:'https://zodiacs.org/mcp',producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},framework,dependencyLockSha256:lockDigest,protocolVersion:'2025-11-25',scenarios:records,passed:failure===null&&records.length===scenarios.length,failure,limitations:['Two unmodified official scenarios at the currently advertised protocol; not the full current MCP conformance suite or every-tool Inspector evaluation.','The upstream tool-call scenarios require sample test_* tools which the application does not advertise; no fake production tools or expected-failure baseline was added.','Initialization and tool discovery are anonymous, synthetic protocol requests; no birth request, credentials, registry publication, private scan or accepted weight.','Research source and installed npm metadata are recorded separately; package/git identity is not presumed.']};
const path='docs/platform/evidence/remote-mcp-conformance-20261009/official-scenarios.json',bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');mkdirSync(resolve(root,'docs/platform/evidence/remote-mcp-conformance-20261009'),{recursive:true});writeFileSync(resolve(root,path),bytes);
console.log('PROGRAMME_FILE '+JSON.stringify({path,size:bytes.length,sha256:hash(bytes),base64:bytes.toString('base64')}));
console.log('PROGRAMME_PROTOCOL_SUMMARY '+JSON.stringify({scenarios:records.length,passed:report.passed,failure}));
if(!report.passed)process.exitCode=1;
