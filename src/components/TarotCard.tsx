/**
 * One tarot card as text and a simple suit icon (no card art): position, name, upright or reversed, keywords,
 * the position's prompt, the reading and its question. Presentational only: give it a reading from
 * drawTarotReading (src/lib/tarot/reading.ts), drawn in the browser. Used by the /tarot/ draw and reusable on any
 * page, such as a birthday report. Its styles travel with it (src/styles/tarot.css).
 */
import { SuitIcon, SUIT_HUES } from '../lib/tarot/suit-icons';
import type { TarotCardReading } from '../lib/tarot/reading';
import '../styles/tarot.css';

export interface TarotCardProps {
  reading: TarotCardReading;
  /** Hide the spread position's label and prompt, for a single card shown on its own. Default false. */
  hidePosition?: boolean;
  /** The element the card renders as: 'li' inside a list of cards (the default), 'div' on its own. */
  as?: 'li' | 'div';
  /** Heading level for the card's name. Default 3. */
  headingLevel?: 2 | 3 | 4;
}

export default function TarotCard({ reading, hidePosition = false, as = 'li', headingLevel = 3 }: TarotCardProps) {
  const { position, card, orientation, keywords, meaning, question } = reading;
  const suit = card.suit ?? 'major';
  const Tag = as;
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <Tag class="tile tarot__card" style={`--sign:${SUIT_HUES[suit]}`}>
      {!hidePosition && <span class="mono--label tarot__position">{position.name}</span>}
      <div class="tarot__title">
        <SuitIcon suit={suit} reversed={orientation === 'reversed'} />
        <Heading class="tarot__name">{card.name}</Heading>
      </div>
      <span class="tarot__orientation">{orientation === 'reversed' ? 'Reversed' : 'Upright'} · {keywords.join(' · ')}</span>
      {!hidePosition && <p class="tarot__prompt">{position.prompt}</p>}
      <p class="tarot__meaning">{meaning}</p>
      <p class="tarot__question"><em>{question}</em></p>
    </Tag>
  );
}
