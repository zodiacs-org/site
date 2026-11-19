import { describe, expect, it } from 'vitest';
import programData from '../data/horoscope-program.json';
import { alsoInSkyEvents, evidenceMap, horoscopeHubTeaser, pageReadingFromProgram } from './horoscope-page-data';
import type { HoroscopeEvidenceReceipt, HoroscopeProgram } from './horoscope-program';
import { eventsOnUtcDay, refineDailyEvents } from './nasa-instants';
import type { TransitCatalog } from './today-sky';

const program = programData as HoroscopeProgram;
const transitCatalogs = Object.values(import.meta.glob<{ default: TransitCatalog }>('../data/transits-*.json', { eager: true }))
  .map((module) => module.default);
const zodiacNamePattern = new RegExp(
  `\\b(?:${program.signs.map(({ sign }) => sign).join('|')})\\b`,
  'gu',
);

function normalizedTeaserTokens(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLowerCase()
    // Replacing rather than deleting sign names exposes boilerplate whose
    // only apparent difference is the interpolated sign.
    .replace(zodiacNamePattern, ' zodiac-sign ')
    .replace(/[^a-z0-9-]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}

function shingles(tokens: readonly string[], width = 3): Set<string> {
  const values = new Set<string>();
  for (let index = 0; index <= tokens.length - width; index += 1) {
    values.add(tokens.slice(index, index + width).join(' '));
  }
  return values;
}

function shingleSimilarity(left: string, right: string): number {
  const a = shingles(normalizedTeaserTokens(left));
  const b = shingles(normalizedTeaserTokens(right));
  const intersection = [...a].filter((value) => b.has(value)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : intersection / union;
}

// The receipts as the page cites them: planet events at NASA's instant.
function directEvidence(surface: 'today' | 'tomorrow') {
  const reading = program.signs.find(({ sign }) => sign === 'aries')?.readings[surface];
  const references = new Set(reading?.passages.flatMap((passage) => passage.evidenceRefs) ?? []);
  const cited = evidenceMap(program);
  return program.evidence
    .filter((receipt) => references.has(receipt.id))
    .map((receipt) => cited.get(receipt.id) ?? receipt);
}

// A fixed edition, 13 November 2026, whose Aries reading cites the noon Moon
// and one dated planet event, so the strip does not depend on today's data.
const FIXED_MOON: HoroscopeEvidenceReceipt = {
  id: 'fixture:2026-11-13:position:moon',
  kind: 'body-position',
  sourceId: 'fixture',
  label: 'Moon 7.7° Capricorn at 12:00 UTC',
  at: '2026-11-13T12:00:00.000Z',
  body: 'Moon',
  sign: 'capricorn',
  degree: 7.7,
  moonPhase: 'Waxing Crescent',
};

function fixedEdition(event: HoroscopeEvidenceReceipt): HoroscopeProgram {
  return {
    ...program,
    anchorDate: '2026-11-13',
    evidence: [FIXED_MOON, event],
    signs: program.signs.map((entry) => {
      if (entry.sign !== 'aries') return entry;
      const today = entry.readings.today;
      return {
        ...entry,
        readings: {
          ...entry.readings,
          today: {
            ...today,
            status: 'publishable',
            period: { from: '2026-11-13', through: '2026-11-13', utcBasis: true },
            passages: [
              { text: 'Fixture passage on the Moon.', evidenceRefs: [FIXED_MOON.id] },
              { text: 'Fixture passage on the event.', evidenceRefs: [event.id] },
            ],
          },
        },
      };
    }),
  };
}

describe('horoscope page sky strip', () => {
  it('does not inject a generic page-layer action after the evidence-backed reading', () => {
    for (const { sign } of program.signs) {
      for (const surface of ['today', 'tomorrow', 'weekly', 'love', 'career', 'year'] as const) {
        const reading = pageReadingFromProgram(program, sign, surface);
        expect('action' in reading, `${sign}/${surface} includes an uncited page-layer action`).toBe(false);
        expect(reading.sections.every((section) => section.body.length > 0)).toBe(true);
      }
    }
  });

  it.each(['today', 'tomorrow', 'weekly', 'love', 'career', 'year'] as const)(
    'derives concise %s markers from the reading evidence',
    (surface) => {
      const reading = pageReadingFromProgram(program, 'aries', surface);

      expect(reading.skyStrip.label).toBeTruthy();
      expect(reading.skyStrip.markers.length).toBeGreaterThanOrEqual(1);
      expect(reading.skyStrip.markers.length).toBeLessThanOrEqual(2);
      for (const marker of reading.skyStrip.markers) {
        expect(marker.value).toBeTruthy();
        expect(marker.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    },
  );

  it('pairs the current Moon with an exact event or the next cited position', () => {
    const reading = pageReadingFromProgram(program, 'aries', 'today');
    const receipts = directEvidence('today');
    const moon = receipts.find((receipt) => receipt.kind === 'body-position' && receipt.body === 'Moon');
    const event = receipts.find((receipt) => receipt.kind === 'sky-event');

    expect(reading.skyStrip.markers[0]).toMatchObject({ label: 'Moon' });
    expect(moon?.moonPhase).toBeTruthy();
    expect(reading.skyStrip.markers[0].value).toContain(moon?.moonPhase);
    expect(reading.skyStrip.markers[0].value).not.toMatch(/^Moon\b/);
    if (event) {
      expect(reading.skyStrip.markers[1]).toMatchObject({
        label: 'Exact',
        value: event.label,
        datetime: event.at,
      });
    } else {
      const nextPosition = receipts.find((receipt) => (
        receipt.kind === 'body-position' && receipt.id !== moon?.id
      ));
      expect(nextPosition).toBeTruthy();
      expect(reading.skyStrip.markers[1]).toMatchObject({
        label: nextPosition?.body,
        datetime: nextPosition?.at,
      });
      expect(reading.skyStrip.markers.some(({ label }) => label === 'Exact')).toBe(false);
    }
  });

  it.each([
    {
      name: 'Mercury’s station on 13 November 2026 (same minute)',
      event: {
        id: 'fact:2026-11-13:event:station:2026-11-13T15:53:06.309Z:mercury-direct',
        kind: 'sky-event',
        sourceId: 'src/data/transits-2026-11.json',
        label: 'Mercury stations direct in Scorpio at 5.0° on November 13, 2026 at 15:53 UTC',
        at: '2026-11-13T15:53:06.309Z',
        body: 'Mercury',
        eventKind: 'station',
        eventType: 'direct',
        sign: 'scorpio',
        degree: 5.033887262793883,
      },
      nasa: '2026-11-13T15:53:52.000Z',
      printed: 'Mercury stations direct in Scorpio at 5.0° on November 13, 2026 at 15:53 UTC',
    },
    {
      name: 'Neptune’s entry into Aries on 26 January 2026 (NASA moves the time)',
      event: {
        id: 'fact:2026:event:ingress:2026-01-26T14:30:44.561Z:neptune-aries',
        kind: 'sky-event',
        sourceId: 'src/data/ingresses.json',
        label: 'Neptune enters Aries on January 26, 2026 at 14:30 UTC',
        at: '2026-01-26T14:30:44.561Z',
        body: 'Neptune',
        eventKind: 'ingress',
        sign: 'aries',
        degree: 0,
      },
      nasa: '2026-01-26T17:35:23.000Z',
      printed: 'Neptune enters Aries on January 26, 2026 at 17:35 UTC',
    },
  ] satisfies { name: string; event: HoroscopeEvidenceReceipt; nasa: string; printed: string }[])(
    'gives the strip and the cited receipt NASA’s instant for $name',
    ({ event, nasa, printed }) => {
      const edition = fixedEdition(event);
      const reading = pageReadingFromProgram(edition, 'aries', 'today');
      const cited = evidenceMap(edition).get(event.id);

      // The receipt the page cites carries NASA's instant and prints its minute;
      // its id still names the engine instant the program committed.
      expect(cited).toMatchObject({ id: event.id, at: nasa, label: printed });
      expect(reading.skyStrip.markers[1]).toEqual({ label: 'Exact', value: printed, datetime: nasa });
      expect(reading.skyStrip.markers[1].datetime).toBe(cited?.at);
      expect(reading.sections[1].receipt).toBe(printed);
      expect(reading.sky?.find((row) => row.id === event.id)?.at).toBe(nasa);
    },
  );

  it('puts a day’s planet events at the same NASA instant as the sky rows', () => {
    const [mercury, newMoon] = refineDailyEvents([
      { kind: 'station', planet: 'Mercury', at: '2026-11-13T15:53:06.309Z', type: 'direct', sign: 'scorpio' },
      { kind: 'lunation', at: '2026-11-09T07:02:05.269Z', type: 'new', sign: 'scorpio' },
    ]);
    expect(mercury.at).toBe('2026-11-13T15:53:52.000Z');
    expect(newMoon.at).toBe('2026-11-09T07:02:05.269Z');
  });

  it('lists an event on the UTC day of NASA’s instant when NASA moves it across midnight', () => {
    // Neptune sextile Pluto: the engine dates it 24 July 2026 at 23:09:38 UTC,
    // NASA 25 July at 05:28:07 UTC, so it belongs to 25 July's edition.
    const sextile = (event: { kind: string; a?: string; b?: string; type?: string }) => (
      event.kind === 'aspect' && event.a === 'Neptune' && event.b === 'Pluto' && event.type === 'sextile'
    );
    expect(eventsOnUtcDay(transitCatalogs, '2026-07-24').filter(sextile)).toEqual([]);
    expect(eventsOnUtcDay(transitCatalogs, '2026-07-25').filter(sextile))
      .toMatchObject([{ at: '2026-07-25T05:28:07.000Z', aSign: 'aries', bSign: 'aquarius' }]);
    expect(alsoInSkyEvents(transitCatalogs, '2026-07-24', [])).not.toContain('Neptune sextile Pluto, exact at 05:28 UTC');
    expect(alsoInSkyEvents(transitCatalogs, '2026-07-25', [])).toContain('Neptune sextile Pluto, exact at 05:28 UTC');
  });

  it('leaves out of “Also in this sky” the events the sky rows show, and keeps the rest', () => {
    // 16 October 2026: Pluto stations direct (NASA 02:39:22 UTC) and Mars
    // trines Saturn (NASA 08:32:24 UTC, the engine says 08:26).
    expect(alsoInSkyEvents(transitCatalogs, '2026-10-16', [])).toEqual([
      'Pluto stations direct at 02:39 UTC',
      'Mars trine Saturn, exact at 08:32 UTC',
    ]);
    // The reading cites Pluto's station, so its sky row is at NASA's instant.
    expect(alsoInSkyEvents(transitCatalogs, '2026-10-16', ['2026-10-16T02:39:22.000Z'])).toEqual([
      'Mars trine Saturn, exact at 08:32 UTC',
    ]);
    // The engine's instant is not a row the page prints, so it removes nothing.
    expect(alsoInSkyEvents(transitCatalogs, '2026-10-16', ['2026-10-16T02:39:20.905Z'])).toHaveLength(2);
  });

  it('uses tomorrow’s own Moon phase without repeating the marker label', () => {
    const reading = pageReadingFromProgram(program, 'aries', 'tomorrow');
    const moon = directEvidence('tomorrow')
      .find((receipt) => receipt.kind === 'body-position' && receipt.body === 'Moon');

    expect(reading.skyStrip.markers[0]).toMatchObject({ label: 'Moon' });
    expect(moon?.moonPhase).toBeTruthy();
    expect(reading.skyStrip.markers[0].value).toContain(moon?.moonPhase);
    expect(reading.skyStrip.markers[0].value).not.toMatch(/^Moon\b/);
  });

  it('names the cited planet behind every daily section without touching the passage', () => {
    for (const { sign, readings } of program.signs) {
      const reading = pageReadingFromProgram(program, sign, 'today');
      expect(reading.sections.map((section) => section.body)).toEqual(readings.today.passages.map((passage) => passage.text));
      for (const [index, section] of reading.sections.entries()) {
        const refs = readings.today.passages[index].evidenceRefs;
        expect(section.planet, `${sign} section ${index}`).toBeTruthy();
        expect(refs).toContain(section.planet?.id);
        expect(section.planet?.title).toMatch(/^[A-Z][a-z]+ (?:in [A-Z][a-z]+|[a-z]+ [A-Z][a-z]+)$/u);
      }
      expect(reading.sky?.length).toBeGreaterThanOrEqual(1);
      expect(reading.sky?.length).toBeLessThanOrEqual(4);
      expect(new Set(reading.sky?.map((planet) => planet.id)).size).toBe(reading.sky?.length);
    }
  });

  it('reads the Moon row with the edition phase and the solar house it maps to', () => {
    const reading = pageReadingFromProgram(program, 'aries', 'today');
    const moon = directEvidence('today').find((receipt) => receipt.kind === 'body-position' && receipt.body === 'Moon');
    const house = directEvidence('today').find((receipt) => (
      receipt.kind === 'solar-house' && receipt.body === 'Moon' && receipt.sunSign === 'aries'
    ));
    const row = reading.sky?.find((planet) => planet.id === moon?.id);
    expect(row).toMatchObject({ body: 'Moon', sign: moon?.sign, detail: moon?.moonPhase, house: house?.house });
    expect(row?.value).toMatch(/^\d{1,2}°\d{2}′$/u);
  });

  it('keeps weekly publication metadata stable until the next Monday edition', () => {
    const reading = pageReadingFromProgram(program, 'aries', 'weekly');
    const weekFrom = program.signs[0].readings.weekly.period.from;

    expect(reading.datePublished).toBe(`${weekFrom}T00:00:00.000Z`);
    expect(reading.dateModified).toBe(reading.datePublished);
  });

  it('keeps the yearly renderer’s editorial chapter headings', () => {
    const reading = pageReadingFromProgram(program, 'capricorn', 'year');

    expect(reading.sections[0].heading).toBe('The shape of Capricorn’s 2027');
    expect(reading.sections.map((section) => section.heading)).toContain('Love, friendship, and clear terms');
    expect(reading.sections.at(-1)?.heading).toBe('A three-date plan for the year');
  });

  it('keeps all twelve rendered hub teasers distinct after truncation', () => {
    const teasers = program.signs.map(({ sign }) => {
      const reading = pageReadingFromProgram(program, sign, 'today');
      return {
        sign,
        text: horoscopeHubTeaser(reading.sections[0]?.body ?? reading.intro),
      };
    });

    expect(teasers).toHaveLength(12);
    expect(new Set(teasers.map(({ text }) => text))).toHaveLength(12);
    expect(teasers.every(({ text }) => text.length <= 177)).toBe(true);

    for (let left = 0; left < teasers.length; left += 1) {
      for (let right = left + 1; right < teasers.length; right += 1) {
        const a = teasers[left];
        const b = teasers[right];
        const similarity = shingleSimilarity(a.text, b.text);
        expect(
          similarity,
          `${a.sign}/${b.sign} rendered teasers are ${similarity.toFixed(3)} similar`,
        ).toBeLessThan(0.28);
      }
    }
  });
});
