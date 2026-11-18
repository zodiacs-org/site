/**
 * A Year Ahead directory figure's score for its share card, worked out on the
 * server from the directory (src/data/year-people.json), never read from the
 * link. The same chart and window as the figure's page (src/pages/year/): a
 * noon chart on the birthplace clock, scored for the twelve months from the
 * first day of the link's month (m=), or of this month (UTC) for a link
 * without one. Results are kept per figure and month for the life of the
 * function instance: at most one entry per directory figure per month. The server ephemeris is loaded only on this
 * path, as the invitation route loads it (src/lib/invite/routes/invites.ts).
 */
import { createLocalTimeModule } from '../../api/_compute/local-time.mjs';
import { scoreYear, type SlowPlanet } from '../lib/year-score/core.js';
import { findYearPerson, yearPageStart, type YearPerson } from '../lib/year-score/people.js';
import { scoreTier } from '../lib/year-score/tier.js';
import { signIndexForLongitude, SIGNS } from '../lib/signs.js';

export interface FigureYearScore {
  person: YearPerson;
  sun: string;
  score: number;
  label: string;
  from: string;
}

const CACHE = new Map<string, Promise<FigureYearScore>>();

/** Null for a slug the directory does not have. `month` (YYYY-MM) pins the start; without it, this month. */
export async function figureYearScore(slug: string, now: Date, month?: string | null): Promise<FigureYearScore | null> {
  const person = findYearPerson(slug);
  if (!person || person.slug !== slug) return null;
  const from = month ? `${month}-01` : yearPageStart(now);
  const key = `${slug}|${from}`;
  let pending = CACHE.get(key);
  if (!pending) {
    pending = scoreFigure(person, from);
    CACHE.set(key, pending);
    // A failure is not kept, so the next request tries again.
    pending.catch(() => CACHE.delete(key));
  }
  return pending;
}

async function scoreFigure(person: YearPerson, from: string): Promise<FigureYearScore> {
  const { bodyLongitude } = await import('../lib/engine/server-ephemeris.js');
  const clock = createLocalTimeModule();
  let utc: Date;
  try {
    await clock.prepareLocalTime(person.birthDate, person.zone);
    utc = clock.resolveLocalToUtc(person.birthDate, person.birthTime ?? '12:00', person.zone).utc;
  } finally { clock.dispose(); }
  const at = (body: 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars') => bodyLongitude(body, utc);
  const year = scoreYear(
    { Sun: at('Sun'), Moon: person.birthTime ? at('Moon') : null, Mercury: at('Mercury'), Venus: at('Venus'), Mars: at('Mars') },
    (body: SlowPlanet, date: Date) => bodyLongitude(body, date),
    new Date(`${from}T00:00:00Z`),
  );
  return { person, sun: SIGNS[signIndexForLongitude(at('Sun'))].slug, score: year.score, label: scoreTier(year.score).label, from };
}
