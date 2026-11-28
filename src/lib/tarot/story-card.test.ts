import { describe, expect, it } from 'vitest';
import { tarotPageUrl, tarotStoryContent } from './story-card';
import { drawTarotReading, readCard } from './reading';
import { SPREAD_IDS, SPREADS } from './spreads';
import { TAROT_DECK } from './deck';

describe('the tarot share card', () => {
  it('carries the cards drawn, in their places, and a link to the tarot page', () => {
    for (const spread of SPREAD_IDS) {
      const cards = drawTarotReading(spread);
      const content = tarotStoryContent(spread, cards);
      expect(content.rows.map((row) => row.name)).toEqual(cards.map((card) => card.card.name));
      expect(content.rows.map((row) => row.position)).toEqual(SPREADS[spread].positions.map((position) => position.name));
      for (const row of content.rows) expect(row.hue).toMatch(/^#[0-9A-F]{6}$/iu);
      expect(content.address).toBe('zodiacs.org/tarot');
      expect(content.note).toContain('separate practice from astrology');
      expect(content.filename).toBe(`zodiacs-tarot-${spread}.png`);
      expect(JSON.stringify(content)).not.toMatch(/[–—]/u);
    }
  });

  it('links one card to its own entry on the tarot page, and a spread to the page', () => {
    const fool = readCard({ position: SPREADS['one-card'].positions[0], card: TAROT_DECK[0], orientation: 'reversed' });
    const one = tarotStoryContent('one-card', [fool]);
    expect(one.pageUrl).toBe('https://zodiacs.org/tarot/#the-fool');
    expect(one.meaning).toBe(fool.meaning);
    expect(one.shareText).toBe('I drew The Fool (reversed) on Zodiacs.');
    expect(tarotPageUrl(drawTarotReading('three-card'))).toBe('https://zodiacs.org/tarot/');
    // The page has an entry for every card the one-card link can name.
    for (const card of TAROT_DECK) expect(tarotPageUrl([{ card }])).toBe(`https://zodiacs.org/tarot/#${card.id}`);
  });
});
