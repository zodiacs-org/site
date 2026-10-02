/**
 * The three developer first-use paths, driven at two viewports in both browsers
 * this machine has.
 *
 *   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=… npm run test:firstuse:browser
 *
 * These assertions exist because an inventory found each of them wrong: the hub
 * had no card for connecting an assistant and none for the comparison tool; the
 * MCP page put its prerequisites after the commands they are prerequisites for;
 * the comparison tool led with the preset whose entire result is that there is
 * no result; and the widgets page said birth details never leave the browser
 * without saying that loading the widget is itself a request to zodiacs.org.
 *
 * Every chart here is synthetic. Firefox is driven as well as Chromium because
 * the layout and focus assertions are the kind that differ between engines.
 */
import { existsSync, globSync, readFileSync } from 'node:fs';
import { chromium, firefox } from 'playwright-core';
import { withPreview } from './visual/preview-server.mjs';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';

const results = [];
const check = (n, ok, d) => { results.push({ n, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || d === undefined ? '' : ` · ${JSON.stringify(d)}`}`); };

/**
 * Same order as `findChromium`: an explicit path, then whatever Playwright
 * manages here, then the host's own. The build number in the managed path moves
 * with every playwright bump, so it is discovered rather than written down.
 */
function findFirefox() {
  const explicit = process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return explicit;
  let managed;
  try { managed = firefox.executablePath(); } catch { managed = undefined; }
  const candidates = [
    managed,
    ...globSync('/opt/pw-browsers/firefox-*/firefox/firefox').sort().reverse(),
    '/usr/bin/firefox',
  ];
  return candidates.find((path) => path && existsSync(path)) ?? null;
}

const MANIFEST = JSON.parse(readFileSync(new URL('../public/examples/mcp-server.json', import.meta.url), 'utf8'));
const WIDGET_PRIVACY = /privacyNote: '((?:[^'\\]|\\.)*)'/.exec(
  readFileSync(new URL('../src/strings/widgets.ts', import.meta.url), 'utf8'),
)?.[1].replace(/\\'/g, "'");
if (!WIDGET_PRIVACY) throw new Error('could not read widgets.privacyNote from the strings module');

await withPreview({ port: Number(process.env.FIRST_USE_DRIVE_PORT ?? 4461) }, async (BASE) => {
  const CHROMIUM = await findChromium();
  for (const [engineName, launch] of [
    ['chromium', () => chromium.launch({ executablePath: CHROMIUM, args: STABLE_CHROMIUM_ARGS })],
    ['firefox', () => firefox.launch({ executablePath: findFirefox() ?? undefined })],
  ]) {
    let browser;
    try { browser = await launch(); } catch (e) { check(`${engineName}: launches`, false, e.message); continue; }
    for (const vp of [{ n: 'desktop', width: 1280, height: 900 }, { n: 'mobile', width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      const errs = []; const offOrigin = [];
      page.on('pageerror', (e) => errs.push(e.message));
      page.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) offOrigin.push(r.url()); });
      const tag = `${engineName}/${vp.n}`;

      await page.goto(`${BASE}/developers/`, { waitUntil: 'networkidle' });
      const cards = await page.locator('.dev-paths > li h2 a').evaluateAll((a) => a.map((x) => ({ text: x.textContent.trim(), href: x.getAttribute('href') })));
      check(`${tag}: hub leads with the jobs, the two ways to calculate first, then compare, then the conformance suite`,
        JSON.stringify(cards.map((c) => c.href)) === JSON.stringify(['/developers/engine/', '/developers/compute/', '/widgets/', '/developers/mcp/', '/developers/compare/', '/developers/conformance/']), cards);
      check(`${tag}: no horizontal overflow on the hub`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      check(`${tag}: hub renders without page errors`, errs.length === 0, errs);

      await page.goto(`${BASE}/developers/mcp/`, { waitUntil: 'networkidle' });
      const order = await page.evaluate(() => {
        const t = document.body.innerText;
        return { prereq: t.indexOf('You need Node'), block: t.indexOf('set -eu'), privacy: t.indexOf('The calculation is local') };
      });
      check(`${tag}: prerequisites come before the command block`, order.prereq > -1 && order.prereq < order.block, order);
      check(`${tag}: the privacy distinction comes before both`, order.privacy > -1 && order.privacy < order.prereq, order);
      const body = await page.evaluate(() => document.body.innerText);
      // Read from the block a visitor copies, not from anywhere on the page: the
      // properties that matter are properties of those commands. The unit test
      // in scripts/mcp-install-block.test.mjs executes them; this checks the
      // page ships that same shape, digest and pinned URL, rendered and visible.
      const install = await page.locator('pre[aria-label="Install commands"] code').innerText();
      const at = (needle) => install.indexOf(needle);
      check(`${tag}: the install block is the whole subshell, rendered`,
        install.startsWith('( set -eu\n') && install.trimEnd().endsWith(')'), install.slice(0, 40));
      check(`${tag}: it compares the published digest rather than printing one`,
        install.includes('createHash') && install.includes(MANIFEST.sha256)
        && !/shasum\s+-a\s+256/.test(install));
      check(`${tag}: nothing is created or unpacked before that comparison`,
        at('createHash') > -1 && at('createHash') < at('mkdir "$DEST"')
        && at('createHash') < at('tar -xzf'), {
          createHash: at('createHash'), mkdir: at('mkdir "$DEST"'), tar: at('tar -xzf'),
        });
      check(`${tag}: the download is pinned to the commit that holds the archive`,
        install.includes(MANIFEST.artifactCommit) && install.includes("--proto '=https'"));
      check(`${tag}: a synthetic request and its expected result are shown`,
        body.includes('1988-03-21T06:45:00Z') && body.includes('274.044963'));
      check(`${tag}: the accepted record format is named`, body.includes('zodiacs.natal-envelope.draft-v1'));
      // The reply carries the record in a field. Saying "output: record returns
      // the record" sent readers to hand the whole reply to the comparison,
      // which refuses it.
      check(`${tag}: the record is described as a field of the reply`,
        /record<\/code> field of\s+its reply|record<\/code> field of its reply/.test(
          await page.locator('main').innerHTML(),
        ) && /Pass the field, not the reply/.test(body));
      check(`${tag}: the input range is not offered as a validated accuracy range`,
        body.includes('1800 to 2199') && /accepted input range/.test(body));

      await page.goto(`${BASE}/developers/compare/`, { waitUntil: 'networkidle' });
      const presets = await page.locator('[data-compare-preset]').evaluateAll((n) => n.map((x) => x.getAttribute('data-compare-preset')));
      check(`${tag}: the first preset demonstrates a cause`, presets[0] === 'house-system', presets);
      // Ordering the presets is only worth anything if the first one works. A
      // newcomer clicks it before reading; run it and read what comes back.
      await page.locator('[data-compare-preset]').first().click();
      await page.locator('[data-compare-result], [data-compare-error]')
        .first().waitFor({ state: 'visible', timeout: 20000 });
      const first = await page.evaluate(() => {
        const result = document.querySelector('[data-compare-result]');
        return {
          error: !!document.querySelector('[data-compare-error]'),
          verdict: result?.getAttribute('data-compare-result') ?? null,
          causes: document.querySelectorAll('[data-compare-explanations] > li').length,
          rows: document.querySelectorAll('[data-compare-table] tbody tr').length,
          movedCusps: document.querySelectorAll('[data-compare-table] tbody tr[data-difference^="cusp-"]').length,
          text: result?.innerText ?? '',
        };
      });
      check(`${tag}: the first preset runs and names a cause, not an empty answer`,
        !first.error && first.verdict === 'differs' && first.causes > 0 && first.rows > 0, first);
      check(`${tag}: and it does not claim the cusps agree while listing moved cusps`,
        !(first.movedCusps > 0 && /cusps are the same/.test(first.text)),
        { movedCusps: first.movedCusps, text: first.text.slice(0, 160) });
      const cmp = await page.evaluate(() => document.body.innerText);
      check(`${tag}: the page says where records come from`, cmp.includes('zodiacs.natal-envelope.draft-v1'));
      check(`${tag}: it does not promise another program's export`, !/Two programs can calculate/.test(cmp));

      await page.goto(`${BASE}/widgets/`, { waitUntil: 'networkidle' });
      const w = await page.evaluate(() => document.body.innerText);
      // The whole note, as the strings module holds it — not a phrase from it.
      // A phrase survives an edit that drops the part being checked for, and the
      // part that kept getting dropped is the one naming a request.
      check(`${tag}: the widgets page carries the privacy note in full`,
        w.includes(WIDGET_PRIVACY), WIDGET_PRIVACY.slice(0, 80));
      check(`${tag}: it names the city-list request as well as the asset request`,
        /city list from zodiacs\.org/.test(w) && /request to zodiacs\.org/.test(w));

      await page.keyboard.press('Tab');
      check(`${tag}: keyboard focus enters the page visibly`, await page.locator(':focus-visible').count() === 1);
      check(`${tag}: nothing left the origin`, offOrigin.length === 0, offOrigin.slice(0, 3));
      await page.close();
    }
    await browser.close();
  }
});
const bad = results.filter((r) => !r.ok);
console.log(bad.length ? `\n${bad.length} FAILURES` : `\nALL PASS (${results.length} checks)`);
process.exit(bad.length ? 1 : 0);
