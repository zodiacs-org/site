import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {findChromium,STABLE_CHROMIUM_ARGS} from './visual/browser.mjs';
import {startPreview} from './visual/preview-server.mjs';
const out=process.env.OUT_DIR??'/tmp/lens-cross-asset-browser';await mkdir(out,{recursive:true});
// DESK_BASE_URL drives an already running server instead of a local Astro preview.
const preview=process.env.DESK_BASE_URL?{baseURL:process.env.DESK_BASE_URL,stop:async()=>{}}:await startPreview({port:4395});
const browser=await chromium.launch({executablePath:await findChromium(),args:STABLE_CHROMIUM_ARGS});
const errors=[],requests=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 let syntheticPrices=false;
 await context.route('**/api/registry/lens?*',async route=>{
  const q=new URL(route.request().url()).searchParams,id=q.get('instrument'),interval=q.get('interval');
  if(!syntheticPrices||!['BTC-USD','ETH-USD','SOL-USD','XRP-USD'].includes(id)){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'display-disabled'})});return;}
  const seconds=interval==='1h'?3600:86400,now=Date.now()/1000,end=Number(q.get('end'))||Math.floor(now/seconds)*seconds+seconds,start=Number(q.get('start'))||end-240*seconds;
  const candles=Array.from({length:(end-start)/seconds},(_,n)=>({time:start+n*seconds,open:100+n,high:102+n,low:99+n,close:101+n,volume:5,complete:start+(n+1)*seconds<=now}));
  const instrument={id,name:id,base:id.split('-')[0],quote:'USD',venue:'Coinbase Exchange',sourceUrl:`https://exchange.coinbase.com/trade/${id}`};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({schema:1,instrument,interval,candles,fetchedAt:new Date(now*1000).toISOString(),source:`https://api.exchange.coinbase.com/products/${id}/candles`,stale:false,coverage:{requestedStart:start,requestedEnd:end,start,end:end-seconds,gaps:[]},warnings:['SYNTHETIC BROWSER TEST ONLY — not market data.']})});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));context.on('request',r=>requests.push({url:r.url(),body:r.postData()??''}));
 await page.goto(`${preview.baseURL}/terminal/desk/`);await page.getByTestId('lens-instrument').waitFor();await page.getByText('Market prices are not enabled for this deployment.',{exact:false}).waitFor();
 assert.equal(await page.locator('.lens-market-summary strong').innerText(),'—');checks.push('Disabled response keeps prices empty and calendar/planning usable');
 await page.getByRole('button',{name:'Stocks',exact:true}).click();await page.getByLabel('Search assets').fill('Toyota');await page.getByTestId('lens-instrument').selectOption('XTKS:7203');await page.getByRole('button',{name:'Add favorite',exact:true}).click();
 // Preferences and favorites persist in effects after render; reload only once both are stored.
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zodiacs-lens-favorites-v1')??'null')?.ids?.includes('XTKS:7203')&&JSON.parse(localStorage.getItem('zodiacs-market-lens-preferences-v1')??'{}').instrument==='XTKS:7203');await page.reload();await page.getByTestId('lens-instrument').waitFor();assert.equal(await page.getByTestId('lens-instrument').inputValue(),'XTKS:7203');await page.getByRole('button',{name:'Remove favorite',exact:true}).waitFor();
 await page.getByTestId('lens-tab-setup').click();await page.getByText('Verified tick, lot and multiplier metadata are required for sizing.').waitFor();checks.push('Search, stable overseas identity and favorites persist; unverified sizing refuses');
 await page.getByTestId('lens-instrument').selectOption('FX:USD/JPY');await page.getByLabel('Cash equity (JPY)',{exact:true}).fill('1000000');await page.getByLabel('Entry (JPY)',{exact:true}).fill('150');await page.getByLabel('Stop (JPY)',{exact:true}).fill('149');
 for(const [label,value]of [['Technical setup / price levels','SYNTHETIC-PRIVATE-FX'],['Confirmation condition','Wait for a finalized session'],['Invalidation condition','Stop below entry'],['Timing hypothesis','Unvalidated test hypothesis']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByTestId('setup-timing').selectOption('none');await page.getByTestId('trade-window').waitFor();await page.getByRole('button',{name:'Save setup to journal',exact:true}).click();await page.getByText('Setup saved in your private journal.',{exact:false}).waitFor();await page.getByTestId('lens-tab-journal').click();await page.getByText('Saved setup / risk context',{exact:true}).click();assert.match(await page.getByTestId('journal-entry').innerText(),/JPY/);assert.doesNotMatch(await page.getByTestId('journal-entry').innerText(),/\$150|NaN/);checks.push('FX cash plan saves and renders quote currency, with no USD substitution');
 await page.getByTestId('lens-tab-chart').click();syntheticPrices=true;await page.getByTestId('lens-instrument').selectOption('SOL-USD');await page.locator('[data-testid="lens-chart"] canvas').first().waitFor();await page.locator('.lens-data-table summary').click();await page.locator('.lens-data-table caption').filter({hasText:'SOL-USD'}).waitFor();
 await page.getByTestId('lens-instrument').selectOption('FX:EUR/USD');await page.getByText('Market prices are not enabled for this deployment.',{exact:false}).waitFor();assert.equal(await page.locator('.lens-market-summary strong').innerText(),'—');assert.equal(await page.locator('[data-testid="lens-chart"] canvas').count(),0);checks.push('Clearly labeled synthetic SOL chart clears fully when switching to unavailable FX');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.ok(!requests.some(r=>r.url.includes('SYNTHETIC-PRIVATE-FX')||r.body.includes('SYNTHETIC-PRIVATE-FX')));
 await page.getByTestId('lens-tab-calendar').click();await page.locator('.lens-calendar').waitFor();await page.screenshot({path:`${out}/cross-asset-disabled-mobile.png`,fullPage:true});
 assert.deepEqual(errors,[]);checks.push('Mobile layout fits; private journal text never enters network requests; no page errors');
 await writeFile(`${out}/acceptance.json`,JSON.stringify({at:new Date().toISOString(),status:'passed',transport:'built production UI; explicitly synthetic or disabled market response fixtures, no live market acceptance',checks},null,2)+'\n');console.log(JSON.stringify({status:'passed',checks},null,2));
}finally{await browser.close();await preview.stop();}
