import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';

function interactionDirective() {
  return {
    name: 'zodiacs-interaction-directive',
    hooks: {
      'astro:config:setup': ({ addClientDirective }) => {
        addClientDirective({
          name: 'interaction',
          entrypoint: './src/client-directives/interaction.ts',
        });
      },
    },
  };
}

// Exercise the same serverless handler during local development. Production
// uses the explicit Vercel rewrite; private journal data never enters it.
function marketLensDevApi() {
  return {
    name: 'zodiacs-market-lens-dev-api',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (req, res, next) => {
          if (new URL(req.url || '/', 'http://localhost').pathname !== '/api/registry/lens') return next();
          try {
            const { handleLensMarket } = await server.ssrLoadModule('/api/_registry/lens-handler.ts');
            await handleLensMarket(req, res);
          } catch {
            if (!res.headersSent) {
              res.statusCode = 503;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-store');
              res.end(JSON.stringify({ error: 'unavailable' }));
            }
          }
        });
      },
    },
  };
}

// Static output on Vercel. No @astrojs/sitemap: the sitemap must also cover
// the legacy wing served verbatim from public/, so it is composed by the
// custom endpoint at src/pages/sitemap.xml.ts instead.
export default defineConfig({
  site: 'https://zodiacs.org',
  trailingSlash: 'ignore',
  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: false,
    },
  },
  integrations: [interactionDirective(), marketLensDevApi(), preact(), mdx()],
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // The default CSS minifier collapses standard + -webkit- property
      // pairs down to the -webkit- spelling, which current Chromium no
      // longer aliases — that silently kills every backdrop-filter
      // (nav blur, glass chrome). esbuild minifies without merging.
      cssMinify: 'esbuild',
    },
  },
});
