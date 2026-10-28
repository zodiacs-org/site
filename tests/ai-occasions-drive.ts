/**
 * Browser drive for the occasions panel: real Chromium, synthetic host
 * bridges, results from the real occasion tools, local copies of static art. Writes
 * screenshots to docs/platform/zodiacs-ai/evidence/. Run with
 * npx vite-node --script tests/ai-occasions-drive.ts.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { OCCASIONS_HTML } from '../integrations/generated/occasions.mjs';
import { executeAiTool } from '../src/ai-tools/tools';
import type { AiToolName } from '../src/ai-tools/contracts';
import { plain as plainWords } from '../src/ai-tools/card-kit/words';

/** A card's words under its lockup: the lockup's dot is the brand mark, not copy. */
const copyOf = (text: string) => text.replace(/^ZODIACS·ORG\n/u, '');

const NOW = new Date('2026-10-13T12:00:00Z');
async function result(tool: AiToolName, args: Record<string, unknown>) {
  const answer = await executeAiTool(tool, args, { occasions: true, now: () => NOW });
  assert.equal(answer.ok, true, `${tool} answered`);
  return answer;
}
const wedding = await result('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', time: '19:00', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy', names: 'Ana & Luis' });
const baby = await result('get_occasion_sky', { occasion: 'baby', date: '2026-10-23' });
const milestones = await result('get_life_milestones', { birthDate: '1997-03-15' });

/** A card's first screen is the moment and one action; the rest is behind "More from this reading". Open it, as a reader would. */
async function unfold(page: Page) {
  if (await page.locator('details.fold').count() === 0) return;
  await page.locator('details.fold > summary').click();
  await page.locator('details.fold[open] .fold-body').waitFor();
}

async function show(page: Page, structuredContent: unknown) {
  await page.evaluate(content => {
    (window as any).openai = { toolOutput: content };
    window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: content } } }));
  }, structuredContent);
}

async function capture(page: Page, filename: string) {
  await page.waitForFunction(() => {
    const visible = [...document.querySelectorAll<HTMLImageElement>('.art-frame img')]
      .filter((img) => getComputedStyle(img).display !== 'none');
    return visible.length > 0 && visible.every((img) => img.complete && img.naturalWidth > 0);
  });
  await page.screenshot({ path: new URL(filename, out).pathname, fullPage: true });
}

const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const out = new URL('../docs/platform/zodiacs-ai/evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const errors: string[] = [];
const network: string[] = [];
try {
  const context = await browser.newContext({ viewport: { width: 760, height: 900 }, timezoneId: 'Asia/Bangkok' });
  await context.route('https://zodiacs.org/assets/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const body = await readFile(new URL(`../public${pathname}`, import.meta.url));
    await route.fulfill({ body, contentType: pathname.endsWith('.avif') ? 'image/avif' : 'image/webp' });
  });
  const open = async (html = OCCASIONS_HTML) => {
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith('data:')) network.push(request.url()); });
    await page.setContent(html);
    return page;
  };

  // A wedding with a time and a place: the card, the evening on Rome's clock, the printable card's link.
  const page = await open();
  assert.match(await page.getByRole('status').innerText(), /^Working out the sky…$/);
  await show(page, wedding);
  const data = (wedding as any).data;
  await page.getByRole('heading', { name: 'Ana & Luis' }).waitFor();
  // Closed, the fold keeps the evening and the reasons off the first screen.
  assert.doesNotMatch(await page.locator('article').innerText(), /Golden hour/);
  await unfold(page);
  const card = await page.locator('article').innerText();
  assert.match(card, /^ZODIACS·ORG\n/u, 'The card opens with the ZODIACS · ORG lockup');
  assert.equal(await page.locator('article .nameplate').first().getAttribute('aria-label'), 'Zodiacs.org', 'The lockup reads as Zodiacs.org');
  assert.equal(await page.locator('.kicker').innerText(), data.card.title);
  // The exact place and time the person gave, in ink.
  assert.match(card, /Saturday, 12 June 2027 at 19:00 in Florence, Italy/);
  assert.deepEqual(await page.locator('.meta strong').allInnerTexts(), ['19:00', 'Florence, Italy']);
  assert.match(card, /Gemini Sun/);
  assert.match(card, /Libra Moon/);
  assert.match(card, /Golden hour\s+20:13 to 20:57/);
  assert.match(card, /Sunset\s+20:57/);
  assert.match(card, /Bright after dark\s+.*Mars.*Jupiter|Bright after dark\s+.*Jupiter.*Mars/);
  assert.match(card, /Mercury retrograde/);
  // The date is rated out of 100 with a verdict and its reasons; Mercury retrograde counts against it.
  assert.match(card, new RegExp(`${(data as any).rating.score}\\s*out of 100`, 'u'));
  assert.equal(await page.locator('.hero [role=img]').getAttribute('aria-label'), `${data.rating.score} out of 100`);
  assert.match(card, /day for it/);
  assert.match(card, /Mercury is retrograde: expect delays/);
  assert.match(card, /not a guarantee/);
  assert.doesNotMatch(card, /Europe\/Rome|\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}/, 'People see dates, places and clock times, not zone IDs or ISO instants');
  // The lockup's dot is the brand mark; the copy under it has no dashes or middle dots.
  assert.doesNotMatch(copyOf(card), /[—–·]/u, 'No dashes or middle dots in the card');
  const link = page.getByRole('link', { name: 'Open printable card' });
  assert.equal(await link.getAttribute('href'), data.cardUrl);
  assert.ok(data.cardUrl.startsWith('https://zodiacs.org/occasions/#'));
  await capture(page, 'occasions-wedding-desktop.png');
  // Copy gives the card as plain text.
  // A page set from a string has no origin the clipboard serves, so the drive records the write.
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text: string) => { (window as any).copied = text; } } }); });
  await page.getByRole('button', { name: 'Copy the card' }).click();
  await page.getByText('Copied.').waitFor();
  const copied: string = await page.evaluate(() => (window as any).copied);
  assert.match(copied, new RegExp(`^Ana & Luis\\n${data.card.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`));
  assert.match(copied, /zodiacs\.org\/occasions$/);
  // A resize update never replays or clears the card.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { maxHeight: 640 } } })));
  await page.waitForTimeout(200);
  assert.equal(await page.getByRole('heading', { name: 'Ana & Luis' }).count(), 1);
  // Phone width: no sideways scroll, the card starts on the first screen.
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  const box = await page.locator('article').boundingBox();
  assert.ok(box && box.y < 200, 'On a phone the card starts at the top');
  await capture(page, 'occasions-wedding-mobile.png');

  // A date alone: noon UTC, said so, no evening, and the Moon's change of sign.
  const plain = await open();
  await show(plain, baby);
  await plain.getByRole('heading', { name: (baby as any).data.card.title }).waitFor();
  await unfold(plain);
  const babyText = await plain.locator('article').innerText();
  assert.match(babyText, /A new baby/);
  assert.match(babyText, /Friday, 23 October 2026\nNo time or place given, so the sky is read at noon UTC\./);
  assert.match(babyText, /Pisces to Aries Moon/);
  assert.match(babyText, /The Moon changes sign that day\. Add the time to pin it down\./);
  assert.doesNotMatch(babyText, /Golden hour|Sunset/);

  // A place name with no zone or coordinates is shown, and the line does not claim there was no place.
  const named = await open();
  await show(named, await result('get_occasion_sky', { occasion: 'birthday', date: '2026-10-23', place: 'Florence, Italy' }));
  await named.locator('h1').waitFor();
  assert.match(await named.locator('.meta').innerText(), /^Friday, 23 October 2026 in Florence, Italy\nNo time given, so the sky is read at noon UTC\.$/);

  // Life milestones: the next one with each pass, the numbers, every milestone.
  const lives = await open();
  await show(lives, milestones);
  await lives.getByRole('heading', { name: 'Your sky milestones' }).waitFor();
  await unfold(lives);
  const lifeText = await lives.locator('article').innerText();
  assert.match(lifeText, /Born 15 March 1997, no birth time given/);
  assert.match(lifeText, /Now: your first Saturn return, at 29/);
  assert.match(lifeText, /Saturn reaches its place at your birth\s+23 Apr 2026/);
  assert.match(lifeText, /Passes back over it, retrograde\s+19 Nov 2026/);
  assert.match(lifeText, /Crosses it for the last time\s+31 Dec 2026/);
  assert.match(lifeText, /Full moons lived through\s+366/);
  assert.match(lifeText, /Mercury retrogrades\s+93/);
  assert.match(lifeText, /First Jupiter return, age 11/);
  assert.match(lifeText, /Without a birth time, a date can be a day off\./);
  assert.equal(await lives.getByRole('link', { name: 'Open printable card' }).getAttribute('href'), 'https://zodiacs.org/occasions/milestones/#b=1997-03-15');
  await capture(lives, 'occasions-milestones-desktop.png');
  // A timed result has no card link (the page could not reproduce it), and the panel offers none.
  const timed = await result('get_life_milestones', { birthDate: '1997-03-15', time: '08:30', zone: 'Europe/Rome' });
  const timedPage = await open();
  await show(timedPage, timed);
  await timedPage.getByRole('heading', { name: 'Your sky milestones' }).waitFor();
  assert.equal(await timedPage.getByRole('link', { name: /printable card/ }).count(), 0);
  assert.equal(await timedPage.getByText('Without a birth time, a date can be a day off.').count(), 0);

  // Two charts compared: names, both Sun signs, a score out of 100 with its three parts, and the closest contacts.
  const pair = await result('get_compatibility', {
    a: { name: 'Ana', birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 },
    b: { name: 'Luis', birthDate: '1992-08-10', time: '21:15', zone: 'America/Mexico_City', latitude: 19.4326, longitude: -99.1332 },
  });
  const compare = await open();
  await show(compare, pair);
  await compare.getByRole('heading', { name: 'Ana and Luis' }).waitFor();
  await unfold(compare);
  const compareText = await compare.locator('article').innerText();
  assert.match(compareText, /Taurus Sun/);
  assert.match(compareText, /Leo Sun/);
  assert.match(compareText, /The closest contacts/);
  const score = (pair as any).data.score;
  assert.match(compareText, new RegExp(`${score.overall}\\s*out of 100`, 'u'));
  assert.match(compareText, new RegExp(score.verdict, 'u'));
  assert.match(compareText, new RegExp(`Attraction\\s+${score.areas.attraction}`, 'u'));
  assert.match(compareText, new RegExp(`Long-term stability\\s+${score.areas.stability}`, 'u'));
  assert.doesNotMatch(copyOf(compareText), /[—–·]/u, 'No dashes or middle dots in the card');
  // Forecasts, never guarantees.
  assert.doesNotMatch(compareText.replace(plainWords((pair as any).data.note), ''), /guarantee|soulmate|destined|doomed/iu);
  assert.match(compareText, /not a guarantee/);
  assert.match(compareText, /^ZODIACS·ORG\n/u, 'Every card opens with the ZODIACS · ORG lockup');
  assert.ok((await compare.getByRole('link', { name: 'Open both charts' }).getAttribute('href'))!.startsWith('https://zodiacs.org/compatibility/#'));
  assert.equal(await compare.getByRole('link', { name: 'Share the reading' }).getAttribute('href'), (pair as any).data.shareUrl);
  // Four contacts show; the rest open from the keyboard.
  assert.equal(await compare.locator('.card-section > .reasons li').count(), 4);
  await compare.locator('details.more summary').focus();
  await compare.keyboard.press('Enter');
  assert.equal(await compare.locator('details.more .reasons li').evaluateAll((items) => items.filter((item) => (item as HTMLElement).offsetHeight > 0).length), (pair as any).data.contacts.length - 4);
  await capture(compare, 'occasions-compatibility-desktop.png');
  await compare.setViewportSize({ width: 375, height: 812 });
  assert.equal(await compare.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await capture(compare, 'occasions-compatibility-mobile.png');

  // Compared with a famous person: their name, their page, the score, and that their birth time is unknown.
  const celebrity = await result('get_compatibility', { a: { name: 'Sam', birthDate: '1994-02-01' }, b: { famous: 'Frida Kahlo' } });
  const celebrityPage = await open();
  await show(celebrityPage, celebrity);
  await celebrityPage.getByRole('heading', { name: 'Sam and Frida Kahlo' }).waitFor();
  await unfold(celebrityPage);
  const celebrityText = await celebrityPage.locator('article').innerText();
  assert.match(celebrityText, /Aquarius Sun/);
  assert.match(celebrityText, /Cancer Sun/);
  assert.match(celebrityText, /Frida Kahlo, born 6 July 1907 in Coyoacán\./);
  assert.match(celebrityText, new RegExp(`${(celebrity as any).data.score.overall}\\s*out of 100`, 'u'));
  assert.match(celebrityText, /Frida Kahlo's birth time is not on record/);
  assert.equal(await celebrityPage.getByRole('link', { name: 'Frida Kahlo’s chart' }).getAttribute('href'), 'https://zodiacs.org/people/frida-kahlo/');
  await capture(celebrityPage, 'occasions-celebrity-desktop.png');
  await celebrityPage.setViewportSize({ width: 375, height: 812 });
  assert.equal(await celebrityPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await capture(celebrityPage, 'occasions-celebrity-mobile.png');
  // A famous name Zodiacs does not publish: said plainly, with no chart and no score.
  const unpublished = await open();
  await show(unpublished, await result('get_compatibility', { a: { birthDate: '1994-02-01' }, b: { famous: 'Nobody Anybody Zzyzx' } }));
  await unpublished.getByRole('heading', { name: 'Nobody Anybody Zzyzx is not one Zodiacs publishes' }).waitFor();
  assert.doesNotMatch(await unpublished.locator('article').innerText(), /out of 100/u);

  // The best days in a month: three days, best first, and the card for the best one.
  const bestDays = await result('get_occasion_sky', { occasion: 'wedding', searchFrom: '2027-06-01', searchTo: '2027-06-30', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy' });
  const best = (bestDays as any).data.bestDays.best;
  assert.equal(best.length, 3);
  assert.equal((bestDays as any).data.date, best[0].date);
  const bestPage = await open();
  await show(bestPage, bestDays);
  await bestPage.getByRole('heading', { name: 'The best days from 1 to 30 June 2027' }).waitFor();
  const bestItems = await bestPage.locator('.best-days li').allInnerTexts();
  assert.equal(bestItems.length, 3);
  const bestScores = await bestPage.locator('.best-days li [role=img]').evaluateAll((rings) => rings.map((ring) => ring.getAttribute('aria-label')));
  for (const [index, row] of best.entries()) {
    assert.match(bestItems[index], new RegExp(`^${row.score}\\n`, 'u'));
    assert.equal(bestScores[index], `${row.score} out of 100`);
  }
  assert.match(await bestPage.locator('article').innerText(), /The card below is for the best day\./u);
  assert.doesNotMatch(await bestPage.locator('article').innerText(), /\d{4}-\d{2}-\d{2}/u);
  await capture(bestPage, 'occasions-best-days-desktop.png');
  await bestPage.setViewportSize({ width: 375, height: 812 });
  assert.equal(await bestPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await capture(bestPage, 'occasions-best-days-mobile.png');

  // Chart twins link to each person's page; a famous chart, and a name Zodiacs does not publish.
  const twinsPage = await open();
  await show(twinsPage, await result('find_chart_twins', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' }));
  await twinsPage.getByRole('heading', { name: 'Your chart twins' }).waitFor();
  const twinLinks = await twinsPage.locator('.people a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  assert.ok(twinLinks.length > 0 && twinLinks.every((href) => /^https:\/\/zodiacs\.org\/people\/[a-z0-9-]+\/$/u.test(href ?? '')));
  const twinsText = await twinsPage.locator('article').innerText();
  assert.doesNotMatch(twinsText, /\b\d{4}-\d{2}-\d{2}\b/u, 'Birth dates read as dates, not ISO strings');
  assert.match(twinsText, /Born \d{1,2} [A-Z][a-z]{2,4} \d{4}/u);
  assert.doesNotMatch(copyOf(twinsText), /[—–·]/u, 'Lifespans and descriptions read with plain punctuation');
  await capture(twinsPage, 'occasions-twins-desktop.png');
  const famous = await open();
  const frida = await result('get_famous_chart', { name: 'Frida Kahlo' });
  await show(famous, frida);
  await famous.locator('h1').waitFor();
  if ((frida as any).data.found) {
    assert.equal(await famous.locator('h1').innerText(), (frida as any).data.person.name);
    assert.match(await famous.locator('article').innerText(), /12:00 civil time/);
    assert.match(await famous.locator('.meta').innerText(), /Born 6 July 1907 in Coyoacán$/u);
    assert.doesNotMatch(copyOf(await famous.locator('article').innerText()), /[—–·]/u, 'Published copy reads with plain punctuation');
  }
  await capture(famous, 'occasions-famous-desktop.png');
  const unknown = await open();
  await show(unknown, await result('get_famous_chart', { name: 'Nobody Anybody Zzyzx' }));
  await unknown.getByRole('heading', { name: 'Not one Zodiacs publishes' }).waitFor();

  // A birthday with its solar return, a cusp day, and the calendar subscription.
  const birthdayPage = await open();
  const birthday = await result('get_birthday', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' });
  await show(birthdayPage, birthday);
  await birthdayPage.getByRole('heading', { name: '3 May birthdays' }).waitFor();
  // Sharing a birthday gives the month and day, never the year.
  const birthdayShare = await birthdayPage.getByRole('link', { name: 'Share this birthday' }).getAttribute('href');
  assert.equal(birthdayShare, (birthday as any).data.shareUrl);
  assert.equal(birthdayShare, 'https://zodiacs.org/share/birthday/?d=05-03');
  assert.equal(await birthdayPage.getByRole('link', { name: 'Open the 3 May page' }).getAttribute('href'), 'https://zodiacs.org/birthday/may-3/');
  await unfold(birthdayPage);
  const birthdayText = await birthdayPage.locator('article').innerText();
  assert.match(birthdayText, /Taurus Sun/);
  assert.match(birthdayText, /Solar return 2026/);
  // No one the site publishes was born on 3 May, so there is no famous line.
  assert.equal(await birthdayPage.locator('article .famous').count(), 0);
  // The ring turns to the birthday's sign: Taurus is the big front dot.
  const front = async (target: typeof birthdayPage) => target.locator('article .nameplate svg circle').last().getAttribute('fill');
  assert.equal(await front(birthdayPage), '#5E9E70', 'The birthday card\'s ring brings Taurus to the front');
  await capture(birthdayPage, 'occasions-birthday-desktop.png');
  // A date the site publishes someone for names them, as the date's page does.
  const shared = await open();
  await show(shared, await result('get_birthday', { date: '12-10' }));
  await shared.getByRole('heading', { name: '10 December birthdays' }).waitFor();
  assert.equal((await shared.locator('article .famous').innerText()).trim(), 'You share a birthday with Ada Lovelace.');
  assert.equal(await shared.getByRole('link', { name: 'Ada Lovelace' }).getAttribute('href'), 'https://zodiacs.org/people/ada-lovelace/');
  assert.equal(await front(shared), '#CF8B3A', 'The 10 December card\'s ring brings Sagittarius to the front');
  await capture(shared, 'occasions-birthday-famous-desktop.png');
  const cusp = await open();
  await show(cusp, await result('get_birthday', { date: '03-20' }));
  await cusp.locator('h1').waitFor();
  // A cusp day without a year names no sign, so its ring keeps Libra in front.
  assert.equal(await front(cusp), '#A764C0', 'A cusp day keeps the brand\'s own ring');
  const calendar = await open();
  const feed = await result('get_sky_calendar', {});
  await show(calendar, feed);
  await calendar.getByRole('heading', { name: 'The sky in your calendar' }).waitFor();
  assert.equal(await calendar.getByRole('link', { name: 'Subscribe in your calendar app' }).getAttribute('href'), 'webcal://zodiacs.org/sky-calendar.ics');
  // The second action shares the next event; the calendar page moves into the fold.
  const calendarShare = await calendar.getByRole('link', { name: 'Share the sky calendar' }).getAttribute('href');
  assert.equal(calendarShare, (feed as any).data.shareUrl);
  assert.match(calendarShare ?? '', /^https:\/\/zodiacs\.org\/share\/sky-calendar\/\?k=[a-z-]+(?:&b=[a-z]+)?&d=\d{4}-\d{2}-\d{2}$/u);
  await capture(calendar, 'occasions-calendar-desktop.png');
  await unfold(calendar);
  assert.equal(await calendar.getByRole('link', { name: 'Open the sky calendar page' }).getAttribute('href'), 'https://zodiacs.org/sky-calendar/');

  // Names are text, never markup.
  const injected = structuredClone(wedding) as any;
  injected.data.names = '<img src=x onerror="window.pwned=1">';
  const safe = await open();
  await show(safe, injected);
  await safe.locator('.card h1').waitFor();
  assert.equal(await safe.locator('article img[src="x"]').count(), 0);
  assert.equal(await safe.evaluate(() => (window as any).pwned), undefined);

  // A refusal shows the tool's message; another tool's result is ignored.
  const refused = await open();
  await show(refused, { ok: false, tool: 'get_occasion_sky', error: { code: 'invalid-request', message: 'Add the time zone for that time.' } });
  assert.equal(await refused.getByRole('alert').innerText(), 'Add the time zone for that time.');
  const other = await open();
  await show(other, { ok: true, tool: 'get_sky', data: {} });
  await other.waitForTimeout(1700);
  assert.match(await other.locator('main').innerText(), /Ask the assistant about a day that matters/);

  // Dark theme from the host.
  const dark = await open();
  await show(dark, wedding);
  await dark.evaluate(() => window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { theme: 'dark' } } })));
  await dark.getByRole('heading', { name: 'Ana & Luis' }).waitFor();
  assert.equal(await dark.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(13, 15, 19)');
  assert.equal(await dark.evaluate(() => getComputedStyle(document.querySelector('.card')!).backgroundColor), 'rgb(22, 25, 31)');
  await capture(dark, 'occasions-wedding-dark.png');

  // An MCP Apps host: the result arrives as a notification, and the panel reports its height.
  const host = await context.newPage();
  host.on('pageerror', error => errors.push(error.message));
  await host.setContent('<iframe style="width:700px;height:600px;border:0"></iframe><script>window.sizes=[];window.addEventListener("message",e=>{const m=e.data;if(m&&m.method==="ui/initialize")e.source.postMessage({jsonrpc:"2.0",id:m.id,result:{protocolVersion:"2026-01-26",hostCapabilities:{},hostContext:{theme:"light"}}},"*");if(m&&m.method==="ui/notifications/size-changed")window.sizes.push(m.params.height);});</script>');
  const frame = host.frames()[1];
  frame.page().on('request', request => { if (!request.url().startsWith('data:') && !request.url().startsWith('about:')) network.push(request.url()); });
  await frame.setContent(OCCASIONS_HTML);
  await host.waitForTimeout(300);
  await host.evaluate(content => document.querySelector('iframe')!.contentWindow!.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: content } }, '*'), milestones);
  await frame.getByRole('heading', { name: 'Your sky milestones' }).waitFor();
  await host.waitForFunction(() => (window as any).sizes.length > 0);

  assert.ok(network.every(url => url.startsWith('https://zodiacs.org/assets/')), 'The panel requests only Zodiacs static art');
  assert.deepEqual(errors, []);
  await writeFile(new URL('occasions-review.json', out), JSON.stringify({
    scope: 'Local Chromium render with synthetic host bridges; not ChatGPT or Claude host acceptance',
    timezone: 'Asia/Bangkok',
    passed: ['wedding card with the evening on the place\'s clock', 'plain dates, places and clock times', 'printable card link from the tool', 'copy as plain text', 'resize updates keep the card', '375px phone: no sideways scroll, card at the top', 'date alone at noon UTC, said so, with the Moon\'s change of sign', 'life milestones: each pass, the numbers, every milestone', 'no card link when the page could not reproduce the answer', 'text injection', 'refusal message', 'other tools\' results ignored', 'host dark theme', 'MCP Apps tool-result notification and height report', 'two charts compared with a score', 'compared with a famous person, linking their page', 'a famous name Zodiacs does not publish, with no chart', 'the three best days in a month, with the best day\'s card', 'chart twins linking each person', 'a famous chart and an unpublished name', 'a birthday with its solar return, and a cusp day', 'a birthday shared by its month and day, never the year', 'a birthday names who shares it, as its page does', 'a personal card\'s ring turns to its sign', 'the calendar subscription', 'the calendar shared by its next event', 'the ZODIACS · ORG lockup at the top of every card', 'no dashes or middle dots in card copy', 'the exact place and time in ink', 'folded contacts open from the keyboard', 'the first screen keeps the details in the fold, and the fold opens to them', 'only Zodiacs static art requests'],
  }, null, 2) + '\n');
  console.log('Occasions panel browser QA passed.');
} finally { await browser.close(); }
