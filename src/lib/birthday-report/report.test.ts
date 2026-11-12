import { describe, expect, it } from 'vitest';
import { birthdayCalendarYear, birthdayReport, reportInstants } from './report';
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { birthdayReportShareUrl, parseBirthdayReportShare } from './share';
import { birthdayReportImageTitle, handleBirthdayReportImageRequest, handleBirthdayReportLinkRequest, isResultShareRoute } from '../../server/result-preview';
import { MAJOR_ARCANA, cardTitle, tarotYearCard } from '../tarot/year-card';
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
  it('reads the year the next solar return opens when asked for it', () => {
    const now = new Date('2026-11-10T00:00:00Z');
    const current = birthdayReport(new Date('1990-05-03T12:00:00Z'), '1990-05-03', false, now);
    const report = birthdayReport(new Date('1990-05-03T12:00:00Z'), '1990-05-03', false, now, 'next');
    expect(report.solarReturn.slice(0, 4)).toBe('2027');
    expect(report.solarReturn).toBe(current.nextSolarReturn);
    expect(report.year.from).toBe(report.solarReturn.slice(0, 10));
    expect(report.nextSolarReturn.slice(0, 4)).toBe('2028');
    expect(report.calendarYear).toBe(2027);
    // 5 + 3 + (2+0+2+7 = 11 -> 2) = 10 -> 1
    expect(report.personalYear).toBe(1);
  });
  it('takes the year of the civil birthday, not the UTC year of the return', () => {
    // The return for 1 January 2029 falls at 23:06 UTC on 31 December 2028.
    const january = birthdayReport(new Date('1990-01-01T12:00:00Z'), '1990-01-01', false, new Date('2029-06-01T00:00:00Z'));
    expect(january.solarReturn.slice(0, 10)).toBe('2028-12-31');
    expect(january.calendarYear).toBe(2029);
    expect(january.card).toBe(tarotYearCard(1, 1, 2029));
    // A 31 December birth at 23:30 UTC: the return for 31 December 2027 falls on 1 January 2028 UTC.
    const december = birthdayReport(new Date('1964-12-31T23:30:00Z'), '1964-12-31', true, new Date('2028-06-01T00:00:00Z'));
    expect(december.solarReturn.slice(0, 10)).toBe('2028-01-01');
    expect(december.calendarYear).toBe(2027);
    expect(december.heading).toContain('(2027)');
    // 28 February stands in for 29 February in a year without one.
    expect(birthdayCalendarYear(new Date('2027-02-28T20:00:00Z'), 2, 29)).toBe(2027);
    expect(birthdayCalendarYear(new Date('2026-12-31T22:00:00Z'), 1, 1)).toBe(2027);
    expect(birthdayCalendarYear(new Date('2027-01-01T03:00:00Z'), 12, 31)).toBe(2026);
  });
});

describe('the tarot year card on the birthday report', () => {
  it('comes up Death for 42 of the 365 birthdays of 2026', () => {
    let deaths = 0;
    for (let date = new Date(Date.UTC(2026, 0, 1)); date.getUTCFullYear() === 2026; date = new Date(date.getTime() + 86_400_000)) {
      if (tarotYearCard(date.getUTCMonth() + 1, date.getUTCDate(), 2026).number === 13) deaths += 1;
    }
    expect(deaths).toBe(42);
  });
  it('never stands as a bare name: Death is "Death: change"', () => {
    expect(cardTitle(MAJOR_ARCANA[13])).toBe('Death: change');
    // 1 + 2 + 2026 = 2029 -> 13
    const report = birthdayReport(new Date('1990-01-02T12:00:00Z'), '1990-01-02', false, new Date('2026-06-01T00:00:00Z'));
    expect(report.card.number).toBe(13);
    expect(report.cardTitle).toBe('Death: change');
    expect(report.heading).toBe(`Your birthday year: Personal Year ${report.personalYear} (2026), Capricorn Sun`);
    expect(report.heading).not.toContain('Death');
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
    const withZone = birthdayReport(tokyo.birthUtc, '1990-05-03', tokyo.timeKnown, now, 'current', tokyo.sunEnds);
    const without = birthdayReport(nowhere.birthUtc, '1990-05-03', nowhere.timeKnown, now, 'current', nowhere.sunEnds);
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
    // The heading keeps the Personal Year and its civil year and never invents a Sun sign.
    expect(report.heading).toBe(`Your birthday year: Personal Year ${report.personalYear} (${report.calendarYear})`);
    for (const sign of ['Pisces', 'Aries']) expect(report.heading).not.toContain(sign);
  });
  it('reads the next birthday year with an unsettled Sun as well', () => {
    const current = birthdayReport(new Date('1990-03-20T12:00:00Z'), '1990-03-20', false, now);
    const next = birthdayReport(new Date('1990-03-20T12:00:00Z'), '1990-03-20', false, now, 'next');
    expect(next.sun).toBeNull();
    expect(next.solarReturn).toBe(current.nextSolarReturn);
    expect(next.calendarYear).toBe(current.calendarYear + 1);
    expect(next.heading).toBe(`Your birthday year: Personal Year ${next.personalYear} (${next.calendarYear})`);
  });
});

describe('the birthday report share link', () => {
  it('carries the Sun sign, the score and the tarot year card, never a date, a time, a place or a name', () => {
    const url = birthdayReportShareUrl('https://zodiacs.org', { sun: 'taurus', score: 6.44, card: 9 })!;
    expect(url).toBe('https://zodiacs.org/share/birthday-report/?s=taurus&v=6.4&t=9');
    expect([...new URL(url).searchParams.keys()]).toEqual(['s', 'v', 't']);
    expect(parseBirthdayReportShare(new URL(url).searchParams)).toEqual({ sun: 'taurus', score: 6.4, card: 9, ref: null });
    for (const query of ['s=taurus&v=6.4&py=9&t=9', 's=taurus&v=6.4&t=9&py=9', 's=taurus&v=6.4&t=9&d=05-03', 's=taurus&v=6.4&t=22', 's=taurus&v=6.4&t=9&t=9']) {
      expect(parseBirthdayReportShare(new URLSearchParams(query)), query).toBeNull();
    }
  });
  it('never puts the tarot card in a headline: Death stands in the body as "Death: change"', async () => {
    const headlines = (html: string) => [
      html.match(/<title>([^<]*)<\/title>/u)![1],
      html.match(/<meta property="og:title" content="([^"]*)"/u)![1],
      html.match(/<h1>([^<]*)<\/h1>/u)![1],
      // The alt text's first phrase.
      html.match(/<img class="card"[^>]* alt="([^".:]*)/u)![1],
    ];
    const death = await (await handleBirthdayReportLinkRequest(new Request('https://zodiacs.org/share/birthday-report/?s=capricorn&v=6.8&t=13'))).text();
    expect(headlines(death)).toEqual(['My birthday report: 6.8/10, Capricorn Sun', 'My birthday report: 6.8/10, Capricorn Sun', 'My birthday year: 6.8 out of 10, Capricorn Sun', 'My birthday report']);
    for (const line of [...headlines(death), birthdayReportImageTitle({ sun: 'capricorn', score: 6.8, card: 13, ref: null })]) expect(line).not.toContain('Death');
    expect(death).toContain('Death: change');
    expect(death).toContain('alt="My birthday report: Year Ahead Score 6.8 out of 10, Capricorn Sun. Tarot year card: Death: change."');
    expect(death).not.toMatch(/year: Death\b(?!:)/u);
    // No card names a headline.
    for (const card of MAJOR_ARCANA) {
      const html = await (await handleBirthdayReportLinkRequest(new Request(`https://zodiacs.org/share/birthday-report/?s=leo&v=5.0&t=${card.number}`))).text();
      for (const line of [...headlines(html), birthdayReportImageTitle({ sun: 'leo', score: 5, card: card.number, ref: null })]) expect(line, card.name).not.toContain(card.name);
      expect(html, card.name).toContain(cardTitle(card));
    }
  });
  it('is routed through the share function and draws a JPEG card and a page', async () => {
    expect(isResultShareRoute('birthday-report-link') && isResultShareRoute('birthday-report-image')).toBe(true);
    expect((vercel as { rewrites: unknown[] }).rewrites).toContainEqual({ source: '/share/birthday-report/', destination: '/api/compatibility?__zodiacs_share=birthday-report-link' });
    const image = await handleBirthdayReportImageRequest(new Request('https://zodiacs.org/api/og/birthday-report-image?s=leo&v=6.4&t=17'));
    expect(image.headers.get('content-type')).toBe('image/jpeg');
    const html = await (await handleBirthdayReportLinkRequest(new Request('https://zodiacs.org/share/birthday-report/?s=leo&v=6.4&t=17'))).text();
    expect(html).toContain('Tarot year card: The Star: hope.');
    expect(html).toContain('href="/birthday-report/"');
    expect(html).not.toMatch(/[–—]/u);
  }, 30_000);
});
