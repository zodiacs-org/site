/** Browser QA for the public showcase. BASE_URL defaults to the local review server. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
const base=process.env.BASE_URL??'http://127.0.0.1:56640';
const out=process.env.APPS_QA_OUT??'/tmp/zodiacs-apps-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS,headless:true});
const checks=[];
try{
 for(const [width,height,motion,slowFonts] of [[390,844,'reduce',false],[430,932,'reduce',false],[1280,720,'reduce',false],[1440,900,'reduce',false],[390,844,'no-preference',true]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:motion,colorScheme:'dark',permissions:['clipboard-read','clipboard-write']});
  await context.addInitScript(()=>{window.__appsCLS=0;window.__appsShifts=[];new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){window.__appsCLS+=e.value;window.__appsShifts.push({value:e.value,time:e.startTime,sources:e.sources?.map(s=>({node:s.node?.outerHTML?.slice(0,250),from:s.previousRect,to:s.currentRect}))});}}).observe({type:'layout-shift',buffered:true});});
  const page=await context.newPage(),errors=[],media=[];if(slowFonts)await page.route('**/*.woff2',async route=>{await new Promise(r=>setTimeout(r,300));await route.continue();});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('.mp4'))media.push(r.url());});
  await page.goto(base+'/apps/',{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.apps-page h1').count(),1);
  assert.equal(await page.locator('.apps-examples article').count(),4);
  assert.equal(await page.locator('.apps-availability dd').allTextContents().then(v=>v.every(x=>x.includes('in review'))),true);
  assert.equal(await page.locator('.apps-connect a[href*="chatgpt.com"]').count(),0,'No private/unapproved installation link');
  assert.equal(media.length,0,'Video stays unloaded until played');
  for(const img of await page.locator('.apps-page img').all()){
   await img.scrollIntoViewIfNeeded();await img.evaluate(async image=>{if(!image.complete)await image.decode();});
   assert.equal(await img.evaluate(image=>image.naturalWidth>0&&image.width>0),true,'Image decoded');
  }
  for(const name of ['birth charts','compatibility','occasions','horoscopes']){
   const button=page.getByRole('button',{name:'Copy '+name+' prompt',exact:true});await button.click();
   const expected=await page.locator('#'+await button.getAttribute('data-copy-prompt')).textContent();
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected.trim());
  }
  await page.getByText('Connect through a custom connector',{exact:true}).click();
  await page.getByRole('button',{name:'Copy Zodiacs server address',exact:true}).click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'https://zodiacs.org/mcp');
  const links=await page.locator('.apps-page a[href^="/"]').evaluateAll(a=>a.map(x=>x.getAttribute('href')));
  for(const href of [...new Set(links)])assert.equal((await page.request.get(base+href)).status(),200,href);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' no horizontal overflow');
  const cls=await page.evaluate(()=>window.__appsCLS);await writeFile(out+'/shifts-'+width+'.json',JSON.stringify(await page.evaluate(()=>window.__appsShifts),null,2));assert.equal(cls,0,width+' CLS exactly zero');
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:out+'/apps-'+width+'.png',fullPage:true});
  if(width===1280){
   await page.locator('video').evaluate(async video=>{await video.play();video.pause();});
   const video=await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration}));
   assert.deepEqual(video,{width:1080,height:1600,duration:41});
  }
  assert.deepEqual(errors,[],width+' no browser errors');
  checks.push({width,height,cls,overflow:false,imagesDecoded:true,copyPrompts:true,copyEndpoint:true,ownedLinks200:true,reducedMotion:motion==='reduce',slowFonts,errors});
  await context.close();
 }
}finally{await browser.close();}
await writeFile(out+'/checks.json',JSON.stringify({checkedAt:new Date().toISOString(),base,checks},null,2)+'\n');console.log(JSON.stringify(checks));
