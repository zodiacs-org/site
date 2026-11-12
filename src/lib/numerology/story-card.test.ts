import { describe, expect, it } from 'vitest';
import { lifePathPageUrl, numerologyStoryContent } from './story-card';
import { CORE_NUMBERS, NUMBER_MEANINGS } from '../../data/numerology-meanings';
import { numerologyReading } from './reading';

describe('the numerology share card', () => {
  it('carries the Life Path number, its words and its public page, for every number', () => {
    for (const number of CORE_NUMBERS) {
      const content = numerologyStoryContent(number);
      expect(content.title).toBe(`Life Path ${number}`);
      expect(content.epithet).toBe(NUMBER_MEANINGS[number].name);
      expect(content.pageUrl).toBe(`https://zodiacs.org/numerology/life-path/${number}/`);
      expect(content.address).toBe(`zodiacs.org/numerology/life-path/${number}`);
      expect(content.filename).toBe(`zodiacs-life-path-${number}.png`);
      expect(content.hue).toMatch(/^#[0-9A-F]{6}$/iu);
      expect(content.note).toContain('separate tradition from astrology');
      expect(JSON.stringify(content)).not.toMatch(/[–—]/u);
    }
  });

  it('never carries the name or birth date the number came from', () => {
    const birthDate = '1979-08-17';
    const name = 'Philippa Quennell';
    const reading = numerologyReading({ birthDate, name, year: 2026 });
    const content = numerologyStoryContent(reading.lifePath.number as 1);
    const text = JSON.stringify(content);
    for (const fragment of ['Philippa', 'Quennell', 'PHILIPPA', birthDate, '1979', '08-17', '17 August']) expect(text).not.toContain(fragment);
    expect(lifePathPageUrl(7)).not.toMatch(/[?#]/u);
  });

});
