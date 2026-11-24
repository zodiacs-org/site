import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { TOOL_EXPLAINERS, explainerFaqJsonLd, type ToolExplainerKind } from './tool-explainers';

const kinds = Object.keys(TOOL_EXPLAINERS) as ToolExplainerKind[];
const allText = (kind: ToolExplainerKind) => {
  const { title, description, faq } = TOOL_EXPLAINERS[kind];
  return [title, description, ...faq.flatMap(({ q, a }) => [q, a])];
};

describe('tool page explainers', () => {
  it('covers the four thin tool pages', () => {
    expect(kinds.sort()).toEqual(['day', 'group', 'twins', 'wrapped']);
  });

  it.each(kinds)('%s: fits a search result and ends with the site name', (kind) => {
    const { title, description } = TOOL_EXPLAINERS[kind];
    expect(title.endsWith(' | Zodiacs.org')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(75);
    expect(description.length).toBeGreaterThanOrEqual(80);
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it.each(kinds)('%s: gives real answers, not a stub', (kind) => {
    const { faq } = TOOL_EXPLAINERS[kind];
    expect(faq.length).toBeGreaterThanOrEqual(4);
    const words = faq.reduce((sum, { a }) => sum + a.split(/\s+/u).length, 0);
    expect(words).toBeGreaterThanOrEqual(150);
    for (const { q, a } of faq) {
      expect(q.endsWith('?')).toBe(true);
      expect(a.length).toBeGreaterThan(60);
    }
  });

  it.each(kinds)('%s: follows the copy rules', (kind) => {
    for (const text of allText(kind)) {
      expect(text).not.toMatch(/[–—]/u);
      expect(text).not.toMatch(/\b(guarantee|predicts?|accurate horoscope|token|crypto|coin|invest)/iu);
      expect(text).not.toMatch(/\bnot vibes\b|\bshows its work\b|\bproperly\b/iu);
    }
  });

  it.each(kinds)('%s: structured data repeats the visible answers word for word', (kind) => {
    const data = explainerFaqJsonLd(kind);
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity.map((entry) => [entry.name, entry.acceptedAnswer.text]))
      .toEqual(TOOL_EXPLAINERS[kind].faq.map(({ q, a }) => [q, a]));
  });

  it('renders only on the English routes', async () => {
    const sharing = await readFile(new URL('../../components/sharing/SharingToolPage.astro', import.meta.url), 'utf8');
    const returns = await readFile(new URL('../../components/return-visits/ReturnToolPage.astro', import.meta.url), 'utf8');
    const day = await readFile(new URL('../../components/return-visits/ChartOfDayPage.astro', import.meta.url), 'utf8');
    expect(sharing).toContain("locale === 'en' && (kind === 'group' || kind === 'twins')");
    expect(returns).toContain("kind === 'wrapped' && locale === 'en'");
    expect(day).toContain("!edition && locale === 'en'");
  });
});
