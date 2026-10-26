import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import evidence from '../data/natal-aspect-examples.json';
import { computeChart } from './engine/full';
import { ASPECTS, matchAspect, separation } from './engine/aspects';
import { ENGINE_VERSION } from './engine/types';
import { availableLocalesForPath } from './i18n';
import { NATAL_ASPECT_PAIRS, NATAL_PAIR_SUMMARIES, natalPairHeading, type NatalAspectPair } from './natal-aspect-pairs';

const GEOMETRIES = ['conjunction', 'sextile', 'square', 'trine', 'opposition'] as const;
const words = (text: string) => text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const article = (pair: string) => readFileSync(`src/content/natal-aspect-pairs/${pair}.mdx`, 'utf8');
const body = (pair: string) => article(pair).split('---').slice(2).join('---');
const section = (pair: string, geometry: string) => body(pair).split(`<h2 id="${geometry}">`)[1]?.split(/<h2 |\n## /)[0] ?? '';
const listed = (utc: string, a: string, b: string) => {
  const chart = computeChart({ utc: new Date(utc), houseSystem: 'whole', timeKnown: true });
  const lon = (body: string) => chart.bodies.find((item) => item.body === body)!.lon;
  const aspect = chart.aspects.find((item) => (item.a === a && item.b === b) || (item.a === b && item.b === a)) ?? null;
  return { lonA: lon(a), lonB: lon(b), aspect };
};
// Reflective copy only: no outcome claims, no forecasts, no wing language.
const OFF_REGISTER = /\b(?:will|marriage|marry|divorce|break ?up|soulmate|fated?|destiny|destined|crypto|tokens?|wallet|blockchain|investment|properly)\b/i;

describe('natal planet-pair evidence', () => {
  it('replays every worked example through the birth chart calculation', () => {
    expect(evidence.engineVersion).toBe(ENGINE_VERSION);
    expect(evidence.conventions).toEqual(ASPECTS);
    expect(evidence.pairs.map((record) => record.pair)).toEqual(NATAL_ASPECT_PAIRS);
    for (const record of evidence.pairs) {
      expect(record.examples).toHaveLength(2);
      const [a, b] = record.bodies;
      for (const example of record.examples) {
        const replay = listed(example.utc, a, b);
        expect(replay.lonA).toBeCloseTo(example.bodies[0].longitude, 12);
        expect(replay.lonB).toBeCloseTo(example.bodies[1].longitude, 12);
        expect(replay.aspect?.type).toBe(example.geometry);
        expect(replay.aspect?.orb).toBeCloseTo(example.residualOrb, 12);
        expect(replay.aspect?.applying).toBe(example.applying);
        expect(separation(replay.lonA, replay.lonB)).toBeCloseTo(example.separation, 12);
        expect(Math.abs(example.separation - example.angle)).toBeCloseTo(example.residualOrb, 12);
        expect(example.synthetic).toBe(true);
        expect(example.context).toBe('natal');
      }
    }
  });

  it('proves all fifteen pair and geometry combinations are feasible natal configurations', () => {
    for (const record of evidence.pairs) {
      expect(record.feasibility.map((item) => item.geometry)).toEqual(GEOMETRIES);
      const [a, b] = record.bodies;
      for (const item of record.feasibility) {
        const replay = listed(item.utc, a, b);
        expect(replay.aspect?.type).toBe(item.geometry);
        expect(replay.aspect!.orb).toBeLessThanOrEqual(1);
      }
    }
  });

  it('records a time-sensitive case per pair and the luminary allowance', () => {
    for (const record of evidence.pairs) {
      const span = record.timeSensitive.daySpan;
      expect(span.hourlySamples).toBe(25);
      expect(span.samplesListingGeometry).toBeGreaterThan(0);
      expect(span.samplesListingGeometry).toBeLessThan(25);
      expect(record.luminary).toBe(record.bodies.some((body) => body === 'Sun' || body === 'Moon'));
    }
    const schematic = Object.fromEntries(evidence.schematic.map((item) => [item.id, item]));
    expect(schematic.wraparound.separation).toBe(5);
    expect(matchAspect('Moon', 350, 'Venus', 359.5)?.def.type).toBe('conjunction');
    expect(matchAspect('Venus', 350, 'Mars', 359.5)).toBeNull();
    expect(schematic['standard-allowance'].geometry).toBeNull();
    expect(evidence.venus.maxSunVenusSeparation).toBeLessThan(48);
    for (const window of evidence.venus.venusMarsWindows) expect(window.minDays).toBeGreaterThanOrEqual(7);
  });

  // The generator walks one eight-year Venus cycle day by day.
  it('keeps generated evidence deterministic', () => {
    execFileSync(process.execPath, ['scripts/build-natal-aspect-examples.mjs', '--check'], { stdio: 'pipe' });
  }, 60_000);
});

describe('natal planet-pair articles', () => {
  it('keep editorial depth, exact contextual headings and natal wording', () => {
    for (const pair of NATAL_ASPECT_PAIRS as NatalAspectPair[]) {
      const source = article(pair);
      expect(words(body(pair))).toBeGreaterThanOrEqual(1300);
      expect(words(body(pair))).toBeLessThanOrEqual(1700);
      for (const geometry of GEOMETRIES) {
        expect(source).toContain(`<h2 id="${geometry}">${natalPairHeading(pair, geometry)}</h2>`);
        expect(words(section(pair, geometry))).toBeGreaterThanOrEqual(180);
      }
      expect(source).toMatch(/^title: ".* in a birth chart \| Zodiacs\.org"$/m);
      const opening = body(pair).trim().split('\n\n')[0];
      expect(opening).toMatch(/birth chart/);
      expect(opening).toMatch(/natal/);
      expect(source.match(/^ {2}- q: /gm)).toHaveLength(4);
      expect(source).toMatch(/^draft: false$/m);
      expect(source).toMatch(/^reviewer: "Dias Malayev"$/m);
      expect(source).toMatch(/^reviewedAt: "2026-10-25"$/m);
    }
    // One figure for the Moon: about 13 degrees a day through the zodiac, about 12 against the Sun or Venus.
    for (const text of [article('sun-moon'), article('moon-venus'), readFileSync('src/components/learn/NatalAspectsHub.mdx', 'utf8')]) {
      expect(text).toContain('about 13 degrees a day through the zodiac');
      expect(text).not.toMatch(/\b(?:twelve|12) degrees a day\b/);
    }
    const page = readFileSync('src/components/learn/NatalAspectPairPage.astro', 'utf8');
    expect(page).not.toMatch(/Review edition|review is pending|replay|generator|five decimal places|tropical|geocentric/i);
    expect(page).toContain('Reviewed by ${entry.data.reviewer}.');
    expect(natalPairHeading('sun-moon', 'square')).toBe('Sun square Moon in a birth chart');
    expect(natalPairHeading('venus-mars', 'opposition')).toBe('Venus opposite Mars in a birth chart');
  });

  it('stay reflective, dash-free and inside the consumer register', () => {
    const files = [
      ...NATAL_ASPECT_PAIRS.map((pair) => `src/content/natal-aspect-pairs/${pair}.mdx`),
      'src/components/learn/NatalAspectsHub.mdx',
      'src/components/learn/NatalAspectPairPage.astro',
      'src/components/learn/NatalAspectsHubSection.astro',
      'src/components/learn/NatalPairDiagram.astro',
      'src/components/learn/NatalPairLinks.astro',
      'src/lib/natal-aspect-pairs.ts',
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/[\u2013\u2014]/);
      expect(text.replace(/\bwill-change\b/g, ''), file).not.toMatch(OFF_REGISTER);
    }
    for (const { summary } of Object.values(NATAL_PAIR_SUMMARIES)) expect(summary).not.toMatch(OFF_REGISTER);
  });

  it('link synastry counterparts only once those routes exist on main', () => {
    const synastryRoutes = existsSync('src/pages/compatibility/aspects') || existsSync('src/reference-pages/aspects');
    for (const pair of NATAL_ASPECT_PAIRS) {
      expect(article(pair).includes('/compatibility/aspects/')).toBe(false);
    }
    if (!synastryRoutes) {
      expect(readFileSync('src/components/learn/NatalAspectPairPage.astro', 'utf8')).not.toContain('/compatibility/aspects/');
    }
  });

  it('give the hub at least 800 words with the gated section and stay English-only', () => {
    const hub = readFileSync('src/pages/learn/aspects/index.astro', 'utf8');
    const intro = hub.split('<div class="cluster-hero reveal">')[1].split('</div>')[0];
    const added = readFileSync('src/components/learn/NatalAspectsHub.mdx', 'utf8');
    expect(words(intro.replace(/\{[^}]*\}/g, ' ')) + words(added)).toBeGreaterThanOrEqual(800);
    for (const pair of NATAL_ASPECT_PAIRS) expect(availableLocalesForPath(`/learn/aspects/${pair}/`)).toBeUndefined();
  });

  it('keep the five geometry guides and their route assertion, adding only the pair links', () => {
    const guide = readFileSync('src/pages/learn/aspects/[slug].astro', 'utf8');
    expect(guide).toContain('entries.length !== 5');
    expect(guide).toContain('{natalAspectsEnabled && <NatalPairLinks type={type} />}');
    expect(guide).not.toMatch(/getCollection\(\s*'natalAspectPairs'/);
  });
});
