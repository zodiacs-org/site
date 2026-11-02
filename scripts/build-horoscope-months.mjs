/**
 * The published monthly horoscopes as plain paragraphs, for the
 * get_horoscope_period tool: src/data/horoscope-months.json, read by the
 * hosted MCP when a monthly reading is asked for (api/_ai/handler.ts), so the
 * runtime bundle stays the same when a month is written.
 *
 * Source: src/content/horoscopes/YYYY-MM-{sign}.mdx, the same files the
 * /horoscopes/{sign}/monthly/ page renders. A month is included only when all
 * twelve signs are written, none is a draft and none uses an em or en dash
 * (the assistant copy rule; July to September 2026 predate the cleanup in
 * #843 and stay out until their copy is cleaned). A month written ahead is
 * included here but served only from its first day, as the page does
 * (src/lib/horoscope-month.mjs).
 *
 * Usage: node scripts/build-horoscope-months.mjs [--check]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';

const SOURCE = new URL('../src/content/horoscopes/', import.meta.url);
const OUT = new URL('../src/data/horoscope-months.json', import.meta.url);
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

function parse(text, file) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(text);
  if (!match) throw new Error(`${file}: no frontmatter`);
  const meta = Object.fromEntries(match[1].split('\n').map((line) => {
    const at = line.indexOf(':');
    return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"(.*)"$/u, '$1')];
  }));
  const paragraphs = match[2].split(/\n\s*\n/u).map((block) => block.replace(/\s*\n\s*/gu, ' ').trim()).filter(Boolean);
  return { sign: meta.sign, month: meta.month, published: meta.published, updated: meta.updated, draft: meta.draft === 'true', paragraphs };
}

export async function render() {
  const files = (await readdir(SOURCE)).filter((name) => /^\d{4}-\d{2}-[a-z]+\.mdx$/u.test(name)).sort();
  const byMonth = new Map();
  for (const file of files) {
    const entry = parse(await readFile(new URL(file, SOURCE), 'utf8'), file);
    if (`${entry.month}-${entry.sign}.mdx` !== file) throw new Error(`${file}: frontmatter does not match the file name`);
    if (!byMonth.has(entry.month)) byMonth.set(entry.month, []);
    byMonth.get(entry.month).push(entry);
  }
  const months = {};
  const left = [];
  for (const [month, entries] of [...byMonth].sort(([a], [b]) => a.localeCompare(b))) {
    const complete = SIGNS.every((sign) => entries.some((entry) => entry.sign === sign && !entry.draft));
    const dashFree = entries.every((entry) => !entry.paragraphs.some((paragraph) => /[–—]/u.test(paragraph)));
    // Markup would reach the assistant as literal characters; the monthly copy is plain prose.
    const plain = entries.every((entry) => !entry.paragraphs.some((paragraph) => /[<>{}[\]`*#_]/u.test(paragraph)));
    if (!complete || !dashFree || !plain) { left.push(month); continue; }
    months[month] = Object.fromEntries(SIGNS.map((sign) => {
      const entry = entries.find((candidate) => candidate.sign === sign);
      return [sign, { published: entry.published, updated: entry.updated, paragraphs: entry.paragraphs }];
    }));
  }
  return { text: `${JSON.stringify({ schema: 'zodiacs.horoscope-months.v1', source: 'src/content/horoscopes', months }, null, 2)}\n`, left };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { text, left } = await render();
  if (process.argv.includes('--check')) {
    const current = await readFile(OUT, 'utf8').catch(() => '');
    if (current !== text) { console.error('src/data/horoscope-months.json is stale; run node scripts/build-horoscope-months.mjs'); process.exit(1); }
    console.log('Verified src/data/horoscope-months.json');
  } else {
    await writeFile(OUT, text);
    console.log(`Built src/data/horoscope-months.json${left.length ? ` (left out until complete and dash-free: ${left.join(', ')})` : ''}`);
  }
}
