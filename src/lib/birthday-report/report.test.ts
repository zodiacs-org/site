import { describe, expect, it } from 'vitest';
import { birthdayReport, reportInstants } from './report';
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { birthdayReportShareUrl, parseBirthdayReportShare } from './share';
import { handleBirthdayReportImageRequest, handleBirthdayReportLinkRequest, isResultShareRoute } from '../../server/result-preview';
import vercel from '../../../vercel.json';

describe('the birthday report', () => {
  it('opens the year at the latest solar return and reads every part from it', () => {
    const report = birthdayReport(new Date('1990-05-03T12:00:00Z'), '1990-05-03', false, new Date('2026-11-09T00:00:00Z'));
    expect(report.sun?.slug).toBe('taurus');
    expect(report.sunCandidates).toEqual([]);
    expect(report.solarReturn.slice(0, 10)).toMatch(/^2026-05-0[2-4]$/u);
    expect(report.nextSolarReturn.slice(0, 4)).toBe('2027');
    expect(report.year.from).toBe(report.solarReturn.slice(0, 10));
    expect(report.calendarYear).toBe(2026);
    // 5 + 3 + (2+0+2+6 = 10 -> 1) = 9
    expect(report.personalYear).toBe(9);
    // 5 + 3 + 2026 = 2034 -> 9 (The Hermit)
    expect(report.card.name).toBe('The Hermit');
    expect(report.lifePath).toBeGreaterThan(0);
  });
  it('handles a 29 February birthday in a year without one', () => {
    const report = birthdayReport(new Date('1992-02-29T12:00:00Z'), '1992-02-29', false, new Date('2027-06-01T00:00:00Z'));
    expect(report.calendarYear).toBe(2027);
    expect(report.personalYear).toBeGreaterThan(0);
  });
});

describe('the birthday report without a birth time', () => {
  const now = new Date('2026-11-09T00:00:00Z');
  it('casts from 12:00 UTC with or without a birthplace, so the solar return is the same instant (and the same as /solar-return/)', async () => {
    await prepareLocalTime('1990-05-03', 'Asia/Tokyo');
    const tokyo = reportInstants({ date: '1990-05-03', time: null, place: { tz: 'Asia/Tokyo', lon: 139.69 } }, { resolveLocalToUtc });
    const nowhere = reportInstants({ date: '1990-05-03', time: null, place: null }, { resolveLocalToUtc });
    expect(tokyo.timeKnown).toBe(false);
    expect(tokyo.birthUtc.toISOString()).toBe('1990-05-03T12:00:00.000Z');
    expect(nowhere.birthUtc.toISOString()).toBe('1990-05-03T12:00:00.000Z');
    // The Tokyo clock's 00:00 and 23:59 settle the sign; without a place, every clock's version of the date.
    expect(tokyo.sunEnds.map((at) => at.toISOString())).toEqual(['1990-05-02T15:00:00.000Z', '1990-05-03T14:59:00.000Z']);
    expect(nowhere.sunEnds.map((at) => at.toISOString())).toEqual(['1990-05-02T10:00:00.000Z', '1990-05-04T11:59:00.000Z']);
    const withZone = birthdayReport(tokyo.birthUtc, '1990-05-03', tokyo.timeKnown, now, tokyo.sunEnds);
    const without = birthdayReport(nowhere.birthUtc, '1990-05-03', nowhere.timeKnown, now, nowhere.sunEnds);
    expect(withZone.solarReturn).toBe(without.solarReturn);
    expect(withZone.nextSolarReturn).toBe(without.nextSolarReturn);
    expect(withZone.year.score).toBe(without.year.score);
  });
  it('uses the birth time and place when both are given', async () => {
    await prepareLocalTime('1990-05-03', 'Asia/Tokyo');
    const timed = reportInstants({ date: '1990-05-03', time: '08:30', place: { tz: 'Asia/Tokyo', lon: 139.69 } }, { resolveLocalToUtc });
    expect(timed.timeKnown).toBe(true);
    expect(timed.birthUtc.toISOString()).toBe('1990-05-02T23:30:00.000Z');
    expect(timed.sunEnds).toEqual([timed.birthUtc, timed.birthUtc]);
  });
  it('names no Sun sign when the birth day straddles a sign change, and gives both candidates', () => {
    const report = birthdayReport(new Date('1990-03-20T12:00:00Z'), '1990-03-20', false, now);
    expect(report.sun).toBeNull();
    expect(report.sunCandidates).toEqual([{ slug: 'pisces', name: 'Pisces' }, { slug: 'aries', name: 'Aries' }]);
    expect(report.hue).toMatch(/^#/u);
  });
});

describe('the birthday report share link', () => {
  it('carries the Sun sign, the score, the Personal Year and the card number, nothing that leads to a birth date', () => {
    const url = birthdayReportShareUrl('https://zodiacs.org', { sun: 'taurus', score: 6.44, personalYear: 9, card: 9 })!;
    expect(url).toBe('https://zodiacs.org/share/birthday-report/?s=taurus&v=6.4&py=9&t=9');
    expect(parseBirthdayReportShare(new URL(url).searchParams)).toMatchObject({ sun: 'taurus', score: 6.4, personalYear: 9, card: 9 });
    for (const query of ['s=taurus&v=6.4&py=9&t=9&d=05-03', 's=taurus&v=6.4&py=0&t=9', 's=taurus&v=6.4&py=9&t=22', 's=taurus&v=6.4&py=11&t=9']) {
      expect(parseBirthdayReportShare(new URLSearchParams(query)), query).toBeNull();
    }
  });
  it('is routed through the share function and draws a JPEG card and a page', async () => {
    expect(isResultShareRoute('birthday-report-link') && isResultShareRoute('birthday-report-image')).toBe(true);
    expect((vercel as { rewrites: unknown[] }).rewrites).toContainEqual({ source: '/share/birthday-report/', destination: '/api/compatibility?__zodiacs_share=birthday-report-link' });
    const image = await handleBirthdayReportImageRequest(new Request('https://zodiacs.org/api/og/birthday-report-image?s=leo&v=6.4&py=7&t=17'));
    expect(image.headers.get('content-type')).toBe('image/jpeg');
    const html = await (await handleBirthdayReportLinkRequest(new Request('https://zodiacs.org/share/birthday-report/?s=leo&v=6.4&py=7&t=17'))).text();
    expect(html).toContain('The Star, Personal Year 7');
    expect(html).toContain('href="/birthday-report/"');
    expect(html).not.toMatch(/[–—]/u);
  }, 30_000);
});
