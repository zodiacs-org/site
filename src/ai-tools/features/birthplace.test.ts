import { describe, expect, it } from 'vitest';
import { executeAiTool } from '../tools';
import type { BirthplaceData } from './birthplace';
import { loadPlaceTable } from './place-table';

const on = { occasions: true, coverage: true, now: () => new Date('2026-11-04T12:00:00Z'), placeTable: async () => loadPlaceTable() };

async function places(args: Record<string, unknown>): Promise<BirthplaceData> {
  const result = await executeAiTool('find_birthplace', args, on);
  if (!result.ok || result.tool !== 'find_birthplace') throw new Error(JSON.stringify(result));
  return result.data;
}

describe('find_birthplace', () => {
  it('resolves London, Almaty and Sydney from the bundled index, with coordinates to two decimals', async () => {
    const london = await places({ place: 'London', country: 'United Kingdom' });
    expect(london.places[0]).toMatchObject({ name: 'London', country: 'United Kingdom', timeZone: 'Europe/London', latitude: 51.51, longitude: -0.13 });
    expect(london.places.every((place) => place.country === 'United Kingdom')).toBe(true);
    expect(london.places.length).toBeLessThanOrEqual(5);

    const almaty = await places({ place: 'Almaty' });
    expect(almaty.places[0]).toMatchObject({ name: 'Almaty', country: 'Kazakhstan', timeZone: 'Asia/Almaty' });
    expect(almaty.places[0].latitude).toBe(Math.round(almaty.places[0].latitude * 100) / 100);
    expect(almaty.places[0].longitude).toBe(Math.round(almaty.places[0].longitude * 100) / 100);

    const sydney = await places({ place: 'Sydney', country: 'Australia', date: '2026-01-15' });
    expect(sydney.places[0]).toMatchObject({ name: 'Sydney', timeZone: 'Australia/Sydney', offset: '+11:00' });
    const winter = await places({ place: 'Sydney', country: 'Australia', date: '2026-07-15' });
    expect(winter.places[0].offset).toBe('+10:00');
    expect(winter.places[0].offset).not.toBe(sydney.places[0].offset);
  });

  it('uses the time zone history for a date, including daylight saving that is not the modern rule', async () => {
    const wartime = await places({ place: 'London', country: 'UK', date: '1941-06-15' });
    const modern = await places({ place: 'London', country: 'United Kingdom', date: '2026-06-15' });
    expect(wartime.places[0].timeZone).toBe('Europe/London');
    expect(wartime.places[0].offset).toBe('+02:00');
    expect(modern.places[0].offset).toBe('+01:00');

    const past = await places({ place: 'Almaty', date: '2000-06-01' });
    const current = await places({ place: 'Almaty', date: '2026-06-01' });
    expect(past.places[0].offset).not.toBe(current.places[0].offset);
    expect(past.places[0].timeZone).toBe('Asia/Almaty');
  });

  it('refuses a street address and does not put the query in a link', async () => {
    expect(await executeAiTool('find_birthplace', { place: '221B Baker Street' }, on)).toMatchObject({ ok: false, error: { message: 'Give a town or city name, not a street address.' } });
    expect(await executeAiTool('find_birthplace', { place: '10 Downing Street' }, on)).toMatchObject({ ok: false });
    const result = await executeAiTool('find_birthplace', { place: 'London' }, on);
    expect(JSON.stringify(result)).not.toContain('Baker');
    if (result.ok && result.tool === 'find_birthplace') {
      expect(result.links.every((link) => link.url.startsWith('https://zodiacs.org/'))).toBe(true);
      expect(JSON.stringify(result.links)).not.toContain('London');
      expect(result.data.source.note).toContain('nothing is stored');
    }
  });

  it('is not offered until the coverage switch is on', async () => {
    expect(await executeAiTool('find_birthplace', { place: 'London' }, { occasions: true })).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });
});
