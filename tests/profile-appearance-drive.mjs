/** Synthetic chart/photo only: no account, real birth data or network writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';
import sharp from 'sharp';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
const out = process.env.OUT_DIR ?? '/tmp/zodiacs-profile-appearance';
await mkdir(out, {recursive:true});
const profile = {version:1,settings:{houseSystem:'whole'},charts:[{id:'11111111-1111-4111-8111-111111111111',name:'Maya',relationship:'self',createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z',birth:{date:'1990-01-01',time:null,timeKnown:false,place:null},summary:{engineVersion:'fixture',utcISO:'1990-01-01T12:00:00Z',houseSystem:'whole',bodies:[{body:'Sun',lon:280,retrograde:false},{body:'Moon',lon:330,retrograde:false}],angles:null,flags:[]}}]};
const photo = await sharp({create:{width:600,height:400,channels:3,background:'#B9D4BE'}}).png().toBuffer();
const results=[];
await withPreview({port:8910}, async base => {
 for (const engine of ['chromium','webkit']) {
  const browser = engine==='chromium' ? await chromium.launch({executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS}) : await webkit.launch();
  try { for (const width of [320,390,768,1440]) {
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<800,reducedMotion:'reduce',serviceWorkers:'block'});
   await context.route('https://*.supabase.co/**',r=>r.abort());
   await context.addInitScript(p=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('zodiacs.profile.v1',JSON.stringify(p));localStorage.setItem('zodiacs.me.v1',JSON.stringify({version:1,displayName:'Maya',keepCloseDismissed:true}));sessionStorage.setItem('seeded','1');}},profile);
   const page=await context.newPage();await page.goto(base+'/profile/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   const avatar=page.locator('.pf-me__initial button');await avatar.waitFor();
   assert(await avatar.locator('.pf-photo-button__edit').isVisible());
   if(engine==='chromium' && width===390) await page.screenshot({path:out+'/profile-mobile.png'});
   if(engine==='chromium' && width===1440) await page.screenshot({path:out+'/profile-desktop.png'});
   await avatar.click();await page.locator('#pf-me-edit').waitFor();
   const choose=page.locator('.pf-photo-choose');assert((await choose.boundingBox()).height>=44);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(engine==='chromium' && width===390){await page.locator('#pf-me-edit').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/photo-editor-mobile.png'});}
   await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.waitForFunction(()=>document.activeElement===document.querySelector('.pf-me__initial button'),null,{timeout:2000});
   await avatar.click();
   const picker=page.waitForEvent('filechooser');await choose.click();await(await picker).setFiles({name:'test.png',mimeType:'image/png',buffer:photo});
   await page.getByAltText('Photo preview',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zodiacs.me.v1')).photo),undefined);
   await page.locator('#pf-me-edit').getByRole('button',{name:'Save',exact:true}).click();await page.getByAltText('Your profile photo',{exact:true}).waitFor();
   await page.waitForFunction(()=>document.activeElement===document.querySelector('.pf-me__initial button'),null,{timeout:2000});
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('zodiacs.me.v1')).photo);assert(stored.startsWith('data:image/jpeg;base64,') && stored.length<100000);
   await page.reload({waitUntil:'networkidle'});await page.getByAltText('Your profile photo',{exact:true}).waitFor();
   await avatar.click();await page.getByRole('button',{name:'Remove photo',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert(await page.getByAltText('Your profile photo',{exact:true}).isVisible());
   await avatar.click();await page.locator('#pf-me-photo').setInputFiles({name:'not-a-photo.txt',mimeType:'text/plain',buffer:Buffer.from('test')});await page.getByRole('alert').filter({hasText:'Choose a JPG'}).waitFor();assert(await page.getByAltText('Photo preview',{exact:true}).isVisible());
   await page.getByRole('button',{name:'Remove photo',exact:true}).click();await page.locator('#pf-me-edit').getByRole('button',{name:'Save',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zodiacs.me.v1')).photo),undefined);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   results.push({engine,width,passed:true});console.log(`PASS ${engine} ${width}: chooser, preview, save, reload, cancel, removal, error and focus`);await context.close();
  }}finally{await browser.close();}
 }
});
await writeFile(out+'/results.json',JSON.stringify(results,null,2));
