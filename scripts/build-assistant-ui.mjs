/*
 * Bundle a tiny site-wide Guide shell and the user-activated drawer as stable,
 * separate entrypoints. Placidus recomputation stays in a split child chunk,
 * so neither the shell nor an ordinary drawer open fetches the ephemeris.
 *
 * The package build wiring is owned by the integration slice.
 *
 *   node scripts/build-assistant-ui.mjs
 */
import { build } from 'esbuild';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { copyFile, stat } from 'node:fs/promises';
import { browserEngineEsbuild } from './lib/browser-engine.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = resolve(repo, 'dist/assets');
const entry = resolve(outdir, 'assistant-ui.js');
const stylesheet = resolve(outdir, 'assistant-ui.css');
const drawerEntry = resolve(outdir, 'assistant-drawer.js');
const drawerStylesheet = resolve(outdir, 'assistant-drawer.css');
const avatarSource = resolve(repo, 'public/assets/guide-avatar.webp');
const avatar = resolve(outdir, 'guide-avatar.webp');
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const fileEnv = loadEnv(mode, repo, 'PUBLIC_');
const publicEnv = (name) => process.env[name] ?? fileEnv[name] ?? '';

const define = {
  'import.meta.env.PUBLIC_SUPABASE_URL': JSON.stringify(publicEnv('PUBLIC_SUPABASE_URL')),
  'import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
    publicEnv('PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  ),
  'import.meta.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(publicEnv('PUBLIC_SUPABASE_ANON_KEY')),
};

// Build the public shell independently so esbuild cannot make it import a
// shared helper chunk from the private drawer graph.
await build({
  entryPoints: { 'assistant-ui': resolve(repo, 'src/lib/assistant/guide-bootstrap.ts') },
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  splitting: false,
  outdir,
  entryNames: '[name]',
  plugins: [browserEngineEsbuild()],
  define,
});

await build({
  entryPoints: { 'assistant-drawer': resolve(repo, 'src/lib/assistant/open-assistant.ts') },
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  splitting: true,
  outdir,
  entryNames: '[name]',
  chunkNames: 'assistant-chunks/[name]-[hash]',
  plugins: [browserEngineEsbuild()],
  // This stable bundle is built outside Astro/Vite's normal client graph.
  // Inline publishable Supabase configuration explicitly so Guide can fence
  // account A→B transitions; no server credential is exposed here.
  define,
});

await copyFile(avatarSource, avatar);

const [
  { size: scriptSize },
  { size: styleSize },
  { size: drawerScriptSize },
  { size: drawerStyleSize },
  { size: avatarSize },
] = await Promise.all([
  stat(entry),
  stat(stylesheet),
  stat(drawerEntry),
  stat(drawerStylesheet),
  stat(avatar),
]);
if (scriptSize > 12_000) throw new Error(`Guide shell is too large: ${scriptSize} bytes`);
if (styleSize > 6_000) throw new Error(`Guide shell CSS is too large: ${styleSize} bytes`);
if (avatarSize > 20_000) throw new Error(`Guide avatar is too large: ${avatarSize} bytes`);
console.log(
  `assistant-ui: dist/assets/assistant-ui.js · ${(scriptSize / 1024).toFixed(1)} KB` +
  ` · dist/assets/assistant-ui.css · ${(styleSize / 1024).toFixed(1)} KB` +
  ` · drawer ${(drawerScriptSize / 1024).toFixed(1)} KB JS/${(drawerStyleSize / 1024).toFixed(1)} KB CSS` +
  ` · dist/assets/guide-avatar.webp · ${(avatarSize / 1024).toFixed(1)} KB`,
);
