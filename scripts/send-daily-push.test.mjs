import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  authorizeRealDelivery,
  buildEventAlert,
  compareEligibleEvents,
  createPushClaimStore,
  createPushScheduleStore,
  eligibleEvent,
  eventFamilyRank,
  parseOptions,
  parseSubscriptionIdAllowlist,
  readSubscriptions,
  selectEventForDay,
  sendDailyPush,
  upcomingBestRankWithinSixDays,
  verifyEventLive,
} from './send-daily-push.mjs';

const event = (overrides = {}) => ({
  id: 'uranus-trine-pluto-2026-07-18',
  path: '/events/uranus-trine-pluto-2026-07-18/',
  title: 'Uranus trine Pluto — July 18, 2026',
  anchor: '2026-07-18T04:39:44.443Z',
  family: 'aspect',
  subtype: 'trine',
  bodies: ['Uranus', 'Pluto'],
  signs: ['gemini', 'aquarius'],
  summary: 'Uranus and Pluto reach an exact trine.',
  lastModified: '2026-07-20',
  ...overrides,
});

const PUBLICATION = {
  schema: 'zodiacs.events-publication.v1',
  locale: 'en',
  timeline: [
    event(),
    event({
      id: 'jupiter-trine-neptune-2026-07-20',
      path: '/events/jupiter-trine-neptune-2026-07-20/',
      title: 'Jupiter trine Neptune — July 20, 2026',
      anchor: '2026-07-20T07:47:52.896Z',
      bodies: ['Jupiter', 'Neptune'],
      signs: ['leo', 'aries'],
      summary: 'Jupiter and Neptune reach an exact trine.',
    }),
    event({
      id: 'jupiter-opposition-pluto-2026-07-20',
      path: '/events/jupiter-opposition-pluto-2026-07-20/',
      title: 'Jupiter opposition Pluto — July 20, 2026',
      anchor: '2026-07-20T14:45:43.725Z',
      subtype: 'opposition',
      bodies: ['Jupiter', 'Pluto'],
      signs: ['leo', 'aquarius'],
      summary: 'Jupiter and Pluto reach an exact opposition.',
    }),
    event({
      id: 'mercury-stations-direct-2026-07-23',
      path: '/mercury-retrograde/2026-06-29/',
      title: 'Mercury stations direct — July 23, 2026',
      anchor: '2026-07-23T22:56:19.394Z',
      family: 'station',
      subtype: 'direct',
      bodies: ['Mercury'],
      signs: ['cancer'],
      summary: 'Mercury stands still, then resumes forward motion.',
    }),
    event({
      id: 'full-moon-2026-07-29',
      path: '/full-moon/2026-07-29/',
      title: 'Full moon in Aquarius — July 29, 2026',
      anchor: '2026-07-29T14:35:36.043Z',
      family: 'lunation',
      subtype: 'full',
      bodies: ['Moon', 'Sun'],
      signs: ['aquarius'],
      summary: 'The Buck Moon — the Moon stands opposite the Sun in Aquarius.',
    }),
    event({
      id: 'new-moon-2026-08-12',
      path: '/new-moon/2026-08-12/',
      title: 'New moon in Leo — August 12, 2026',
      anchor: '2026-08-12T17:36:35.369Z',
      family: 'lunation',
      subtype: 'new',
      bodies: ['Moon', 'Sun'],
      signs: ['leo'],
      summary: "Sun and Moon meet in Leo; the month's quiet reset.",
    }),
    event({
      id: 'eclipse-2026-08-12',
      path: '/eclipses/2026-08-12/',
      title: 'Total solar eclipse in Leo — August 12, 2026',
      anchor: '2026-08-12T17:45:46.794Z',
      family: 'eclipse',
      subtype: 'solar',
      bodies: ['Moon', 'Sun'],
      signs: ['leo'],
      summary: "A new moon crosses the Sun's face in Leo.",
    }),
  ],
};
const COMMITTED_PUBLICATION = JSON.parse(readFileSync(
  new URL('../src/data/events-publication.json', import.meta.url),
  'utf8',
));

const subscription = (overrides = {}) => ({
  subscription_id: 41,
  endpoint: 'https://push.test/subscription',
  p256dh: 'public-key',
  auth: 'auth-key',
  lang: 'en',
  updated_at: '2026-07-18T03:00:00.000Z',
  ...overrides,
});

function claims(outcome = 'reserved') {
  return {
    claim: vi.fn().mockResolvedValue({ outcome, claimToken: '11111111-1111-4111-8111-111111111111' }),
    complete: vi.fn().mockResolvedValue({ outcome: 'finalized', status: 'sent' }),
  };
}

function schedule(outcome = 'selected') {
  return {
    select: vi.fn().mockResolvedValue({ outcome }),
  };
}

function response({ ok = true, status = 200, json = {}, text = '' } = {}) {
  return {
    ok,
    status,
    headers: { get: vi.fn().mockReturnValue('text/html; charset=utf-8') },
    json: vi.fn().mockResolvedValue(json),
    text: vi.fn().mockResolvedValue(text),
  };
}

function simulateEditorialSchedule(publication, startDay, endDay) {
  const selected = [];
  const skipped = [];
  for (
    let dayMs = Date.parse(`${startDay}T00:00:00.000Z`);
    dayMs <= Date.parse(`${endDay}T00:00:00.000Z`);
    dayMs += 86_400_000
  ) {
    const date = new Date(dayMs + 43_200_000);
    const candidate = selectEventForDay(publication, date);
    if (!candidate) continue;
    const utcDate = candidate.anchor.slice(0, 10);
    const prior = selected.filter(({ utcDate: priorDate }) => {
      const priorMs = Date.parse(`${priorDate}T00:00:00.000Z`);
      return priorMs >= dayMs - (6 * 86_400_000) && priorMs < dayMs;
    });
    const familyRank = eventFamilyRank(candidate);
    const upcomingBestRank = upcomingBestRankWithinSixDays(publication, candidate, date);
    const outcome = prior.length >= 2
      ? 'capped_7d'
      : prior.length === 1
        && familyRank > 1
        && upcomingBestRank !== null
        && upcomingBestRank < familyRank
        ? 'held_7d'
        : 'selected';
    const receipt = { utcDate, eventId: candidate.id, familyRank, outcome };
    (outcome === 'selected' ? selected : skipped).push(receipt);
  }
  return { selected, skipped };
}

describe('sky-alert event selection and copy', () => {
  it('selects only the run UTC day and never previews a future event', () => {
    expect(selectEventForDay(PUBLICATION, new Date('2026-07-19T12:00:00Z'))).toBeNull();
    expect(selectEventForDay(PUBLICATION, new Date('2026-07-20T23:59:59Z'))?.id)
      .toBe('jupiter-trine-neptune-2026-07-20');
  });

  it('suppresses a paired lunation in favor of the eclipse', () => {
    expect(selectEventForDay(PUBLICATION, new Date('2026-08-12T01:00:00Z'))?.id)
      .toBe('eclipse-2026-08-12');
  });

  it('uses family rank, anchor, subtype constants, then id as a total order', () => {
    const reversed = { ...PUBLICATION, timeline: [...PUBLICATION.timeline].reverse() };
    expect(selectEventForDay(reversed, new Date('2026-07-20T12:00:00Z'))?.id)
      .toBe('jupiter-trine-neptune-2026-07-20');

    const mixed = {
      ...PUBLICATION,
      timeline: [
        event({
          id: 'full-moon-2026-06-29', family: 'lunation', subtype: 'full',
          anchor: '2026-06-29T23:56:33.675Z', path: '/full-moon/2026-06-29/',
          title: 'Full moon in Capricorn — June 29, 2026', bodies: ['Moon', 'Sun'],
          signs: ['capricorn'], summary: 'The Strawberry Moon — the Moon stands opposite the Sun in Capricorn.',
        }),
        event({
          id: 'mercury-stations-retrograde-2026-06-29', family: 'station', subtype: 'retrograde',
          anchor: '2026-06-29T17:37:12.860Z', path: '/mercury-retrograde/2026-06-29/',
          title: 'Mercury stations retrograde — June 29, 2026', bodies: ['Mercury'],
          signs: ['cancer'], summary: 'Mercury slows to a standstill and turns retrograde.',
        }),
      ],
    };
    expect(selectEventForDay(mixed, new Date('2026-06-29T12:00:00Z'))?.family).toBe('station');

    const tied = [
      event({ id: 'z-trine', anchor: '2026-07-18T04:39:44.443Z', subtype: 'trine' }),
      event({ id: 'z-square', anchor: '2026-07-18T04:39:44.443Z', subtype: 'square' }),
      event({ id: 'a-square', anchor: '2026-07-18T04:39:44.443Z', subtype: 'square' }),
    ].sort(compareEligibleEvents);
    expect(tied.map(({ id }) => id)).toEqual(['a-square', 'z-square', 'z-trine']);
    expect(eventFamilyRank(event({ family: 'eclipse' }))).toBe(1);
    expect(eventFamilyRank(event({ family: 'ingress' }))).toBe(2);
    expect(eventFamilyRank(event({ family: 'aspect' }))).toBe(3);
    expect(eventFamilyRank(event({ family: 'station' }))).toBe(4);
    expect(eventFamilyRank(event({ family: 'lunation' }))).toBe(5);
  });

  it('byte-pins the approved full moon, new moon, station, and aspect formulas', () => {
    expect(buildEventAlert(PUBLICATION.timeline[4])).toEqual({
      title: 'Full moon tonight',
      body: 'The Buck Moon — the Moon stands opposite the Sun in Aquarius. Exact at 14:35 UTC. Where it lands for you:',
      url: '/full-moon/2026-07-29/',
    });
    expect(buildEventAlert(PUBLICATION.timeline[5])).toEqual({
      title: 'New moon today',
      body: "Sun and Moon meet in Leo; the month's quiet reset.",
      url: '/new-moon/2026-08-12/',
    });
    expect(buildEventAlert(PUBLICATION.timeline[3])).toEqual({
      title: 'Mercury turns direct today',
      body: 'Mercury stands still, then resumes forward motion. Exact at 22:56 UTC.',
      url: '/mercury-retrograde/2026-06-29/',
    });
    expect(buildEventAlert(PUBLICATION.timeline[0])).toEqual({
      title: 'A rare exact alignment today',
      body: 'Uranus and Pluto reach an exact trine.',
      url: '/events/uranus-trine-pluto-2026-07-18/',
    });
  });

  it('uses only the selected event canonical URL for an eclipse', () => {
    expect(buildEventAlert(PUBLICATION.timeline[6])).toEqual({
      title: 'Total solar eclipse today',
      body: "A new moon crosses the Sun's face in Leo. Exact at 17:45 UTC.",
      url: '/eclipses/2026-08-12/',
    });
  });

  it('requires one exact live canonical before a real event may send', async () => {
    const selected = PUBLICATION.timeline[0];
    const canonical = 'https://zodiacs.org/events/uranus-trine-pluto-2026-07-18/';
    const fetchImpl = vi.fn().mockResolvedValue(response({
      text: `<html><head><link href="${canonical}" rel="canonical"></head></html>`,
    }));
    await expect(verifyEventLive(selected, fetchImpl)).resolves.toBe(canonical);
    expect(fetchImpl).toHaveBeenCalledWith(canonical, {
      headers: { Accept: 'text/html' },
      redirect: 'manual',
    });

    const wrongCanonical = vi.fn().mockResolvedValue(response({
      text: '<link rel="canonical" href="https://zodiacs.org/events/another/">',
    }));
    await expect(verifyEventLive(selected, wrongCanonical)).rejects.toThrow(/canonical/u);
    const redirect = vi.fn().mockResolvedValue(response({ ok: false, status: 308 }));
    await expect(verifyEventLive(selected, redirect)).rejects.toThrow(/not live \(308\)/u);
  });

  it('excludes sextiles and non-slow aspect/ingress bodies', () => {
    expect(eligibleEvent(event({ subtype: 'sextile' }))).toBe(false);
    expect(eligibleEvent(event({ bodies: ['Venus', 'Pluto'] }))).toBe(false);
    expect(eligibleEvent(event({
      family: 'ingress', subtype: 'ingress', bodies: ['Mercury'],
    }))).toBe(false);
    expect(() => buildEventAlert(event({ subtype: 'sextile' }))).toThrow(/ineligible/u);
  });

  it('uses the fixed aspect deck and exact slow-ingress formula', () => {
    expect(buildEventAlert(PUBLICATION.timeline[1])).toEqual({
      title: 'A rare exact alignment today',
      body: 'Jupiter and Neptune reach an exact trine.',
      url: '/events/jupiter-trine-neptune-2026-07-20/',
    });
    expect(buildEventAlert(event({
      id: 'neptune-enters-aries-2026-01-26',
      path: '/events/neptune-enters-aries-2026-01-26/',
      title: 'Neptune enters Aries — January 26, 2026',
      anchor: '2026-01-26T14:30:38.567Z',
      family: 'ingress',
      subtype: 'ingress',
      bodies: ['Neptune'],
      signs: ['aries'],
      summary: 'Neptune moves into Aries from Pisces.',
    }))).toEqual({
      title: 'Neptune enters Aries today',
      body: 'Neptune moves into Aries from Pisces.',
      url: '/events/neptune-enters-aries-2026-01-26/',
    });
    expect(buildEventAlert(event({
      id: 'neptune-enters-aries-2026-01-26',
      path: '/events/neptune-enters-aries-2026-01-26/',
      title: 'Neptune enters Aries, January 26, 2026',
      anchor: '2026-01-26T14:30:38.567Z',
      family: 'ingress',
      subtype: 'ingress',
      bodies: ['Neptune'],
      signs: ['aries'],
      summary: 'Neptune moves into Aries from Pisces.',
    })).title).toBe('Neptune enters Aries today');
  });

  it('fails closed on an unverified schema or unsafe event URL', () => {
    expect(() => selectEventForDay({ ...PUBLICATION, schema: 'wrong' }, new Date()))
      .toThrow(/verified events publication/u);
    const unsafe = { ...PUBLICATION, timeline: [event({ path: '//attacker.test/' })] };
    expect(selectEventForDay(unsafe, new Date('2026-07-18T12:00:00Z'))).toBeNull();
    const backslash = { ...PUBLICATION, timeline: [event({ path: '/\\attacker.test/' })] };
    expect(selectEventForDay(backslash, new Date('2026-07-18T12:00:00Z'))).toBeNull();
    const query = { ...PUBLICATION, timeline: [event({ path: '/events/example/?next=/today/' })] };
    expect(selectEventForDay(query, new Date('2026-07-18T12:00:00Z'))).toBeNull();
    const nonEventRoute = { ...PUBLICATION, timeline: [event({ path: '/today/' })] };
    expect(selectEventForDay(nonEventRoute, new Date('2026-07-18T12:00:00Z'))).toBeNull();
    expect(() => selectEventForDay({ ...PUBLICATION, locale: 'fr' }, new Date()))
      .toThrow(/verified events publication/u);
  });

  it('renders every eligible committed alert within the exact 32/140 envelope', () => {
    const rendered = COMMITTED_PUBLICATION.timeline
      .filter(eligibleEvent)
      .map((published) => ({ published, alert: buildEventAlert(published) }));
    expect(rendered).toHaveLength(109);
    for (const { published, alert } of rendered) {
      expect(alert.title.length).toBeGreaterThan(0);
      expect(alert.title.length).toBeLessThanOrEqual(32);
      expect(alert.body.length).toBeGreaterThan(0);
      expect(alert.body.length).toBeLessThanOrEqual(140);
      expect(alert.url).toBe(published.path);
      expect(alert.url.length).toBeLessThanOrEqual(512);
      expect(alert.url.startsWith('/')).toBe(true);
      expect(alert.url.startsWith('//')).toBe(false);
      expect(JSON.stringify(alert).length).toBeLessThan(4_096);
    }
    expect(Math.max(...rendered.map(({ alert }) => alert.title.length))).toBe(30);
    expect(Math.max(...rendered.map(({ alert }) => alert.body.length))).toBe(113);
  });

  it('totally orders every committed day and resolves independently of input order', () => {
    const days = [...new Set(COMMITTED_PUBLICATION.timeline.map(({ anchor }) => anchor.slice(0, 10)))];
    for (const day of days) {
      const candidates = COMMITTED_PUBLICATION.timeline
        .filter(eligibleEvent)
        .filter(({ anchor }) => anchor.startsWith(day));
      const ordered = [...candidates].sort(compareEligibleEvents);
      for (let index = 1; index < ordered.length; index += 1) {
        expect(compareEligibleEvents(ordered[index - 1], ordered[index])).toBeLessThan(0);
      }
      expect(selectEventForDay(COMMITTED_PUBLICATION, new Date(`${day}T12:00:00Z`))?.id ?? null)
        .toBe(ordered[0]?.id ?? null);
      expect(selectEventForDay(
        { ...COMMITTED_PUBLICATION, timeline: [...COMMITTED_PUBLICATION.timeline].reverse() },
        new Date(`${day}T12:00:00Z`),
      )?.id ?? null).toBe(ordered[0]?.id ?? null);
    }
  });

  it('looks ahead exactly six UTC dates and returns the best selected family rank', () => {
    const selected = selectEventForDay(PUBLICATION, new Date('2026-07-18T12:00:00Z'));
    expect(upcomingBestRankWithinSixDays(
      PUBLICATION, selected, new Date('2026-07-18T12:00:00Z'),
    )).toBe(3);
    const synthetic = {
      ...PUBLICATION,
      timeline: [
        event({
          id: 'full-moon-2026-09-01', family: 'lunation', subtype: 'full',
          path: '/full-moon/2026-09-01/', anchor: '2026-09-01T12:00:00Z',
          title: 'Full moon in Pisces — September 1, 2026', bodies: ['Moon', 'Sun'],
        }),
        event({
          id: 'eclipse-2026-09-07', family: 'eclipse', subtype: 'solar',
          path: '/eclipses/2026-09-07/', anchor: '2026-09-07T12:00:00Z',
          title: 'Total solar eclipse in Virgo — September 7, 2026', bodies: ['Moon', 'Sun'],
        }),
      ],
    };
    const moon = selectEventForDay(synthetic, new Date('2026-09-01T12:00:00Z'));
    expect(upcomingBestRankWithinSixDays(
      synthetic, moon, new Date('2026-09-01T12:00:00Z'),
    )).toBe(1);
  });

  it('keeps the entire committed editorial stream below three alerts in every seven UTC dates', () => {
    const stream = simulateEditorialSchedule(
      COMMITTED_PUBLICATION,
      '2026-01-03',
      '2027-12-27',
    );
    expect(stream.selected).toHaveLength(84);
    expect(stream.skipped).toHaveLength(12);
    for (const receipt of stream.selected) {
      const end = Date.parse(`${receipt.utcDate}T00:00:00.000Z`);
      const count = stream.selected.filter(({ utcDate }) => {
        const candidate = Date.parse(`${utcDate}T00:00:00.000Z`);
        return candidate >= end - (6 * 86_400_000) && candidate <= end;
      }).length;
      expect(count).toBeLessThanOrEqual(2);
    }
    expect(stream.skipped.filter(({ outcome }) => outcome === 'held_7d')).toHaveLength(4);
  });

  it('pins the corrected seeded July stream without inventing a production receipt', () => {
    const stream = simulateEditorialSchedule(
      COMMITTED_PUBLICATION,
      '2026-07-18',
      '2026-07-29',
    );
    expect(stream.selected.map(({ utcDate, eventId }) => [utcDate, eventId])).toEqual([
      ['2026-07-18', 'uranus-trine-pluto-2026-07-18'],
      ['2026-07-20', 'jupiter-trine-neptune-2026-07-20'],
      ['2026-07-26', 'saturn-stations-retrograde-2026-07-26'],
      ['2026-07-29', 'full-moon-2026-07-29'],
    ]);
    expect(stream.skipped.map(({ utcDate, eventId, outcome }) => [utcDate, eventId, outcome]))
      .toEqual([
        ['2026-07-23', 'mercury-stations-direct-2026-07-23', 'capped_7d'],
      ]);
  });

  it('contains none of the retired daily or preview fallback strings', () => {
    const sender = readFileSync(new URL('./send-daily-push.mjs', import.meta.url), 'utf8');
    expect(sender).not.toContain('Next:');
    expect(sender).not.toContain('Your daily note is ready');
  });
});

describe('sky-alert delivery', () => {
  it('does nothing on a quiet day without claiming or contacting Web Push', async () => {
    const editorialSchedule = schedule();
    const store = claims();
    const sendNotification = vi.fn();
    const report = await sendDailyPush({
      subscriptions: [subscription()], publication: PUBLICATION,
      date: new Date('2026-07-22T12:00:00Z'), schedule: editorialSchedule, claims: store, sendNotification,
    });
    expect(report).toMatchObject({ event: null, considered: 0, reserved: 0, sent: 0, dryRun: 0 });
    expect(editorialSchedule.select).not.toHaveBeenCalled();
    expect(store.claim).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('renders every locale as approved English during a mutation-free dry run', async () => {
    const store = claims();
    const sendNotification = vi.fn();
    const log = vi.fn();
    const report = await sendDailyPush({
      subscriptions: [subscription({ lang: 'it' }), subscription({ subscription_id: 42, lang: 'fr' })],
      publication: PUBLICATION,
      date: new Date('2026-07-18T12:00:00Z'),
      dryRun: true,
      claims: store,
      sendNotification,
      log,
    });
    expect(report).toMatchObject({ event: 'uranus-trine-pluto-2026-07-18', considered: 2, reserved: 0, dryRun: 2 });
    expect(store.claim).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.every(([line]) => line.includes('dry-run en'))).toBe(true);
  });

  it('reserves before Web Push, sends the event URL, then finalizes the exact claim', async () => {
    const order = [];
    const editorialSchedule = schedule();
    editorialSchedule.select.mockImplementation(async () => {
      order.push('schedule');
      return { outcome: 'selected' };
    });
    const store = claims();
    store.claim.mockImplementation(async () => {
      order.push('reserve');
      return { outcome: 'reserved', claimToken: 'claim-token' };
    });
    store.complete.mockImplementation(async () => {
      order.push('finalize');
      return { outcome: 'finalized', status: 'sent' };
    });
    const sendNotification = vi.fn().mockImplementation(async (_subscription, payload, options) => {
      order.push('send');
      expect(JSON.parse(payload).url).toBe('/events/uranus-trine-pluto-2026-07-18/');
      expect(options.TTL).toBe(43_200);
      return { statusCode: 201 };
    });
    const report = await sendDailyPush({
      subscriptions: [subscription()], publication: PUBLICATION,
      date: new Date('2026-07-18T12:00:00Z'), now: new Date('2026-07-18T12:00:00Z'),
      schedule: editorialSchedule, claims: store, sendNotification,
    });
    expect(order).toEqual(['schedule', 'reserve', 'send', 'finalize']);
    expect(editorialSchedule.select).toHaveBeenCalledWith(
      '2026-07-18', 'uranus-trine-pluto-2026-07-18', 3, 3,
    );
    expect(store.claim).toHaveBeenCalledWith(
      41,
      'uranus-trine-pluto-2026-07-18',
      '2026-07-18T03:00:00.000Z',
    );
    expect(store.complete).toHaveBeenCalledWith(
      41, 'uranus-trine-pluto-2026-07-18', 'claim-token', 'sent', 201,
    );
    expect(report).toMatchObject({ considered: 1, reserved: 1, sent: 1, failed: 0 });
  });

  it.each(['capped_7d', 'held_7d'])(
    'does not read endpoint claims or contact Web Push after global %s',
    async (outcome) => {
      const store = claims();
      const sendNotification = vi.fn();
      const report = await sendDailyPush({
        subscriptions: [subscription()], publication: PUBLICATION,
        date: new Date('2026-07-18T12:00:00Z'), schedule: schedule(outcome),
        claims: store, sendNotification,
      });
      expect(report.schedule).toBe(outcome);
      expect(report.held).toBe(outcome === 'held_7d' ? 1 : 0);
      expect(store.claim).not.toHaveBeenCalled();
      expect(sendNotification).not.toHaveBeenCalled();
    },
  );

  it('fails closed when another schedule decision conflicts with the selected publication event', async () => {
    const store = claims();
    const sendNotification = vi.fn();
    await expect(sendDailyPush({
      subscriptions: [subscription()], publication: PUBLICATION,
      date: new Date('2026-07-18T12:00:00Z'), schedule: schedule('conflict'),
      claims: store, sendNotification,
    })).rejects.toThrow(/schedule conflicts/u);
    expect(store.claim).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('leaves the schedule ledger untouched when no subscription can receive the alert', async () => {
    const editorialSchedule = schedule();
    const report = await sendDailyPush({
      subscriptions: [], publication: PUBLICATION,
      date: new Date('2026-07-18T12:00:00Z'), schedule: editorialSchedule,
      claims: claims(), sendNotification: vi.fn(),
    });
    expect(report.schedule).toBe('empty');
    expect(editorialSchedule.select).not.toHaveBeenCalled();
  });

  it.each(['capped_24h', 'capped_7d', 'duplicate', 'missing', 'stale'])(
    'does not contact Web Push after a %s outcome',
    async (outcome) => {
      const store = claims(outcome);
      const sendNotification = vi.fn();
      const report = await sendDailyPush({
        subscriptions: [subscription()], publication: PUBLICATION,
        date: new Date('2026-07-18T12:00:00Z'), schedule: schedule(), claims: store, sendNotification,
      });
      expect(sendNotification).not.toHaveBeenCalled();
      expect(store.complete).not.toHaveBeenCalled();
      expect(report.capped).toBe(outcome.startsWith('capped') ? 1 : 0);
      expect(report.duplicate).toBe(outcome === 'duplicate' ? 1 : 0);
      expect(report.missing).toBe(outcome === 'missing' ? 1 : 0);
      expect(report.stale).toBe(outcome === 'stale' ? 1 : 0);
    },
  );

  it.each([404, 410])('atomically expires and prunes the exact subscription after %i', async (statusCode) => {
    const store = claims();
    store.complete.mockResolvedValue({ outcome: 'expired' });
    const report = await sendDailyPush({
      subscriptions: [subscription()], publication: PUBLICATION,
      date: new Date('2026-07-18T12:00:00Z'), schedule: schedule(), claims: store,
      sendNotification: vi.fn().mockRejectedValue({ statusCode }),
    });
    expect(store.complete).toHaveBeenCalledWith(
      41, 'uranus-trine-pluto-2026-07-18', expect.any(String), 'expired', statusCode,
    );
    expect(report).toMatchObject({ reserved: 1, sent: 0, pruned: 1, failed: 0 });
  });

  it('treats a resolved non-2xx Web Push response as a provider failure', async () => {
    const store = claims();
    store.complete.mockResolvedValue({ outcome: 'expired' });
    const report = await sendDailyPush({
      subscriptions: [subscription()], publication: PUBLICATION,
      date: new Date('2026-07-18T12:00:00Z'), schedule: schedule(), claims: store,
      sendNotification: vi.fn().mockResolvedValue({ statusCode: 410 }),
    });
    expect(store.complete).toHaveBeenCalledWith(
      41, 'uranus-trine-pluto-2026-07-18', expect.any(String), 'expired', 410,
    );
    expect(report).toMatchObject({ sent: 0, pruned: 1, failed: 0 });
  });

  it.each([{}, null, undefined])(
    'never treats a resolved provider response without an explicit status as sent: %j',
    async (providerResponse) => {
      const store = claims();
      store.complete.mockResolvedValue({ outcome: 'finalized', status: 'failed' });
      const report = await sendDailyPush({
        subscriptions: [subscription()], publication: PUBLICATION,
        date: new Date('2026-07-18T12:00:00Z'), schedule: schedule(), claims: store,
        sendNotification: vi.fn().mockResolvedValue(providerResponse), log: vi.fn(),
      });
      expect(store.complete).toHaveBeenCalledWith(
        41, 'uranus-trine-pluto-2026-07-18', expect.any(String), 'failed', null,
      );
      expect(report).toMatchObject({ sent: 0, failed: 1 });
    },
  );

  it('records a non-terminal provider failure without retrying the event', async () => {
    const store = claims();
    store.complete.mockResolvedValue({ outcome: 'finalized', status: 'failed' });
    const report = await sendDailyPush({
      subscriptions: [subscription()], publication: PUBLICATION,
      date: new Date('2026-07-18T12:00:00Z'), schedule: schedule(), claims: store,
      sendNotification: vi.fn().mockRejectedValue({ statusCode: 503 }), log: vi.fn(),
    });
    expect(store.complete).toHaveBeenCalledWith(
      41, 'uranus-trine-pluto-2026-07-18', expect.any(String), 'failed', 503,
    );
    expect(report).toMatchObject({ reserved: 1, sent: 0, pruned: 0, failed: 1 });
  });

  it('counts one failed subscription when provider and receipt both fail', async () => {
    const store = claims();
    store.complete.mockRejectedValue(new Error('database unavailable'));
    const report = await sendDailyPush({
      subscriptions: [subscription()], publication: PUBLICATION,
      date: new Date('2026-07-18T12:00:00Z'), schedule: schedule(), claims: store,
      sendNotification: vi.fn().mockRejectedValue({ statusCode: 503 }), log: vi.fn(),
    });
    expect(report).toMatchObject({ considered: 1, reserved: 1, sent: 0, failed: 1 });
  });

  it('leaves a reservation in place when accepted delivery cannot be finalized', async () => {
    const store = claims();
    store.complete.mockRejectedValue(new Error('database unavailable'));
    const report = await sendDailyPush({
      subscriptions: [subscription()], publication: PUBLICATION,
      date: new Date('2026-07-18T12:00:00Z'), schedule: schedule(), claims: store,
      sendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }), log: vi.fn(),
    });
    expect(store.complete).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({ reserved: 1, sent: 0, failed: 1 });
  });
});

describe('push claim PostgREST adapter and CLI', () => {
  it('reads the stable subscription id required by the cap ledger', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ json: [subscription()] }));
    await expect(readSubscriptions(fetchImpl, 'https://project.supabase.co', 'service-key', 500))
      .resolves.toEqual([subscription()]);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('select=subscription_id,endpoint,p256dh,auth,lang,updated_at');

    await readSubscriptions(
      fetchImpl,
      'https://project.supabase.co',
      'service-key',
      50,
      [41, 43],
    );
    expect(String(fetchImpl.mock.calls[1][0])).toContain('subscription_id=in.(41,43)');
  });

  it('hard-gates real delivery to the enabled schedule or an exact test list', () => {
    expect(authorizeRealDelivery({ PUSH_ENABLED: 'true' })).toEqual([]);
    expect(authorizeRealDelivery({ PUSH_TEST_SUBSCRIPTION_IDS: '41, 43,41' })).toEqual([41, 43]);
    expect(() => authorizeRealDelivery({})).toThrow(/PUSH_ENABLED=true/u);
    expect(() => parseSubscriptionIdAllowlist('0,2')).toThrow(/positive integer/u);
    expect(() => parseSubscriptionIdAllowlist('1,not-an-id')).toThrow(/positive integer/u);
  });

  it('reserves and finalizes through the service-only RPC contract', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ json: {
        outcome: 'reserved',
        claim_token: '11111111-1111-4111-8111-111111111111',
        claimed_at: '2026-07-18T07:00:00Z',
      } }))
      .mockResolvedValueOnce(response({ json: { outcome: 'finalized', status: 'sent' } }));
    const store = createPushClaimStore(fetchImpl, 'https://project.supabase.co', 'service-key', {
      randomId: () => '11111111-1111-4111-8111-111111111111',
    });
    const claim = await store.claim(41, 'event-id', '2026-07-18T03:00:00.000Z');
    expect(claim.outcome).toBe('reserved');
    await expect(store.complete(41, 'event-id', claim.claimToken, 'sent', 201))
      .resolves.toMatchObject({ outcome: 'finalized', status: 'sent' });
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/rpc/reserve_push_delivery');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      candidate_subscription_id: 41,
      candidate_event_id: 'event-id',
      candidate_subscription_updated_at: '2026-07-18T03:00:00.000Z',
      candidate_claim_token: claim.claimToken,
    });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      candidate_subscription_id: 41,
      candidate_event_id: 'event-id',
      candidate_claim_token: claim.claimToken,
      candidate_outcome: 'sent',
      candidate_provider_status: 201,
    });
  });

  it('selects the global UTC-date schedule through the service-only RPC contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ json: {
      outcome: 'selected', utc_date: '2026-07-18', event_id: 'event-id',
    } }));
    const store = createPushScheduleStore(fetchImpl, 'https://project.supabase.co', 'service-key');
    await expect(store.select('2026-07-18', 'event-id', 3, 1))
      .resolves.toMatchObject({ outcome: 'selected' });
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/rpc/select_push_alert_event');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      candidate_utc_date: '2026-07-18',
      candidate_event_id: 'event-id',
      candidate_family_rank: 3,
      candidate_upcoming_best_rank: 1,
    });
  });

  it('retries a thrown schedule transport once with the identical decision body', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('connection reset after commit'))
      .mockResolvedValueOnce(response({ json: { outcome: 'selected' } }));
    const store = createPushScheduleStore(fetchImpl, 'https://project.supabase.co', 'service-key');
    await store.select('2026-07-18', 'event-id', 3, null);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe(fetchImpl.mock.calls[1][0]);
    expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body);
  });

  it('retries a thrown reserve/finalize transport once with the identical idempotency body', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('connection reset after commit'))
      .mockResolvedValueOnce(response({ json: {
        outcome: 'reserved', claim_token: '11111111-1111-4111-8111-111111111111',
      } }))
      .mockRejectedValueOnce(new Error('connection reset after commit'))
      .mockResolvedValueOnce(response({ json: { outcome: 'finalized', status: 'sent' } }));
    const store = createPushClaimStore(fetchImpl, 'https://project.supabase.co', 'service-key', {
      randomId: () => '11111111-1111-4111-8111-111111111111',
    });
    const claim = await store.claim(41, 'event-id', '2026-07-18T03:00:00.000Z');
    await store.complete(41, 'event-id', claim.claimToken, 'sent', 201);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[0][0]).toBe(fetchImpl.mock.calls[1][0]);
    expect(fetchImpl.mock.calls[0][1].body).toBe(fetchImpl.mock.calls[1][1].body);
    expect(fetchImpl.mock.calls[2][0]).toBe(fetchImpl.mock.calls[3][0]);
    expect(fetchImpl.mock.calls[2][1].body).toBe(fetchImpl.mock.calls[3][1].body);
  });

  it('does not retry an explicit non-OK RPC response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: false, status: 503, text: 'offline' }));
    const store = createPushClaimStore(fetchImpl, 'https://project.supabase.co', 'service-key', {
      randomId: () => '11111111-1111-4111-8111-111111111111',
    });
    await expect(store.claim(41, 'event-id', '2026-07-18T03:00:00.000Z')).rejects.toThrow(/503/u);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const finalizeFetch = vi.fn().mockResolvedValue(response({ ok: false, status: 409, text: 'conflict' }));
    const finalizeStore = createPushClaimStore(finalizeFetch, 'https://project.supabase.co', 'service-key');
    await expect(finalizeStore.complete(
      41, 'event-id', '11111111-1111-4111-8111-111111111111', 'sent', 201,
    )).rejects.toThrow(/409/u);
    expect(finalizeFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown RPC outcomes and invalid calendar options', async () => {
    const store = createPushClaimStore(
      vi.fn().mockResolvedValue(response({ json: { outcome: 'surprise' } })),
      'https://project.supabase.co', 'service-key',
    );
    await expect(store.claim(41, 'event-id', '2026-07-18T03:00:00.000Z')).rejects.toThrow(/unknown outcome/u);
    await expect(store.claim(0, 'event-id', '2026-07-18T03:00:00.000Z')).rejects.toThrow(/subscription id/u);
    await expect(store.claim(41, '../event', '2026-07-18T03:00:00.000Z')).rejects.toThrow(/event id/u);
    await expect(store.claim(41, 'event-id', 'not-a-timestamp')).rejects.toThrow(/subscription version/u);
    const scheduleStore = createPushScheduleStore(
      vi.fn().mockResolvedValue(response({ json: { outcome: 'surprise' } })),
      'https://project.supabase.co', 'service-key',
    );
    await expect(scheduleStore.select('2026-07-18', 'event-id', 3, null))
      .rejects.toThrow(/unknown outcome/u);
    await expect(scheduleStore.select('2026-02-31', 'event-id', 3, null))
      .rejects.toThrow(/arguments are invalid/u);
    await expect(scheduleStore.select('2026-07-18', 'event-id', 0, null))
      .rejects.toThrow(/arguments are invalid/u);
    expect(() => parseOptions(['--date', '2026-02-31'])).toThrow(/real UTC calendar date/u);
    expect(() => parseOptions(['--limit', '0'])).toThrow(/integer from 1 to 10000/u);
    expect(() => parseOptions(['--fixture'])).toThrow(/requires --dry-run/u);
    expect(() => parseOptions(['--verify-live-only', '--dry-run'])).toThrow(/cannot be combined/u);
  });

  it('keeps the workflow gate explicit and scheduled delivery disabled by default', () => {
    const workflow = readFileSync(new URL('../.github/workflows/push-daily.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('Require selected event in production before real delivery');
    expect(workflow).toContain('npm run push:daily -- --verify-live-only');
    expect(workflow).toContain('--date 2026-07-18');
    expect(workflow).toContain('--date 2026-07-22');
    expect(workflow).not.toContain('--date 2026-07-19');
    expect(workflow).toContain("vars.PUSH_ENABLED == 'true'");
    expect(workflow).toContain('PUSH_TEST_SUBSCRIPTION_IDS: ${{ vars.PUSH_TEST_SUBSCRIPTION_IDS }}');
  });
});
