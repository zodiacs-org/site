import { describe, expect, it } from 'vitest';
import { LIVING_PAYLOAD_CASES, SAVED_PAGE_CASES } from './export-shapes.cases';
import {
  jsonbTextBytes,
  livingChartPayloadValid,
  savedPageDetailValid,
  savedPageHrefValid,
  savedPageSourceKindValid,
  savedPageSummaryValid,
  savedPageTitleValid,
} from './export-shapes';

function savedPageValid(row: Record<string, unknown>): boolean {
  return savedPageSourceKindValid(row.source, row.kind)
    && savedPageTitleValid(row.title)
    && savedPageHrefValid(row.href, row.kind)
    && (row.source === 'site'
      ? row.summary === null && row.detail === null
      : savedPageSummaryValid(row.summary) && savedPageDetailValid(row.detail));
}

describe('account export shapes', () => {
  it.each(LIVING_PAYLOAD_CASES)('Living Chart payload: $name', ({ payload, valid }) => {
    expect(livingChartPayloadValid(payload)).toBe(valid);
  });

  it.each(SAVED_PAGE_CASES)('saved page: $name', ({ row, valid }) => {
    expect(savedPageValid(row)).toBe(valid);
  });

  it('measures jsonb text as PostgreSQL prints it', () => {
    // octet_length('{"data": "x", "schema": "zodiacs.assistant-save.v1"}'::jsonb::text)
    expect(jsonbTextBytes({ schema: 'zodiacs.assistant-save.v1', data: 'x' })).toBe(52);
    // octet_length('{"a": [1, 2], "b": {}, "c": "\u{1F319}"}'::jsonb::text)
    expect(jsonbTextBytes({ a: [1, 2], b: {}, c: '\u{1F319}' })).toBe(35);
    expect(jsonbTextBytes([])).toBe(2);
    expect(jsonbTextBytes({})).toBe(2);
    expect(jsonbTextBytes(null)).toBe(4);
  });
});
