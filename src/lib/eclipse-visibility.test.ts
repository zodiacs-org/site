import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAP_H, MAP_W, SWEEP_STEPS, cellRunsPath, centralPathData, continents, eclipseVisibility, landDotsPath,
  regionPhrase, storyTimes, sweepFlags, visibleFlags, type RegionWords,
} from './eclipse-visibility';
import land from '../data/astrocartography-land.json';
import eclipseData from '../data/eclipses.json';

const WORDS: RegionWords = {
  all: 'all of', most: 'most of', parts: 'parts of', and: 'and',
  continents: Object.fromEntries(continents.map((c) => [c, c])) as RegionWords['continents'],
};
const byId = (id: string) => eclipseVisibility.find((e) => e.id === id)!;

/** The land cells a clip path made of whole-cell bands holds, by testing each cell's centre. */
function cellsInside(d: string): boolean[] {
  const bands = [...d.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v([\d.]+)h-[\d.]+z/g)].map((m) => m.slice(1).map(Number));
  const step = (land.cellDegrees / 360) * MAP_W;
  return (land.cells as [number, number][]).map(([row, col]) => {
    const x = col * step + step / 2;
    const y = MAP_H - (row * step + step / 2);
    return bands.some(([bx, by, w, h]) => x > bx && x < bx + w && y > by && y < by + h);
  });
}

describe('eclipse visibility map', () => {
  it('has one entry per eclipse the page lists, each with the anchor its table row carries', () => {
    expect(eclipseVisibility.map((e) => e.id)).toEqual(
      eclipseData.eclipses.map((e) => `eclipse-${e.peak.slice(0, 10)}-${e.type}`),
    );
  });

  it('draws one dot per land cell, inside the map', () => {
    const d = landDotsPath();
    expect(d.match(/h0/g)).toHaveLength(land.cells.length);
    let x = 0, y = 0;
    for (const m of d.matchAll(/([Mm])(-?[\d.]+) (-?[\d.]+)h0/g)) {
      x = m[1] === 'M' ? Number(m[2]) : x + Number(m[2]);
      y = m[1] === 'M' ? Number(m[3]) : y + Number(m[3]);
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(MAP_W);
      expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(MAP_H);
    }
  });

  it('clips exactly the visible dots, and the sweep steps split them without overlap', () => {
    for (const e of eclipseVisibility) {
      const flags = visibleFlags(e);
      expect(cellsInside(cellRunsPath(flags)), e.id).toEqual(flags);
      const steps = sweepFlags(e);
      expect(steps).toHaveLength(SWEEP_STEPS);
      flags.forEach((on, i) => expect(steps.filter((s) => s[i]).length, `${e.id} cell ${i}`).toBe(on ? 1 : 0));
    }
  });

  it('draws a central path only for total and annular solar eclipses, inside the map', () => {
    for (const e of eclipseVisibility) {
      const paths = centralPathData(e);
      expect(paths.length > 0, e.id).toBe(e.type === 'solar' && e.kind !== 'partial');
      for (const d of paths) {
        for (const m of d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
          expect(Number(m[1])).toBeGreaterThanOrEqual(0); expect(Number(m[1])).toBeLessThanOrEqual(MAP_W);
          expect(Number(m[2])).toBeGreaterThanOrEqual(0); expect(Number(m[2])).toBeLessThanOrEqual(MAP_H);
        }
      }
    }
  });

  it('names the continents from the counts, never more than the data holds', () => {
    expect(regionPhrase(byId('eclipse-2026-08-12-solar'), WORDS)).toBe('most of Europe, parts of North America, Africa and Asia');
    expect(regionPhrase(byId('eclipse-2026-03-03-lunar'), WORDS)).toBe('all of North America and Oceania, most of Asia and South America');
    for (const e of eclipseVisibility) {
      const phrase = regionPhrase(e, WORDS);
      for (const [name, visible, total] of e.regions) {
        if (visible === 0) expect(phrase, e.id).not.toContain(name);
        const all = phrase.startsWith('all of ') ? phrase.split(/, (?:most|parts) of /)[0] : '';
        expect(all.includes(name), `${e.id} ${name}`).toBe(visible === total && total > 0);
      }
    }
  });

  it('plays the single pass inside the runtime, every delay from the data, ending by 2.5 s', () => {
    for (const e of eclipseVisibility) {
      const t = storyTimes(e);
      expect(t.steps).toHaveLength(SWEEP_STEPS);
      for (let k = 1; k < t.steps.length; k += 1) expect(t.steps[k]).toBeGreaterThan(t.steps[k - 1]);
      const ends = [t.steps[SWEEP_STEPS - 1] + 500];
      if (t.path) { expect(t.path.t).toBeGreaterThanOrEqual(0); ends.push(t.path.t + t.path.d); }
      if (t.mark !== null) ends.push(t.mark + 400);
      expect(Math.max(...ends), e.id).toBeLessThanOrEqual(2500);
      expect(t.path !== null, e.id).toBe(e.type === 'solar' && e.kind !== 'partial');
    }
  });

  it('keeps the story CSS to opacity and stroke-dashoffset, under the entrance switch', () => {
    const source = readFileSync(new URL('../components/sky/EclipseVisibilityMap.astro', import.meta.url), 'utf8');
    const start = source.indexOf('@media screen and (prefers-reduced-motion: no-preference)');
    const motion = source.slice(start, source.indexOf('`;', start));
    for (const line of motion.split('\n').filter((l) => l.includes('{') && l.includes('}'))) {
      expect(line).toMatch(/^\s*html\[data-entrance='on'\] \.ev-go/);
      for (const prop of line.slice(line.indexOf('{') + 1, line.lastIndexOf('}')).split(';').map((p) => p.split(':')[0].trim()).filter(Boolean)) {
        expect(['opacity', 'stroke-dasharray', 'stroke-dashoffset', 'transition']).toContain(prop);
      }
      if (line.includes('transition')) expect(line).toContain(':not(.is-done)');
    }
  });
});
