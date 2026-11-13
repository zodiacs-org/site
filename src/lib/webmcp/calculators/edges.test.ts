import { describe, expect, it } from 'vitest';
import { runCalculatorTool } from '../calculator-runtime';

// The extremes the tools' schemas accept: the first and last birth dates, at the start and end of the day, in places
// east and west of Greenwich, so the birth itself can fall just outside 1800-2199 in Universal Time.
const TOKYO = { latitude: 35.6762, longitude: 139.6503, timeZone: 'Asia/Tokyo' };
const KIRITIMATI = { latitude: 1.8721, longitude: -157.4278, timeZone: 'Pacific/Kiritimati' };
const NIUE = { latitude: -19.0544, longitude: -169.8672, timeZone: 'Pacific/Niue' };
const TIMED = [TOKYO, KIRITIMATI, NIUE].flatMap((place) => [
  { date: '1800-01-01', time: '00:00', place },
  { date: '2199-12-31', time: '23:59', place },
]);
const BIRTHS = [...TIMED, ...TIMED.map(({ date, place }) => ({ date, place }))];

type Call = [string, unknown];
const calls: Call[] = [];
for (const birth of BIRTHS) {
  for (const name of ['zodiacs.birth_chart', 'zodiacs.moon_sign', 'zodiacs.saturn_return', 'zodiacs.chart_pdf']) calls.push([name, birth]);
  calls.push(['zodiacs.compatibility', { first: birth, second: BIRTHS[1] }]);
  for (const year of [1800, 2199]) calls.push(['zodiacs.solar_return', { birth, year }], ['zodiacs.year_wrapped', { birth, year }]);
  for (const at of ['1800-01-01T00:00Z', '2199-12-31T23:59:59.999Z']) calls.push(['zodiacs.transits', { birth, at }]);
}
for (const birth of TIMED) {
  calls.push(['zodiacs.rising_sign', birth], ['zodiacs.big_three', birth]);
  for (const after of [undefined, '1800-01-02T00:00Z', '2199-11-21T23:59:59.999Z']) {
    calls.push(['zodiacs.lunar_return', after ? { birth, after } : { birth }]);
  }
  calls.push(['zodiacs.group_chart', { people: [{ name: 'A', birth }, { name: 'B', birth: BIRTHS[1] }, { name: 'C', birth: BIRTHS[4] }] }]);
}
for (const place of [TOKYO, NIUE]) {
  calls.push(['zodiacs.moon_phase', { date: '1800-01-01', time: '00:00', place }], ['zodiacs.moon_phase', { date: '2199-12-31', time: '23:59', place }]);
}
for (const date of ['1800-01-01', '2199-12-31']) {
  calls.push(['zodiacs.moon_phase', { date }], ['zodiacs.numerology', { birthDate: date, today: date }]);
}
calls.push(['zodiacs.baby_zodiac', { dueDate: '1990-01-01' }], ['zodiacs.baby_zodiac', { dueDate: '2028-12-31' }]);

describe('the tools at the extremes their schemas accept', () => {
  it('answer, or refuse with a code that names the reason, never with a failed calculation', async () => {
    const failed: string[] = [];
    const codes: Record<string, number> = {};
    for (const [name, input] of calls) {
      const envelope = await runCalculatorTool(name, input);
      const outcome = envelope.ok ? 'ok' : envelope.error.code;
      codes[outcome] = (codes[outcome] ?? 0) + 1;
      if (!envelope.ok && !['OUTSIDE_REFERENCE_SPAN', 'REFERENCE_BEFORE_BIRTH'].includes(envelope.error.code)) {
        failed.push(`${name} ${JSON.stringify(input)}: ${envelope.error.code}`);
      }
    }
    expect(failed).toEqual([]);
    expect(codes.ok).toBeGreaterThan(calls.length / 2);
  }, 600_000);

  it('say which: a birth outside the span, a return the span cuts off, or a reference before the birth', async () => {
    const tokyo1800 = { date: '1800-01-01', time: '00:00', place: TOKYO };
    const niue2199 = { date: '2199-12-31', time: '23:59', place: NIUE };
    const code = async (name: string, input: unknown) => {
      const envelope = await runCalculatorTool(name, input);
      return envelope.ok ? 'ok' : envelope.error.code;
    };
    expect(await code('zodiacs.chart_pdf', tokyo1800)).toBe('OUTSIDE_REFERENCE_SPAN');
    expect(await code('zodiacs.year_wrapped', { birth: niue2199, year: 2000 })).toBe('OUTSIDE_REFERENCE_SPAN');
    expect(await code('zodiacs.solar_return', { birth: tokyo1800, year: 1800 })).toBe('OUTSIDE_REFERENCE_SPAN');
    expect(await code('zodiacs.solar_return', { birth: tokyo1800, year: 2000 })).toBe('ok');
    expect(await code('zodiacs.lunar_return', { birth: tokyo1800 })).toBe('OUTSIDE_REFERENCE_SPAN');
    expect(await code('zodiacs.lunar_return', { birth: { ...niue2199, place: TOKYO } })).toBe('REFERENCE_BEFORE_BIRTH');
    expect(await code('zodiacs.birth_chart', tokyo1800)).toBe('ok');
  }, 600_000);
});
