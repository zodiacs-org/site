import { describe, expect, it } from 'vitest';
import sky from '../../data/sky.json';
import { SIGNS } from '../signs';
import { MOON_JOURNAL_COPY } from './copy';
import {
  REMINDER_BODY_MAX,
  REMINDER_TITLE_MAX,
  REMINDER_URL,
  buildLunationReminder,
  lunationOnUtcDay,
  reminderEventId,
  type SkyMoon,
} from './reminders';
import { SIGN_SLUGS, type Lunation, type SignSlug } from './types';

const DASHES = /[‒–—―]/u;
const moons = (sky as { moons: SkyMoon[] }).moons;
const signName = (slug: SignSlug) => SIGNS.find((sign) => sign.slug === slug)?.name ?? slug;

describe('Moon journal reminder scheduling', () => {
  it('finds the lunation only on its own UTC day', () => {
    expect(lunationOnUtcDay(moons, new Date('2026-11-09T07:00:00.000Z'))).toEqual({
      type: 'new',
      at: '2026-11-09T07:02:05.269Z',
    });
    // Before the exact instant, the same UTC day still counts.
    expect(lunationOnUtcDay(moons, new Date('2026-11-09T00:00:00.000Z'))?.type).toBe('new');
    expect(lunationOnUtcDay(moons, new Date('2026-11-08T23:59:59.999Z'))).toBeNull();
    expect(lunationOnUtcDay(moons, new Date('2026-11-10T12:00:00.000Z'))).toBeNull();
    expect(lunationOnUtcDay(moons, new Date('2026-11-24T07:00:00.000Z'))?.type).toBe('full');
    expect(() => lunationOnUtcDay(moons, new Date('nope'))).toThrow(/invalid/u);
  });

  it('sends on every lunation day of the sky data and on no other day', () => {
    const lunationDays = new Set(moons.map((moon) => moon.at.slice(0, 10)));
    expect(lunationDays.size).toBe(moons.length);
    const start = Date.parse(`${sky.from.slice(0, 10)}T12:00:00.000Z`);
    const end = Date.parse(moons.at(-1)!.at);
    let sendDays = 0;
    for (let time = start; time <= end; time += 86_400_000) {
      const day = new Date(time);
      const found = lunationOnUtcDay(moons, day);
      expect(Boolean(found), day.toISOString()).toBe(lunationDays.has(day.toISOString().slice(0, 10)));
      if (found) sendDays += 1;
    }
    expect(sendDays).toBe(moons.filter((moon) => Date.parse(moon.at) >= start).length);
  });

  it('gives each lunation its own ledger id, apart from the Sky Alert ids', () => {
    expect(reminderEventId({ type: 'new', at: '2026-11-09T07:02:05.269Z' })).toBe('moon-journal-new-2026-11-09');
    expect(reminderEventId({ type: 'full', at: '2026-11-24T14:53:00.000Z' })).toBe('moon-journal-full-2026-11-24');
    for (const moon of moons) expect(reminderEventId(moon)).toMatch(/^[a-z0-9][a-z0-9-]{0,159}$/u);
  });
});

describe('Moon journal reminder copy', () => {
  it('composes the reminder from public sky facts only', () => {
    const lunation: Lunation = { type: 'new', at: '2026-11-09T07:02:05.269Z', sign: 'scorpio' };
    const reminder = buildLunationReminder(lunation, signName);
    expect(reminder).toEqual({
      title: 'New Moon in Scorpio today',
      body: 'Exact at 07:02 UTC. Your journal question is waiting.',
      url: '/moon-journal/',
    });
    // Exactly three fields: no entry, prompt, chart or subscriber detail.
    expect(Object.keys(reminder).sort()).toEqual(['body', 'title', 'url']);
    expect(JSON.stringify(reminder)).not.toContain(MOON_JOURNAL_COPY.en.prompts.new.scorpio);
    expect(buildLunationReminder({ type: 'full', at: '2026-11-24T14:53:31.000Z', sign: 'gemini' }, signName))
      .toEqual({
        title: 'Full Moon in Gemini today',
        body: 'Exact at 14:53 UTC. Your journal question is waiting.',
        url: REMINDER_URL,
      });
  });

  it('fits the service worker limits for every phase and sign, with no dashes', () => {
    for (const type of ['new', 'full'] as const) {
      for (const sign of SIGN_SLUGS) {
        const reminder = buildLunationReminder({ type, at: '2026-01-01T23:59:00.000Z', sign }, signName);
        expect(reminder.title.length, reminder.title).toBeLessThanOrEqual(REMINDER_TITLE_MAX);
        expect(reminder.body.length).toBeLessThanOrEqual(REMINDER_BODY_MAX);
        expect(reminder.title + reminder.body).not.toMatch(DASHES);
      }
    }
    for (const value of Object.values(MOON_JOURNAL_COPY.en.ui)) {
      if (typeof value === 'string') expect(value, value).not.toMatch(DASHES);
    }
  });
});
