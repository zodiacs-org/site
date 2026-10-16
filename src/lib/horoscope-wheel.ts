/**
 * The horoscope pages' wheel: the edition's noon-UTC sky (daily.json) set on
 * the page sign's solar wheel, rendered at build time by the shared Wheel
 * component into one self-contained SVG per sign and period. The page shows
 * it as a lazy image below the reading, so the twenty kilobytes of wheel
 * markup never sit on the first screen's critical path.
 *
 * The SVG carries everything it needs: the twelve pastel sign discs as data
 * URIs (an SVG shown as an image may not fetch anything), a system font
 * stack for its few labels, and the colours that pick out the planets the
 * reading draws on.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import Wheel from './wheel/Wheel';
import type { Daily } from './daily';
import type { HoroscopeSkyPlanet } from './horoscope-page-data';
import { SIGNS, signBySlug } from './signs';

/** Wheel size: the viewBox the static wheel draws into (420 plus its 5% pad). */
export const HOROSCOPE_WHEEL_SIZE = 462;

/** Bodies the reading cites on the edition's own date, in wheel order. */
export function horoscopeWheelFocus(sky: readonly HoroscopeSkyPlanet[] | undefined, daily: Daily): string[] {
  return [...new Set((sky ?? [])
    .filter((planet) => planet.at.slice(0, 10) === daily.date && daily.bodies.some((body) => body.body === planet.body))
    .map((planet) => planet.body))];
}

let iconCache: Map<string, string> | null = null;
function signDisc(slug: string): string {
  if (!iconCache) iconCache = new Map();
  const cached = iconCache.get(slug);
  if (cached) return cached;
  const bytes = readFileSync(join(process.cwd(), 'public', 'assets', 'zodiac-icons', '48', `${slug}.webp`));
  const uri = `data:image/webp;base64,${bytes.toString('base64')}`;
  iconCache.set(slug, uri);
  return uri;
}

export function horoscopeWheelSvg({
  daily,
  signSlug,
  focus,
  label,
}: {
  daily: Daily;
  signSlug: string;
  focus: readonly string[];
  label: string;
}): string {
  const signIndex = SIGNS.findIndex((sign) => sign.slug === signSlug);
  if (signIndex < 0) throw new Error(`Unknown sign ${signSlug}`);
  const signStart = signIndex * 30;
  const markup = render(h(Wheel, {
    bodies: daily.bodies.map((body) => ({ body: body.body, lon: body.lon, retrograde: body.retrograde })),
    asc: signStart,
    cusps: Array.from({ length: 12 }, (_, index) => (signStart + index * 30) % 360),
    preview: true,
    ariaLabel: label,
  }));
  const focusRules = focus.map((body) => {
    const position = daily.bodies.find((entry) => entry.body === body);
    const hue = position ? signBySlug(position.sign).hue : '#EEF1F7';
    const selector = `[data-preview-body="${body}"]`;
    return `${selector}{opacity:1}${selector}>circle{fill:${hue};stroke:rgba(6,7,9,.5);stroke-opacity:1}${selector}>g{stroke:#0B0D12;color:#0B0D12!important}`;
  }).join('');
  const style = [
    'text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    // The solar wheel starts at the sign; it has no ascendant to label.
    'svg>text{display:none}',
    focus.length > 0 ? '.wheel__body{opacity:.5}' : '',
    focusRules,
  ].join('');
  return markup
    .replace(
      /^<svg viewBox="([^"]+)" width="100%"/u,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="$1" width="${HOROSCOPE_WHEEL_SIZE}" height="${HOROSCOPE_WHEEL_SIZE}"`,
    )
    .replace(/(<svg[^>]*>)/u, `$1<style>${style}</style>`)
    .replace(/href="\/assets\/zodiac-icons\/128\/([a-z]+)\.webp"/gu, (_, slug: string) => `href="${signDisc(slug)}"`)
    .replaceAll('font-family="var(--font-mono)"', 'font-family="ui-monospace,Menlo,Consolas,monospace"');
}
