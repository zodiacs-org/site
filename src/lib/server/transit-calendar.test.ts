import { describe, expect, it } from 'vitest';
import handler, {
  buildTransitCalendar,
  handleTransitCalendar,
} from '../../../api/calendar/transits';
import { calendarToken, calendarWebcalUrl } from '../../islands/CalendarSubscribe';
import { decodePositionsLink, encodePositionsLink, POSITION_BODY_ORDER } from '../share-positions';

const CRLF = '\r\n';
const PINNED_TOKEN = '2.eyJiIjpbMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDBdLCJhIjpbMCw5MF0sImgiOiJ3IiwidiI6IjEuMC4wIn0';
const WINDOW = {
  from: new Date('2026-03-19T00:00:00Z'),
  to: new Date('2026-03-22T00:00:00Z'),
} as const;

function uidLines(calendar: string): string[] {
  return calendar.split(CRLF).filter((line) => line.startsWith('UID:'));
}

describe('subscribable transit calendar', () => {
  it('serializes a pinned positions-only token with stable UIDs and valid RFC 5545 lines', () => {
    const first = buildTransitCalendar(PINNED_TOKEN, {
      ...WINDOW,
      generatedAt: '2026-03-19T12:00:00Z',
    });
    const refreshed = buildTransitCalendar(PINNED_TOKEN, {
      ...WINDOW,
      generatedAt: '2026-03-20T12:00:00Z',
    });

    expect(first.startsWith(`BEGIN:VCALENDAR${CRLF}`)).toBe(true);
    expect(first.endsWith(`END:VCALENDAR${CRLF}`)).toBe(true);
    expect(first.match(/BEGIN:VEVENT/g)?.length).toBeGreaterThan(0);
    expect(first.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(uidLines(first)).toEqual(uidLines(refreshed));
    expect(new Set(uidLines(first)).size).toBe(uidLines(first).length);

    const unfolded = first.replace(/\r\n[ \t]/g, '');
    expect(unfolded).toContain('SUMMARY:Transiting Sun conjunction natal Sun (exact)');
    expect(unfolded).toContain('DESCRIPTION:Exact tropical transit contact. Time:');
    for (const line of first.slice(0, -CRLF.length).split(CRLF)) {
      expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75);
    }
    for (const forbidden of [
      'birth date', 'birth time', 'birth place', 'coordinates', 'latitude', 'longitude',
      '1990-02-01', 'Bangkok', '13.7563', '100.5018',
    ]) {
      expect(first.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('takes ASC and MC to the whole degree and gives their contacts to the minute, not as exact', () => {
    // The pinned token carries ASC 0° and MC 90°; the feed uses 0.5° and 90.5°.
    const exactAngles = buildTransitCalendar(PINNED_TOKEN, {
      ...WINDOW,
      generatedAt: '2026-03-19T12:00:00Z',
    });
    const roundedToken = encodePositionsLink({
      bodies: POSITION_BODY_ORDER.map((body) => ({ body, lon: 0 })),
      angles: { asc: 0.5, mc: 90.5 },
      houseSystem: 'whole',
      engineVersion: '1.0.0',
    })!;
    expect(buildTransitCalendar(roundedToken, {
      ...WINDOW,
      generatedAt: '2026-03-19T12:00:00Z',
    })).toBe(exactAngles);

    const events = exactAngles.replace(/\r\n[ \t]/g, '').split('BEGIN:VEVENT').slice(1);
    const angleEvents = events.filter((event) => /SUMMARY:[^\r]* natal (?:ASC|MC)\r\n/.test(event));
    const planetEvents = events.filter((event) => !angleEvents.includes(event));
    expect(angleEvents.length).toBeGreaterThan(0);
    expect(planetEvents.length).toBeGreaterThan(0);
    for (const event of angleEvents) {
      expect(event).not.toContain('(exact)');
      expect(event).toMatch(/DTSTART:\d{8}T\d{4}00Z/);
      expect(event).toMatch(/UID:transit-[0-9a-f]{16}@zodiacs\.org\r\n/);
      expect(event).toContain('DESCRIPTION:Tropical transit contact. Natal angle to the whole degree. Time:');
    }
    expect(events.some((event) => event.includes('SUMMARY:Transiting Sun conjunction natal ASC\r\n'))).toBe(true);
    for (const event of planetEvents) {
      expect(event).toMatch(/SUMMARY:[^\r]* \(exact\)\r\n/);
      expect(event).toContain('DESCRIPTION:Exact tropical transit contact. Time:');
    }
  });

  it('mints the feed code with ASC and MC to the whole degree and every body to 0.001°', () => {
    const token = calendarToken({
      bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: index * 30.0123 })),
      angles: { asc: 245.678, mc: 159.999 },
      houseSystem: 'placidus',
      engineVersion: '1.0.0',
    });
    const decoded = decodePositionsLink(token!);
    expect(decoded?.angles).toEqual({ asc: 245.5, mc: 159.5 });
    expect(decoded?.bodies[1]).toEqual({ body: 'Moon', lon: 30.012 });
    expect(decoded?.houseSystem).toBe('placidus');
  });

  it('builds webcal URLs with only the existing positions token', () => {
    const value = calendarWebcalUrl('https://zodiacs.org', PINNED_TOKEN);
    const parsed = new URL(value);
    expect(parsed.protocol).toBe('webcal:');
    expect(parsed.host).toBe('zodiacs.org');
    expect(parsed.pathname).toBe('/api/calendar/transits');
    expect([...parsed.searchParams.keys()]).toEqual(['token']);
    expect(parsed.searchParams.get('token')).toBe(PINNED_TOKEN);
    expect(value).not.toMatch(/date|time|place|lat|lon|coord|name/i);
  });

  it('rejects invalid tokens and non-GET requests without scanning', async () => {
    const response = () => {
      const headers = new Map<string, string>();
      return {
        statusCode: 0,
        body: '',
        headers,
        setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
        end(body: string) { this.body = body; },
      };
    };

    const invalid = response();
    await handler({ method: 'GET', query: { token: '2.invalid' } }, invalid);
    expect(invalid.statusCode).toBe(400);
    expect(invalid.headers.get('cache-control')).toBe('no-store');

    const wrongMethod = response();
    await handler({ method: 'POST', query: { token: PINNED_TOKEN } }, wrongMethod);
    expect(wrongMethod.statusCode).toBe(405);
    expect(wrongMethod.headers.get('allow')).toBe('GET');
  });

  it('serves the feed inline with a six-hour shared cache policy', async () => {
    const calendar = buildTransitCalendar(PINNED_TOKEN, {
      ...WINDOW,
      generatedAt: '2026-03-19T12:00:00Z',
    });
    const headers = new Map<string, string>();
    const response = {
      statusCode: 0,
      body: '',
      setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
      end(body: string) { this.body = body; },
    };

    await handleTransitCalendar(
      { method: 'GET', query: { token: PINNED_TOKEN } },
      response,
      (token) => {
        expect(token).toBe(PINNED_TOKEN);
        return calendar;
      },
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(calendar);
    expect(headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    expect(headers.get('content-disposition')).toBe('inline; filename="zodiacs-transits.ics"');
    expect(headers.get('cache-control')).toBe(
      'public, max-age=0, s-maxage=21600, stale-while-revalidate=43200',
    );
  });
});
