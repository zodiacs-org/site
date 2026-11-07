/**
 * The owner-selected plugin avatar: the twelve sign glyphs in coloured circles on the dark background, chosen on
 * 7 November 2026. The 512 × 512 PNG in the plugin is the picture itself, made once from the owner's 1000 × 1000
 * original; the build copies it byte for byte to its versioned public address. The tilted ring of 27 October
 * (icon-v2.png, zodiacs-avatar-v2.png) stays published for listings that still point at it.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const PLUGIN_AVATAR_PATH = './assets/icon-v3.png';
export const PLUGIN_AVATAR_PUBLIC_PATH = '/assets/ai/brand/zodiacs-avatar-v3.png';
const root = new URL('../', import.meta.url);
const SOURCE = `plugins/zodiacs-sky/${PLUGIN_AVATAR_PATH.slice(2)}`;
const PUBLIC_COPY = `public${PLUGIN_AVATAR_PUBLIC_PATH}`;
const V2 = '739964975885d3a9d0228bb55dda611bacab461ace4a6eec7f00735f3042e5e8';
const V3 = 'a42a272a0ad3aa3a485fa24e3e2fe9ea7637b291a3c164c84a271b220de82628';
/** Every published avatar, pinned: a versioned picture keeps its bytes once it is out. */
const PUBLISHED = {
  'plugins/zodiacs-sky/assets/icon-v2.png': V2,
  'public/assets/ai/brand/zodiacs-avatar-v2.png': V2,
  [SOURCE]: V3,
  [PUBLIC_COPY]: V3,
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const at = (relative) => fileURLToPath(new URL(relative, root));
const readIfThere = (relative) => readFile(at(relative)).catch((error) => {
  if (error.code === 'ENOENT') return null;
  throw error;
});

export async function buildPluginAvatar(check = false) {
  const png = await readFile(at(SOURCE));
  const { format, width, height, hasAlpha } = await sharp(png).metadata();
  if (format !== 'png' || width !== 512 || height !== 512 || hasAlpha) throw new Error(`${SOURCE} must be an opaque 512 × 512 PNG`);
  if (!(await readIfThere(PUBLIC_COPY))) {
    if (check) throw new Error(`${PUBLIC_COPY} is missing; run npm run ai:build`);
    await mkdir(dirname(at(PUBLIC_COPY)), { recursive: true });
    await writeFile(at(PUBLIC_COPY), png);
  }
  // The current avatar and the ones listings may still use keep their bytes, in a build and in a check.
  for (const [relative, expected] of Object.entries(PUBLISHED)) {
    const bytes = await readIfThere(relative);
    if (!bytes) throw new Error(`${relative} is missing: a published plugin avatar stays published`);
    if (sha256(bytes) !== expected) throw new Error(`${relative} changed: give the plugin avatar a new filename instead`);
  }
  console.log(`${check ? 'Verified' : 'Built'} plugin avatar (512px, the twelve sign glyphs)`);
}
