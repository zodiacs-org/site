#!/usr/bin/env node
/**
 * Live check for the Zodiacs Astrologer Grok Bot template: makes the calls the
 * template's skills make for each starter prompt, against the live server at
 * https://zodiacs.org/mcp (or the URL in ZODIACS_MCP_URL), with made-up adult
 * birth details and one made-up baby. It checks what the template promises:
 * every answer brings a zodiacs.org link, forecasts carry a Reading confidence
 * label, links carry no birth details, and a child's birth date is refused.
 * Prints one line per check and exits 1 on any failure.
 *
 * Run: node integrations/grok-bot/live-check.mjs
 * No key is needed. The birth details below belong to no real person.
 */
const ENDPOINT = process.env.ZODIACS_MCP_URL ?? 'https://zodiacs.org/mcp';
const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18', 'User-Agent': 'zodiacs-grok-bot-live-check' };

async function rpc(method, params) {
  const response = await fetch(ENDPOINT, { method: 'POST', headers: HEADERS, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const text = await response.text();
  const line = text.split('\n').find((row) => row.startsWith('data: '));
  return JSON.parse(line ? line.slice(6) : text);
}
const call = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result;

const ADULT = { birthDate: '1990-05-03', time: '08:30' };
const PARTNER = { birthDate: '1992-08-10' };
const BABY = '2026-11-01';
const BIRTH_DETAILS = /1990|1992|08:30|08%3A30|Madrid|40\.4|-3\.7/u;

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};
const linksOf = (result) => (result?.structuredContent?.links ?? []).map((link) => link.url);
const zodiacsLink = (result) => linksOf(result).find((url) => url.startsWith('https://zodiacs.org/'));
const text = (result) => JSON.stringify(result?.structuredContent ?? {});

const init = (await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'grok-bot-live-check', version: '1' } })).result;
check('server answers, with the under-13 sentence in its instructions', /children under 13/u.test(init?.instructions ?? ''), `version ${init?.serverInfo?.version}`);
const tools = (await rpc('tools/list', {})).result.tools.map((tool) => tool.name);
check('19 tools listed', tools.length === 19, `${tools.length}`);

// 1. Is Mercury retrograde right now, and what else changes in the sky this week?
const mercury = await call('check_sky_fact', { kind: 'retrograde', body: 'Mercury', instant: new Date().toISOString() });
check('1a check_sky_fact answers with a zodiacs.org link', !mercury.isError && !!zodiacsLink(mercury), zodiacsLink(mercury));
const week = await call('get_upcoming_events', {});
check('1b get_upcoming_events lists the week, with a zodiacs.org link', !week.isError && Array.isArray(week.structuredContent?.data?.events) && !!zodiacsLink(week), `${week.structuredContent?.data?.events?.length} events`);

// 2. Show today's horoscope for Leo.
const leo = await call('get_horoscope', { sign: 'leo' });
check('2 get_horoscope gives the published reading, labelled, with a zodiacs.org link', !leo.isError && /Reading confidence \d+%/u.test(text(leo)) && !!zodiacsLink(leo), zodiacsLink(leo));

// 3. Read my birth chart (made-up adult: 3 May 1990, 08:30, Madrid).
const madrid = await call('find_birthplace', { place: 'Madrid', date: ADULT.birthDate });
const place = madrid.structuredContent?.data?.matches?.[0] ?? madrid.structuredContent?.data?.places?.[0] ?? madrid.structuredContent?.data?.best;
check('3a find_birthplace finds Madrid with a time zone', !madrid.isError && /Europe\/Madrid/u.test(text(madrid)));
const zone = place?.zone ?? place?.timeZone ?? 'Europe/Madrid';
const latitude = place?.latitude ?? 40.42;
const longitude = place?.longitude ?? -3.7;
const chart = await call('get_natal_chart', { ...ADULT, zone, latitude, longitude });
check('3b get_natal_chart reads the chart, with a zodiacs.org link', !chart.isError && /taurus/iu.test(text(chart)) && !!zodiacsLink(chart), zodiacsLink(chart));
check('3c the chart links carry no birth details', !linksOf(chart).some((url) => BIRTH_DETAILS.test(url)));

// 4. What transits are coming up for me this month?
const transits = await call('get_personal_transits', { birthDate: ADULT.birthDate });
check('4 get_personal_transits gives dated contacts, labelled, with a zodiacs.org link', !transits.isError && /Reading confidence \d+%/u.test(text(transits)) && !!zodiacsLink(transits), zodiacsLink(transits));

// 5. Are Leo and Scorpio compatible?
const pair = await call('explain_astrology', { topic: 'Leo and Scorpio' });
check('5 explain_astrology reads the sign pair, unlabelled, with a zodiacs.org link', !pair.isError && !/Reading confidence/u.test(text(pair)) && !!zodiacsLink(pair), zodiacsLink(pair));

// 6. We are getting married next June in Florence. Which days look best?
const florence = await call('find_birthplace', { place: 'Florence', country: 'Italy' });
check('6a find_birthplace finds Florence', !florence.isError && /Europe\/Rome/u.test(text(florence)));
const wedding = await call('get_occasion_sky', { occasion: 'wedding', searchFrom: '2027-06-01', searchTo: '2027-06-30', zone: 'Europe/Rome', latitude: 43.77, longitude: 11.25, place: 'Florence, Italy' });
check('6b get_occasion_sky names the three best days, rated and labelled, with a zodiacs.org link', !wedding.isError && wedding.structuredContent?.data?.bestDays?.best?.length === 3 && /Reading confidence \d+%/u.test(text(wedding)) && !!zodiacsLink(wedding), zodiacsLink(wedding));

// Compatibility of two made-up adults, after they agreed.
const couple = await call('get_compatibility', { a: { birthDate: ADULT.birthDate }, b: PARTNER });
check('7 get_compatibility scores two adults, labelled, with a zodiacs.org link', !couple.isError && /Reading confidence \d+%/u.test(text(couple)) && !!zodiacsLink(couple), zodiacsLink(couple));

// A child's birth date is refused, by every route the template could take.
for (const [name, args] of [['get_natal_chart', { birthDate: BABY }], ['get_occasion_sky', { occasion: 'birthday', date: BABY }], ['get_personal_transits', { birthDate: BABY }], ['get_compatibility', { a: { birthDate: ADULT.birthDate }, b: { birthDate: BABY } }]]) {
  const refused = await call(name, args);
  const message = refused.structuredContent?.error?.message ?? '';
  check(`8 ${name} refuses a baby born ${BABY}`, refused.isError === true && /children under 13/u.test(message) && !message.includes(BABY));
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
