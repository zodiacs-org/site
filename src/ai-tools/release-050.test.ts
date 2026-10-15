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
    if (result.ok && result.tool === 'get_compatibility' && !('found' in result.data)) {
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

  it('answers a sky fact for an instant even when the assistant also sends the time zone', async () => {
    const args = { kind: 'retrograde', body: 'Mercury', instant: '2026-10-15T17:00:00+07:00' } as const;
    const plain = await executeAiTool('check_sky_fact', args, on);
    const zoned = await executeAiTool('check_sky_fact', { ...args, zone: 'Asia/Bangkok' }, on);
    expect(plain.ok).toBe(true);
    expect(zoned.ok).toBe(true);
    if (plain.ok && zoned.ok && plain.tool === 'check_sky_fact' && zoned.tool === 'check_sky_fact') expect(zoned.data.answer).toBe(plain.data.answer);
  });

  it('compares someone with a famous person, or says Zodiacs has no chart for the name', async () => {
    const result = await executeAiTool('get_compatibility', { a: { birthDate: '1994-02-01' }, b: { famous: 'Frida Kahlo' } }, on, { ref: 'chatgpt' });
    expect(OUTPUT_SCHEMAS.get_compatibility.safeParse(result).success).toBe(true);
    if (!result.ok || result.tool !== 'get_compatibility' || 'found' in result.data) throw new Error('expected a comparison');
    expect(result.data.b).toMatchObject({ famous: true, url: 'https://zodiacs.org/people/frida-kahlo/?ref=chatgpt' });
    expect(result.data.score.overall).toBeGreaterThanOrEqual(0);
    const missing = await executeAiTool('get_compatibility', { a: { birthDate: '1994-02-01' }, b: { famous: 'Nobody Anybody Zzyzx' } }, on);
    expect(missing).toMatchObject({ ok: true, data: { found: false, side: 'b' } });
    expect(OUTPUT_SCHEMAS.get_compatibility.safeParse(missing).success).toBe(true);
  });

  it('finds the three best days in a window and makes the card for the best one', async () => {
    const result = await executeAiTool('get_occasion_sky', { occasion: 'wedding', searchFrom: '2027-06-01', searchTo: '2027-06-30', zone: 'Europe/Rome' }, on);
    expect(OUTPUT_SCHEMAS.get_occasion_sky.safeParse(result).success).toBe(true);
    if (!result.ok || result.tool !== 'get_occasion_sky') throw new Error('expected a card');
    const best = result.data.bestDays!.best;
    expect(best).toHaveLength(3);
    expect(best[0].score).toBeGreaterThanOrEqual(best[1].score);
    expect(best[1].score).toBeGreaterThanOrEqual(best[2].score);
    expect(result.data.date).toBe(best[0].date);
    expect(result.data.rating.score).toBe(best[0].score);
    // With a date as well, the card stays on that date.
    const chosen = await executeAiTool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', searchFrom: '2027-06-01', searchTo: '2027-06-30' }, on);
    if (!chosen.ok || chosen.tool !== 'get_occasion_sky') throw new Error('expected a card');
    expect(chosen.data.date).toBe('2027-06-12');
    expect(chosen.data.bestDays?.best).toHaveLength(3);
    // A single date has no search.
    const single = await executeAiTool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12' }, on);
    if (single.ok && single.tool === 'get_occasion_sky') expect(single.data.bestDays).toBeNull();
    for (const args of [
      { occasion: 'wedding', searchFrom: '2027-06-01', searchTo: '2027-09-30' },
      { occasion: 'wedding', searchFrom: '2027-06-30', searchTo: '2027-06-01' },
      { occasion: 'wedding', searchFrom: '2027-06-01' },
      { occasion: 'wedding' },
    ]) expect(await executeAiTool('get_occasion_sky', args, on)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
  });
});
