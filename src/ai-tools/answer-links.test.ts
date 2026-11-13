import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUTPUT_SCHEMAS, type AiToolName } from './contracts';
import { executeAiTool, type AiCallContext, type AiDependencies } from './tools';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';

/**
 * Each answer's links bring the person back to zodiacs.org: the sky calendar's subscription page beside the sky
 * tools, the daily horoscope email's sign-up beside the horoscopes, and for two adults compared, an invitation for
 * the other person. They go only in the links array, which every tool's published schema already takes, after the
 * links each answer had, and carry no birth detail.
 */
const window = committedWindow as HoroscopeWindow;
const NOW = new Date(`${window.generatedFor}T12:00:00Z`);
const dependencies: AiDependencies = {
  occasions: true, coverage: true, now: () => NOW,
  horoscopeWindow: async () => window,
  horoscopeMonths: async () => committedMonths,
  horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram,
};
const CALENDAR = 'https://zodiacs.org/sky-calendar/';

async function links(tool: AiToolName, args: Record<string, unknown>, context: AiCallContext = {}) {
  const result = await executeAiTool(tool, args, dependencies, context);
  expect(result.ok, `${tool} ${JSON.stringify(args)}`).toBe(true);
  // The published output schema takes the answer as it is: the links array was always open.
  expect(OUTPUT_SCHEMAS[tool].safeParse(result).success, tool).toBe(true);
  return (result as { links: { title: string; url: string }[] }).links;
}

describe('answer links back to zodiacs.org', () => {
  it('put the sky calendar\'s page beside get_sky, check_sky_fact and get_upcoming_events, after the links they had', async () => {
    const sky = await links('get_sky', {});
    expect(sky).toEqual([
      { title: 'Explore Moon phases', url: 'https://zodiacs.org/moon-phase/' },
      { title: 'How we calculate', url: 'https://zodiacs.org/methodology/' },
      { title: 'New and full Moons, eclipses and retrogrades in your calendar app (get_sky_calendar)', url: CALENDAR },
    ]);
    const fact = await links('check_sky_fact', { kind: 'retrograde', body: 'Mercury', date: window.generatedFor });
    expect(fact.map((link) => link.url)).toEqual(['https://zodiacs.org/methodology/', CALENDAR]);
    // get_upcoming_events already opened with the subscription; it keeps it, once.
    const events = await links('get_upcoming_events', {});
    expect(events[0]).toEqual({ title: 'Subscribe to these in your calendar (get_sky_calendar)', url: CALENDAR });
    expect(events.filter((link) => link.url === CALENDAR)).toHaveLength(1);
    // The page get_sky_calendar points to.
    const calendar = await links('get_sky_calendar', {});
    expect(calendar.map((link) => link.url)).toContain(CALENDAR);
  });

  it('put the daily horoscope email\'s sign-up beside get_horoscope and get_horoscope_period, on the sign\'s own page', async () => {
    expect(await links('get_horoscope', { sign: 'leo' })).toEqual([
      { title: 'Leo on Zodiacs', url: 'https://zodiacs.org/horoscopes/leo/' },
      { title: 'How we calculate', url: 'https://zodiacs.org/methodology/' },
      { title: 'The Leo horoscope by email each morning', url: 'https://zodiacs.org/horoscopes/leo/#daily-email' },
    ]);
    expect((await links('get_horoscope', {})).at(-1)).toEqual({ title: 'Your horoscope by email each morning', url: 'https://zodiacs.org/horoscopes/#daily-email' });
    const period = await links('get_horoscope_period', { sign: 'scorpio', period: 'month', date: window.generatedFor });
    expect(period.slice(0, 2).map((link) => link.title)).toEqual(['Scorpio horoscopes on Zodiacs', 'Transits this month']);
    expect(period.at(-1)).toEqual({ title: 'The Scorpio horoscope by email each morning', url: 'https://zodiacs.org/horoscopes/scorpio/#daily-email' });
    // A ChatGPT call's ?ref= goes before the #, as on every other link.
    expect((await links('get_horoscope', { sign: 'leo' }, { ref: 'chatgpt' })).at(-1)?.url).toBe('https://zodiacs.org/horoscopes/leo/?ref=chatgpt#daily-email');
  });

  it('point at the sign-up the site builds: the horoscope pages\' daily email form', () => {
    const capture = readFileSync(new URL('../components/EmailCapture.astro', import.meta.url), 'utf8');
    expect(capture).toContain("id={daily && placement === 'horoscopes' ? 'daily-email' : undefined}");
    expect(readFileSync(new URL('../components/HoroscopeProgramPage.astro', import.meta.url), 'utf8')).toContain('<EmailCapture placement="horoscopes" sign={sign.slug} />');
    expect(readFileSync(new URL('../pages/horoscopes/index.astro', import.meta.url), 'utf8')).toContain('<EmailCapture placement="horoscopes" />');
  });

  it('invite the partner of two adults compared, with no birth detail in the link', async () => {
    const pair = await links('get_compatibility', {
      a: { name: 'Ana', birthDate: '1991-02-14', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038, place: 'Madrid, Spain' },
      b: { name: 'Ben', birthDate: '1989-11-03', time: '22:15', zone: 'America/New_York', latitude: 40.7128, longitude: -74.006 },
    }, { ref: 'chatgpt' });
    expect(pair.slice(0, 3).map((link) => link.title)).toEqual(['Compatibility on Zodiacs', 'Resolve a town or city (find_birthplace)', 'How we calculate']);
    expect(pair.at(-1)).toEqual({ title: 'Invite your partner to compare charts on Zodiacs', url: 'https://zodiacs.org/share/invite/?s=aquarius&p=scorpio&ref=chatgpt' });
    expect(JSON.stringify(pair)).not.toMatch(/Ana|Ben|1991|1989|08:30|22:15|Madrid|Europe|America|40\.|74\.|3\.70/u);
    // A famous chart is no one to invite.
    const famous = await links('get_compatibility', { a: { birthDate: '1990-04-10' }, b: { famous: 'Frida Kahlo' } });
    expect(famous.some((link) => link.url.includes('/share/invite/'))).toBe(false);
  });

  it('keep each list short', async () => {
    for (const [tool, args] of [
      ['get_sky', {}], ['check_sky_fact', { kind: 'phase', phase: 'full', date: window.generatedFor }], ['get_upcoming_events', {}], ['get_horoscope', { sign: 'leo' }],
      ['get_horoscope_period', { sign: 'leo', period: 'year', date: '2027-01-01' }], ['get_compatibility', { a: { birthDate: '1992-08-05' }, b: { birthDate: '1990-04-10' } }],
    ] as const) expect((await links(tool, args)).length, tool).toBeLessThanOrEqual(5);
  });
});
