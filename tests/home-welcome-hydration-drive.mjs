import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {findChromium,STABLE_CHROMIUM_ARGS} from './visual/browser.mjs';
import {withPreview} from './visual/preview-server.mjs';
const records=[];let failure=null;
const variants=[
 {name:'mobile real poster',width:390,height:844,failedPoster:false},
 {name:'desktop real poster',width:1440,height:1000,failedPoster:false},
 {name:'poster failure still hydrates',width:390,height:844,failedPoster:true}
];
try {
 await withPreview({port:8792},async baseURL=>{
  const browser=await chromium.launch({executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS});
  try {
   for(const variant of variants){
    const context=await browser.newContext({viewport:{width:variant.width,height:variant.height},reducedMotion:'reduce'});
    const page=await context.newPage();const requests=[];
    let release;const held=new Promise(resolve=>{release=resolve;});
    await page.addInitScript(()=>{
     window.__homeWelcomePaint={fcp:null,posterLcp:null};
     new PerformanceObserver(list=>{
      for(const entry of list.getEntries())if(entry.name==='first-contentful-paint')window.__homeWelcomePaint.fcp=entry.startTime;
     }).observe({type:'paint',buffered:true});
     new PerformanceObserver(list=>{
      for(const entry of list.getEntries())if(entry.element?.matches('[data-hero-poster]')&&window.__homeWelcomePaint.posterLcp===null)window.__homeWelcomePaint.posterLcp=entry.startTime;
     }).observe({type:'largest-contentful-paint',buffered:true});
    });
    page.on('request',request=>{if(/\/_astro\/WelcomeBack\.[^/]+\.js(?:\?|$)/.test(request.url()))requests.push(request.url());});
    await page.route('**/assets/hero/zodiacs-hero-poster*.avif',async route=>{
     await held;
     if(variant.failedPoster)await route.abort('failed');else await route.continue();
    });
    try {
     await page.goto(baseURL+'/',{waitUntil:'domcontentloaded'});
     const island=page.locator('astro-island[component-url*="WelcomeBack."]');
     assert.equal(await island.count(),1,'Real welcome island is present');
     assert.equal(await island.getAttribute('client'),'interaction');
     await page.waitForTimeout(500);
     assert.equal(requests.length,0,'Welcome module fetched while the real poster was held');
     release();
     await page.waitForLoadState('load');
     await page.waitForFunction(()=>{
      const island=document.querySelector('astro-island[component-url*="WelcomeBack."]');
      return island&&!island.hasAttribute('ssr');
     },{},{timeout:10000});
     await page.waitForTimeout(100);
     assert.equal(requests.length,1,'Automatic load fallback hydrates once without interaction');
     const observed=await page.evaluate(()=>({
      paint:window.__homeWelcomePaint,
      modules:performance.getEntriesByType('resource').filter(entry=>/\/_astro\/WelcomeBack\.[^/]+\.js(?:\?|$)/.test(entry.name)).map(entry=>({startTime:entry.startTime,duration:entry.duration}))
     }));
     assert.equal(observed.modules.length,1);
     if(!variant.failedPoster){
      assert.ok(observed.paint.posterLcp!==null,'Actual real poster paint is recorded');
      assert.ok(observed.modules[0].startTime>observed.paint.posterLcp,'Welcome module follows the real poster paint');
     }
     records.push({name:variant.name,viewport:{width:variant.width,height:variant.height},failedPoster:variant.failedPoster,heldPosterMs:500,requestsWhilePosterHeld:0,automaticHydration:true,moduleRequests:requests.length,...observed});
    } finally {release();await context.close();}
   }
  } finally {await browser.close();}
 });
} catch(error){failure={name:error.name,message:String(error.message).slice(0,1500)};}
const report={
 schema:'zodiacs.home-welcome-hydration-controls.v1',
 producer:{workflowSource:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,node:process.version},
 checkedOutSource:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',shell:false}).trim(),
 records,passed:failure===null&&records.length===variants.length,failure,
 limitations:['Real local-build poster requests, anonymous empty profiles and automatic hydration only.','Returning saved-chart behavior is checked separately by the existing consumer drive.','No Lighthouse result, independent astronomy, private clearance or publication claim.']
};
const path='docs/platform/evidence/home-poster-loading-20261010/hydration-controls.json',bytes=Buffer.from(JSON.stringify(report,null,2)+'\n');
mkdirSync('docs/platform/evidence/home-poster-loading-20261010',{recursive:true});writeFileSync(path,bytes);
console.log('PROGRAMME_FILE '+JSON.stringify({path,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')}));
if(!report.passed)process.exitCode=1;
