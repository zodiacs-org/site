/** Local, synthetic photos only; verifies the real rendered navigation. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
const out=process.env.OUT_DIR || '/tmp/zodiacs-profile-navigation';
await mkdir(out,{recursive:true});
const photo='data:image/jpeg;base64,'+(await sharp({create:{width:28,height:28,channels:3,background:'#B9D4BE'}}).jpeg().toBuffer()).toString('base64');
await withPreview({port:8911},async base=>{
 const browser=await chromium.launch({executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS});
 try{
  for(const route of ['/profile/','/es/profile/','/pt/profile/','/fr/profile/','/it/profile/','/ru/profile/','/astrofolio/','/registry/virgo/','/sdk/']) for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
   await page.goto(base+route,{waitUntil:'networkidle'});
   const nav=page.locator('.nav__profile-shortcut, .wnav__profile-shortcut');
   assert(await nav.isVisible());assert(await nav.locator('.nav__profile-icon, .wnav__profile-icon').isVisible());
   assert(await nav.getAttribute('aria-label'));assert((await nav.boundingBox()).height>=44);
   const box=await nav.boundingBox();
   const chip=page.locator('[data-nav] .nav__chip, [data-wnav] .wnav__chip');
   const chipBox=await chip.boundingBox();
   assert(width < 920 ? chipBox.x+chipBox.width<=box.x+0.5 : box.x+box.width<=chipBox.x+0.5,'Mobile retains its order; desktop places Astrofolio last');
   const search=page.locator('[data-nav] .nav__search, [data-wnav] .wnav__search');
   if(await search.isVisible()) assert(box.x+box.width<=(await search.boundingBox()).x+0.5,'Profile → search on every layout');
   const beforeChip=await search.isVisible()?search:nav;
   if(width >= 920) assert((await beforeChip.boundingBox()).x+(await beforeChip.boundingBox()).width<=chipBox.x+0.5,'Desktop search stays left of the Astrofolio divider');
   await beforeChip.focus();await page.keyboard.press('Tab');
   assert(await chip.evaluate(node=>document.activeElement===node),'Matching keyboard order');
   await page.mouse.click(10,90);
   if(route === '/profile/') await page.locator('[data-nav]').screenshot({path:`${out}/navigation-${width}.png`});
   const set=async value=>page.evaluate(value=>{localStorage.setItem('zodiacs.me.v1',JSON.stringify({version:1,photo:value}));window.dispatchEvent(new Event('zodiacs:me'));},value);
   await set(photo);await nav.locator('img').waitFor();
   assert.equal(await nav.locator('img').getAttribute('src'),photo);
   assert.equal(await nav.locator('.nav__profile-icon, .wnav__profile-icon').isVisible(),false);
   assert(await nav.locator('img').evaluate(img=>img.complete&&img.naturalWidth===28));
   for(const bad of ['https://example.invalid/photo.jpg','data:image/svg+xml,<svg/>',photo+'!','data:image/jpeg;base64,/9j/'+ 'A'.repeat(100000)]){
    await set(bad);assert.equal(await nav.locator('img').count(),0);assert(await nav.locator('.nav__profile-icon, .wnav__profile-icon').isVisible());
   }
   await set(photo);
   for (const ownerKey of ['zodiacs.account-sync-v2.local-owner.v1', 'zodiacs.account-sync-v2.retained-owner.v1']) {
    await page.evaluate(key=>{localStorage.setItem(key,JSON.stringify({version:1,accountId:'synthetic-owner'}));window.dispatchEvent(new StorageEvent('storage',{key}));},ownerKey);
    assert.equal(await nav.locator('img').count(),0,'Owned caches stay hidden on pages without an account coordinator');
    await page.evaluate(key=>{localStorage.removeItem(key);window.dispatchEvent(new StorageEvent('storage',{key}));},ownerKey);
    assert.equal(await nav.locator('img').count(),1,'Unowned local profile remains available');
   }
   await page.evaluate(()=>{document.documentElement.setAttribute('data-account-sync-v2','');window.dispatchEvent(new Event('zodiacs:profile-access'));});
   assert.equal(await nav.locator('img').count(),0,'Account gate must clear the local photo');
   await page.evaluate(()=>{document.documentElement.removeAttribute('data-account-sync-v2');window.dispatchEvent(new Event('zodiacs:profile-access'));});
   assert.equal(await nav.locator('img').count(),1);
   await page.evaluate(()=>{localStorage.removeItem('zodiacs.me.v1');window.dispatchEvent(new StorageEvent('storage',{key:'zodiacs.me.v1'}));});
   assert.equal(await nav.locator('img').count(),0,'Other-tab removal must clear the photo');
   assert(await nav.locator('.nav__profile-icon, .wnav__profile-icon').isVisible());
   await page.evaluate(()=>{localStorage.setItem('zodiacs.me.v1',JSON.stringify({version:1,displayName:'Nav test'}));window.dispatchEvent(new Event('zodiacs:me'));});
   assert.deepEqual(await nav.locator('[data-profile-avatar]').evaluate(node=>({text:node.textContent,background:getComputedStyle(node).backgroundColor,color:getComputedStyle(node).color})),{text:'N',background:'rgb(198, 204, 218)',color:'rgb(6, 7, 9)'},'Initials use the same neutral palette on every page');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   console.log(`PASS ${route} ${width}: icon, photo, rejected URLs, account gate, removal`);await page.close();
  }
 }finally{await browser.close();}
});
