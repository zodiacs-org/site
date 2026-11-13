/**
 * The return-visit pages' tools, read as ReturnPersonal reads them (return-visits.test.ts runs the island's code beside
 * this): /astrologer-kit/'s chart as the PDF it makes prints it, and /your-sky-wrapped/'s year of Jupiter and Saturn
 * contacts as its worker (Wrapped.worker.ts) scans them. Each person's chart is the sharing pages' resolver.
 */
import { scanTransitContacts } from '../../engine/transit-scan';
import { wrappedTargets, wrappedWindow } from '../../return-visits/wrapped';
import { personNatal } from './chart';
import { ENGINE, fixed, pageUrl, position } from './format';
import type { Birth } from './input';

/** ReturnPersonal refuses a chart the engine flags as outside its reference span. */
export class OutsideReferenceSpanError extends Error {
  constructor() {
    super('The birth date is outside the reference span.');
    this.name = 'OutsideReferenceSpanError';
  }
}

async function returnVisitNatal(birth: Birth) {
  const reading = await personNatal(birth);
  if (reading.chart.flags.includes('outside-reference-span')) throw new OutsideReferenceSpanError();
  return reading;
}

/**
 * /astrologer-kit/ (Chart PDF): what the PDF prints, as data: each body's position and motion, the angles and house
 * cusps with a birth time, and the aspects (without a birth time, none of the Moon's). The page's button makes the file.
 */
export async function chartPdfResult(birth: Birth) {
  const { chart, localMeanTime } = await returnVisitNatal(birth);
  const timeKnown = chart.input.timeKnown;
  const aspects = timeKnown ? chart.aspects : chart.aspects.filter((aspect) => aspect.a !== 'Moon' && aspect.b !== 'Moon');
  return {
    timeKnown,
    basis: timeKnown ? 'birth-time' as const : 'local-noon' as const,
    computedUtc: chart.input.utc.toISOString(),
    flags: [...chart.flags],
    localMeanTime,
    houseSystem: chart.houses?.system ?? null,
    positions: chart.bodies.map((body) => ({ body: body.body, ...position(body.lon), retrograde: body.retrograde })),
    angles: chart.angles ? {
      ascendant: position(chart.angles.asc),
      midheaven: position(chart.angles.mc),
      descendant: position(chart.angles.dsc),
      imumCoeli: position(chart.angles.ic),
    } : null,
    houses: chart.houses ? chart.houses.cusps.map((cusp, index) => ({ house: index + 1, cusp: position(cusp) })) : null,
    aspects: aspects.map((aspect) => ({
      a: aspect.a, b: aspect.b, type: aspect.type, orb: fixed(aspect.orb), applying: aspect.applying,
    })),
    engine: ENGINE,
    page: pageUrl('/astrologer-kit/'),
  };
}

/**
 * /your-sky-wrapped/: a year's exact Jupiter and Saturn conjunctions, squares and oppositions to the natal Sun, and with
 * a birth time to the Moon and the rising degree, each with its UTC instant.
 */
export async function yearWrappedResult(birth: Birth, year: number, now: Date) {
  const { chart } = await returnVisitNatal(birth);
  const { from, to } = wrappedWindow(year);
  const contacts = scanTransitContacts({ bodies: chart.bodies, angles: chart.input.timeKnown ? chart.angles : null }, from, to, {
    transitBodies: ['Jupiter', 'Saturn'], natalPoints: wrappedTargets(chart), aspects: ['conjunction', 'square', 'opposition'],
  }).filter((contact) => new Date(contact.exactUtc).getUTCFullYear() === year);
  return {
    year,
    timeKnown: chart.input.timeKnown,
    computedUtc: chart.input.utc.toISOString(),
    natalPoints: wrappedTargets(chart).map((point) => (point === 'ASC' ? 'Rising' : point)),
    contacts: contacts.map((contact) => ({
      transiting: contact.transitBody,
      aspect: contact.aspect,
      natal: contact.natalPoint === 'ASC' ? 'Rising' : contact.natalPoint,
      exactUtc: contact.exactUtc,
      pass: contact.pass,
      passCount: contact.passCount,
      upcoming: Date.parse(contact.exactUtc) > now.getTime(),
    })),
    jupiterContacts: contacts.filter((contact) => contact.transitBody === 'Jupiter').length,
    saturnContacts: contacts.filter((contact) => contact.transitBody === 'Saturn').length,
    engine: ENGINE,
    page: pageUrl('/your-sky-wrapped/'),
  };
}
