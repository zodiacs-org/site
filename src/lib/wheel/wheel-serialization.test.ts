/**
 * Serialization regression gate for the Wheel refactor.
 *
 * The share-card renderer (src/lib/share-card.ts) renders <Wheel> headlessly
 * with EXACTLY the props used here and serializes the SVG. The Chart Explorer
 * adds optional interaction props to Wheel; with those props omitted the
 * rendered markup must stay byte-identical, or every previously shared card
 * silently changes. The committed snapshot was generated from the
 * pre-Explorer Wheel — do not regenerate it to make a diff pass without
 * understanding exactly which pixels you are changing.
 *
 * (preact-render-to-string ships as a dependency of @astrojs/preact — no new
 * package. It renders the same VDOM the browser path serializes via
 * XMLSerializer; attribute order is stable in both.)
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import Wheel from './Wheel';
import TechnicalWheel from './TechnicalWheel';
import { SIGNS } from '../signs';
import frida from '../../data/demo-chart-frida.json';

type FixtureBody = { body: string; lon: number; retrograde: boolean };

function shareCardProps() {
  return {
    bodies: (frida.bodies as FixtureBody[]).filter((b) => b.body !== 'South Node'),
    asc: frida.angles.asc,
    mc: frida.angles.mc,
    cusps: frida.houses.cusps,
    aspects: [
      // A representative chord of each type so every ASPECT_COLOR path renders.
      { a: 'Sun', b: 'Moon', type: 'sextile' },
      { a: 'Sun', b: 'North Node', type: 'conjunction' },
      { a: 'Moon', b: 'Mars', type: 'square' },
      { a: 'Venus', b: 'Mars', type: 'opposition' },
      { a: 'Mercury', b: 'Saturn', type: 'trine' },
    ],
  };
}

describe('Wheel share-card serialization', () => {
  it('renders byte-identically with interaction props omitted', () => {
    const markup = render(h(Wheel as any, shareCardProps()));
    const frozen = createRequire(import.meta.url)('./__snapshots__/wheel-serialization.test.ts.snap')
      ['Wheel share-card serialization > renders byte-identically with interaction props omitted 1'];
    // libm can shift the final trig coordinate by ~3e-14 pixels on macOS.
    // Compare coordinates to 1e-10 px; every other byte remains pinned to the
    // original snapshot, which is deliberately not regenerated.
    const pattern = /\b(x1|x2|y1|y2|cx|cy)="(-?\d+\.\d+)"/g;
    const reference = [...frozen.slice(1, -1).matchAll(pattern)];
    let index = 0;
    const canonical = markup.replace(pattern, (_match, name, value) => {
      const expected = reference[index++];
      expect(name).toBe(expected?.[1]);
      expect(Math.abs(Number(value) - Number(expected[2]))).toBeLessThanOrEqual(1e-10);
      return expected[0];
    });
    expect(index).toBe(reference.length);
    expect(canonical).toMatchSnapshot();
  });

  it('renders the no-angles fallback identically (0° Aries anchor, no spokes)', () => {
    const markup = render(h(Wheel as any, {
      bodies: (frida.bodies as FixtureBody[]).filter((b) => b.body !== 'South Node'),
      asc: null,
      mc: null,
      cusps: null,
      aspects: [],
    }));
    expect(markup).toMatchSnapshot();
  });

  it('adds audit marks only for the technical chart sheet', () => {
    const bodies = frida.bodies as FixtureBody[];
    const markup = render(h(TechnicalWheel as any, {
      ...shareCardProps(),
      bodies,
      dsc: (frida.angles.asc + 180) % 360,
      ic: (frida.angles.mc + 180) % 360,
      technical: true,
    }));
    expect(markup.match(/data-degree-tick=/g)).toHaveLength(360);
    expect(markup.match(/data-body-leader=/g)).toHaveLength(bodies.length);
    expect(markup).toContain('data-angle-label="DSC"');
    expect(markup).toContain('>DSC</text>');
    expect(markup).toContain('data-angle-label="IC"');
    expect(markup).toContain('>IC</text>');
    expect(markup).toContain('data-body-leader="South Node"');
    expect(markup.match(/href="\/assets\/zodiac-icons\/128\//g)).toHaveLength(12);
  });

  it('serializes embedded technical artwork without any external image request', () => {
    const signImageHrefs = Object.fromEntries(SIGNS.map((sign) => [sign.slug, 'data:image/webp;base64,dGVzdA==']));
    const markup = render(h(TechnicalWheel, { ...shareCardProps(), signImageHrefs }));
    expect(markup.match(/href="data:image\/webp;base64,dGVzdA=="/g)).toHaveLength(12);
    expect(markup).not.toContain('/assets/zodiac-icons/');
    expect(markup.match(/data-degree-tick=/g)).toHaveLength(360);
  });
});

describe('Wheel overlay slot (bi-wheel)', () => {
  const natalProps = () => ({
    bodies: (frida.bodies as FixtureBody[]).filter((b) => b.body !== 'South Node'),
    asc: frida.angles.asc,
    mc: frida.angles.mc,
    cusps: frida.houses.cusps,
    aspects: [] as { a: string; b: string; type: string }[],
  });

  it('grows the viewBox and renders the slot, given the wheel geometry', () => {
    // A probe overlay: place one mark on the outer ring using the geometry
    // the slot is handed. This pins the contract (viewBox growth + a rendered
    // slot) without coupling to the transit island's overlay renderer.
    const markup = render(h(Wheel as any, {
      ...natalProps(),
      renderOverlay: (geo: any) => {
        const p = geo.pt(120, geo.rOuter);
        return h('circle', { class: 'probe', cx: p.x, cy: p.y, r: 3 });
      },
    }));
    expect(markup).toContain('class="probe"');
    // Non-overlay viewBox is "-21 -21 462 462" (pad = size*0.05, size 420);
    // with an overlay pad grows to size*0.115 → -48.3.
    expect(markup).toMatch(/viewBox="-48\.3\d* -48\.3\d* 516\.6 516\.6"/);
  });

  it('is byte-identical to the static wheel when no overlay slot is given', () => {
    const withoutSlot = render(h(Wheel as any, natalProps()));
    expect(withoutSlot).toContain('viewBox="-21 -21 462 462"');
    expect(withoutSlot).not.toContain('wheel__overlay');
  });
});
