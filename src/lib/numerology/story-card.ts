/**
 * The numerology share card: a 1080 x 1920 story image of a Life Path number, drawn on the visitor's device with
 * the site's story card pieces (../story-card.ts) and the brand lockup. It carries the number, its name, keywords
 * and reading, and the address of that number's public page, and nothing else: never the name or the birth date
 * the number was worked out from. The file name says only which number it is.
 */
import type { PreparedChartCard } from '../share-card-save';
import { NUMBER_HUES, NUMBER_MEANINGS, type CoreNumber } from '../../data/numerology-meanings';
import { POSITION_READINGS } from '../../data/numerology-readings';
import { signBySlug } from '../signs';

export const NUMEROLOGY_ORIGIN = 'https://zodiacs.org';

/** The public page a Life Path card links to. It carries the number alone. */
export function lifePathPageUrl(number: CoreNumber): string {
  return `${NUMEROLOGY_ORIGIN}/numerology/life-path/${number}/`;
}

export interface NumerologyStoryContent {
  kicker: string;
  number: string;
  title: string;
  epithet: string;
  keywords: string;
  reading: string;
  address: string;
  note: string;
  hue: string;
  filename: string;
  pageUrl: string;
  shareText: string;
}

/** The words the card prints, apart from the drawing, so a test can read them. */
export function numerologyStoryContent(number: CoreNumber): NumerologyStoryContent {
  const meaning = NUMBER_MEANINGS[number];
  // The number's hue is one of the twelve sign hues, named as a custom property; the canvas needs its value.
  const slug = /--sign-([a-z]+)/u.exec(NUMBER_HUES[number])?.[1] ?? 'pisces';
  const pageUrl = lifePathPageUrl(number);
  return {
    kicker: 'Numerology',
    number: String(number),
    title: `Life Path ${number}`,
    epithet: meaning.name,
    keywords: meaning.keywords.join(' · '),
    reading: POSITION_READINGS.lifePath[number],
    address: pageUrl.replace(/^https:\/\//u, '').replace(/\/$/u, ''),
    note: 'A separate tradition from astrology',
    hue: signBySlug(slug).hue,
    filename: `zodiacs-life-path-${number}.png`,
    pageUrl,
    shareText: `My Life Path number is ${number}: ${meaning.name.toLowerCase()}.`,
  };
}

/** Draws the card. Loaded only when the person asks for one. */
export async function prepareNumerologyStoryCard(number: CoreNumber): Promise<PreparedChartCard> {
  const story = await import('../story-card');
  const content = numerologyStoryContent(number);
  const { STORY_W, STORY_INK_0, STORY_INK_1, STORY_INK_2, STORY_SERIF, STORY_MONO, STORY_LOCKUP } = story;
  await story.loadStoryFonts({ serif: [40, 44, 96, 360], mono: [26] });
  const { canvas, ctx } = story.storyCanvas();
  story.drawStoryGround(ctx, number * 7919 + 31);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = STORY_INK_2;
  ctx.font = `italic 400 44px ${STORY_SERIF}`;
  ctx.fillText(content.kicker, STORY_W / 2, 330);

  ctx.fillStyle = content.hue;
  ctx.font = `500 360px ${STORY_SERIF}`;
  ctx.fillText(content.number, STORY_W / 2, 700);

  ctx.fillStyle = STORY_INK_0;
  story.fitStoryLine(ctx, content.title, 900, 96, 64, (px) => `500 ${px}px ${STORY_SERIF}`);
  ctx.fillText(content.title, STORY_W / 2, 850);

  ctx.fillStyle = content.hue;
  ctx.font = `italic 400 48px ${STORY_SERIF}`;
  ctx.fillText(content.epithet, STORY_W / 2, 930);

  ctx.fillStyle = STORY_INK_2;
  story.fitStoryLine(ctx, content.keywords, 900, 34, 26, (px) => `400 ${px}px ${STORY_SERIF}`);
  ctx.fillText(content.keywords, STORY_W / 2, 1000);

  ctx.strokeStyle = story.hexAlpha(content.hue, 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(STORY_W / 2 - 60, 1050);
  ctx.lineTo(STORY_W / 2 + 60, 1050);
  ctx.stroke();

  story.drawStoryParagraph(ctx, content.reading, {
    y: 1080, maxWidth: 860, maxLines: 6, startPx: 44, minPx: 32,
    font: (px) => `400 ${px}px ${STORY_SERIF}`, color: STORY_INK_1,
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = STORY_INK_2;
  ctx.font = `italic 400 32px ${STORY_SERIF}`;
  ctx.fillText(content.note, STORY_W / 2, STORY_LOCKUP.centerY - 150);
  ctx.font = `400 26px ${STORY_MONO}`;
  ctx.fillText(content.address, STORY_W / 2, STORY_LOCKUP.centerY - 96);

  // Not a chart, so the lockup keeps the brand's own ring.
  await story.drawStoryLockup(ctx, null);
  return { blob: await story.storyPng(canvas), filename: content.filename };
}
