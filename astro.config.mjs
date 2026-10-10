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

// Production enables the window implementation only in its worker build.
// Vite uses the top-level serve plugins for development workers; development
// enables the same full.ts boundary without changing production page builds.
function birthWindowWorkerBoundary({development=false}={}) {
  let enabled=development;
  const marker='import.meta.env.ZODIACS_BIRTH_WINDOW_WORKER';
  return {
    name:'zodiacs-birth-window-worker-boundary',
    enforce:'pre',
    ...(development?{apply:'serve'}:{}),
    buildStart(options) {
      if(development)return;
      const input=options.input;
      const entries=typeof input==='string'?[input]:Array.isArray(input)?input:Object.values(input??{});
      enabled=entries.some(value=>/(?:^|\/)src\/islands\/birth-window\.worker\.ts$/.test(String(value).split('?')[0].replaceAll('\\','/')));
    },
    transform(source,id) {
      if(!enabled||!/(?:^|\/)src\/lib\/engine\/full\.ts$/.test(id.split('?')[0].replaceAll('\\','/')))return;
      if(source.split(marker).length!==2)throw new Error('The worker window boundary must have one build marker');
      return {code:source.replace(marker,'true'),map:null};
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
    define: { 'import.meta.env.ZODIACS_BIRTH_WINDOW_WORKER': 'false' },
    plugins: [birthWindowWorkerBoundary({development:true})],
    worker: {
      plugins: () => [birthWindowWorkerBoundary()],
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
    build: {
      // The default CSS minifier collapses standard + -webkit- property
      // pairs down to the -webkit- spelling, which current Chromium no
      // longer aliases — that silently kills every backdrop-filter
      // (nav blur, glass chrome). esbuild minifies without merging.
      cssMinify: 'esbuild',
    },
  },
});
