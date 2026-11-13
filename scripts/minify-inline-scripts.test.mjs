import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { minifyInlineScripts, minifyScriptWhitespace } from './minify-inline-scripts.mjs';

const page = (scripts) => `<!doctype html><html><head>${scripts}</head><body><p>Hi</p></body></html>`;

describe('minify-inline-scripts', () => {
  it('drops the whitespace and comments of plain and module scripts, and nothing else', () => {
    const classic = `
      /* The bar slides away as the page scrolls down. */
      (function () {
        // A note for the reader.
        var label = "Zodiacs · org"; // the lockup's words
        window.__seen = label + " // not a comment";
      })();
    `;
    const module = `
      import { a } from "/x.js";
      // the module's own note
      export const b = a + 1;
    `;
    const { html, scripts } = minifyInlineScripts(page(`<script>${classic}</script><script type="module">${module}</script>`));
    expect(scripts).toBe(2);
    expect(html).not.toContain('The bar slides away');
    expect(html).not.toContain('A note for the reader');
    expect(html).not.toContain("the module's own note");
    expect(html).toContain('"Zodiacs · org"');
    expect(html).toContain('" // not a comment"');
    expect(html).toContain('<script type="module">import{a}from"/x.js";');
    expect(html).toContain('<p>Hi</p>');
  });

  it('leaves structured data, JSON, import maps and other typed blocks byte for byte', () => {
    const blocks = [
      '<script type="application/ld+json">{ "@context": "https://schema.org",\n  "name": "Zodiacs" }</script>',
      '<script type="application/json" id="data">{ "a": 1,\n "b": [1, 2] }</script>',
      '<script type="importmap">{ "imports": { "x": "/x.js" } }</script>',
      '<script type="speculationrules">{ "prerender": [ { "where": { "href_matches": "/*" } } ] }</script>',
      '<script type="text/x-template">  <b> keep </b>  </script>',
      '<script src="/assets/app.js" defer></script>',
    ].join('');
    expect(minifyInlineScripts(page(blocks))).toMatchObject({ html: page(blocks), scripts: 0 });
  });

  it('runs the same code after as before', () => {
    const code = `
      var hits = [];
      function record(value) { hits.push(value); } // a note
      /* a block note */
      for (var i = 0; i < 3; i += 1) record(i * 2);
      var out = { hits: hits, text: "a  b\\n c" };
    `;
    const run = (source) => {
      const context = {};
      vm.runInNewContext(source, context);
      return JSON.stringify(context.out);
    };
    expect(run(minifyScriptWhitespace(code, { module: false }))).toBe(run(code));
  });

  it('is idempotent, and leaves a script it cannot read as written', () => {
    const once = minifyInlineScripts(page('<script>\n  var a = 1; // one\n</script>')).html;
    expect(minifyInlineScripts(once)).toMatchObject({ html: once, scripts: 0 });
    const broken = page('<script>var = ;</script>');
    const result = minifyInlineScripts(broken);
    expect(result.html).toBe(broken);
    expect(result.skipped).toHaveLength(1);
  });

  it('runs in postbuild once the critical styles are inlined, before the checks read dist', () => {
    const postbuild = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts.postbuild;
    const steps = postbuild.split(' && ');
    const minify = steps.indexOf('node scripts/minify-inline-scripts.mjs');
    expect(minify).toBeGreaterThan(steps.indexOf('node scripts/inline-critical-styles.mjs'));
    expect(minify).toBeLessThan(steps.indexOf('node scripts/check-dist.mjs'));
    expect(minify).toBeLessThan(steps.indexOf('node scripts/write-phase1-build-receipt.mjs'));
  });
});
