import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Full-coverage static 400 instance of the existing variable JetBrains Mono.
 * Retains all 229 encoded codepoints, 394 glyphs, hint instructions and all
 * shaping features, including calt. The static asset is used only at weight
 * 400; other weights keep the original variable font.
 *
 * Reproduce from the repository root with fontTools 4.65.0:
 * python3 - <<'PY'
 * from fontTools.ttLib import TTFont
 * from fontTools.varLib.instancer import instantiateVariableFont
 * font = TTFont('public/fonts/jetbrains-mono-latin-wght-normal.woff2', recalcTimestamp=False)
 * font = instantiateVariableFont(font, {'wght': 400}, inplace=False)
 * font['head'].modified = 3875247664
 * font.save('public/assets/locale/jetbrains-mono-latin-400-normal.woff2')
 * PY
 *
 * The fixed OpenType timestamp keeps the WOFF2 output deterministic. An audit
 * against the original instantiated at 400 verified every glyph's advances,
 * decomposed outlines, point flags and instructions, plus identical GSUB,
 * GPOS, GDEF, prep, gasp, hmtx, hhea, OS/2 and STAT tables after serialization.
 */
const sourceUrl = new URL('../public/fonts/jetbrains-mono-latin-wght-normal.woff2', import.meta.url);
const assetUrl = new URL('../public/assets/locale/jetbrains-mono-latin-400-normal.woff2', import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

describe('locale mono font instance', () => {
  it('pins the original full-coverage variable source', async () => {
    const source = await readFile(sourceUrl);
    expect(source.byteLength).toBe(40_404);
    expect(sha256(source)).toBe('18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e');
  });

  it('pins the static 400 font and its WOFF2 header', async () => {
    const asset = await readFile(assetUrl);
    expect(asset.byteLength).toBe(21_152);
    expect(asset.subarray(0, 4).toString('ascii')).toBe('wOF2');
    expect(asset.readUInt32BE(4)).toBe(0x00010000);
    expect(asset.readUInt32BE(8)).toBe(asset.byteLength);
    expect(sha256(asset)).toBe('4d7a4ffdf14a0b6badd562ce8e0c690cf091bb2a995ef9bc71757d9a4827f4ff');
  });
});
