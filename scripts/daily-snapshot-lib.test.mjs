import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION, degreeInSign, moonPhase, positions, signForLongitude } from '@zodiacs/engine';
import { bodyLongitude } from '@zodiacs/engine/internal';
import { afterEach, describe, expect, it } from 'vitest';
import { computeDailySnapshot } from './daily-snapshot-lib.mjs';

let temporaryRoot;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function root() {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'zodiacs-daily-snapshot-'));
  await mkdir(join(temporaryRoot, 'src/data'), { recursive: true });
  return temporaryRoot;
}

function expectedDailyBodies(date) {
  const included = new Set([
    'Moon', 'Sun', 'Mercury', 'Venus', 'Mars',
    'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  ]);
  const byName = new Map(positions(date)
    .filter((position) => included.has(position.body))
    .map((position) => [position.body, position]));
  return [...included].map((body) => {
    const position = byName.get(body);
    return {
      body,
      lon: position.lon,
      sign: position.sign,
      degree: position.degree,
      retrograde: position.retrograde,
    };
  });
}

afterEach(async () => {
  if (temporaryRoot) await rm(temporaryRoot, { force: true, recursive: true });
  temporaryRoot = undefined;
});

describe('daily snapshot source coverage', () => {
  it('keeps every Phase 1 astronomy path behind the vendored site engine', async () => {
    for (const path of [
      'scripts/daily-snapshot-lib.mjs',
      'scripts/build-transits.mjs',
      'scripts/daily-fact-audit.mjs',
    ]) {
      const source = await readFile(resolve(repositoryRoot, path), 'utf8');
      expect(source, path).toContain("from '@zodiacs/engine");
      expect(source, path).not.toMatch(/from\s+['"]astronomy-engine['"]/u);
    }

    const manifestSource = await readFile(
      resolve(repositoryRoot, 'scripts/daily-publication-files.ts'),
      'utf8',
    );
    expect(manifestSource).toContain("name: '@zodiacs/engine'");
    expect(manifestSource).not.toContain("name: 'astronomy-engine'");

    const manifest = JSON.parse(await readFile(
      resolve(repositoryRoot, 'src/data/daily-publication-manifest.json'),
      'utf8',
    ));
    expect(manifest.facts.engine).toEqual({ name: '@zodiacs/engine', version: ENGINE_VERSION });
    expect(manifest.verification.copyVerifierIndependentFromGenerator).toBe(true);
    expect(manifest.verification.astronomyAudit).toMatchObject({
      implementation: 'zodiacs.daily-fact-audit.v2',
      kind: 'site-engine-parity-and-event-physics',
      sourceOfTruth: '@zodiacs/engine',
      independentFromSnapshotBuilder: true,
      independentAstronomyImplementation: false,
      status: 'passed',
    });
  });

  it('marks a missing monthly source unavailable instead of calling it a quiet day', async () => {
    const snapshot = await computeDailySnapshot('2026-06-19', await root());
    expect(snapshot.eventsCoverage).toBe('unavailable');
    expect(snapshot.eventsSource).toBeNull();
    expect(snapshot.events).toEqual([]);
  });

  it('hard-fails malformed JSON in an existing monthly source', async () => {
    const repo = await root();
    await writeFile(join(repo, 'src/data/transits-2026-06.json'), '{not json}\n');
    await expect(computeDailySnapshot('2026-06-19', repo)).rejects.toThrow('invalid JSON');
  });

  it('hard-fails malformed or off-month events in an existing source', async () => {
    const repo = await root();
    await writeFile(join(repo, 'src/data/transits-2026-06.json'), JSON.stringify({
      month: '2026-06',
      ingresses: [{ planet: 'Venus', sign: 'leo', at: '2026-07-01T00:00:00.000Z' }],
      lunations: [],
      stations: [],
      aspects: [],
    }));
    await expect(computeDailySnapshot('2026-06-19', repo)).rejects.toThrow('inside 2026-06');
  });

  it('matches the site engine and displayed event data for the 29 July 2026 full moon vector', async () => {
    const snapshot = await computeDailySnapshot('2026-07-29', repositoryRoot);
    const at = new Date('2026-07-29T12:00:00.000Z');
    const phase = moonPhase(at);
    const event = snapshot.events.find((candidate) => candidate.kind === 'lunation' && candidate.type === 'full');

    expect(snapshot.bodies).toEqual(expectedDailyBodies(at));
    expect(snapshot.moon).toEqual({
      phase: phase.name,
      illumination: Math.round(phase.illumination * 1000) / 1000,
    });
    expect(phase.name).toBe('Full Moon');
    expect(event?.at).toBe('2026-07-29T14:35:43.458Z');

    const eventMoonLongitude = bodyLongitude('Moon', new Date(event.at));
    expect(event).toMatchObject({
      sign: signForLongitude(eventMoonLongitude).slug,
      degree: expect.closeTo(degreeInSign(eventMoonLongitude), 10),
    });
  });

  it('matches the site engine for the 18 July 2026 Mercury-retrograde vector', async () => {
    const snapshot = await computeDailySnapshot('2026-07-18', repositoryRoot);
    const at = new Date('2026-07-18T12:00:00.000Z');
    const engineMercury = positions(at).find((position) => position.body === 'Mercury');

    expect(snapshot.bodies).toEqual(expectedDailyBodies(at));
    expect(engineMercury?.speed).toBeLessThan(0);
    expect(snapshot.bodies.find((body) => body.body === 'Mercury')).toMatchObject({
      lon: engineMercury?.lon,
      sign: 'cancer',
      retrograde: true,
    });
  });
});
