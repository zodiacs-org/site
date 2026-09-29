/** Actual Preact reference-caption checks with real numerical and image modules.
 * Optional REFERENCE_BASELINE_DIR supplies an immutable prior source copy for
 * same-browser byte comparisons. No complete-date or numerical-oracle claim.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve, dirname, extname } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';

const root = resolve(import.meta.dirname, '..');
const out = resolve(process.env.OUT_DIR ?? resolve(root, 'tests/visual/artifacts/reference-caption'));
const baseline = process.env.REFERENCE_BASELINE_DIR;
await mkdir(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['src/islands/MoonPhaseTool.tsx', 'src/islands/ChartCalculator.tsx',
  ...['en','es','fr','it','pt','ru'].map(locale=>`src/lib/i18n/ui/${locale}.ts`),
  ...['','es/','fr/','it/','pt/','ru/'].map(locale=>`src/pages/${locale}moon-phase/index.astro`),
  'src/lib/share-card-copy.ts', 'src/lib/share-card.ts', 'src/server/chart-preview-model.ts', 'src/server/chart-preview.ts',
  'src/islands/explorer/tour/copy.ts', 'src/islands/explorer/lens/copy.ts',
  ...['pt','fr','it'].map(locale=>`src/strings/additions.${locale}.mjs`)];
const identity = await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(root,path)))})));
const entry = `
import { h, render } from 'preact';
import MoonPhaseTool from './src/islands/MoonPhaseTool';
import ChartCalculator from './src/islands/ChartCalculator';
import * as actual from './src/lib/engine/full';
import { moonPhaseName } from './src/lib/engine/lite';
import { resolveLocalToUtc } from './src/lib/time/localToUtc';
import { prepareChartCard, downloadPreparedChartCard, chartSheetSettings, chartSheetProvenanceLines, shareCardTimeNotes } from './src/lib/share-card';
import { encodePositionsLink } from './src/lib/share-positions';
import * as chartPreview from './src/server/chart-preview-model';
import en from './src/lib/i18n/ui/en';import es from './src/lib/i18n/ui/es';import fr from './src/lib/i18n/ui/fr';import it from './src/lib/i18n/ui/it';import pt from './src/lib/i18n/ui/pt';import ru from './src/lib/i18n/ui/ru';
import { RUSSIAN_RUNTIME } from './src/lib/i18n/ru-runtime/server';
const catalogs={en,es,fr,it,pt,ru};let pending=null,prepared=null;
window.captionOutputs={calls:[],lookup:null,chart:null};
const engine={...actual,bodyLongitude(body,utc){const value=actual.bodyLongitude(body,utc);window.captionOutputs.calls.push({body,utc:utc.toISOString(),value});return value;},
 computeChart(input){const result=actual.computeChart(input);window.captionOutputs.chart=JSON.stringify(result);return result;}};
window.captionLoadEngine=()=>pending?pending.promise:Promise.resolve(engine);
window.fixture={city:null,canvasText:[],
 reset(){window.captionOutputs={calls:[],lookup:null,chart:null};},
 hold(){let done;const promise=new Promise(resolve=>done=resolve);pending={promise,done};},
 release(){const old=pending;pending=null;old?.done(engine);},
 phase(instant){return moonPhaseName(new Date(instant));},
 mount(mode,locale){window.__ZDX_UI__={locale,messages:catalogs[locale]};window.__ZDX_RU__={locale:'ru',data:RUSSIAN_RUNTIME};render(h(mode==='chart'?ChartCalculator:MoonPhaseTool,mode==='chart'?{mode:'moon',locale}:{locale}),document.getElementById('mount'));},
 unmount(){render(null,document.getElementById('mount'));},
 async prepareImage(locale,known=false,variant='full'){
  const r=resolveLocalToUtc('2000-01-15',known?'08:30':'12:00','Africa/Khartoum');
  const chart=actual.computeChart({utc:r.utc,latitude:15.5,longitude:32.5,houseSystem:'whole',timeKnown:known,flags:r.flags});
  if(!known)chart.moonSignCandidates=[];
  const details={date:'2000-01-15',time:known?'08:30':'12:00',timeKnown:known,city:'',country:'',timezone:'Africa/Khartoum'};
  const token=encodePositionsLink({bodies:chart.bodies,angles:chart.angles,houseSystem:'whole',engineVersion:chart.engineVersion});
  window.fixture.canvasText=[];prepared=await prepareChartCard(chart,{locale,variant,referenceTime:!known,moonAmbiguous:!known,hideBirthDetails:false,birthDetails:details,birthDate:details.date});
  const snapshot={chart:JSON.stringify(chart),token,preview:chartPreview.previewPlacementsFromToken?chartPreview.previewModel(chartPreview.previewPlacementsFromToken(token)):chartPreview.previewModel(token),settings:chartSheetSettings(chart),provenance:chartSheetProvenanceLines(chart,details,false),notes:shareCardTimeNotes(locale,{referenceTime:!known}),canvasText:[...window.fixture.canvasText],filename:prepared.filename};
  document.getElementById('image-download').disabled=false;return snapshot;
 }};
const originalFill=CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.fixture.canvasText.push(String(text));return originalFill.call(this,text,...args);};
document.getElementById('image-download').onclick=()=>{downloadPreparedChartCard(prepared);};
const params=new URL(location.href).searchParams;window.fixture.mount(params.get('mode')??'moon',params.get('locale')??'en');
`;
await writeFile(resolve(out, 'fixture-entry.tsx.log'), entry);
const bundles = new Map();
for (const variant of baseline ? ['baseline', 'candidate'] : ['candidate']) {
  const instrumentation = [];
  const result = await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root},outfile:resolve(out,variant+'.js'),bundle:true,write:false,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',jsxImportSource:'preact',define:{'import.meta.env':'{}'},metafile:true,
    plugins:[{name:'declared-caption-fixture',setup(builder){
      builder.onResolve({filter:/lib\/hooks\/useEngine$/},()=>({path:'loader',namespace:'caption'}));
      builder.onResolve({filter:/lib\/geo\/search$/},()=>({path:'places',namespace:'caption'}));
      builder.onLoad({filter:/.*/,namespace:'caption'},({path})=>({contents:path==='loader'?'export function useEngine(){return ()=>window.captionLoadEngine();}':'export const preloadIndex=async()=>{};export const searchCities=async q=>q?[window.fixture.city].filter(Boolean):[];'}));
      builder.onLoad({filter:/\.(?:ts|tsx|mjs)$/},async({path})=>{
        const relative=path.slice(root.length+1);if(!sourcePaths.includes(relative))return null;
        const selected=variant==='baseline'?resolve(baseline,relative):path;
        let source=await readFile(selected,'utf8');const originalSha256=hash(source);
        if(relative==='src/islands/MoonPhaseTool.tsx'){
          const marker='const [result, setResult] = useState<Lookup | null>(null);';assert.equal(source.split(marker).length,2);
          source=source.replace(marker,'const [result, setResultState] = useState<Lookup | null>(null);\n  const setResult=(value:Lookup|null)=>{window.captionOutputs.lookup=value?JSON.stringify(value):null;setResultState(value);};');
        }
        instrumentation.push({path:relative,sourceOverride:selected,originalSha256,instrumentedSha256:hash(source)});
        return {contents:source,loader:extname(path)==='.tsx'?'tsx':'ts',resolveDir:dirname(path)};
      });
    }}]});
  const script=result.outputFiles.find(file=>file.path.endsWith('.js')).contents;
  const css=result.outputFiles.find(file=>file.path.endsWith('.css'))?.contents??new Uint8Array();
  const inputs=await Promise.all(Object.keys(result.metafile.inputs).filter(path=>!path.startsWith('<')&&!path.startsWith('caption:')).map(async path=>{
    const selected=variant==='baseline'&&sourcePaths.includes(path)?resolve(baseline,path):resolve(root,path);
    const bytes=await readFile(selected);return {path,source:selected,bytes:bytes.length,sha256:hash(bytes)};
  }));
  bundles.set(variant,{script,css});await writeFile(resolve(out,variant+'.js'),script);await writeFile(resolve(out,variant+'.css'),css);
  await writeFile(resolve(out,variant+'-build.json'),JSON.stringify({bundleSha256:hash(script),cssSha256:hash(css),inputs,instrumentation,metafile:result.metafile},null,2)+'\n');
}
const requests=[],contexts=[],results=[];let browser,origin;
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local'),variant=url.pathname.includes('baseline')?'baseline':'candidate',bundle=bundles.get(variant);
  if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/fonts/')){
    const path=resolve(root,'public','.'+url.pathname);
    if(!path.startsWith(resolve(root,'public')+'/')){res.statusCode=404;res.end();return;}
    try{const b=await readFile(path);res.setHeader('Content-Type',({'.png':'image/png','.avif':'image/avif','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(path)]??'application/octet-stream');res.end(b);}catch{res.statusCode=404;res.end();}return;
  }
  if(url.pathname.endsWith('.js')){res.setHeader('Content-Type','text/javascript');res.end(bundle.script);}
  else if(url.pathname.endsWith('.css')){res.setHeader('Content-Type','text/css');res.end(bundle.css);}
  else{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><title>Reference caption fixture</title><link rel="stylesheet" href="/${variant}.css"><div id="mount"></div><button id="image-download" disabled>Download fixture image</button><script src="/${variant}.js"></script>`);}
});
async function setup(mode='moon',variant='candidate',locale='en'){
  const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',timezoneId:'UTC',acceptDownloads:true});contexts.push(context);
  await context.route('**/*',route=>{const req=route.request(),allowed=req.url().startsWith(origin+'/')&&req.method()==='GET';requests.push({variant,mode,url:req.url(),method:req.method(),allowed});return allowed?route.continue():route.abort();});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(origin+'/'+variant+'?mode='+mode+'&locale='+locale);await page.locator(mode==='chart'?'#birth-date':'#mp-date').waitFor();
  return {page,context,mode,variant,locale,errors};
}
async function fill(s,date,time='',zone=null){
  const {page,mode}=s;await page.locator(mode==='chart'?'#birth-date':'#mp-date').fill(date);
  if(mode==='chart')await page.locator('.calc__form input[type=checkbox]').setChecked(time==='');
  if(time||mode==='moon')await page.locator(mode==='chart'?'#birth-time':'#mp-time').fill(time);
  if(await page.locator('.place__clear').count())await page.locator('.place__clear').click();
  if(zone){await page.evaluate(zone=>window.fixture.city={name:'Synthetic place',admin1:'',country:'',tz:zone,lat:15.5,lon:32.5,pop:0},zone);await page.locator(mode==='chart'?'#place':'#mp-place').fill('Synthetic');await page.locator('[role=listbox] [role=option]').first().click();}
}
async function submit(s){await s.page.locator('.calc__submit').click();await s.page.waitForFunction(()=>document.querySelector('.calc__form')?.getAttribute('aria-busy')==='false');await s.page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));}
async function data(s){return s.page.evaluate(()=>({outputs:window.captionOutputs,result:!!document.querySelector('.calc__result'),text:document.querySelector('.calc__result')?.innerText??'',notice:document.querySelector('.calc__result>.notice')?.textContent??'',phase:document.querySelector('.calc__phase')?.textContent??'',error:document.querySelector('.calc__error')?.textContent??'',profile:localStorage.getItem('zodiacs.profile.v1')}));}
async function group(name,fn){try{results.push({name,passed:true,evidence:await fn()});}catch(error){results.push({name,passed:false,error:String(error.stack??error)});}}
try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:await findChromium(),headless:true,args:STABLE_CHROMIUM_ARGS});
  const cases=[['UTC singleton','1990-01-04','',null],['UTC phase crossing','2024-01-09','',null],['local former pair','1990-01-01','','Europe/London'],['Toronto','1919-03-31','','America/Toronto'],['Juneau','1867-10-18','','America/Juneau'],['13:00 gap reference','2000-01-15','','Africa/Khartoum'],['known gap','2000-01-15','12:00','Africa/Khartoum'],['known UTC','2000-01-15','08:30',null],['known skipped','2011-12-30','08:30','Pacific/Apia'],['repeated date','1892-07-04','','Pacific/Apia']];
  for(const [name,date,time,zone]of cases)await group('Primary preservation: '+name,async()=>{
    const observed={};for(const variant of bundles.keys()){
      const s=await setup('moon',variant);try{await fill(s,date,time,zone);await submit(s);const value=await data(s);assert.equal(value.result,true);assert.equal(value.profile,null);assert.deepEqual(s.errors,[]);observed[variant]=value;}finally{await s.context.close();}
    }
    const value=observed.candidate,lookup=JSON.parse(value.outputs.lookup);
    assert.equal(value.outputs.calls.length,2);assert.deepEqual(value.outputs.calls.map(row=>row.body),['Moon','Sun']);assert.equal('altLon'in lookup,false);
    if(!time||!zone){assert.ok(value.notice.length>0);assert.ok(value.text.includes(value.notice));assert.equal(value.notice,lookup.caption);}
    else assert.equal(value.notice,'');
    if(observed.baseline){const old=JSON.parse(observed.baseline.outputs.lookup),{caption:oldCaption,altLon:oldAlternate,...oldPoint}=old,{caption,...point}=lookup;assert.equal(JSON.stringify(point),JSON.stringify(oldPoint));assert.deepEqual(value.outputs.calls,observed.baseline.outputs.calls.slice(0,2));}
    return observed;
  });
  for(const locale of ['en','es','fr','it','pt','ru'])await group('Visible localized qualification '+locale,async()=>{
    const s=await setup('moon','candidate',locale);try{const observed=[];for(const [time,zone,key]of [['',null,'referenceUtcCaption'],['','Africa/Khartoum','referenceLocalCaption'],['08:30',null,'utcTimeCaption']]){
      await fill(s,'2000-01-15',time,zone);assert.equal((await data(s)).result,false);await submit(s);const value=await data(s),expected=await s.page.evaluate(key=>window.__ZDX_UI__.messages[key],key);assert.equal(value.notice,expected);assert.ok(value.text.includes(expected));assert.equal(await s.page.locator('.calc__result [data-evidence-disclosure] p').count(),0);assert.equal(await s.page.locator('.calc__result .mp__signline .sign-chip').count()<=1,true);observed.push(value);
    }await s.page.screenshot({path:resolve(out,'caption-'+locale+'.png'),fullPage:true});assert.deepEqual(s.errors,[]);return observed;}finally{await s.context.close();}
  });
  for(const locale of ['en','es','fr','it','pt','ru'])await group('Chart Moon labels '+locale,async()=>{
    const observed={};for(const variant of bundles.keys()){
      const s=await setup('chart',variant,locale);try{const values=[];for(const time of ['','08:30']){await fill(s,'2000-01-15',time,'Africa/Khartoum');await submit(s);const value=await data(s);assert.equal(value.result,true);if(variant==='candidate'){const label=await s.page.evaluate(key=>window.__ZDX_UI__.messages[key],time?'moonPhaseAtBirth':'moonPhaseAtReference');assert.ok(value.phase.startsWith(label+':'));}values.push(value);}observed[variant]=values;assert.deepEqual(s.errors,[]);}finally{await s.context.close();}
    }if(observed.baseline)for(let i=0;i<2;i++){assert.equal(observed.candidate[i].outputs.chart,observed.baseline[i].outputs.chart);if(i===1)assert.equal(observed.candidate[i].phase,observed.baseline[i].phase);}return observed;
  });
  for(const [date,zone]of [['2011-12-30','Pacific/Apia'],['1993-08-21','Pacific/Kwajalein'],['1994-12-31','Pacific/Kiritimati'],['1844-12-31','Pacific/Guam']])await group('Refusal and recovery '+zone,async()=>{
    const s=await setup();try{await fill(s,'2000-01-02','',zone);await submit(s);assert.equal((await data(s)).result,true);await fill(s,date,'',zone);assert.equal((await data(s)).result,false);await s.page.evaluate(()=>window.fixture.reset());await submit(s);const refused=await data(s);assert.equal(refused.result,false);assert.deepEqual(refused.outputs.calls,[]);assert.equal(refused.error,await s.page.evaluate(()=>window.__ZDX_UI__.messages.localDateReferenceError));assert.equal(await s.page.evaluate(()=>document.activeElement?.getAttribute('role')),'alert');await fill(s,'2000-01-02','',zone);await submit(s);assert.equal((await data(s)).result,true);assert.deepEqual(s.errors,[]);return refused;}finally{await s.context.close();}
  });
  for(const [locale,known,variant]of [...['en','es','fr','it','pt','ru'].map(locale=>[locale,false,'full']),['en',false,'sheet'],['en',true,'full']])await group(`Native image ${locale} ${known?'known':'reference'} ${variant}`,async()=>{
    const observed={};for(const sourceVariant of bundles.keys()){
      const s=await setup('moon',sourceVariant,locale);try{const value=await s.page.evaluate(args=>window.fixture.prepareImage(...args),[locale,known,variant]);
        const downloadPromise=s.page.waitForEvent('download');await s.page.locator('#image-download').click();const download=await downloadPromise;const destination=resolve(out,`${sourceVariant}-${locale}-${known?'known':'reference'}-${variant}.png`);await download.saveAs(destination);const bytes=await readFile(destination);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(download.suggestedFilename(),value.filename);assert.equal(value.filename.includes('2000'),false);observed[sourceVariant]={...value,imageBytes:bytes.length,imageSha256:hash(bytes)};
        if(sourceVariant==='candidate'&&!known){assert.ok(value.canvasText.some(text=>text.includes(variant==='sheet'?'Reference positions':value.notes[0])));assert.ok(!value.canvasText.some(text=>text.includes('12:00')));}
        assert.deepEqual(s.errors,[]);
      }finally{await s.context.close();}
    }if(observed.baseline){assert.equal(observed.candidate.chart,observed.baseline.chart);assert.equal(observed.candidate.token,observed.baseline.token);if(known)assert.equal(observed.candidate.imageSha256,observed.baseline.imageSha256);}return observed;
  });
}finally{
  const browserVersion=browser?.version();for(const context of contexts)await context.close();await browser?.close();await new Promise(done=>server.close(done));
  const report={node:process.version,browser:browserVersion,identity,finalIdentity:await Promise.all(sourcePaths.map(async path=>({path,sha256:hash(await readFile(resolve(root,path)))}))),driverSha256:hash(await readFile(new URL(import.meta.url))),baselineDirectory:baseline??null,results,requests,passed:results.filter(row=>row.passed).length,failed:results.filter(row=>!row.passed).length,qualification:'Actual frozen-source numerical modules and Preact/Canvas; declared loader/place/state observers. Same-browser baseline comparison when supplied. No complete-date coverage, full-site design or numerical-oracle claim.',cleanup:{browserClosed:true,contextsClosed:true,serverClosed:true}};
  await writeFile(resolve(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed,browser:browserVersion}));if(report.failed)process.exitCode=1;
}
