/**
 * The tarot share card: a 1080 x 1920 story image of a draw, drawn on the visitor's device with the site's story
 * card pieces (../story-card.ts), the suit icons and the brand lockup. It carries the cards drawn and their words,
 * and the address of the tarot page, and nothing else: the draw takes no question, name or birth detail, so there
 * is nothing personal to leave out. One card is drawn in full; three as rows; the Celtic Cross as a list.
 */
import type { PreparedChartCard } from '../share-card-save';
import type { TarotCardReading } from './reading';
import type { SpreadId } from './spreads';
import { SPREADS } from './spreads';
import { SUIT_HUES, SUIT_PATHS, type SuitKey } from './suit-icons';
import { signBySlug } from '../signs';

export const TAROT_ORIGIN = 'https://zodiacs.org';

/** The page a draw's card links to: the card's own entry for one card, the tarot page for a spread. */
export function tarotPageUrl(cards: readonly Pick<TarotCardReading, 'card'>[]): string {
  return cards.length === 1 ? `${TAROT_ORIGIN}/tarot/#${cards[0].card.id}` : `${TAROT_ORIGIN}/tarot/`;
}

const hueOf = (suit: SuitKey) => signBySlug(/--sign-([a-z]+)/u.exec(SUIT_HUES[suit])?.[1] ?? 'pisces').hue;

export interface TarotStoryRow {
  position: string;
  name: string;
  orientation: string;
  keywords: string;
  suit: SuitKey;
  hue: string;
}

export interface TarotStoryContent {
  kicker: string;
  rows: TarotStoryRow[];
  /** For one card: its reading and question. */
  meaning: string | null;
  question: string | null;
  note: string;
  address: string;
  filename: string;
  pageUrl: string;
  shareText: string;
}

/** The words the card prints, apart from the drawing, so a test can read them. */
export function tarotStoryContent(spread: SpreadId, cards: readonly TarotCardReading[]): TarotStoryContent {
  const rows = cards.map((reading): TarotStoryRow => {
    const suit: SuitKey = reading.card.suit ?? 'major';
    return {
      position: reading.position.name,
      name: reading.card.name,
      orientation: reading.orientation === 'reversed' ? 'Reversed' : 'Upright',
      keywords: reading.keywords.join(' · '),
      suit,
      hue: hueOf(suit),
    };
  });
  const one = cards.length === 1 ? cards[0] : null;
  const names = cards.map((reading) => `${reading.card.name}${reading.orientation === 'reversed' ? ' (reversed)' : ''}`);
  return {
    kicker: spread === 'one-card' ? 'Tarot' : `Tarot · ${SPREADS[spread].name}`,
    rows,
    meaning: one?.meaning ?? null,
    question: one?.question ?? null,
    note: 'A separate practice from astrology',
    address: 'zodiacs.org/tarot',
    filename: `zodiacs-tarot-${spread}.png`,
    pageUrl: tarotPageUrl(cards),
    shareText: one ? `I drew ${names[0]} on Zodiacs.` : `My tarot draw on Zodiacs: ${names.join(', ')}.`,
  };
}

/** A suit icon as an image the canvas can draw, stroked in the suit's hue. */
async function suitImage(suit: SuitKey, hue: string): Promise<HTMLImageElement | null> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${hue}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${SUIT_PATHS[suit]}</svg>`;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try { await image.decode(); return image; } catch { return null; }
}

/** Draws the card. Loaded only when the person asks for one. */
export async function prepareTarotStoryCard(spread: SpreadId, cards: readonly TarotCardReading[]): Promise<PreparedChartCard> {
  const story = await import('../story-card');
  const content = tarotStoryContent(spread, cards);
  const { STORY_W, STORY_INK_0, STORY_INK_1, STORY_INK_2, STORY_SERIF, STORY_MONO, STORY_LOCKUP } = story;
  await story.loadStoryFonts({ serif: [28, 32, 40, 44, 56, 96], mono: [26] });
  const icons = await Promise.all(content.rows.map((row) => suitImage(row.suit, row.hue)));
  const { canvas, ctx } = story.storyCanvas();
  story.drawStoryGround(ctx, content.rows.reduce((seed, row) => seed + row.name.length * 131, 7));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = STORY_INK_2;
  ctx.font = `italic 400 44px ${STORY_SERIF}`;
  ctx.fillText(content.kicker, STORY_W / 2, 320);

  if (content.rows.length === 1) {
    const [row] = content.rows;
    const icon = icons[0];
    if (icon) {
      ctx.save();
      // A reversed card's icon is drawn upside down, as on the page.
      if (row.orientation === 'Reversed') { ctx.translate(STORY_W / 2, 545); ctx.rotate(Math.PI); ctx.drawImage(icon, -125, -125, 250, 250); }
      else ctx.drawImage(icon, STORY_W / 2 - 125, 420, 250, 250);
      ctx.restore();
    }
    ctx.fillStyle = STORY_INK_0;
    story.fitStoryLine(ctx, row.name, 900, 96, 60, (px) => `500 ${px}px ${STORY_SERIF}`);
    ctx.fillText(row.name, STORY_W / 2, 800);
    ctx.fillStyle = row.hue;
    ctx.font = `italic 400 44px ${STORY_SERIF}`;
    ctx.fillText(row.orientation, STORY_W / 2, 870);
    ctx.fillStyle = STORY_INK_2;
    story.fitStoryLine(ctx, row.keywords, 900, 32, 24, (px) => `400 ${px}px ${STORY_SERIF}`);
    ctx.fillText(row.keywords, STORY_W / 2, 930);
    ctx.strokeStyle = story.hexAlpha(row.hue, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(STORY_W / 2 - 60, 975); ctx.lineTo(STORY_W / 2 + 60, 975); ctx.stroke();
    let y = story.drawStoryParagraph(ctx, content.meaning ?? '', {
      y: 1000, maxWidth: 860, maxLines: 7, startPx: 40, minPx: 30, font: (px) => `400 ${px}px ${STORY_SERIF}`, color: STORY_INK_1,
    });
    story.drawStoryParagraph(ctx, content.question ?? '', {
      y: y + 20, maxWidth: 820, maxLines: 2, startPx: 38, minPx: 28, font: (px) => `italic 400 ${px}px ${STORY_SERIF}`, color: STORY_INK_0,
    });
  } else {
    const compact = content.rows.length > 3;
    const top = compact ? 380 : 430;
    const step = compact ? 106 : 300;
    const iconSize = compact ? 64 : 150;
    content.rows.forEach((row, index) => {
      const y = top + index * step;
      const icon = icons[index];
      const x = compact ? 120 : 130;
      if (icon) {
        ctx.save();
        if (row.orientation === 'Reversed') { ctx.translate(x + iconSize / 2, y + iconSize / 2); ctx.rotate(Math.PI); ctx.drawImage(icon, -iconSize / 2, -iconSize / 2, iconSize, iconSize); }
        else ctx.drawImage(icon, x, y, iconSize, iconSize);
        ctx.restore();
      }
      const textX = x + iconSize + (compact ? 30 : 48);
      const width = STORY_W - textX - 100;
      ctx.textAlign = 'left';
      ctx.fillStyle = row.hue;
      ctx.font = `italic 400 ${compact ? 28 : 40}px ${STORY_SERIF}`;
      ctx.fillText(row.position, textX, y + (compact ? 22 : 34));
      ctx.fillStyle = STORY_INK_0;
      story.fitStoryLine(ctx, row.name, width, compact ? 40 : 64, compact ? 30 : 44, (px) => `500 ${px}px ${STORY_SERIF}`);
      ctx.fillText(row.name, textX, y + (compact ? 64 : 104));
      if (!compact) {
        const line = `${row.orientation} · ${row.keywords}`;
        ctx.fillStyle = STORY_INK_2;
        story.fitStoryLine(ctx, line, width, 30, 22, (px) => `400 ${px}px ${STORY_SERIF}`);
        ctx.fillText(line, textX, y + 152);
      } else if (row.orientation === 'Reversed') {
        ctx.fillStyle = STORY_INK_2;
        ctx.font = `italic 400 28px ${STORY_SERIF}`;
        ctx.textAlign = 'right';
        ctx.fillText('reversed', STORY_W - 100, y + 22);
      }
    });
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = STORY_INK_2;
  ctx.font = `italic 400 32px ${STORY_SERIF}`;
  ctx.fillText(content.note, STORY_W / 2, STORY_LOCKUP.centerY - 150);
  ctx.font = `400 26px ${STORY_MONO}`;
  ctx.fillText(content.address, STORY_W / 2, STORY_LOCKUP.centerY - 96);

  await story.drawStoryLockup(ctx, null);
  return { blob: await story.storyPng(canvas), filename: content.filename };
}
