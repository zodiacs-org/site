/**
 * Facts for the localized horoscope periods, read from the English program's
 * receipts (see ./types.ts). The localized text is written by the locale
 * modules; this file only decides what is true on each passage.
 */
import programJson from '../../../data/horoscope-program.json';
import eclipsesJson from '../../../data/eclipses.json';
import { solarHouse } from '../../daily';
import { exactInstant } from '../../nasa-instants';
import type {
  HoroscopeEvidenceReceipt,
  HoroscopeProgram,
  HoroscopeReading,
  HoroscopeSign,
} from '../../horoscope-program-types';
import type {
  EventFact,
  Fact,
  HoroscopeLocaleModule,
  LocalizedPassage,
  MonthlyContext,
  PassageFacts,
  PeriodContext,
  PeriodSurface,
} from './types';

export const program = programJson as unknown as HoroscopeProgram;
const evidence = new Map(program.evidence.map((receipt) => [receipt.id, receipt]));

export const PERIOD_SURFACES: readonly PeriodSurface[] = ['tomorrow', 'weekly', 'love', 'career', 'yearly-2026', 'yearly-2027'];

export function englishReading(sign: HoroscopeSign, surface: PeriodSurface): HoroscopeReading {
  const entry = program.signs.find((candidate) => candidate.sign === sign);
  if (!entry) throw new Error(`horoscope program has no sign ${sign}`);
  return entry.readings[surface];
}

function receipt(id: string): HoroscopeEvidenceReceipt {
  const found = evidence.get(id);
  if (!found) throw new Error(`horoscope program is missing receipt ${id}`);
  return found;
}

function houseFor(refs: HoroscopeEvidenceReceipt[], sourceId: string, body?: string): number | undefined {
  return refs.find((ref) => ref.kind === 'solar-house'
    && ref.sourceFactId === sourceId
    && (body === undefined || ref.body === body))?.house;
}

/** The facts behind one English passage, de-duplicated, in the passage's order. */
export function factsFromRefs(ids: string[]): Fact[] {
  const refs = ids.map(receipt);
  const facts: Fact[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    if (seen.has(ref.id)) continue;
    if (ref.kind === 'body-position' && ref.body && ref.sign) {
      const house = houseFor(refs, ref.id);
      if (!house) continue;
      seen.add(ref.id);
      facts.push({ kind: 'position', body: ref.body, sign: ref.sign, house, at: ref.at, retrograde: Boolean(ref.retrograde) });
    } else if (ref.kind === 'sky-event' && ref.eventKind) {
      seen.add(ref.id);
      const kind = ref.eventKind as EventFact['eventKind'];
      if (kind === 'aspect' && ref.a && ref.b) {
        const aHouse = houseFor(refs, ref.id, ref.a);
        const bHouse = houseFor(refs, ref.id, ref.b);
        const aRef = refs.find((candidate) => candidate.kind === 'solar-house' && candidate.sourceFactId === ref.id && candidate.body === ref.a);
        const bRef = refs.find((candidate) => candidate.kind === 'solar-house' && candidate.sourceFactId === ref.id && candidate.body === ref.b);
        facts.push({
          kind: 'event', eventKind: 'aspect', eventType: ref.eventType, a: ref.a, b: ref.b,
          aSign: aRef?.sign, bSign: bRef?.sign,
          houses: [aHouse, bHouse].filter((house): house is number => Boolean(house)),
          // NASA's instant, as the English pages print it (horoscope-page-data.ts withNasaInstant).
          at: ref.eventType ? exactInstant({ kind: 'aspect', a: ref.a, b: ref.b, type: ref.eventType, at: ref.at }) : ref.at,
        });
      } else {
        const house = houseFor(refs, ref.id);
        const at = (kind === 'ingress' || kind === 'station') && ref.body
          ? exactInstant({ kind, body: ref.body, at: ref.at })
          : ref.at;
        facts.push({
          kind: 'event', eventKind: kind, eventType: ref.eventType, body: ref.body, sign: ref.sign,
          houses: house ? [house] : [], at, degree: ref.degree,
        });
      }
    }
  }
  return facts;
}

export function periodContext(sign: HoroscopeSign, surface: PeriodSurface): PeriodContext {
  const reading = englishReading(sign, surface);
  if (reading.status !== 'publishable') {
    throw new Error(`English ${surface} for ${sign} is not publishable; the localized edition follows it`);
  }
  const passages: PassageFacts[] = reading.passages.map((passage, index) => ({
    index,
    facts: factsFromRefs(passage.evidenceRefs),
  }));
  return { sign, surface, from: reading.period.from, through: reading.period.through, passages };
}

export interface LocalizedPeriodReading {
  surface: PeriodSurface;
  sign: HoroscopeSign;
  from: string;
  through: string;
  passages: Array<LocalizedPassage & { evidenceRefs: string[] }>;
  /** Every fact the reading rests on, once, in time order, for the sky list. */
  facts: Fact[];
}

function uniqueFacts(passages: PassageFacts[]): Fact[] {
  const seen = new Set<string>();
  const out: Fact[] = [];
  for (const fact of passages.flatMap((passage) => passage.facts)) {
    const key = fact.kind === 'position' ? `p:${fact.body}:${fact.at}` : `e:${fact.eventKind}:${fact.at}:${fact.body ?? fact.a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fact);
  }
  return out.sort((left, right) => left.at.localeCompare(right.at));
}

export function localizedPeriodReading(
  module: HoroscopeLocaleModule,
  sign: HoroscopeSign,
  surface: PeriodSurface,
): LocalizedPeriodReading {
  const ctx = periodContext(sign, surface);
  const english = englishReading(sign, surface);
  const written = module.period(ctx);
  if (written.length !== english.passages.length) {
    throw new Error(`${module.locale} ${surface} ${sign}: wrote ${written.length} passages for ${english.passages.length}`);
  }
  return {
    surface,
    sign,
    from: ctx.from,
    through: ctx.through,
    passages: written.map((passage, index) => ({ ...passage, evidenceRefs: english.passages[index].evidenceRefs })),
    facts: uniqueFacts(ctx.passages),
  };
}

// ── Monthly: from the committed transit catalog, counted from the sign ──

interface TransitFileLike {
  month: string;
  ingresses: { planet: string; at: string; sign: string; retrograde: boolean }[];
  lunations: { type: string; at: string; sign: string; degree: number }[];
  stations: { planet: string; at: string; type: string; sign: string; degree: number }[];
  aspects: { a: string; b: string; type: string; at: string; aSign: string; bSign: string }[];
}

const ECLIPSES = (eclipsesJson as { eclipses: Array<{ type: string; peak: string; sign: string }> }).eclipses;
const DAY = 86_400_000;

/** A lunation within a day of a computed eclipse is that eclipse, so the month and the eclipse pages agree. */
function eclipseFor(at: string): string | undefined {
  const time = Date.parse(at);
  return ECLIPSES.find((eclipse) => Math.abs(Date.parse(eclipse.peak) - time) < DAY)?.type;
}

export function monthlyContext(sign: HoroscopeSign, transits: TransitFileLike): MonthlyContext {
  const events: EventFact[] = [
    ...transits.lunations.map((event): EventFact => {
      const eclipse = eclipseFor(event.at);
      return {
        kind: 'event',
        eventKind: eclipse ? 'eclipse' : 'lunation',
        eventType: eclipse ?? event.type,
        body: 'Moon',
        sign: event.sign,
        houses: [solarHouse(event.sign, sign)],
        at: event.at,
        degree: event.degree,
      };
    }),
    ...transits.stations.map((event): EventFact => ({
      kind: 'event', eventKind: 'station', eventType: event.type, body: event.planet, sign: event.sign,
      houses: [solarHouse(event.sign, sign)], at: event.at, degree: event.degree,
    })),
    ...transits.ingresses.filter((event) => event.planet !== 'Moon').map((event): EventFact => ({
      kind: 'event', eventKind: 'ingress', body: event.planet, sign: event.sign,
      houses: [solarHouse(event.sign, sign)], at: event.at,
    })),
    ...transits.aspects.map((event): EventFact => ({
      kind: 'event', eventKind: 'aspect', eventType: event.type, a: event.a, b: event.b,
      aSign: event.aSign, bSign: event.bSign,
      houses: [solarHouse(event.aSign, sign), solarHouse(event.bSign, sign)], at: event.at,
    })),
  ].sort((left, right) => left.at.localeCompare(right.at));
  return { sign, month: transits.month, events };
}

export function localizedMonthlyReading(module: HoroscopeLocaleModule, sign: HoroscopeSign, transits: TransitFileLike) {
  const ctx = monthlyContext(sign, transits);
  return { month: ctx.month, sign, passages: module.monthly(ctx), facts: ctx.events };
}
