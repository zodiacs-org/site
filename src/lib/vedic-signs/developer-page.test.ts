import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * /developers/engine/ says whether the site reads @zodiacs/engine/vedic. It does only while the Vedic signs page is
 * switched on, so with PUBLIC_VEDIC_SIGNS_ENABLED off the page keeps main's two sentences, and with it on neither
 * says the site does not use the entry point.
 */
const SOURCE = readFileSync(new URL('../../pages/developers/engine/index.astro', import.meta.url), 'utf8');

describe('the engine page on the Vedic entry point', () => {
  it('reads the Vedic signs page switch', () => {
    expect(SOURCE).toContain("const vedicInUse = launchFlagOn('PUBLIC_VEDIC_SIGNS_ENABLED');");
  });

  it('keeps main\'s sentences with the switch off and drops "does not use" with it on', () => {
    const row = SOURCE.slice(SOURCE.indexOf("['@zodiacs/engine/vedic', vedicInUse"), SOURCE.indexOf("['@zodiacs/engine/time'"));
    const [on, off] = row.split('\n    : ');
    expect(on).toContain('This site\\\'s Vedic signs page and its get_vedic_signs tool read the ayanamsa, sidereal longitudes and nakshatras from it, and nothing else.');
    expect(off).toContain('dashas. This site uses none of it.');
    expect(off).not.toMatch(/Vedic signs page|get_vedic_signs/u);
    expect(SOURCE).toContain("entry points{vedicInUse ? '' : ', which this site does not use'}.");
    // No other line says either thing unconditionally.
    expect(SOURCE.match(/which this site does not use/gu)).toHaveLength(1);
    expect(SOURCE.match(/get_vedic_signs/gu)).toHaveLength(1);
  });
});
