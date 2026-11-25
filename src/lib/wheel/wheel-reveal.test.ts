import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import Wheel from './Wheel';

const css = postcss.parse(readFileSync(new URL('../../styles/calculator.css', import.meta.url), 'utf8'));

describe('birth chart reveal', () => {
  it('ranks the Sun first, then true zodiac longitude, preserving SVG paint order', () => {
    const bodies = [
      { body: 'Mars', lon: 350 }, { body: 'Moon', lon: 4 }, { body: 'Sun', lon: 200 },
    ];
    const markup = render(h(Wheel, { bodies, animate: true }));
    expect(markup).toContain('<g class="wheel__sign-ring">');
    expect(markup).toContain('<g class="wheel__aspect-lines">');
    expect([...markup.matchAll(/<g class="wheel__body" style="--i:(\d+)"/g)].map((m) => Number(m[1])))
      .toEqual([2, 1, 0]);
    for (const animate of [false, 'fade'] as const) {
      expect(render(h(Wheel, { bodies, animate }))).not.toMatch(/wheel--settle|wheel__sign-ring|wheel__aspect-lines|--i:/);
    }
  });

  it('uses only opacity and transform in the reveal keyframes', () => {
    const properties: Record<string, Set<string>> = {};
    css.walkAtRules('keyframes', (rule) => {
      if (!rule.params.startsWith('wheel-')) return;
      const props = properties[rule.params] = new Set<string>();
      rule.walkDecls((decl) => { props.add(decl.prop); });
    });
    const opacity = new Set(['opacity']);
    const motion = new Set(['opacity', 'transform']);
    expect(properties).toEqual({
      'wheel-in': motion, 'wheel-fade': opacity, 'wheel-ring-in': motion,
      'wheel-planet-in': motion, 'wheel-card-in': motion,
    });
  });

  it('gates each stage on motion preference and gives the whole wheel one reduced fade', () => {
    const reduced: string[] = [];
    css.walkDecls('animation', (decl) => {
      const rule = decl.parent;
      if (rule?.type !== 'rule') return;
      const media = rule.parent;
      const query = media?.type === 'atrule' ? media.params : '';
      if (rule.selector.includes('wheel--settle') || rule.selector.includes('data-wheel-reveal="first"')) {
        expect(query).toContain('(prefers-reduced-motion: no-preference)');
      }
      if (query === '(prefers-reduced-motion: reduce)' && rule.selector.includes('wheel')) {
        reduced.push(`${rule.selector} ${decl.value}`);
      }
    });
    expect(reduced).toEqual([
      '.wheel--animate none',
      '[data-wheel-reveal] .wheel--animate wheel-fade 160ms var(--ease) backwards',
    ]);
  });
});
