/**
 * Cases for export-shapes.test.ts. Each `valid` value is what the database
 * itself answers: living_chart_private.living_chart_payload_valid for a
 * payload, and an insert into public.saved_pages (with its constraints) for a
 * saved page. They were checked against PostgreSQL 17 with every migration
 * applied; rerun that check when either side changes. Synthetic values only.
 */

const CHART_ID = '99999999-9999-4999-8999-999999999991';

export const VALID_LIVING_PAYLOAD = {
  schema: 'zodiacs.living-chart.cloud-moment.v1',
  primaryChartId: CHART_ID,
  occurredAt: '2026-08-18T09:00:00.000Z',
  timePrecision: 'exact',
  category: 'relationships',
  note: 'A useful conversation.',
  forecast: {
    schema: 'zodiacs.living-chart.today-forecast.v1',
    editionDate: '2026-08-18',
    chartId: CHART_ID,
    source: 'personalized',
    generatorVersion: 'today-1.0.0',
    capturedAt: '2026-08-18T08:00:00.000Z',
    lines: [{
      id: 'transit:mars-moon',
      text: 'Make room before answering too quickly.',
      receipt: 'Mars 14.2 degrees Cancer square natal Moon.',
    }],
  },
  reflectionQuestionId: 'reflection:notice',
} as const;

type Payload = Record<string, unknown>;
const base = (): Payload => structuredClone(VALID_LIVING_PAYLOAD) as unknown as Payload;
const withForecast = (change: Payload): Payload => {
  const payload = base();
  payload.forecast = { ...(payload.forecast as Payload), ...change };
  return payload;
};
const withLine = (change: Payload): Payload => {
  const forecast = base().forecast as Payload;
  return withForecast({ lines: [{ ...(forecast.lines as Payload[])[0], ...change }] });
};
const without = (key: string): Payload => {
  const payload = base();
  delete payload[key];
  return payload;
};

export const LIVING_PAYLOAD_CASES: Array<{ name: string; payload: unknown; valid: boolean }> = [
  { name: 'the full payload', payload: base(), valid: true },
  { name: 'note only', payload: without('category'), valid: true },
  { name: 'category only', payload: without('note'), valid: true },
  { name: 'date only', payload: { ...base(), timePrecision: 'date_only', occurredAt: '2026-08-18' }, valid: true },
  { name: 'a multi-line note with a tab', payload: { ...base(), note: 'First line\n\tsecond line' }, valid: true },
  { name: 'three lines', payload: withForecast({ lines: [1, 2, 3].map((n) => ({ id: `line:${n}`, text: 'Text.', receipt: 'Receipt.' })) }), valid: true },
  { name: 'an emoji note at 500 code points', payload: { ...base(), note: '\u{1F319}'.repeat(500) }, valid: true },
  { name: 'empty object', payload: {}, valid: false },
  { name: 'schema and note only', payload: { schema: 'zodiacs.living-chart.cloud-moment.v1', note: 'A useful conversation.' }, valid: false },
  { name: 'an unknown key', payload: { ...base(), extra: true }, valid: false },
  { name: 'neither category nor note', payload: (() => { const p = without('note'); delete p.category; return p; })(), valid: false },
  { name: 'an unknown category', payload: { ...base(), category: 'money' }, valid: false },
  { name: 'an uppercase chart id', payload: (() => {
    const upper = 'ABCDEF12-3456-4ABC-8DEF-123456789ABC';
    return { ...withForecast({ chartId: upper }), primaryChartId: upper };
  })(), valid: false },
  { name: 'an instant without milliseconds', payload: { ...base(), occurredAt: '2026-08-18T09:00:00Z' }, valid: false },
  { name: 'a date for an exact time', payload: { ...base(), occurredAt: '2026-08-18' }, valid: false },
  { name: 'February 30', payload: { ...base(), timePrecision: 'date_only', occurredAt: '2026-02-30' }, valid: false },
  { name: 'a year before 1800', payload: { ...base(), timePrecision: 'date_only', occurredAt: '1799-12-31' }, valid: false },
  { name: 'a note with a leading space', payload: { ...base(), note: ' A note.' }, valid: false },
  { name: 'a note ending in a newline', payload: { ...base(), note: 'A note.\n' }, valid: false },
  { name: 'a note with a carriage return', payload: { ...base(), note: 'A\rnote.' }, valid: false },
  { name: 'a note with a zero-width space', payload: { ...base(), note: 'A​note.' }, valid: false },
  { name: 'a note of 501 code points', payload: { ...base(), note: 'x'.repeat(501) }, valid: false },
  { name: 'a non-string note', payload: { ...base(), note: 5 }, valid: false },
  { name: 'a bad reflection id', payload: { ...base(), reflectionQuestionId: '-notice' }, valid: false },
  { name: 'a forecast for another chart', payload: withForecast({ chartId: '99999999-9999-4999-8999-999999999992' }), valid: false },
  { name: 'an unknown forecast source', payload: withForecast({ source: 'oracle' }), valid: false },
  { name: 'an extra forecast key', payload: withForecast({ extra: 1 }), valid: false },
  { name: 'no forecast lines', payload: withForecast({ lines: [] }), valid: false },
  { name: 'four forecast lines', payload: withForecast({ lines: [1, 2, 3, 4].map((n) => ({ id: `line:${n}`, text: 'Text.', receipt: 'Receipt.' })) }), valid: false },
  { name: 'duplicate line ids', payload: withForecast({ lines: [1, 2].map(() => ({ id: 'line:1', text: 'Text.', receipt: 'Receipt.' })) }), valid: false },
  { name: 'a line with a tab', payload: withLine({ text: 'Make\troom.' }), valid: false },
  { name: 'a line with an extra key', payload: withLine({ extra: 'x' }), valid: false },
  { name: 'an empty receipt', payload: withLine({ receipt: '' }), valid: false },
  { name: 'a receipt of 801 code points', payload: withLine({ receipt: 'x'.repeat(801) }), valid: false },
  { name: 'a bad generator version', payload: withForecast({ generatorVersion: 'today 1' }), valid: false },
  { name: 'a capture time without milliseconds', payload: withForecast({ capturedAt: '2026-08-18T08:00:00Z' }), valid: false },
  { name: 'an array', payload: [base()], valid: false },
];

const SITE_ROW = {
  kind: 'occasion',
  title: 'A saved card',
  href: '/occasions/example/',
  source: 'site',
  summary: null,
  detail: null,
};
const ASSISTANT_ROW = {
  kind: 'week',
  title: 'A week ahead',
  href: '/horoscopes/aries/',
  source: 'assistant',
  summary: 'A calm week for plans.',
  detail: { schema: 'zodiacs.assistant-save.v1', result: { headline: 'Plans' } },
};

// `database` is given only where the table answers differently from the
// export. saved_pages_assistant_detail compares detail->>'schema' with the
// schema name, which is NULL for a detail without a schema, and a check that
// is NULL passes; the export still refuses such a detail.
export const SAVED_PAGE_CASES: Array<{
  name: string;
  row: Record<string, unknown>;
  valid: boolean;
  database?: boolean;
}> = [
  { name: 'a site row', row: SITE_ROW, valid: true },
  { name: 'an assistant row', row: ASSISTANT_ROW, valid: true },
  { name: 'a localized compatibility link', row: { ...SITE_ROW, kind: 'compatibility', href: '/es/compatibility/aries-tauro/' }, valid: true },
  { name: 'an assistant chart link to a person', row: { ...ASSISTANT_ROW, kind: 'chart', href: '/people/example/' }, valid: true },
  { name: 'an emoji title at 160 code points', row: { ...SITE_ROW, title: '✨'.repeat(80) + '\u{1F319}'.repeat(80) }, valid: true },
  { name: 'a summary at 600 code points', row: { ...ASSISTANT_ROW, summary: '\u{1F319}'.repeat(600) }, valid: true },
  { name: 'a detail just inside 16384 bytes of jsonb text', row: { ...ASSISTANT_ROW, detail: { schema: 'zodiacs.assistant-save.v1', data: 'x'.repeat(16_384 - 51) } }, valid: true },
  { name: 'a detail just over 16384 bytes of jsonb text', row: { ...ASSISTANT_ROW, detail: { schema: 'zodiacs.assistant-save.v1', data: 'x'.repeat(16_384 - 50) } }, valid: false },
  { name: 'an empty detail', row: { ...ASSISTANT_ROW, detail: {} }, valid: false, database: true },
  { name: 'a detail of another schema', row: { ...ASSISTANT_ROW, detail: { schema: 'zodiacs.assistant-save.v2' } }, valid: false },
  { name: 'an array detail', row: { ...ASSISTANT_ROW, detail: [] }, valid: false },
  { name: 'an assistant row without a summary', row: { ...ASSISTANT_ROW, summary: null }, valid: false },
  { name: 'a summary with markup', row: { ...ASSISTANT_ROW, summary: 'A <b>bold</b> week.' }, valid: false },
  { name: 'a summary of 601 code points', row: { ...ASSISTANT_ROW, summary: 'x'.repeat(601) }, valid: false },
  { name: 'a site row with a summary', row: { ...SITE_ROW, summary: 'No.' }, valid: false },
  { name: 'a site row of an assistant-only kind', row: { ...SITE_ROW, kind: 'week', href: '/horoscopes/aries/' }, valid: false },
  { name: 'a kind and path that disagree', row: { ...SITE_ROW, href: '/compatibility/aries-taurus/' }, valid: false },
  { name: 'an absolute link', row: { ...SITE_ROW, href: 'https://example.com/occasions/' }, valid: false },
  { name: 'a protocol-relative link', row: { ...SITE_ROW, href: '//occasions/' }, valid: false },
  { name: 'a link with a space', row: { ...SITE_ROW, href: '/occasions/a b/' }, valid: false },
  { name: 'a link with a backslash', row: { ...SITE_ROW, href: '/occasions/a\\b/' }, valid: false },
  { name: 'an empty title', row: { ...SITE_ROW, title: '' }, valid: false },
  { name: 'a title with a newline', row: { ...SITE_ROW, title: 'A\ncard' }, valid: false },
  { name: 'a title of 161 code points', row: { ...SITE_ROW, title: 'x'.repeat(161) }, valid: false },
  { name: 'an unknown source', row: { ...SITE_ROW, source: 'import' }, valid: false },
];
