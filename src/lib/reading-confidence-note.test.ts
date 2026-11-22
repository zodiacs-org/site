import { expect, it } from 'vitest';
import { readingConfidence } from '../ai-tools/reading-confidence';
import { CONTACT_CONFIDENCE_NOTE, READING_CONFIDENCE_NOTE } from './reading-confidence-note';

it('explains the same date and timed-place percentages the readings use', () => {
  expect(READING_CONFIDENCE_NOTE).toContain(
    `${readingConfidence('date')}% for a date alone, ${readingConfidence('timed-place')}% for a date, time and place.`,
  );
  expect(CONTACT_CONFIDENCE_NOTE).toBe(`${READING_CONFIDENCE_NOTE} A contact within one degree adds five.`);
  for (const detail of ['date', 'timed-place'] as const) {
    expect(readingConfidence(detail, true) - readingConfidence(detail)).toBe(5);
  }
});
