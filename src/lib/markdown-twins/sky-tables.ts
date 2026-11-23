/**
 * The dated tables of the three sky calendar pages, computed from the same
 * committed data with the same formatters as the pages' own frontmatter
 * (src/pages/mercury-retrograde/, full-moon-calendar/ and eclipses/), for
 * their Markdown twins. The pages are left as they are; the twins' parity test
 * compares every row and status line here with the built HTML, so a change on
 * either side that the other does not share fails the test.
 */
import sky from '../../data/sky.json';
import eclipseData from '../../data/eclipses.json';
import { bodyLongitude } from '../engine/full';
import { formatLongitude, signBySlug, signForLongitude } from '../signs';
import { formatDate, formatShortDate, formatTime } from '../i18n/dates';
import { isInvisiblePenumbral, lunarTotalityMinutes } from '../nasa-lunar-eclipses';

type Retrograde = { planet: string; from: string; to: string | null };

const span = (from: string, to: string) => ({
  firstYear: new Date(from).getUTCFullYear(),
  lastYear: new Date(Date.parse(to) - 1).getUTCFullYear(),
});

const longDay = (d: Date) => formatDate('en', d, { month: 'long', day: 'numeric', timeZone: 'UTC' });
const tableDay = (d: Date) =>
  formatDate('en', d, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const tableTime = (d: Date) => formatTime('en', d, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });

export function mercuryRetrogradeTable(now = new Date()) {
  const { firstYear, lastYear } = span(sky.from, sky.to);
  const windows = (sky.retrogrades as Retrograde[])
    .filter((r) => r.planet === 'Mercury')
    .map((r) => {
      const from = new Date(r.from);
      const to = r.to ? new Date(r.to) : null;
      const fmt = (d: Date) => formatShortDate('en', d);
      return {
        from,
        to,
        label: `${fmt(from)} to ${to ? fmt(to) : 'ongoing'}`,
        stationRx: formatLongitude(bodyLongitude('Mercury', from)),
        stationDirect: to ? formatLongitude(bodyLongitude('Mercury', to)) : null,
        state: to && to < now ? 'past' : from > now ? 'upcoming' : 'active',
      };
    });
  const active = windows.find((w) => w.state === 'active');
  const next = windows.find((w) => w.state === 'upcoming');
  const status = active
    ? `Mercury is retrograde right now. It stations direct on ${longDay(active.to!)}.`
    : next
      ? `Mercury is direct right now. The next retrograde runs ${longDay(next.from)} to ${longDay(next.to!)}, ${next.to!.getUTCFullYear()}.`
      : 'Mercury is direct right now.';
  const retroToday = (sky.retrogrades as Retrograde[])
    .filter((r) => new Date(r.from) <= now && (!r.to || new Date(r.to) >= now))
    .map((r) => r.planet);
  return {
    firstYear,
    lastYear,
    asOf: formatShortDate('en', now),
    status,
    retroToday: retroToday.length ? retroToday.join(', ') : 'nothing',
    tableThrough: windows.at(-1)?.to?.getUTCFullYear() ?? lastYear,
    rows: windows.map((w) => [w.label, w.stationRx, w.stationDirect ?? '']),
  };
}

/** North American almanac tradition, keyed by month; the second full moon in one calendar month is a blue moon. */
const MONTH_NAMES = ['Wolf', 'Snow', 'Worm', 'Pink', 'Flower', 'Strawberry', 'Buck', 'Sturgeon', 'Corn', 'Hunter’s', 'Beaver', 'Cold'];

export function fullMoonTable(now = new Date()) {
  const { firstYear, lastYear } = span(sky.from, sky.to);
  const seen = new Set<string>();
  const fulls = (sky.moons as { type: string; at: string }[])
    .filter((m) => m.type === 'full')
    .map(({ at }) => {
      const date = new Date(at);
      const monthKey = at.slice(0, 7);
      const second = seen.has(monthKey);
      seen.add(monthKey);
      const lon = bodyLongitude('Moon', date);
      return {
        at: date,
        year: date.getUTCFullYear(),
        name: second ? 'Blue' : MONTH_NAMES[date.getUTCMonth()],
        position: formatLongitude(lon),
        sign: signForLongitude(lon),
        past: date < now,
      };
    });
  const next = fulls.find((f) => !f.past);
  const status = next
    ? `The next full moon is the ${next.name} Moon on ${tableDay(next.at)}, at ${next.position}.`
    : 'Later full moon dates are not available yet.';
  const years = [...new Set(fulls.map((f) => f.year))];
  return {
    firstYear,
    lastYear,
    asOf: formatShortDate('en', now),
    status,
    years: years.map((year) => ({
      year,
      rows: fulls.filter((f) => f.year === year).map((f) => [
        tableDay(f.at), tableTime(f.at), f.position, f.name === 'Blue' ? 'Blue moon' : `${f.name} Moon`,
      ]),
    })),
  };
}

interface EclipseEntry { type: 'solar' | 'lunar'; kind: string; peak: string; sign: string; obscuration?: number; totalMinutes?: number }

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
const capArticle = (word: string) => (article(word) === 'an' ? 'An' : 'A');

export function eclipseTable(now = new Date()) {
  const { firstYear, lastYear } = span(eclipseData.from, eclipseData.to);
  const eclipses = (eclipseData.eclipses as EclipseEntry[]).map((e) => {
    const at = new Date(e.peak);
    const pct = typeof e.obscuration === 'number' ? Math.round(e.obscuration * 100) : null;
    let detail: string;
    if (e.type === 'solar') {
      detail = e.kind === 'total'
        ? 'totality, the Sun fully covered along the track'
        : e.kind === 'annular'
          ? `ring eclipse, ${pct}% of the Sun covered at maximum`
          : 'partial only';
    } else {
      detail = e.kind === 'total'
        ? `totality lasts about ${lunarTotalityMinutes(e.peak, e.totalMinutes)} minutes`
        : e.kind === 'partial'
          ? `${pct}% of the Moon in shadow at maximum`
          : isInvisiblePenumbral(e.peak, e.kind)
            ? 'penumbral, so slight that no eye or camera will see it'
            : 'penumbral, a subtle shading, easy to miss';
    }
    return {
      ...e,
      at,
      sign: signBySlug(e.sign),
      detail,
      label: `${e.kind === 'annular' ? 'Annular' : e.kind[0].toUpperCase() + e.kind.slice(1)} ${e.type}`,
      past: at < now,
    };
  });
  const next = eclipses.find((e) => !e.past);
  const nextSolar = eclipses.find((e) => !e.past && e.type === 'solar');
  const nextLunar = eclipses.find((e) => !e.past && e.type === 'lunar');
  return {
    firstYear,
    lastYear,
    asOf: formatShortDate('en', now),
    status: next
      ? `The next eclipse is ${article(next.label)} ${next.label.toLowerCase()} eclipse on ${tableDay(next.at)}, in ${next.sign.name}.`
      : 'Later eclipse dates are not available yet.',
    nextSolar: nextSolar
      ? `${capArticle(nextSolar.kind)} ${nextSolar.kind} solar eclipse peaks on ${tableDay(nextSolar.at)}, with the Sun in ${nextSolar.sign.name}. Solar eclipses are only visible from a limited track. For the August 12, 2026 total eclipse, totality crosses Greenland, western Iceland, and northern Spain.`
      : 'Later solar eclipse dates are not available yet.',
    nextLunar: nextLunar
      ? `${capArticle(nextLunar.kind)} ${nextLunar.kind} lunar eclipse peaks on ${tableDay(nextLunar.at)}, with the Moon in ${nextLunar.sign.name}. Unlike solar eclipses, a lunar eclipse is visible from the entire night side of Earth at once.`
      : 'Later lunar eclipse dates are not available yet.',
    rows: eclipses.map((e) => [tableDay(e.at), tableTime(e.at), e.label, e.sign.name, e.detail]),
  };
}
