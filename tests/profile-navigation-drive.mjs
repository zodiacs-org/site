/** Local, synthetic photos only; verifies the real rendered navigation. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
const photo='data:image/jpeg;base64,'+(await sharp({create:{width:28,height:28,channels:3,background:'#B9D4BE'}}).jpeg().toBuffer()).toString('base64');
await withPreview({port:8911},async base=>{
 const browser=await chromium.launch({executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS});
 try{
  for(const locale of ['','es','pt','fr','it','ru']) for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
   await page.goto(base+(locale?`/${locale}`:'')+'/profile/',{waitUntil:'networkidle'});
   const nav=page.locator(width<920?'.nav__profile-shortcut':'.nav__saved');
   assert(await nav.isVisible());assert(await nav.locator('.nav__profile-icon').isVisible());
   assert(await nav.getAttribute('aria-label'));assert((await nav.boundingBox()).height>=44);
   const set=async value=>page.evaluate(value=>{localStorage.setItem('zodiacs.me.v1',JSON.stringify({version:1,photo:value}));window.dispatchEvent(new Event('zodiacs:me'));},value);
   await set(photo);await nav.locator('img').waitFor();
   assert.equal(await nav.locator('img').getAttribute('src'),photo);
   assert.equal(await nav.locator('.nav__profile-icon').isVisible(),false);
   assert(await nav.locator('img').evaluate(img=>img.complete&&img.naturalWidth===28));
   for(const bad of ['https://example.invalid/photo.jpg','data:image/svg+xml,<svg/>',photo+'!','data:image/jpeg;base64,/9j/'+ 'A'.repeat(100000)]){
    await set(bad);assert.equal(await nav.locator('img').count(),0);assert(await nav.locator('.nav__profile-icon').isVisible());
   }
   await set(photo);
   await page.evaluate(()=>{document.documentElement.setAttribute('data-account-sync-v2','');window.dispatchEvent(new Event('zodiacs:profile-access'));});
   assert.equal(await nav.locator('img').count(),0,'Account gate must clear the local photo');
   await page.evaluate(()=>{document.documentElement.removeAttribute('data-account-sync-v2');window.dispatchEvent(new Event('zodiacs:profile-access'));});
   assert.equal(await nav.locator('img').count(),1);
   await page.evaluate(()=>{localStorage.removeItem('zodiacs.me.v1');window.dispatchEvent(new StorageEvent('storage',{key:'zodiacs.me.v1'}));});
   assert.equal(await nav.locator('img').count(),0,'Other-tab removal must clear the photo');
   assert(await nav.locator('.nav__profile-icon').isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   console.log(`PASS ${locale||'en'} ${width}: icon, photo, rejected URLs, account gate, removal`);await page.close();
  }
 }finally{await browser.close();}
});
