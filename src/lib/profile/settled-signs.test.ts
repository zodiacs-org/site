import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { SIGNS } from '../signs';
import { SIGN_HUES, settledSignIndex, settledSunHue, signIndexOf } from './settled-signs';

describe('settled signs', () => {
  it('mirrors the canonical sign hues without importing the sign table', () => {
    expect(SIGN_HUES).toEqual(SIGNS.map((sign) => sign.hue));
  });

  it('settles every body when the birth time is known', () => {
    expect(settledSignIndex('Moon', 0.2, true)).toBe(0);
    expect(settledSignIndex('Sun', 359.99, true)).toBe(11);
    expect(signIndexOf(-15)).toBe(11);
  });

  it('never settles the Moon without a birth time', () => {
    expect(settledSignIndex('Moon', 15, false)).toBeNull();
  });

  it('settles a reference-time Sun only when a full day keeps it in one sign', () => {
    expect(settledSignIndex('Sun', 45, false)).toBe(1);
    expect(settledSignIndex('Sun', 30.5, false)).toBeNull();
    expect(settledSignIndex('Sun', 59.5, false)).toBeNull();
    expect(settledSignIndex('Pluto', 30.5, false)).toBe(1);
  });

  it('colours by the Sun only when its sign is settled', () => {
    expect(settledSunHue([{ body: 'Sun', lon: 130 }], false)).toBe('#E0A9B4');
    expect(settledSunHue([{ body: 'Sun', lon: 120.3 }], false)).toBeNull();
    expect(settledSunHue([{ body: 'Sun', lon: 120.3 }], true)).toBe('#E0A9B4');
    expect(settledSunHue([{ body: 'Moon', lon: 3 }], true)).toBeNull();
  });

  it('keeps the navigation copy of the hues, the settle rule and the name rules in step', async () => {
    const nav = await readFile(new URL('./navigation-avatar.mjs', import.meta.url), 'utf8');
    const script = nav.slice(nav.indexOf('var hues = ['), nav.indexOf('function render()'));
    expect(script.match(/#[0-9A-F]{6}/gu)).toEqual([...SIGN_HUES]);
    expect(script).toContain('within < 1.02 || 30 - within < 1.02');
    // The automatic-name rule of me.ts and the initial rule of initial.ts.
    expect(script).toContain('/·\\s*\\d{4}-\\d{2}-\\d{2}\\s*$/');
    expect(script).toContain("new RegExp('[\\\\p{Cc}\\\\p{Cf}]', 'gu')");
    expect(script).toContain("new RegExp('^[\\\\p{L}\\\\p{N}]$', 'u')");
    const me = await readFile(new URL('./me.ts', import.meta.url), 'utf8');
    const initial = await readFile(new URL('./initial.ts', import.meta.url), 'utf8');
    expect(me).toContain('/·\\s*\\d{4}-\\d{2}-\\d{2}\\s*$/u');
    expect(initial).toContain('/[\\p{Cc}\\p{Cf}]/gu');
    expect(initial).toContain('/^[\\p{L}\\p{N}]$/u');
  });
});
