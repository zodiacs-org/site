/**
 * One time for a planet's sign change across the connector (ZOD-63).
 *
 * get_upcoming_events and check_sky_fact solve a sign change with the vendored engine's crossing search,
 * which from engine 1.1.0 computes on the JPL DE440 pack it ships. search_sky_events and the year view of
 * get_horoscope_period list sign changes from the committed ingress table (src/data/ingresses.json), whose
 * instants come from astronomy-engine and can sit hours from the engine's for a slow planet. The table
 * still says which sign changes there are; the instant given for each is the engine's own, solved near the
 * table's, so every tool gives the same time for the same event.
 *
 * Pure: no network, storage or logging.
 */
import { searchLongitudeCrossings, type BodyName } from '@zodiacs/engine';
import { SIGNS } from '../../lib/signs';

const DAY = 86_400_000;

/** How far from the table's instant the engine's is looked for: the table's own match window for its NASA rows. */
export const ENGINE_INGRESS_WINDOW_DAYS = 2;

/** The longitude a planet crosses to enter `sign`: the sign's first degree moving forward, the next sign's moving backward. */
export function ingressBoundary(sign: string, retrograde: boolean): number {
  const index = SIGNS.findIndex((candidate) => candidate.slug === sign);
  if (index < 0) throw new RangeError(`Unknown sign ${sign}.`);
  return ((retrograde ? index + 1 : index) % 12) * 30;
}

/**
 * The engine's instant for a sign change the ingress table lists: the crossing of the sign's boundary in the
 * same direction nearest the table's instant, within two days of it. Where the engine finds none there (it
 * never has in the table's span), the table's instant is kept.
 */
export function engineIngressInstant(planet: string, sign: string, retrograde: boolean, tableAt: Date): Date {
  const boundary = ingressBoundary(sign, retrograde);
  const window = ENGINE_INGRESS_WINDOW_DAYS * DAY;
  const result = searchLongitudeCrossings(planet as BodyName, boundary, new Date(tableAt.getTime() - window), new Date(tableAt.getTime() + window), { stepDays: 1 });
  let best: Date | null = null;
  for (const crossing of result.crossings) {
    if (crossing.retrograde !== retrograde) continue;
    if (!best || Math.abs(crossing.at.getTime() - tableAt.getTime()) < Math.abs(best.getTime() - tableAt.getTime())) best = crossing.at;
  }
  return best ?? tableAt;
}
