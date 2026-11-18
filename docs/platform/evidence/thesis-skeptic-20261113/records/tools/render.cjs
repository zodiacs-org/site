const { chromium } = require('playwright-core') // run with NODE_PATH pointing at an install;
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok', locale: 'en-US' });
  const p = await ctx.newPage();
  const reqs = [];
  p.on('request', (r) => { const u = r.url(); if (!u.startsWith('data:')) reqs.push(r.method() + ' ' + u); });
  const resp = await p.goto('https://zodiacs.org/thesis/', { waitUntil: 'networkidle', timeout: 90000 });
  const out = { fetchedAt: new Date().toISOString(), status: resp.status(), userAgent: await p.evaluate(() => navigator.userAgent) };
  await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await p.waitForTimeout(4000);
  out.figures = await p.evaluate(() => [...document.querySelectorAll('figure,[data-motion]')].map((f) => ({ motion: f.getAttribute('data-motion'), cls: f.className, text: f.innerText })));
  out.seasonReadout = await p.evaluate(() => { const e = document.querySelector('[data-season-readout]'); return e ? e.textContent : null; });
  out.fieldReadout = await p.evaluate(() => { const e = document.querySelector('[data-motion="field"] [data-readout]'); return e ? e.textContent : null; });
  out.fieldSteps = [];
  const steps = await p.$$('[data-motion="field"] .field-step');
  for (const s of steps) {
    await s.click();
    await p.waitForTimeout(300);
    out.fieldSteps.push({
      label: (await s.innerText()).replace(/\s+/g, ' '),
      alive: await s.getAttribute('data-alive'),
      readout: await p.evaluate(() => document.querySelector('[data-motion="field"] [data-readout]').textContent),
      bigText: await p.evaluate(() => document.querySelector('[data-motion="field"] [data-readout]').parentElement.innerText.replace(/\s+/g, ' ')),
    });
  }
  out.ridges = [];
  const signs = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-motion="seasons"] .ridge')].map((g) => g.getAttribute('data-sign')))]);
  const clickRidge = (s) => p.evaluate((sign) => {
    const g = [...document.querySelectorAll('[data-motion="seasons"] .ridge[data-sign="' + sign + '"]')].find((x) => x.getClientRects().length);
    g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, s);
  for (const s of signs) {
    await clickRidge(s);
    out.ridges.push({ sign: s, readout: await p.evaluate(() => document.querySelector('[data-season-readout]').textContent) });
    await clickRidge(s);
  }
  out.mainText = await p.evaluate(() => document.body.innerText);
  out.requests = reqs;
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  for (const m of ['people', 'field', 'seasons']) {
    const el = await p.$('[data-motion="' + m + '"]');
    if (el) { await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await el.screenshot({ path: process.argv[3] + '-' + m + '.png' }); }
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
