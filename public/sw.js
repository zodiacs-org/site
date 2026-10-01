/* Generated cache metadata is injected by scripts/build-service-worker.mjs. */
const CACHE_VERSION = 'development'; // @build cache-version
const PRECACHE_URLS = [ // @build precache-start
  '/',
  '/tools/',
  '/birth-chart/',
  '/compatibility/',
  '/transits/',
  '/moon-sign/',
  '/rising-sign/',
  '/moon-phase/',
  '/saturn-return/',
  '/birthday/',
  '/eclipses/',
  '/retrogrades/',
  '/horoscopes/',
  '/today/',
  '/profile/',
  '/site.webmanifest',
]; // @build precache-end
const PUSH_ENABLED = false; // @build push-enabled

const SKY_ALERT_TITLE_MAX = 32;
const SKY_ALERT_BODY_MAX = 140;
const SKY_ALERT_PATH_MAX = 512;
const SKY_ALERT_PATH_PREFIXES = [
  '/eclipses/',
  '/events/',
  '/full-moon/',
  '/mars-retrograde/',
  '/mercury-retrograde/',
  '/new-moon/',
  '/retrogrades/',
  '/venus-retrograde/',
];

const SHELL_CACHE = `zodiacs-shell-${CACHE_VERSION}`;
const DATA_CACHE = `zodiacs-data-${CACHE_VERSION}`;
const CACHE_PREFIX = 'zodiacs-';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // One optional asset must never prevent the current accuracy cache from
    // activating; each URL gets an independent receipt.
    await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== DATA_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

/**
 * Routes that are never cached, because they claim not to be stored.
 *
 * The developer preview says on its face that it stores nothing and that
 * nothing entered there goes anywhere. `noServiceWorker` stops the page
 * REGISTERING a worker; it cannot stop an already-active worker at scope
 * `/` from controlling it, and the navigate branch below then put the
 * page's own HTML in Cache Storage. Measured: visit `/`, wait for the
 * worker, then open the preview -- `caches` held
 * `/developers/precision-preview/`. Storage is storage, so the route is
 * excluded here rather than the claim being softened.
 */
function neverCached(url) {
  return url.pathname === '/developers/precision-preview'
    || url.pathname.startsWith('/developers/precision-preview/')
    || url.pathname.startsWith('/precision-preview/');
}

function registryAuthority(url) {
  return url.pathname === '/registry/zodiacs.registry.json'
    || (url.pathname.startsWith('/registry/') && url.pathname.endsWith('.json'));
}

function registryVolatileSurface(url) {
  return url.pathname === '/registry'
    || url.pathname === '/registry/'
    || url.pathname === '/registry/index.html'
    || url.pathname === '/registry/exchange'
    || url.pathname === '/registry/exchange/'
    || url.pathname === '/registry/exchange/index.html'
    || url.pathname === '/astrofolio'
    || url.pathname === '/astrofolio/'
    || url.pathname === '/astrofolio/index.html'
    || url.pathname === '/astrofolio/how-to-buy'
    || url.pathname.startsWith('/astrofolio/how-to-buy/')
    || url.pathname === '/astrofolio/how-to-buy/index.html'
    || url.pathname === '/terminal'
    || url.pathname === '/terminal/'
    || url.pathname === '/terminal/index.html'
    || url.pathname === '/terminal/markets'
    || url.pathname === '/terminal/markets/'
    || url.pathname === '/terminal/markets/index.html';
}

function registryWing(url) {
  return ['/registry/', '/astrofolio/', '/terminal/', '/sdk/', '/thesis/', '/archive/', '/disclosure/']
    .some((prefix) => url.pathname.startsWith(prefix));
}

// The shell cache would otherwise grow one entry per visited page for the
// life of a deploy (thousands of programmatic routes exist). Bound the
// page entries so quota eviction never silently drops the precached
// offline shell; hashed assets stay untrimmed — a deploy bounds them.
const SHELL_PAGE_LIMIT = 40;

function boundedShellPage(url) {
  return !['/_astro/', '/assets/', '/fonts/', '/data/'].some((prefix) => url.pathname.startsWith(prefix))
    && !PRECACHE_URLS.includes(url.pathname);
}

async function trimShellPages(cache) {
  const keys = await cache.keys();
  const pages = keys.filter((request) => boundedShellPage(new URL(request.url)));
  const excess = pages.length - SHELL_PAGE_LIMIT;
  // Cache keys keep insertion order, so this drops the oldest first.
  for (const request of pages.slice(0, Math.max(0, excess))) {
    await cache.delete(request);
  }
}

async function networkFirst(request, cacheName, allowFallback = true) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      if (cacheName === SHELL_CACHE) trimShellPages(cache).catch(() => {});
    }
    return response;
  } catch (error) {
    if (!allowFallback) throw error;
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

function boundedAlertText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > maxLength || /[\u0000-\u001F\u007F]/.test(text)) return null;
  return text;
}

function safeEventPath(value) {
  if (typeof value !== 'string'
    || !value
    || value.length > SKY_ALERT_PATH_MAX
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('\\')
    || value.includes('?')
    || /[\u0000-\u001F\u007F]/.test(value)
    || !SKY_ALERT_PATH_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    return null;
  }

  const parts = value.split('#');
  if (parts.length > 2
    || !/^\/[a-z0-9/-]+\/$/i.test(parts[0])
    || (parts.length === 2 && !/^[a-z0-9-]+$/i.test(parts[1]))) {
    return null;
  }

  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin || `${url.pathname}${url.hash}` !== value) return null;
  } catch {
    return null;
  }
  return value;
}

/**
 * The site's API answers every request itself, and nothing under /api/ is
 * cached here, navigations included. Opening a calendar feed's address in a
 * tab is a navigation; the navigate branch below would otherwise keep the
 * calendar in Cache Storage, where removing the calendar does not reach it.
 */
function siteApi(url) {
  return url.pathname === '/api' || url.pathname.startsWith('/api/');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Straight to the network, as if no worker were installed.
  if (siteApi(url)) return;

  // Registry identity and flag-stamped Terminal bytes are live authority.
  // Offline must fail honestly, never preserve an old mint or flag state.
  // The developer preview is here for a different reason: it claims to
  // store nothing, and a cached copy of it is stored.
  if (registryAuthority(url) || registryVolatileSurface(url) || neverCached(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (registryWing(url)) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (url.pathname.startsWith('/data/')
    || url.pathname.startsWith('/_astro/')
    || url.pathname.startsWith('/assets/zodiac-icons/')
    || url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(request, url.pathname.startsWith('/data/') ? DATA_CACHE : SHELL_CACHE));
  }
});

if (PUSH_ENABLED) {
  self.addEventListener('push', (event) => {
    let payload;
    try {
      payload = event.data?.json();
    } catch {
      return;
    }

    const title = boundedAlertText(payload?.title, SKY_ALERT_TITLE_MAX);
    const body = boundedAlertText(payload?.body, SKY_ALERT_BODY_MAX);
    const path = safeEventPath(payload?.url);
    if (!title || !body || !path) return;

    event.waitUntil(self.registration.showNotification(title, {
      body,
      icon: '/assets/app-icons/v3/icon-192.png',
      badge: '/assets/app-icons/v3/icon-192.png',
      tag: 'zodiacs-sky-alert',
      data: { url: path },
    }));
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const path = safeEventPath(event.notification.data?.url);
    if (!path) return;
    const target = new URL(path, self.location.origin).href;

    event.waitUntil((async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })());
  });
}
