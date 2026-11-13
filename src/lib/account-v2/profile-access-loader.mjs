/**
 * The inline presence loader for the profile access bootstrap.
 *
 * With encrypted account sync on, only the profile pages and the two main
 * calculators hydrate the bootstrap island. Every other page carries this
 * small classic script instead. It imports the bootstrap's on-demand chunk
 * (src/lib/account-v2/profile-access-autostart.ts) only when:
 *
 * - a presence marker exists in localStorage: the Supabase auth entry, the
 *   account owner or retained-owner key, or one of the account-bound profile
 *   keys. Only key NAMES are compared (`localStorage.key(i)`, and the key of
 *   a `storage` event from another tab); no stored value is ever read;
 * - the visitor opens the account entry point (`[data-account-entry]`);
 * - a save asks for it, which goes through profile-access-request.ts and
 *   imports the same chunk, so the module (and the bootstrap) is shared.
 *
 * The chunk's hashed URL is not known when Astro renders the page, so the
 * page carries PROFILE_ACCESS_CHUNK_PLACEHOLDER and the postbuild step
 * scripts/stamp-profile-access-loader.mjs writes the URL in, failing the
 * build if the chunk is missing or ambiguous. check-dist re-verifies it.
 * A dynamic import inside a classic script is not counted by
 * report-bundles, by design: nothing loads unless one of the above happens.
 */

export const PROFILE_ACCESS_CHUNK_PLACEHOLDER = '__ZODIACS_PROFILE_ACCESS_AUTOSTART_URL__';
export const PROFILE_ACCESS_LOADER_ATTRIBUTE = 'data-profile-access-loader';
export const PROFILE_ACCESS_ENTRY_ATTRIBUTE = 'data-account-entry';
/** Where the dev server serves the entry; production pages carry the stamped chunk. */
export const PROFILE_ACCESS_DEV_ENTRY = '/src/lib/account-v2/profile-access-autostart.ts';
/** The chunk Vite emits for the entry, under dist/_astro/. */
export const PROFILE_ACCESS_CHUNK_PATTERN = /^profile-access-autostart\.[A-Za-z0-9_-]+\.js$/u;

/**
 * The loader's body. ES5 on purpose (it is not transpiled), and it reads only
 * key names. Parameters: window, document, src, keys, load.
 */
export const PROFILE_ACCESS_LOADER_BODY = `
  var started = false;
  var start = function () {
    // An unstamped page (a bare \`astro build\`) still holds the placeholder,
    // which starts with "__"; it never imports anything.
    if (started || typeof src !== 'string' || src.charAt(0) !== '/' || src.charAt(1) === '/') return;
    started = true;
    try {
      Promise.resolve(load(src)).catch(function () { started = false; });
    } catch (error) { started = false; }
  };
  var marked = function (name) { return name !== null && keys.indexOf(name) >= 0; };
  try {
    var storage = window.localStorage;
    for (var index = 0; index < storage.length; index += 1) {
      if (marked(storage.key(index))) { start(); break; }
    }
  } catch (error) {}
  window.addEventListener('storage', function (event) {
    if (event && marked(event.key)) start();
  });
  var opened = function (event) {
    var target = event && event.target;
    if (target && typeof target.closest === 'function'
      && target.closest('[${PROFILE_ACCESS_ENTRY_ATTRIBUTE}]')) start();
  };
  document.addEventListener('pointerdown', opened, true);
  document.addEventListener('click', opened, true);
`;

const EAGER_SECTIONS = ['/profile/', '/birth-chart/', '/compatibility/'];
const EAGER_LOCALES = ['', '/es', '/fr', '/it', '/pt', '/ru'];

/**
 * Routes that hydrate the bootstrap island at load: the profile pages, where
 * the account lives, and the two main calculators, whose first saves need it
 * (owner decision, 2026-11-12). Every other page gets the presence loader.
 */
export const PROFILE_ACCESS_EAGER_ROUTES = Object.freeze(
  EAGER_LOCALES.flatMap((prefix) => EAGER_SECTIONS.map((section) => `${prefix}${section}`)),
);

/** @param {string} path */
export function profileAccessBootstrapEager(path) {
  return PROFILE_ACCESS_EAGER_ROUTES.includes(path);
}

/**
 * The exact presence-marker key names for one build. `supabaseAuthKey` is the
 * project's session entry name (`supabaseAuthStorageKeyName`), or null when
 * Supabase is not configured.
 * @param {{ supabaseAuthKey?: string | null, ownerKey: string, retainedOwnerKey: string, profileKeys: readonly string[] }} input
 * @returns {string[]}
 */
export function profileAccessMarkerKeys({ supabaseAuthKey, ownerKey, retainedOwnerKey, profileKeys }) {
  return [...new Set([...(supabaseAuthKey ? [supabaseAuthKey] : []), ownerKey, retainedOwnerKey, ...profileKeys])];
}

/**
 * The inline script a page carries.
 * @param {{ src: string, keys: readonly string[] }} input
 * @returns {string}
 */
export function profileAccessLoaderScript({ src, keys }) {
  return `(function (window, document, src, keys, load) {${PROFILE_ACCESS_LOADER_BODY}})`
    + `(window, document, ${JSON.stringify(src)}, ${JSON.stringify(keys)}, function (url) { return import(url); });`;
}
