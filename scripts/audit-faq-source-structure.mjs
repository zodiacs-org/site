import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const root=process.argv[2],expectedSource='51b2c0d3bafe8b23d0a7f54433cd0c89c9435818';
assert.ok(root,'Exact audited source worktree is required');
const source=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8',shell:false}).trim();
assert.equal(source,expectedSource);
const judgement=JSON.parse(readFileSync('docs/platform/evidence/faq-source-purpose-20261010/source-purpose-review.json','utf8'));
assert.equal(judgement.auditedSource,source);
const paths=execFileSync('git',['-C',root,'ls-files','-z','src','public/astrofolio/index.html','scripts/build-build-report.mjs','scripts/validate-schema.mjs'],{encoding:'utf8',shell:false}).split('\0').filter(Boolean);
const hashes=[],emitters=[],consumers=[];
function parsed(path,text,code,offset,kind=ts.ScriptKind.TS){
 const sf=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,kind);
 assert.equal(sf.parseDiagnostics.length,0,'Valid parser input: '+path);
 function visit(node){
  if(ts.isPropertyAssignment(node)&&ts.isStringLiteral(node.name)&&node.name.text==='@type'&&ts.isStringLiteral(node.initializer)&&node.initializer.text==='FAQPage'){
   const object=node.parent,parent=object.parent,start=offset+object.getStart(sf),end=offset+object.end;
   const array=ts.isArrayLiteralExpression(parent);
   const line=text.slice(0,offset+node.getStart(sf)).split('\n').length;
   emitters.push({path,line,objectStart:start,objectEnd:end,parentKind:ts.SyntaxKind[parent.kind],arrayElement:array,arrayIndex:array?parent.elements.indexOf(object):null,arrayCount:array?parent.elements.length:null,sourceExcerpt:text.slice(start,Math.min(end,start+220))});
  }
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='homeTrustSchema')consumers.push({path,line:text.slice(0,offset+node.getStart(sf)).split('\n').length});
  ts.forEachChild(node,visit);
 }
 visit(sf);
}
for(const path of paths){
 if(!/\.(?:astro|ts|tsx|js|jsx|mjs|html)$/.test(path))continue;
 const bytes=readFileSync(resolve(root,path)),text=bytes.toString('utf8');
 const expected=judgement.records.find(r=>r.path===path);
 if(expected){
  assert.equal(bytes.length,expected.bytes,'Byte length: '+path);
  const digest=createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest,expected.sha256,'Byte digest: '+path);
  for(const item of expected.primaryEvidence)assert.equal(text.split('\n')[item.line-1].trim().slice(0,260),item.text,'Primary evidence: '+path);
  hashes.push({path,bytes:bytes.length,sha256:digest});
 }
 if(!text.includes('FAQPage')&&!text.includes('homeTrustSchema'))continue;
 if(path.endsWith('.astro')){
  const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if(match)parsed(path,text,match[1],text.indexOf(match[1]));
 }else if(path.endsWith('.html')){
  for(const match of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   if(!/type=["']application\/ld\+json["']/i.test(match[1]))continue;
   const raw=match[2];JSON.parse(raw);
   parsed(path,text,'('+raw+')',match.index+match[0].indexOf(raw)-1);
  }
 }else if(!path.startsWith('scripts/'))parsed(path,text,text,0,/\.tsx$/.test(path)?ts.ScriptKind.TSX:ts.ScriptKind.TS);
}
assert.equal(hashes.length,95,'Every reviewed source is byte-verified');
assert.equal(emitters.length,88,'Every direct emitter is parsed');
const knownHomePaths=new Set(['es','fr','it','pt','ru'].map(locale=>'src/pages/'+locale+'/index.astro'));
const reviewedConsumers=judgement.records.filter(r=>knownHomePaths.has(r.path));
for(const record of reviewedConsumers)assert.ok(consumers.some(c=>c.path===record.path),'Known shared-helper consumer: '+record.path);
const unreviewedConsumers=consumers.filter(c=>!judgement.records.some(r=>r.path===c.path));
console.log('FAQ_SHARED_CONSUMERS '+JSON.stringify({consumers,unreviewedConsumers}));
assert.ok(emitters.every(e=>e.arrayElement||e.path==='src/lib/home-trust.ts'),'Unexpected emitter shape requires explicit review');
const report={schema:'zodiacs.faq-native-source-ast.v1',producer:{source:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version,typescript:ts.version},auditedSource:source,verifiedSourceHashes:hashes,emitters,sharedHomeConsumers:consumers,unreviewedConsumers,controls:{everyReviewedSourceByteVerified:true,primaryEvidenceLinesVerified:true,allDirectNodesParsed:true,knownSharedConsumersVerified:true,allSharedConsumersReviewed:unreviewedConsumers.length===0,objectParentsUnderstood:true},limitations:['Native source parsing and source-byte verification only; the semantic decisions remain the source reviewer\'s judgement.','No build, browser, compiled-route coverage, rendered visibility, question/answer equivalence, correction, protected-scope allowance, acceptance or deployment is claimed.']};
const output='docs/platform/evidence/faq-source-purpose-20261010/native-source-ast.json';
mkdirSync('docs/platform/evidence/faq-source-purpose-20261010',{recursive:true});
const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');writeFileSync(output,bytes);
console.log('FAQ_NATIVE_AST '+JSON.stringify({source,verifiedSources:hashes.length,emitters:emitters.length,arrayElements:emitters.filter(e=>e.arrayElement).length,sharedHomeConsumers:consumers.length,controls:report.controls}));
console.log('PROGRAMME_FILE '+JSON.stringify({path:output,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')}));
