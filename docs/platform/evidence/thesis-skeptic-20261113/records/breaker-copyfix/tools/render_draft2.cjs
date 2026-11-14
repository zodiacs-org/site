// Breaker render of the drafted thesis page (ZOD-219 review).
// Usage: node render_draft2.cjs <base-url> <out.json>
// Records the hero, the Pulse block, every Wikimedia answer the page's own
// live request received (days returned per article), and the season line at
// faked instants, including every season end in the embedded table.
const { chromium } = require(process.env.PW || 'playwright-core');
const fs = require('fs');
(async () => {
  const [base, outPath] = process.argv.slice(2);
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const out = { renderedAt: new Date().toISOString(), base };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', locale: 'en-US' });
  const p = await ctx.newPage();
  const errors = []; const wm = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('response', async (r) => {
    if (!r.url().includes('wikimedia.org/api')) return;
    let days = null, last = null;
    try { const j = await r.json(); days = j.items.length; last = j.items[j.items.length - 1].timestamp; } catch (e) {}
    wm.push({ url: decodeURIComponent(r.url().split('/user/')[1] || r.url()), status: r.status(), days, last });
  });
  const resp = await p.goto(base + '/thesis/', { waitUntil: 'load', timeout: 90000 });
  out.status = resp.status();
  out.head = await p.evaluate(() => ({
    published: [...document.querySelectorAll('meta[property^="article:"]')].map((m) => m.getAttribute('property') + '=' + m.content),
    jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => (s.textContent.match(/"date[A-Za-z]+":\s*"[^"]+"/g) || [])).flat(),
  }));
  out.heroMeta = await p.evaluate(() => document.querySelector('.hero__meta').innerText);
  out.heroClock = await p.evaluate(() => document.querySelector('[data-season-clock]').textContent);
  out.closing = await p.evaluate(() => document.querySelector('.thesis-close__sig').textContent.trim());
  out.seasonCaption = await p.evaluate(() => document.querySelector('#fig-2 .zfig-cap').textContent.trim());
  out.seasonReadout = await p.evaluate(() => document.querySelector('[data-season-readout]').textContent.trim());
  await p.evaluate(() => { const e = document.querySelector('[data-pulse]'); let n = e; while (n) { if (n.tagName === 'DETAILS') n.open = true; n = n.parentElement; } e.scrollIntoView(); });
  await p.waitForTimeout(10000);
  out.pulseLive = await p.evaluate(() => document.querySelector('[data-pulse]').classList.contains('is-live'));
  out.pulse = await p.evaluate(() => document.querySelector('[data-pulse]').innerText);
  out.wikimediaAnswers = wm;
  out.bodyHits = await p.evaluate(() => {
    const t = document.body.innerText; const h = document.documentElement.outerHTML;
    const find = (re, s) => (s.match(re) || []).slice(0, 20);
    return {
      strongest_text: find(/[^.\n]*strongest[^.\n]*/gi, t), goldLine: find(/gold line/gi, t),
      gainsMost: find(/[^.\n]*(gains the most|the least \()[^.\n]*/gi, t),
      published: find(/[^\n]{0,40}Published[^\n]{0,40}/g, t), datePublished: find(/datePublished|published_time/g, h),
      community: find(/[^.\n]*communit[^.\n]*/gi, t), since2024: find(/[^.\n]*since 2024[^.\n]*/gi, t),
    };
  });
  out.pageErrors = errors;
  await ctx.close();
  // Season line at instants: one hour before every season end in the table, plus one minute after each start.
  const windows = await (async () => { const c = await b.newContext(); const q = await c.newPage(); await q.goto(base + '/thesis/', { waitUntil: 'domcontentloaded' });
    const html = await q.content(); await c.close(); const m = html.match(/var WINDOWS = \[([\s\S]*?)\];/); return m ? m[1] : null; })();
  out.windowsFound = !!windows;
  out.fakedClock = [];
  const stamps = windows ? [...windows.matchAll(/'(\d{4}-\d\d-\d\dT[\d:.]+Z)'/g)].map((m) => m[1]) : [];
  const uniq = [...new Set(stamps)].sort();
  const c2 = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  for (const iso of uniq) {
    for (const off of [-60000, 60000]) {
      const t = Date.parse(iso) + off;
      const p2 = await c2.newPage();
      await p2.addInitScript((f) => { Date.now = () => f; }, t);
      await p2.route('**/*', (r) => (r.request().resourceType() === 'document' ? r.continue() : r.abort()));
      await p2.goto(base + '/thesis/', { waitUntil: 'domcontentloaded', timeout: 90000 });
      const line = await p2.evaluate(() => document.querySelector('[data-season-clock]').textContent);
      const m = line.match(/day (\d+) of (\d+)/);
      out.fakedClock.push({ at: new Date(t).toISOString(), line, over: m ? Number(m[1]) > Number(m[2]) : null });
      await p2.close();
    }
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
