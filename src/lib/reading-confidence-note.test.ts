import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readingConfidence, readingConfidenceLabel } from '../ai-tools/reading-confidence';
import { confidenceLabel } from '../islands/YearScoreCalculator';
import { READING_CONFIDENCE_NOTE } from './reading-confidence-note';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('the reading-confidence note', () => {
  it('quotes the date-only and the timed-with-place values the rule gives', () => {
    expect(READING_CONFIDENCE_NOTE).toContain(`${readingConfidence('date')}% for a date alone`);
    expect(READING_CONFIDENCE_NOTE).toContain(`${readingConfidence('timed-place')}% for a date, time and place`);
  });

  it('covers every value the Year Ahead Score calculator can print, which restates the rule', () => {
    expect(confidenceLabel(false)).toBe(readingConfidenceLabel('date'));
    expect(confidenceLabel(true)).toBe(readingConfidenceLabel('timed-place'));
  });

  it('says the label is not a probability, in plain punctuation', () => {
    expect(READING_CONFIDENCE_NOTE).toContain('It is not the chance that anything happens.');
    expect(READING_CONFIDENCE_NOTE).not.toMatch(/[\u2013\u2014]/u);
  });

  it('is the answer to the year-score FAQ question, so the visible FAQ and FAQPage JSON-LD carry it', () => {
    const page = source('../pages/year-score/index.astro');
    expect(page).toContain("import { READING_CONFIDENCE_NOTE } from '../../lib/reading-confidence-note';");
    expect(page).toMatch(/q: 'What does reading confidence mean\?',\s*a: READING_CONFIDENCE_NOTE,/u);
  });

  it('is printed under the label on a figure\'s Year Ahead page, which carries no other values than the date-only one', () => {
    const page = source('../pages/year/[slug].astro');
    const label = page.indexOf('Reading confidence 55%');
    const note = page.indexOf('{READING_CONFIDENCE_NOTE}');
    expect(label).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(label);
    expect(page.split('{READING_CONFIDENCE_NOTE}')).toHaveLength(2);
    expect(page).toContain(`Reading confidence ${readingConfidence('date')}%`);
  });
});
