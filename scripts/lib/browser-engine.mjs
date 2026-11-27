// Browser bundles compute on astronomy-engine, the engine's default since
// 3.0.0. Server code installs the 2.4 MB DE440 pack with useDe440()
// (src/lib/engine/server-de440.mjs); these plugins refuse the pack's entry
// point, its module and that installer in every browser build, so no page,
// worker, panel or widget can carry it. Vite's SSR transforms and the Node
// bundles are left alone.
const PACK = '@zodiacs/engine/de440/pack';
const REFUSED = /(?:[/\\]src[/\\]lib[/\\]engine[/\\]server-de440\.mjs|[/\\]node_modules[/\\]@zodiacs[/\\]engine[/\\]dist[/\\]de440-pack\.js)$/u;

function refusal(what) {
  return `${what} would put the DE440 pack in a browser bundle; the browser computes on astronomy-engine (scripts/lib/browser-engine.mjs).`;
}

export function browserEngineVite() {
  return {
    name: 'zodiacs-browser-engine',
    enforce: 'pre',
    resolveId(source, importer, options) {
      if (options?.ssr || source !== PACK) return;
      this.error(refusal(`${importer ?? 'An entry'} imports ${PACK} and`));
    },
    load(id, options) {
      if (options?.ssr) return;
      const file = id.split('?')[0];
      if (REFUSED.test(file)) this.error(refusal(file));
    },
  };
}

export function browserEngineEsbuild() {
  return {
    name: 'zodiacs-browser-engine',
    setup(build) {
      build.onResolve({ filter: /^@zodiacs\/engine\/de440\/pack$/ }, ({ importer }) => ({
        errors: [{ text: refusal(`${importer || 'An entry'} imports ${PACK} and`) }],
      }));
      build.onLoad({ filter: /(?:server-de440\.mjs|de440-pack\.js)$/ }, ({ path }) => {
        if (REFUSED.test(path)) return { errors: [{ text: refusal(path) }] };
      });
    },
  };
}
