import { describe, expect, it } from 'vitest';
import { CATALOG_LOCALES } from '../i18n/core';
import { CALENDAR_HOWTO, calendarHowto } from './calendar-howto';
import { returnText } from './copy';

describe('the sky calendar how-to', () => {
  it('has Google and Apple steps in every catalog language, with no long dashes', () => {
    for (const locale of CATALOG_LOCALES) {
      const howto = CALENDAR_HOWTO[locale];
      expect(howto, locale).toBeDefined();
      expect(howto.google.steps.length).toBe(3);
      expect(howto.apple.steps.length).toBe(2);
      const text = [howto.title, howto.google.name, howto.google.note, ...howto.google.steps, howto.apple.name, ...howto.apple.steps].join(' ');
      expect(text, locale).not.toMatch(/[‒-―]/u);
    }
  });

  it('names the page’s own subscribe button in the Apple step', () => {
    for (const locale of CATALOG_LOCALES) {
      expect(calendarHowto(locale).apple.steps[0], locale).toContain(returnText(locale, 'subscribe'));
    }
  });
});
