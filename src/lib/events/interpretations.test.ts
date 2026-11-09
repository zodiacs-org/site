import { describe, expect, it } from 'vitest';
import { eventsCatalog } from './catalog';
import { eventDay, signNameFor } from './format';
import {
  BESPOKE_INTERPRETED_IDS, INTERPRETED_IDS, interpretationFor,
} from './interpretations';

const catalog = eventsCatalog();
const editorialPages = catalog.pages.filter((event) => {
  const anchor = event.facts.at ?? event.facts.start ?? '';
  return anchor >= '2026-01-01' && anchor < '2031-01-01';
});
const generatedPages = editorialPages.filter(
  (event) => !BESPOKE_INTERPRETED_IDS.includes(event.facts.id),
);

const normalize = (value: string): string => value
  .normalize('NFKC')
  .toLocaleLowerCase('en')
  .replace(/[\p{P}\p{S}]+/gu, ' ')
  .replace(/\s+/gu, ' ')
  .trim();

const wordCount = (value: string): number =>
  value.match(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)*/gu)?.length ?? 0;

const allPassages = () => editorialPages.flatMap((event) => {
  const reading = event.interpretation!;
  return [
    reading.lead,
    ...(reading.body ?? []),
    ...(reading.reflections ?? []),
    ...(reading.limitations ?? []),
    ...(reading.signNotes ?? []).map((note) => note.note),
  ];
});

describe('events editorial — 2026 to 2030 coverage', () => {
  it('covers the complete standalone page set and no later event year', () => {
    expect(editorialPages).toHaveLength(219);
    expect(Object.fromEntries(
      [...new Set(editorialPages.map((event) => event.facts.family))]
        .sort()
        .map((family) => [
          family,
          editorialPages.filter((event) => event.facts.family === family).length,
        ]),
    )).toEqual({
      aspect: 40,
      eclipse: 24,
      ingress: 10,
      lunation: 124,
      retrograde: 21,
    });

    for (const event of editorialPages) {
      expect(event.interpretation, event.facts.id).toBeDefined();
      expect(INTERPRETED_IDS).toContain(event.facts.id);
    }

    for (const event of catalog.pages.filter((page) => {
      const anchor = page.facts.at ?? page.facts.start ?? '';
      return anchor >= '2031-01-01';
    })) {
      expect(event.interpretation, event.facts.id).toBeUndefined();
      expect(INTERPRETED_IDS).not.toContain(event.facts.id);
    }
  });

  it('preserves the seven bespoke editorial anchors', () => {
    expect([...BESPOKE_INTERPRETED_IDS].sort()).toEqual([
      'eclipse-2026-08-12',
      'full-moon-2026-07-29',
      'jupiter-trine-saturn-2026-08-31',
      'mercury-retrograde-2026-06-29',
      'new-moon-2026-08-12',
      'saturn-enters-aries-2026-02-14',
      'uranus-trine-pluto-2026-07-18',
    ]);
    expect(interpretationFor('full-moon-2026-07-29')?.lead)
      .toMatch(/^The Buck Moon peaks in Aquarius on July 29/);
    expect(interpretationFor('eclipse-2026-08-12')?.lead)
      .toMatch(/^On August 12, 2026 the Moon covers the Sun completely/);
  });

  it('gives every page a substantive reading and useful questions', () => {
    for (const event of editorialPages) {
      const reading = event.interpretation!;
      expect(wordCount(reading.lead), `${event.facts.id} lead`).toBeGreaterThanOrEqual(25);
      expect(reading.body, `${event.facts.id} body`).toHaveLength(2);
      for (const paragraph of reading.body ?? []) {
        expect(wordCount(paragraph), `${event.facts.id}: ${paragraph}`).toBeGreaterThanOrEqual(35);
      }
      expect(reading.reflections, `${event.facts.id} reflections`).toHaveLength(2);
      for (const reflection of reading.reflections ?? []) {
        expect(wordCount(reflection), `${event.facts.id}: ${reflection}`).toBeGreaterThanOrEqual(10);
        expect(reflection.endsWith('?'), `${event.facts.id}: ${reflection}`).toBe(true);
      }
    }
  });

  it('does not reuse a lead, body paragraph, or complete body between pages', () => {
    const leads = editorialPages.map((event) => normalize(event.interpretation!.lead));
    const paragraphs = editorialPages.flatMap((event) =>
      event.interpretation!.body!.map(normalize));
    const bodies = editorialPages.map((event) =>
      normalize(event.interpretation!.body!.join(' ')));

    expect(new Set(leads).size).toBe(leads.length);
    expect(new Set(paragraphs).size).toBe(paragraphs.length);
    expect(new Set(bodies).size).toBe(bodies.length);
  });
});

describe('events editorial — facts, voice, and safety', () => {
  it('grounds every composed reading in its event date, bodies, signs, and angle', () => {
    for (const event of generatedPages) {
      const { facts } = event;
      const text = [
        event.interpretation!.lead,
        ...event.interpretation!.body!,
        ...event.interpretation!.reflections!,
      ].join(' ');
      const date = eventDay(facts.at ?? facts.start!);
      expect(text, `${facts.id} date`).toContain(date);
      for (const body of facts.bodies) {
        expect(text, `${facts.id} body ${body}`).toContain(body);
      }
      for (const sign of facts.signs) {
        expect(text, `${facts.id} sign ${sign}`).toContain(signNameFor(sign));
      }
      if (facts.family === 'aspect') {
        expect(text, `${facts.id} aspect`).toContain(facts.aspectType!);
      }
      if (facts.family === 'eclipse') {
        expect(text, `${facts.id} eclipse kind`).toContain(facts.eclipseKind!);
        expect(text, `${facts.id} eclipse family`).toContain(facts.subtype);
      }
      if (facts.family === 'retrograde' && facts.end) {
        expect(text, `${facts.id} end`).toContain(eventDay(facts.end));
      }
    }
  });

  it('keeps backstage language, generic filler, fatalism, and high-stakes advice out', () => {
    const banned = [
      /\b(?:AI-operated|generation mode|versioned template|source hash|fail-closed|pipeline)\b/iu,
      /\b(?:event catalog|committed calculation|computed from the real sky|source receipt)\b/iu,
      /\b(?:delve|unlock|embark|tapestry|vibrant|elevate|empower|harness)\b/iu,
      /\bin today[’']s world\b/iu,
      /\bcelestial event invites\b/iu,
      /\b(?:guaranteed|destined|inevitable|will definitely|certain to)\b/iu,
      /\b(?:you will|you[’']ll)\b/iu,
      /\b(?:diagnos(?:e|is)|cure|medication|pregnan(?:t|cy)|fertility)\b/iu,
      /\b(?:buy|sell|trade|invest(?:ment|ing)?)\b/iu,
      /\b(?:lawsuit|legal outcome|guilty|innocent)\b/iu,
      /!/u,
    ];

    for (const passage of allPassages()) {
      for (const pattern of banned) {
        expect(pattern.test(passage), `${pattern} in: ${passage}`).toBe(false);
      }
    }
  });

  it('frames choice as open rather than making an event predictive', () => {
    const openFrame = /\b(?:choice|question|observe|observation|attention|symbolic|interpretive|tradition|astrology|not a (?:verdict|forecast|promise)|future open|room for your response)\b/iu;
    for (const event of generatedPages) {
      const reading = event.interpretation!;
      const text = [reading.lead, ...(reading.body ?? [])].join(' ');
      expect(openFrame.test(text), event.facts.id).toBe(true);
    }
  });
});
