import { afterEach, describe, expect, it, vi } from 'vitest';
import { bodyLongitude, longitudeSpeed } from '../../lib/engine/full';
import { scanTransitContacts } from '../../lib/engine/transit-scan';
import { TRANSIT_ORB } from '../../lib/transits';
import { calculateStudio, EXAMPLE } from './model';
import { scanYourWeek, UNTIMED_LEFT_OUT, WEEK_LIMIT, WEEK_ORB, weekRequest, type WeekItem, type WeekRequest, type YourWeek } from './week';
import { weekDates, weekDay, weekLine, weekTitle } from './week-words';
import { WeekCalculator, type WeekPort } from './week-client';

const NOW = new Date('2026-10-09T03:00:00.000Z');
const WEEK_END = new Date('2026-10-16T03:00:00.000Z');
const engine = { bodyLongitude, longitudeSpeed };
const timed = weekRequest(calculateStudio(EXAMPLE), NOW);
// The panel's unknown-time path: a birth date, midday as a stand-in, no place.
const untimed = weekRequest(calculateStudio({ ...EXAMPLE, date: '1992-03-14', time: '12:00', timeKnown: false, latitude: '', longitude: '' }), NOW);
const MOVERS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
const OFFSETS = { conjunction: [0], sextile: [60, 300], square: [90, 270], trine: [120, 240], opposition: [180] } as const;
const key = (item: Pick<WeekItem, 'transitBody' | 'natalPoint' | 'aspect'>) => `${item.transitBody}|${item.natalPoint}|${item.aspect}`;

/** Every contact's in-orb instants on a ten-minute grid, straight from the ephemeris. */
function bruteForce(request: WeekRequest) {
  const points = [...request.natal.bodies.filter(body => body.body !== 'North Node' && body.body !== 'South Node').map(body => ({ name: body.body as string, lon: body.lon })),
    ...(request.natal.angles ? [{ name: 'ASC', lon: request.natal.angles.asc }, { name: 'MC', lon: request.natal.angles.mc }] : [])]
    .filter(point => request.timeKnown || !['Moon', 'ASC', 'MC'].includes(point.name));
  const inside = new Map<string, number[]>();
  for (let ms = NOW.getTime(); ms <= WEEK_END.getTime(); ms += 600_000) {
    for (const mover of MOVERS) {
      const lon = bodyLongitude(mover, new Date(ms));
      for (const point of points) for (const [aspect, offsets] of Object.entries(OFFSETS)) {
        const orb = Math.min(...offsets.map(offset => Math.abs((((lon - point.lon - offset + 540) % 360) + 360) % 360 - 180)));
        if (orb <= TRANSIT_ORB) inside.set(`${mover}|${point.name}|${aspect}`, [...(inside.get(`${mover}|${point.name}|${aspect}`) ?? []), ms]);
      }
    }
  }
  return inside;
}

describe('Your week: the next seven days for a chart', () => {
  it('uses the site transit orb and a seven-day span from the device clock', () => {
    expect(WEEK_ORB).toBe(TRANSIT_ORB);
    const week = scanYourWeek(timed, engine);
    expect(week).toMatchObject({ fromUtc: NOW.toISOString(), toUtc: WEEK_END.toISOString(), timeKnown: true });
    expect(week.items.length).toBeLessThanOrEqual(WEEK_LIMIT);
    expect(week.found).toBeGreaterThan(week.items.length);
  });

  it('puts exact passes first in time order, then the rest by how close they come', () => {
    const { items } = scanYourWeek(timed, engine, Infinity);
    expect(items.map(item => item.closestOrb)).toEqual([...items.map(item => item.closestOrb)].sort((a, b) => a - b));
    const exact = items.filter(item => item.exactUtc.length);
    expect(items.slice(0, exact.length)).toEqual(exact);
    expect(exact.map(item => item.exactUtc[0])).toEqual([...exact.map(item => item.exactUtc[0])].sort());
    expect(scanYourWeek(timed, engine).items).toEqual(items.slice(0, WEEK_LIMIT));
    // The fixed week for the labelled example chart, as the scanner finds it.
    expect(items.slice(0, 6).map(item => [weekTitle(item), weekDates(item, 'UTC')])).toEqual([
      ['Sun square your Jupiter', 'Until Mon 12 Oct · exact on Fri 9 Oct'],
      ['Mercury sextile your Neptune', 'Fri 9 Oct to Thu 15 Oct · exact on Mon 12 Oct'],
      ['Mercury trine your Moon', 'From Sat 10 Oct · exact on Tue 13 Oct'],
      ['Mercury conjunction your Pluto', 'From Sat 10 Oct · exact on Tue 13 Oct'],
      ['Mercury trine your Jupiter', 'From Sun 11 Oct · exact on Wed 14 Oct'],
      ['Saturn conjunction your Mars', 'All week'],
    ]);
  });

  it('finds the same exact passes as the site transit scanner', () => {
    for (const request of [timed, untimed]) {
      const { items } = scanYourWeek(request, engine, Infinity);
      const natalPoints = request.timeKnown ? undefined : (['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const);
      const site = scanTransitContacts(request.natal, NOW, WEEK_END, { natalPoints: natalPoints && [...natalPoints] });
      expect(items.flatMap(item => item.exactUtc.map(at => `${key(item)}|${at}`)).sort())
        .toEqual(site.map(contact => `${key(contact)}|${contact.exactUtc}`).sort());
    }
  });

  it('matches a ten-minute sweep of the ephemeris: every contact within orb, and only then', () => {
    for (const request of [timed, untimed]) {
      const { items } = scanYourWeek(request, engine, Infinity);
      const sweep = bruteForce(request);
      expect(new Set(items.map(key))).toEqual(new Set(sweep.keys()));
      for (const [contact, instants] of sweep) {
        const periods = items.filter(item => key(item) === contact).map(item => [Date.parse(item.startUtc), Date.parse(item.endUtc)]);
        for (const ms of instants) expect(periods.some(([start, end]) => start <= ms && ms <= end), `${contact} at ${new Date(ms).toISOString()}`).toBe(true);
        // Inside every period, away from its edges, the sweep agrees.
        for (const [start, end] of periods) {
          for (let ms = NOW.getTime(); ms <= WEEK_END.getTime(); ms += 600_000) {
            if (ms > start + 600_000 && ms < end - 600_000) expect(instants.includes(ms), `${contact} at ${new Date(ms).toISOString()}`).toBe(true);
          }
        }
      }
      for (const item of items) {
        expect(item.startClipped).toBe(item.startUtc === NOW.toISOString());
        expect(item.endClipped).toBe(item.endUtc === WEEK_END.toISOString());
        expect(item.closestOrb).toBeLessThanOrEqual(TRANSIT_ORB);
        for (const at of item.exactUtc) expect(at >= item.startUtc && at <= item.endUtc).toBe(true);
      }
    }
  });

  it('never uses the Moon, rising sign or Midheaven without a birth time, even if they are sent', () => {
    expect(untimed).toMatchObject({ timeKnown: false, natal: { angles: null } });
    const smuggled: WeekRequest = { ...untimed, natal: { ...untimed.natal, angles: timed.natal.angles } };
    for (const request of [untimed, smuggled]) {
      const week = scanYourWeek(request, engine, Infinity);
      expect(week.timeKnown).toBe(false);
      expect(week.items.length).toBeGreaterThan(0);
      expect(week.items.filter(item => UNTIMED_LEFT_OUT.includes(item.natalPoint))).toEqual([]);
      expect(week.items.map(weekTitle).join(' ')).not.toMatch(/Moon|rising sign|Midheaven|house/);
    }
    // With a known time and place, the Moon and the angles take part.
    const points = new Set(scanYourWeek(timed, engine, Infinity).items.map(item => item.natalPoint));
    expect(points.has('Moon') && points.has('MC')).toBe(true);
  });

  it('sends the worker longitudes only', () => {
    expect(Object.keys(timed)).toEqual(['natal', 'timeKnown', 'fromUtc']);
    expect(Object.keys(timed.natal.angles!)).toEqual(['asc', 'mc']);
    const text = JSON.stringify(timed);
    for (const birthInput of ['1990-06-15', '51.5074', '-0.1278', 'placidus']) expect(text).not.toContain(birthInput);
  });

  it('shares ephemeris samples between its scans', () => {
    let calls = 0;
    const counted = { bodyLongitude: (...args: Parameters<typeof bodyLongitude>) => { calls += 1; return bodyLongitude(...args); }, longitudeSpeed: (...args: Parameters<typeof longitudeSpeed>) => { calls += 1; return longitudeSpeed(...args); } };
    scanYourWeek(timed, counted);
    expect(calls).toBeLessThan(2_000);
  });

  it('refuses a week without a valid start or a stated birth-time status', () => {
    expect(() => scanYourWeek({ ...timed, fromUtc: 'soon' }, engine)).toThrow(RangeError);
    expect(() => scanYourWeek({ ...timed, timeKnown: undefined as unknown as boolean }, engine)).toThrow(RangeError);
  });
});

describe('Your week in words', () => {
  const item = (change: Partial<WeekItem>): WeekItem => ({ transitBody: 'Mars', natalPoint: 'Sun', aspect: 'square', startUtc: '2026-10-10T02:00:00.000Z', endUtc: '2026-10-12T20:00:00.000Z', startClipped: false, endClipped: false, exactUtc: [], closestOrb: 1, ...change });

  it('writes dates as weekday, day and month on the given clock', () => {
    expect(weekDay('2026-10-09T03:00:00.000Z', 'Asia/Bangkok')).toBe('Fri 9 Oct');
    // 20:00 UTC on the 12th is already the 13th in Bangkok.
    expect(weekDates(item({}), 'Asia/Bangkok')).toBe('Sat 10 Oct to Tue 13 Oct');
    expect(weekDates(item({}), 'America/New_York')).toBe('Fri 9 Oct to Mon 12 Oct');
    expect(weekDates(item({ startClipped: true, endClipped: true }), 'UTC')).toBe('All week');
    expect(weekDates(item({ startClipped: true }), 'UTC')).toBe('Until Mon 12 Oct');
    expect(weekDates(item({ endClipped: true }), 'UTC')).toBe('From Sat 10 Oct');
    expect(weekDates(item({ endUtc: '2026-10-10T09:00:00.000Z' }), 'UTC')).toBe('Sat 10 Oct');
    expect(weekDates(item({ exactUtc: ['2026-10-11T08:00:00.000Z'] }), 'UTC')).toBe('Sat 10 Oct to Mon 12 Oct · exact on Sun 11 Oct');
    expect(weekDates(item({ exactUtc: ['2026-10-10T08:00:00.000Z', '2026-10-10T20:00:00.000Z', '2026-10-12T08:00:00.000Z'] }), 'UTC')).toBe('Sat 10 Oct to Mon 12 Oct · exact on Sat 10 Oct and Mon 12 Oct');
  });

  it('names the contact plainly and reuses the site transit sentence', () => {
    expect(weekTitle(item({}))).toBe('Mars square your Sun');
    expect(weekTitle(item({ natalPoint: 'ASC', aspect: 'trine', transitBody: 'Jupiter' }))).toBe('Jupiter trine your rising sign');
    expect(weekTitle(item({ natalPoint: 'MC', aspect: 'opposition' }))).toBe('Mars opposition your Midheaven');
    expect(weekLine(item({}))).toBe('Mars pushes against your sense of self — a charged stretch of heat and urgency, friction that will not resolve on its own.');
  });

  it('shows no ISO dates, UTC or time-zone names for the fixed weeks', () => {
    for (const request of [timed, untimed]) {
      for (const entry of scanYourWeek(request, engine, Infinity).items) {
        const text = `${weekTitle(entry)} ${weekDates(entry, 'Asia/Bangkok')} ${weekLine(entry)}`;
        expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}|UTC|GMT|Asia\/|\+0[0-9]:/);
        expect(weekDates(entry, 'Asia/Bangkok')).toMatch(/^(All week|((Until|From) )?(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (Oct|Nov)( to (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (Oct|Nov))?)( · exact on .+)?$/);
      }
    }
  });
});

describe('Your week calculator', () => {
  afterEach(() => vi.useRealTimers());
  const week: YourWeek = { fromUtc: NOW.toISOString(), toUtc: WEEK_END.toISOString(), timeKnown: true, items: [], found: 0 };
  const port = (): WeekPort => ({ onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() });

  it('takes the worker reply and stops the worker', async () => {
    const worker = port(), local = vi.fn(), calculator = new WeekCalculator(() => worker, local);
    const pending = calculator.calculate(timed);
    expect(worker.postMessage).toHaveBeenCalledWith(timed);
    worker.onmessage!({ data: { ok: true, result: week } } as MessageEvent);
    await expect(pending).resolves.toBe(week);
    expect(worker.terminate).toHaveBeenCalledOnce(); expect(local).not.toHaveBeenCalled();
  });

  it('works the week out on the page when the host refuses a worker', async () => {
    const local = vi.fn(() => week);
    await expect(new WeekCalculator(() => { throw new Error('blocked'); }, local).calculate(timed)).resolves.toBe(week);
    const worker = port(), calculator = new WeekCalculator(() => worker, local);
    const pending = calculator.calculate(timed);
    worker.onerror!(new Event('error') as ErrorEvent);
    await expect(pending).resolves.toBe(week);
    expect(worker.terminate).toHaveBeenCalledOnce(); expect(local).toHaveBeenCalledTimes(2);
  });

  it('reports a failed calculation, a deadline and a superseded request without a late result', async () => {
    const failing = port();
    const failed = new WeekCalculator(() => failing, vi.fn()).calculate(timed);
    failing.onmessage!({ data: { ok: false, error: 'no' } } as MessageEvent);
    await expect(failed).rejects.toThrow('could not be worked out');
    vi.useFakeTimers();
    const slow = port(), late = new WeekCalculator(() => slow, vi.fn()).calculate(timed).catch(error => error.message);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await late).toContain('could not be worked out'); expect(slow.terminate).toHaveBeenCalledOnce();
    const first = port(), second = port(); let count = 0;
    const calculator = new WeekCalculator(() => count++ ? second : first, vi.fn());
    const old = calculator.calculate(timed).catch(error => error.message);
    const current = calculator.calculate(untimed);
    expect(await old).toContain('could not be worked out'); expect(first.terminate).toHaveBeenCalledOnce();
    first.onmessage?.({ data: { ok: true, result: week } } as MessageEvent);
    second.onmessage!({ data: { ok: true, result: { ...week, timeKnown: false } } } as MessageEvent);
    await expect(current).resolves.toMatchObject({ timeKnown: false });
  });
});
