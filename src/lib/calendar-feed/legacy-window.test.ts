import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { handleTransitCalendar, legacyFeedCacheControl } from '../../../api/calendar/transits';
import {
  LEGACY_FEED_GONE_TEXT,
  LEGACY_FEED_WINDOW_DAYS,
  LEGACY_FEED_WINDOW_START,
  legacyFeedPhase,
  legacyFeedWindowEnd,
  legacyFeedWindowOpens,
  RESUBSCRIBE_TIMED_URL,
  RESUBSCRIBE_URL,
  resubscribeNotice,
} from './legacy-window';
import { serializeTransitContacts } from '../ical';

const PINNED_TOKEN = '2.eyJiIjpbMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDBdLCJhIjpbMCw5MF0sImgiOiJ3IiwidiI6IjEuMC4wIn0';
// A synthetic release day; the real one is set at release in legacy-window.ts.
const START = '2026-10-05';
const OPENS = Date.parse('2026-10-05T00:00:00Z');
const ENDS = OPENS + 60 * 86_400_000;

function responseRecorder() {
  return {
    statusCode: 0,
    body: '',
    headers: new Map<string, string>(),
    setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), value); },
    end(body: string) { this.body = body; },
  };
}

async function fetchOlderAddress(at: number, windowStart: string | null = START) {
  const res = responseRecorder();
  const calls: { token: string; options: unknown }[] = [];
  await handleTransitCalendar(
    { method: 'GET', query: { token: PINNED_TOKEN }, headers: {} },
    res,
    (token, options) => {
      calls.push({ token, options });
      return serializeTransitContacts([{
        transitBody: 'Sun',
        aspect: 'conjunction',
        natalPoint: 'Sun',
        exactUtc: '2026-03-20T14:46:00.000Z',
        pass: 1,
        passCount: 1,
      }], { generatedAt: new Date(at), notice: options?.notice });
    },
    { now: () => new Date(at), windowStart },
  );
  return { res, calls };
}

describe('older calendar addresses', () => {
  it('reads the release day from one constant that is unset or a real UTC day', () => {
    expect(LEGACY_FEED_WINDOW_DAYS).toBe(60);
    if (LEGACY_FEED_WINDOW_START === null) {
      expect(legacyFeedWindowEnd()).toBeNull();
      expect(legacyFeedPhase(new Date())).toEqual({ phase: 'open' });
    } else {
      expect(legacyFeedWindowOpens(LEGACY_FEED_WINDOW_START).toISOString().slice(0, 10))
        .toBe(LEGACY_FEED_WINDOW_START);
    }
    for (const bad of ['2026-02-30', '2026-10-5', '05/10/2026', '2026-10-05T00:00Z', '']) {
      expect(() => legacyFeedPhase(new Date(), bad)).toThrow(RangeError);
    }
  });

  it('opens the window on the release day and closes it 60 days later, on both sides of each edge', () => {
    expect(legacyFeedWindowEnd(START)?.toISOString()).toBe('2026-12-04T00:00:00.000Z');
    expect(legacyFeedPhase(new Date(OPENS - 1), START)).toEqual({ phase: 'open' });
    expect(legacyFeedPhase(new Date(OPENS), START)).toEqual({ phase: 'window', endsAt: new Date(ENDS) });
    expect(legacyFeedPhase(new Date(ENDS - 1), START)).toEqual({ phase: 'window', endsAt: new Date(ENDS) });
    expect(legacyFeedPhase(new Date(ENDS), START)).toEqual({ phase: 'gone', endedAt: new Date(ENDS) });
  });

  it('serves an older address as before while no release day is set', async () => {
    const { res, calls } = await fetchOlderAddress(ENDS + 365 * 86_400_000, null);
    expect(res.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].options).toEqual({ generatedAt: new Date(ENDS + 365 * 86_400_000) });
    expect(res.body).not.toContain('UID:notice-');
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=21600, stale-while-revalidate=43200');
  });

  it('adds one event asking the subscriber to subscribe again during the window', async () => {
    const at = OPENS + 3 * 86_400_000 + 5 * 3_600_000;
    const { res, calls } = await fetchOlderAddress(at);
    expect(res.statusCode).toBe(200);
    expect(calls[0].token).toBe(PINNED_TOKEN);
    const unfolded = res.body.replace(/\r\n[ \t]/g, '');
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(unfolded.match(/UID:notice-/g)).toHaveLength(1);
    expect(unfolded).toContain('UID:notice-resubscribe-2026-12-04@zodiacs.org\r\n');
    expect(unfolded).toContain('DTSTART;VALUE=DATE:20261008\r\nDTEND;VALUE=DATE:20261009\r\n');
    expect(unfolded).toContain('SUMMARY:Subscribe to your Zodiacs.org transit calendar again\r\n');
    expect(unfolded).toContain('stops working at the start of 4 December 2026\\, UTC.');
    expect(unfolded).toContain('URL:https://zodiacs.org/birth-chart/\r\n');
  });

  it('keeps the shared cache from serving an older address past its window', async () => {
    const early = await fetchOlderAddress(OPENS);
    expect(early.res.headers.get('cache-control'))
      .toBe('public, max-age=0, s-maxage=21600, stale-while-revalidate=43200');
    const late = await fetchOlderAddress(ENDS - 10 * 3_600_000);
    expect(late.res.headers.get('cache-control'))
      .toBe('public, max-age=0, s-maxage=21600, stale-while-revalidate=14400');
    const last = await fetchOlderAddress(ENDS - 1_000);
    expect(last.res.statusCode).toBe(200);
    expect(last.res.headers.get('cache-control'))
      .toBe('public, max-age=0, s-maxage=1, stale-while-revalidate=0');
    expect(legacyFeedCacheControl(new Date(ENDS - 90_000), new Date(ENDS)))
      .toBe('public, max-age=0, s-maxage=90, stale-while-revalidate=0');
  });

  it('answers 410 Gone with a plain explanation once the window has closed', async () => {
    for (const at of [ENDS, ENDS + 1, ENDS + 400 * 86_400_000]) {
      const { res, calls } = await fetchOlderAddress(at);
      expect(res.statusCode).toBe(410);
      expect(calls).toHaveLength(0);
      expect(res.body).toBe(LEGACY_FEED_GONE_TEXT);
      expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    }
    expect(LEGACY_FEED_GONE_TEXT).toBe("This calendar address no longer works. It carried your chart's positions, so the site replaced it with addresses that carry only a random id. To keep your transit dates, subscribe again on the birth chart page, https://zodiacs.org/birth-chart/, or, if your chart has a birth time, on the Transits page, https://zodiacs.org/transits/.");
  });

  it('still refuses a missing code and other methods before anything else', async () => {
    const missing = responseRecorder();
    await handleTransitCalendar({ method: 'GET', query: {}, headers: {} }, missing, undefined,
      { now: () => new Date(ENDS + 1), windowStart: START });
    expect(missing.statusCode).toBe(400);
    const post = responseRecorder();
    await handleTransitCalendar({ method: 'POST', query: { token: PINNED_TOKEN }, headers: {} }, post, undefined,
      { now: () => new Date(ENDS + 1), windowStart: START });
    expect(post.statusCode).toBe(405);
  });

  it('sends subscribers to the pages that offer a calendar: the birth chart page for every chart, Transits with a birth time', () => {
    const source = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
    expect(RESUBSCRIBE_URL).toBe('https://zodiacs.org/birth-chart/');
    expect(RESUBSCRIBE_TIMED_URL).toBe('https://zodiacs.org/transits/');
    // The birth chart page runs the calculator in full mode, which offers the
    // calendar for a chart without a birth time (it passes the birth date)...
    expect(source('src/pages/birth-chart/index.astro')).toContain('<ChartCalculator mode="full"');
    expect(source('src/islands/ChartCalculator.tsx'))
      .toContain("birthDate={chart.input.timeKnown ? undefined : computedInput?.date ?? ''}");
    // ...and the Transits page offers none without one.
    expect(source('src/islands/TransitTracker.tsx'))
      .toContain('calendarPositions: timeKnown ? calendarPositionsFromSaved(chart) : null');
    for (const text of [LEGACY_FEED_GONE_TEXT, resubscribeNotice(new Date(OPENS), new Date(ENDS)).description]) {
      expect(text).toContain(`on the birth chart page, ${RESUBSCRIBE_URL}, or, if your chart has a birth time, on the Transits page, ${RESUBSCRIBE_TIMED_URL}`);
    }
  });

  it('writes the notice without anything about the subscriber', () => {
    const notice = resubscribeNotice(new Date(OPENS + 86_400_000), new Date(ENDS));
    expect(notice).toEqual({
      id: 'resubscribe-2026-12-04',
      day: new Date(OPENS + 86_400_000),
      summary: 'Subscribe to your Zodiacs.org transit calendar again',
      description: "This calendar's address carries your chart's positions, so it stops working at the start of 4 December 2026, UTC. The site now gives each calendar a random address that carries nothing else. To keep these dates, add the calendar again on the birth chart page, https://zodiacs.org/birth-chart/, or, if your chart has a birth time, on the Transits page, https://zodiacs.org/transits/, then remove this one.",
      url: 'https://zodiacs.org/birth-chart/',
    });
  });
});
