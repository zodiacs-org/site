import { BRAND_ICON_PATHS } from "./brand-icons.mjs";

export const SHARE_CARD_BRAND_INK = "#8E96AB";
export const SHARE_CARD_BRAND_WORDMARK = "Zodiacs.org";

/**
 * Canonical bottom-right lockup for the site's 1080 x 1350 portrait cards.
 * The 2:1 icon/type ratio and zero gap are the approved birth-chart treatment.
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
  serif?: string;
}

export type LoadedShareBrandIcon = CanvasImageSource & { close?: () => void };

async function imageElementFromBlob(blob: Blob): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return null;
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("brand_icon_load_failed"));
      image.src = url;
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Loads the canonical twelve-sign profile image used by exported charts. */
export async function loadShareBrandIcon(): Promise<LoadedShareBrandIcon | null> {
  try {
    const response = await fetch(BRAND_ICON_PATHS.icon512);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(blob);
      } catch {
        // WebKit can expose createImageBitmap without decoding every PNG.
      }
    }
    return await imageElementFromBlob(blob);
  } catch {
    return null;
  }
}

/**
 * Gives one renderer a decoded profile image and always releases the bitmap.
 * Keeping acquisition adjacent to the lockup also avoids decoding an image
 * when an earlier part of a card cannot be painted.
 */
export async function withShareBrandIcon<T>(
  render: (icon: LoadedShareBrandIcon | null) => T | Promise<T>,
): Promise<T> {
  const icon = await loadShareBrandIcon();
  try {
    return await render(icon);
  } finally {
    icon?.close?.();
  }
}

/** Paints the approved profile-image + sentence-case wordmark export lockup. */
export function drawShareBrandLockup(
  context: CanvasRenderingContext2D,
  icon: LoadedShareBrandIcon | null,
  layout: ShareCardBrandLayout,
): void {
  const wordmark = SHARE_CARD_BRAND_WORDMARK;
  const gap = layout.gap ?? 0;
  const serif = layout.serif ?? '"EB Garamond", Georgia, serif';

  context.save();
  try {
    context.textBaseline = "middle";
    context.textAlign = "right";
    context.fillStyle = SHARE_CARD_BRAND_INK;
    context.font = `500 ${layout.fontSize}px ${serif}`;

    if (icon) {
      const iconX = layout.wordmarkX
        - context.measureText(wordmark).width
        - gap
        - layout.iconSize;
      const iconY = layout.centerY - layout.iconSize / 2;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(icon, iconX, iconY, layout.iconSize, layout.iconSize);
    }

    context.fillText(wordmark, layout.wordmarkX, layout.centerY);
  } finally {
    context.restore();
  }
}
