import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicBuildEnv } from './lib/public-build-env.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const source = resolve(root, 'public/sw.js');

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const output = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else output.push(path);
  }
  return output;
}

export async function serviceWorkerAssets(outputDirectory = dist) {
  const roots = [
    resolve(outputDirectory, '_astro'),
    resolve(outputDirectory, 'data/cities'),
  ];
  const files = (await Promise.all(roots.map(filesUnder))).flat()
    .filter((path) => /\.(?:js|css|json)$/.test(path));
  const staticUrls = [
    '/', '/tools/', '/birth-chart/', '/compatibility/', '/transits/',
    '/moon-sign/', '/rising-sign/', '/moon-phase/', '/saturn-return/',
    '/birthday/', '/eclipses/', '/retrogrades/', '/horoscopes/', '/today/',
    '/profile/', '/site.webmanifest',
    '/fonts/instrument-sans-latin-wght-normal.woff2',
    '/fonts/eb-garamond-latin-500-normal.woff2',
    '/fonts/jetbrains-mono-latin-wght-normal.woff2',
    ...Array.from({ length: 12 }, (_, index) => [
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ][index]).map((slug) => `/assets/zodiac-icons/48/${slug}.webp`),
  ];
  const generated = files.map((path) => `/${relative(outputDirectory, path).split(sep).join('/')}`);
  return [...new Set([...staticUrls, ...generated])].sort();
}

export async function buildServiceWorker({ outputDirectory = dist, pushEnabled = false } = {}) {
  const urls = await serviceWorkerAssets(outputDirectory);
  const hash = createHash('sha256');
  for (const url of urls) {
    hash.update(url);
    const path = resolve(outputDirectory, url.slice(1));
    const info = await stat(path).catch(() => null);
    if (info?.isFile()) hash.update(await readFile(path));
  }
  const version = hash.digest('hex').slice(0, 12);
  let code = await readFile(source, 'utf8');
  code = code.replace(
    /const CACHE_VERSION = '[^']+'; \/\/ @build cache-version/,
    `const CACHE_VERSION = '${version}'; // @build cache-version`,
  );
  code = code.replace(
    /const PRECACHE_URLS = \[ \/\/ @build precache-start[\s\S]*?\]; \/\/ @build precache-end/,
    `const PRECACHE_URLS = ${JSON.stringify(urls, null, 2)}; // @build precache-start @build precache-end`,
  );
  code = code.replace(
    /const PUSH_ENABLED = (?:true|false); \/\/ @build push-enabled/,
    `const PUSH_ENABLED = ${Boolean(pushEnabled)}; // @build push-enabled`,
  );
  await writeFile(resolve(outputDirectory, 'sw.js'), code, 'utf8');
  return { version, assets: urls.length, pushEnabled: Boolean(pushEnabled) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // The opt-in islands read PUBLIC_WEB_PUSH_ENABLED through import.meta.env,
  // which includes .env files; read it the same way so the worker agrees.
  const publicEnv = publicBuildEnv({ root });
  const report = await buildServiceWorker({
    pushEnabled: publicEnv('PUBLIC_WEB_PUSH_ENABLED') === '1' && process.env.PUSH_ENABLED === '1',
  });
  console.log(`Service worker: ${report.assets} assets · cache ${report.version} · push ${report.pushEnabled ? 'on' : 'off'}.`);
}
