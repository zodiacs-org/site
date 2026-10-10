import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {protectedPathLabels} from './phase1-scope-guard.mjs';
const root=process.argv[2],expected='51b2c0d3bafe8b23d0a7f54433cd0c89c9435818';
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8',shell:false}).trim(),expected);
const audit=JSON.parse(readFileSync('docs/platform/evidence/faq-source-purpose-20261010/native-source-ast.json','utf8'));
const judged=JSON.parse(readFileSync('docs/platform/evidence/faq-source-purpose-20261010/source-purpose-review.json','utf8'));
const edits=JSON.parse(readFileSync('docs/platform/evidence/faq-source-purpose-20261010/proposed-node-edits.json','utf8'));
assert.equal(audit.auditedSource,expected);assert.equal(judged.auditedSource,expected);
assert.equal(edits.length,94);assert.equal(new Set(edits.map(e=>e.path)).size,94);
const hash=b=>createHash('sha256').update(b).digest('hex');
function inspect(path,text){
 let declarations=0,calls=0;
 function parsed(code,kind=ts.ScriptKind.TS){
  const sf=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,kind);
  assert.equal(sf.parseDiagnostics.length,0,'Proposed syntax: '+path);
  function visit(n){
   if(ts.isPropertyAssignment(n)&&ts.isStringLiteral(n.name)&&n.name.text==='@type'&&ts.isStringLiteral(n.initializer)&&n.initializer.text==='FAQPage')declarations++;
   if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='homeTrustSchema')calls++;
   ts.forEachChild(n,visit);
  }visit(sf);
 }
 if(path.endsWith('.astro')){
  const m=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);assert.ok(m,'Frontmatter present: '+path);parsed(m[1]);
 }else if(path.endsWith('.html')){
  let scripts=0;
  for(const m of text.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
   JSON.parse(m[1]);parsed('const json='+m[1]+';');scripts++;
  }assert.ok(scripts,'Static JSON-LD present');
 }else parsed(text,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 return {declarations,calls};
}
const records=[];
for(const change of edits){
 const bytes=readFileSync(resolve(root,change.path)),before=bytes.toString('utf8');
 const known=judged.records.find(r=>r.path===change.path);assert.ok(known,'Reviewed source: '+change.path);
 assert.equal(bytes.length,known.bytes);assert.equal(hash(bytes),known.sha256);
 let after=before;let last=before.length+1;
 for(const e of [...change.edits].sort((a,b)=>b.start-a.start)){
  assert.ok(Number.isInteger(e.start)&&Number.isInteger(e.end)&&e.start>=0&&e.end<=last&&e.start<=e.end);
  assert.equal(before.slice(e.start,e.end),e.before,'Exact anchored edit: '+change.path);
  after=after.slice(0,e.start)+e.after+after.slice(e.end);last=e.start;
 }
 const prior=inspect(change.path,before),proposed=inspect(change.path,after);
 assert.equal(proposed.declarations,0,'Proposed FAQ declarations removed');
 assert.equal(proposed.calls,0,'Retired helper consumer removed');
 const declaration=audit.emitters.find(e=>e.path===change.path);
 if(declaration?.arrayElement){
  assert.equal(change.edits.length,1);assert.equal(change.edits[0].after,'');
  assert.ok(change.edits[0].start<=declaration.objectStart&&change.edits[0].end>=declaration.objectEnd);
  assert.equal(prior.declarations,1);
  if(change.path.endsWith('.astro')){
   const separator=/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
   assert.equal(before.slice(separator.exec(before)[0].length),after.slice(separator.exec(after)[0].length),'Visible template bytes unchanged');
  }
 }
 if(change.path.endsWith('.html')){
  const strip=text=>text.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,'');
  assert.equal(strip(before),strip(after),'Static visible body outside JSON-LD unchanged');
 }
 if(change.path==='src/lib/home-trust.ts')assert.ok(after.endsWith('\n}')||after.trimEnd().endsWith('}'));
 records.push({path:change.path,beforeSha256:hash(bytes),afterSha256:hash(Buffer.from(after)),beforeBytes:bytes.length,afterBytes:Buffer.byteLength(after),before:prior,proposed,protectedBy:protectedPathLabels(change.path),edits:change.edits});
}
assert.equal(records.reduce((n,r)=>n+r.before.declarations,0),88);
assert.equal(records.filter(r=>r.path.startsWith('src/pages/')&&r.before.calls===1).length,5);
assert.equal(records.find(r=>r.path==='src/islands/ChartTrust.test.tsx').before.calls,1);
const report={schema:'zodiacs.faq-node-removal-proposal.v1',auditedSource:expected,producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version,typescript:ts.version},records,controls:{all94SourceHashesVerified:true,all88DirectDeclarationsLocated:true,allProposedParserInputsValid:true,allProposedFAQDeclarationsRemoved:true,allSixRetiredConsumersRemoved:true,nonFAQTemplateBodyBytesUnchanged:true},limitations:['Proposal only: actual application target files are not written or committed by this script.','Validator still requires obsolete homepage FAQ metadata and needs a reviewed semantic purpose rule.','No rendered page-purpose/visibility equivalence, exhaustive built-route audit, scope allowance, deployment or S2 acceptance.']};
const path='docs/platform/evidence/faq-source-purpose-20261010/native-node-removal-proposal.json',out=Buffer.from(JSON.stringify(report,null,2)+'\n');
mkdirSync('docs/platform/evidence/faq-source-purpose-20261010',{recursive:true});writeFileSync(path,out);
console.log('PROGRAMME_FILE '+JSON.stringify({path,size:out.length,sha256:hash(out),base64:out.toString('base64')}));
