import { describe, expect, it } from 'vitest';
import dailyData from '../../data/daily.json';
import publicationData from '../../data/daily-publication.json';
import programData from '../../data/horoscope-program.json';
import {
  HOUSE_THEME,
  ORDINAL,
  houseLine,
  wholeSignHouseFromAsc,
  type Daily,
} from '../daily';
import type { DailyPublication } from '../daily-publication';
import type { PublishedEventDescriptor } from '../events/publication';
import type { HoroscopeProgram } from '../horoscope-program';
import type { SavedChart } from '../profile/schema';
import { SIGN_SLUGS, signForLongitude } from '../signs';
import { natalPointsForChart, selectTodayContacts } from '../today';
import { TRANSIT_ORB, transitLine } from '../transits';
import { FIRST_DELIVERY_WELCOME, renderDailyEmail, validateDailyEmailSources } from './content';

const daily = dailyData as Daily;
const publication = publicationData as DailyPublication;
const program = programData as HoroscopeProgram;
const unsubscribeUrl = 'https://zodiacs.org/api/email/unsubscribe?token=test';

function chartWithBodies(
  bodies: SavedChart['summary']['bodies'],
  ascendant: number | null = null,
): SavedChart {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Test chart',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: null },
    summary: {
      engineVersion: 'fixture', utcISO: '1990-01-01T12:00:00.000Z', houseSystem: 'whole',
      bodies,
      angles: ascendant == null ? null : { asc: ascendant, mc: 0 },
      flags: [],
    },
  };
}

function eventOffset(days: number, signs = ['aquarius']): PublishedEventDescriptor {
  const start = Date.parse(`${publication.date}T12:00:00.000Z`);
  const anchor = new Date(start + (days * 86_400_000)).toISOString();
  return {
    id: `fixture-event-${days}`,
    path: `/events/fixture-event-${days}/`,
    title: `Fixture event ${days}`,
    anchor,
    family: 'lunation',
    subtype: 'full',
    bodies: ['Moon', 'Sun'],
    signs,
    summary: 'A generic event summary.',
    lastModified: publication.date,
  };
}

function publicationWithCollectiveLine(): DailyPublication {
  const candidate = structuredClone(publication);
  candidate.signs[0]!.lines.unshift({
    text: 'Jupiter and Neptune reach an exact trine.',
    receipt: 'Jupiter trine Neptune · exact 07:47 UTC',
    templateId: 'aspect-collective.v1',
    scope: 'collective',
    evidenceRefs: [candidate.facts[0]!.id],
  });
  return candidate;
}

function quietLongitude(): number {
  const angles = [0, 60, 90, 120, 180];
  const candidates = Array.from({ length: 3_600 }, (_, index) => index / 10).map((lon) => ({
    lon,
    nearest: Math.min(...daily.bodies.flatMap((body) => {
      const raw = Math.abs(body.lon - lon) % 360;
      const separation = raw > 180 ? 360 - raw : raw;
      return angles.map((angle) => Math.abs(separation - angle));
    })),
  }));
  const best = candidates.sort((left, right) => right.nearest - left.nearest)[0];
  if (!best || best.nearest <= TRANSIT_ORB) throw new Error('No quiet fixture.');
  return best.lon;
}

describe('daily email content', () => {
  it('accepts only one exact English publication package', () => {
    expect(() => validateDailyEmailSources({ daily, publication, program })).not.toThrow();
    expect(() => validateDailyEmailSources({
      daily: { ...daily, date: '2026-07-19' }, publication, program,
    })).toThrow(/exact committed edition/u);
  });

  it('renders the approved publication headline and collective sky lines for every sign', () => {
    for (const sign of SIGN_SLUGS) {
      const message = renderDailyEmail({
        recipient: {
          tier: 'sun_sign', email: `${sign}@example.com`, sign,
          contactId: `contact_${sign}`, timezone: 'UTC',
        },
        daily,
        publication,
        program,
        baseUrl: 'https://zodiacs.org',
        unsubscribeUrl,
      });
      const published = publication.signs.find((entry) => entry.sign === sign)!;
      for (const line of [published.headline, ...published.lines
        .filter((entry) => entry.scope === 'collective')
        .map((entry) => entry.text.replace(/[.]$/u, ''))]) {
        expect(message.text).toContain(line);
        expect(message.html).toContain(line
          .replaceAll('&', '&amp;')
          .replaceAll('’', '’')
          .replaceAll("'", '&#39;'));
      }
      // PNG, not WebP — Outlook on Windows decodes neither WebP nor AVIF.
      expect(message.html).toContain(`/assets/zodiac-icons/128/${sign}.png`);
      expect(message.html).not.toContain('.webp');
      expect(message.html).toContain('bgcolor="#060709"');
      expect(message.text).toContain(unsubscribeUrl);
      expect(message.html).toContain(unsubscribeUrl.replaceAll('&', '&amp;'));
    }
    const subjectPublication = structuredClone(publication);
    subjectPublication.signs.find((entry) => entry.sign === 'leo')!.todayLine.house = 3;
    const leo = renderDailyEmail({
      recipient: {
        tier: 'sun_sign', email: 'leo@example.com', sign: 'leo',
        contactId: 'contact_leo', timezone: 'UTC',
      },
      daily, publication: subjectPublication, program, baseUrl: 'https://zodiacs.org', unsubscribeUrl,
    });
    expect(leo.subject).toBe('Leo today — messages come to the front');

    const collectivePublication = publicationWithCollectiveLine();
    const timed = renderDailyEmail({
      recipient: {
        tier: 'sun_sign', email: 'aries@example.com', sign: 'aries',
        contactId: 'contact_aries', timezone: 'UTC',
      },
      daily, publication: collectivePublication, program,
      baseUrl: 'https://zodiacs.org', unsubscribeUrl,
    });
    expect(timed.text).toContain('07:47 UTC');
  });

  it('uses the exact Today contact selector and transit prose for chart mail', () => {
    const chart = chartWithBodies(daily.bodies.slice(0, 3).map((body) => ({
      body: body.body, lon: body.lon, retrograde: false,
    })), 120);
    const contact = selectTodayContacts(
      natalPointsForChart(chart), daily.bodies, TRANSIT_ORB, 3,
    )[0];
    expect(contact).toBeTruthy();
    const expected = transitLine(contact.transiting, contact.type, contact.natal);
    const message = renderDailyEmail({
      recipient: {
        tier: 'chart', email: 'chart@example.com', userId: 'user', chartId: chart.id,
        chart, timezone: 'UTC',
      },
      daily,
      publication,
      program,
      nearbyEvent: eventOffset(2),
      baseUrl: 'https://zodiacs.org',
      unsubscribeUrl,
    });
    expect(message.text).toContain(expected);
    expect(message.html).toContain(expected.replaceAll('—', '—'));
    expect((message.text.match(/Ahead:/gu) ?? [])).toHaveLength(1);
    expect((message.html.match(/Ahead:/gu) ?? [])).toHaveLength(1);
    expect(message.text).toContain('Why this appeared:');
    expect(message.text).toContain('method →');
  });

  it('grounds chart context in the committed Moon and first collective edition line', () => {
    const ascendant = 120;
    const groundedPublication = publicationWithCollectiveLine();
    const chart = chartWithBodies(daily.bodies.slice(0, 3).map((body) => ({
      body: body.body, lon: body.lon, retrograde: false,
    })), ascendant);
    const message = renderDailyEmail({
      recipient: {
        tier: 'chart', email: 'grounded@example.com', userId: 'user', chartId: chart.id,
        chart, timezone: 'UTC',
      },
      daily, publication: groundedPublication, program, baseUrl: 'https://zodiacs.org', unsubscribeUrl,
    });
    const moon = daily.bodies.find((body) => body.body === 'Moon')!;
    const ascendantSign = signForLongitude(ascendant).slug;
    const moonLine = houseLine(moon, wholeSignHouseFromAsc(moon.sign, ascendantSign)).text;
    const collective = groundedPublication.signs[0]!.lines.find((line) => line.scope === 'collective')!;
    expect(message.text).toContain(moonLine);
    expect(message.html).toContain(moonLine);
    expect(message.text).toContain(`Sky-wide: ${collective.text.replace(/[.]$/u, '')}`);
    expect(message.html).toContain(`Sky-wide: ${collective.text.replace(/[.]$/u, '')}`);
  });

  it('personalizes only future chart events with a derivable whole-sign house', () => {
    const futureEvent = eventOffset(1);
    const chart = chartWithBodies([{ body: 'Sun', lon: 120, retrograde: false }], 120);
    const message = renderDailyEmail({
      recipient: {
        tier: 'chart', email: 'ahead@example.com', userId: 'user', chartId: chart.id,
        chart, timezone: 'UTC',
      },
      daily, publication, program, nearbyEvent: futureEvent,
      baseUrl: 'https://zodiacs.org', unsubscribeUrl,
    });
    const house = wholeSignHouseFromAsc(futureEvent.signs[0]!, 'leo');
    const eventDate = new Intl.DateTimeFormat('en', {
      month: 'long', day: 'numeric', timeZone: 'UTC',
    }).format(new Date(futureEvent.anchor));
    const expected = `Ahead: Fixture event 1 on ${eventDate} falls in your ${ORDINAL[house]} house — a checkpoint for ${HOUSE_THEME[house]}.`;
    expect(message.text).toContain(expected);
    expect(message.html).toContain(`Ahead: Fixture event 1 on ${eventDate}`);
    expect(message.html).toContain(`falls in your ${ORDINAL[house]} house — a checkpoint for ${HOUSE_THEME[house]}.`);
    expect(message.text).not.toContain(futureEvent.summary);

    const ambiguous = renderDailyEmail({
      recipient: {
        tier: 'chart', email: 'ambiguous@example.com', userId: 'user', chartId: chart.id,
        chart, timezone: 'UTC',
      },
      daily,
      publication,
      program,
      nearbyEvent: { ...futureEvent, signs: ['aries', 'aquarius'] },
      baseUrl: 'https://zodiacs.org',
      unsubscribeUrl,
    });
    expect(ambiguous.text).not.toContain('Ahead:');
    expect(ambiguous.html).not.toContain('Ahead:');

    const untimedChart = chartWithBodies([{ body: 'Sun', lon: 120, retrograde: false }]);
    const untimed = renderDailyEmail({
      recipient: {
        tier: 'chart', email: 'untimed@example.com', userId: 'user', chartId: untimedChart.id,
        chart: untimedChart, timezone: 'UTC',
      },
      daily, publication, program, nearbyEvent: futureEvent,
      baseUrl: 'https://zodiacs.org', unsubscribeUrl,
    });
    expect(untimed.text).not.toContain('Ahead:');
    expect(untimed.html).not.toContain('Ahead:');

    const staleChart = chartWithBodies([{ body: 'Sun', lon: 120, retrograde: false }], 120);
    staleChart.birth.timeKnown = false;
    staleChart.birth.time = null;
    const stale = renderDailyEmail({
      recipient: {
        tier: 'chart', email: 'stale@example.com', userId: 'user', chartId: staleChart.id,
        chart: staleChart, timezone: 'UTC',
      },
      daily, publication, program, nearbyEvent: futureEvent,
      baseUrl: 'https://zodiacs.org', unsubscribeUrl,
    });
    expect(stale.text).not.toContain('Ahead:');
    expect(stale.html).not.toContain('Ahead:');
    expect(stale.text).not.toContain('The Moon spends today in your');
  });

  it('keeps Sun-sign Ahead generic and suppresses same-day events in both tiers', () => {
    const futureEvent = eventOffset(1);
    const sameDayEvent = eventOffset(0);
    const sun = {
      tier: 'sun_sign' as const, email: 'sun@example.com', sign: 'leo',
      contactId: 'contact_leo', timezone: 'UTC' as const,
    };
    const sunFuture = renderDailyEmail({
      recipient: sun, daily, publication, program, nearbyEvent: futureEvent,
      baseUrl: 'https://zodiacs.org', unsubscribeUrl,
    });
    expect(sunFuture.text).toContain(`Ahead: ${futureEvent.title} — ${futureEvent.summary}`);

    const chart = chartWithBodies([{ body: 'Sun', lon: 120, retrograde: false }], 120);
    const recipients = [
      sun,
      {
        tier: 'chart' as const, email: 'chart@example.com', userId: 'user', chartId: chart.id,
        chart, timezone: 'UTC',
      },
    ];
    for (const recipient of recipients) {
      const message = renderDailyEmail({
        recipient, daily, publication, program, nearbyEvent: sameDayEvent,
        baseUrl: 'https://zodiacs.org', unsubscribeUrl,
      });
      expect(message.text).not.toContain('Ahead:');
      expect(message.html).not.toContain('Ahead:');
    }
  });

  it('uses the same quiet-state conclusion when no contact is within 3 degrees', () => {
    const chart = chartWithBodies([{ body: 'Sun', lon: quietLongitude(), retrograde: false }]);
    expect(selectTodayContacts(natalPointsForChart(chart), daily.bodies, TRANSIT_ORB, 3)).toEqual([]);
    const message = renderDailyEmail({
      recipient: {
        tier: 'chart', email: 'quiet@example.com', userId: 'user', chartId: chart.id,
        chart, timezone: 'UTC',
      },
      daily,
      publication,
      program,
      baseUrl: 'https://zodiacs.org',
      unsubscribeUrl,
    });
    const quiet = 'Today looks quieter against your chart. There is less pressure to act on anything immediately.';
    expect(message.text).toContain(quiet);
    expect(message.html).toContain(quiet);
  });

  it('does not infer a whole-date Sun-sign baseline from an unknown-time saved reference', () => {
    const timed = chartWithBodies([{ body: 'Sun', lon: quietLongitude(), retrograde: false }]);
    const reference = structuredClone(timed);
    reference.birth.timeKnown = false;
    reference.birth.time = null;
    const before = JSON.stringify(reference);
    const messageFor = (chart: SavedChart) => renderDailyEmail({
      recipient: { tier: 'chart', email: 'reference@example.com', userId: 'user', chartId: chart.id, chart, timezone: 'UTC' },
      daily, publication, program, baseUrl: 'https://zodiacs.org', unsubscribeUrl,
    });
    const known = messageFor(timed), unknown = messageFor(reference);
    expect(known.text).toContain('Sun-sign baseline');
    expect(known.preheader).not.toContain('Birth time is unknown');
    expect(known.subject).toBe('Your chart today — a quieter sky');
    for (const body of [unknown.text, unknown.html]) {
      expect(body).not.toContain('Sun-sign baseline');
      expect(body).toContain('reference-moment positions');
      expect(body).toContain('the Sun sign has not been verified across the whole birth date');
    }
    expect(unknown.subject).toBe('Your reference chart today — a quieter sky');
    expect(unknown.preheader).toContain('Birth time is unknown');
    expect(JSON.stringify(reference)).toBe(before);
  });

  it('qualifies unknown-time chart contacts while preserving their numerical receipt and input bytes', () => {
    const timed = chartWithBodies(daily.bodies.slice(0, 3).map(body => ({ body: body.body, lon: body.lon, retrograde: false })));
    const reference = structuredClone(timed);
    reference.birth.timeKnown = false;
    reference.birth.time = null;
    const before = JSON.stringify(reference);
    const messageFor = (chart: SavedChart) => renderDailyEmail({
      recipient: { tier: 'chart', email: 'reference@example.com', userId: 'user', chartId: chart.id, chart, timezone: 'UTC' },
      daily, publication, program, baseUrl: 'https://zodiacs.org', unsubscribeUrl,
    });
    const known = messageFor(timed), unknown = messageFor(reference);
    const receipt = (text: string) => text.split('\n').find(line => line.startsWith('Why this appeared:'));
    expect(receipt(known.text)).toBeTruthy();
    expect(receipt(unknown.text)).toBe(receipt(known.text));
    expect(unknown.subject).toBe(known.subject.replace('Your chart', 'Your reference chart'));
    expect(unknown.text).toContain('reference-moment positions');
    expect(unknown.html).toContain('reference-moment positions');
    expect(JSON.stringify(reference)).toBe(before);
  });
});

describe('first daily email', () => {
  const sunRecipient = {
    tier: 'sun_sign' as const, email: 'first@example.com', sign: 'leo',
    contactId: 'contact_first', timezone: 'UTC' as const,
  };
  const render = (firstDelivery?: boolean) => renderDailyEmail({
    recipient: sunRecipient, daily, publication, program,
    baseUrl: 'https://zodiacs.org', unsubscribeUrl, senderPostalAddress: 'Zodiacs.org, Test Address', firstDelivery,
  });

  it('opens with what the person signed up for, before the reading', () => {
    const message = render(true);
    expect(message.text.indexOf(FIRST_DELIVERY_WELCOME)).toBeGreaterThan(-1);
    const headline = publication.signs.find((entry) => entry.sign === 'leo')!.headline;
    expect(message.text.indexOf(FIRST_DELIVERY_WELCOME)).toBeLessThan(message.text.indexOf(headline));
    expect(message.html.indexOf('This is your first daily email from Zodiacs.org'))
      .toBeLessThan(message.html.indexOf('<h1'));
    expect(message.html).toContain('Unsubscribe</a>');
  });

  it('leaves every later email exactly as before', () => {
    expect(render(false)).toEqual(render(undefined));
    expect(render(false).text).not.toContain(FIRST_DELIVERY_WELCOME);
    expect(render(false).html).not.toContain('This is your first daily email');
  });
});
