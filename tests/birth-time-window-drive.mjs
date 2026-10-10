import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {findChromium,STABLE_CHROMIUM_ARGS} from './visual/browser.mjs';
import {withPreview} from './visual/preview-server.mjs';
const development=process.env.BIRTH_WINDOW_SERVER_MODE==='development';
const artifactRoot='tests/visual/artifacts/birth-time-window'+(development?'-development':'');
const records=[],observations=[];let failure=null;let stage="start";
const variants=[{name:'mobile',width:390,height:844},{name:'desktop',width:1440,height:1000}];
async function committed(page){
 await page.locator('.calc__result').waitFor();
 await page.waitForFunction(()=>document.querySelector('.calc__form')?.getAttribute('aria-busy')==='false');
}
try{
 await withPreview({port:8793},async baseURL=>{
  const browser=await chromium.launch({executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS});
  try{for(const variant of variants){
   const context=await browser.newContext({viewport:{width:variant.width,height:variant.height},reducedMotion:'reduce'});
   const page=await context.newPage(),errors=[];let hold=null;
   page.on('pageerror',error=>errors.push(String(error.message)));
   await page.addInitScript(()=>{
    window.__birthWindowControls={created:[],terminated:[],results:[],inputs:[]};
    const NativeWorker=window.Worker;
    window.Worker=class extends NativeWorker{
     constructor(url,options){
      super(url,options);this.windowProbe=String(url).includes('birth-window.worker');
      if(this.windowProbe){
       this.probeId=window.__birthWindowControls.created.length;
       window.__birthWindowControls.created.push(String(url));
       this.addEventListener('message',event=>window.__birthWindowControls.results.push({probeId:this.probeId,...event.data}));
      }
     }
     postMessage(...args){if(this.windowProbe)window.__birthWindowControls.inputs.push({probeId:this.probeId,input:args[0]});return super.postMessage(...args);}
     terminate(){if(this.windowProbe)window.__birthWindowControls.terminated.push(this.probeId);return super.terminate();}
    };
   });
   await page.route(url=>url.pathname.includes('birth-window.worker')&&(development?url.searchParams.has('worker_file'):url.pathname.endsWith('.js')),async route=>{
    const pending=hold;
    if(pending){pending.started();await pending.wait;}
    try{await route.continue();}catch(error){if(!pending)throw error;}
   });
   function pauseNext(){
    let release,started;
    const wait=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
    hold={wait,started,release};return {ready,release:()=>{hold=null;release();}};
   }
   try{
    await page.goto(baseURL+'/birth-chart/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{const island=document.querySelector('.calc__form')?.closest('astro-island');return island&&!island.hasAttribute('ssr');});
    await page.getByLabel('Birth date',{exact:true}).fill('1907-07-06');
    await page.getByLabel('Birth time',{exact:true}).fill('08:30');
    await page.getByLabel('Birthplace',{exact:true}).fill('Coyo');
    await page.locator('#place-opt-0').waitFor({state:'visible'});await page.locator('#place-opt-0').click();
    await page.locator('.calc__submit').click();await committed(page);
    assert.equal(await page.locator('[data-birth-window-entry]').count(),1);
    assert.equal(await page.evaluate(()=>window.__birthWindowControls.created.length),0,'No calculation worker before an explicit request');
    await page.getByRole('button',{name:'Check a time window',exact:true}).click();
    const surface=page.locator('[data-birth-window]');await surface.waitFor();
    assert.equal(await page.evaluate(()=>window.__birthWindowControls.created.length),0,'Opening the UI does not evaluate a window');
    await surface.locator('select').selectOption('120');
    await surface.getByRole('button',{name:'Check this window',exact:true}).click();
    await surface.locator('[data-birth-window-verification]').waitFor({state:'attached',timeout:60000});
    const observed=await page.evaluate(()=>window.__birthWindowControls.results[0]);
    assert.ok(observed.result,'Real native worker returned a result');
    assert.equal(observed.result.verification,'sampled at one-second resolution');
    assert.equal(observed.result.end.getTime()-observed.result.start.getTime(),4*60*60*1000);
    const summary=await surface.locator('[data-birth-window-summary]').innerText();
    if(observed.result.flags.includes('bound-exceeded'))assert.match(summary,/could not establish coverage/);
    else for(const sign of new Set(observed.result.cells.map(cell=>cell.features.ascendant)))assert.ok(summary.includes(sign.charAt(0).toUpperCase()+sign.slice(1)));
    await page.evaluate(()=>document.fonts.ready);
    mkdirSync(artifactRoot,{recursive:true});
    await surface.screenshot({path:artifactRoot+'/summary-'+variant.name+'.png'});
    await surface.locator(':scope > details > summary').click();
    await surface.getByText(/Sun, Moon, rising sign, houses and aspects \(/).click();
    assert.equal(await surface.locator('.birth-window__cell').count(),observed.result.cells.length);
    assert.ok(await surface.getByText('Times below use UTC notation.',{exact:false}).isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
    await page.evaluate(()=>document.fonts.ready);
    mkdirSync(artifactRoot,{recursive:true});
    await page.screenshot({path:artifactRoot+'/'+variant.name+'.png',fullPage:true});
    const cancellation=pauseNext();
    await surface.locator('select').selectOption('30');
    await surface.getByRole('button',{name:'Check this window',exact:true}).click();await cancellation.ready;
    const cancelledId=await page.evaluate(()=>window.__birthWindowControls.created.length-1);
    await surface.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.ok(await page.evaluate(id=>window.__birthWindowControls.terminated.includes(id),cancelledId),'Cancel terminates the actual worker');
    assert.equal(await surface.locator('[data-birth-window-verification]').count(),0,'Cancelled work shows no previous result');
    cancellation.release();
    const next=pauseNext();
    await surface.locator('select').selectOption('60');
    await surface.getByRole('button',{name:'Check this window',exact:true}).click();
    await next.ready;
    const pendingId=await page.evaluate(()=>window.__birthWindowControls.created.length-1);
    await surface.locator('select').selectOption('1');
    assert.ok(await page.evaluate(id=>window.__birthWindowControls.terminated.includes(id),pendingId),'Changed window terminates its actual worker');
    next.release();
    await surface.getByRole('button',{name:'Check this window',exact:true}).click();
    await surface.locator('[data-birth-window-verification]').waitFor({state:'attached',timeout:60000});
    const replacement=pauseNext();
    await surface.locator(':scope > details > summary').click();
    await surface.locator('select').selectOption('60');
    await surface.getByRole('button',{name:'Check this window',exact:true}).click();await replacement.ready;
    const oldId=await page.evaluate(()=>window.__birthWindowControls.created.length-1);
    await page.getByLabel('Birth date',{exact:true}).fill('1990-01-01');
    await page.locator('.calc__submit').click();await committed(page);
    assert.ok(await page.evaluate(id=>window.__birthWindowControls.terminated.includes(id),oldId),'Replacement chart terminates the old worker');
    replacement.release();
    assert.equal(await page.locator('[data-birth-window]').count(),0,'Old summary cannot survive chart replacement');
    assert.equal(await page.locator('[data-birth-window-entry]').count(),1,'New chart gets an unopened window check');
    await page.getByRole('checkbox',{name:"I don't know it",exact:true}).check();
    await page.locator('.calc__submit').click();await committed(page);
    assert.equal(await page.locator('[data-birth-window-entry]').count(),0,'Unknown-time reference does not invent a rising window');
    await page.getByRole('checkbox',{name:"I don't know it",exact:true}).uncheck();
    const beforeBoundary=await page.evaluate(()=>window.__birthWindowControls.created.length);
    await page.getByLabel('Birth date',{exact:true}).fill('2199-12-31');
    await page.getByLabel('Birth time',{exact:true}).fill('23:59');
    await page.locator('.calc__submit').click();await committed(page);
    const upperUTC=await page.locator('.calc__result [data-check-our-math] time').getAttribute('datetime');
    assert.ok(Date.parse(upperUTC)>=Date.parse('2200-01-01T00:00:00Z'),'The committed accepted local date actually resolves beyond the UTC reference span');
    assert.equal(await page.locator('.calc__result [data-check-our-math]').getAttribute('data-instant-basis'),'birth');
    assert.equal(await page.locator('[data-birth-window-entry]').count(),0,'A supported local boundary date resolving beyond the UTC reference span has no window entry');
    assert.equal(await page.evaluate(()=>window.__birthWindowControls.created.length),beforeBoundary);
    await page.getByLabel('Birth date',{exact:true}).fill('1800-01-01');
    await page.getByLabel('Birth time',{exact:true}).fill('12:00');
    await page.locator('.calc__form .place__clear').click();
    await page.getByLabel('Birthplace',{exact:true}).fill('Auckland');
    await page.locator('#place-opt-0').waitFor({state:'visible'});await page.locator('#place-opt-0').click();
    await page.locator('.calc__submit').click();await committed(page);
    await page.getByRole('button',{name:'Check a time window',exact:true}).click();
    const bounded=page.locator('[data-birth-window]');await bounded.waitFor();
    stage=variant.name+":lower-boundary-options";
    const lowerBoundaryState=await page.evaluate(()=>({
      date:document.querySelector('#birth-date')?.value,
      time:document.querySelector('#birth-time')?.value,
      selectedPlace:document.querySelector('#place')?.value,
      receiptUTC:document.querySelector('.calc__result [data-check-our-math] time')?.getAttribute('datetime'),
      instantBasis:document.querySelector('.calc__result [data-check-our-math]')?.getAttribute('data-instant-basis'),
      options:[...document.querySelectorAll('[data-birth-window] select option')].map(option=>({value:option.value,disabled:option.disabled})),
      reference:document.querySelector('[data-birth-window-reference]')?.textContent??null
    }));
    observations.push({variant:variant.name,stage,upperUTC,lowerBoundaryState});
    const automationOptionStates={
      oneMinuteEnabled:await bounded.locator('select option[value="1"]').isEnabled(),
      thirtyMinuteDisabled:await bounded.locator('select option[value="30"]').isDisabled(),
      twoHourDisabled:await bounded.locator('select option[value="120"]').isDisabled()
    };
    observations.at(-1).automationOptionStates=automationOptionStates;
    assert.equal(await bounded.locator('select').isEnabled(),true,"The boundary selector is usable");
    assert.equal(await bounded.locator('select option[value="1"]').evaluate(option=>option.disabled),false,"Lower-edge one-minute option is not disabled");
    assert.equal(await bounded.locator('select option[value="30"]').evaluate(option=>option.disabled),true,"Lower-edge thirty-minute option is disabled");
    assert.equal(await bounded.locator('select option[value="120"]').evaluate(option=>option.disabled),true,"Lower-edge two-hour option is disabled");
    assert.ok(await bounded.locator('[data-birth-window-reference]').isVisible());
    await bounded.locator('select').selectOption('1');
    await bounded.getByRole('button',{name:'Check this window',exact:true}).click();
    await bounded.locator('[data-birth-window-verification]').waitFor({state:'attached',timeout:60000});
    const boundaryProbe=await page.evaluate(()=>({input:window.__birthWindowControls.inputs.at(-1),reply:window.__birthWindowControls.results.at(-1)}));
    const lowerUTC=boundaryProbe.input.input.input.at.toISOString();
    assert.equal(await page.locator('.calc__result [data-check-our-math] time').getAttribute('datetime'),lowerUTC);
    assert.ok(Date.parse(lowerUTC)>=Date.parse('1800-01-01T00:00:00Z')&&Date.parse(lowerUTC)<Date.parse('1800-01-01T00:30:00Z'),'The boundary worker uses the actual lower-edge chart instant');
    assert.ok(boundaryProbe.reply.result,'The supported boundary preset produces a real worker result');
    assert.equal(boundaryProbe.reply.error,undefined);
    assert.equal(boundaryProbe.reply.result.end.getTime()-boundaryProbe.reply.result.start.getTime(),2*60000);
    assert.ok(boundaryProbe.reply.result.start.getTime()>=Date.parse('1800-01-01T00:00:00Z'));
    assert.ok(boundaryProbe.reply.result.end.getTime()<Date.parse('2200-01-01T00:00:00Z'));
    const transport=new URL((await page.evaluate(()=>window.__birthWindowControls.created)).at(-1));
    if(development){
     assert.equal(transport.pathname,'/src/islands/birth-window.worker.ts');
     assert.ok(transport.searchParams.has('worker_file'),'Actual development worker module transport');
     assert.equal(transport.searchParams.get('type'),'module');
    }else assert.match(transport.pathname,/\/_astro\/birth-window\.worker[-.][^/]+\.js$/);
    assert.equal(await bounded.locator('[role="alert"]').count(),0);
    assert.deepEqual(errors,[]);
    const native=await page.evaluate(()=>window.__birthWindowControls);
    records.push({name:variant.name,viewport:variant,summary,native,boundaryInstants:{upperUTC,lowerUTC},controls:{noWorkerBeforeRequest:true,realSampledWindow:true,allCellsRendered:true,explicitCancelTerminates:true,windowChangeTerminates:true,chartReplacementTerminates:true,unknownTimeExcluded:true,noOverflow:true,outOfSpanEntryExcluded:true,boundaryOptionsDisabled:true,boundaryPresetNativeWorker:true,fullBoundaryWorker:true,committedBoundaryInstantsVerified:true},pageErrors:errors});
   }finally{hold?.release();hold=null;await context.close();}
  }}finally{await browser.close();}
 });
}catch(error){failure={name:error.name,message:String(error.message).slice(0,1500),stage,stack:String(error.stack).slice(0,3500)};}
const report={schema:development?'zodiacs.birth-time-window-development-controls.v1':'zodiacs.birth-time-window-ui-controls.v1',serverMode:development?'development':'production-preview',producer:{workflowSource:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},checkedOutSource:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',shell:false}).trim(),records,observations,passed:failure===null&&records.length===variants.length,failure,limitations:[development?'Actual development server and native worker in two Chromium viewports with public demonstration and synthetic chart inputs.':'Actual built UI and native worker in two Chromium viewports with public demonstration and synthetic chart inputs.','Only script loading is held for cancellation controls; no numerical result is injected.','No independent accuracy, repeated 1000-window benchmark, production deployment, saved-window model or general localization claim.']};
const path='docs/platform/evidence/birth-time-window-ui-20261010/'+(development?'development-browser-controls.json':'browser-controls.json'),bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');mkdirSync('docs/platform/evidence/birth-time-window-ui-20261010',{recursive:true});writeFileSync(path,bytes);
console.log('PROGRAMME_FILE '+JSON.stringify({path,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')}));
if(!report.passed)process.exitCode=1;
