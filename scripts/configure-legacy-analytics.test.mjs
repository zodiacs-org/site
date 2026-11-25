import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  TERMINAL_ANALYTICS_PATHS,
  ensureDefaultGuideBootstrap,
  injectLegacyAnalytics,
} from './configure-legacy-analytics.mjs';

const HTML = '<!doctype html><html><head><link rel="canonical" href="https://zodiacs.org/registry/"></head><body></body></html>';

describe('legacy analytics build injection', () => {
  it('leaves no provider script when configuration is absent', () => {
    const configured = injectLegacyAnalytics(HTML, {
      scriptUrl: 'https://analytics.example/script.js',
      domain: 'zodiacs.org',
    });
    const disabled = injectLegacyAnalytics(configured, {});
    expect(disabled).not.toContain('analytics.example');
    expect(disabled).not.toContain('zodiacs-analytics:start');
  });

  it('uses defer, a property allowlist, and an optional first-party endpoint', () => {
    const result = injectLegacyAnalytics(HTML, {
      scriptUrl: 'https://analytics.example/script.js',
      endpoint: '/api/event',
      domain: 'zodiacs.org',
    });
    expect(result).toContain('<script defer data-domain="zodiacs.org"');
    expect(result).toContain('chart_computed');
    expect(result).toContain('wallet_chart_computed');
    expect(result).toContain('registry_sign_selected');
    expect(result).toContain('terminal_view_switch');
    expect(result).toContain('preference_banner');
    expect(result).toContain('consumer_to_pro');
    expect(result).toContain('/api/event');
  });

  it('enforces closed event values before calling Plausible', () => {
    const result = injectLegacyAnalytics(HTML, {
      scriptUrl: 'https://analytics.example/script.js',
    });
    expect(result).toContain('var eventValues = Object.freeze(');
    expect(result).toContain("enumValues.indexOf(value) === -1");
  });

  it('configures Astrofolio and the expert Terminal page exactly once', () => {
    expect(TERMINAL_ANALYTICS_PATHS).toEqual([
      'public/astrofolio/index.html',
      'public/terminal/index.html',
    ]);
    expect(new Set(TERMINAL_ANALYTICS_PATHS).size).toBe(2);
  });

  it('does not add a second provider loader to a page that already has one', () => {
    const preconfigured = HTML.replace(
      '</head>',
      '<script async src="https://plausible.io/js/site.js"></script></head>',
    );
    const config = {
      scriptUrl: 'https://analytics.example/script.js',
      domain: 'zodiacs.org',
    };
    const result = injectLegacyAnalytics(preconfigured, config);
    expect(result.match(/<script\b[^>]*\bsrc=/g)).toHaveLength(1);
    expect(result).toContain('window.zodiacsAnalytics');
    expect(result).not.toContain('analytics.example');
    expect(injectLegacyAnalytics(result, config)).toBe(result);
  });

  it('keeps the bounded bridge on Terminal when its source-owned provider is used', () => {
    const preconfigured = HTML.replace(
      '</head>',
      '<script>window.plausible = window.plausible || function () {};</script><script async src="https://plausible.io/js/site.js"></script></head>',
    );
    const result = injectLegacyAnalytics(preconfigured, { bridgeExistingProvider: true });
    expect(result.match(/<script\b[^>]*\bsrc=/g)).toHaveLength(1);
    expect(result).toContain('window.zodiacsAnalytics');
    expect(result).toContain('terminal_view_switch');
    expect(injectLegacyAnalytics(result, { bridgeExistingProvider: true })).toBe(result);
  });

  it('removes every remote analytics runtime from a Guide-enabled surface', () => {
    const guideHtml = HTML
      .replace(
        '</head>',
        '<script>window.plausible = window.plausible || function () {};</script>'
          + '<script async src="https://plausible.io/js/site.js"></script></head>',
      )
      .replace(
        '</body>',
        '<script type="module">import(\'/assets/assistant-ui.js\')'
          + '.then(function (mod) { return mod.bootstrapGuide(\'en\'); });</script></body>',
      );
    const result = injectLegacyAnalytics(guideHtml, {
      scriptUrl: 'https://analytics.example/script.js',
      bridgeExistingProvider: true,
    });

    expect(result).toContain('/assets/assistant-ui.js');
    expect(result).not.toContain('plausible.io');
    expect(result).not.toContain('analytics.example');
    expect(result).not.toContain('window.plausible = window.plausible');
    expect(result).not.toContain('window.zodiacsAnalytics');
    expect(injectLegacyAnalytics(result, {
      scriptUrl: 'https://analytics.example/script.js',
      bridgeExistingProvider: true,
    })).toBe(result);
  });

  it.each(['astrofolio', 'thesis'])('keeps /%s/ private when analytics is configured', async (page) => {
    const html = await readFile(new URL(`../public/${page}/index.html`, import.meta.url), 'utf8');
    const result = injectLegacyAnalytics(html, {
      scriptUrl: 'https://analytics.example/script.js',
      bridgeExistingProvider: true,
    });
    expect(result).toContain('/assets/assistant-ui.js');
    expect(result).not.toMatch(/analytics\.example|window\.plausible|\/_vercel\/insights|thesis_click/u);
  });

  it('upgrades the reviewed click-only Guide hook to the default-visible bootstrap', () => {
    const clickOnly = HTML.replace(
      '</body>',
      `  <script>
  (function () {
    var modulePromise;
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('[data-assistant-open]');
      if (!button) return;
      modulePromise = modulePromise || import('/assets/assistant-ui.js');
      modulePromise.then(function (mod) { mod.openAssistant('en', button); }).catch(function () {});
    });
  })();
  </script></body>`,
    );

    const result = ensureDefaultGuideBootstrap(clickOnly);
    expect(result).toContain('data-guide-loader="zodiacs-guide-loader-v1"');
    expect(result).toContain('return mod.bootstrapGuide(defaultLocale)');
    expect(result).toContain('return mod.openAssistant(');
    expect(result).toContain("window.addEventListener('load', scheduleGuide, { once: true });");
    expect(result).toContain('event.stopImmediatePropagation();');
    expect(ensureDefaultGuideBootstrap(result)).toBe(result);
  });

  it('is idempotent', () => {
    const config = { scriptUrl: 'https://analytics.example/script.js' };
    const once = injectLegacyAnalytics(HTML, config);
    expect(injectLegacyAnalytics(once, config)).toBe(once);
  });
});
