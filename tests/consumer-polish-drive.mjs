/** Visual sweep using synthetic local data only. Run against a capture-enabled build. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const out=process.env.OUT_DIR || 'tests/visual/artifacts/consumer-polish';
await mkdir(out,{recursive:true});
const results=[];
const routes=['/','/profile/','/today/','/horoscopes/','/horoscopes/aries/','/tools/','/birth-chart/','/compatibility/','/sky-calendar/','/aries/','/learn/','/about/','/astrofolio/','/registry/virgo/','/es/profile/','/pt/profile/','/fr/profile/','/it/profile/','/ru/profile/'];
const profile={version:1,settings:{houseSystem:'whole'},charts:[{id:'99999999-9999-4999-8999-999999999999',name:'My chart',relationship:'self',createdAt:'2026-08-18T00:00:00.000Z',updatedAt:'2026-08-18T00:00:00.000Z',birth:{date:'1990-01-01',time:'12:00',timeKnown:true,place:null},summary:{engineVersion:'fixture',utcISO:'1990-01-01T12:00:00.000Z',houseSystem:'whole',bodies:[{body:'Sun',lon:20.2,retrograde:false},{body:'Moon',lon:213.1,retrograde:false}],angles:null,flags:[]}}]};
await withPreview({port:8907},async base=>{
 for(const [engine,driver,options] of [['chromium',chromium,{executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS}],['webkit',webkit,{}]]){
  const browser=await driver.launch({headless:true,...options});
  try{
   for(const width of [320,390,768,1440]) for(const route of (engine==='webkit'?['/profile/','/today/','/horoscopes/aries/','/ru/profile/']:routes)){
    const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
    page.setDefaultTimeout(15000);
    try{
     await page.addInitScript(p=>localStorage.setItem('zodiacs.profile.v1',JSON.stringify(p)),profile);
     const response=await page.goto(base+route,{waitUntil:'networkidle'});
     assert.equal(response.status(),200,route);
     await page.evaluate(()=>document.fonts.ready);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} overflows at ${width}`);
     if(route.endsWith('/profile/')){
      assert(await page.locator('[data-nav] a[href="/astrofolio/"]').isVisible(),`${route} misses Astrofolio`);
      assert.equal(await page.locator('.zfooter a[href="/astrofolio/"]').count(),1);
     }
     if(['/birth-chart/','/today/','/compatibility/','/sky-calendar/','/tools/'].includes(route)) assert.equal(await page.locator('[data-nav] a[href="/astrofolio/"]').count(),0);
     for(const chip of await page.locator('.guide-prompts__chip').all()){
      const box=await chip.boundingBox();if(box) assert(box.height>=44,`${route} small Guide target`);
     }
     if(route==='/today/'){
      const button=page.locator('[data-living-moment-open]');await button.waitFor();
      const metrics=await page.evaluate(()=>{
       const trigger=document.querySelector('[data-living-moment-open]'), hint=trigger.parentElement.querySelector('.field__help'), card=document.querySelector('.today-card'), upcoming=document.querySelector('.upcoming-events');
       return {height:trigger.getBoundingClientRect().height,radius:parseFloat(getComputedStyle(trigger).borderRadius),background:getComputedStyle(trigger).backgroundColor,hintGap:hint.getBoundingClientRect().top-trigger.getBoundingClientRect().bottom,eventGap:upcoming?upcoming.getBoundingClientRect().top-card.getBoundingClientRect().bottom:null};
      });
      assert(metrics.height>=44);assert(metrics.radius<=16);assert.equal(metrics.background,'rgba(0, 0, 0, 0)');assert(metrics.hintGap>=7.5);
      if(metrics.eventGap!==null) assert(metrics.eventGap>=23.5,`event gap ${metrics.eventGap}`);
      if(width===390&&engine==='chromium'){
       await button.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/today-save-and-spacing.png`});
       await button.click();await page.locator('.living-moment-composer textarea').waitFor();
       await page.getByRole('button',{name:'Cancel',exact:true}).click();await button.waitFor();
       assert(await button.evaluate(n=>document.activeElement===n),'Cancel restores focus');
      }
     }
     if(engine==='chromium'&&width===390&&route==='/profile/') await page.screenshot({path:`${out}/profile-navigation.png`});
     results.push({engine,width,route,passed:true});console.log(`PASS ${engine} ${width} ${route}`);
    }finally{await page.close();}
   }
  }finally{await browser.close();}
 }
});
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} consumer layout cases passed`);
