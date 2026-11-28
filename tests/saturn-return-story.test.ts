import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../src/lib/i18n';
import {
  NARROW, SATURN_LAP_YEARS, SATURN_RETURN_AGES, STORY, WIDE, englishLapsWords, lapsPlot, type LapsLayout,
} from '../src/pages/saturn-return/_saturn-laps';

// The Saturn return page's story figure (src/pages/saturn-return/_SaturnLapsPlate.astro,
// docs/MOTION.md, Stories): the page and the picture read one set of figures,
// the drawing holds its words apart and inside its box, and the story moves
// only what a story may move, once, inside the runtime's 2.6 s.

const page = readFileSync(new URL('../src/pages/saturn-return/index.astro', import.meta.url), 'utf8');
const plate = readFileSync(new URL('../src/pages/saturn-return/_SaturnLapsPlate.astro', import.meta.url), 'utf8');

// Rough advance widths, generous on purpose: Instrument Sans and JetBrains Mono
// at these sizes, and the fallback faces stableTypography may keep instead.
const sansWidth = (text: string, size: number) => text.length * size * 0.58;
const monoWidth = (text: string, size: number) => text.length * size * 0.62;

describe('Saturn return figures', () => {
  it('names a 29.4-year lap and returns near 29, 58 and 88', () => {
    expect(SATURN_LAP_YEARS).toBe(29.4);
    expect(SATURN_RETURN_AGES).toEqual([29, 58, 88]);
  });

  it('agrees with the calculator’s own age hints', () => {
    expect(t('en', 'aroundAge29')).toBe(`around age ${SATURN_RETURN_AGES[0]}`);
    expect(t('en', 'aroundAge58')).toBe(`around age ${SATURN_RETURN_AGES[1]}`);
    expect(t('en', 'aroundAge88')).toBe(`around age ${SATURN_RETURN_AGES[2]}`);
  });

  it('is where the page reads its lap and its ages, so it never retypes them', () => {
    expect(page).toContain("from './_saturn-laps'");
    expect(page).toContain('<SaturnLapsPlate words={englishLapsWords()} />');
    for (const figure of ['29.4', '29', '58', '88']) {
      expect(page, `the page retypes ${figure}`).not.toMatch(new RegExp(`(?<![\\d.])${figure.replace('.', '\\.')}(?![\\d.])`, 'u'));
    }
    expect(page).toContain('stableTypography');
  });

  it('writes its English words from the same figures, with no dashes', () => {
    const words = englishLapsWords();
    expect(words.lap).toBe('29.4 years');
    expect(words.returns).toHaveLength(SATURN_RETURN_AGES.length);
    for (const text of [words.alt, words.caption]) {
      expect(text).toContain('29.4 years');
      expect(text).toContain('near age 29');
      expect(text).toMatch(/58 and( the third near)? 88\./u);
    }
    for (const text of [words.lap, words.birth, ...words.returns, words.alt, words.caption]) {
      expect(text).not.toMatch(/[–—]/u);
    }
  });
});

describe('the drawing', () => {
  const words = englishLapsWords();
  for (const [name, layout] of [['wide', WIDE], ['narrow', NARROW]] as [string, LapsLayout][]) {
    it(`draws equal laps from birth to each return on the ${name} drawing`, () => {
      const plot = lapsPlot(layout);
      const step = (layout.x1 - layout.x0) / 3;
      expect(plot.birth.x).toBe(layout.x0);
      plot.returns.forEach((r, i) => expect(r.x).toBeCloseTo(layout.x0 + step * (i + 1), 1));
      expect(plot.returns.map((r) => r.age)).toEqual(SATURN_RETURN_AGES);
      // Each arc runs from the lap's start to its return, bulging up, inside the box.
      plot.arcs.forEach((arc, i) => {
        const [, x0, y0, rx, ry, , , , x1, y1] = arc.d.match(/^M([\d.]+) ([\d.]+)A([\d.]+) ([\d.]+) (0) (0) (1) ([\d.]+) ([\d.]+)$/u)!
          .map(Number);
        expect(x0).toBeCloseTo(i === 0 ? plot.birth.x : plot.returns[i - 1].x, 1);
        expect(x1).toBeCloseTo(plot.returns[i].x, 1);
        expect(y0).toBe(layout.axisY);
        expect(y1).toBe(layout.axisY);
        expect(rx).toBeCloseTo(step / 2, 1);
        expect(layout.axisY - ry).toBeGreaterThanOrEqual(2);
      });
      expect(plot.ring.x).toBe(plot.returns[0].x);
    });

    it(`keeps the ${name} drawing's words apart and inside the box`, () => {
      const plot = lapsPlot(layout);
      const centres = [plot.birth.x, ...plot.returns.map((r) => r.x)];
      const labels = [words.birth, ...words.returns];
      const spans = centres.map((x, i) => {
        const half = Math.max(sansWidth(labels[i], layout.wordFont), monoWidth(String(i ? SATURN_RETURN_AGES[i - 1] : 0), layout.ageFont)) / 2;
        return [x - half, x + half];
      });
      expect(spans[0][0]).toBeGreaterThanOrEqual(0);
      expect(spans[spans.length - 1][1]).toBeLessThanOrEqual(layout.w);
      for (let i = 1; i < spans.length; i += 1) expect(spans[i][0] - spans[i - 1][1], labels[i]).toBeGreaterThanOrEqual(6);
      // Ages under the line and the discs, words under the ages, all inside the box.
      expect(layout.ageY - layout.ageFont * 0.75).toBeGreaterThan(layout.axisY + layout.ring);
      expect(layout.wordY - layout.wordFont * 0.75).toBeGreaterThan(layout.ageY + 2);
      expect(layout.wordY + layout.wordFont * 0.25).toBeLessThanOrEqual(layout.h);
      // The lap's length sits inside the first arc, clear of it on both sides.
      const rx = (plot.returns[0].x - plot.birth.x) / 2;
      const top = plot.lap.y - layout.lapFont * 0.75;
      const halfAtTop = rx * Math.sqrt(1 - ((layout.axisY - top) / layout.ry) ** 2);
      expect(halfAtTop - monoWidth(words.lap, layout.lapFont) / 2).toBeGreaterThanOrEqual(4);
      expect(plot.lap.y).toBeLessThan(layout.axisY - layout.dot - 4);
    });
  }

  it('times every piece by the moment the line reaches it, and ends by 2.5 s', () => {
    const plot = lapsPlot(WIDE);
    plot.arcs.forEach((arc, i) => expect(arc.t).toBe(i * STORY.lap));
    plot.returns.forEach((r, i) => expect(r.t).toBe(plot.arcs[i].t + STORY.lap));
    expect(plot.lap.t).toBe(STORY.lap / 2);
    const line = plot.arcs.length * STORY.lap;
    expect(plot.ring.t).toBeGreaterThan(line);
    expect(plot.ring.t + plot.ring.dur).toBeLessThanOrEqual(STORY.end);
    expect(Math.max(...plot.returns.map((r) => r.t)) + STORY.piece).toBeLessThanOrEqual(STORY.end);
    expect(STORY.end).toBeLessThan(2600);
    expect(lapsPlot(NARROW).ring.t).toBe(plot.ring.t);
  });
});

describe('the story', () => {
  const css = plate.match(/const styles = `([\s\S]*?)`;/u)![1];

  it('moves only opacity, transform and stroke-dashoffset, and only while motion is on', () => {
    const transitions = [...css.matchAll(/transition:\s*([^;}]+)/gu)].map((m) => m[1]);
    expect(transitions.length).toBeGreaterThan(0);
    for (const value of transitions) {
      for (const part of value.split(/,(?![^(]*\))/u)) {
        expect(['opacity', 'transform', 'stroke-dashoffset'], value).toContain(part.trim().split(/\s+/u)[0]);
      }
    }
    const motion = css.slice(css.indexOf('@media screen and (prefers-reduced-motion: no-preference)'));
    expect(motion.length).toBeGreaterThan(0);
    // Nothing waits or moves outside the motion block.
    const still = css.slice(0, css.indexOf('@media screen and (prefers-reduced-motion: no-preference)'));
    expect(still).not.toMatch(/transition|stroke-dashoffset|is-in|data-entrance/u);
    for (const rule of motion.split('\n').filter((line) => line.includes('{') && !line.startsWith('@media'))) {
      expect(rule.trim(), 'every story rule needs motion on').toMatch(/^html\[data-entrance='on'\] \.sl-go/u);
      if (rule.includes('transition')) expect(rule).toContain('.sl-go:not(.is-done)');
      if (/opacity: 0|stroke-dashoffset: 1|scale\(/u.test(rule)) expect(rule).toContain('.sl-go:not(.is-in)');
    }
    expect(css).not.toMatch(/infinite|@keyframes|gradient/u);
  });

  it('has one mark, a 1px line across the figure, with the drawings as its later siblings', () => {
    expect(plate.match(/data-enter=/gu)).toHaveLength(1);
    expect(plate).toContain('<span class="sl-go" data-enter="draw" aria-hidden="true"></span>');
    expect(css).toContain('.sl-go { position: absolute; left: 0; top: 50%; width: 100%; height: 1px; pointer-events: none; }');
    expect(css).toContain('.sl-svg--wide { aspect-ratio: ${WIDE.w} / ${WIDE.h}; }');
    expect(css).toContain('.sl-svg--narrow { display: none; aspect-ratio: ${NARROW.w} / ${NARROW.h}; }');
    expect(plate).toContain('role="img" aria-label={words.alt}');
    expect(plate).toContain('<figcaption class="sl-caption">{words.caption}</figcaption>');
    // The mono face waits for the page to load (or the figure to come near), as on the Sun year plate.
    expect(plate).toContain('<figure class="sl-plate sl-hold">');
    expect(css).toContain('.sl-hold :is(.sl-lap, .sl-age) { font-family: inherit; }');
    expect(plate).toContain("addEventListener('load',function(){setTimeout(go,200)},{once:true})");
    expect(plate).toContain("rootMargin:'400px 0px'");
  });
});
