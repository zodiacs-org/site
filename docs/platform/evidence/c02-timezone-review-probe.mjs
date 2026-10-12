import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const root=fileURLToPath(new URL('../../../', import.meta.url));
// It loads the site's own resolver of its day, which #723 replaced with the engine's.
if(!fs.existsSync(path.join(root,'src/lib/time/tz-history-load.ts'))){
  console.error('This probe reads the site\'s former resolver, which #723 replaced with @zodiacs/engine/geo. Run it from a checkout before that change, such as ec0451ff.');
  process.exit(2);
}
const require=createRequire(path.join(root,'package.json'));
const ts=require('typescript');
const cache=new Map();
const sources={};
function load(relative){
  const file=path.join(root,relative);
  if(cache.has(file))return cache.get(file).exports;
  const source=fs.readFileSync(file,'utf8');
  sources[relative]=crypto.createHash('sha256').update(source).digest('hex');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};cache.set(file,module);
  new Function('module','exports','require',code)(module,module.exports,(specifier)=>load(path.relative(root,path.resolve(path.dirname(file),`${specifier}.ts`))));
  return module.exports;
}
const {resolveLocalToUtc,offsetAt}=load('src/lib/time/localToUtc.ts');
let coercions=0;
const tricky={toString(){coercions+=1;throw new Error('Synthetic private string must never leak');}};
const bad=[undefined,null,'',' ','Synthetic/Private_Zone','UTC\n',123,true,{},['UTC'],new String('UTC'),Symbol('private'),tricky];
const failures=[];
const rejectionCases=[];
for(const [index,zone] of bad.entries()) for(const api of ['resolveLocalToUtc','offsetAt']){
  const row={index,type:typeof zone,api};
  try {row.returned=api==='resolveLocalToUtc'?resolveLocalToUtc('2001-01-01','12:00',zone).utc.toISOString():offsetAt(zone,Date.parse('2001-01-01T12:00:00Z'));failures.push({...row,kind:'accepted-invalid-zone'});}
  catch(error){row.error=error.constructor.name;row.message=error.message;if(!(error instanceof RangeError)||/Synthetic|private|Private_Zone/.test(error.message))failures.push({...row,kind:'unsafe-or-wrong-error'});}
  rejectionCases.push(row);
}
if(coercions)failures.push({kind:'input-coercion',coercions});
const controls=[
 ['UTC','2001-01-01','12:00','2001-01-01T12:00:00.000Z',0,[]],
 ['Etc/UTC','0000-02-29','12:00','0000-02-29T12:00:00.000Z',0,[]],
 ['GMT','0099-12-31','12:00','0099-12-31T12:00:00.000Z',0,[]],
 ['utc','0100-01-01','12:00','0100-01-01T12:00:00.000Z',0,[]],
 ['US/Eastern','2024-11-03','01:30','2024-11-03T05:30:00.000Z',-240,['dst-fold']],
 ['America/New_York','2024-03-10','02:30','2024-03-10T07:30:00.000Z',-240,['dst-gap']],
 ['Asia/Kolkata','2001-01-01','12:00','2001-01-01T06:30:00.000Z',330,[]],
 ['Etc/GMT-1','0000-01-01','00:30','-000001-12-31T23:30:00.000Z',60,[]],
 ['America/Mexico_City','1907-07-06','08:30','1907-07-06T15:06:36.000Z',-396.6,['lmt']],
].map(([zone,date,time,expected,offset,flags])=>{
 const r=resolveLocalToUtc(date,time,zone);const row={zone,date,time,actual:r.utc.toISOString(),offset:r.offsetMinutes,flags:r.flags};
 if(row.actual!==expected||Math.abs(row.offset-offset)>1e-9||JSON.stringify(row.flags)!==JSON.stringify(flags)||offsetAt(zone,r.utc.getTime())!==row.offset)failures.push({kind:'valid-zone-control',...row,expected,expectedOffset:offset,expectedFlags:flags});
 return row;
});
console.log(JSON.stringify({observedAt:new Date().toISOString(),node:process.version,icu:process.versions.icu,tz:process.versions.tz,hostTimezone:Intl.DateTimeFormat().resolvedOptions().timeZone,sources,rejectionCases,coercions,controls,failures},null,2));
process.exitCode=failures.length?1:0;
