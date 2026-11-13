/** The sign-pair essays explain_astrology serves, taken from the pair pages. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('src/ai-tools/features/pair-pages.json', root);

/** One page's prose, headings dropped, links reduced to their words, paragraphs split. */
export function pairParagraphs(mdx) {
  const body = mdx.replace(/^---[\s\S]*?---\s*/u, '');
  const text = body
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/^## .+$/gmu, '')
    .replace(/\*\*([^*]+)\*\*/gu, '$1')
    .replace(/[\u2013\u2014]/gu, ', ');
  return text.split(/\n\s*\n/u).map((paragraph) => paragraph.replace(/\s+/gu, ' ').trim()).filter(Boolean);
}

export async function pairPagesFromDisk() {
  const dir = new URL('src/content/pairs/', root);
  const files = (await readdir(dir)).filter((name) => name.endsWith('.mdx')).sort();
  const pages = {};
  for (const file of files) pages[file.slice(0, -4)] = pairParagraphs(await readFile(new URL(file, dir), 'utf8'));
  return pages;
}

export function renderPairPages(pages) {
  return `${JSON.stringify(pages, null, 2)}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.includes('--check');
  const pages = await pairPagesFromDisk();
  const text = renderPairPages(pages);
  if (check) {
    if (await readFile(output, 'utf8').catch(() => '') !== text) throw new Error('pair-pages.json is stale; run node scripts/build-pair-pages.mjs');
    console.log(`Verified pair pages (${Object.keys(pages).length})`);
  } else {
    await writeFile(output, text);
    console.log(`Built pair pages (${Object.keys(pages).length})`);
  }
}
