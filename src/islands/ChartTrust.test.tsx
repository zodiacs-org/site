import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { CheckOurMath, mathInstant, ResultOpening } from './ChartTrust';
import { CATALOG_LOCALES, UI, localizePath } from '../lib/i18n';
import { homeTrustFaq, homeTrustSchema } from '../lib/home-trust';
import { isAstrologyToolPath } from '../lib/trust-boundary';

describe('chart trust receipts', () => {
  it('reports the exact computed instant without rounding, storage, or requests', () => {
    const instant = '1867-10-18T20:57:41.000Z';
    expect(mathInstant(instant)).toBe(instant);
    expect(mathInstant(new Date(instant))).toBe(instant);
    const markup = render(h(CheckOurMath, { utc: instant }));
    expect(markup).toContain(`datetime="${instant}"`);
    expect(markup).toContain('Check our math');
    expect(markup).toContain('href="/methodology/"');
  });
  it('never invents an instant for missing or malformed shared data', () => {
    for (const utc of [undefined, null, 'not-a-date']) {
      expect(mathInstant(utc)).toBeNull();
      const markup = render(h(CheckOurMath, { utc }));
      expect(markup).toContain('data-instant-basis="unavailable"');
      expect(markup).not.toContain('<time');
    }
  });
  it.each(CATALOG_LOCALES)('ships truthful labels and human openings in %s', locale => {
    for (const basis of ['birth', 'reference', 'return', 'approximate-return', 'sky-reference', 'record'] as const) {
      const markup = render(h(CheckOurMath, { locale, basis, utc: '2000-01-01T12:00:00Z' }));
      expect(markup).toContain(`href="${localizePath(locale, '/methodology/')}"`);
      expect(markup).toContain(UI[locale].trustMath);
      if (basis === 'reference') expect(markup).toContain(UI[locale].trustReference);
    }
    for (const kind of ['self', 'other', 'pair', 'return', 'saturn'] as const) {
      expect(render(h(ResultOpening, { locale, kind }))).toContain('data-result-opening');
    }
    const faq = homeTrustFaq(locale);
    expect(faq[0].a).toContain('Zodiacs.org'); expect(faq[0].a).toContain('Astrofolio');
    expect(faq[0].href).toBe(localizePath(locale, '/disclosure/'));
    expect(homeTrustSchema(locale).mainEntity[0].acceptedAnswer.text).toContain(faq[0].a);
  });
});

describe('tool branding boundary', () => {
  it.each(CATALOG_LOCALES)('keeps tool chrome separate in %s', locale => {
    for (const route of ['birth-chart', 'big-three', 'moon-sign', 'rising-sign', 'compatibility', 'solar-return', 'lunar-return', 'saturn-return', 'transits', 'moon-phase', 'numerology']) {
      expect(isAstrologyToolPath(`/${locale}/${route}/`)).toBe(true);
      expect(isAstrologyToolPath(`/${route}/`)).toBe(true);
    }
    expect(isAstrologyToolPath(`/${locale}/aries/`)).toBe(false);
    expect(isAstrologyToolPath('/astrofolio/')).toBe(false);
  });
});
