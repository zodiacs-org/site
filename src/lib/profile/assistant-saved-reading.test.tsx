import { describe, expect, it } from 'vitest';
import { render } from 'preact-render-to-string';
import { assistantSavedReading } from './assistant-saved-reading';
import { SavedReadingContent } from '../../islands/SavedPagesPanel';
import { buildSavedRecord } from '../../ai-tools/accounts/save';

const week = { schema: 'zodiacs.assistant-save.v1', kind: 'week', data: { from: '2026-10-16', zone: 'Europe/Madrid', items: [{ title: 'A quieter week', when: '16–18 October', line: 'Make room for rest.' }], note: 'Astrology, not a guarantee.' } };
describe('saved assistant reading', () => {
  it('opens the stored dated week, including its interpretation and caveat', () => {
    const reading = assistantSavedReading(week, 'week')!;
    const html = render(<SavedReadingContent reading={reading} />);
    for (const line of ['Week from 2026-10-16', 'Europe/Madrid', 'A quieter week', '16–18 October', 'Make room for rest.', 'Astrology, not a guarantee.']) expect(html).toContain(line);
  });
  it('does not treat stored strings as HTML or links', () => {
    const reading = assistantSavedReading({ ...week, data: { ...week.data, items: [{ title: '<img src=x onerror=alert(1)>', line: '<script>alert(1)</script>' }] } }, 'week')!;
    const html = render(<SavedReadingContent reading={reading} />);
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script');
  });
  it('refuses another kind, a future schema, missing weekly items, and oversized data', () => {
    expect(assistantSavedReading(week, 'chart')).toBeNull();
    expect(assistantSavedReading({ ...week, schema: 'zodiacs.assistant-save.v2' }, 'week')).toBeNull();
    expect(assistantSavedReading({ ...week, data: {} }, 'week')).toBeNull();
    expect(assistantSavedReading({ ...week, extra: 'x'.repeat(8193) }, 'week')).toBeNull();
  });
  it('shows an empty week honestly', () => {
    expect(assistantSavedReading({ ...week, data: { ...week.data, items: [] } }, 'week')?.sections.at(-1)?.lines).toContain('No close contacts to your chart this week.');
  });
  it('displays real chart, comparison and occasion records even without a complete website link', async () => {
    const examples = [
      { kind: 'chart', chart: { birthDate: '1990-05-03' } },
      { kind: 'comparison', comparison: { a: { birthDate: '1990-05-03' }, b: { birthDate: '1992-08-10' } } },
      { kind: 'occasion', occasion: { occasion: 'wedding', date: '2027-06-12', time: '17:00', zone: 'Europe/Rome', latitude: 43.77, longitude: 11.26, place: 'Florence' } },
    ] as const;
    for (const input of examples) {
      const record = await buildSavedRecord(input);
      expect(record).not.toHaveProperty('failure');
      const reading = assistantSavedReading(record, input.kind === 'comparison' ? 'compatibility' : input.kind);
      expect(reading?.sections.length).toBeGreaterThan(0);
      if (input.kind === 'comparison') expect(reading?.sections[0].lines.join(' ')).toMatch(/\d+\/100/);
      if (input.kind === 'occasion') expect(reading?.sections.map((x) => x.lines.join(' ')).join(' ')).toContain('17:00');
    }
  });
});
