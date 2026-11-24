// Engine 2.1.0 links the packed kernel from every computational entry point.
// Keep the installed archive intact and apply the browser choice at bundle time.
import { readFile } from 'node:fs/promises';

const ENGINE_DIST = /[/\\]node_modules[/\\]@zodiacs[/\\]engine[/\\]dist[/\\]/u;
const EPHEMERIS = 'chunk-BPZVUBFC.js';
const PACK = 'chunk-UXY4RU57.js';

function browserEngineSource(source, id) {
  if (!ENGINE_DIST.test(id)) return;
  const file = id.split(/[\\/]/u).at(-1);
  if (file === PACK) {
    if (!source.includes('var DE440_PACK_BASE64 = ')) throw new Error('The engine pack module changed');
    return "export function shippedDe440Source() { throw new Error('DE440 is unavailable in the site browser engine.'); }";
  }
  if (file === EPHEMERIS) {
    const setting = 'var INITIAL_DEFAULT_EPHEMERIS = "de440";';
    if (source.split(setting).length !== 2) throw new Error('The engine default ephemeris declaration changed');
    return source.replace(setting, 'var INITIAL_DEFAULT_EPHEMERIS = "astronomy-engine";');
  }
}

export function browserEngineVite() {
  return {
    name: 'zodiacs-browser-engine',
    enforce: 'pre',
    transform(source, id, options) {
      if (options?.ssr) return;
      const code = browserEngineSource(source, id.split('?')[0]);
      if (code !== undefined) return { code, map: null };
    },
  };
}

export function browserEngineEsbuild() {
  return {
    name: 'zodiacs-browser-engine',
    setup(build) {
      build.onLoad({ filter: /chunk-(BPZVUBFC|UXY4RU57)\.js$/ }, async ({ path }) => {
        if (!ENGINE_DIST.test(path)) return;
        const code = browserEngineSource(await readFile(path, 'utf8'), path);
        if (code !== undefined) return { contents: code, loader: 'js' };
      });
    },
  };
}
