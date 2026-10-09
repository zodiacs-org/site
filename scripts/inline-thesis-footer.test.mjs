import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { inlineThesisFooter, minifyThesisPayload } from './inline-thesis-footer.mjs';
import { SITE_FOOTER_STYLESHEET } from './site-footer.mjs';

describe('canonical thesis footer build', () => {
  const css = readFileSync(new URL('../src/styles/site-footer.css', import.meta.url), 'utf8');
  const before = '<!doctype html><html><head><link rel="manifest" href="/site.webmanifest">';
  const after = '<style>.hero{color:white}</style></head><body><footer class="zfooter">unchanged</footer></body></html>';
  it('embeds the actual sole CSS source in place, preserving every other HTML byte', () => {
    const output = inlineThesisFooter(before + SITE_FOOTER_STYLESHEET + after, css);
    expect(output).toBe(before + '<style data-canonical-thesis-footer>' + css + '</style>' + after);
    expect(output).not.toContain(SITE_FOOTER_STYLESHEET);
    expect(inlineThesisFooter(output, css)).toBe(output);
  });
  it('refuses an absent, duplicate, misplaced or stale style instead of silently dropping CSS', () => {
    for (const html of [
      before + after,
      before + SITE_FOOTER_STYLESHEET.repeat(2) + after,
      '<head></head><body>' + SITE_FOOTER_STYLESHEET + '</body>',
      before + '<style data-canonical-thesis-footer>stale</style>' + after,
    ]) expect(() => inlineThesisFooter(html, css)).toThrow();
  });
  it('refuses closing style tags and relative assets that would change meaning when embedded', () => {
    const html = before + SITE_FOOTER_STYLESHEET + after;
    expect(() => inlineThesisFooter(html, '</STYLE><script>bad</script>')).toThrow();
    expect(() => inlineThesisFooter(html, '.x{background:url(../image.png)}')).toThrow();
    expect(inlineThesisFooter(html, '.x{background:url(/image.png)}')).toContain('url(/image.png)');
  });
});

describe('thesis inline payload minification', () => {
  it('preserves canonical CSS, JSON-LD, external scripts and document content', async () => {
    const footer = '<style data-canonical-thesis-footer>\n.footer { color: white; }\n</style>';
    const metadata = '<script type="application/ld+json">\n{"name":"Zodiacs.org"}\n</script>';
    const external = '<script src="/assets/quiet.js">/* fallback */</script>';
    const head = '<head>' + footer + metadata + external;
    const tail = '</head><body><h1>Unchanged visible essay</h1></body>';
    const inline = '<style>\n.hero { color: white; }\n</style><script>\nwindow.answer = 42;\n</script>';
    const output = await minifyThesisPayload(head + inline + tail);
    expect(output.startsWith(head)).toBe(true);
    expect(output.endsWith(tail)).toBe(true);
    expect(output.length).toBeLessThan((head + inline + tail).length);
    expect(await minifyThesisPayload(output)).toBe(output);
  });
  it('keeps literal replacement tokens, Unicode and script behavior intact', async () => {
    const source = "window.answer = [\"$'\", '$&', 'Libra · 2026'];\nwindow.answer.push(7 * 6);";
    const html = '<script>' + source + '</script>';
    const output = await minifyThesisPayload(html);
    const minified = output.slice('<script>'.length, -'</script>'.length);
    const before = { window: {} }, after = { window: {} };
    new vm.Script(source).runInNewContext(before);
    new vm.Script(minified).runInNewContext(after);
    expect(JSON.stringify(after.window.answer)).toBe(JSON.stringify(before.window.answer));
  });
  it('refuses invalid authored code before a built file could be written', async () => {
    await expect(minifyThesisPayload('<script>function broken( {</script>')).rejects.toThrow();
    await expect(minifyThesisPayload('<style>.hero{color:"broken}</style>')).rejects.toThrow();
  });
});
