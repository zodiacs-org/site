/**
 * The twelve pastel sign hues are the cards' only colour. On the dark card
 * they are used as they are; on the light card text needs a deeper tone of
 * the same hue, found here by lowering its lightness until it reads at 4.5:1
 * or better on white.
 */
import { SIGNS } from '../../lib/signs';

/** The ring's tone where no sign is known: the site's second ink. */
export const NEUTRAL_HUE = '#C6CCDA';

export const hueOf = (slug: string | null | undefined): string | null => SIGNS.find((sign) => sign.slug === slug)?.hue ?? null;

function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function hsl([r, g, b]: [number, number, number]): [number, number, number] {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rr ? (gg - bb) / d + (gg < bb ? 6 : 0) : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4;
  return [h / 6, s, l];
}

function hex([h, s, l]: [number, number, number]): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const part = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
  };
  return `#${[part(h + 1 / 3), part(h), part(h - 1 / 3)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** The same hue, deep enough to read as text on the light card. */
export function deepTone(pastel: string, background = '#ffffff', ratio = 4.6): string {
  const [h, s, start] = hsl(rgb(pastel));
  const saturation = Math.min(1, s * 0.85 + 0.06);
  for (let l = start; l > 0.05; l -= 0.01) {
    const tone = hex([h, saturation, l]);
    if (contrast(tone, background) >= ratio) return tone;
  }
  return '#161922';
}

/** The custom properties a card sets for its one or two hues. */
export function hueVars(first: string | null, second?: string | null): Record<string, string> {
  const a = first ?? NEUTRAL_HUE;
  const b = second ?? a;
  return { '--hue': a, '--hue-2': b, '--hue-deep': deepTone(a), '--hue-2-deep': deepTone(b) };
}
