import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guards the shared entrance motion (docs/MOTION.md): marks arrive, words and
// controls never wait.

const root = new URL('../', import.meta.url);
const srcDir = fileURLToPath(root);
const source = async (relativePath: string): Promise<string> => readFile(
  fileURLToPath(new URL(relativePath, root)),
  'utf8',
);

const ALLOWED_PROPERTIES = new Set(['opacity', 'transform', 'stroke-dashoffset', 'none']);
const MARK_TAGS = new Set(['svg', 'g', 'circle', 'ellipse', 'path', 'line', 'rect', 'span', 'div', 'figure']);
const RULE = 'Marks arrive, words and controls never wait. See docs/MOTION.md.';

async function markupFiles(): Promise<string[]> {
  const entries = await readdir(srcDir, { recursive: true });
  return entries
    .map((entry) => String(entry))
    .filter((entry) => /\.(astro|tsx)$/u.test(entry) && !/\.test\./u.test(entry))
    .sort();
}

describe('entrance motion contract', () => {
  it('moves only opacity, transform and stroke-dashoffset, once, and stills for reduced motion and print', async () => {
    const css = await source('styles/motion.css');
    const values = [...css.matchAll(/\btransition(?:-property)?\s*:\s*([^;{}]+);/gu)];
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      const properties = value[1]
        .split(',')
        .map((part) => part.trim().match(/^([a-z-]+)/iu)?.[1])
        .filter((property): property is string => Boolean(property));
      expect(properties, value[0]).not.toHaveLength(0);
      expect(properties.every((property) => ALLOWED_PROPERTIES.has(property)), value[0]).toBe(true);
    }
    expect(css).not.toContain('infinite');
    expect(css).not.toContain('@keyframes');
    expect(css).not.toContain(':focus-visible');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('print');
  });

  it('keeps the runtime safeguards in Motion.astro', async () => {
    const runtime = await source('components/Motion.astro');
    for (const needle of ['boundingClientRect.bottom <= 0', 'threshold: 0', '3000', 'setInterval', 'transitionend', 'catch']) {
      expect(runtime, needle).toContain(needle);
    }
  });

  it.todo('marks only discs, rings, lines and figures, never words or controls');

  it('never spreads motion() into JSX', async () => {
    for (const file of await markupFiles()) {
      const text = await readFile(`${srcDir}${file}`, 'utf8');
      expect(/\{\s*\.\.\.motion\(/u.test(text), `${file}: ${RULE}`).toBe(false);
    }
  });
});
