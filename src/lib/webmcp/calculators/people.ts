/**
 * The tools of the pages that read one person's chart against something else: two people (/compatibility/), the sky
 * now (/transits/), the public directory (/chart-twins/) and a group (/group-charts/). Each person's chart is the
 * pages' shared resolver (chart.ts personNatal); people.test.ts runs each island's own code beside this.
 */
import * as engine from '../../engine/full';
import { findInterAspects, summarizePair } from '../../engine/synastry';
import { groupReading } from '../../sharing/group';
import { matchTwins, twinSigns, type TwinPerson } from '../../sharing/twins';
import { signBySlug } from '../../signs';
import { TRANSIT_ORB } from '../../transits';
import { personNatal, type NatalReading } from './chart';
import { ENGINE, fixed, pageUrl, position } from './format';
import type { Birth } from './input';


/** A person as the pages show one: the big three (rising only with a birth time) and how the instant was read. */
function person({ chart, localMeanTime }: NatalReading) {
  const sun = chart.bodies.find((body) => body.body === 'Sun')!;
  const moon = chart.bodies.find((body) => body.body === 'Moon')!;
  return {
    timeKnown: chart.input.timeKnown,
    basis: chart.input.timeKnown ? 'birth-time' as const : 'local-noon' as const,
    computedUtc: chart.input.utc.toISOString(),
    flags: [...chart.flags],
    localMeanTime,
    sun: position(sun.lon),
    moon: position(moon.lon),
    rising: chart.angles ? position(chart.angles.asc) : null,
  };
}

/** /compatibility/ (SynastryCalculator): the contacts between two charts, the eight it ranks first, and the balances. */
export async function compatibilityResult(first: Birth, second: Birth) {
  const a = await personNatal(first);
  const b = await personNatal(second);
  const minimal = ({ chart }: NatalReading) => chart.bodies.map(({ body, lon }) => ({ body, lon }));
  const summary = summarizePair(minimal(a), minimal(b), 8);
  return {
    people: [person(a), person(b)],
    topContacts: summary.top.map((contact) => ({
      first: contact.a, second: contact.b, type: contact.type, orb: fixed(contact.orb),
    })),
    contactCount: summary.aspects.length,
    counts: summary.counts,
    easeful: summary.easeful,
    charged: summary.charged,
    elements: { first: summary.elements.a, second: summary.elements.b },
    modalities: { first: summary.modalities.a, second: summary.modalities.b },
    engine: ENGINE,
    page: pageUrl('/compatibility/'),
  };
}

/** TransitTracker's sky bodies: the Sun, the Moon and the eight planets. */
export const TRANSIT_BODIES: ReadonlySet<string> = new Set([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);

/**
 * /transits/ (TransitTracker and its ring): the sky at an instant and each transiting planet's contact with the
 * natal chart within the page's orb. The transiting Moon makes no contact; without a birth time neither does the
 * natal Moon.
 */
export async function transitsResult(birth: Birth, at: Date) {
  const natal = await personNatal(birth);
  const timeKnown = natal.chart.input.timeKnown;
  const natalPoints = natal.chart.bodies
    .filter((body) => timeKnown || body.body !== 'Moon')
    .map(({ body, lon }) => ({ body, lon }));
  const sky = engine.computeBodies(at)
    .filter((body) => TRANSIT_BODIES.has(body.body))
    .map(({ body, lon, retrograde }) => ({ body, lon, retrograde }));
  const transiting = sky.filter((body) => body.body !== 'Moon').map(({ body, lon }) => ({ body, lon }));
  const contacts = findInterAspects(transiting, natalPoints).filter((hit) => hit.orb <= TRANSIT_ORB);
  return {
    at: at.toISOString(),
    natal: person(natal),
    sky: sky.map((body) => ({ body: body.body, ...position(body.lon), retrograde: body.retrograde })),
    contacts: contacts.map((hit) => ({ transiting: hit.a, natal: hit.b, type: hit.type, orb: fixed(hit.orb) })),
    orbLimit: TRANSIT_ORB,
    engine: ENGINE,
    page: pageUrl('/transits/'),
  };
}

const signName = (slug: string | null) => (slug === null ? null : signBySlug(slug).name);

/**
 * /chart-twins/ (ChartTwins): the Sun sign (when the date settles it) and the Moon sign (with a birth time), and the
 * public figures who share them, both first.
 */
export async function chartTwinsResult(birth: Birth, directory: readonly TwinPerson[]) {
  const natal = await personNatal(birth);
  const signs = twinSigns(natal.chart);
  const matches = matchTwins(signs, directory);
  return {
    timeKnown: natal.chart.input.timeKnown,
    computedUtc: natal.chart.input.utc.toISOString(),
    sunSign: signName(signs.sun),
    moonSign: signName(signs.moon),
    matches: matches.map((match) => ({
      name: match.person.name,
      page: pageUrl(`/people/${match.person.slug}/`),
      shares: match.count === 2 ? 'sun-and-moon' as const : match.sun ? 'sun' as const : 'moon' as const,
      sunSign: signName(match.person.sun),
      moonSign: signName(match.person.moon),
    })),
    engine: ENGINE,
    page: pageUrl('/chart-twins/'),
  };
}

export interface GroupMember { name: string; birth: Birth }

/**
 * /group-charts/ (GroupCharts): each person's element role from the placements their chart settles. Two people with
 * the same name and the same birth are one person entered twice.
 */
export async function groupChartResult(members: readonly GroupMember[]) {
  const seen = new Set<string>();
  const people = [];
  for (const member of members) {
    const natal = await personNatal(member.birth);
    const { date, time, place } = member.birth;
    const duplicate = `${member.name.toLocaleLowerCase()}|${date}|${time ?? '?'}|${place.latitude}|${place.longitude}`;
    if (seen.has(duplicate)) throw new DuplicatePersonError();
    seen.add(duplicate);
    const reading = groupReading(natal.chart);
    people.push({
      name: member.name,
      timeKnown: natal.chart.input.timeKnown,
      computedUtc: natal.chart.input.utc.toISOString(),
      role: reading.role,
      counts: reading.counts,
      placements: reading.placements.map((placement) => ({
        body: placement.body, sign: signBySlug(placement.sign).name, element: placement.element,
      })),
    });
  }
  return { people, engine: ENGINE, page: pageUrl('/group-charts/') };
}

export class DuplicatePersonError extends Error {
  constructor() {
    super('The same person is entered twice.');
    this.name = 'DuplicatePersonError';
  }
}
