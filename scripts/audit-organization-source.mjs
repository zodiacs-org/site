import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve('current-main'),expected='ac09a5fab7e6674039876e15f4db4bc29b09e79f';
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),expected);
const id='https://zodiacs.org/#org';
let found=spawnSync('rg',['--files-with-matches','--fixed-strings',id,'src','public','scripts'],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
if(found.error?.code==='ENOENT')found=spawnSync('git',['grep','-l','--fixed-strings',id,'--','src','public','scripts'],{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
assert.ok(!found.error&&[0,1].includes(found.status),'Source search failed');
const paths=found.stdout.trim().split('\n').filter(Boolean).filter(path=>/\.(?:html|astro|mjs|js|ts|json)$/.test(path)&&!path.includes('.test.')&&!path.includes('/tests/')).sort();
const files=[];
for(const path of paths){
 const content=readFileSync(resolve(root,path),'utf8'),references=[];
 let start=0;
 while((start=content.indexOf(id,start))>=0){
  const before=content.lastIndexOf('{',start),after=content.indexOf('}',start);
  const shape=before>=0&&after>=start&&after-before<=3000?content.slice(before,after+1):'';
  const name=shape.match(/(?:["']name["']|\bname)\s*:\s*["']([^"'\\\r\n]{1,100})["']/)?.[1]??null;
  references.push({line:content.slice(0,start).split('\n').length,literalName:name,classification:name===null?'dynamic-or-id-only':name==='Zodiacs.org'?'canonical-literal':'noncanonical-literal'});
  start+=id.length;
 }
 files.push({path,sha256:createHash('sha256').update(content).digest('hex'),references});
}
const report={schema:'zodiacs.organization-source-audit.v1',producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},auditedSource:expected,files,limitations:['Read-only source locator audit; lexical context does not establish built JSON-LD semantics.','Dynamic/id-only references require the full built-schema gate; public source fields only, no private scan.']};
const content=Buffer.from(JSON.stringify(report,null,2)+'\n');writeFileSync('organization-source-audit.json',content);
console.log('PROGRAMME_FILE '+JSON.stringify({path:'docs/platform/evidence/platform-identities-20261009/organization-source-audit.json',size:content.length,sha256:createHash('sha256').update(content).digest('hex'),base64:content.toString('base64')}));
