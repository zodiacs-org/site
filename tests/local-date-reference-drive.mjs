/** Native caller regression: actual islands, resolver, receipt and ephemeris.
 * Only loader timing, synthetic city search and explicitly recorded fault/call
 * probes are controlled. No complete-date or numerical-oracle claim follows.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
const root = resolve(import.meta.dirname, '..');
const out = resolve(process.env.OUT_DIR ?? resolve(root, 'tests/visual/artifacts/local-date-reference'));
const baseline = process.env.REFERENCE_BASELINE_DIR;
await mkdir(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['src/lib/time/localToUtc.ts', 'src/islands/ChartCalculator.tsx', 'src/islands/MoonPhaseTool.tsx', ...['en','es','fr','it','pt','ru'].map(locale=>`src/lib/i18n/ui/${locale}.ts`)];
// The optional before-C014 baseline includes its own caller catalog keys.
const baselineSourcePaths = sourcePaths.filter(path => path !== 'src/lib/time/localToUtc.ts');
const identity = await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(root,path)))})));
const entry = `
import { h, render } from 'preact';
import ChartCalculator from './src/islands/ChartCalculator';
import MoonPhaseTool from './src/islands/MoonPhaseTool';
import * as actual from './src/lib/engine/full';
import en from './src/lib/i18n/ui/en';import es from './src/lib/i18n/ui/es';import fr from './src/lib/i18n/ui/fr';import it from './src/lib/i18n/ui/it';import pt from './src/lib/i18n/ui/pt';import ru from './src/lib/i18n/ui/ru';
import { RUSSIAN_RUNTIME } from './src/lib/i18n/ru-runtime/server';
const catalogs={en,es,fr,it,pt,ru};
window.__referenceEvents=[];window.__referenceOutputs={};let pending=null;
const engine={...actual,
 computeChart(input){window.__referenceEvents.push({kind:'legacyNatal'});const result=actual.computeChart(input);window.__referenceOutputs.chart=JSON.stringify(result);return result;},
 computeBodies(utc){window.__referenceEvents.push({kind:'bodies',utc:utc.toISOString()});const result=actual.computeBodies(utc);(window.__referenceOutputs.endpoints??=[]).push(result);return result;},
 bodyLongitude(body,utc){const value=actual.bodyLongitude(body,utc);window.__referenceEvents.push({kind:'body',body,utc:utc.toISOString(),value});(window.__referenceOutputs.bodies??=[]).push({body,utc:utc.toISOString(),value});return value;},
};
window.referenceLoadEngine=()=>pending?pending.promise:Promise.resolve(engine);
window.fixture={city:null,failMembership:false,
 reset(){window.__referenceEvents=[];window.__referenceOutputs={};},
 hold(){let done;const promise=new Promise(resolve=>done=resolve);pending={promise,done};},
 release(){const old=pending;pending=null;old?.done(engine);},
 mount(mode,locale){window.__ZDX_UI__={locale,messages:catalogs[locale]};window.__ZDX_RU__={locale:'ru',data:RUSSIAN_RUNTIME};render(h(mode==='chart'?ChartCalculator:MoonPhaseTool,mode==='chart'?{mode:'full',locale}:{locale}),document.getElementById('mount'));},
 unmount(){render(null,document.getElementById('mount'));},
};
if(window.__referenceBootstrap?.holdEngine)window.fixture.hold();
const params=new URL(location.href).searchParams;window.fixture.mount(params.get('mode')??'chart',params.get('locale')??'en');
`;
const bundles = new Map();
for (const variant of baseline ? ['baseline', 'candidate'] : ['candidate']) {
 const instrumentation=[];
 const result=await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root},outfile:resolve(out,variant+'.js'),bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',jsxImportSource:'preact',define:{'import.meta.env':'{}'},metafile:true,
 plugins:[{name:'declared-caller-probes',setup(builder){
  builder.onResolve({filter:/lib\/hooks\/useEngine$/},()=>({path:'loader',namespace:'reference'}));
  builder.onResolve({filter:/lib\/geo\/search$/},()=>({path:'places',namespace:'reference'}));
  builder.onLoad({filter:/.*/,namespace:'reference'},({path})=>({contents:path==='loader'?'export function useEngine(){return ()=>window.referenceLoadEngine();}':'export const preloadIndex=async()=>{};export const searchCities=async q=>q? [window.fixture.city].filter(Boolean):[];'}));
  builder.onLoad({filter:/\/(?:islands\/(?:ChartCalculator|MoonPhaseTool)\.tsx|lib\/i18n\/ui\/(?:en|es|fr|it|pt|ru)\.ts)$/},async({path})=>{
   const relative=path.slice(root.length+1),selected=variant==='baseline'?resolve(baseline,relative):path;
   return {contents:await readFile(selected,'utf8'),loader:path.endsWith('.tsx')?'tsx':'ts',resolveDir:dirname(path)};
  });
  builder.onLoad({filter:/\/lib\/(?:chart-date-certainty|time\/localToUtc|engine\/(?:portable|calculator-receipt))\.ts$/},async({path})=>{
   let text=await readFile(path,'utf8');const originalSha256=hash(text);
   if(path.endsWith('/localToUtc.ts')){
    text=text.replace('): LocalTimeResolution {',"): LocalTimeResolution {\n  window.__referenceEvents.push({kind:'resolve',date,time,zone:tz});");
    text=text.replace('export function localDateContainsUtc(date: string, utc: Date, timeZone: string): boolean {\n  try {',"export function localDateContainsUtc(date: string, utc: Date, timeZone: string): boolean {\n  window.__referenceEvents.push({kind:'contains'});\n  try {\n    if(window.fixture.failMembership)throw new Error('Synthetic private formatter failure');");
   } else if(path.endsWith('/chart-date-certainty.ts')){
    text=text.replace('export function localDateEndpointsUtc(date: string, timeZone: string): LocalDateEndpoints {',"export function localDateEndpointsUtc(date: string, timeZone: string): LocalDateEndpoints {\n  window.__referenceEvents.push({kind:'endpoints'});");
   } else if(path.endsWith('/portable.ts')){
    text=text.replace('const nativeChart = natalChart(input);',"window.__referenceEvents.push({kind:'publicNatal'});\n    const nativeChart = natalChart(input);\n    window.__referenceOutputs.native=JSON.stringify(nativeChart);");
   } else {
    text=text.replace('export function computeCalculatorReceipt(input: BirthInput, local: CalculatorWallTime) {',"export function computeCalculatorReceipt(input: BirthInput, local: CalculatorWallTime) {\n  window.__referenceEvents.push({kind:'receiptBoundary'});");
   }
   instrumentation.push({path:path.slice(root.length+1),originalSha256,instrumentedSha256:hash(text)});
   await writeFile(resolve(out,variant+'-'+path.split('/').at(-1)+'.probe-source.log'),text);
   return {contents:text,loader:'ts',resolveDir:dirname(path)};
  });
 }}]});
 const script=result.outputFiles.find(file=>file.path.endsWith('.js')).contents;
 const css=result.outputFiles.find(file=>file.path.endsWith('.css'))?.contents??new Uint8Array();
 const inputs=await Promise.all(Object.keys(result.metafile.inputs).filter(path=>!path.startsWith('<')&&!path.startsWith('reference:')).map(async path=>{
  const override=variant==='baseline'&&baselineSourcePaths.includes(path)?resolve(baseline,path):resolve(root,path);
  const bytes=await readFile(override);return {path,bytes:bytes.length,sha256:hash(bytes),...(override!==resolve(root,path)?{sourceOverride:override}:{})};
 }));
 bundles.set(variant,{script,css});await writeFile(resolve(out,variant+'.js'),script);await writeFile(resolve(out,variant+'.css'),css);
 await writeFile(resolve(out,variant+'-build.json'),JSON.stringify({bundleSha256:hash(script),cssSha256:hash(css),inputs,instrumentation,metafile:result.metafile},null,2)+'\n');
}
await writeFile(resolve(out,'fixture-entry.tsx.log'),entry);
const server=createServer((req,res)=>{
 const url=new URL(req.url,'http://local'),variant=url.pathname.includes('baseline')?'baseline':'candidate',bundle=bundles.get(variant);
 if(url.pathname.endsWith('.js')){res.setHeader('Content-Type','text/javascript');res.end(bundle.script);}
 else if(url.pathname.endsWith('.css')){res.setHeader('Content-Type','text/css');res.end(bundle.css);}
 else{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><title>Local-date reference fixture</title><link rel="stylesheet" href="/${variant}.css"><div id="mount"></div><script src="/${variant}.js"></script>`);}
});
let browser,origin;const contexts=[],results=[],requests=[];
const skipped=[['2011-12-30','Pacific/Apia',-13.83,-171.77],['1993-08-21','Pacific/Kwajalein',9.08,167.33],['1994-12-31','Pacific/Kiritimati',1.87,-157.43],['1844-12-31','Pacific/Guam',13.46,144.75]];
async function setup(mode,variant='candidate',locale='en',fragment='',bootstrap=null){
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',timezoneId:'UTC'});contexts.push(context);
 await context.route('**/*',route=>{const url=route.request().url();requests.push({variant,mode,url,method:route.request().method()});return url.startsWith(origin+'/')?route.continue():route.abort();});
 if(bootstrap)await context.addInitScript(value=>{
  window.__referenceBootstrap=value;localStorage.setItem('zodiacs.profile.v1',JSON.stringify(value.profile));window.__referenceAccess=true;
  const reader=Object.freeze({canRead:()=>window.__referenceAccess});Object.defineProperty(window,'zodiacsProfileAccess',{get:()=>reader,set:()=>{},configurable:true});
 },bootstrap);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(origin+'/'+variant+'?mode='+mode+'&locale='+locale+fragment);await page.locator(mode==='chart'?'#birth-date':'#mp-date').waitFor();
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 return {context,page,mode,variant,locale,errors};
}
async function fill(s,date,zone='UTC',known=false,coords=[13.75,100.5]){
 const {page,mode}=s;await page.locator(mode==='chart'?'#birth-date':'#mp-date').fill(date);
 if(mode==='chart')await page.locator('.calc__form input[type=checkbox]').setChecked(!known);
 if(known)await page.locator(mode==='chart'?'#birth-time':'#mp-time').fill('12:00');
 else if(mode==='moon')await page.locator('#mp-time').fill('');
 if(zone){
  if(await page.locator('.place__clear').count())await page.locator('.place__clear').click();
  await page.evaluate(({zone,coords})=>{window.fixture.city={name:'Synthetic place',admin1:'',country:'',tz:zone,lat:coords[0],lon:coords[1],pop:0};},{zone,coords});
  await page.locator(mode==='chart'?'#place':'#mp-place').fill('Synthetic');await page.locator('[role=listbox] [role=option]').first().click();
 }
}
async function settle(s){await s.page.waitForFunction(()=>document.querySelector('.calc__form')?.getAttribute('aria-busy')==='false');await s.page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));}
async function submit(s){await s.page.locator('.calc__submit').click();await settle(s);}
async function data(s){return s.page.evaluate(()=>({events:window.__referenceEvents,outputs:window.__referenceOutputs,result:!!document.querySelector('.calc__result'),context:window.zodiacsPostChartContext??null,error:document.querySelector('.calc__error')?.textContent??'',receipt:!!document.querySelector('[data-calculation-receipt-export]'),share:!!document.querySelector('[data-share-card]'),save:!!document.querySelector('[data-save-chart]'),profile:localStorage.getItem('zodiacs.profile.v1')}));}
function assertCleared(value){assert.equal(value.result,false);assert.equal(value.context,null);assert.equal(value.receipt,false);assert.equal(value.share,false);assert.equal(value.save,false);assert.equal(value.profile,null);}
async function group(name,fn){try{const detail=await fn();results.push({name,passed:true,detail});}catch(error){results.push({name,passed:false,error:String(error.stack??error)});}console.log(JSON.stringify({name,passed:results.at(-1).passed}));}
try{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:await findChromium(),headless:true,args:STABLE_CHROMIUM_ARGS});
 for(const mode of ['chart','moon'])for(const [date,zone,lat,lon] of skipped)await group(mode+' skipped '+zone,async()=>{
  let original=null;
  if(baseline){const old=await setup(mode,'baseline');try{await fill(old,date,zone,false,[lat,lon]);await submit(old);original=await data(old);assert.equal(original.result,true);assert.ok(original.events.some(row=>['publicNatal','legacyNatal','body'].includes(row.kind)));assert.deepEqual(old.errors,[]);await old.page.screenshot({path:resolve(out,mode+'-'+zone.replaceAll('/','-')+'-original.png'),fullPage:true});}finally{await old.context.close();}}
  const s=await setup(mode);try{
   await fill(s,'2000-01-01',zone,false,[lat,lon]);await submit(s);const initial=await data(s);assert.equal(initial.result,true);if(mode==='chart'){assert.equal(initial.receipt,true);assert.ok(initial.context);}
   await fill(s,date,zone,false,[lat,lon]);await s.page.evaluate(()=>window.fixture.reset());await submit(s);
   await s.page.waitForFunction(()=>document.activeElement===document.querySelector('.calc__error'));
   const rejected=await data(s);assertCleared(rejected);
   assert.equal(rejected.error,'We couldn’t establish a calculation time within this local date. Check the date and place.');
   assert.deepEqual(rejected.events.map(row=>row.kind),['resolve','contains']);assert.equal(rejected.events[0].time,'12:00');
   assert.equal(await s.page.locator(mode==='chart'?'#birth-date':'#mp-date').inputValue(),date);
   await s.page.screenshot({path:resolve(out,mode+'-'+zone.replaceAll('/','-')+'-rejected.png'),fullPage:true});
   await fill(s,'2000-01-02',zone,false,[lat,lon]);await s.page.evaluate(()=>window.fixture.reset());await submit(s);assert.equal((await data(s)).result,true);assert.deepEqual(s.errors,[]);
   return {original,rejected,recovered:await data(s)};
  }finally{await s.context.close();}
 });
 const positives=[['ordinary','2000-02-29','UTC',false],['repeated-Apia','1892-07-04','Pacific/Apia',false],['repeated-Kwajalein','1969-09-30','Pacific/Kwajalein',false],['same-date-gap','2012-10-07','Australia/Lord_Howe',false],['known-skipped','2011-12-30','Pacific/Apia',true]];
 for(const mode of ['chart','moon'])for(const [label,date,zone,known] of positives)await group(mode+' preserved '+label,async()=>{
  const observations={};for(const variant of bundles.keys()){
   const s=await setup(mode,variant);try{await fill(s,date,zone,known);await submit(s);const value=await data(s);assert.equal(value.result,true);assert.deepEqual(s.errors,[]);observations[variant]=value;}finally{await s.context.close();}
  }
  if(observations.baseline){
   // Reference calculations are unchanged. Former endpoint confidence samples
   // are intentionally omitted; compare every primary output exactly.
   const {endpoints:oldSamples,bodies:oldBodies,...oldReference}=observations.baseline.outputs;
   const {endpoints:newSamples,bodies:newBodies,...newReference}=observations.candidate.outputs;
   assert.deepEqual(newReference,oldReference);
   assert.equal(newSamples,undefined);
   if(mode==='moon') {
    assert.equal(newBodies.length,2);
    assert.deepEqual(newBodies,oldBodies.slice(0,2));
   } else assert.deepEqual(newBodies,oldBodies);
  }
  if(mode==='chart'){
   assert.equal(observations.candidate.events.filter(row=>row.kind==='publicNatal').length,1);
   assert.equal(observations.candidate.events.filter(row=>row.kind==='endpoints').length,0);
   assert.equal(observations.candidate.receipt,true);
  }
  if(known)assert.ok(observations.candidate.events.every(row=>row.kind!=='contains'));
  return {sameBrowserBaselineEquality:!!observations.baseline,observations};
 });
 await group('no-city UTC Moon remains independent',async()=>{
  const s=await setup('moon');try{await fill(s,'2011-12-30',null,false);await submit(s);const value=await data(s);assert.equal(value.result,true);assert.ok(value.events.every(row=>!['resolve','contains'].includes(row.kind)));return value;}finally{await s.context.close();}
 });
 for(const locale of ['en','es','fr','it','pt','ru'])await group('dedicated message '+locale,async()=>{
  const s=await setup('moon','candidate',locale);try{await fill(s,'2011-12-30','Pacific/Apia');await submit(s);const value=await data(s);assert.equal(value.result,false);const expected=await s.page.evaluate(()=>window.__ZDX_UI__.messages.localDateReferenceError);assert.equal(value.error,expected);return {message:value.error,events:value.events};}finally{await s.context.close();}
 });
 for(const mode of ['chart','moon'])await group(mode+' formatter-failure before numerical work',async()=>{
  const s=await setup(mode);try{await fill(s,'2000-01-01');await submit(s);assert.equal((await data(s)).result,true);await s.page.evaluate(()=>{window.fixture.reset();window.fixture.failMembership=true;});await submit(s);const value=await data(s);assertCleared(value);assert.deepEqual(value.events.map(row=>row.kind),['resolve','contains']);assert.equal(value.error,'We couldn’t establish a calculation time within this local date. Check the date and place.');await s.page.evaluate(()=>{window.fixture.reset();window.fixture.failMembership=false;});await submit(s);assert.equal((await data(s)).result,true);return {value,sameInputRetrySucceeded:true};}finally{await s.context.close();}
 });
 for(const mode of ['chart','moon'])for(const action of ['edit','replacement','unmount'])await group(mode+' delayed skipped reference '+action,async()=>{
  const s=await setup(mode);try{
   await fill(s,'2011-12-30','Pacific/Apia');await s.page.evaluate(()=>{window.fixture.reset();window.fixture.hold();});await s.page.locator('.calc__submit').click();
   assert.equal(await s.page.locator('.calc__form').getAttribute('aria-busy'),'true');
   if(action==='unmount')await s.page.evaluate(()=>window.fixture.unmount());
   else await s.page.locator(mode==='chart'?'#birth-date':'#mp-date').fill('2000-01-01');
   if(action==='replacement')await s.page.locator('.calc__submit').click();
   await s.page.evaluate(()=>window.fixture.release());
   if(action==='unmount')await s.page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));else await settle(s);
   const value=await data(s);
   if(action==='replacement'){
    assert.equal(value.result,true);assert.equal(value.error,'');assert.equal(value.events.filter(row=>row.kind==='contains').length,1);
    assert.ok(value.events.filter(row=>row.kind==='resolve').every(row=>row.date!=='2011-12-30'));
    if(mode==='chart')assert.equal(value.events.filter(row=>row.kind==='publicNatal').length,1);
   }else{
    assertCleared(value);assert.deepEqual(value.events,[]);assert.equal(value.error,'');
    if(action==='unmount'){assert.equal(await s.page.locator('#mount').innerText(),'');await s.page.evaluate(mode=>window.fixture.mount(mode,'en'),mode);await fill(s,'2000-01-01');}
    await submit(s);assert.equal((await data(s)).result,true);
   }
   assert.deepEqual(s.errors,[]);return {stale:value,recoverySucceeded:true};
  }finally{await s.context.close();}
 });
 await group('positions-only imports perform no date or numerical work',async()=>{
  const token='2.'+Buffer.from(JSON.stringify({b:Array.from({length:12},(_,index)=>index*27),h:'w',v:'0.1.1-rc.6'})).toString('base64url');
  const s=await setup('chart','candidate','en','#p='+token);try{await s.page.locator('[data-positions-only]').waitFor();const value=await data(s);assert.deepEqual(value.events,[]);assert.equal(value.receipt,false);assert.equal(value.context,null);assert.equal(value.profile,null);assert.deepEqual(s.errors,[]);return value;}finally{await s.context.close();}
 });
 await group('profile revoke fences a pending unknown-time skipped reference',async()=>{
  const id='10000000-0000-4000-8000-000000000001',stamp='2026-01-01T00:00:00.000Z';
  const profile={version:1,settings:{houseSystem:'whole'},charts:[{id,name:'Synthetic private chart',relationship:'self',createdAt:stamp,updatedAt:stamp,birth:{date:'2011-12-30',time:null,timeKnown:false,place:{name:'Synthetic Apia',admin1:'',country:'WS',lat:-13.83,lon:-171.77,tz:'Pacific/Apia'}},summary:{engineVersion:'0.1.1-rc.6',utcISO:'2011-12-30T22:00:00.000Z',houseSystem:'whole',bodies:[],angles:null,flags:['no-time']}}]};
  const s=await setup('chart','candidate','en','#profileChartId='+id,{profile,holdEngine:true});try{
   await s.page.waitForFunction(()=>document.querySelector('.calc__form')?.getAttribute('aria-busy')==='true');const storedBefore=await s.page.evaluate(()=>localStorage.getItem('zodiacs.profile.v1'));
   await s.page.evaluate(()=>{document.documentElement.setAttribute('data-account-sync-v2','');window.__referenceAccess=false;dispatchEvent(new Event('zodiacs:profile-access'));window.fixture.release();});await settle(s);
   const value=await data(s);assertCleared({...value,profile:null});assert.equal(value.profile,storedBefore);assert.deepEqual(value.events,[]);assert.equal(value.error,'');assert.equal(await s.page.locator('#birth-date').inputValue(),'');
   await fill(s,'2000-01-01');await submit(s);assert.equal((await data(s)).result,true);assert.deepEqual(s.errors,[]);return {revoked:value,syntheticStoredBytesPreserved:true,anonymousRecoverySucceeded:true,qualification:'Application access policy is controlled; this is not authentication or storage-erasure proof.'};
  }finally{await s.context.close();}
 });
}finally{
 for(const context of contexts)await context.close().catch(()=>{});const browserVersion=browser?.version();await browser?.close();await new Promise(done=>server.close(done));
 const report={node:process.version,browser:browserVersion,identity,finalIdentity:await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(root,path)))}))),driverSha256:hash(await readFile(new URL(import.meta.url))),baselineDirectory:baseline??null,results,requests,passed:results.filter(row=>row.passed).length,failed:results.filter(row=>!row.passed).length,qualification:'Actual Preact callers and actual rc6 numerical/receipt modules in an owned static fixture. Explicit loader/city/call/fault instrumentation is retained; no production graph/layout, complete-date coverage or numerical oracle claim.',cleanup:{browserClosed:true,contextsClosed:true,serverClosed:true}};
 await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
