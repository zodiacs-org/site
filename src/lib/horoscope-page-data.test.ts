import { describe, expect, it } from 'vitest';
import programData from '../data/horoscope-program.json';
import { horoscopeHubTeaser, pageReadingFromProgram } from './horoscope-page-data';
import type { HoroscopeProgram } from './horoscope-program';

const program = programData as HoroscopeProgram;
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

function directEvidence(surface: 'today' | 'tomorrow') {
  const reading = program.signs.find(({ sign }) => sign === 'aries')?.readings[surface];
  const references = new Set(reading?.passages.flatMap((passage) => passage.evidenceRefs) ?? []);
  return program.evidence.filter((receipt) => references.has(receipt.id));
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
