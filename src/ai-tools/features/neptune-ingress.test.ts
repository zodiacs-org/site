import { expect, it } from 'vitest';
import nasa from '../../data/nasa-event-instants.json';
import months from '../../data/horoscope-months.json';
import program from '../../data/horoscope-program.json';
import window from '../../data/horoscope-window.json';
import type { HoroscopeWindow } from '../horoscope/window';
import type { HoroscopeProgram } from '../../lib/horoscope-program-types';
import { executeAiTool } from '../tools';

const reference = nasa.ingresses.find((event) => (
  event.body === 'Neptune' && event.sign === 'aries' && !event.retrograde && event.nasa.startsWith('2026-01-26')
))!;

const dependencies = {
  occasions: true,
  skyEvents: true,
  coverage: true,
  now: () => new Date('2026-01-26T00:00:00Z'),
  horoscopeWindow: async () => window as HoroscopeWindow,
  horoscopeMonths: async () => months,
  horoscopeProgram: async () => program as unknown as HoroscopeProgram,
};

function expectHorizonsTime(at: string | undefined) {
  // The committed Horizons table gives the interpolated DE441 crossing and its query provenance.
  expect(at).toBeDefined();
  expect(Math.abs(Date.parse(at!) - Date.parse(reference.nasa)), at).toBeLessThanOrEqual(120_000);
}

it('gives the Horizons time for Neptune entering Aries in upcoming events', async () => {
  const result = await executeAiTool('get_upcoming_events', {
    from: '2026-01-26T00:00:00Z', to: '2026-01-27T00:00:00Z', kinds: ['ingress'],
  }, dependencies);
  if (!result.ok || result.tool !== 'get_upcoming_events') throw new Error(JSON.stringify(result));
  const event = result.data.events.find((item) => item.kind === 'ingress' && item.body === 'Neptune');
  expect(event).toMatchObject({ sign: 'aries', retrograde: false });
  expectHorizonsTime(event?.at);
});

it('gives the Horizons time for Neptune entering Aries in sky event search', async () => {
  const result = await executeAiTool('search_sky_events', {
    from: '2026-01-26', to: '2026-01-26', kinds: ['ingress'], planets: ['Neptune'],
  }, dependencies);
  if (!result.ok || result.tool !== 'search_sky_events') throw new Error(JSON.stringify(result));
  expect(result.data.events).toHaveLength(1);
  expect(result.data.events[0]).toMatchObject({ kind: 'ingress', sign: 'aries', planet: 'Neptune' });
  expectHorizonsTime(result.data.events[0].at.utc);
});

it('gives the Horizons time for Neptune entering Aries in the yearly horoscope', async () => {
  const result = await executeAiTool('get_horoscope_period', {
    sign: 'aries', period: 'year', date: '2026-03-01',
  }, dependencies);
  if (!result.ok || result.tool !== 'get_horoscope_period') throw new Error(JSON.stringify(result));
  const event = result.data.sky.find((item) => item.kind === 'ingress' && item.planet === 'Neptune' && item.sign === 'aries');
  expectHorizonsTime(event?.utc);
});
