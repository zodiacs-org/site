import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { voidOfCourseWindows } from '@zodiacs/engine/techniques';
import { executeAiTool } from '../tools';
import { EXPLAIN_TOPICS, EXPLAIN_TOPICS_SKY_EVENTS, explainAstrology, matchTopic } from './explain';
import { SKY_EVENTS_NOTE } from './sky-events';
import { SITE_VOID_BODY_NAMES, SITE_VOID_CONVENTION_IDS, siteVoidOfCourseWindows } from '../../data/void-of-course';
import { NATAL_NODE_ABOUT } from './natal-chart';
import { publishedEventById } from '../../lib/events/publication';
import registry from '../../data/conventions/registry.json';

const now = () => new Date('2026-11-04T12:00:00Z');
const on = { occasions: true, coverage: true, skyEvents: true, now };
const off = { occasions: true, coverage: true, now };
const root = new URL('../../../', import.meta.url);
const DASH = /[–—]/u;
const BOUNDARY_WORDS = /\b(?:crypto\w*|token\w*|blockchain|market\w*|invest\w*)\b/iu;

async function search(args: Record<string, unknown>, dependencies: Record<string, unknown> = on, context = {}) {
  const result = await executeAiTool('search_sky_events', args, dependencies, context);
  if (!result.ok || result.tool !== 'search_sky_events') throw new Error(JSON.stringify(result));
  return result;
}
async function refusal(args: unknown) {
  const result = await executeAiTool('search_sky_events', args, on);
  if (result.ok) throw new Error('expected a refusal');
  return result.error;
}
/** Whether a zodiacs.org address is a page the site builds, or a published event page. */
function pageExists(url: string): boolean {
  const { pathname } = new URL(url);
  if ([...publishedEventById.values()].some((page) => page.path === pathname)) return true;
  const path = pathname.replace(/^\/|\/$/gu, '');
  return existsSync(new URL(`src/pages/${path}/index.astro`, root)) || existsSync(new URL(`src/pages/${path}.astro`, root));
}

describe('search_sky_events', () => {
  it('is offered only with the switch on, after the nineteen, and refused without it', async () => {
    expect(await executeAiTool('search_sky_events', { kinds: ['full-moon'] }, off)).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    // The switch alone, without the coverage tools, offers nothing.
    expect(await executeAiTool('search_sky_events', { kinds: ['full-moon'] }, { occasions: true, skyEvents: true, now })).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    expect((await search({ kinds: ['full-moon'] })).ok).toBe(true);
  });

  it('searches a year from today on the person\'s clock by default, and a week for void-of-course periods', async () => {
    const year = await search({ kinds: ['full-moon'], zone: 'Asia/Bangkok' });
    expect(year.data).toMatchObject({ from: '2026-11-04', to: '2027-11-03', zone: 'Asia/Bangkok', zoneSource: 'request', kinds: ['full-moon'], planets: null });
    expect(year.data.events).toHaveLength(12);
    expect(year.data.events[0]).toMatchObject({ kind: 'full-moon', title: 'Full Moon in Gemini', sign: 'gemini', at: { utc: expect.stringMatching(/^2026-11-24T14:5/u), local: 'Tue 24 Nov 2026, 21:53' }, until: null, planet: null, nextSign: null, type: null });
    const week = await search({ kinds: ['void-of-course'] });
    expect(week.data).toMatchObject({ from: '2026-11-04', to: '2026-11-10', zone: 'UTC', zoneSource: 'default' });
    expect(week.data.message).toContain('Days and times are in UTC because no time zone was given.');
    expect(week.data.events[0].at.local).toMatch(/ UTC$/u);
    // A zone the host shares sets the clock when the call names none.
    const shared = await search({ kinds: ['new-moon'] }, on, { hostZone: 'America/New_York' });
    expect(shared.data).toMatchObject({ zone: 'America/New_York', zoneSource: 'assistant' });
    expect(shared.data.message).toBeNull();
  });

  it('lists every kind but void-of-course periods unless they are named, and a planet\'s stations and sign changes when only planets are given', async () => {
    const all = await search({ from: '2026-11-04', to: '2026-12-31', limit: 100 });
    expect(all.data.kinds).toEqual(['solar-eclipse', 'lunar-eclipse', 'station', 'ingress', 'new-moon', 'full-moon']);
    expect(new Set(all.data.events.map((event) => event.kind))).toEqual(new Set(['station', 'ingress', 'new-moon', 'full-moon']));
    const mercury = await search({ planets: ['Mercury'], from: '2027-01-01', to: '2027-12-31', limit: 100 });
    expect(mercury.data.kinds).toEqual(['station', 'ingress']);
    expect(mercury.data.events.every((event) => event.planet === 'Mercury')).toBe(true);
    expect(mercury.data.events.filter((event) => event.kind === 'station').map((event) => event.type)).toEqual(['retrograde', 'direct', 'retrograde', 'direct', 'retrograde', 'direct']);
    // Planets filter only stations and sign changes: an eclipse still comes back.
    const mixed = await search({ kinds: ['solar-eclipse', 'station'], planets: ['Saturn'], from: '2027-01-01', to: '2027-12-31' });
    expect(mixed.data.events.map((event) => event.title)).toEqual(['Annular solar eclipse in Aquarius', 'Total solar eclipse in Leo', 'Saturn turns retrograde in Aries', 'Saturn turns direct in Aries']);
    const times = all.data.events.map((event) => Date.parse(event.at.utc));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('says when a planet moves back into a sign, and gives the Sun\'s season', async () => {
    const saturn = await search({ kinds: ['ingress'], planets: ['Saturn'], from: '2025-01-01', to: '2026-12-31' });
    expect(saturn.data.events.map((event) => event.title)).toEqual(['Saturn enters Aries', 'Saturn moves back into Pisces', 'Saturn enters Aries']);
    expect(saturn.data.events[1].line).toBe('Saturn moves back into Pisces while it is retrograde.');
    const sun = await search({ kinds: ['ingress'], planets: ['Sun'], from: '2026-12-01', to: '2026-12-31', zone: 'Europe/London' });
    expect(sun.data.events).toHaveLength(1);
    expect(sun.data.events[0]).toMatchObject({ title: 'The Sun enters Capricorn', sign: 'capricorn', position: null, line: 'The Sun enters Capricorn, and Capricorn season begins.', pageUrl: 'https://zodiacs.org/learn/zodiac-dates/' });
  });

  it('describes eclipses as the table records them, and marks the new or full Moon that is one', async () => {
    const result = await search({ kinds: ['solar-eclipse', 'new-moon'], from: '2026-08-01', to: '2026-08-31', zone: 'Europe/Madrid' });
    const eclipse = result.data.events.find((event) => event.kind === 'solar-eclipse')!;
    const moon = result.data.events.find((event) => event.kind === 'new-moon')!;
    expect(eclipse).toMatchObject({ kind: 'solar-eclipse', title: 'Total solar eclipse in Leo', type: 'total', position: '20°02′ Leo', at: { utc: '2026-08-12T17:45:53.037Z', local: 'Wed 12 Aug 2026, 19:45' }, pageUrl: 'https://zodiacs.org/eclipses/2026-08-12/' });
    expect(eclipse.line).toBe('Total solar eclipse at 20°02′ Leo: the new Moon covers the Sun completely along a narrow path on Earth, and partly on either side of it.');
    expect(moon.line).toMatch(/^New Moon at 20°\d{2}′ Leo: the Moon and the Sun meet in Leo\. It is also a total solar eclipse\.$/u);
    const lunar = await search({ kinds: ['lunar-eclipse'], from: '2026-03-01', to: '2026-03-31' });
    expect(lunar.data.events[0].line).toContain('with totality lasting about 59 minutes');
  });

  it('gives each void-of-course period exactly as the site\'s calendar computes it, through the module the page reads', async () => {
    // September 2023: Uranus, Neptune and Pluto stood late in their signs, so the Moon's last aspect in a sign was
    // often to one of them, which is where a rule that stops at Saturn would part from the calendar.
    const result = await search({ kinds: ['void-of-course'], from: '2023-09-01', to: '2023-09-30', zone: 'Asia/Bangkok', limit: 100 });
    const periods = result.data.events;
    expect(periods).toHaveLength(13);
    expect(result.data.conventions).toEqual(SITE_VOID_CONVENTION_IDS.map((id) => ({ id, url: `https://zodiacs.org/developers/conventions/#${id}` })));
    expect(SITE_VOID_CONVENTION_IDS).toEqual(['void-of-course:last-exact-ptolemaic-aspect-to-sign-exit', 'void-of-course-bodies:modern']);
    expect(SITE_VOID_BODY_NAMES).toEqual(['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
    expect(result.data.message).toContain('Void-of-course periods follow the rule of the void-of-course calendar on zodiacs.org, and give the same times');
    // The calendar's own computation over the same scan, 00:00 on 1 September to 3 days past the window in Bangkok: the
    // same periods to the millisecond.
    const start = Date.parse('2023-08-31T17:00:00Z');
    const end = Date.parse('2023-09-30T17:00:00Z');
    const calendar = siteVoidOfCourseWindows(new Date(start), new Date(end + 3 * 86_400_000)).filter((window) => window.from.getTime() < end && window.to.getTime() > start);
    expect(periods.map((period) => [period.at.utc, period.until!.utc, period.sign, period.nextSign])).toEqual(calendar.map((window) => [window.from.toISOString(), window.to.toISOString(), window.sign, window.nextSign]));
    // And they are the engine's default windows, which the page asked for directly before it read the shared module.
    const engine = voidOfCourseWindows(new Date(start), new Date(end + 3 * 86_400_000));
    expect(engine.map((window) => window.from.getTime())).toEqual(siteVoidOfCourseWindows(new Date(start), new Date(end + 3 * 86_400_000)).map((window) => window.from.getTime()));
    // The page as built in September 2023 scans from the 1st to 1 December: the month in UTC gives its periods to the millisecond.
    const utc = (await search({ kinds: ['void-of-course'], from: '2023-09-01', to: '2023-09-30', zone: 'UTC', limit: 100 })).data.events;
    const built = siteVoidOfCourseWindows(new Date(Date.UTC(2023, 8, 1)), new Date(Date.UTC(2023, 11, 1)))
      .filter((window) => window.from.getTime() < Date.UTC(2023, 9, 1) && window.to.getTime() > Date.UTC(2023, 8, 1));
    expect(utc).toHaveLength(14);
    expect(utc.map((period) => [period.at.utc, period.until!.utc])).toEqual(built.map((window) => [window.from.toISOString(), window.to.toISOString()]));
    for (const period of periods) {
      expect(period).toMatchObject({ kind: 'void-of-course', planet: null, position: null, type: null, pageUrl: 'https://zodiacs.org/void-of-course-moon/' });
      expect(period.title).toBe(`Void-of-course Moon in ${period.sign[0].toUpperCase()}${period.sign.slice(1)}`);
      const aspect = /\(Moon \w+ (\w+)\)/u.exec(period.line)?.[1];
      if (aspect) expect(SITE_VOID_BODY_NAMES).toContain(aspect);
      expect(period.line).toContain(`until it enters ${period.nextSign![0].toUpperCase()}${period.nextSign!.slice(1)} at ${period.until!.local}`);
    }
    // That month most last aspects were to an outer planet, which the calendar counts.
    expect(periods.filter((period) => /\(Moon \w+ (?:Uranus|Neptune|Pluto)\)/u.test(period.line)).length).toBeGreaterThan(5);
    // The calendar page reads the same module, so the two cannot drift apart.
    const page = readFileSync(new URL('src/pages/void-of-course-moon/index.astro', root), 'utf8');
    expect(page).toContain("from '../../data/void-of-course';");
    expect(page).toContain('siteVoidOfCourseWindows(rangeFrom, rangeTo)');
    expect(page).not.toMatch(/from '@zodiacs\/engine\/techniques'/u);
    // A period under way when the window opens is kept.
    const first = await search({ kinds: ['void-of-course'], from: '2026-11-05', to: '2026-11-05' });
    for (const period of first.data.events) expect(Date.parse(period.until!.utc)).toBeGreaterThan(Date.parse('2026-11-05T00:00:00Z'));
  });

  it('links an event to its own published page, or to the page that lists its kind', async () => {
    const result = await search({ from: '2026-11-04', to: '2028-11-04', limit: 100, kinds: ['solar-eclipse', 'lunar-eclipse', 'station', 'new-moon', 'full-moon'] });
    const more = await search({ from: '2026-01-01', to: '2027-12-31', limit: 100, kinds: ['ingress'], planets: ['Sun', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] });
    const events = [...result.data.events, ...more.data.events];
    expect(events.length).toBeGreaterThan(100);
    for (const event of events) {
      if (event.pageUrl === null) { expect(['Mercury', 'Venus', 'Mars']).toContain(event.planet); continue; }
      expect(pageExists(event.pageUrl), event.pageUrl).toBe(true);
    }
    const urls = events.map((event) => event.pageUrl);
    for (const url of ['https://zodiacs.org/eclipses/2027-08-02/', 'https://zodiacs.org/full-moon/2026-11-24/', 'https://zodiacs.org/new-moon/2026-12-09/', 'https://zodiacs.org/mercury-retrograde/2027-02-09/', 'https://zodiacs.org/mars-retrograde/2027-01-10/', 'https://zodiacs.org/events/jupiter-enters-virgo-2027-07-26/', 'https://zodiacs.org/eclipses/', 'https://zodiacs.org/full-moon-calendar/', 'https://zodiacs.org/moon-phase/', 'https://zodiacs.org/retrogrades/#retrograde-saturn-2027-08-09']) {
      expect(urls, url).toContain(url);
    }
    // An unpublished event page is never linked: 2028's eclipses have pages, but no published one.
    expect(urls).not.toContain('https://zodiacs.org/eclipses/2028-07-22/');
  });

  it('keeps to two years, and to 31 days for void-of-course periods, and names the field it refuses', async () => {
    expect((await search({ kinds: ['station'], from: '2026-11-04', to: '2028-11-04' })).data.to).toBe('2028-11-04');
    expect((await refusal({ kinds: ['station'], from: '2026-11-04', to: '2028-11-05' })).message).toBe('to must be at most two years after from. Search a longer span in parts.');
    expect((await search({ kinds: ['void-of-course'], from: '2026-12-01', to: '2026-12-31' })).data.events.length).toBeGreaterThan(10);
    expect((await refusal({ kinds: ['void-of-course', 'full-moon'], from: '2026-12-01', to: '2027-01-01' })).message).toMatch(/^Void-of-course Moon periods are searched up to 31 days at a time/u);
    expect((await refusal({ kinds: ['full-moon'], from: '2026-12-01', to: '2026-11-30' })).message).toBe('to must be the same day as from or later.');
    expect((await refusal({ kinds: ['full-moon'], from: '2026-02-30' })).message).toBe('from must be a real date, such as 2027-01-01.');
    expect((await refusal({ kinds: ['eclipse'] }))).toEqual({ code: 'invalid-request', message: 'kinds[0] must be one of: solar-eclipse, lunar-eclipse, station, ingress, new-moon, full-moon, void-of-course.' });
    expect((await refusal({ planets: ['Moon'] })).message).toBe('planets[0] must be one of: Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto.');
    expect((await refusal({ limit: 101 })).message).toBe('limit must be at most 100.');
    expect((await refusal({ from: '4 November 2026' })).message).toBe('from must be a date such as 2026-11-01.');
    const unknown = await executeAiTool('search_sky_events', { kinds: ['full-moon'], birthDate: 'private-canary-1985' }, on);
    expect(unknown).toMatchObject({ ok: false, error: { message: 'Leave out fields this tool does not take.' } });
    expect(JSON.stringify(unknown)).not.toContain('private-canary');
    expect(await executeAiTool('search_sky_events', { kinds: ['full-moon'], zone: 'Not/AZone' }, on)).toMatchObject({ ok: false, error: { code: 'invalid-timezone' } });
  });

  it('cuts the list at the limit and says how many there are', async () => {
    const result = await search({ from: '2026-11-04', to: '2028-11-04', limit: 3 });
    expect(result.data.events).toHaveLength(3);
    expect(result.data.total).toBeGreaterThan(150);
    expect(result.data.truncated).toBe(true);
    expect(result.data.message).toContain(`These are the first 3 of ${result.data.total} events`);
    expect((await search({ kinds: ['full-moon'], from: '2026-11-04', to: '2027-11-03' })).data).toMatchObject({ total: 12, truncated: false });
  });

  it('says what its tables leave out', async () => {
    const late = await search({ kinds: ['ingress', 'solar-eclipse'], planets: ['Mars'], from: '2029-01-01', to: '2030-12-31' });
    expect(late.data.message).toContain('Sign changes come from the ingress table, which covers the Sun, Mercury, Venus and Mars from 1 January 2026 to 30 June 2029; outside those dates none are listed.');
    expect(late.data.message).not.toContain('Eclipses are listed');
    expect((await search({ kinds: ['full-moon'], from: '2035-01-01', to: '2035-01-31' })).data.events).toHaveLength(1);
    const none = await search({ kinds: ['solar-eclipse'], from: '2026-11-04', to: '2026-12-31' });
    expect(none.data.message).toBe('None of these events falls between 4 November 2026 and 31 December 2026. Days and times are in UTC because no time zone was given.');
  });

  it('states calculated facts: no reading, no confidence label, no dashes, and points to the two neighbouring tools', async () => {
    const result = await search({ from: '2026-11-04', to: '2027-11-03', limit: 100 });
    const text = JSON.stringify(result);
    expect(text).not.toMatch(/confidence/iu);
    expect(text).not.toMatch(DASH);
    expect(text).not.toMatch(BOUNDARY_WORDS);
    expect(result.data.note).toBe(SKY_EVENTS_NOTE);
    const titles = result.links.map((link) => link.title);
    expect(titles).toContain('What changes in the sky over the next days or weeks (get_upcoming_events)');
    expect(titles).toContain('Follow eclipses, retrogrades and Moons in a calendar app (get_sky_calendar)');
    for (const link of result.links) expect(pageExists(link.url), link.url).toBe(true);
    // ChatGPT calls carry ?ref=chatgpt on every zodiacs.org address, before the fragment.
    const chatgpt = await search({ kinds: ['station'], planets: ['Saturn'], from: '2027-08-01', to: '2027-08-31' }, on, { ref: 'chatgpt' });
    expect(chatgpt.data.events[0].pageUrl).toBe('https://zodiacs.org/retrogrades/?ref=chatgpt#retrograde-saturn-2027-08-09');
  });
});

describe('the other tools with the sky events switch', () => {
  const sources = { horoscopeWindow: async () => ({ editions: [] }) as never, horoscopeMonths: async () => ({ months: {} }), horoscopeProgram: async () => ({ signs: [] }) as never };

  it('point get_upcoming_events and get_sky_calendar results to search_sky_events only while it is on', async () => {
    for (const [dependencies, expected] of [[on, true], [off, false]] as const) {
      const upcoming = await executeAiTool('get_upcoming_events', {}, dependencies);
      const calendar = await executeAiTool('get_sky_calendar', {}, dependencies);
      for (const result of [upcoming, calendar]) {
        if (!result.ok) throw new Error(JSON.stringify(result));
        expect(result.links.some((link) => link.title.includes('(search_sky_events)')), `${result.tool} ${expected}`).toBe(expected);
        expect(JSON.stringify(result).includes('search_sky_events')).toBe(expected);
      }
    }
  });

  it('get_capabilities names 20 tools and the tool for each kind of sky question while it is on', async () => {
    const result = await executeAiTool('get_capabilities', {}, { ...on, ...sources });
    if (!result.ok || result.tool !== 'get_capabilities') throw new Error(JSON.stringify(result));
    expect(result.data.coverage.tools.split(', ')).toHaveLength(20);
    expect(result.data.coverage.tools.split(', ').at(-1)).toBe('search_sky_events');
    expect(result.data.tools).toHaveLength(13);
    const text = result.data.limitations.join(' ');
    expect(text).toContain('search_sky_events (eclipses, stations, sign changes, new and full Moons and void-of-course Moon periods, months or years ahead) is also listed there');
    expect(text).toContain('With them Zodiacs offers 20 tools: the 13 in the tools field and these 7.');
    expect(text).toContain('Which tool for sky events: what changes in the sky over the next days or weeks (up to 92 days), get_upcoming_events; one kind of event months or years ahead');
    expect(result.data.coverage.skyEvents).toContain('void-of-course Moon periods under the rule of the void-of-course calendar');
    expect(result.data.coverage.eclipses).toMatch(/^search_sky_events lists the eclipses from 2026 to 2030/u);
    expect(result.data.privacy).toContain('The sky events search takes no personal details.');
    expect(JSON.stringify(result.data)).not.toMatch(DASH);
    const without = await executeAiTool('get_capabilities', {}, { ...off, ...sources });
    expect(JSON.stringify(without)).not.toContain('search_sky_events');
    expect(JSON.stringify(without)).not.toContain('skyEvents');
  });
});

describe('get_natal_chart with the sky events switch', () => {
  const madrid = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
  async function chart(args: Record<string, unknown>, dependencies: Record<string, unknown> = on) {
    const result = await executeAiTool('get_natal_chart', args, dependencies);
    if (!result.ok || result.tool !== 'get_natal_chart') throw new Error(JSON.stringify(result));
    return result.data as Record<string, any>;
  }

  it('gives the true North and South Nodes, says which node it is, and places them in houses', async () => {
    const data = await chart(madrid);
    expect(data.houseSystem).toBe('whole-sign');
    expect(data.houseNote).toBeNull();
    expect(data.nodes).toMatchObject({ node: 'true', about: NATAL_NODE_ABOUT, north: { sign: 'aquarius', position: '12°01′ Aquarius', possibleSigns: ['aquarius'] }, south: { sign: 'leo', position: '12°01′ Leo' } });
    expect(data.nodes.about).toContain('the mean node');
    expect(data.nodes.north.house).toBeGreaterThanOrEqual(1);
    expect((data.nodes.north.house + 5) % 12 + 1).toBe(data.nodes.south.house);
    expect(data.nodes.north.meaning).toContain('direction of growth');
    expect(data.nodes.south.meaning).toContain('familiar patterns');
    expect(JSON.stringify(data)).not.toMatch(DASH);
  });

  it('draws Placidus houses when asked, and falls back to whole sign with a plain note from about 66.6 degrees', async () => {
    const placidus = await chart({ ...madrid, houseSystem: 'placidus' });
    const whole = await chart(madrid);
    expect(placidus.houseSystem).toBe('placidus');
    expect(placidus.houseNote).toBeNull();
    expect(placidus.rising).toEqual(whole.rising);
    expect(placidus.angles).toEqual(whole.angles);
    expect(placidus.planets.map((row: { house: number }) => row.house)).not.toEqual(whole.planets.map((row: { house: number }) => row.house));
    const tromso = await chart({ birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Oslo', latitude: 69.65, longitude: 18.96, houseSystem: 'placidus' });
    expect(tromso.houseSystem).toBe('whole-sign');
    expect(tromso.houseNote).toBe('Placidus houses cannot be drawn at 69.65 degrees north: from about 66.6 degrees latitude some degrees of the zodiac never rise or set, so the chart uses whole-sign houses instead.');
    const south = await chart({ birthDate: '1990-05-03', time: '08:30', zone: 'Antarctica/McMurdo', latitude: -77.85, longitude: 166.67, houseSystem: 'placidus' });
    expect(south.houseNote).toContain('77.85 degrees south');
    const untimed = await chart({ birthDate: '1990-05-03', houseSystem: 'placidus' });
    expect(untimed).toMatchObject({ houseSystem: null, houseNote: 'Placidus houses need the birth time and place, so the chart has no houses.' });
    expect(untimed.nodes.north).toMatchObject({ house: null, houseLine: null });
  });

  it('keeps the published readout while the switch is off: no houseSystem, no nodes', async () => {
    expect(await executeAiTool('get_natal_chart', { ...madrid, houseSystem: 'placidus' }, off)).toMatchObject({ ok: false, error: { message: 'Leave out fields this tool does not take.' } });
    const data = await chart(madrid, off);
    expect(data).not.toHaveProperty('nodes');
    expect(data).not.toHaveProperty('houseNote');
    expect(data.houseSystem).toBe('whole-sign');
  });

  it('keeps romantic and health wording out of the nodes for anyone under 18', async () => {
    const data = await chart({ birthDate: '2012-06-01', time: '12:00', zone: 'Europe/London', latitude: 51.5, longitude: -0.12 });
    expect(data.under18).toBe(true);
    expect(JSON.stringify(data.nodes)).not.toMatch(/\b(?:romance|romantic|health)\b/iu);
  });
});

describe('explain_astrology with the sky events switch', () => {
  const NEW = ['lunar-nodes', 'void-of-course-moon', 'house-systems', 'eclipses', 'stations', 'new-and-full-moons', 'ingresses'];

  it('explains the seven topics in plain words first, with their pages, and points to the tool that dates them', async () => {
    expect(EXPLAIN_TOPICS_SKY_EVENTS.filter((key) => !EXPLAIN_TOPICS.includes(key))).toEqual(['house-systems', 'stations', 'new-and-full-moons', 'ingresses']);
    for (const key of NEW) {
      const result = await executeAiTool('explain_astrology', { topic: key.replace(/-/gu, ' ') }, on);
      if (!result.ok || result.tool !== 'explain_astrology') throw new Error(JSON.stringify(result));
      const { data } = result;
      expect(data.topic, key).toBe(key);
      expect(data.paragraphs.length, key).toBeGreaterThanOrEqual(3);
      // The plain words lead; the glossary's definition follows them.
      expect(data.paragraphs[0], key).not.toMatch(/\bThis site\b/u);
      expect(data.pages.length, key).toBeGreaterThan(0);
      for (const page of data.pages) expect(pageExists(page.url), page.url).toBe(true);
      const text = JSON.stringify(data);
      expect(text, key).not.toMatch(DASH);
      expect(text, key).not.toMatch(/confidence/iu);
      expect(text, key).toMatch(key === 'lunar-nodes' ? /get_natal_chart/u : key === 'house-systems' ? /houseSystem placidus/u : /search_sky_events/u);
      for (const related of data.related) expect(EXPLAIN_TOPICS_SKY_EVENTS).toContain(related);
    }
    const nodes = explainAstrology({ topic: 'lunar nodes' }, 'https://zodiacs.org', { skyEvents: true }).data.paragraphs.join(' ');
    expect(nodes).toContain('Zodiacs uses the true node');
    expect(nodes).toContain('up to about two degrees');
    const voids = explainAstrology({ topic: 'void of course moon' }, 'https://zodiacs.org', { skyEvents: true }).data;
    expect(voids.paragraphs.join(' ')).toContain('Zodiacs counts the Sun and every planet through Pluto, on its void-of-course calendar and in search_sky_events alike, so both give the same times.');
    expect(voids.pages.map((page) => page.url)).toContain('https://zodiacs.org/developers/conventions/#void-of-course-bodies:modern');
  });

  it('matches the ways people ask, and leaves everyday words alone', () => {
    const cases: Record<string, string> = {
      'placidus vs whole sign': 'house-systems', 'Placidus or whole sign houses?': 'house-systems', 'what house system': 'house-systems',
      'what is a station': 'stations', 'Mercury stations direct': 'stations', 'retrograde shadow': 'stations',
      'full moon': 'new-and-full-moons', 'new moon meaning': 'new-and-full-moons', 'lunation': 'new-and-full-moons',
      'what is an ingress': 'ingresses', 'planet changes sign': 'ingresses', 'north node': 'lunar-nodes', 'mean node': 'lunar-nodes',
      'solar eclipse': 'eclipses', 'void of course': 'void-of-course-moon', 'Moon phases': 'moon-phases', 'houses': 'houses', 'retrograde': 'retrogrades', 'transits': 'transits',
    };
    for (const [query, key] of Object.entries(cases)) expect(matchTopic(query, { skyEvents: true })?.key, query).toBe(key);
    for (const query of ['train stations near me', 'stationary bike']) expect(matchTopic(query, { skyEvents: true })?.key ?? null, query).toBeNull();
  });

  it('answers as before while the switch is off', async () => {
    for (const [query, key] of [['full moon', 'moon-phases'], ['placidus', 'houses'], ['station', 'retrogrades'], ['ingress', 'transits']]) {
      const result = await executeAiTool('explain_astrology', { topic: query }, off);
      if (!result.ok || result.tool !== 'explain_astrology') throw new Error(JSON.stringify(result));
      expect(result.data.topic, query).toBe(key);
      expect(result.data).toEqual(explainAstrology({ topic: query }).data);
      expect(JSON.stringify(result)).not.toContain('search_sky_events');
    }
    const unknown = await executeAiTool('explain_astrology', { topic: 'quantum entanglement' }, off);
    if (!unknown.ok || unknown.tool !== 'explain_astrology') throw new Error(JSON.stringify(unknown));
    expect(unknown.data.topics).toEqual([...EXPLAIN_TOPICS]);
  });

  it('names the registry\'s void-of-course rule, the calendar\'s own, and no other', () => {
    const bodies = registry.namespaces.find((space) => space.name === 'void-of-course-bodies')!;
    expect(bodies.entries.map((entry) => entry.id)).toEqual(['void-of-course-bodies:modern']);
    expect(bodies.entries[0].definition).toContain('the Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto');
    for (const name of ['void-of-course', 'void-of-course-bodies']) {
      expect(registry.namespaces.find((space) => space.name === name)!.usedIn, name).toContain('hosted MCP search_sky_events results: conventions');
    }
  });
});
