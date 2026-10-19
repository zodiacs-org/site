import { LOCKUP, LOCKUP_WORDS, tiltedRingDots } from "./brand-lockup.mjs";

/**
 * The brand lockup on the site's export images (DESIGN.md, "Brand Lockup"),
 * owner-chosen 2026-10-19: the tilted twelve-dot ring and ZODIACS · ORG,
 * drawn as vectors and type, so a card loads no image for it.
 */

/** The dot's muted ink; ZODIACS is the cards' ink and ORG a step dimmer. */
export const SHARE_CARD_BRAND_INK = "#8E96AB";
export const SHARE_CARD_BRAND_NAME_INK = "#EEF1F7";
export const SHARE_CARD_BRAND_TLD_INK = "#C6CCDA";
/** The words as the cards draw them. */
export const SHARE_CARD_BRAND_WORDMARK = `${LOCKUP_WORDS.name} ${LOCKUP_WORDS.dot} ${LOCKUP_WORDS.tld}`;
/** The lockup's capitals are this share of a layout's `fontSize` (22px on the portrait cards: 20px capitals). */
export const SHARE_CARD_BRAND_TYPE_SCALE = 10 / 11;
/** EB Garamond's cap height, so the capitals and the ring centre on `centerY`. */
const CAP_HEIGHT = 0.65;
const LOCKUP_SERIF = '"EB Garamond", Georgia, serif';

/**
 * Canonical bottom-right placement for the site's 1080 x 1350 portrait cards:
 * the lockup ends at `wordmarkX` and centres on `centerY`. `fontSize` sets
 * its size (see SHARE_CARD_BRAND_TYPE_SCALE); `iconSize` and `gap` are the
 * earlier image lockup's numbers, kept because some cards lay out from them.
 */
export const PORTRAIT_SHARE_CARD_BRAND_LAYOUT = Object.freeze({
  wordmarkX: 1014,
  centerY: 1290,
  iconSize: 44,
  fontSize: 22,
  gap: 0,
});

export interface ShareCardBrandLayout {
  wordmarkX: number;
  centerY: number;
  iconSize: number;
  fontSize: number;
  gap?: number;
  /** The card's own serif; the lockup's Latin capitals always use EB Garamond. */
  serif?: string;
  /**
   * A card made for one person passes their sign (ringFront) and the ring
   * turns to bring it to the front; without one it is the brand's own ring.
   */
  front?: string | null;
}

/** Kept for the cards' call shapes: the lockup no longer draws an image, so this is always null. */
export type LoadedShareBrandIcon = CanvasImageSource & { close?: () => void };

/** Makes sure the lockup's two faces are ready before a card paints. Never throws. */
export async function prepareShareBrandLockup(size = 20): Promise<void> {
  if (typeof document === "undefined" || typeof document.fonts === "undefined") return;
  await Promise.all([
    document.fonts.load(`400 ${size}px ${LOCKUP_SERIF}`),
    document.fonts.load(`500 ${size}px ${LOCKUP_SERIF}`),
  ]).catch(() => undefined);
}

/**
 * Prepares the lockup's faces and resolves null: since the lockup became the
 * tilted ring and ZODIACS · ORG (2026-10-19) no profile image is fetched.
 * Kept so the cards that loaded the image keep their shape.
 */
export async function loadShareBrandIcon(): Promise<LoadedShareBrandIcon | null> {
  await prepareShareBrandLockup();
  return null;
}

/** Runs one renderer once the lockup's faces are ready (see loadShareBrandIcon). */
export async function withShareBrandIcon<T>(
  render: (icon: LoadedShareBrandIcon | null) => T | Promise<T>,
): Promise<T> {
  await prepareShareBrandLockup();
  return render(null);
}

/** The tilted ring, `width` px wide (its height is 4/7 of it), from its top-left corner, turned to `front` when one is given. */
export function drawTiltedRing(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  front?: string | null,
): void {
  const scale = width / 28;
  context.save();
  try {
    for (const dot of tiltedRingDots(front)) {
      context.globalAlpha = dot.opacity;
      context.fillStyle = dot.fill;
      context.beginPath();
      context.arc(x + (dot.cx + 2) * scale, y + (dot.cy - 4) * scale, dot.r * scale, 0, Math.PI * 2);
      context.fill();
    }
  } finally {
    context.restore();
  }
}

/** Whether the canvas spaces letters itself (Chromium and Firefox do; older WebKit does not). */
const spacesLetters = (context: CanvasRenderingContext2D) =>
  typeof (context as { letterSpacing?: unknown }).letterSpacing === "string";

/** Draws `text` from `x` with `tracking` after each letter: through the canvas's own letter spacing where it has one, letter by letter otherwise. */
function fillTracked(context: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number): void {
  if (spacesLetters(context)) {
    context.letterSpacing = `${tracking}px`;
    context.fillText(text, x, y);
    context.letterSpacing = "0px";
    return;
  }
  let cursor = x;
  for (const letter of text) {
    context.fillText(letter, cursor, y);
    cursor += context.measureText(letter).width + tracking;
  }
}

/**
 * Paints the lockup: the tilted ring, then ZODIACS · ORG in EB Garamond
 * capitals at 0.2em tracking, the dot muted and centred, ORG at 500 a step
 * dimmer. It ends at `layout.wordmarkX` (the last letter, not its tracking)
 * and centres on `layout.centerY`, the ring turned to `layout.front` on a
 * card made for one person. `_icon` is ignored (see loadShareBrandIcon).
 */
export function drawShareBrandLockup(
  context: CanvasRenderingContext2D,
  _icon: LoadedShareBrandIcon | null,
  layout: ShareCardBrandLayout,
): void {
  const size = layout.fontSize * SHARE_CARD_BRAND_TYPE_SCALE;
  const tracking = size * LOCKUP.tracking;
  const dotSpace = size * LOCKUP.dotSpace;
  const runs = [
    { text: LOCKUP_WORDS.name, weight: 400, color: SHARE_CARD_BRAND_NAME_INK, before: 0 },
    { text: LOCKUP_WORDS.dot, weight: 400, color: SHARE_CARD_BRAND_INK, before: dotSpace },
    { text: LOCKUP_WORDS.tld, weight: 500, color: SHARE_CARD_BRAND_TLD_INK, before: dotSpace },
  ];

  context.save();
  try {
    if (spacesLetters(context)) context.letterSpacing = "0px";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    const widths = runs.map((run) => {
      context.font = `${run.weight} ${size}px ${LOCKUP_SERIF}`;
      return context.measureText(run.text).width + tracking * [...run.text].length;
    });
    const wordsWidth = runs.reduce((sum, run, index) => sum + run.before + widths[index], 0) - tracking;
    const ringWidth = size * LOCKUP.ringWidth;
    const ringHeight = (ringWidth * 4) / 7;
    let x = layout.wordmarkX - wordsWidth;
    drawTiltedRing(context, x - size * LOCKUP.gap - ringWidth, layout.centerY - ringHeight / 2, ringWidth, layout.front);
    const baseline = layout.centerY + (size * CAP_HEIGHT) / 2;
    runs.forEach((run, index) => {
      x += run.before;
      context.font = `${run.weight} ${size}px ${LOCKUP_SERIF}`;
      context.fillStyle = run.color;
      fillTracked(context, run.text, x, baseline, tracking);
      x += widths[index];
    });
  } finally {
    context.restore();
  }
}
