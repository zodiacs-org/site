/**
 * The geometry of the horizon diagram: the zodiac wheel drawn the way the
 * chart wheel is, with the ascendant at nine o'clock and the zodiac running
 * counterclockwise, cut by the horizon line. Shared by HorizonDiagram.astro
 * (English) and the localized rising sign pages, which draw the same figure
 * with their own labels. Pure numbers, no markup.
 */
import { SIGNS, signForLongitude } from './signs';

export const HORIZON_R_OUT = 232;
export const HORIZON_R_IN = 178;
const R_DISC = (HORIZON_R_OUT + HORIZON_R_IN) / 2;

/** Two decimals, as the SVG attributes are written. */
export const horizonNumber = (n: number) => n.toFixed(2);

/* A fixed scatter of faint stars in the sky above the line. */
export const HORIZON_STARS: [number, number, number, number][] = [
  [94.2, -237.5, 1.13, 0.3], [-275.8, -132.7, 0.73, 0.32], [-268.4, -233.1, 1.04, 0.44], [-234.7, -201.2, 1.2, 0.48],
  [297.2, -243.8, 1.39, 0.27], [-222, -226.6, 0.95, 0.44], [-274.8, -205.4, 1.24, 0.32], [-116, -113.9, 1.06, 0.28],
  [15.7, -44.1, 1.28, 0.27], [299.6, -226.5, 1.03, 0.42], [-217.2, -137.2, 0.73, 0.39], [234.3, -179.4, 1.26, 0.37],
  [49.9, -145.1, 1.37, 0.48], [-16.2, -94.9, 0.75, 0.4], [91.8, -15.7, 1.36, 0.27], [-71.3, -93.9, 0.72, 0.33],
  [-207.1, -226.8, 0.75, 0.43], [-231.3, -195.3, 1.01, 0.46], [-261.7, -146.7, 1.14, 0.46], [-88.1, -41.9, 1.47, 0.23],
  [-202, -199.1, 0.89, 0.34], [-309.4, -154, 1, 0.36], [282.7, -88.6, 1.11, 0.38], [109.9, -242, 1.42, 0.43],
  [-247.4, -102.1, 0.75, 0.2], [-181.7, -215.9, 0.97, 0.2], [-311.9, -218.5, 0.78, 0.3], [-296.1, -44.3, 1.19, 0.23],
  [-21.2, -138.4, 0.77, 0.21],
];

/** Everything the figure draws for one ascendant (ecliptic longitude, degrees). */
export function horizonGeometry(asc: number) {
  const rising = signForLongitude(asc);
  const next = SIGNS[(SIGNS.findIndex((sign) => sign.slug === rising.slug) + 1) % 12];
  const f = horizonNumber;
  const at = (lon: number, r: number) => {
    const theta = ((180 + (lon - asc)) * Math.PI) / 180;
    return { x: r * Math.cos(theta), y: -r * Math.sin(theta) };
  };
  const segment = (from: number) => {
    const a = at(from, HORIZON_R_OUT);
    const b = at(from + 30, HORIZON_R_OUT);
    const c = at(from + 30, HORIZON_R_IN);
    const d = at(from, HORIZON_R_IN);
    return `M${f(a.x)},${f(a.y)} A${HORIZON_R_OUT},${HORIZON_R_OUT} 0 0 0 ${f(b.x)},${f(b.y)} L${f(c.x)},${f(c.y)} A${HORIZON_R_IN},${HORIZON_R_IN} 0 0 1 ${f(d.x)},${f(d.y)} Z`;
  };
  const signs = SIGNS.map((sign, index) => ({
    sign,
    path: segment(index * 30),
    disc: at(index * 30 + 15, R_DISC),
    isRising: sign.slug === rising.slug,
  }));
  const risingDisc = signs.find((item) => item.isRising)!.disc;
  const ticks = Array.from({ length: 72 }, (_, index) => {
    const lon = index * 5;
    const inner = at(lon, HORIZON_R_IN);
    const outer = at(lon, HORIZON_R_IN + (index % 2 === 0 ? 7 : 4));
    return { x1: f(inner.x), y1: f(inner.y), x2: f(outer.x), y2: f(outer.y) };
  });
  return { rising, next, signs, risingDisc, ticks, id: `hz-${rising.slug}` };
}
