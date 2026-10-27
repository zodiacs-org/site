/** The owner-selected plugin avatar, derived from the shared brand ring. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { tiltedRingCircles, TILTED_RING_VIEWBOX } from '../src/lib/brand-lockup.mjs';

export const PLUGIN_AVATAR_PATH = './assets/icon-v2.png';
export const PLUGIN_AVATAR_PUBLIC_PATH = '/assets/ai/brand/zodiacs-avatar-v2.png';
const root = new URL('../', import.meta.url);
const files = [
  'plugins/zodiacs-sky/assets/icon-v2.png',
  `public${PLUGIN_AVATAR_PUBLIC_PATH}`,
];

export async function buildPluginAvatar(check = false) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#060709"/><svg x="56" y="142" width="400" height="228" viewBox="${TILTED_RING_VIEWBOX}" fill="none">${tiltedRingCircles()}</svg></svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
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
  console.log(`${check ? 'Verified' : 'Built'} plugin avatar (512px, shared tilted ring)`);
}
