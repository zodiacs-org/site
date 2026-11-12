import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ANALYTICS_EVENT_PROPS,
  ANALYTICS_EVENT_VALUES,
} from '../src/lib/analytics-config.mjs';
import { GUIDE_LOADER_MARKER, guideLoaderSource } from '../src/lib/assistant/guide-loader.mjs';
import { publicBuildEnv } from './lib/public-build-env.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const START = '<!-- zodiacs-analytics:start -->';
const END = '<!-- zodiacs-analytics:end -->';
const BLOCK = new RegExp(`\\n?${START}[\\s\\S]*?${END}\\n?`, 'g');
const SCRIPT_BLOCK = /\n?[ \t]*<script(?:\s[^>]*)?>[\s\S]*?<\/script>[ \t]*\n?/giu;
const PLAUSIBLE_PROVIDER = /\n?[ \t]*<script\b[^>]*\bsrc=["'][^"']*plausible[^"']*["'][^>]*>\s*<\/script>[ \t]*\n?/giu;
const CLICK_ONLY_GUIDE = `  <script>
  (function () {
    var modulePromise;
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('[data-assistant-open]');
      if (!button) return;
      modulePromise = modulePromise || import('/assets/assistant-ui.js');
      modulePromise.then(function (mod) { mod.openAssistant('en', button); }).catch(function () {});
    });
  })();
  </script>`;
const DEFAULT_GUIDE = `  <script data-guide-loader="${GUIDE_LOADER_MARKER}">
${guideLoaderSource('en')}
  </script>`;

export const TERMINAL_ANALYTICS_PATHS = Object.freeze([
  'public/astrofolio/index.html',
  'public/terminal/index.html',
]);

function stripRemoteAnalytics(html) {
  return html
    .replace(BLOCK, '')
    .replace(SCRIPT_BLOCK, (script) => (
      script.includes('window.plausible = window.plausible') ? '\n' : script
    ))
    .replace(PLAUSIBLE_PROVIDER, '');
}

export function ensureDefaultGuideBootstrap(html) {
  let found = false;
  const upgraded = html.replace(SCRIPT_BLOCK, (script) => {
    if (!script.includes('/assets/assistant-ui.js')) return script;
    found = true;
    return `\n${DEFAULT_GUIDE}\n`;
  });
  if (found) return upgraded;
  if (!html.includes(CLICK_ONLY_GUIDE)) return html;
  return html.replace(CLICK_ONLY_GUIDE, DEFAULT_GUIDE);
}

function escapeAttribute(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function injectLegacyAnalytics(html, config = {}) {
  const clean = html.replace(BLOCK, '');
  // Guide owns a private transcript in the DOM and sessionStorage. Keep every
  // surface that imports it free of a remote analytics runtime, including
  // hand-authored pages that previously carried their own Plausible loader.
  if (clean.includes('/assets/assistant-ui.js')) return stripRemoteAnalytics(clean);
  const scriptUrl = config.scriptUrl?.trim();
  // Several hand-authored wing pages carry the standard Plausible loader in
  // their source. Add only the bounded event bridge there so a configured
  // build never loads the provider twice.
  const providerIsPresent = /<script\b[^>]*\bsrc=["'][^"']*plausible[^"']*["'][^>]*>/i.test(clean);
  if (!scriptUrl && !(config.bridgeExistingProvider && providerIsPresent)) return clean;
  if (!clean.includes('</head>')) throw new Error('legacy analytics target has no </head>');
  const endpoint = config.endpoint?.trim() ?? '';
  const domain = config.domain?.trim() ?? '';
  const domainAttribute = domain ? ` data-domain="${escapeAttribute(domain)}"` : '';
  const providerSetup = providerIsPresent ? '' : `
  window.plausible = window.plausible || function () {
    (window.plausible.q = window.plausible.q || []).push(arguments);
  };
  window.plausible.init = window.plausible.init || function (options) {
    window.plausible.o = options || {};
  };
  var endpoint = ${JSON.stringify(endpoint)};
  var options = {
    hashBasedRouting: false,
    transformRequest: function (payload) {
      var canonical = document.querySelector('link[rel="canonical"]');
      payload.u = canonical ? canonical.href : location.origin + location.pathname;
      payload.r = null;
      if (payload.p && payload.p.url) delete payload.p.url;
      return payload;
    }
  };
  if (endpoint) options.endpoint = endpoint;
  window.plausible.init(options);`;
  const providerScript = providerIsPresent
    ? ''
    : `\n<script defer${domainAttribute} src="${escapeAttribute(scriptUrl)}"></script>`;
  const setup = `
${START}
<script>
  (function () {
${providerSetup}
    var eventProps = Object.freeze(${JSON.stringify(ANALYTICS_EVENT_PROPS)});
    var eventValues = Object.freeze(${JSON.stringify(ANALYTICS_EVENT_VALUES)});
    window.zodiacsAnalytics = Object.freeze({
      track: function (name, props) {
        var allowed = eventProps[name];
        if (!allowed) return;
        var safe = {};
        allowed.forEach(function (key) {
          var value = (props || {})[key];
          var enumValues = eventValues[name] && eventValues[name][key];
          if (enumValues && (typeof value !== 'string' || enumValues.indexOf(value) === -1)) return;
          if (typeof value === 'number' || typeof value === 'boolean' ||
              (typeof value === 'string' && value.length <= 32)) safe[key] = value;
        });
        window.plausible(name, { props: safe });
      }
    });
  }());
</script>${providerScript}
${END}
`;
  return clean.replace('</head>', `${setup}</head>`);
}

async function registryHtmlFiles() {
  const directory = resolve(root, 'public/registry');
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    // /registry/ is the first-party authority hub. It intentionally makes no
    // analytics or other third-party request; record and technical pages keep
    // the legacy analytics policy below it.
    if (entry.isFile() && entry.name === 'index.html') return [];
    // The Terminal venue route moved to /terminal/markets/. The legacy directory may
    // still exist in a dirty worktree while its tracked page is being removed.
    if (entry.isDirectory() && entry.name === 'exchange') return [];
    if (entry.isFile() && entry.name.endsWith('.html')) return [join(directory, entry.name)];
    if (entry.isDirectory()) return [join(directory, entry.name, 'index.html')];
    return [];
  });
}

export async function configureLegacyAnalytics(config = {}) {
  const targets = [
    ...(await registryHtmlFiles()),
    ...TERMINAL_ANALYTICS_PATHS.map((path) => resolve(root, path)),
    resolve(root, 'public/terminal/markets/index.html'),
    resolve(root, 'public/archive/index.html'),
    resolve(root, 'public/sdk/index.html'),
    resolve(root, 'public/sdk/examples/simastry-aura/index.html'),
    resolve(root, 'public/thesis/index.html'),
  ];
  let changed = 0;
  const terminalTargets = new Set(TERMINAL_ANALYTICS_PATHS.map((path) => resolve(root, path)));
  for (const target of targets) {
    const before = await readFile(target, 'utf8');
    const after = injectLegacyAnalytics(ensureDefaultGuideBootstrap(before), {
      ...config,
      bridgeExistingProvider: terminalTargets.has(target),
    });
    if (after !== before) {
      await writeFile(target, after, 'utf8');
      changed += 1;
    }
  }

  // A previous configured build must not leave provider code in a later
  // environment where analytics has been deliberately disabled.
  if (!config.scriptUrl) {
    await unlink(resolve(root, 'public/assets/analytics.js')).catch(() => {});
  }
  return { targets: targets.length, changed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Base.astro reads the same names through import.meta.env, which includes
  // .env files; read them the same way so wing pages and Astro pages agree.
  const publicEnv = publicBuildEnv({ root });
  const scriptUrl = publicEnv('PUBLIC_PLAUSIBLE_SCRIPT_URL');
  const result = await configureLegacyAnalytics({
    scriptUrl,
    endpoint: publicEnv('PUBLIC_PLAUSIBLE_ENDPOINT'),
    domain: publicEnv('PUBLIC_PLAUSIBLE_DOMAIN'),
  });
  console.log(`Legacy analytics: ${result.changed}/${result.targets} pages updated (${scriptUrl ? 'enabled' : 'disabled'}).`);
}
