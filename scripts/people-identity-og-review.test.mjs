import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import peopleData from '../src/data/people.json';
import { PRINCIPAL_IDENTITIES } from '../docs/phase5/people-pilot/tools/principal-identities.mjs';
import {
  PEOPLE_IDENTITY_REVIEW_FLAG as flag,
  PEOPLE_IDENTITY_REVIEW_SLUGS,
  peopleIdentityReviewOptions,
  reviewedPeople,
} from './people-identity-og-review.mjs';

const a20 = [
  { slug: 'neil-armstrong', disciplines: ['astronaut', 'test pilot'], shortDescription: 'Astronaut and test pilot · United States · 1930–2012' },
  { slug: 'amelia-earhart', disciplines: ['aircraft pilot'], shortDescription: 'Aircraft pilot · United States · 1897–1939' },
  { slug: 'maya-angelou', disciplines: ['writer'], shortDescription: 'Writer · United States · 1928–2014' },
];
const label = (disciplines) => {
  const text = disciplines.join(' and ');
  return `${text[0].toUpperCase()}${text.slice(1)}`;
};
const people = [
  ...a20,
  ...Object.entries(PRINCIPAL_IDENTITIES)
    .filter(([slug]) => !a20.some((person) => person.slug === slug))
    .map(([slug, disciplines]) => ({ slug, disciplines: [...disciplines], shortDescription: `${label(disciplines)} · Somewhere · 1900–2000` })),
];

describe('People identity OG review boundary', () => {
  it('requires the explicit mode and fixes its destination outside production', () => {
    expect(peopleIdentityReviewOptions([], '/repo')).toBeNull();
    expect(peopleIdentityReviewOptions(['--only-people'], '/repo')).toBeNull();
    expect(peopleIdentityReviewOptions([flag], '/repo')).toEqual({
      output: resolve('/repo/tests/visual/artifacts/explorer/people-identity-og'),
    });
  });

  it.each(['--only-people', '--only-wing', '--include-fallback', '--output=/repo/public', flag])(
    'rejects mixed or repeated mode %s before rendering',
    (other) => expect(() => peopleIdentityReviewOptions([flag, other], '/repo')).toThrow('must be used alone'),
  );

  it('rejects a value on the closed flag instead of falling into the full production renderer', () => {
    expect(() => peopleIdentityReviewOptions([`${flag}=/repo/public`], '/repo')).toThrow('must be used alone');
  });

  it('rejects an unpinned browser module instead of attesting a different runtime', () => {
    expect(() => peopleIdentityReviewOptions([flag], '/repo', { PLAYWRIGHT_MODULE: '/another/playwright.mjs' }))
      .toThrow('pinned playwright-core');
  });

  it('selects exactly the reviewed people in the closed list order, A20 first', () => {
    expect(PEOPLE_IDENTITY_REVIEW_SLUGS).toEqual(Object.keys(PRINCIPAL_IDENTITIES));
    expect(PEOPLE_IDENTITY_REVIEW_SLUGS.slice(0, 3)).toEqual(a20.map(({ slug }) => slug));
    const unrelated = { slug: 'another-person', disciplines: ['writer'], shortDescription: 'Writer · elsewhere' };
    expect(reviewedPeople([unrelated, ...people.toReversed()])).toEqual(people);
  });

  it('finds every reviewed identity migrated in the production People data', () => {
    expect(reviewedPeople(peopleData.people).map(({ slug }) => slug)).toEqual(PEOPLE_IDENTITY_REVIEW_SLUGS);
  });

  it('rejects missing and duplicate reviewed records', () => {
    expect(() => reviewedPeople(people.slice(0, 2))).toThrow('maya-angelou');
    expect(() => reviewedPeople([...people, people[0]])).toThrow('exactly one');
  });

  it('rejects old production descriptions and changed editorial selections', () => {
    expect(() => reviewedPeople(people.map((person, i) => i ? person : {
      ...person, shortDescription: 'University teacher · United States · 1930–2012',
    }))).toThrow('has not been migrated');
    expect(() => reviewedPeople(people.map((person, i) => i !== 2 ? person : {
      ...person, disciplines: ['poet'],
    }))).toThrow('reviewed selection');
  });
});
