import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const here=dirname(fileURLToPath(import.meta.url)); const site=resolve(here,'../../../../..');
const gz=code=>gzipSync(code,{level:9}).length;
const imports = code => ts.createSourceFile('chunk.js',code,ts.ScriptTarget.Latest,false,ts.ScriptKind.JS).statements.flatMap(n => (ts.isImportDeclaration(n)||ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier) ? [n.moduleSpecifier.text] : []);
const snapshot=process.argv[2]??'production';
if(!/^[a-z0-9-]+$/.test(snapshot))throw Error('Snapshot label must use lowercase letters, numbers and hyphens');
const report={label:snapshot,node:process.version};
// Independently inspect every budgeted route's static closure with the gate's
// syntax-aware import semantics. Dynamic imports remain outside the closure.
const budgets = JSON.parse(await readFile(resolve(site,'budgets.json'),'utf8'));
const chunkFiles = await readdir(resolve(site,'dist/_astro'));
const builtChunks = new Map(await Promise.all(chunkFiles.filter(f=>f.endsWith('.js')).map(async f=>['/_astro/'+f,await readFile(resolve(site,'dist/_astro',f),'utf8')])));
const localJs = (specifier,base) => { try {const u=new URL(specifier,'https://zodiacs.org'+base);return u.origin==='https://zodiacs.org'&&u.pathname.endsWith('.js')?u.pathname:null;} catch{return null;} };
const attr=(tag,name)=>tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`,'i'))?.slice(1).find(v=>v!==undefined)??null;
report.routes=[];
for(const [route,kib] of Object.entries(budgets).filter(([k])=>k.startsWith('/'))) {
  const html=await readFile(resolve(site,'dist','.'+route,route.endsWith('/')?'index.html':''),'utf8');
  const roots=new Set(); const add=v=>{const p=v&&localJs(v,route);if(p)roots.add(p);};
  for(const m of html.matchAll(/<script\b[^>]*>/gi)) if((attr(m[0],'type')??'').toLowerCase()==='module')add(attr(m[0],'src'));
  for(const m of html.matchAll(/<link\b[^>]*>/gi)) {const rel=(attr(m[0],'rel')??'').toLowerCase().split(/\s+/);if(rel.includes('modulepreload')||(rel.includes('preload')&&(attr(m[0],'as')??'').toLowerCase()==='script'))add(attr(m[0],'href'));}
  for(const m of html.matchAll(/<astro-island\b[^>]*>/gi)){add(attr(m[0],'component-url'));add(attr(m[0],'renderer-url'));}
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if((attr('<script'+m[1]+'>','type')??'').toLowerCase()==='module')for(const spec of imports(m[2]))add(spec);
  const seen=new Set();const missing=[];
  const visit=p=>{if(seen.has(p))return;seen.add(p);const code=builtChunks.get(p);if(code===undefined){missing.push(p);return;}for(const spec of imports(code)){const next=localJs(spec,p);if(next)visit(next);}};
  roots.forEach(visit);
  const gzip=[...seen].reduce((a,p)=>a+(builtChunks.has(p)?gz(builtChunks.get(p)):0),0);
  const engine=[...seen].filter(p=>/\/_astro\/full\.[^/]+\.js$/.test(p)||['Value is not boolean:','Light-travel time solver did not converge'].some(m=>builtChunks.get(p)?.includes(m)));
  report.routes.push({route,gzip,limitBytes:kib*1024,headroomBytes:kib*1024-gzip,passes:gzip<=kib*1024&&missing.length===0,engineChunks:engine,missing,closure:[...seen]});
}


for(const row of report.routes) row.chunks=row.closure.map(path=>({file:basename(path),gzip:gz(builtChunks.get(path)),bytes:Buffer.byteLength(builtChunks.get(path)),sha256:createHash('sha256').update(builtChunks.get(path)).digest('hex'),imports:imports(builtChunks.get(path))}));
const oldReport=JSON.parse(await readFile(resolve(site,'docs/platform/evidence/site-engine-rc15/validation.json'),'utf8'));
report.rc15Production=oldReport.bundleBudgets.productionFlags.routes;
function moduleClosure(pattern) {
  const roots=[...builtChunks.keys()].filter(path=>pattern.test(path));
  if(roots.length!==1)throw Error('Expected exactly one module root for '+pattern);
  const seen=new Set();const chunks=[];
  const visit=path=>{if(seen.has(path))return;seen.add(path);const code=builtChunks.get(path);if(code===undefined)throw Error('Missing chunk '+path);const deps=imports(code);chunks.push({file:basename(path),gzip:gz(code),bytes:Buffer.byteLength(code),sha256:createHash('sha256').update(code).digest('hex'),imports:deps,ephemerisMarkers:['Value is not boolean:','Light-travel time solver did not converge'].filter(m=>code.includes(m))});for(const dep of deps){const next=localJs(dep,path);if(next)visit(next);}};
  visit(roots[0]);return{entry:roots[0],gzip:chunks.reduce((sum,c)=>sum+c.gzip,0),chunks};
}
report.engine=moduleClosure(/\/_astro\/full\.[^/]+\.js$/);
report.engine.limitBytes=budgets['engine-chunk']*1024;
report.engine.headroomBytes=report.engine.limitBytes-report.engine.gzip;
report.engine.rc15BaselineBytes=32108;
report.engine.finalMeasuredGrowth=report.engine.gzip-report.engine.rc15BaselineBytes;
report.engine.allowanceIncreaseBytes=report.engine.limitBytes-31.6*1024;
report.relationshipWheel=moduleClosure(/\/_astro\/RelationshipWheel\.[^/]+\.js$/);
await writeFile(resolve(here,`${snapshot}-route-measurements.json`),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report.routes.find(r=>r.route==='/compatibility/'),null,2));
