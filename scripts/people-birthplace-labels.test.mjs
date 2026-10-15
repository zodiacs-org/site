import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import data from '../src/data/people.json';
import manifest from '../docs/phase5/people-pilot/manifest.json';
import {
  BIRTHPLACE_LABELS,
  birthplaceDisplay,
  containingEntities,
  isSettlement,
  settlementEvidence,
  withBirthplaceDisplay,
} from '../docs/phase5/people-pilot/tools/birthplace-labels.mjs';

const pilot = (path) => JSON.parse(readFileSync(new URL(`../docs/phase5/people-pilot/${path}`, import.meta.url), 'utf8'));

// Synthetic chain for the rules: the ids are not the Wikidata items they name.
const fixture = {
  places: {
    Q1: { label: 'General Hospital', instanceOf: ['Q90'], locatedIn: ['Q2'] },
    Q2: { label: 'Riverside', instanceOf: ['Q91'], locatedIn: ['Q3'] },
    Q3: { label: 'Example County', instanceOf: ['Q92'], locatedIn: ['Q4'] },
    Q4: { label: 'Exampleland', instanceOf: [], locatedIn: [], country: true },
    Q5: { label: 'Elsewhere', instanceOf: ['Q91'], locatedIn: ['Q4'] },
  },
};
const recorded = {
  entity: 'Q1',
  entityLabel: 'General Hospital',
  normalisedLabel: 'General Hospital, Exampleland',
  country: { entity: 'Q4', label: 'Exampleland' },
  coordinates: { latitude: 1.5, longitude: -2.25 },
  timeZone: 'Etc/GMT',
};

describe('birthplace display labels: rules', () => {
  it('walks the cached P131 chain nearest first', () => {
    expect(containingEntities('Q1', fixture.places)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  });

  it('keeps the recorded label when no review lists the person', () => {
    expect(birthplaceDisplay('someone', recorded, fixture, {}))
      .toEqual({ entity: 'Q1', label: 'General Hospital', entities: ['Q1'] });
  });

  it('joins the cached labels of a reviewed selection, most specific first', () => {
    expect(birthplaceDisplay('someone', recorded, fixture, { someone: ['Q2', 'Q3'] }))
      .toEqual({ entity: 'Q2', label: 'Riverside, Example County', entities: ['Q2', 'Q3'] });
  });

  it.each([
    ['a place off the chain', ['Q5']],
    ['a reversed chain', ['Q3', 'Q2']],
    ['a repeated entity', ['Q2', 'Q2']],
    ['an empty selection', []],
  ])('rejects %s', (_, selection) => {
    expect(() => birthplaceDisplay('someone', recorded, fixture, { someone: selection })).toThrow();
  });

  it('fails closed on a birthplace the evidence never recorded', () => {
    expect(() => birthplaceDisplay('someone', { ...recorded, entity: 'Q9' }, fixture, {}))
      .toThrow('missing from the birthplace settlement evidence');
  });

  it('changes only the display fields and leaves the chart inputs alone', () => {
    const next = withBirthplaceDisplay('someone', recorded, fixture, { someone: ['Q2'] });
    expect(Object.keys(next)).toEqual([
      'entity', 'entityLabel', 'displayEntity', 'displayLabel', 'normalisedLabel',
      'country', 'coordinates', 'timeZone',
    ]);
    expect(next).toMatchObject({
      entity: 'Q1',
      entityLabel: 'General Hospital',
      displayEntity: 'Q2',
      displayLabel: 'Riverside',
      normalisedLabel: 'Riverside, Exampleland',
      coordinates: recorded.coordinates,
      timeZone: 'Etc/GMT',
    });
    expect(withBirthplaceDisplay('someone', next, fixture, { someone: ['Q2'] })).toEqual(next);
  });

  it('counts a place as a settlement only by a reviewed class', () => {
    expect(isSettlement('Q2', fixture, { Q91: 'town' })).toBe(true);
    expect(isSettlement('Q1', fixture, { Q91: 'town' })).toBe(false);
  });
});

describe('birthplace display labels: the reviewed People release', () => {
  it('walked the birthplace each cached evidence record names', () => {
    const evidence = settlementEvidence();
    expect(Object.keys(evidence.birthplaces).sort()).toEqual(manifest.people.map((person) => person.slug).sort());
    for (const [slug, entity] of Object.entries(evidence.birthplaces)) {
      expect(pilot(`evidence/${slug}.json`).birthPlace.entity, slug).toBe(entity);
    }
  });

  it('lists only real people, and every selection changes a label', () => {
    const slugs = new Set(data.people.map((person) => person.slug));
    for (const slug of Object.keys(BIRTHPLACE_LABELS)) {
      expect(slugs.has(slug), slug).toBe(true);
      const person = data.people.find((entry) => entry.slug === slug);
      expect(person.birthPlace.displayLabel, slug).not.toBe(person.birthPlace.entityLabel);
    }
  });

  it('publishes exactly the derived label, and only as a label', () => {
    for (const person of data.people) {
      const display = birthplaceDisplay(person.slug, person.birthPlace);
      expect(person.birthPlace.displayEntity, person.slug).toBe(display.entity);
      expect(person.birthPlace.displayLabel, person.slug).toBe(display.label);
      expect(person.birthPlace.normalisedLabel, person.slug)
        .toBe(`${display.label}, ${person.birthPlace.country.label}`);
      const source = pilot(`evidence/${person.slug}.json`).birthPlace;
      const computed = pilot(`computed/${person.slug}.json`).computation;
      expect(person.birthPlace.entity, person.slug).toBe(source.entity);
      expect(person.birthPlace.entityLabel, person.slug).toBe(source.label);
      expect(person.birthPlace.coordinates.latitude, person.slug).toBe(source.coordinates.latitude);
      expect(person.birthPlace.coordinates.longitude, person.slug).toBe(source.coordinates.longitude);
      expect(person.birthPlace.timeZone, person.slug).toBe(computed.timeZone);
    }
  });

  it('names a settlement for every published person', () => {
    const unsettled = data.people
      .filter((person) => person.indexEligibility.eligible)
      .filter((person) => !birthplaceDisplay(person.slug, person.birthPlace).entities.some((id) => isSettlement(id)))
      .map((person) => `${person.slug}: ${person.birthPlace.displayLabel}`);
    expect(unsettled).toEqual([]);
  });
});
