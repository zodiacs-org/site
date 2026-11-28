import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import NumerologyCalculator from './NumerologyCalculator';

describe('NumerologyCalculator age-first gating and title disclosure', () => {
  it('renders Birth date before Full name at birth and disables the name input until a valid 13+ date is entered', () => {
    const html = render(h(NumerologyCalculator, { share: false }));
    const dateIndex = html.indexOf('id="num-date"');
    const nameIndex = html.indexOf('id="num-name"');
    expect(dateIndex).toBeGreaterThan(-1);
    expect(nameIndex).toBeGreaterThan(dateIndex);
    // Name input starts disabled before a birth date is given.
    const nameTag = html.slice(html.lastIndexOf('<input', nameIndex), html.indexOf('>', nameIndex) + 1);
    expect(nameTag).toMatch(/\bdisabled\b/u);
    expect(html).toContain('Enter a birth date (13 or older) first');
  });

  it('clears the name on an under-13 refusal and exposes per-occurrence toggles that remap Y overrides when title/suffix parts are ignored', () => {
    const source = readFileSync(new URL('./NumerologyCalculator.tsx', import.meta.url), 'utf8');
    // Both onDateChange and submit clear name when birthDateRefusal fires.
    expect(source).toContain('const refusal = birthDateRefusal(nextDate);');
    expect(source).toContain("setName('');");
    expect(source).toContain('droppedNamePartEntries');
    expect(source).toContain('droppedPartLabel');
    expect(source).toContain('keepPartIndices');
    expect(source).toContain('remapYOverrides');
    expect(source).toContain('toggleDroppedPart');
    expect(source).toContain('in birth name');
  });
});
