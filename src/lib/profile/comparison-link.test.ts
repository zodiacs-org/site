import { describe, expect, it } from 'vitest';
import { pairSlug } from '../compat';
import { comparisonSavedPage } from './comparison-link';
import { savedPageDraft, savedPageWriteDraft } from './saved-pages-config';

describe('comparisonSavedPage', () => {
  it('saves the sign pair page, titled with the two Sun signs only', () => {
    const draft = comparisonSavedPage('leo', 'aries');
    expect(draft).toEqual({ kind: 'compatibility', title: 'Leo and Aries · compatibility', href: '/compatibility/aries-leo/' });
    expect(draft.href).toBe(`/compatibility/${pairSlug('leo', 'aries')}/`);
    expect(savedPageDraft(draft)).toEqual(draft);
    expect(savedPageWriteDraft(draft)).toEqual(draft);
  });

  it('keeps one sign twice as one pair', () => {
    expect(comparisonSavedPage('pisces', 'pisces').href).toBe('/compatibility/pisces-pisces/');
  });

  it('falls back to the compatibility page when a Sun sign is unsettled', () => {
    for (const draft of [comparisonSavedPage(null, 'leo'), comparisonSavedPage('leo', null), comparisonSavedPage(null, null), comparisonSavedPage('nope', 'leo')]) {
      expect(draft).toEqual({ kind: 'compatibility', title: 'Compatibility reading', href: '/compatibility/' });
    }
  });

  it('never carries a fragment or a query', () => {
    for (const draft of [comparisonSavedPage('virgo', 'capricorn'), comparisonSavedPage(null, 'virgo')]) {
      expect(draft.href).not.toMatch(/[#?]/u);
    }
  });
});
