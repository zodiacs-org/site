import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import TarotCard from './TarotCard';
import { drawTarotReading, readCard } from '../lib/tarot/reading';
import { TAROT_DECK } from '../lib/tarot/deck';
import { SPREADS } from '../lib/tarot/spreads';
import { TAROT_MEANINGS } from '../lib/tarot/meanings';

const fool = (orientation: 'upright' | 'reversed') => readCard({ position: SPREADS['one-card'].positions[0], card: TAROT_DECK[0], orientation });

describe('the reusable tarot reading', () => {
  it('joins a drawn card to its upright or reversed words', () => {
    expect(fool('upright')).toEqual({
      position: { key: 'focus', name: 'The card', prompt: SPREADS['one-card'].positions[0].prompt },
      card: { id: 'the-fool', name: 'The Fool', arcana: 'major', suit: null, number: 0 },
      orientation: 'upright', keywords: [...TAROT_MEANINGS['the-fool'].keywords],
      meaning: TAROT_MEANINGS['the-fool'].upright, question: TAROT_MEANINGS['the-fool'].question,
    });
    expect(fool('reversed').meaning).toBe(TAROT_MEANINGS['the-fool'].reversed);
  });

  it('draws one card by default, and any spread at full size', () => {
    expect(drawTarotReading()).toHaveLength(1);
    expect(drawTarotReading('celtic-cross', false).map((card) => card.orientation)).toEqual(new Array(10).fill('upright'));
  });
});

describe('<TarotCard>', () => {
  it('renders the card as text with its suit icon, position, reading and question', () => {
    const html = render(h(TarotCard, { reading: fool('reversed') }));
    expect(html).toMatch(/^<li class="tile tarot__card"/u);
    expect(html).toContain('<h3 class="tarot__name">The Fool</h3>');
    expect(html).toContain('tarot__icon tarot__icon--reversed');
    expect(html).toContain('Reversed · first step · openness · trust · risk');
    expect(html).toContain('The card</span>');
    expect(html).toContain(TAROT_MEANINGS['the-fool'].reversed.replaceAll("'", '&#39;').slice(0, 40));
  });

  it('stands alone on another page: a div, its own heading level, no spread position', () => {
    const html = render(h(TarotCard, { reading: fool('upright'), as: 'div', headingLevel: 2, hidePosition: true }));
    expect(html).toMatch(/^<div class="tile tarot__card"/u);
    expect(html).toContain('<h2 class="tarot__name">The Fool</h2>');
    expect(html).not.toContain('tarot__position');
    expect(html).not.toContain('tarot__prompt');
  });
});
