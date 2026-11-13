// Render the drafted thesis page from the branch (public/ served on localhost)
// and record what the hero's season line and the Pulse block print.
// Usage: node render_draft.cjs <base-url> <out.json>
// A second pass fakes the clock to instants late in six seasons, to show the
// day number no longer passes the total.
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const [base, outPath] = process.argv.slice(2);
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const out = { renderedAt: new Date().toISOString(), base };
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', locale: 'en-US' });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    const resp = await p.goto(base + '/thesis/', { waitUntil: 'load', timeout: 90000 });
    out.status = resp.status();
    out.heroMeta = await p.evaluate(() => document.querySelector('.hero__meta').innerText);
    out.heroClock = await p.evaluate(() => document.querySelector('[data-season-clock]').textContent);
    out.closing = await p.evaluate(() => document.querySelector('.thesis-close__sig').textContent.trim());
    out.seasonCaption = await p.evaluate(() => document.querySelector('#fig-2 .zfig-cap').textContent.trim());
    await p.evaluate(() => { const e = document.querySelector('[data-pulse]'); let n = e; while (n) { if (n.tagName === 'DETAILS') n.open = true; n = n.parentElement; } e.scrollIntoView(); });
    await p.waitForTimeout(9000);
    out.pulseLive = await p.evaluate(() => document.querySelector('[data-pulse]').classList.contains('is-live'));
    out.pulse = await p.evaluate(() => document.querySelector('[data-pulse]').innerText);
    out.archiveRow = await p.evaluate(() => { const k = [...document.querySelectorAll('.score__k')].find((e) => e.textContent.trim() === 'Archive continuity'); return k ? k.parentElement.textContent.replace(/\s+/g, ' ').trim() : null; });
    out.pageErrors = errors;
    await ctx.close();
  }
  out.fakedClock = [];
  for (const iso of ['2026-04-19T20:00:00Z', '2026-06-21T05:00:00Z', '2026-07-22T12:00:00Z', '2026-10-23T05:00:00Z', '2027-01-20T03:00:00Z', '2026-11-22T07:00:00Z', '2026-11-22T08:00:00Z']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript((t) => { const fixed = Date.parse(t); Date.now = () => fixed; }, iso);
    await p.goto(base + '/thesis/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForTimeout(300);
    out.fakedClock.push({ at: iso, line: await p.evaluate(() => document.querySelector('[data-season-clock]').textContent) });
    await ctx.close();
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
