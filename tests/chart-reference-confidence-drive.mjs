/** Native confidence regression: actual ChartCalculator, resolver, receipt and ephemeris.
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
const out = resolve(process.env.OUT_DIR ?? resolve(root, 'tests/visual/artifacts/chart-reference-confidence'));
const baseline = process.env.CONFIDENCE_BASELINE_DIR;
await mkdir(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['src/lib/time/localToUtc.ts', 'src/islands/ChartCalculator.tsx', 'src/lib/chart-date-certainty.ts', ...['en','es','fr','it','pt','ru'].map(locale=>`src/lib/i18n/ui/${locale}.ts`)];
const identity = await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(root,path)))})));
const entry = `
import { h, render } from 'preact';
import ChartCalculator from './src/islands/ChartCalculator';
import * as actual from './src/lib/engine/full';
import { encodePositionsLink, decodePositionsLink } from './src/lib/share-positions';
import { moonCandidates } from './src/lib/moon-certainty';
import { approachRead } from './src/lib/approach';
import { communicationRead } from './src/lib/communication';
import { buildChartContext } from './src/lib/chart-context';
import { chartSignature } from './src/lib/chart-signature';
import { localDateContainsUtc } from './src/lib/time/localToUtc';
import { signForLongitude } from './src/lib/signs';
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
 mount(mode,locale){window.__ZDX_UI__={locale,messages:catalogs[locale]};window.__ZDX_RU__={locale:'ru',data:RUSSIAN_RUNTIME};render(h(ChartCalculator,{mode,locale}),document.getElementById('mount'));},
 unmount(){render(null,document.getElementById('mount'));},
 inspect(){const chart=JSON.parse(window.__referenceOutputs.committedChart);const token=encodePositionsLink({bodies:chart.bodies,angles:chart.angles,houseSystem:'whole',engineVersion:chart.engineVersion});return {token,receivedCandidates:moonCandidates(decodePositionsLink(token)),context:buildChartContext({...chart,timeKnown:chart.input.timeKnown}),approach:approachRead(chart),communication:communicationRead(chart),signature:chartSignature(chart)};},
 witness(date,zone,instant){const utc=new Date(instant);return {member:localDateContainsUtc(date,utc,zone),longitude:actual.bodyLongitude('Moon',utc),sign:signForLongitude(actual.bodyLongitude('Moon',utc)).slug};},
};
if(window.__referenceBootstrap?.holdEngine)window.fixture.hold();
const params=new URL(location.href).searchParams;window.fixture.mount(params.get('mode')??'full',params.get('locale')??'en');
`;
const bundles = new Map();
for (const variant of baseline ? ['baseline', 'candidate'] : ['candidate']) {
 const instrumentation=[];
 const result=await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root},outfile:resolve(out,variant+'.js'),bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',jsxImportSource:'preact',define:{'import.meta.env':'{}'},metafile:true,
 plugins:[{name:'declared-caller-probes',setup(builder){
  builder.onResolve({filter:/lib\/hooks\/useEngine$/},()=>({path:'loader',namespace:'reference'}));
  builder.onResolve({filter:/lib\/geo\/search$/},()=>({path:'places',namespace:'reference'}));
  builder.onLoad({filter:/.*/,namespace:'reference'},({path})=>({contents:path==='loader'?'export function useEngine(){return ()=>window.referenceLoadEngine();}':'export const preloadIndex=async()=>{};export const searchCities=async q=>q? [window.fixture.city].filter(Boolean):[];'}));
  builder.onLoad({filter:/\/ChartCalculator\.tsx$/},async({path})=>{
   const relative=path.slice(root.length+1),selected=variant==='baseline'?resolve(baseline,relative):path;
   const original=await readFile(selected,'utf8');assert.equal(original.split('      setChart(result);').length,2);
   const contents=original.replace('      setChart(result);',"      window.__referenceOutputs.committedChart=JSON.stringify(result);\n      setChart(result);");
   instrumentation.push({path:relative,originalSha256:hash(original),instrumentedSha256:hash(contents)});
   await writeFile(resolve(out,variant+'-ChartCalculator.probe-source.log'),contents);
   return {contents,loader:'tsx',resolveDir:dirname(path)};
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
    text=text.replace('return { chart, envelopeJson: serializeNatalEnvelope(envelope) };', 'const captured={ chart, envelopeJson: serializeNatalEnvelope(envelope) }; window.__referenceOutputs.envelopeJson=captured.envelopeJson; return captured;');
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
  const override=variant==='baseline'&&path==='src/islands/ChartCalculator.tsx'?resolve(baseline,path):resolve(root,path);
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
 else{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><title>Chart reference confidence fixture</title><link rel="stylesheet" href="/${variant}.css"><div id="mount"></div><script src="/${variant}.js"></script>`);}
});
let browser,origin;const contexts=[],results=[],requests=[];
async function setup(variant='candidate',locale='en',mode='full',fragment=''){
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',timezoneId:'UTC'});contexts.push(context);
 await context.route('**/*',route=>{const request=route.request(),url=request.url();const allowed=url.startsWith(origin+'/')&&request.method()==='GET';requests.push({variant,mode,url,method:request.method(),allowed});return allowed?route.continue():route.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(origin+'/'+variant+'?mode='+mode+'&locale='+locale+fragment);await page.locator('#birth-date').waitFor();
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 return {context,page,mode,variant,locale,errors};
}
async function fill(s,date,zone='UTC',known=false){
 const {page}=s;await page.locator('#birth-date').fill(date);
 if(s.mode!=='rising')await page.locator('.calc__form input[type=checkbox]').setChecked(!known);
 else assert.equal(known,true,'Rising requires a supplied time');
 if(known)await page.locator('#birth-time').fill('12:00');
 if(await page.locator('.place__clear').count())await page.locator('.place__clear').click();
 await page.evaluate(zone=>{window.fixture.city={name:'Synthetic place',admin1:'',country:'',tz:zone,lat:43.65,lon:-79.38,pop:0};},zone);
 await page.locator('#place').fill('Synthetic');await page.locator('[role=listbox] [role=option]').first().click();
}
async function settle(s){await s.page.waitForFunction(()=>document.querySelector('.calc__form')?.getAttribute('aria-busy')==='false');await s.page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));}
async function submit(s){await s.page.locator('.calc__submit').click();await settle(s);}
async function data(s){return s.page.evaluate(()=>({events:window.__referenceEvents,outputs:window.__referenceOutputs,
 result:!!document.querySelector('.calc__result'),postContext:window.zodiacsPostChartContext??null,
 notice:Array.from(document.querySelectorAll('.notice')).map(e=>e.textContent).join(' '),
 error:document.querySelector('.calc__error')?.textContent??'',receipt:!!document.querySelector('[data-calculation-receipt-export]'),
 share:!!document.querySelector('[data-share-card]'),save:!!document.querySelector('[data-save-chart]'),
 registry:document.querySelector('[data-registry-bridge]')?.getAttribute('data-registry-bridge-sign')??null,
 hero:document.querySelector('[data-moon-uncertain]')?.textContent??null,
 profile:localStorage.getItem('zodiacs.profile.v1')}));}
async function download(s,name){const more=s.page.locator('[data-chart-more]');if(!(await more.evaluate(element=>element.open)))await more.locator(':scope > summary').click();const action=s.page.locator('[data-download-calculation-receipt]');await action.focus();const received=s.page.waitForEvent('download');await action.press('Enter');const value=await received;assert.equal(value.suggestedFilename(),'zodiacs-calculation-receipt.json');const path=resolve(out,name+'.json');await value.saveAs(path);return readFile(path,'utf8');}
function cleared(value){assert.equal(value.result,false);assert.equal(value.receipt,false);assert.equal(value.share,false);assert.equal(value.save,false);assert.equal(value.registry,null);assert.equal(value.postContext,null);}
function noMoonAdvice(inspect){assert.equal(inspect.approach.moon,null);assert.equal(inspect.communication.moonSign,null);assert.ok(inspect.communication.aspects.every(row=>row.target!=='Moon'));assert.deepEqual(inspect.receivedCandidates,[]);assert.equal(inspect.context.placements.find(row=>row.body==='Moon').status,'unresolved');}
async function group(name,fn){try{const detail=await fn();results.push({name,passed:true,detail});}catch(error){results.push({name,passed:false,error:String(error.stack??error)});}console.log(JSON.stringify({name,passed:results.at(-1).passed,...(results.at(-1).error?{error:results.at(-1).error}:{})}));}
const controls=[
 ['Toronto','1919-03-31','America/Toronto','1919-03-31T04:30:00Z','pisces'],
 ['Juneau','1867-10-18','America/Juneau','1867-10-19T00:31:13Z','cancer'],
 ['ordinary singleton','1990-01-04','Asia/Bangkok'],
 ['ordinary two signs','1990-01-01','Europe/London'],
 ['same-date gap','2024-10-06','Australia/Lord_Howe'],
 ['repeated Apia','1892-07-04','Pacific/Apia'],
];
try{
 await new Promise(done=>server.listen(0,'127.0.0.1',done));origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:await findChromium(),headless:true,args:STABLE_CHROMIUM_ARGS});
 for(const [label,date,zone,instant,sign] of controls)await group('reference '+label,async()=>{
  const observations={};for(const variant of bundles.keys()){
   const s=await setup(variant);try{
    await fill(s,date,zone);await submit(s);const value=await data(s);assert.equal(value.result,true);assert.equal(value.receipt,true);assert.equal(value.share,true);assert.equal(value.save,true);assert.equal(value.profile,null);
    const inspect=await s.page.evaluate(()=>window.fixture.inspect());const bytes=await download(s,label.replaceAll(' ','-')+'-'+variant);assert.equal(bytes,value.outputs.envelopeJson);
    if(variant==='candidate'){
     assert.deepEqual(JSON.parse(value.outputs.committedChart).moonSignCandidates,[]);assert.equal(value.registry,null);assert.equal(value.events.filter(row=>row.kind==='publicNatal').length,1);
     assert.equal(value.events.filter(row=>['endpoints','bodies','legacyNatal'].includes(row.kind)).length,0);noMoonAdvice(inspect);
     const messages=await s.page.evaluate(()=>window.__ZDX_UI__.messages);assert.ok(value.notice.includes(messages.moonUnverifiedNotice));assert.ok(value.notice.includes(messages.unknownTimeSunReference));assert.equal(value.postContext.sunSign,null);assert.ok(!value.notice.includes('Moon also changed signs'));
     assert.equal(await s.page.locator('[data-moon-uncertain] .three-card__deg').count(),0);
     if(instant){const witness=await s.page.evaluate(args=>window.fixture.witness(...args),[date,zone,instant]);assert.equal(witness.member,true);assert.equal(witness.sign,sign);value.witness=witness;}
    }
    assert.deepEqual(s.errors,[]);await s.page.screenshot({path:resolve(out,label.replaceAll(' ','-')+'-'+variant+'.png'),fullPage:true});observations[variant]={value,inspect,downloadSha256:hash(bytes)};
   }finally{await s.context.close();}
  }
  if(observations.baseline){
   const old=observations.baseline,newer=observations.candidate;
   assert.equal(newer.value.outputs.native,old.value.outputs.native);assert.equal(newer.value.outputs.envelopeJson,old.value.outputs.envelopeJson);assert.equal(newer.downloadSha256,old.downloadSha256);assert.equal(newer.inspect.token,old.inspect.token);
   const {moonSignCandidates:oldConfidence,...oldChart}=JSON.parse(old.value.outputs.committedChart),{moonSignCandidates:newConfidence,...newChart}=JSON.parse(newer.value.outputs.committedChart);
   assert.equal(JSON.stringify(newChart),JSON.stringify(oldChart));
   assert.equal(newer.value.postContext.sunSign,null);
   observations.intentionalSunContextChange={old:old.value.postContext.sunSign,current:newer.value.postContext.sunSign};
   observations.intentionalConfidenceChange={oldConfidence,newConfidence,oldRegistry:old.value.registry,newRegistry:newer.value.registry};
  }
  return {sameBrowserExactReferenceParity:!!observations.baseline,observations};
 });
 for(const locale of ['en','es','fr','it','pt','ru'])await group('localized unresolved result '+locale,async()=>{
  const s=await setup('candidate',locale,'full');try{await fill(s,'1990-01-04','Asia/Bangkok');await submit(s);const value=await data(s);const messages=await s.page.evaluate(()=>window.__ZDX_UI__.messages);assert.ok(value.notice.includes(messages.moonUnverifiedNotice));assert.ok(value.notice.includes(messages.unknownTimeSunReference));assert.equal(value.postContext.sunSign,null);assert.ok(value.hero.includes(messages.needsBirthTime));assert.equal(await s.page.locator('[data-moon-uncertain] .three-card__deg').count(),0);assert.equal(value.registry,null);assert.equal(await download(s,'locale-'+locale),value.outputs.envelopeJson);assert.deepEqual(s.errors,[]);return value;}finally{await s.context.close();}
 });
 for(const mode of ['full','moon','rising'])await group('known-time preserved '+mode,async()=>{
  const observations={};for(const variant of bundles.keys()){
   const s=await setup(variant,'en',mode);try{await fill(s,'1990-06-15','America/Toronto',true);await submit(s);const value=await data(s);assert.equal(value.result,true);assert.equal(value.hero,null);assert.equal(value.registry,variant==='baseline' && mode==='full'?'gemini':null);assert.equal(value.events.filter(row=>row.kind==='publicNatal').length,mode==='full'?1:0);assert.equal(value.events.filter(row=>row.kind==='legacyNatal').length,mode==='full'?0:1);assert.equal(value.events.filter(row=>['endpoints','bodies'].includes(row.kind)).length,0);assert.deepEqual(s.errors,[]);observations[variant]=value;}finally{await s.context.close();}
  }if(observations.baseline)assert.deepEqual(observations.candidate.outputs,observations.baseline.outputs);return observations;
 });
 await group('C014 skipped-date clearing and recovery',async()=>{
  const s=await setup();try{await fill(s,'2011-12-29','Pacific/Apia');await submit(s);assert.equal((await data(s)).result,true);await fill(s,'2011-12-30','Pacific/Apia');await s.page.evaluate(()=>window.fixture.reset());await submit(s);await s.page.waitForFunction(()=>document.activeElement===document.querySelector('.calc__error'));const value=await data(s);cleared(value);assert.deepEqual(value.events.map(row=>row.kind),['resolve','contains']);assert.equal(value.error,'We couldn’t establish a calculation time within this local date. Check the date and place.');assert.equal(await s.page.locator('#birth-date').inputValue(),'2011-12-30');await fill(s,'2011-12-31','Pacific/Apia');await submit(s);assert.equal((await data(s)).result,true);assert.deepEqual(s.errors,[]);return {refused:value,recovery:true};}finally{await s.context.close();}
 });
 for(const action of ['edit','replacement','unmount'])await group('pending reference ownership '+action,async()=>{
  const s=await setup();try{await fill(s,'1919-03-31','America/Toronto');await s.page.evaluate(()=>window.fixture.hold());await s.page.locator('.calc__submit').click();if(action==='unmount')await s.page.evaluate(()=>window.fixture.unmount());else await s.page.locator('#birth-date').fill('1990-01-04');if(action==='replacement')await s.page.locator('.calc__submit').click();await s.page.evaluate(()=>window.fixture.release());if(action==='unmount')await s.page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));else await settle(s);const value=await data(s);if(action==='replacement'){assert.equal(value.result,true);assert.equal(value.events.filter(row=>row.kind==='publicNatal').length,1);assert.ok(value.events.filter(row=>row.kind==='resolve').every(row=>row.date==='1990-01-04'));}else{cleared(value);assert.deepEqual(value.events,[]);}assert.deepEqual(s.errors,[]);return value;}finally{await s.context.close();}
 });
 await group('positions-only stays unresolved without calculation or receipt',async()=>{
  const token='2.'+Buffer.from(JSON.stringify({b:Array.from({length:12},(_,index)=>index*27),h:'w',v:'0.1.1-rc.6'})).toString('base64url');const s=await setup('candidate','en','full','#p='+token);try{await s.page.locator('[data-positions-only]').waitFor();const value=await data(s);assert.deepEqual(value.events,[]);assert.equal(value.receipt,false);assert.equal(value.registry,null);assert.equal(value.postContext,null);assert.equal(value.profile,null);assert.deepEqual(s.errors,[]);return value;}finally{await s.context.close();}
 });
}finally{
 for(const context of contexts)await context.close().catch(()=>{});const version=browser?.version();await browser?.close();await new Promise(done=>server.close(done));
 const report={node:process.version,browser:version,identity,finalIdentity:await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(root,path)))}))),driverSha256:hash(await readFile(new URL(import.meta.url))),baselineDirectory:baseline??null,results,requests,passed:results.filter(row=>row.passed).length,failed:results.filter(row=>!row.passed).length,qualification:'Actual Preact ChartCalculator and actual rc6 numerical/receipt modules in an owned static fixture. Explicit loader/city/call probes are retained. Optional baseline overlay compares same-browser reference bytes; confidence changes are recorded separately. This is not an ephemeris oracle, full-date coverage proof or production-layout acceptance. Reference Sun personalization is intentionally withheld and its uncertainty wording is checked; numerical positions, serialized receipt bytes and existing phase captions are preserved.',cleanup:{browserClosed:true,contextsClosed:true,serverClosed:true}};
 await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
