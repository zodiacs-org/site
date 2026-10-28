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
  for(const card of await page.locator('.apps-hero__card img').all()){
   // With srcset, naturalWidth/naturalHeight are density-corrected integers.
   // Compare precise rendered geometry with the original reserved ratio instead.
   assert.equal(await card.evaluate(img=>{
    const box=img.getBoundingClientRect(),frame=img.parentElement.getBoundingClientRect();
    const ratio=Number(img.getAttribute('height'))/Number(img.getAttribute('width'));
    return Math.abs(box.height-box.width*ratio)<1&&Math.abs(frame.height-box.height)<1;
   }),true,'Hero cards keep their complete aspect ratio without a clipping frame');
  }
  for(const link of await page.locator('.apps-example-nav a').all()){
   const target=await link.getAttribute('href');await link.scrollIntoViewIfNeeded();await link.focus();await link.press('Enter');
   await page.waitForFunction(selector=>{
    const node=document.querySelector(selector);
    return node&&Math.abs(node.getBoundingClientRect().top-parseFloat(getComputedStyle(node).scrollMarginTop))<1;
   },target);
   const box=await page.locator(target).boundingBox();
   assert.ok(box&&box.y>=0&&box.y<height,'Keyboard example link reaches its visible section');
  }
  for(const name of ['birth charts','compatibility','occasions','horoscopes']){
   const button=page.getByRole('button',{name:new RegExp('^(Copy prompt|Copied) for '+name+'$')});
   await button.scrollIntoViewIfNeeded();const before=await button.boundingBox();await button.click();
   await button.getByText('Copied',{exact:true}).waitFor({state:'visible'});
   const after=await button.boundingBox();assert.equal(after.width,before.width,'Copy feedback preserves width');assert.equal(after.height,before.height,'Copy feedback preserves height');
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
  await page.getByText('Connect through a custom connector',{exact:true}).click();
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  const captureSection=async(selector,file,includeOpening=false)=>{
   const clip=await page.locator(selector).evaluate((element,opening)=>{
    const rect=element.getBoundingClientRect(),top=rect.top+scrollY;
    return {x:0,y:opening?0:Math.floor(top),width:innerWidth,height:Math.ceil(rect.height+(opening?top:0))};
   },includeOpening);
   await page.screenshot({path:out+'/'+file,fullPage:true,clip});
  };
  await captureSection('.apps-hero','hero-'+width+'.png',true);
  if(width===1440){
   await captureSection('#examples','examples-1440.png');
   await captureSection('#demo','demo-1440.png');
  }
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.locator('footer img').evaluateAll(images=>Promise.all(images.map(image=>image.decode().catch(()=>{}))));
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  // Capture-only paint override: the off-screen shared footer otherwise becomes
  // its blank content-visibility placeholder. No source or measured gate changes.
  await page.screenshot({path:out+'/apps-'+width+'.png',fullPage:true,style:'footer { content-visibility: visible !important; }'});
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
