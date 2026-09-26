import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';

import { ENGINE_VERSION as packageEngineVersion, HOUSE_SYSTEMS, natalChart } from '@zodiacs/engine';
import { computeBodies as packageComputeBodies } from '@zodiacs/engine/internal';

import { computeBodies, computeChart } from './full';
import { ENGINE_VERSION } from './types';

const artifactPath = resolve(process.cwd(), 'vendor/zodiacs-engine-0.1.1-rc.9.tgz');
const docsPath = resolve(process.cwd(), 'public/sdk/engine');

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('vendored @zodiacs/engine integration', () => {
  it('matches the public natal entry point across hemispheres, date line, fallback and unknown time', () => {
    for (const latitude of [-78.2232, -33.8688, 0, 51.5074, 66, 78.2232]) {
      for (const houseSystem of ['whole', 'placidus'] as const) {
        for (const longitude of [-180, 15.6267, 180]) {
          const input = {
            utc: new Date('2001-12-21T00:00:00Z'), latitude, longitude,
            houseSystem, timeKnown: true,
          };
          const published = natalChart(input);
          const site = computeChart(input);
          expect(site).toEqual({
            ...published,
            bodies: published.bodies.map(({ body, lon, lat, speed, retrograde }) => ({
              body, lon, lat, speed, retrograde,
            })),
          });
        }
      }
    }
    const unknown = {
      utc: new Date('2000-02-29T12:00:00Z'), latitude: 78, longitude: 180,
      houseSystem: 'placidus' as const, timeKnown: false, flags: ['dst-fold' as const],
    };
    expect(computeChart(unknown)).toMatchObject({
      angles: null, houses: null, flags: natalChart(unknown).flags,
    });
  });

  it('computes all twelve house systems, falling back only from Placidus and Koch inside the polar circle', () => {
    // Synthetic: round coordinates for London and Longyearbyen, nobody's birth.
    const at = { utc: '1990-06-15T13:30:00Z', longitude: 15.6267 };
    const QUADRANT = ['placidus', 'koch', 'porphyry', 'regiomontanus', 'campanus', 'topocentric', 'alcabitius'];
    expect([...HOUSE_SYSTEMS].sort()).toEqual([
      'alcabitius', 'campanus', 'equal', 'koch', 'meridian', 'morinus', 'placidus', 'porphyry',
      'regiomontanus', 'topocentric', 'vehlow', 'whole',
    ]);
    for (const houseSystem of HOUSE_SYSTEMS) {
      const london = natalChart({ ...at, latitude: 51.5074, houseSystem });
      expect(london.houses?.system, houseSystem).toBe(houseSystem);
      expect(london.houses?.cusps, houseSystem).toHaveLength(12);
      expect(london.flags, houseSystem).not.toContain('polar-fallback');
      if (QUADRANT.includes(houseSystem)) {
        // A quadrant system's first cusp is the ascendant and its tenth the midheaven.
        expect(london.houses?.cusps[0], houseSystem).toBeCloseTo(london.angles!.asc, 9);
        expect(london.houses?.cusps[9], houseSystem).toBeCloseTo(london.angles!.mc, 9);
      }
      const polar = natalChart({ ...at, latitude: 78.2232, houseSystem });
      const fallsBack = houseSystem === 'placidus' || houseSystem === 'koch';
      expect(polar.houses?.system, houseSystem).toBe(fallsBack ? 'whole' : houseSystem);
      expect(polar.flags.includes('polar-fallback'), houseSystem).toBe(fallsBack);
    }
  });

  it('matches both recorded checksums in the repository', () => {
    const artifact = readFileSync(artifactPath);
    const checksum = readFileSync(
      resolve(process.cwd(), 'vendor/zodiacs-engine-0.1.1-rc.9.sha256'),
      'utf8',
    ).trim().split(/\s+/u)[0];
    const lock = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8'),
    ) as {
      packages: Record<string, { integrity?: string }>;
    };

    expect(createHash('sha256').update(artifact).digest('hex')).toBe(checksum);
    expect(`sha512-${createHash('sha512').update(artifact).digest('base64')}`).toBe(
      lock.packages['node_modules/@zodiacs/engine']?.integrity,
    );
  });

  it('preserves the site body shape while using package positions and version', () => {
    const date = new Date('2020-01-01T00:00:00Z');
    const packageBodies = packageComputeBodies(date);
    const siteBodies = computeBodies(date);

    expect(ENGINE_VERSION).toBe(packageEngineVersion);
    expect(ENGINE_VERSION).toBe('0.1.1-rc.9');
    expect(siteBodies).toEqual(
      packageBodies.map(({ body, lon, lat, speed, retrograde }) => ({
        body,
        lon,
        lat,
        speed,
        retrograde,
      })),
    );
    expect(siteBodies.some((body) => 'sign' in body || 'degree' in body)).toBe(false);
  });

  it('makes the optional draft receipt available without changing replay intent or unknown time', async () => {
    const { createNatalEnvelope, parseNatalEnvelope, serializeNatalEnvelope, natalReplayInput, redactNatalEnvelope } =
      await import('@zodiacs/engine/receipt');
    for (const timeKnown of [true, false]) {
      const sourceInstant = '2001-12-21T08:30:00-00:00';
      const chart = natalChart({ utc: sourceInstant, latitude: 78.2232, longitude: 15.6267,
        houseSystem: 'placidus', timeKnown });
      const envelope = createNatalEnvelope(chart, { sourceInstant });
      const parsed = parseNatalEnvelope(serializeNatalEnvelope(envelope));
      expect(parsed).toEqual({ ok: true, envelope });
      expect(envelope.receipt).toMatchObject({ instant: '2001-12-21T08:30:00.000Z',
        sourceInstant, timeKnown, reference: 'supplied-instant',
        houses: { requested: 'placidus', actual: timeKnown ? 'whole' : null } });
      const replay = natalReplayInput(envelope);
      expect(replay.houseSystem).toBe('placidus');
      expect(replay.flags).toEqual([]);
      expect(natalChart(replay)).toEqual({ ...chart, input: { ...chart.input, flags: [] } });
      expect(redactNatalEnvelope(envelope)).toEqual({
        schema: 'zodiacs.natal-diagnostic.draft-v1', status: 'redacted-not-anonymous',
        timeKnown, houses: envelope.receipt.houses, inputFlags: [],
        resultFlags: [timeKnown ? 'polar-fallback' : 'no-time'],
      });
    }
  });

  it('keeps receipt and geo optional and the eager site math graph free of the ephemeris', async () => {
    for (const entry of ['@zodiacs/engine', '@zodiacs/engine/internal', '@zodiacs/engine/receipt',
      './src/lib/engine/types.ts', './src/lib/engine/houses.ts', './src/lib/engine/aspects.ts']) {
      const bundled = await build({ stdin: { contents: `export * from ${JSON.stringify(entry)}`,
        resolveDir: process.cwd(), sourcefile: 'engine-isolation-entry.js' }, bundle: true,
      platform: 'browser', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
      const paths = Object.keys(bundled.metafile!.inputs);
      expect(paths.some((path) => path.includes('@zodiacs/sdk'))).toBe(false);
      expect(paths.some((path) => path.endsWith('/geo.js'))).toBe(false);
      const receipt = entry === '@zodiacs/engine/receipt';
      expect(paths.some((path) => path.endsWith('/receipt.js'))).toBe(receipt);
      const calculates = entry === '@zodiacs/engine' || entry === '@zodiacs/engine/internal';
      expect(paths.some((path) => path.includes('/astronomy-engine/'))).toBe(calculates);
      if (!calculates) expect(paths.some((path) => path.endsWith('@zodiacs/engine/dist/index.js'))).toBe(false);
    }
  });

  it('publishes every TypeDoc page with its absolute canonical and icon rail', () => {
    const pages = walk(docsPath).filter((path) => path.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(0);

    for (const path of pages) {
      const route = relative(docsPath, path).split(sep).join('/');
      const expectedCanonical = route === 'index.html'
        ? 'https://zodiacs.org/sdk/engine/'
        : new URL(route, 'https://zodiacs.org/sdk/engine/').href;
      const html = readFileSync(path, 'utf8');
      expect(html).toContain(`<link rel="canonical" href="${expectedCanonical}"/>`);
      expect(html).toContain('<meta name="robots" content="noindex,follow"/>');
      expect(html).toContain('class="engine-sign-rail"');
      expect(html.match(/\/assets\/zodiac-icons\/48\/[a-z]+\.webp/gu)).toHaveLength(12);
    }
  });
});
