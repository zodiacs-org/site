/**
 * The reusable tarot reading: a drawn card joined to Zodiacs' own words for it. Pure apart from the draw itself,
 * which uses the secure random number generator (./draw.ts) and takes nothing from the person.
 *
 * Used by the /tarot/ page, the draw_tarot tool (src/ai-tools/features/tarot.ts) and any page that shows a card,
 * such as a birthday report:
 *
 *   import { drawTarotReading } from '../lib/tarot/reading';
 *   const [card] = drawTarotReading('one-card');   // in the browser, so each visit draws afresh
 *   <TarotCard reading={card} />                    // src/components/TarotCard.tsx
 *
 * Draw on the client (an island), never at build time, or every visitor would see the same card.
 */
import { drawTarot, type DrawnCard, type Orientation } from './draw';
import type { Suit } from './deck';
import type { SpreadId } from './spreads';
import { TAROT_MEANINGS } from './meanings';

export interface TarotCardReading {
  position: { key: string; name: string; prompt: string };
  card: { id: string; name: string; arcana: 'major' | 'minor'; suit: Suit | null; number: number };
  orientation: Orientation;
  keywords: string[];
  /** The upright or reversed reading, as the card came up. */
  meaning: string;
  /** One open question to think about. */
  question: string;
}

/** A drawn card with its words. */
export function readCard({ position, card, orientation }: DrawnCard): TarotCardReading {
  const meaning = TAROT_MEANINGS[card.id];
  if (!meaning) throw new Error(`No meaning for ${card.id}`);
  return {
    position: { key: position.key, name: position.name, prompt: position.prompt },
    card: { id: card.id, name: card.name, arcana: card.arcana, suit: card.suit, number: card.number },
    orientation,
    keywords: [...meaning.keywords],
    meaning: orientation === 'upright' ? meaning.upright : meaning.reversed,
    question: meaning.question,
  };
}

/** A fresh, fair draw for the spread, each card with its words. One card by default, reversals on. */
export function drawTarotReading(spread: SpreadId = 'one-card', reversals = true): TarotCardReading[] {
  return drawTarot(spread, reversals).map(readCard);
}
