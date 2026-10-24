import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { aspectReference, REFERENCE_GEOMETRIES, SYNASTRY_PAIRS } from './aspect-reference';
import fixtures from '../data/aspect-reference-examples.json';
import { computeChart } from './engine/full';
import { findInterAspects } from './engine/synastry';
import { matchAspect, separation } from './engine/aspects';
import { availableLocalesForPath } from './i18n';

describe('bounded two-chart reference library', () => {
  it('retains chart ownership while sharing canonical paths for reversed labels', () => {
    for (const geometry of REFERENCE_GEOMETRIES) {
      const forward = aspectReference('synastry', 'Sun', 'Moon', geometry, true)!;
      const reverse = aspectReference('synastry', 'Moon', 'Sun', geometry, true)!;
      expect(forward.href).toBe(reverse.href);
      expect(reverse.chartA).toBe('Moon');
      expect(reverse.chartB).toBe('Sun');
      expect(reverse.label).toBe(`Read Sun-Moon ${geometry} in synastry`);
      expect(reverse.label).toBe(forward.label);
      expect(forward.href).toBe(`/compatibility/aspects/sun-moon/#${geometry}`);
    }
  });
  it('withholds unpublished, unsupported and natal links and locale alternates', () => {
    expect(aspectReference('synastry', 'Sun', 'Moon', 'square', false)).toBeNull();
    expect(aspectReference('natal', 'Sun', 'Moon', 'square', true)).toBeNull();
    expect(aspectReference('synastry', 'Sun', 'Mars', 'trine', true)).toBeNull();
    expect(aspectReference('synastry', 'Moon', 'Venus', 'quincunx', true)).toBeNull();
    expect(availableLocalesForPath('/compatibility/aspects/sun-moon/')).toBeUndefined();
  });
  it('replays six feasible synthetic two-chart fixtures through the actual engine', () => {
    expect(fixtures.examples).toHaveLength(6);
    for (const example of fixtures.examples) {
      const longitude = (side: typeof example.chartA) => computeChart({ utc: new Date(side.utc), timeKnown: true, houseSystem: 'whole' }).bodies.find((body) => body.body === side.body)!.lon;
      expect(longitude(example.chartA)).toBeCloseTo(example.chartA.longitude, 12);
      expect(longitude(example.chartB)).toBeCloseTo(example.chartB.longitude, 12);
      const a = { body: example.chartA.body, lon: longitude(example.chartA) };
      const b = { body: example.chartB.body, lon: longitude(example.chartB) };
      const contact = findInterAspects([a], [b])[0];
      expect(contact.type).toBe(example.geometry);
      expect(contact.orb).toBeCloseTo(example.residualOrb, 12);
      expect(separation(a.lon, b.lon)).toBeCloseTo(example.separation, 12);
      expect(findInterAspects([b], [a])[0].orb).toBeCloseTo(contact.orb, 12);
      const reverse = example.reversedAssignment;
      const ra = { body: reverse.chartA.body, lon: longitude(reverse.chartA) };
      const rb = { body: reverse.chartB.body, lon: longitude(reverse.chartB) };
      expect(separation(ra.lon, rb.lon)).toBeCloseTo(reverse.separation, 12);
      expect(findInterAspects([ra], [rb])[0]?.type ?? null).toBe(reverse.geometry);
      expect(reverse.chartA.body).toBe(example.chartB.body);
      expect(reverse.chartA.utc).toBe(example.chartA.utc);
    }
    expect(matchAspect('Sun', 359, 'Moon', 1)?.orb).toBe(2);
    expect(matchAspect('Sun', 350, 'Moon', 4)).toBeNull();
  });
  it('keeps editorial depth, anchors, roles, review status and a bounded route set', () => {
    const count = (text: string) => text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    for (const pair of SYNASTRY_PAIRS) {
      const source = readFileSync(`src/content/synastry-aspects/${pair}.mdx`, 'utf8');
      const body = source.split('---')[2];
      expect(count(body)).toBeGreaterThanOrEqual(1800);
      expect(body).toContain('between two charts');
      for (const geometry of REFERENCE_GEOMETRIES) {
        const section = body.split(`<h2 id="${geometry}">`)[1]?.split(/<h2 |\n## /)[0];
        expect(section).toBeTruthy();
        expect(count(section)).toBeGreaterThanOrEqual(250);
      }
      expect(source).toMatch(/reviewer: /);
      expect(source).toMatch(/reviewedAt: /);
      expect(source).toMatch(/draft: (true|false)/);
      expect(source).not.toMatch(/[\u2013\u2014]/);
    }
    expect(count(readFileSync('src/reference-pages/aspects/hub.mdx', 'utf8'))).toBeGreaterThanOrEqual(900);
    expect(readFileSync('src/pages/compatibility/[pair]/index.astro', 'utf8')).toContain('pairs.length !== 78');
    expect(readFileSync('src/pages/learn/aspects/[slug].astro', 'utf8')).toContain('entries.length !== 5');
  });
  it('keeps generated evidence deterministic', () => {
    execFileSync(process.execPath, ['scripts/build-aspect-reference-examples.mjs', '--check'], { stdio: 'pipe' });
  });
});
