import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const directory='docs/platform/preparation/remote-mcp-registry';
const bytes=readFileSync(directory+'/server.json'),candidate=JSON.parse(bytes);
const work=mkdtempSync(resolve(tmpdir(),'zodiacs-registry-schema-'));
execFileSync('npm',['install','--prefix',work,'--ignore-scripts','--no-audit','--no-fund','ajv@8.17.1','ajv-formats@3.0.1'],{stdio:['ignore','pipe','pipe'],timeout:120000});
const {default:Ajv}=await import(pathToFileURL(resolve(work,'node_modules/ajv/dist/ajv.js')).href);
const {default:addFormats}=await import(pathToFileURL(resolve(work,'node_modules/ajv-formats/dist/index.js')).href);
async function schemaAt(url) {
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200);
 const text=await response.text();assert.ok(Buffer.byteLength(text)<1024*1024,'Public schema size bound');
 return {bytes:Buffer.from(text),schema:JSON.parse(text)};
}
const upstreamSource='970df037919faa70456dde08c295473002d850e5';
const urls=[
 candidate.$schema,
 'https://raw.githubusercontent.com/modelcontextprotocol/registry/'+upstreamSource+'/docs/reference/server-json/draft/server.schema.json'
];
const controls=[
 ['name without namespace separator',c=>{c.name='zodiacs';}],
 ['description exceeds schema limit',c=>{c.description='x'.repeat(101);}],
 ['missing implementation version',c=>{delete c.version;}],
 ['stdio in remotes',c=>{c.remotes[0].type='stdio';}],
 ['non-HTTP remote URL',c=>{c.remotes[0].url='javascript:invalid';}]
];
assert.equal(candidate.name,'io.github.zodiacs-org/zodiacs');
assert.equal(candidate.version,'0.4.0');
assert.equal(candidate.repository.url,'https://github.com/zodiacs-org/site');
assert.equal(candidate.remotes.length,1);
assert.deepEqual(candidate.remotes[0],{type:'streamable-http',url:'https://zodiacs.org/mcp'});
assert.ok(!('packages' in candidate)&&!('_meta' in candidate),'No invented package or registry acceptance');
const observations=[];
for(const url of urls){
 const document=await schemaAt(url),validator=new Ajv({allErrors:true,strict:false});
 addFormats(validator);
 const validate=validator.compile(document.schema);
 assert.equal(validate(candidate),true,JSON.stringify(validate.errors));
 const rejected=[];
 for(const [name,mutate] of controls){
  const value=JSON.parse(JSON.stringify(candidate));mutate(value);
  assert.equal(validate(value),false,'Official schema accepted negative control: '+name);
  rejected.push({name,errors:validate.errors.map(e=>({instancePath:e.instancePath,keyword:e.keyword}))});
 }
 observations.push({url,bytes:document.bytes.length,sha256:sha256(document.bytes),candidateValid:true,rejected});
}
const report={
 schema:'zodiacs.private-registry-descriptor-validation.v1',
 observedAt:new Date().toISOString(),
 producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},
 candidate:{path:directory+'/server.json',bytes:bytes.length,sha256:sha256(bytes),name:candidate.name,version:candidate.version},
 upstreamSource,
 validator:{ajv:'8.17.1',formats:'3.0.1',dependencyLockSha256:sha256(readFileSync(resolve(work,'package-lock.json')))},
 observations,passed:true,
 publication:'unpublished preparation',
 limitations:[
  'Generic official JSON schemas only; no Registry publication or acceptance.',
  'Namespace ownership and publisher authentication remain unverified.',
  'No full MCP conformance, independent astronomy, private clearance or stable-release claim.',
  'Version 0.4.0 is the observed deployed MCP implementation, not a new engine or package release.'
 ]
};
const path=directory+'/schema-validation.json',output=Buffer.from(JSON.stringify(report,null,2)+'\n');
mkdirSync(directory,{recursive:true});writeFileSync(path,output);
console.log('PROGRAMME_FILE '+JSON.stringify({path,size:output.length,sha256:sha256(output),base64:output.toString('base64')}));
