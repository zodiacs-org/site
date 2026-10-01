import { readFile, writeFile, mkdir, readdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import ts from 'typescript';
import * as esbuild from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '../../../../..');
const oldSite = resolve(site, '../site');
const runName = process.argv[2] ?? `audit-rerun-${new Date().toISOString().replace(/[^0-9]/g,'')}`;
if(!/^[a-z0-9-]+$/.test(runName))throw Error('Run label must use lowercase letters, numbers and hyphens');
// Package copies and emitted runtime bytes are transient, never evidence files.
const scratch = await mkdtemp(resolve(tmpdir(), 'zodiacs-rc16-bundle-audit-'));
const evidencePath = suffix => resolve(here, `${runName}-${suffix}`);
const canonicalPath = id => id.startsWith(scratch) ? `audit-inputs/${relative(scratch,id)}` : relative(site,id);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const gz = bytes => gzipSync(bytes, {level:9}).length;
const imports = code => ts.createSourceFile('chunk.js',code,ts.ScriptTarget.Latest,false,ts.ScriptKind.JS).statements.flatMap(n => (ts.isImportDeclaration(n)||ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteralLike(n.moduleSpecifier) ? [n.moduleSpecifier.text] : []);
async function closure(root) {
  const folder = resolve(root,'dist/_astro');
  const files = await readdir(folder);
  const full = files.filter(f=>/^full\..*\.js$/.test(f));
  if(full.length!==1) throw Error('Expected one full chunk');
  const rows = [], seen = new Set();
  async function visit(f) {
    if(seen.has(f)) return; seen.add(f);
    const code = await readFile(resolve(folder,f),'utf8');
    const deps = imports(code);
    rows.push({file:f,bytes:Buffer.byteLength(code),gzip:gz(code),sha256:sha(code),imports:deps});
    for(const dep of deps) if(dep.startsWith('.')) await visit(basename(dep));
  }
  await visit(full[0]);
  return {entry:full[0],gzip:rows.reduce((a,r)=>a+r.gzip,0),bytes:rows.reduce((a,r)=>a+r.bytes,0),rows};
}
const report = {node:process.version,method:'gzip level 9, summed per emitted static-closure chunk; standalone comparisons separately labelled',actual:{rc15:await closure(oldSite),rc16:await closure(site)},versions:{},archives:{},sourceChecks:{},standalone:{}};
for(const name of ['astro','astro/node_modules/vite','esbuild','rolldown']) {
  report.versions[name] = {};
  for(const [label,root] of [['rc15',oldSite],['rc16',site]]) report.versions[name][label]=JSON.parse(await readFile(resolve(root,'node_modules',name,'package.json'),'utf8')).version;
}
for(const file of ['src/lib/engine/full.ts','src/lib/engine/chart-adapter.ts','astro.config.mjs','scripts/report-bundles.mjs','budgets.json']) {
  const oldBytes = await readFile(resolve(oldSite,file));
  const newBytes = await readFile(resolve(site,file));
  report.sourceChecks[file]={identical:oldBytes.equals(newBytes),rc15:sha(oldBytes),rc16:sha(newBytes)};
}
for(const version of ['15','16']) {
  const key = 'rc'+version;
  const archive = resolve(site,`vendor/zodiacs-engine-0.1.1-rc.${version}.tgz`);
  const root = resolve(scratch,'archive-inputs',key);
  await mkdir(root,{recursive:true});
  execFileSync('tar',['-xzf',archive,'-C',root]);
  const packageRoot=resolve(root,'package');
  const pkg = JSON.parse(await readFile(resolve(packageRoot,'package.json'),'utf8'));
  const diffs = [];
  const installed = resolve(version==='15'?oldSite:site,'node_modules/@zodiacs/engine');
  for(const file of await readdir(resolve(packageRoot,'dist'))) {
    if(!file.endsWith('.js')) continue;
    const a=await readFile(resolve(packageRoot,'dist',file));
    const b=await readFile(resolve(installed,'dist',file));
    if(!a.equals(b)) diffs.push(file);
  }
  report.archives[key]={file:relative(site,archive),sha256:sha(await readFile(archive)),installedJsDifferences:diffs};
  const resolveEngine = id => id === 'astronomy-engine' ? resolve(site,'node_modules/astronomy-engine/esm/astronomy.js') : id === '@zodiacs/engine' || id.startsWith('@zodiacs/engine/') ? resolve(packageRoot,pkg.exports[id==='@zodiacs/engine'?'.':'.'+id.slice('@zodiacs/engine'.length)].import) : null;
  const es = await esbuild.build({absWorkingDir:site,entryPoints:[resolve(site,'src/lib/engine/full.ts')],bundle:true,format:'esm',platform:'browser',minify:true,write:false,metafile:true,logLevel:'error',plugins:[{name:'exact-archive',setup(build){build.onResolve({filter:/^(?:@zodiacs\/engine(?:\/|$)|astronomy-engine$)/},({path})=>({path:resolveEngine(path)}));}}]});
  const esJs=es.outputFiles.find(f=>!f.path.endsWith('.map'));
  await writeFile(resolve(scratch,`${key}-esbuild.js`),esJs.contents);
  const boundMetafile = JSON.parse(JSON.stringify(es.metafile).split(scratch).join('audit-inputs'));
  await writeFile(evidencePath(`${key}-esbuild-metafile.json`),JSON.stringify(boundMetafile,null,2)+'\n',{flag:'wx'});
  const {build}=await import(resolve(site,'node_modules/astro/node_modules/vite/dist/node/index.js'));
  const built=await build({configFile:false,root:site,publicDir:false,logLevel:'error',plugins:[{name:'exact-archive',enforce:'pre',resolveId:resolveEngine}],build:{write:false,minify:true,sourcemap:true,rolldownOptions:{input:resolve(site,'src/lib/engine/full.ts'),preserveEntrySignatures:'strict',output:{entryFileNames:'full.js'}}}});
  const chunks=(Array.isArray(built)?built.flatMap(v=>v.output):built.output).filter(v=>v.type==='chunk');
  report.standalone[key]={esbuild:{gzip:gz(esJs.contents),bytes:esJs.contents.length},vite:{gzip:chunks.reduce((sum,c)=>sum+gz(c.code),0),bytes:chunks.reduce((sum,c)=>sum+Buffer.byteLength(c.code),0),chunks:chunks.map(c=>({file:c.fileName,exports:c.exports,imports:c.imports,dynamicImports:c.dynamicImports,modules:Object.keys(c.modules).map(canonicalPath)}))}};
  for(const c of chunks) {
    await writeFile(resolve(scratch,`${key}-vite-${c.fileName}`),c.code);
    if(c.map) await writeFile(resolve(scratch,`${key}-vite-${c.fileName}.map`),c.map.toString());
  }
}

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

report.actual.deltaGzip=report.actual.rc16.gzip-report.actual.rc15.gzip;
report.standalone.deltaGzip={esbuild:report.standalone.rc16.esbuild.gzip-report.standalone.rc15.esbuild.gzip,vite:report.standalone.rc16.vite.gzip-report.standalone.rc15.vite.gzip};
report.budget={oldKb:31.6,oldBytes:31.6*1024,newBytesFor250Headroom:report.actual.rc16.gzip+250,newKbExact:(report.actual.rc16.gzip+250)/1024,preserveOldExactHeadroomKb:(31.6*1024+report.actual.deltaGzip)/1024};
await writeFile(evidencePath('measurements.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await rm(scratch,{recursive:true,force:true});
console.log(JSON.stringify(report,null,2));
