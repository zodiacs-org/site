/**
 * The owner-selected plugin avatar: the twelve sign glyphs in coloured circles on the dark background, chosen on
 * 7 November 2026. The 512 × 512 PNG in the plugin is the picture itself, made once from the owner's 1000 × 1000
 * original; the build copies it byte for byte to its versioned public address. The tilted ring of 27 October
 * (icon-v2.png, zodiacs-avatar-v2.png) stays published for listings that still point at it.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const PLUGIN_AVATAR_PATH = './assets/icon-v3.png';
export const PLUGIN_AVATAR_PUBLIC_PATH = '/assets/ai/brand/zodiacs-avatar-v3.png';
const root = new URL('../', import.meta.url);
const SOURCE = 'plugins/zodiacs-sky/assets/icon-v3.png';
const files = [`public${PLUGIN_AVATAR_PUBLIC_PATH}`];

export async function buildPluginAvatar(check = false) {
  const png = await readFile(fileURLToPath(new URL(SOURCE, root)));
  const { format, width, height } = await sharp(png).metadata();
  if (format !== 'png' || width !== 512 || height !== 512) throw new Error(`${SOURCE} must be a 512 × 512 PNG`);
  const outputs = await Promise.all(files.map(async (relative) => {
    const path = fileURLToPath(new URL(relative, root));
    const current = await readFile(path).catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    return { path, relative, current };
  }));
  // Versioned public pictures stay immutable, including during a normal build.
  for (const { relative, current } of outputs) {
    if (current && !current.equals(png)) {
      throw new Error(`${relative} changed: give the plugin avatar a new filename before regenerating`);
    }
    if (check && !current) throw new Error(`${relative} is missing; run npm run ai:build`);
  }
  if (!check) {
    for (const { path, current } of outputs) {
      if (current) continue;
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, png);
    }
  }
  console.log(`${check ? 'Verified' : 'Built'} plugin avatar (512px, the twelve sign glyphs)`);
}
