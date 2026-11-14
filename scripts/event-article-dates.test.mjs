import { describe, expect, it } from 'vitest';
import { eventArticleDateFailures, eventUpdatedDay } from './event-article-dates.mjs';

const receipt = { lastModified: '2026-09-06' };
const article = { dateModified: '2026-09-06T00:00:00.000Z' };
describe('event Article date receipt', () => {
  it('requires the documented revision while omitting an unknown first publication', () => {
    expect(eventArticleDateFailures(article, receipt)).toEqual([]);
    expect(eventArticleDateFailures({}, receipt)).not.toEqual([]);
    expect(eventArticleDateFailures({ dateModified: '2026-07-20T00:00:00.000Z' }, receipt)).not.toEqual([]);
  });
  it('rejects invented or null publication dates and missing receipts', () => {
    for (const datePublished of ['2026-07-20', null, '']) {
      expect(eventArticleDateFailures({ ...article, datePublished }, receipt)).not.toEqual([]);
    }
    expect(eventArticleDateFailures(article, undefined)).not.toEqual([]);
  });
  it('requires a documented publication date exactly when one exists', () => {
    const known = { ...receipt, publishedAt: '2026-08-31T09:00:00.000Z' };
    expect(eventArticleDateFailures(article, known)).not.toEqual([]);
    expect(eventArticleDateFailures({ ...article, datePublished: known.publishedAt }, known)).toEqual([]);
  });
  it('dates a page that prints an Updated day from that day', () => {
    const html = '<p class="event-updated" data-event-updated>Updated <time datetime="2026-11-14">November 14, 2026</time></p>';
    expect(eventUpdatedDay(html)).toBe('2026-11-14');
    expect(eventUpdatedDay('<p>Updated <time datetime="2026-11-14">November 14, 2026</time></p>')).toBeUndefined();
    const updated = { dateModified: '2026-11-14T00:00:00.000Z' };
    expect(eventArticleDateFailures(updated, receipt, '2026-11-14')).toEqual([]);
    // The receipt's own day no longer passes once the page prints a later one.
    expect(eventArticleDateFailures(article, receipt, '2026-11-14')).not.toEqual([]);
    // An Updated day before the receipt, or one that is not a calendar day, fails.
    expect(eventArticleDateFailures({ dateModified: '2026-09-01T00:00:00.000Z' }, receipt, '2026-09-01')).not.toEqual([]);
    expect(eventArticleDateFailures({ dateModified: '2026-11-31T00:00:00.000Z' }, receipt, '2026-11-31')).not.toEqual([]);
  });
  it('rejects normalized calendar dates in revision receipts', () => {
    expect(eventArticleDateFailures({ dateModified: '2026-02-30T00:00:00.000Z' }, { lastModified: '2026-02-30' })).not.toEqual([]);
  });
});
