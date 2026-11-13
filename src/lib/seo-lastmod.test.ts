import { describe, expect, it } from 'vitest';
import {
  BIRTHDAY_CUSP_OG_MODIFIED_AT,
  BIRTHDAY_FAMOUS_LINE_MODIFIED_AT,
  PEOPLE_TEMPLATE_MODIFIED_AT,
  lastmodDate,
  latestModifiedAt,
  terminalResearchLastmod,
} from './seo-lastmod';

describe('SEO modification dates', () => {
  it('keeps one source-backed timestamp for schema and sitemap forms', () => {
    const modifiedAt = latestModifiedAt('2026-07-07', BIRTHDAY_CUSP_OG_MODIFIED_AT);
    expect(modifiedAt).toBe('2026-08-23T00:00:00.000Z');
    expect(lastmodDate(modifiedAt)).toBe('2026-08-23');
  });

  it('re-dates the birthday pages whose hero names who shares the date', () => {
    expect(lastmodDate(BIRTHDAY_FAMOUS_LINE_MODIFIED_AT)).toBe('2026-10-19');
    expect(lastmodDate(latestModifiedAt('2026-07-07', BIRTHDAY_CUSP_OG_MODIFIED_AT, BIRTHDAY_FAMOUS_LINE_MODIFIED_AT))).toBe('2026-10-19');
  });

  it('keeps the shared people-template revision source controlled', () => {
    expect(lastmodDate(PEOPLE_TEMPLATE_MODIFIED_AT)).toBe('2026-10-16');
    expect(lastmodDate(latestModifiedAt(
      '2026-08-02T00:00:00.000Z',
      PEOPLE_TEMPLATE_MODIFIED_AT,
    ))).toBe('2026-10-16');
  });

  it('rejects invalid dates instead of emitting fake freshness', () => {
    expect(() => latestModifiedAt('not-a-date')).toThrow(/Invalid modification date/u);
    expect(() => lastmodDate('2026-02-31')).toThrow(/Invalid modification date/u);
  });

  it('does not treat a research generator run as a page modification', () => {
    const empty = { generatedAt: '2026-08-23T07:22:03.220Z', items: [] };
    expect(terminalResearchLastmod(empty)).toBe('2026-08-13');
    expect(terminalResearchLastmod({
      ...empty,
      generatedAt: '2026-09-30T23:59:59.999Z',
    })).toBe('2026-08-13');
  });

  it('advances only for reviewed items that are published and visible', () => {
    const base = {
      generatedAt: '2026-08-23T12:00:00.000Z',
      items: [
        {
          status: 'scheduled' as const,
          publishedAt: '2026-08-22T12:00:00.000Z',
          visibleAt: '2026-08-24T00:00:00.000Z',
        },
        {
          status: 'published' as const,
          publishedAt: '2026-08-20T09:00:00.000Z',
          visibleAt: '2026-08-21T09:00:00.000Z',
        },
      ],
    };
    expect(terminalResearchLastmod(base)).toBe('2026-08-21');
  });
});
