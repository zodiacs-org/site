/**
 * Reads the tree for scripts/swiss-output-guard.test.mjs: every tracked file,
 * every file a commit would add (not ignored), and every member of those
 * that are archives (.tgz, .tar.gz, .tar, .gz, .zip), three levels deep, by
 * content rather than by name.
 *
 * For each file or member it gives
 *   - its SHA-256, when its size is one the caller asks about (a removed
 *     file's bytes under any name);
 *   - the distinctive numbers and timestamps it holds, read exactly as
 *     docs/engine-validation/swiss-output-removal/strip.py reads them (TOKENS
 *     there), when it is a data or code file or lies under src/;
 *   - the lines that match the caller's patterns.
 *
 * A token is a number (digits, a point, digits, an optional exponent, not
 * inside a word or a longer number), a run of 12 or more digits (a
 * millisecond clock), or a timestamp with a fraction of a second, ISO or as
 * NASA JPL Horizons prints it. Its canonical text is the number's absolute
 * value as Number#toString writes it, the integer's digits, or
 * YYYY-MM-DDThh:mm:ss.fff; it is distinctive with at least 7 significant
 * digits, if not a whole minute of milliseconds, or if not on a whole minute
 * or at 23:59:59.999. Its digest is the first 16 hexadecimal digits of the
 * SHA-256 of that text.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { gunzipSync, inflateRawSync } from 'node:zlib';

export const DATA_EXTENSIONS = new Set(['.json', '.jsonl', '.ndjson', '.geojson', '.csv', '.tsv', '.txt', '.log', '.dat', '.yml',
  '.yaml', '.xml', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx', '.jsx', '.py', '.sh', '.c', '.h', '.patch', '.diff',
  '.raw', '.out', '.err', '.stderr', '.query', '.html', '.htm', '.svg', '.astro', '.sql', '.toml']);

const NUMBER = /(?<![0-9A-Za-z_.])[0-9]+\.[0-9]+(?:[eE][-+]?[0-9]+)?(?![0-9A-Za-z_.])/g;
const INTEGER = /(?<![0-9A-Za-z_.])[0-9]{12,}(?![0-9A-Za-z_.])/g;
const ISO_TIME = /([0-9]{4})-([0-9]{2})-([0-9]{2})[T ]([0-9]{2}):([0-9]{2}):([0-9]{2})\.([0-9]+)/g;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HORIZONS_TIME = new RegExp(`([0-9]{4})-(${MONTHS.join('|')})-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})\\.([0-9]+)`, 'g');

export function canonicalNumber(text) {
  const x = Math.abs(Number(text));
  if (!Number.isFinite(x)) return null;
  const c = String(x);
  const digits = c.split('e')[0].replace('.', '').replace(/^0+/u, '').replace(/0+$/u, '');
  return digits.length >= 7 ? c : null;
}

export function canonicalInteger(text) {
  const n = BigInt(text);
  return n % 60000n === 0n ? null : n.toString();
}

function canonicalTime(y, mo, d, h, mi, s, fraction) {
  const ms = `${fraction}000`.slice(0, 3);
  if ((s === '00' && ms === '000') || (h === '23' && mi === '59' && s === '59' && ms === '999')) return null;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms}`;
}

/** Every distinctive token in a text, with where it starts. */
export function* textTokens(text) {
  for (const match of text.matchAll(NUMBER)) {
    const c = canonicalNumber(match[0]);
    if (c) yield { token: c, text: match[0], index: match.index };
  }
  for (const match of text.matchAll(INTEGER)) {
    const c = canonicalInteger(match[0]);
    if (c) yield { token: c, text: match[0], index: match.index };
  }
  for (const match of text.matchAll(ISO_TIME)) {
    const c = canonicalTime(...match.slice(1));
    if (c) yield { token: c, text: match[0], index: match.index };
  }
  for (const match of text.matchAll(HORIZONS_TIME)) {
    const parts = match.slice(1);
    parts[1] = String(MONTHS.indexOf(parts[1]) + 1).padStart(2, '0');
    const c = canonicalTime(...parts);
    if (c) yield { token: c, text: match[0], index: match.index };
  }
}

const digestCache = new Map();
export function tokenDigest(token) {
  let digest = digestCache.get(token);
  if (!digest) {
    digest = createHash('sha256').update(token).digest('hex').slice(0, 16);
    digestCache.set(token, digest);
  }
  return digest;
}

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const text = (bytes) => bytes.toString('utf8');
const nul = (bytes) => { const end = bytes.indexOf(0); return (end < 0 ? bytes : bytes.subarray(0, end)).toString('latin1'); };

/** The files of a tar stream: [name, bytes]. Stops at the first header that is not one. */
function* tarMembers(buffer) {
  let offset = 0;
  let longName = null;
  let paxName = null;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) return;
    let sum = 0;
    for (let i = 0; i < 512; i += 1) sum += i >= 148 && i < 156 ? 32 : header[i];
    if (sum !== parseInt(nul(header.subarray(148, 156)).trim() || '0', 8)) return;
    const size = parseInt(nul(header.subarray(124, 136)).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const data = buffer.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = nul(data); continue; }
    if (type === 'x') {
      const path = /(?:^|\n)\d+ path=([^\n]*)\n/u.exec(data.toString('utf8'));
      paxName = path ? path[1] : null;
      continue;
    }
    if (type === 'g') continue;
    const prefix = nul(header.subarray(345, 500));
    const name = paxName ?? longName ?? (prefix ? `${prefix}/${nul(header.subarray(0, 100))}` : nul(header.subarray(0, 100)));
    longName = null;
    paxName = null;
    if (type === '0' || type === '\0' || type === '7') yield [name, data];
  }
}

/** The files of a zip archive: [name, bytes], stored or deflated. */
function* zipMembers(buffer) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) return;
  let at = buffer.readUInt32LE(end + 16);
  const count = buffer.readUInt16LE(end + 10);
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) return;
    const method = buffer.readUInt16LE(at + 10);
    const compressed = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    at += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(start, start + compressed);
    if (method === 0) yield [name, raw];
    else if (method === 8) yield [name, inflateRawSync(raw)];
  }
}

/** Is this file or member read for tokens and markers? */
export const scanned = (name) => name.startsWith('src/') || DATA_EXTENSIONS.has(extname(name.toLowerCase()));

/**
 * Walks the tree and calls visit(entry) for every tracked file and archive
 * member: { path, member, bytes, scanned }, where path is the tracked file
 * and member the name inside it (null for the file itself).
 */
export function walkTree(root, visit) {
  // Tracked files, and the ones not ignored that a commit would add.
  const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, maxBuffer: 1 << 28 })
    .toString('utf8').split('\0').filter(Boolean))];
  const open = (path, member, name, bytes, depth) => {
    const low = name.toLowerCase();
    if (depth < 3) {
      try {
        if (low.endsWith('.tgz') || low.endsWith('.tar.gz')) {
          for (const [inner, data] of tarMembers(gunzipSync(bytes))) open(path, member ? `${member}!${inner}` : inner, inner, data, depth + 1);
          visit({ path, member, name, bytes, scanned: false, archive: true });
          return;
        }
        if (low.endsWith('.tar')) {
          for (const [inner, data] of tarMembers(bytes)) open(path, member ? `${member}!${inner}` : inner, inner, data, depth + 1);
          visit({ path, member, name, bytes, scanned: false, archive: true });
          return;
        }
        if (low.endsWith('.gz')) {
          const inner = name.slice(0, -3);
          open(path, member ? `${member}!${inner}` : inner, inner, gunzipSync(bytes), depth + 1);
          visit({ path, member, name, bytes, scanned: false, archive: true });
          return;
        }
        if (low.endsWith('.zip')) {
          for (const [inner, data] of zipMembers(bytes)) open(path, member ? `${member}!${inner}` : inner, inner, data, depth + 1);
          visit({ path, member, name, bytes, scanned: false, archive: true });
          return;
        }
      } catch {
        // Not the archive its name says: read it as a plain file.
      }
    }
    visit({ path, member, name, bytes, scanned: depth === 0 ? scanned(path) : scanned(name) });
  };
  for (const path of files) {
    const full = resolve(root, path);
    let stat;
    try { stat = lstatSync(full); } catch { continue; }
    if (!stat.isFile()) continue;
    open(path, null, path, readFileSync(full), 0);
  }
  return files.length;
}

/** The line of a text an index falls on, trimmed, for a failure message. */
export function lineAt(source, index) {
  const start = source.lastIndexOf('\n', index) + 1;
  const end = source.indexOf('\n', index);
  const line = source.slice(start, end < 0 ? undefined : end).trim();
  return `${source.slice(0, index).split('\n').length}: ${line.length > 160 ? `${line.slice(0, 160)}…` : line}`;
}

export { text as decodeText };
