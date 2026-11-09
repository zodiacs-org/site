/**
 * draw_tarot: a fair, unseeded draw from the 78-card deck (src/lib/tarot/draw.ts) for one card, three cards (past,
 * present, future) or the Celtic Cross, upright or reversed, with Zodiacs' own written meanings
 * (src/lib/tarot/meanings.ts). Tarot is a separate practice from astrology: nothing here reads the sky, and every
 * answer says so. Each card is read as the tradition reads it, with no price or investment calls, diagnoses, death
 * predictions or legal verdicts.
 *
 * The tool takes the spread and whether to use reversals, and nothing else: no question, name, birth detail or
 * seed, so nothing about the person can reach the draw, and nothing is stored or logged. No model is called.
 */
import { z } from 'zod';
import { drawTarot, type DrawnCard } from '../../lib/tarot/draw';
import { SPREADS, SPREAD_IDS } from '../../lib/tarot/spreads';
import { SUITS } from '../../lib/tarot/deck';
import { TAROT_MEANINGS } from '../../lib/tarot/meanings';

export const tarotInput = z.strictObject({
  spread: z.enum(SPREAD_IDS).optional()
    .describe('one-card (the default), three-card (past, present, future) or celtic-cross (ten cards).'),
  reversals: z.boolean().optional()
    .describe('Whether cards can come up reversed, each with even odds. Defaults to true; false draws every card upright.'),
});
export type TarotInput = z.infer<typeof tarotInput>;

const drawnCard = z.object({
  position: z.object({ key: z.string(), name: z.string(), prompt: z.string() }),
  card: z.object({ id: z.string(), name: z.string(), arcana: z.enum(['major', 'minor']), suit: z.enum(SUITS).nullable(), number: z.number().int() }),
  orientation: z.enum(['upright', 'reversed']),
  keywords: z.array(z.string()),
  /** The meaning for the card as it came up, upright or reversed. */
  meaning: z.string(),
  /** One open question to think about. */
  question: z.string(),
});

export const tarotData = z.object({
  spread: z.enum(SPREAD_IDS),
  spreadName: z.string(),
  spreadDescription: z.string(),
  reversals: z.boolean(),
  /** Tarot is not astrology; say so when sharing the draw. */
  separateFromAstrology: z.string(),
  cards: z.array(drawnCard),
  method: z.string(),
  note: z.string(),
});
export type TarotData = z.infer<typeof tarotData>;

export const TAROT_SEPARATE = 'Tarot is a separate practice from astrology. It works from a shuffled deck of 78 cards, with no planets, signs or birth details in it.';
export const TAROT_METHOD = 'Each card is drawn from the full 78-card deck without replacement, using a secure random number generator and rejection sampling so that no card is favoured. With reversals on, each card is upright or reversed with even odds. Nothing about the person, and no question, goes into the draw.';
export const TAROT_NOTE = 'The meanings are Zodiacs\' own, written to the themes the tarot tradition gives each card.';

/** The answer for a draw already made: separated from drawTarot so the tests can check the shape of a known draw. */
export function tarotAnswer(spread: TarotData['spread'], reversals: boolean, drawn: readonly DrawnCard[], origin: string): { data: TarotData; links: { title: string; url: string }[] } {
  const layout = SPREADS[spread];
  const data: TarotData = {
    spread, spreadName: layout.name, spreadDescription: layout.description, reversals,
    separateFromAstrology: TAROT_SEPARATE,
    cards: drawn.map(({ position, card, orientation }) => {
      const meaning = TAROT_MEANINGS[card.id];
      return {
        position: { key: position.key, name: position.name, prompt: position.prompt },
        card: { id: card.id, name: card.name, arcana: card.arcana, suit: card.suit, number: card.number },
        orientation, keywords: [...meaning.keywords], meaning: orientation === 'upright' ? meaning.upright : meaning.reversed, question: meaning.question,
      };
    }),
    method: TAROT_METHOD,
    note: TAROT_NOTE,
  };
  return { data, links: [{ title: 'Tarot on Zodiacs', url: `${origin}/tarot/` }] };
}

export function drawTarotReading(args: TarotInput, origin: string) {
  const spread = args.spread ?? 'one-card';
  const reversals = args.reversals ?? true;
  return tarotAnswer(spread, reversals, drawTarot(spread, reversals), origin);
}
