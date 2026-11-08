import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { END, START, cardLink, firstSentence, longDate, phaseEmoji, renderCard, replaceBlock } from './sky-card.mjs';

/**
 * The Zodiacs Sky Card GitHub Action (integrations/github-sky-card/): the card
 * it writes, how it replaces the old one, and the copy rules every Zodiacs
 * surface keeps (no dashes, no crypto words, a Reading confidence label on the
 * horoscope, no personal details in its link).
 */
const SKY = {
  date: '2026-11-08', moonPhase: 'New Moon', moonSign: 'scorpio', mercuryRetrograde: true, signName: 'Scorpio',
  reading: 'Today, make your own position visible before reacting to the room. For Scorpio, depth is useful when it produces a fact.',
  confidence: 'Reading confidence 40%', signUrl: 'https://zodiacs.org/horoscopes/scorpio/?ref=assistant',
};

describe('Zodiacs Sky Card', () => {
  it('writes the date, the Moon, Mercury, the first sentence of the horoscope with its label, and the link', () => {
    const card = renderCard(SKY);
    expect(card.startsWith(START) && card.endsWith(END)).toBe(true);
    expect(card).toContain("### Today's sky, 8 November 2026");
    expect(card).toContain('🌑 **New Moon in Scorpio** · ☿ **Mercury is retrograde**');
    expect(card).toContain('**Scorpio today:** Today, make your own position visible before reacting to the room. *Reading confidence 40%*');
    expect(card).toContain('[Read the full Scorpio horoscope on Zodiacs](https://zodiacs.org/horoscopes/scorpio/?utm_source=github-sky-card)');
    expect(renderCard({ ...SKY, mercuryRetrograde: false })).toContain('☿ **Mercury is direct**');
  });

  it('replaces the card between the markers, and adds it at the end the first time', () => {
    const example = readFileSync(new URL('./example/README.md', import.meta.url), 'utf8');
    const once = replaceBlock(example, renderCard(SKY));
    expect(once.startsWith('# Example profile')).toBe(true);
    expect(once).toContain('Thanks for visiting.');
    expect(once.split(START)).toHaveLength(2);
    const twice = replaceBlock(once, renderCard({ ...SKY, date: '2026-11-09' }));
    expect(twice.split(START)).toHaveLength(2);
    expect(twice).toContain('9 November 2026');
    expect(twice).not.toContain('8 November 2026');
    expect(replaceBlock(once, renderCard(SKY))).toBe(once);
    const appended = replaceBlock('# Me\n', renderCard(SKY));
    expect(appended.startsWith('# Me\n\n<!-- zodiacs-sky:start -->')).toBe(true);
  });

  it('turns phase names into Moon emoji, dates into words, and long readings into one sentence', () => {
    expect(['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'].map(phaseEmoji).join('')).toBe('🌑🌒🌓🌔🌕🌖🌗🌘');
    expect(longDate('2027-01-05')).toBe('5 January 2027');
    expect(firstSentence('One. Two.')).toBe('One.');
    expect(firstSentence(`${'word '.repeat(80)}end.`).length).toBeLessThanOrEqual(220);
  });

  it('links to the page with its own source, keeping any # part, and nothing else', () => {
    expect(cardLink('https://zodiacs.org/horoscopes/leo/?ref=assistant')).toBe('https://zodiacs.org/horoscopes/leo/?utm_source=github-sky-card');
    expect(cardLink('https://zodiacs.org/horoscopes/leo/?ref=assistant#daily-email')).toBe('https://zodiacs.org/horoscopes/leo/?utm_source=github-sky-card#daily-email');
    expect(cardLink('https://zodiacs.org/horoscopes/leo/')).toBe('https://zodiacs.org/horoscopes/leo/?utm_source=github-sky-card');
  });

  it('keeps the copy rules in the card, the README and the action', () => {
    for (const [name, text] of [['card', renderCard(SKY)], ['README', readFileSync(new URL('./README.md', import.meta.url), 'utf8')], ['action', readFileSync(new URL('./action.yml', import.meta.url), 'utf8')]] as const) {
      expect(text, name).not.toMatch(/[\u2013\u2014]/u);
      expect(text, name).not.toMatch(/\b(?:crypto\w*|tokens?|coins?|bitcoin|blockchain|nfts?|web3|markets?|trading)\b/iu);
    }
  });
});
