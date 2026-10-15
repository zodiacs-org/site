/**
 * The personal dates behind the downloadable sky calendar: solar returns,
 * Jupiter and Saturn returns and the Uranus opposition, and the slow planets'
 * exact contacts to the natal Sun and (with a birth time) Moon. Runs in the
 * browser beside full.ts (a worker in the page); nothing here leaves the
 * device.
 */
import type { Chart } from '../engine/types';
import { solarReturnInstant } from '../engine/solar-return';
import { lifeMilestones, type MilestoneKind } from '../occasions/milestones';
import { scanTransitContacts, type TransitContact } from '../engine/transit-scan';
import { clipToReferenceSpan } from '../engine/reference-span';

const DAY = 86_400_000;
/** The calendar covers this many days from the moment it is made: 24 months. */
export const PERSONAL_WINDOW_DAYS = 730;
/** Scanned on each side of the window so a retrograde loop's passes are numbered in full. */
const PASS_MARGIN_DAYS = 400;

export const PERSONAL_TRANSIT_BODIES = ['Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export const PERSONAL_ASPECTS = ['conjunction', 'square', 'trine', 'opposition'] as const;

export interface PersonalMilestonePass {
  kind: MilestoneKind;
  /** 1 = first return; always 1 for the Uranus opposition. */
  index: number;
  pass: number;
  passCount: number;
  at: string;
  retrograde: boolean;
}

export interface PersonalSky {
  from: string;
  to: string;
  timeKnown: boolean;
  /** Natal Sun longitude, degrees. */
  sunLon: number;
  solarReturns: string[];
  milestones: PersonalMilestonePass[];
  contacts: TransitContact[];
}

export function personalWindow(now: Date): { from: Date; to: Date } {
  if (!Number.isFinite(now.getTime())) throw new RangeError('The calendar needs a valid start.');
  return { from: now, to: new Date(now.getTime() + PERSONAL_WINDOW_DAYS * DAY) };
}

function inside(at: number, from: Date, to: Date): boolean {
  return at >= from.getTime() && at < to.getTime();
}

export function personalSky(chart: Chart, from: Date, to: Date): PersonalSky {
  const birth = chart.input.utc;
  if (!Number.isFinite(birth.getTime())) throw new RangeError('The chart needs a valid birth instant.');
  if (birth.getTime() > from.getTime()) throw new RangeError('The birth is after the start of the calendar.');
  const window = clipToReferenceSpan(from, to);
  if (!window || window.from.getTime() !== from.getTime()) throw new RangeError('The calendar window is outside the supported years.');
  const end = window.to;
  const sun = chart.bodies.find((body) => body.body === 'Sun');
  if (!sun) throw new RangeError('The chart has no Sun.');
  const timeKnown = chart.input.timeKnown;

  // One solar return falls near each birthday; ask for the one nearest the
  // anniversary in every year the window touches and keep those inside it.
  const solar = new Set<number>();
  for (let year = from.getUTCFullYear(); year <= end.getUTCFullYear() + 1; year += 1) {
    const near = new Date(Date.UTC(year, birth.getUTCMonth(), Math.min(birth.getUTCDate(), 28), 12));
    if (near.getUTCFullYear() >= 2200) break;
    const at = solarReturnInstant(sun.lon, near).getTime();
    if (inside(at, from, end)) solar.add(at);
  }

  const milestones = lifeMilestones(birth, from).milestones.flatMap((milestone) =>
    milestone.passes.map((pass, i) => ({
      kind: milestone.kind,
      index: milestone.index,
      pass: i + 1,
      passCount: milestone.passes.length,
      at: pass.at,
      retrograde: pass.retrograde,
    })))
    .filter((pass) => inside(Date.parse(pass.at), from, end))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const scan = clipToReferenceSpan(new Date(from.getTime() - PASS_MARGIN_DAYS * DAY), new Date(end.getTime() + PASS_MARGIN_DAYS * DAY))!;
  const contacts = scanTransitContacts(
    { bodies: chart.bodies, angles: null },
    scan.from,
    scan.to,
    {
      transitBodies: PERSONAL_TRANSIT_BODIES,
      natalPoints: timeKnown ? ['Sun', 'Moon'] : ['Sun'],
      aspects: PERSONAL_ASPECTS,
    },
  ).filter((contact) => inside(Date.parse(contact.exactUtc), from, end));

  return {
    from: from.toISOString(),
    to: end.toISOString(),
    timeKnown,
    sunLon: sun.lon,
    solarReturns: [...solar].sort((a, b) => a - b).map((at) => new Date(at).toISOString()),
    milestones,
    contacts,
  };
}
