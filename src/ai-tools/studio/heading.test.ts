import { describe, expect, it } from 'vitest';
import { birthClock, birthDate, chartHeading, EXAMPLE_HEADING } from './heading';
import { localStudioInput } from './local-time';
import { calculateStudio, EXAMPLE, selectionContext, recordText } from './model';

describe('Chart Studio header', () => {
  it('writes the date and clock time as people write them', () => {
    expect(birthDate('1992-03-14')).toBe('14 March 1992');
    expect(birthDate('1800-01-01')).toBe('1 January 1800');
    expect(['09:30', '00:05', '12:00', '13:45', '23:59:59.999'].map(birthClock)).toEqual(['9:30 am', '12:05 am', '12:00 pm', '1:45 pm', '11:59 pm']);
  });

  it('says "Birth time unknown" instead of any time', () => {
    const input = { ...EXAMPLE, date: '1992-03-14', time: '12:00', timeKnown: false, latitude: '', longitude: '' };
    const heading = chartHeading(input, calculateStudio(input).inputSnapshot.utc);
    expect(heading).toEqual({ text: '14 March 1992 · Birth time unknown', dateTime: '1992-03-14' });
    expect(heading.text).not.toMatch(/12:00|midday|noon|UTC/);
  });

  it('uses the local date, clock time and city the person entered, not the converted instant', async () => {
    // 00:30 in Bangkok is still the previous day in UTC.
    const converted = await localStudioInput({ date: '1992-03-14', time: '00:30', zone: 'Asia/Bangkok', latitude: '13.75', longitude: '100.52' }, 'placidus');
    expect(converted.utc).toBe('1992-03-13T17:30:00.000Z');
    const input = { ...converted.input, place: 'Bangkok, Bangkok, Thailand' };
    const run = calculateStudio(input);
    expect(chartHeading(input, run.inputSnapshot.utc)).toEqual({ text: '14 March 1992 · 12:30 am · Bangkok, Bangkok, Thailand', dateTime: '1992-03-13T17:30:00.000Z' });
    expect(chartHeading(converted.input, run.inputSnapshot.utc).text).toBe('14 March 1992 · 12:30 am');
    // The place name is for the header only.
    expect(run).toEqual(calculateStudio(converted.input));
    expect(recordText(run)).not.toContain('Thailand');
    expect(selectionContext(run, { kind: 'body', body: 'Sun' })).not.toContain('Thailand');
  });

  it('keeps UTC only where the person typed UTC', () => {
    const input = { ...EXAMPLE, date: '1992-03-14', time: '09:30' };
    expect(chartHeading(input, calculateStudio(input).inputSnapshot.utc).text).toBe('14 March 1992 · 9:30 am UTC');
  });

  it('labels the example in London clock time', () => {
    const utc = calculateStudio(EXAMPLE).inputSnapshot.utc;
    expect(EXAMPLE_HEADING.dateTime).toBe(utc);
    const london = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(utc));
    expect(london).toBe('15 June 1990 at 1:00 pm');
    expect(EXAMPLE_HEADING.text).toBe('15 June 1990 · 1:00 pm · London');
  });
});
