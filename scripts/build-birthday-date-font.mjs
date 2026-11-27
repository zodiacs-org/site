#!/usr/bin/env node
/**
 * The birthday title's date face: a subset of the site's EB Garamond italic
 * holding only what `<em>{label}</em>` in `h1.bday-title`
 * (src/pages/birthday/[slug].astro) can print, so the page can preload a file
 * small enough to land inside the font-display: optional window on a cold
 * connection. The full italic stays next in the title's font stack.
 *
 *   node scripts/build-birthday-date-font.mjs           write the subset
 *   node scripts/build-birthday-date-font.mjs --check   rebuild to a temp file and compare
 *
 * Needs `pyftsubset` on PATH (`pip install fonttools==4.69.1 brotli==1.2.1`), or
 * its path in PYFTSUBSET. The output is byte-stable for a given fontTools and
 * Brotli version (two runs give the same bytes); other versions can encode the
 * same glyphs to different bytes, so `--check` names the versions on a mismatch.
 *
 * EB Garamond is under the SIL Open Font License 1.1
 * (public/fonts/OFL-eb-garamond.txt) and declares no Reserved Font Name, so the
 * subset keeps the font's own names, as the homepage subsets in
 * public/assets/home/ do; the CSS family name is the page's own alias. Every
 * name record is kept, including the copyright notice and the license URL.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BIRTHDAY_DATE_FONT_SOURCE = 'public/fonts/eb-garamond-latin-400-italic.woff2';
export const BIRTHDAY_DATE_FONT_OUTPUT = 'public/assets/birthday/eb-garamond-birthday-date-400-italic.woff2';
const SOURCE_SHA256 = '1bd1b20fd55986b334ba42dbcb0d9bed7e2d08fd7a713000e8041bfafa37e8ec';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Every date the birthday pages print: "January 1" to "December 31", February 29 included. */
export async function birthdayDateLabels() {
  const source = await readFile(path.join(root, 'src/lib/birthdays.ts'), 'utf8');
  const list = source.match(/export const MONTH_NAMES = \[([\s\S]*?)\]/u)?.[1];
  if (!list) throw new Error('Could not read MONTH_NAMES from src/lib/birthdays.ts');
  const months = [...list.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
  if (months.length !== 12) throw new Error(`Expected 12 month names, found ${months.length}`);
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return months.flatMap((month, index) => Array.from({ length: days[index] }, (_, day) => `${month} ${day + 1}`));
}

/** The code points those dates use, sorted. */
export async function birthdayDateCodepoints() {
  const used = new Set((await birthdayDateLabels()).join('').split('').map((char) => char.codePointAt(0)));
  return [...used].sort((a, b) => a - b);
}

/** The same set as a CSS unicode-range, consecutive points joined into ranges. */
export function unicodeRange(codepoints) {
  const hex = (point) => point.toString(16).toUpperCase().padStart(4, '0');
  const parts = [];
  for (let index = 0; index < codepoints.length; index += 1) {
    const start = codepoints[index];
    let end = start;
    while (codepoints[index + 1] === end + 1) end = codepoints[++index];
    parts.push(start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`);
  }
  return parts.join(', ');
}

async function build(outputPath) {
  const sourcePath = path.join(root, BIRTHDAY_DATE_FONT_SOURCE);
  const source = await readFile(sourcePath);
  if (sha256(source) !== SOURCE_SHA256) {
    throw new Error(`Unexpected EB Garamond italic source: ${sha256(source)}`);
  }
  const codepoints = await birthdayDateCodepoints();
  const result = spawnSync(process.env.PYFTSUBSET || 'pyftsubset', [
    sourcePath,
    `--output-file=${outputPath}`,
    '--flavor=woff2',
    `--unicodes=${codepoints.map((point) => point.toString(16)).join(',')}`,
    // Every OpenType feature the source applies to these glyphs (kern, liga
    // and the rest), and the source's hinting, so the date draws as the full
    // face draws it.
    '--layout-features=*',
    '--name-IDs=*',
    '--canonical-order',
  ], { encoding: 'utf8' });
  if (result.error) {
    throw new Error(`pyftsubset is required (pip install fonttools brotli): ${result.error.message}`);
  }
  if (result.status !== 0) throw new Error(result.stderr || `pyftsubset exited ${result.status}`);
  return { bytes: await readFile(outputPath), codepoints };
}

const check = process.argv.includes('--check');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const committedPath = path.join(root, BIRTHDAY_DATE_FONT_OUTPUT);
  if (check) {
    const dir = await mkdtemp(path.join(tmpdir(), 'birthday-date-font-'));
    try {
      const { bytes } = await build(path.join(dir, 'subset.woff2'));
      const committed = await readFile(committedPath);
      if (!bytes.equals(committed)) {
        console.error(`${BIRTHDAY_DATE_FONT_OUTPUT} differs from a fresh build (${sha256(committed)} vs ${sha256(bytes)}).`);
        console.error('It was built with fontTools 4.69.1 and Brotli 1.2.1; another version can encode the same glyphs differently.');
        process.exit(1);
      }
      console.log(`${BIRTHDAY_DATE_FONT_OUTPUT} is current (${committed.byteLength} bytes).`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  } else {
    await mkdir(path.dirname(committedPath), { recursive: true });
    const { bytes, codepoints } = await build(committedPath);
    console.log(JSON.stringify({
      source: BIRTHDAY_DATE_FONT_SOURCE,
      output: BIRTHDAY_DATE_FONT_OUTPUT,
      text: String.fromCodePoint(...codepoints),
      unicodeRange: unicodeRange(codepoints),
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    }, null, 2));
  }
}
