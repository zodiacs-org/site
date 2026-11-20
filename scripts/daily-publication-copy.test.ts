import { describe, expect, it } from 'vitest';
import { buildHoroscopeWindow, windowDates } from '../src/ai-tools/horoscope/window';
import { DAILY_RENDERER_VERSION, dailyHeadline, dailyReading, type Daily } from '../src/lib/daily';
import { renderDailyEmail } from '../src/lib/daily-email/content';
import { buildDailyPublication, validateDailyPublication } from '../src/lib/daily-publication';
import { SIGN_SLUGS } from '../src/lib/signs';
import { REPO_ROOT } from './daily-publication-files';
import { computeDailySnapshot } from './daily-snapshot-lib.mjs';
import { computeHoroscopeEdition } from './horoscope-program-files';
import { verifyDailyPublicationCopy } from './independent-copy-verifier';

const longDash = /[\u2013\u2014]/u;

describe('generated daily copy', () => {
  it.each([
    { date: '2026-11-22', event: { kind: 'ingress' }, template: 'ingress-house.v1' },
    { date: '2026-11-24', event: { kind: 'lunation', type: 'full' }, template: 'lunation-house.v1' },
    { date: '2026-11-24', event: { kind: 'aspect' }, template: 'aspect-collective.v1' },
    { date: '2026-12-09', event: { kind: 'lunation', type: 'new' }, template: 'lunation-house.v1' },
    { date: '2026-12-10', event: { kind: 'station', type: 'direct' }, template: 'station-house.v1' },
    { date: '2026-12-13', event: { kind: 'station', type: 'retrograde' }, template: 'station-house.v1' },
  ])('keeps $date $event.kind $event.type copy and receipts free of em and en dashes', async ({ date, event, template }) => {
    const daily = await computeDailySnapshot(date, REPO_ROOT) as Daily;
    expect(daily.events).toContainEqual(expect.objectContaining(event));

    const publication = buildDailyPublication(daily);
    expect(publication.rendererVersion).toBe(DAILY_RENDERER_VERSION);
    expect(validateDailyPublication(daily, publication)).toEqual([]);
    expect(verifyDailyPublicationCopy(publication)).toEqual([]);

    for (const entry of publication.signs) {
      expect(entry.lines.map((line) => line.templateId), entry.sign).toContain(template);
      expect(JSON.stringify(entry), entry.sign).not.toMatch(longDash);
      expect(JSON.stringify(dailyReading(entry.sign, daily)), entry.sign).not.toMatch(longDash);
      expect(dailyHeadline(entry.sign, daily), entry.sign).not.toMatch(longDash);
    }
  });

  it('keeps the program, assistant window, and sign emails free of em and en dashes', async () => {
    const date = '2026-11-24';
    const editions = await Promise.all(windowDates(date).map(computeHoroscopeEdition));
    const programs = editions.map(({ program }) => program);
    for (const program of programs) {
      expect(JSON.stringify(program), program.anchorDate).not.toMatch(longDash);
    }
    expect(JSON.stringify(buildHoroscopeWindow(date, programs))).not.toMatch(longDash);

    const { input, program } = editions[1];
    const daily = input.dailySnapshots.find((snapshot) => snapshot.date === date)!;
    const publication = buildDailyPublication(daily);
    for (const sign of SIGN_SLUGS) {
      const message = renderDailyEmail({
        recipient: { tier: 'sun_sign', email: 'reader@example.com', contactId: sign, sign, timezone: 'UTC' },
        daily,
        publication,
        program,
        baseUrl: 'https://zodiacs.org',
        unsubscribeUrl: 'https://zodiacs.org/profile/',
      });
      expect(JSON.stringify(message), sign).not.toMatch(longDash);
    }
  });
});
