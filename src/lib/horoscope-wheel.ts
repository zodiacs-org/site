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
import Wheel, { wheelFrame } from './wheel/Wheel';
import { collisionNudge } from './scene/layout';
import type { Daily } from './daily';
import type { HoroscopeSkyPlanet } from './horoscope-page-data';
import { SIGNS, signBySlug } from './signs';

/** The size the wheel is drawn at (Wheel's default). */
const WHEEL_DRAW_SIZE = 420;

/** Wheel size: the viewBox the static wheel draws into (420 plus its 5% pad). */
export const HOROSCOPE_WHEEL_SIZE = 462;

/** Bodies the reading cites on the edition's own date, in wheel order. */
export function horoscopeWheelFocus(sky: readonly HoroscopeSkyPlanet[] | undefined, daily: Daily): string[] {
  return [...new Set((sky ?? [])
    .filter((planet) => planet.at.slice(0, 10) === daily.date && daily.bodies.some((body) => body.body === planet.body))
    .map((planet) => planet.body))];
}

function wheelBodies(daily: Daily) {
  return daily.bodies.map((body) => ({ body: body.body, lon: body.lon, retrograde: body.retrograde }));
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
    bodies: wheelBodies(daily),
    size: WHEEL_DRAW_SIZE,
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

/** The story's timings, in ms from the moment the wheel comes into view. */
export const HOROSCOPE_WHEEL_STORY = {
  /** The ring's trip round the wheel, from the page's sign. */
  ring: 1300,
  /** The closing beat: the planets the reading draws on. */
  focus: 1700,
  /** Between one picked-out planet and the next. */
  focusStep: 70,
  /** The last transition ends by then (the runtime settles at 2600). */
  end: 2500,
} as const;

export interface HoroscopeWheelStoryPlanet {
  body: string;
  x: number;
  y: number;
  /** The veil's radius; a retrograde planet's covers its Rx too. */
  r: number;
  /** When the planet arrives. */
  t: number;
  focus: boolean;
}

export interface HoroscopeWheelStory {
  viewBox: string;
  /** The ring, one stroke counter-clockwise from the start of the page's sign. */
  ring: string;
  /** The sign band's radius and width, which the twelve veils cover. */
  band: { r: number; width: number };
  /** One veil per sign, the page's sign first, in zodiac order. */
  signs: { d: string; t: number }[];
  planets: HoroscopeWheelStoryPlanet[];
}

/**
 * The geometry of the entrance laid over the wheel image on a horoscope page:
 * the same frame, anchor and nudged planet places the image is drawn with
 * (wheelFrame and collisionNudge), so the veil sits exactly on the picture.
 * Times follow the ring as it goes round from the page's sign; the planets
 * the reading draws on are held for the closing beat.
 */
export function horoscopeWheelStory({
  daily,
  signSlug,
  focus,
}: {
  daily: Daily;
  signSlug: string;
  focus: readonly string[];
}): HoroscopeWheelStory {
  const signIndex = SIGNS.findIndex((sign) => sign.slug === signSlug);
  if (signIndex < 0) throw new Error(`Unknown sign ${signSlug}`);
  const anchor = signIndex * 30;
  const size = WHEEL_DRAW_SIZE;
  const { rSigns, rSignsIn, rBodies, rMarker, pad, pt } = wheelFrame(size, anchor);
  const n = (value: number) => String(Math.round(value * 10) / 10);
  const at = (lon: number, r: number) => {
    const p = pt(lon, r);
    return `${n(p.x)} ${n(p.y)}`;
  };
  const { ring: RING, focus: FOCUS, focusStep } = HOROSCOPE_WHEEL_STORY;
  // The band runs from just inside the planets' ticks to just outside the ring.
  const inner = rSignsIn - size * 0.016;
  const outer = rSigns + 1.5;
  const band = { r: Math.round(((inner + outer) / 2) * 10) / 10, width: Math.round((outer - inner) * 10) / 10 };
  const signs = Array.from({ length: 12 }, (_, i) => ({
    d: `M${at(anchor + i * 30, band.r)}A${band.r} ${band.r} 0 0 0 ${at(anchor + i * 30 + 30, band.r)}`,
    t: Math.round((i / 12) * RING),
  }));
  const ring = `M${at(anchor, rSigns)}A${rSigns} ${rSigns} 0 1 0 ${at(anchor + 180, rSigns)}A${rSigns} ${rSigns} 0 1 0 ${at(anchor + 360, rSigns)}`;
  const bodies = wheelBodies(daily);
  const drawLon = collisionNudge(bodies);
  const lit = new Set(focus);
  let step = 0;
  const planets = bodies.map((body) => {
    const lon = drawLon.get(body.body) ?? body.lon;
    const p = pt(lon, rBodies);
    const along = ((((lon - anchor) % 360) + 360) % 360) / 360;
    const isFocus = lit.has(body.body);
    return {
      body: body.body,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      r: Math.round((rMarker + (body.retrograde ? size * 0.02 : size * 0.005)) * 10) / 10,
      t: isFocus ? FOCUS + Math.min(step++, 4) * focusStep : Math.round(along * RING),
      focus: isFocus,
    };
  });
  return {
    viewBox: `${n(-pad)} ${n(-pad)} ${n(size + pad * 2)} ${n(size + pad * 2)}`,
    ring,
    band,
    signs,
    planets,
  };
}
