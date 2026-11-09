/**
 * Simple line icons for the four suits and the Major Arcana, stroked like the site's tool icons (24px grid,
 * currentColor). Text and these icons stand in for card art, which is out of scope. Each suit borrows one of the
 * twelve pastel disc hues, the site's only chroma, as a colour and nothing more.
 */
import type { Suit } from './deck';

export type SuitKey = Suit | 'major';

export const SUIT_HUES: Readonly<Record<SuitKey, string>> = Object.freeze({
  major: 'var(--sign-pisces)',
  wands: 'var(--sign-aries)',
  cups: 'var(--sign-cancer)',
  swords: 'var(--sign-gemini)',
  pentacles: 'var(--sign-taurus)',
});

export const SUIT_PATHS: Readonly<Record<SuitKey, string>> = Object.freeze({
  // An eight-pointed star.
  major: '<path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6 6 18"/><circle cx="12" cy="12" r="2.6"/>',
  // A staff with a sprouting leaf.
  wands: '<path d="M8 20.5 16.5 4"/><path d="M13.6 9.6c1.9-.5 3.4.1 4.3 1.6-1.9.6-3.4 0-4.3-1.6Z"/><path d="M11.2 14.4c-1.7-.9-2.4-2.3-2-4.1 1.7.9 2.4 2.3 2 4.1Z"/>',
  // A goblet.
  cups: '<path d="M6.5 4h11c0 4.6-2.4 7.6-5.5 7.6S6.5 8.6 6.5 4Z"/><path d="M12 11.6v6.6"/><path d="M8.5 20h7"/>',
  // An upright sword.
  swords: '<path d="M12 3v13.2"/><path d="M9.6 5.6 12 3l2.4 2.6"/><path d="M7.8 16.2h8.4"/><path d="M12 16.2v4.6"/>',
  // A disc with a five-pointed star.
  pentacles: '<circle cx="12" cy="12" r="8.4"/><path d="M12 6.6l1.6 3.4 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z"/>',
});

export function SuitIcon({ suit, reversed = false, size = 22 }: { suit: SuitKey; reversed?: boolean; size?: number }) {
  return (
    <svg
      class={`tarot__icon${reversed ? ' tarot__icon--reversed' : ''}`} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: SUIT_PATHS[suit] }}
    />
  );
}
