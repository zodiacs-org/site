/**
 * A Year Ahead directory figure's score for its share card, worked out on the
 * server from the directory (src/data/year-people.json), never read from the
 * link. The same chart and window as the figure's page (src/pages/year/): a
 * noon chart on the birthplace clock, scored for the twelve months from the
 * first day of this month (UTC). The server ephemeris is loaded only on this
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

/** Null for a slug the directory does not have. */
export async function figureYearScore(slug: string, now: Date): Promise<FigureYearScore | null> {
  const person = findYearPerson(slug);
  if (!person || person.slug !== slug) return null;
  const { bodyLongitude } = await import('../lib/engine/server-ephemeris.js');
  const clock = createLocalTimeModule();
  let utc: Date;
  try {
    await clock.prepareLocalTime(person.birthDate, person.zone);
    utc = clock.resolveLocalToUtc(person.birthDate, person.birthTime ?? '12:00', person.zone).utc;
  } finally { clock.dispose(); }
  const at = (body: 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars') => bodyLongitude(body, utc);
  const from = yearPageStart(now);
  const year = scoreYear(
    { Sun: at('Sun'), Moon: person.birthTime ? at('Moon') : null, Mercury: at('Mercury'), Venus: at('Venus'), Mars: at('Mars') },
    (body: SlowPlanet, date: Date) => bodyLongitude(body, date),
    new Date(`${from}T00:00:00Z`),
  );
  return { person, sun: SIGNS[signIndexForLongitude(at('Sun'))].slug, score: year.score, label: scoreTier(year.score).label, from };
}
