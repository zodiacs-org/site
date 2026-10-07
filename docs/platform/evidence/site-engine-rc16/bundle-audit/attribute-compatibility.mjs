import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
const here=dirname(fileURLToPath(import.meta.url));const site=resolve(here,'../../../../..');
const gzip=code=>gzipSync(code,{level:9}).length;
const p=JSON.parse(readFileSync(resolve(here,'production-route-measurements.json')));
const row=p.routes.find(r=>r.route==='/compatibility/');
const oldFolder=resolve(site,'../site/dist/_astro');const newFolder=resolve(site,'dist/_astro');const oldFiles=readdirSync(oldFolder);
const comparable=[];
const stem=f=>f.replace(/\.[^.]+\.js$/,'');
for(const r of row.chunks){const role=r.file.startsWith('chunk-2OWGBT3O.')?'chunk-MFF3VKO3':stem(r.file);const matches=oldFiles.filter(n=>stem(n)===role&&n.endsWith('.js'));const f=oldFiles.includes(r.file)?r.file:matches.length===1?matches[0]:null;if(!f)throw Error('Unresolved old role '+role);const bytes=readFileSync(resolve(oldFolder,f));const oldGzip=gzip(bytes);comparable.push({role,rc15DefaultFile:f,rc15DefaultGzip:oldGzip,rc16ProductionFile:r.file,rc16ProductionGzip:r.gzip,change:r.gzip-oldGzip});}
const def=JSON.parse(readFileSync(resolve(here,'measurements.json'))).routes.find(r=>r.route==='/compatibility/');
const sameOtherNames=def.closure.filter(f=>!f.includes('/SynastryCalculator.')).join('\n')===row.closure.filter(f=>!f.includes('/SynastryCalculator.')).join('\n');if(!sameOtherNames)throw Error('Default/production changed other chunk names');
const curDefaultMain=def.gzip-row.gzip+row.chunks.find(c=>c.file.startsWith('SynastryCalculator.')).gzip;
const imports=code=>ts.createSourceFile('chunk.js',code,ts.ScriptTarget.Latest,false,ts.ScriptKind.JS).statements.flatMap(n=>(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteralLike(n.moduleSpecifier)?[n.moduleSpecifier.text]:[]);
function wheelClosure(folder){const entry=readdirSync(folder).filter(f=>/^RelationshipWheel\.[^.]+\.js$/.test(f));if(entry.length!==1)throw Error('Bad wheel entry');const rows=[];const seen=new Set();const visit=f=>{if(seen.has(f))return;seen.add(f);const code=readFileSync(resolve(folder,f),'utf8');const deps=imports(code);rows.push({file:f,gzip:gzip(code),imports:deps,ephemerisMarkers:['Value is not boolean:','Light-travel time solver did not converge'].filter(m=>code.includes(m))});for(const dep of deps)if(dep.startsWith('.'))visit(basename(dep));};visit(entry[0]);return{entry:entry[0],gzip:rows.reduce((s,r)=>s+r.gzip,0),chunks:rows};}
const result={rc15RecordedProduction:p.rc15Production['/compatibility/'],rc15ExistingDefaultTotal:comparable.reduce((s,r)=>s+r.rc15DefaultGzip,0),rc16PreviouslyMeasuredDefault:def.gzip,rc16Production:row.gzip,rc16DefaultMainInferred:curDefaultMain,method:'rc16 default and production route closures reference identical files except SynastryCalculator; original default closure is preserved in measurements.json. Compare current production non-Synastry chunks to rc15 existing default artifacts; no rc15 production chunk snapshot is claimed.',comparables:comparable,wheel:{rc15:wheelClosure(oldFolder),rc16:wheelClosure(newFolder)}};
writeFileSync(resolve(here,'compatibility-attribution.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({rc15Default:result.rc15ExistingDefaultTotal,rc16Default:def.gzip,rc16Production:row.gzip,overage:row.gzip-row.limitBytes,rc16DefaultMain:curDefaultMain,changedChunks:comparable.filter(r=>r.change),wheel:Object.fromEntries(Object.entries(result.wheel).map(([v,r])=>[v,{entry:r.entry,gzip:r.gzip,count:r.chunks.length,markers:r.chunks.filter(r=>r.ephemerisMarkers.length)}]))},null,2));
