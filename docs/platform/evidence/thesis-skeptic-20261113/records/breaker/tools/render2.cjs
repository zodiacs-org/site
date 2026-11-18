const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROME});
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok', locale: 'en-US' });
  const p = await ctx.newPage();
  const resp = await p.goto('https://zodiacs.org/thesis/', { waitUntil: 'networkidle', timeout: 90000 });
  const out = { fetchedAt: new Date().toISOString(), status: resp.status() };
  out.heroClock = await p.evaluate(() => { const e = document.querySelector('[data-season-clock]'); return e ? { text: e.textContent, visible: !!e.getClientRects().length, display: getComputedStyle(e).display, vis: getComputedStyle(e).visibility, op: getComputedStyle(e).opacity } : null; });
  await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  const h = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 700) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(150); }
  await p.evaluate(()=>{const e=document.querySelector('[data-pulse]');let n=e;while(n){if(n.tagName==='DETAILS')n.open=true;n=n.parentElement}e.scrollIntoView()});await p.waitForTimeout(8000);out.pulseRect=await p.evaluate(()=>JSON.stringify(document.querySelector('[data-pulse]').getBoundingClientRect()));
  out.pulse = await p.evaluate(() => { const e = document.querySelector('[data-pulse]'); return e ? e.innerText : null; });
  out.pulseLive = await p.evaluate(() => document.querySelector('[data-pulse]').classList.contains('is-live'));
  out.bodyLen = await p.evaluate(() => document.body.innerText.length);
  out.body = await p.evaluate(() => document.body.innerText);
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
