import { describe, expect, it } from 'vitest';
import { OUTPUT_SCHEMAS } from './contracts';
import { executeAiTool } from './tools';

const off = { now: () => new Date('2026-10-14T12:00:00Z') };
const on = { ...off, occasions: true };

describe('the 0.5.0 tools through the tool runner', () => {
  it('are refused while the switch is off', async () => {
    for (const [tool, args] of [['get_compatibility', { a: { birthDate: '1990-05-03' }, b: { birthDate: '1992-08-10' } }], ['get_famous_chart', { name: 'Frida Kahlo' }], ['get_sky_calendar', {}]] as const) {
      expect(await executeAiTool(tool, args, off)).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    }
  });

  it('compares two charts, with the zone spelt as tzdb spells it and without a score', async () => {
    const result = await executeAiTool('get_compatibility', {
      a: { name: 'Ana', birthDate: '1990-05-03', time: '08:30', zone: 'europe/madrid', latitude: 40.4168, longitude: -3.7038 },
      b: { name: 'Luis', birthDate: '1992-08-10' },
    }, on, { ref: 'chatgpt' });
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'get_compatibility') {
      expect(OUTPUT_SCHEMAS.get_compatibility.safeParse(result).success).toBe(true);
      expect(result.data.a.sun).toBe('taurus');
      expect(result.data.pageUrl).toBe('https://zodiacs.org/compatibility/taurus-leo/?ref=chatgpt');
      expect(result.data.contacts.some((contact) => contact.line.includes('Ana'))).toBe(true);
      expect(JSON.stringify(result.data.contacts)).not.toMatch(/score|percent|soulmate/iu);
    }
    const refused = await executeAiTool('get_compatibility', { a: { birthDate: '1990-02-30' }, b: { birthDate: '1992-08-10' } }, on);
    expect(refused).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
  });

  it('finds chart twins and looks up a famous chart, or says it has none', async () => {
    const twins = await executeAiTool('find_chart_twins', { birthDate: '1990-05-03' }, on);
    expect(twins.ok).toBe(true);
    if (twins.ok && twins.tool === 'find_chart_twins') expect(twins.data.twins.every((twin) => twin.url.startsWith('https://zodiacs.org/people/'))).toBe(true);
    const found = await executeAiTool('get_famous_chart', { name: 'frida kahlo' }, on);
    if (found.ok && found.tool === 'get_famous_chart' && found.data.found) expect(found.data.person.url).toMatch(/^https:\/\/zodiacs\.org\/people\/[a-z0-9-]+\/$/u);
    const missing = await executeAiTool('get_famous_chart', { name: 'Nobody Anybody Zzyzx' }, on);
    expect(missing).toMatchObject({ ok: true, data: { found: false } });
  });

  it('refuses latitude that the birthday calculation does not use', async () => {
    expect(await executeAiTool('get_birthday', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', longitude: -3.7038, latitude: 40.4168 }, on))
      .toMatchObject({ ok: false, error: { code: 'invalid-request' } });
  });

  it('describes a birthday with its solar return, and gives the calendar feed', async () => {
    const birthday = await executeAiTool('get_birthday', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' }, on);
    expect(birthday.ok).toBe(true);
    if (birthday.ok && birthday.tool === 'get_birthday') {
      expect(birthday.data.pageUrl).toBe('https://zodiacs.org/birthday/may-3/');
      expect(birthday.data.solarReturn?.year).toBe(2026);
    }
    expect(await executeAiTool('get_birthday', { date: '02-30' }, on)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    const calendar = await executeAiTool('get_sky_calendar', {}, on);
    expect(calendar).toMatchObject({ ok: true, data: { feedUrl: 'https://zodiacs.org/sky-calendar.ics', subscribeUrl: 'webcal://zodiacs.org/sky-calendar.ics' } });
  });
});
