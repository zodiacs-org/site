import { describe, expect, it } from 'vitest';
import { CHIRON_GLYPH, PLANET_GLYPH } from './paths';

/** The box a glyph's circles take up, and the points its paths move to: what has to stay inside the 24 unit box. */
function extents(markup: string): number[] {
  const circles = [...markup.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/gu)].flatMap(([, cx, cy, r]) => [Number(cx) - Number(r), Number(cx) + Number(r), Number(cy) - Number(r), Number(cy) + Number(r)]);
  const moves = [...markup.matchAll(/M\s*([\d.]+)[\s,]+([\d.]+)/gu)].flatMap(([, x, y]) => [Number(x), Number(y)]);
  return [...circles, ...moves];
}

describe('the body glyphs', () => {
  it('draw the lunar nodes and Chiron as the planets are drawn: line art on the 24 unit box, in paths and circles', () => {
    for (const [body, markup] of Object.entries({ 'North Node': PLANET_GLYPH['North Node'], 'South Node': PLANET_GLYPH['South Node'], Chiron: CHIRON_GLYPH })) {
      expect(markup, body).toBeTruthy();
      expect([...markup.matchAll(/<(\w+)/gu)].map((match) => match[1]).every((tag) => tag === 'path' || tag === 'circle'), body).toBe(true);
      // Circles and the points paths start from stay inside the box, clear of its edge, as the planets' do.
      expect(extents(markup).length, body).toBeGreaterThan(0);
      expect(extents(markup).every((value) => value >= 2 && value <= 22), body).toBe(true);
      // Stroked like the planets: only the nodes' small dots are filled.
      expect(markup.replace(/<circle [^>]*fill="currentColor" stroke="none"\/>/gu, ''), body).not.toMatch(/fill=/u);
    }
  });

  it('draw Chiron as the key: a K on a stem over a small circle', () => {
    expect(CHIRON_GLYPH).toBe('<path d="M11 3.8v10.8M11 9.2l4.6-4.6M11 9.2l4.6 4.6"/><circle cx="11" cy="17.4" r="2.8"/>');
  });
});
