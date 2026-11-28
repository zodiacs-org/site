// The /tarot/ route follows PUBLIC_TAROT_ENABLED (exactly '1', src/lib/launch-flags.ts). The page is
// src/pages/tarot/_draw.astro, which Astro does not route by itself (a leading underscore), so the boundary and
// claims scans still read it where the other pages live. On, /tarot/ is that page; off, it is _off.astro, the plain
// redirect to the 404 page. An island a page imports is bundled even when the page redirects, so only this keeps
// the draw, its 78 meanings and its chunk out of a flag-off build (and out of the service worker's precache list).
// Plain Node: the Astro config reads the shell's variable, as the other build-time switches do.
export const TAROT_FLAG = 'PUBLIC_TAROT_ENABLED';
export const TAROT_PAGE_ENTRYPOINT = './src/pages/tarot/_draw.astro';
export const TAROT_OFF_ENTRYPOINT = './src/pages/tarot/_off.astro';

export const tarotEnabled = (env = process.env) => env?.[TAROT_FLAG] === '1';

export function tarotRoute(enabled = tarotEnabled()) {
  return {
    name: 'zodiacs-tarot-route',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({ pattern: '/tarot/', entrypoint: enabled ? TAROT_PAGE_ENTRYPOINT : TAROT_OFF_ENTRYPOINT });
      },
    },
  };
}
