import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inlineThesisFooter } from './inline-thesis-footer.mjs';
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
