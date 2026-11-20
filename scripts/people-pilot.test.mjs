import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import peopleData from '../src/data/people.json';
import manifest from '../docs/phase5/people-pilot/manifest.json';
import indexPolicy from '../docs/phase5/people-pilot/index-policy.json';
import indexDemand from '../docs/phase5/people-pilot/index-demand.json';
import { resolvePeopleIndexPolicy } from './people-index-policy.mjs';
import { PEOPLE_DISCIPLINE_FILTERS, peopleDisciplineGroups } from '../src/lib/people';

describe('Phase 5 People pilot contract', () => {
  it('classifies every published source discipline for directory and birthday cards', () => {
    const groups = new Set(PEOPLE_DISCIPLINE_FILTERS.map(({ slug }) => slug));
    for (const person of peopleData.people) {
      const actual = peopleDisciplineGroups(person);
      expect(actual.length, person.slug).toBeGreaterThan(0);
      expect(actual.every((group) => groups.has(group)), person.slug).toBe(true);
      expect(new Set(actual).size, person.slug).toBe(actual.length);
    }
  });

  it.each([
    ['neil-armstrong', ['public-life']],
    ['amelia-earhart', ['public-life']],
    ['maya-angelou', ['writing']],
  ])('preserves the directory category of the corrected %s identity', (slug, groups) => {
    expect(peopleDisciplineGroups(peopleData.people.find((person) => person.slug === slug))).toEqual(groups);
  });

  it('rejects an unreviewed discipline rather than silently omitting it', () => {
    expect(() => peopleDisciplineGroups({ ...peopleData.people[0], disciplines: ['unreviewed profession'] }))
      .toThrow('Unmapped People discipline: unreviewed profession');
  });

  it('contains exactly 516 distinct records with the policy-driven release boundary', () => {
    // 500 were published; one was withdrawn on 2026-07-27 because its Sun
    // sign proved undeterminable. Two owner-authorized protected living
    // records were added on 2026-08-16, and 15 more on 2026-11-18. See index-policy.json.
    expect(peopleData.people).toHaveLength(516);
    expect(new Set(peopleData.people.map((person) => person.slug)).size).toBe(peopleData.people.length);
    expect(new Set(peopleData.people.map((person) => person.qid)).size).toBe(peopleData.people.length);
    const indexable = peopleData.people.filter((person) => person.indexEligibility.eligible);
    const deferred = peopleData.people.filter((person) => (
      !person.indexEligibility.eligible && !person.living
    ));
    const protectedLiving = peopleData.people.filter((person) => person.living);
    expect(indexable).toHaveLength(104);
    expect(deferred).toHaveLength(393);
    expect(indexable.every((person) => !person.living && person.indexEligibility.blockedBy.length === 0)).toBe(true);
    expect(deferred.every((person) => (
      person.indexEligibility.blockedBy.some((reason) => reason.includes('search-demand-tail'))
    ))).toBe(true);
    expect(protectedLiving.map((person) => person.slug).sort()).toEqual([
      'bad-bunny',
      'bill-gates',
      'erling-haaland',
      'harry-styles',
      'jenna-ortega',
      'kendrick-lamar',
      'kylie-jenner',
      'leonardo-dicaprio',
      'lisa',
      'max-verstappen',
      'mrbeast',
      'olivia-rodrigo',
      'rigoberta-menchu',
      'rihanna',
      'sabrina-carpenter',
      'serena-williams',
      'taylor-swift',
      'timothee-chalamet',
      'zendaya',
    ]);
    expect(protectedLiving.every((person) => (
      person.living
      && person.indexEligibility.blockedBy.some((reason) => reason.includes('living-person-protection'))
    ))).toBe(true);
  });

  it('keeps generated aspect articles grammatical', () => {
    const copy = peopleData.people
      .flatMap((person) => [person.copy.lede, ...person.copy.blocks.map((block) => block.text)])
      .join(' ');
    expect(copy).not.toMatch(/\ba (?:axis|opposition)\b/u);
  });

  it('rejects tampered demand-evidence provenance in every policy consumer', () => {
    for (const mutate of [
      (evidence) => { evidence.metric = 'Unidentified popularity score'; },
      (evidence) => { evidence.source.name = 'Unknown source'; },
      (evidence) => { evidence.window.from = '2025-09-01'; },
      (evidence) => { evidence.generatedAtUtc = '1900-01-01'; },
      (evidence) => { evidence.generatedAtUtc = 'August 21, 2026'; },
      (evidence) => { evidence.generatedAtUtc = '2026-08-21T12:34:56.789+00:00'; },
      (evidence) => { evidence.people[0].title = 'Wrong_article'; },
    ]) {
      const evidence = structuredClone(indexDemand);
      mutate(evidence);
      expect(() => resolvePeopleIndexPolicy({ manifest, indexPolicy, indexDemand: evidence }))
        .toThrow();
    }
  });

  it('never counts an uncertain sign in chart aggregates', () => {
    for (const person of peopleData.people) {
      const settled = person.placements.filter((placement) => placement.stableAcrossDay);
      expect(person.patterns.settledBodyCount).toBe(settled.length);
      expect(Object.values(person.patterns.elements).reduce((sum, value) => sum + value, 0)).toBe(settled.length);
      expect(Object.values(person.patterns.modalities).reduce((sum, value) => sum + value, 0)).toBe(settled.length);
    }
  });

  it('names every non-Moon placement whose sign is uncertain', () => {
    for (const person of peopleData.people) {
      const facts = person.copy.blocks.flatMap((block) => block.facts);
      const text = person.copy.blocks.map((block) => block.text).join(' ');
      for (const placement of person.placements.filter((entry) => (
        !entry.stableAcrossDay && entry.body !== 'Moon'
      ))) {
        const fact = facts.find((entry) => entry.startsWith(`sign-uncertain:${placement.body}:`));
        expect(fact).toBeTruthy();
        const [, body, start, end] = fact.split(':');
        const startName = start.charAt(0).toUpperCase() + start.slice(1);
        const endName = end.charAt(0).toUpperCase() + end.slice(1);
        expect(text).toContain(
          `${body} crossed from ${startName} into ${endName} during that day, so its sign is left open.`,
        );
      }
    }
  });

  it('keeps the directory protected and derives profile robots from eligibility', async () => {
    const directory = await readFile(resolve('src/pages/people/index.astro'), 'utf8');
    const profile = await readFile(resolve('src/pages/people/[slug].astro'), 'utf8');
    expect(directory).toContain('noindex={!PEOPLE_DIRECTORY_INDEXABLE}');
    expect(directory).toContain('nofollow={!PEOPLE_DIRECTORY_INDEXABLE}');
    expect(profile).toContain('noindex={!person.indexEligibility.eligible}');
    expect(profile).toContain('nofollow={person.living}');
  });

  it('publishes only allowlisted profiles in the sitemap and keeps People out of primary navigation', async () => {
    const sitemap = await readFile(resolve('src/pages/sitemap.xml.ts'), 'utf8');
    const nav = await readFile(resolve('src/components/SiteNav.astro'), 'utf8');
    expect(sitemap).toContain('INDEXABLE_PEOPLE.map');
    expect(nav).not.toContain('/people/');
  });

  it('declares the shared page gutter without legacy People overrides', async () => {
    const styles = await readFile(resolve('src/styles/people.css'), 'utf8');
    const pageShell = styles.match(/\.people-page,\s*\.person-page\s*\{([^}]*)\}/u)?.[1] ?? '';

    expect(pageShell).toContain('width: min(var(--people-width), calc(100% - 40px));');
    expect(styles).not.toMatch(/100% - (?:24|32)px/u);
  });
});
