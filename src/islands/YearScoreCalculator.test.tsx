import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { READING_CONFIDENCE_NOTE } from '../lib/reading-confidence-note';
import { confidenceLabel, ScoreMeta } from './YearScoreCalculator';

const base = { from: '2026-11-16', to: '2027-11-15' };
const count = (html: string, text: string) => html.split(text).length - 1;

describe('the Year Ahead Score result meta', () => {
  it('prints the note once, after the label, with a settled Sun sign', () => {
    const html = render(<ScoreMeta result={{ ...base, sign: { name: 'Taurus', slug: 'taurus' }, candidates: [], confidence: confidenceLabel(false) }} />);
    expect(count(html, 'Reading confidence 55%')).toBe(1);
    expect(count(html, READING_CONFIDENCE_NOTE)).toBe(1);
    expect(html.indexOf(READING_CONFIDENCE_NOTE)).toBeGreaterThan(html.indexOf('Reading confidence 55%'));
  });

  it('prints the note once, after the label, when the birth day spans two signs', () => {
    const html = render(<ScoreMeta result={{ ...base, sign: null, candidates: ['Aries', 'Taurus'], confidence: confidenceLabel(true) }} />);
    expect(count(html, 'Reading confidence 70%')).toBe(1);
    expect(count(html, READING_CONFIDENCE_NOTE)).toBe(1);
    expect(html.indexOf(READING_CONFIDENCE_NOTE)).toBeGreaterThan(html.indexOf('Reading confidence 70%'));
  });
});
