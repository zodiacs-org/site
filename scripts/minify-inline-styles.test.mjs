import { describe, expect, it } from 'vitest';
import { minifyInlineStyles, minifyStyleWhitespace } from './minify-inline-styles.mjs';

const page = (head, body = '<p>Hi</p>') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('minify-inline-styles', () => {
  it('drops the whitespace and comments of plain stylesheets, and nothing else', () => {
    const css = `
      /* ──────────────
         Mobile landing
         ────────────── */
      .hero {
        color: #ffffff;   /* the light ink */
        margin: 0px 0px 0px 0px;
        background: url("/a b.webp") no-repeat;
      }
      .hero::after { content: "  /* not a comment */  "; }
      @media (min-width: 720px) {
        .hero { padding: calc(1rem + 2px); }
      }
    `;
    const { html, styles } = minifyInlineStyles(page(`<style>${css}</style><style media="print">  a { color: red; }  </style>`));
    expect(styles).toBe(2);
    expect(html).not.toContain('Mobile landing');
    expect(html).not.toContain('the light ink');
    // No syntax rewrites: colours, zero units and repeated values stay as written.
    expect(html).toContain('color:#ffffff');
    expect(html).toContain('margin:0px 0px 0px 0px');
    // esbuild prints a url() unquoted when it can; the escaped form names the same file.
    expect(html).toContain('url(/a\\ b.webp)');
    expect(html).toContain('content:"  /* not a comment */  "');
    expect(html).toContain('padding:calc(1rem + 2px)');
    expect(html).toContain('<style media="print">a{color:red}</style>');
    expect(html).toContain('<p>Hi</p>');
  });

  it('keeps fallback declarations that a syntax minifier would drop', () => {
    const out = minifyStyleWhitespace('.a { height: 100vh; height: 100dvh; } .b { color: red; } .b { color: blue; }');
    expect(out).toBe('.a{height:100vh;height:100dvh}.b{color:red}.b{color:blue}');
  });

  it('leaves style text inside scripts, comments and inline SVG byte for byte', () => {
    const blocks = [
      '<script>var s = "<style>  .x { color: red; }  </style>";</script>',
      '<!-- <style>  .y { color: red; }  </style> -->',
      '<svg viewBox="0 0 1 1"><style>  .z { fill: red; }  </style></svg>',
      '<style type="text/x-template">  .t { a: b; }  </style>',
    ].join('');
    expect(minifyInlineStyles(page(blocks))).toMatchObject({ html: page(blocks), styles: 0 });
  });

  it('still minifies the stylesheets around those regions', () => {
    const html = page('<style>  .a { color: red; }  </style><script>var s = 1;</script><style>  .b { color: blue; }  </style>');
    expect(minifyInlineStyles(html).html).toBe(page('<style>.a{color:red}</style><script>var s = 1;</script><style>.b{color:blue}</style>'));
  });

  it('reads a stylesheet whose CSS embeds an SVG data URI as one block', () => {
    const css = `
      .mark {
        background: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><path d='M0 0h1'/></svg>");
      }
      .after { color: red; }
    `;
    const { html, styles } = minifyInlineStyles(page(`<style>${css}</style>`));
    expect(styles).toBe(1);
    expect(html).toContain(".after{color:red}");
    expect(html).toContain("<path d='M0 0h1'/></svg>");
  });
});
