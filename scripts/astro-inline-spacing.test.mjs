import { transform } from '@astrojs/compiler-rs';
import { describe, expect, it } from 'vitest';
import { droppedSpaces, scan } from './astro-inline-spacing.mjs';

// What Astro renders for a template's markup, with the compression the site builds with (Astro 7's default).
function rendered(source) {
  const { code } = transform(source, { compact: 'jsx', filename: 'probe.astro' });
  return code.match(/\$\$render`([\s\S]*?)`/u)[1].replace(/^\$\{\$\$maybeRenderHead\(\$\$result\)\}/u, '');
}

describe('spaces Astro drops at line breaks', () => {
  it('is what the site build does: a line break between text and a link loses its space', () => {
    expect(rendered('<p>actual motion,\n  <a href="/s">station to station</a>, refined</p>')).toBe(
      '<p>actual motion,<a href="/s">station to station</a>, refined</p>',
    );
    expect(rendered(`<p>actual motion,{' '}\n  <a href="/s">station to station</a>, refined</p>`)).toBe(
      '<p>actual motion,${" "}<a href="/s">station to station</a>, refined</p>',
    );
  });

  it('finds text meeting a link, an inline element or an expression across a line break', () => {
    expect(droppedSpaces('<p>actual motion,\n  <a href="/s">station</a>, refined</p>')).toHaveLength(1);
    expect(droppedSpaces('<p><a href="/r">the page</a>\n  · <a href="/y">2027</a></p>')).toHaveLength(1);
    expect(droppedSpaces('<p>Born on\n  {date}.</p>')).toHaveLength(1);
    expect(droppedSpaces('<p>{count}\n  combinations</p>')).toHaveLength(1);
    expect(droppedSpaces('<p>Choose\n  <strong>Keep</strong></p>')).toHaveLength(1);
  });

  it('leaves alone boundaries that already have their space or need none', () => {
    expect(droppedSpaces(`<p>actual motion,{' '}\n  <a href="/s">station</a></p>`)).toEqual([]);
    expect(droppedSpaces('<p>actual motion, <a href="/s">station</a></p>')).toEqual([]);
    expect(droppedSpaces('<p>Read <a href="/s">the page</a>\n  .</p>')).toEqual([]);
    expect(droppedSpaces('<p><a href="/s">the page</a>\n  , then</p>')).toEqual([]);
    expect(droppedSpaces('<p>exact\n  <a href="/g"> alignments</a></p>')).toEqual([]);
    expect(droppedSpaces("<p>Today.\n  {ok && ' More.'}\n  {ok ? ` Yes.` : ' No.'}</p>")).toEqual([]);
    expect(droppedSpaces("<p>Today.\n  {ok && <>{' '}More.</>}</p>")).toEqual([]);
    expect(droppedSpaces('<div>\n  <h2>Title</h2>\n  <p>Text</p>\n</div>')).toEqual([]);
    expect(droppedSpaces('<p>(\n  <a href="/s">aside</a>)</p>')).toEqual([]);
  });

  it('finds none in the site’s templates', async () => {
    expect(await scan()).toEqual([]);
  });
});
