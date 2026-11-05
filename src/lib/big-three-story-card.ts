/**
 * The big three story card: the person's Sun, Moon and rising signs on a
 * 1080 x 1920 story image, drawn on their device (story-card.ts). It shows
 * signs and their degrees and nothing else: no birth date, time or place,
 * and the file name says only what kind of card it is.
 *
 * Positions are the ones a chart's link carries (share-card's
 * imagePositions): a chart without a birth time is drawn from the sky at
 * 12:00 UTC on its date, has no rising sign, and names a Moon sign only when
 * the Moon held it all that day. The lockup's ring brings the Sun sign to
 * the front when the chart settles it (ring-front.ts).
 */
import type { CatalogLocale as Locale } from './i18n';
import { t } from './i18n';
import { signBySlug } from './signs';
import { shareCardText } from './share-card-copy';
import {
  bigThreePlacements,
  cardDegreeText,
  cardRingFront,
  imagePositions,
  untimedMoonSign,
  type BigThreeCardChart,
  type BigThreePlacement,
  type ShareCardOptions,
} from './share-card';
import type { PreparedChartCard } from './share-card-save';
import {
  BIG_THREE_STORY_FILENAME,
  STORY_INK_0,
  STORY_INK_2,
  STORY_SERIF,
  STORY_W,
  drawEmptyDisc,
  drawStoryGround,
  drawStoryLockup,
  fitStoryLine,
  hexAlpha,
  loadStoryDisc,
  loadStoryFonts,
  storyCanvas,
  storyPng,
} from './story-card';

export interface BigThreeStoryRow {
  kind: BigThreePlacement['kind'];
  label: string;
  /** The sign's slug, or '' when the chart does not settle the sign. */
  slug: string;
  /** The sign's name, the Moon's possible signs, or the line saying a birth time is needed. */
  name: string;
  /** Degree in the sign, or null when it is not shown. */
  degree: string | null;
  descriptor: string;
  hue: string | null;
  settled: boolean;
}

/**
 * The three rows a story card draws. A placement the chart does not settle
 * keeps its row and says it needs a birth time: the rising sign of a chart
 * without one, and a Moon that may have changed signs that day. Without a
 * birth time no degree is printed, since the positions are a reference.
 */
export function bigThreeStoryRows(
  chart: Pick<BigThreeCardChart, 'bodies' | 'angles' | 'moonSignCandidates'>,
  locale: Locale = 'en',
): BigThreeStoryRow[] {
  const timed = chart.angles !== null;
  const descriptor = (kind: BigThreePlacement['kind']) =>
    shareCardText(locale, `${kind}Descriptor` as 'sunDescriptor' | 'moonDescriptor' | 'risingDescriptor');
  const rows: BigThreeStoryRow[] = bigThreePlacements(chart, locale).map((placement) => {
    const settled = !placement.uncertain && placement.slug !== '';
    return {
      kind: placement.kind,
      label: shareCardText(locale, placement.kind),
      slug: settled ? placement.slug : '',
      name: settled ? placement.sign : t(locale, 'needsBirthTime'),
      degree: settled && timed ? cardDegreeText(placement.kind, placement.degree) : null,
      descriptor: descriptor(placement.kind),
      hue: settled ? signBySlug(placement.slug).hue : null,
      settled,
    };
  });
  if (!timed) {
    rows.push({
      kind: 'rising',
      label: shareCardText(locale, 'rising'),
      slug: '',
      name: t(locale, 'needsBirthTime'),
      degree: null,
      descriptor: descriptor('rising'),
      hue: null,
      settled: false,
    });
  }
  return rows;
}

async function drawBigThreeStory(
  chart: BigThreeCardChart,
  options: ShareCardOptions,
): Promise<Blob> {
  const locale = options.locale ?? 'en';
  const rows = bigThreeStoryRows(chart, locale);
  await loadStoryFonts({ serif: [30, 40, 96], mono: [26] });
  const discs = await Promise.all(rows.map((row) => loadStoryDisc(row.slug)));
  const { canvas, ctx } = storyCanvas();
  const sun = chart.bodies.find((body) => body.body === 'Sun');
  drawStoryGround(ctx, Math.round((sun?.lon ?? 0) * 1000));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = STORY_INK_2;
  ctx.font = `italic 400 44px ${STORY_SERIF}`;
  ctx.fillText(shareCardText(locale, 'storyTitle'), STORY_W / 2, 330);

  const discSize = 236;
  const rowHeight = 380;
  const firstTop = 420;
  const textX = 116 + discSize + 56;
  const textWidth = STORY_W - textX - 96;
  rows.forEach((row, index) => {
    const top = firstTop + index * rowHeight;
    const cy = top + discSize / 2;
    const disc = discs[index];
    if (disc) ctx.drawImage(disc, 116, top, discSize, discSize);
    else drawEmptyDisc(ctx, 116 + discSize / 2, cy, discSize / 2 - 14);

    ctx.textAlign = 'left';
    ctx.fillStyle = row.hue ?? STORY_INK_2;
    ctx.font = `italic 400 40px ${STORY_SERIF}`;
    ctx.fillText(row.label, textX, cy - 62);

    ctx.fillStyle = row.settled ? STORY_INK_0 : STORY_INK_2;
    const startPx = row.settled ? 96 : 50;
    fitStoryLine(ctx, row.name, textWidth, startPx, row.settled ? 60 : 34, (px) => `500 ${px}px ${STORY_SERIF}`);
    ctx.fillText(row.name, textX, cy + (row.settled ? 26 : 12));

    ctx.fillStyle = STORY_INK_2;
    ctx.font = `400 30px ${STORY_SERIF}`;
    const descriptor = row.degree ? `${row.degree}  ${row.descriptor}` : row.descriptor;
    fitStoryLine(ctx, descriptor, textWidth, 30, 22, (px) => `400 ${px}px ${STORY_SERIF}`);
    ctx.fillText(descriptor, textX, cy + 82);

    if (row.hue && index < rows.length - 1) {
      ctx.strokeStyle = hexAlpha(row.hue, 0.28);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(textX, top + rowHeight - 50);
      ctx.lineTo(STORY_W - 96, top + rowHeight - 50);
      ctx.stroke();
    }
  });

  await drawStoryLockup(ctx, cardRingFront(chart));
  return storyPng(canvas);
}

/**
 * Prepare the big three story card ahead of the share tap, so the tap can
 * reach the share sheet at once (see share-card's prepareChartCard).
 */
export async function prepareBigThreeStoryCard(
  chart: BigThreeCardChart,
  locale: Locale = 'en',
  options: Pick<ShareCardOptions, 'referenceTime' | 'moonAmbiguous' | 'birthDate'> = {},
): Promise<PreparedChartCard> {
  let drawn = await imagePositions(chart, options.birthDate);
  if (options.moonAmbiguous && drawn.moonSignCandidates === undefined) drawn = { ...drawn, moonSignCandidates: [] };
  // Without a birth time the Moon's sign only when it held it all that date, everywhere.
  if (!drawn.angles) {
    const settled = await untimedMoonSign(options.birthDate);
    if (settled) drawn = { ...drawn, moonSignCandidates: [settled] };
  }
  return {
    blob: await drawBigThreeStory(drawn, { ...options, locale }),
    filename: BIG_THREE_STORY_FILENAME,
  };
}
