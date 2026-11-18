import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import * as reportModule from '../lib/birthday-report/report';
import { parseBirthdayReportShare } from '../lib/birthday-report/share';
import { openingYear, openReport, ReportResult, scoreTitle, switchYear, YearChoice, type ReportState } from './BirthdayReport';

const DAY = 86_400_000;
const ORIGIN = 'https://zodiacs.org';
/** Some ICU releases space dates with no-break spaces. */
const plain = (text: string) => text.replace(/[  ]/g, ' ');
const birth = (date: string) => ({ utc: new Date(`${date}T12:00:00Z`), date, timeKnown: false });
const shared = (state: ReportState) => {
  const url = new URL(state.share!);
  return { path: url.pathname, keys: [...url.searchParams.keys()], share: parseBirthdayReportShare(url.searchParams) };
};
const pressed = (html: string) => [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/gu)].map((match) => [plain(match[2]), match[1]]);

describe('the birthday year the report opens on', () => {
  it('is the next one when its solar return is 45 days away or less', () => {
    const next = '2026-12-01T10:00:00.000Z';
    const at = (gap: number) => new Date(Date.parse(next) - gap);
    expect(openingYear(next, at(45 * DAY))).toBe('next');
    expect(openingYear(next, at(45 * DAY + 1))).toBe('current');
    expect(openingYear(next, at(0))).toBe('next');
    expect(openingYear(next, at(200 * DAY))).toBe('current');
  });

  it('calls the score the year ahead until the window is more than 30 days old', () => {
    const opened = '2026-05-03T09:00:00.000Z';
    const at = (gap: number) => new Date(Date.parse(opened) + gap);
    expect(scoreTitle(opened, at(-20 * DAY))).toBe('Year Ahead Score');
    expect(scoreTitle(opened, at(0))).toBe('Year Ahead Score');
    expect(scoreTitle(opened, at(30 * DAY))).toBe('Year Ahead Score');
    expect(scoreTitle(opened, at(30 * DAY + 1))).toBe('Year score');
  });
});

describe('the year buttons and the share link', () => {
  const now = new Date('2026-11-10T12:00:00Z');

  it('opens a birthday 21 days away on the year it starts, and switches back and forth on the device', () => {
    const near = openReport(reportModule, birth('1990-12-01'), null, now, ORIGIN);
    expect(near.which).toBe('next');
    expect(near.data.solarReturn).toBe(near.returns.next);
    expect(near.returns.current.slice(0, 4)).toBe('2025');
    expect(near.returns.next.slice(0, 4)).toBe('2026');
    expect(shared(near)).toEqual({ path: '/share/birthday-report/', keys: ['s', 'v', 't'], share: { sun: 'sagittarius', score: Number(near.data.year.score.toFixed(1)), card: near.data.card.number, ref: null } });

    const back = switchYear(reportModule, near, 'current', ORIGIN);
    expect(back.which).toBe('current');
    expect(back.returns).toEqual(near.returns);
    expect(back.data.solarReturn).toBe(near.returns.current);
    expect(back.data.calendarYear).toBe(2025);
    expect(shared(back)).toEqual({ path: '/share/birthday-report/', keys: ['s', 'v', 't'], share: { sun: 'sagittarius', score: Number(back.data.year.score.toFixed(1)), card: back.data.card.number, ref: null } });
    expect(back.share).not.toBe(near.share);

    const again = switchYear(reportModule, back, 'next', ORIGIN);
    expect(again.data).toEqual(near.data);
    expect(again.share).toBe(near.share);
    expect(switchYear(reportModule, again, 'next', ORIGIN)).toBe(again);
  });

  it('opens a birthday months away on the year in progress', () => {
    const far = openReport(reportModule, birth('1990-05-03'), null, now, ORIGIN);
    expect(far.which).toBe('current');
    expect(far.data.solarReturn).toBe(far.returns.current);
    expect(far.returns.current.slice(0, 4)).toBe('2026');
  });

  it('marks the chosen year with aria-pressed and names both return dates', () => {
    const near = openReport(reportModule, birth('1990-12-01'), null, now, ORIGIN);
    const [currentLabel, nextLabel] = pressed(render(<YearChoice state={near} onChoose={() => {}} />)).map(([label]) => label);
    expect(currentLabel).toMatch(/^Year from (30 November|1 December) 2025$/u);
    expect(nextLabel).toMatch(/^Year from (30 November|1 December) 2026$/u);
    expect(pressed(render(<YearChoice state={near} onChoose={() => {}} />))).toEqual([[currentLabel, 'false'], [nextLabel, 'true']]);
    const back = switchYear(reportModule, near, 'current', ORIGIN);
    expect(pressed(render(<YearChoice state={back} onChoose={() => {}} />))).toEqual([[currentLabel, 'true'], [nextLabel, 'false']]);
  });

  it('reserves the row before there is a report: hidden, disabled, and not pressed', () => {
    const html = render(<YearChoice state={null} onChoose={() => {}} />);
    expect(html).toContain('data-ready="false"');
    expect(html).toContain('aria-hidden="true"');
    expect(html.match(/<button[^>]*disabled/gu)).toHaveLength(2);
    expect(html).not.toContain('aria-pressed');
  });

  it('draws the chosen year in the result, with its share link and score title', () => {
    const near = openReport(reportModule, birth('1990-12-01'), null, now, ORIGIN);
    const nearHtml = plain(render(<ReportResult state={near} yearScoreLink={false} />));
    expect(nearHtml).toContain(`href="${near.share!.replaceAll('&', '&amp;')}"`);
    expect(nearHtml).toContain('<h3>Year Ahead Score</h3>');
    expect(nearHtml).toContain('your next birthday year begins');
    expect(nearHtml).toContain(`Numerology: Personal Year ${near.data.personalYear} (2026)`);

    const back = switchYear(reportModule, near, 'current', ORIGIN);
    const backHtml = plain(render(<ReportResult state={back} yearScoreLink={false} />));
    expect(backHtml).toContain(`href="${back.share!.replaceAll('&', '&amp;')}"`);
    expect(backHtml).toContain('<h3>Year score</h3>');
    expect(backHtml).toContain('your birthday year began');
    expect(backHtml).toContain(`Numerology: Personal Year ${back.data.personalYear} (2025)`);
  });
});

describe('a date-only birth on the day the Sun changes sign', () => {
  const now = new Date('2026-11-10T12:00:00Z');

  it('names both signs, never one, and offers no share link in either birthday year', () => {
    const state = openReport(reportModule, birth('1990-03-20'), null, now, ORIGIN);
    for (const year of [state, switchYear(reportModule, state, state.which === 'current' ? 'next' : 'current', ORIGIN)]) {
      expect(year.data.sun).toBeNull();
      expect(year.share).toBeNull();
      expect(year.data.heading).toBe(`Your birthday year: Personal Year ${year.data.personalYear} (${year.data.calendarYear})`);
      const html = plain(render(<ReportResult state={year} yearScoreLink={false} />));
      expect(html).toContain('Your Sun is in Pisces or Aries: a birth time settles it.');
      expect(html).not.toContain('Share my birthday report');
      expect(html).not.toMatch(/(Pisces|Aries) Sun/u);
      expect(html).toContain(year.data.cardTitle);
      // The page still takes a tint: the sign of the Sun the report was cast from.
      expect(year.data.hue).toMatch(/^#/u);
    }
  });

  it('gives an untimed return as a date, and a timed one on the birthplace clock, named', async () => {
    const untimed = openReport(reportModule, birth('1990-05-03'), null, now, ORIGIN);
    const untimedHtml = plain(render(<ReportResult state={untimed} yearScoreLink={false} />));
    const line = untimedHtml.match(/data-br-return[^>]*>([^<]*)</u)![1];
    expect(line).toMatch(/^Around \d{1,2} May 2026$/u);
    expect(untimedHtml).toContain('Without a birth time this can be a day either side.');

    const { prepareLocalTime, resolveLocalToUtc } = await import('../lib/time/localToUtc');
    await prepareLocalTime('1990-05-03', 'Asia/Tokyo');
    const timedBirth = reportModule.reportInstants({ date: '1990-05-03', time: '08:30', place: { tz: 'Asia/Tokyo', lon: 139.69 } }, { resolveLocalToUtc });
    const timed = openReport(reportModule, { utc: timedBirth.birthUtc, date: '1990-05-03', timeKnown: true, sunEnds: timedBirth.sunEnds }, 'Asia/Tokyo', now, ORIGIN);
    const timedHtml = plain(render(<ReportResult state={timed} yearScoreLink={false} />));
    expect(timedHtml.match(/data-br-return[^>]*>([^<]*)</u)![1]).toMatch(/^\d{1,2} May 2026(,| at)? \d{2}:\d{2} \(Asia\/Tokyo, your birthplace's clock\)$/u);
    expect(timedHtml).not.toContain('Without a birth time');
    expect(shared(timed).share?.sun).toBe('taurus');
  });
});
