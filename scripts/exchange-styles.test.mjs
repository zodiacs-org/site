import { describe, expect, it } from 'vitest';
import { ZX_CSS } from '../src/exchange/styles.mjs';
import { EXCHANGE_SIGNS } from '../src/exchange/signs.mjs';
import { NAV_SIGNS } from './wing-nav.mjs';

describe('the terminal stylesheet', () => {
  it('loads nothing from anywhere — no url() at all, no import', () => {
    expect(ZX_CSS).not.toMatch(/url\(/i);
    expect(ZX_CSS).not.toMatch(/@import/i);
    expect(ZX_CSS).not.toMatch(/https?:/i);
  });

  it('keeps decorative colors neutral and uses approved semantic colors only for market movement', () => {
    // The Cosmic Void ramp is greys; every color-mix leans on --sign.
    expect(ZX_CSS).not.toMatch(/#E7C879|#D4AF37|gold/i);
    const hexes = ZX_CSS.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
    const allowed = ['#EEF1F7', '#C6CCDA', '#8E96AB', '#8dd9ad', '#f28e87'];
    for (const hex of hexes) expect(allowed, hex).toContain(hex);
  });

  it('speaks the house type: serif display, sans body, mono data', () => {
    expect(ZX_CSS).toContain("'EB Garamond'");
    expect(ZX_CSS).toContain("'Instrument Sans'");
    expect(ZX_CSS).toContain("'JetBrains Mono'");
  });

  it('respects reduced motion', () => {
    expect(ZX_CSS).toContain('prefers-reduced-motion');
  });
});

describe('the copied sign table', () => {
  it('mirrors the wing nav exactly, so the two can never skew', () => {
    expect(EXCHANGE_SIGNS).toHaveLength(NAV_SIGNS.length);
    for (const [index, sign] of EXCHANGE_SIGNS.entries()) {
      const source = NAV_SIGNS[index];
      expect(sign.slug, sign.slug).toBe(source.slug);
      expect(sign.name, sign.slug).toBe(source.name);
      expect(sign.glyph, sign.slug).toBe(source.glyph);
      expect(sign.hue, sign.slug).toBe(source.hue);
    }
  });
});
