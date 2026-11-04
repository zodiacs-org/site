/*
 * The checks on the time atlas the site publishes (B3.c), version 0.1.0:
 * the engine repository's atlas at a pinned commit, copied byte for byte to
 * public/developers/time-atlas/0.1.0/ and listed in its files.json.
 *
 * timeAtlasFileProblems(folder) holds a folder to the index it carries: every
 * listed file present, a regular file, with the size, SHA-256 and git blob the
 * index gives it, and nothing else in the folder. scripts/check-dist.mjs runs
 * it on the built folder in dist/, and tests/time-atlas-dataset.test.ts on the
 * committed one, with controls.
 *
 * timeAtlasPageProblems(inputs) holds the page /developers/time-atlas/, as
 * built or as served, to the published files (the preregistration's check
 * C6). It reads the HTML as text, runs no script, decodes character
 * references before it compares, and takes every expected value from the
 * published files, which it parses itself, apart from the page's own helper.
 * Each problem names its part: "viewer" (the comparison, the explanations,
 * the sources, the rules, the files, the excerpts, the dashes, the scripts
 * and the links), "licence" (the licence, the attribution, the citation form
 * and the Dataset markup) or "corrections" (the correction route).
 *
 * A plain Node module that imports nothing from the site, so that the build's
 * check, the tests and the evidence folder's production check can all use it.
 */
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** The version's folder, as dist/ and zodiacs.org serve it. */
export const TIME_ATLAS_FOLDER = 'developers/time-atlas/0.1.0';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The git blob id of these bytes: sha1 of "blob <length>\0" and the bytes. */
export const gitBlobId = (bytes) => createHash('sha1')
  .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
  .digest('hex');

/** A path relative to the folder that stays inside it. */
export function safeRelativePath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\')
    && path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

/** Every entry under `folder` that is not a directory, as sorted relative paths; links are listed, not followed. */
async function entriesUnder(folder, prefix = '') {
  const found = [];
  for (const entry of await readdir(join(folder, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...await entriesUnder(folder, path));
    else found.push(path);
  }
  return found.sort();
}

/** The problems with `folder` against its files.json, one string each; none when every listed file is as listed. */
export async function timeAtlasFileProblems(folder) {
  let index;
  try {
    if ((await lstat(join(folder, 'files.json'))).isSymbolicLink()) return ['files.json: a symbolic link, not a file'];
    index = JSON.parse(await readFile(join(folder, 'files.json'), 'utf8'));
  } catch (error) {
    return [error?.code === 'ENOENT' ? 'files.json: missing' : 'files.json: does not parse'];
  }
  if (!Array.isArray(index?.files)) return ['files.json: no list of files'];
  const problems = [];
  const listed = new Set();
  for (const row of index.files) {
    const path = row?.path;
    if (!safeRelativePath(path)) {
      problems.push(`${String(path)}: not a relative path inside the folder`);
      continue;
    }
    if (listed.has(path)) {
      problems.push(`${path}: listed twice`);
      continue;
    }
    listed.add(path);
    if (typeof row.source !== 'string' || !Number.isInteger(row.bytes)
        || !/^[0-9a-f]{64}$/u.test(row.sha256 ?? '') || !/^[0-9a-f]{40}$/u.test(row.gitBlob ?? '')) {
      problems.push(`${path}: files.json lacks its source, bytes, SHA-256 or git blob`);
    }
    let info;
    try {
      info = await lstat(join(folder, path));
    } catch {
      problems.push(`${path}: missing`);
      continue;
    }
    if (info.isSymbolicLink()) {
      problems.push(`${path}: a symbolic link, not a file`);
      continue;
    }
    if (!info.isFile()) {
      problems.push(`${path}: not a regular file`);
      continue;
    }
    const bytes = await readFile(join(folder, path));
    if (bytes.length !== row.bytes) problems.push(`${path}: ${bytes.length} bytes, not ${row.bytes}`);
    const digest = sha256(bytes);
    if (digest !== row.sha256) problems.push(`${path}: SHA-256 ${digest}, not ${row.sha256}`);
    const blob = gitBlobId(bytes);
    if (blob !== row.gitBlob) problems.push(`${path}: git blob ${blob}, not ${row.gitBlob}`);
  }
  for (const path of await entriesUnder(folder)) {
    if (path !== 'files.json' && !listed.has(path)) problems.push(`${path}: not listed in files.json`);
  }
  return problems;
}

// ---------- the page ----------

/** The ten data files, as the manifest names them, which the page check reads beside the index. */
export const TIME_ATLAS_DATA_FILES = Object.freeze([
  'atlas.json', 'places.json', 'leads.json', 'citations-fr.json', 'rules-fr.json',
  'citations-als.json', 'rules-als.json', 'citations-us.json', 'rules-us.json', 'tzdb-explanations.json',
]);

const SITE = 'https://zodiacs.org';
const FORM_URL = 'https://github.com/zodiacs-org/engine/issues/new?template=atlas-correction.yml';
const LIVE_CORRECTIONS_URL = 'https://github.com/zodiacs-org/engine/blob/main/atlas/CORRECTIONS.md';
const LABEL = 'Finding about tzdb 2025c, not sent to the tz project:';

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Character references decoded; a named one this does not know is left as written. */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/giu, (whole, name) => {
    if (name[0] !== '#') return NAMED_ENTITIES[name] ?? whole;
    const code = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

const squash = (text) => text.replace(/\s+/gu, ' ').trim();

/** What a reader sees of some HTML: block tags as spaces, other tags dropped, references decoded, spaces folded. */
export function pageText(html) {
  return squash(decodeEntities(html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/giu, ' ')
    .replace(/<\/?(?:p|div|li|ul|ol|dl|dt|dd|pre|h[1-6]|table|thead|tbody|tfoot|tr|td|th|section|nav|main|header|footer|br)\b[^>]*>/giu, ' ')
    .replace(/<[^>]*>/gu, '')));
}

/** An attribute value as the page writes it, so a URL with & is found as &amp;. */
const attribute = (value) => String(value).replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');

/**
 * The dash rule: U+2013 and U+2014, raw or as character references. A named
 * reference is counted as written; a numeric one is counted once decoded, so
 * one written with leading zeros, in hex or in decimal, counts too, and so
 * does a numeric one written without its semicolon, which a browser still
 * decodes.
 */
function dashesIn(html) {
  return [
    ...(html.match(/&(?:[nm]dash);/giu) ?? []),
    ...(decodeEntities(html).match(/[\u2013\u2014]/gu) ?? []),
    ...(html.match(/&#(?:x0*201[34](?![0-9a-f;])|0*821[12](?![0-9;]))/giu) ?? []),
  ];
}

/** The text of each cell of a table row's HTML, as a reader sees it. */
const cellsOf = (html) => [...html.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gu)].map((match) => pageText(match[1]));

/** The report's own tables, read here apart from the page's helper. */
export function readReport(markdown) {
  const sections = new Map();
  for (const part of markdown.split(/^## /mu).slice(1)) {
    const newline = part.indexOf('\n');
    sections.set(part.slice(0, newline).trim(), part.slice(newline + 1));
  }
  const rowsOf = (text) => text.split('\n')
    .filter((line) => /^\| /u.test(line) && !/^\| -/u.test(line))
    .map((line) => line.slice(2, -2).split(' | '));
  const placeCell = (cell) => /^(.*) \(`([a-z0-9-]+)`\)$/u.exec(cell);
  const zoneCell = (cell) => (cell.endsWith(' (for information)') ? [cell.slice(0, -' (for information)'.length), true] : [cell, false]);
  const need = (name) => {
    if (!sections.has(name)) throw new Error(`the report has no "${name}" section`);
    return sections.get(name);
  };

  const compared = need('What is compared');
  const base = {
    tzdb: /tzdb (\d{4}[a-z]) with backzone/u.exec(compared)?.[1],
    tarball: /tarball's SHA-256 is `([0-9a-f]{64})`/u.exec(compared)?.[1],
    treeFiles: /\((\d+) files, `([0-9a-f]{64})`\)/u.exec(compared)?.[1],
    tree: /\((\d+) files, `([0-9a-f]{64})`\)/u.exec(compared)?.[2],
  };

  const summary = rowsOf(need('Summary')).slice(1).map((cells) => {
    const place = placeCell(cells[0]);
    const [zone, informational] = zoneCell(cells[1]);
    if (!place || cells.length !== 7) throw new Error(`a summary row does not read: ${cells.join(' | ')}`);
    return { name: place[1], place: place[2], zone, informational, counts: cells.slice(2).join(' ') };
  });

  const agreement = rowsOf(need('Where they agree')).slice(1).map((cells) => {
    const place = placeCell(cells[0]);
    const [zone] = zoneCell(cells[1]);
    if (!place || cells.length !== 3) throw new Error(`an agreement row does not read: ${cells.join(' | ')}`);
    return { place: place[2], zone, spans: cells[2].split('; ') };
  });

  const tables = [];
  for (const part of need('Place by place').split(/^### /mu).slice(1)) {
    const heading = /^(.*) \(`([a-z0-9-]+)`\) against (\S+)( \(for information\))?$/u.exec(part.slice(0, part.indexOf('\n')));
    if (!heading) throw new Error('a place heading does not read');
    const rows = rowsOf(part).slice(1).map((cells) => {
      if (cells.length !== 7) throw new Error(`a period row does not read: ${cells.join(' | ')}`);
      const [from, to, length, rule, atlas, tzdb, result] = cells;
      const space = tzdb.lastIndexOf(' ');
      const kind = result === 'agrees' ? 'agrees' : result.startsWith('rounding (') ? 'rounding' : result.startsWith('differs by ') ? 'differs' : null;
      if (!kind) throw new Error(`a result does not read: ${result}`);
      return {
        from, to, length, rule: rule.replace(/^`|`$/gu, ''), atlas, tzdb: tzdb.slice(0, space), abbreviation: tzdb.slice(space + 1),
        kind, ms: kind === 'rounding' ? result.slice('rounding ('.length, -' ms)'.length) : null,
        seconds: kind === 'differs' ? result.slice('differs by '.length, -' s'.length) : null,
      };
    });
    tables.push({ name: heading[1], place: heading[2], zone: heading[3], informational: Boolean(heading[4]), rows });
  }
  return { base, summary, agreement, tables };
}

/** The elements opened by `pattern` (with a closing tag `close`), each with its offset, attributes and inner HTML. */
function elements(html, pattern, close) {
  const found = [];
  for (const match of html.matchAll(pattern)) {
    const start = match.index + match[0].length;
    const end = html.indexOf(close, start);
    found.push({ at: match.index, open: match[0], groups: match.slice(1), inner: end < 0 ? html.slice(start) : html.slice(start, end) });
  }
  return found;
}

/** The HTML between the h2 with this id and the next h2. */
function partUnder(html, id) {
  const start = html.indexOf(`<h2 id="${id}"`);
  if (start < 0) return null;
  const next = html.indexOf('<h2', start + 4);
  return html.slice(start, next < 0 ? undefined : next);
}

/** The JSON-LD nodes of a page, flattened out of arrays and @graph. */
function jsonLdNodes(html) {
  const nodes = [];
  const add = (value) => {
    if (Array.isArray(value)) value.forEach(add);
    else if (value && typeof value === 'object') {
      if (Array.isArray(value['@graph'])) add(value['@graph']);
      else nodes.push(value);
    }
  };
  for (const match of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gu)) {
    try { add(JSON.parse(match[1])); } catch { nodes.push({ '@type': 'unreadable' }); }
  }
  return nodes;
}

/** The page with the contents of its style and script elements blanked, tags and offsets kept. */
const blanked = (html) => html.replace(/(<(style|script)\b[^>]*>)([\s\S]*?)(<\/\2>)/giu, (whole, open, tag, inner, close) => `${open}${' '.repeat(inner.length)}${close}`);
/** The inside of the page's <main> element, its scripts' and styles' contents blanked. */
function mainOf(html) {
  const plain = blanked(html);
  const open = /<main\b[^>]*>/iu.exec(plain);
  const close = plain.lastIndexOf('</main>');
  return open && close > open.index ? plain.slice(open.index + open[0].length, close) : undefined;
}
const scriptOpenings = (html) => [...blanked(html).matchAll(/<script\b[^>]*>/giu)].map((match) => match[0]);
const foreignOrigins = (html) => new Set([...html.matchAll(/<(?:script|link|img|iframe)\b[^>]*?\b(?:src|href)="([^"]*)"/giu)]
  .map((match) => decodeEntities(match[1]))
  .filter((url) => /^(?:https?:)?\/\//iu.test(url))
  .map((url) => new URL(url, SITE).origin)
  .filter((origin) => origin !== SITE));
const outsideMain = (html) => {
  const plain = blanked(html);
  const open = /<main\b[^>]*>/iu.exec(plain);
  const close = plain.lastIndexOf('</main>');
  return open && close > open.index ? plain.slice(0, open.index) + plain.slice(close) : plain;
};

/**
 * The problems with the time atlas page, each prefixed with its part:
 * "viewer: ", "licence: " or "corrections: ". None when the page holds what
 * the preregistration's C6 lists.
 *
 * @param {{ page: string, reference: string, index: string, data: Record<string, any>,
 *   differences: { tzdb: string, differences: any[] }, report: string }} inputs
 *   the page's HTML, the sky benchmark page's HTML from the same build or
 *   deployment, files.json as text, the ten data files parsed (by name),
 *   tzdb/differences.json parsed and TZDB-DIFFERENCES.md as text
 */
export function timeAtlasPageProblems({ page, reference, index: indexText, data, differences, report }) {
  const problems = [];
  const viewer = (text) => problems.push(`viewer: ${text}`);
  const licence = (text) => problems.push(`licence: ${text}`);
  const corrections = (text) => problems.push(`corrections: ${text}`);
  const index = JSON.parse(indexText);
  const manifest = data['atlas.json'];
  const version = index.version;
  const folder = `/developers/time-atlas/${version}`;
  const tzdb = differences.tzdb;
  const text = pageText(page);
  const has = (haystack, needle) => haystack.includes(squash(needle));
  let parsed;
  try {
    parsed = readReport(report);
  } catch (error) {
    return [`viewer: TZDB-DIFFERENCES.md: ${error.message}`];
  }
  const { base, summary, agreement, tables } = parsed;
  const rules = new Map(['rules-fr.json', 'rules-als.json', 'rules-us.json'].flatMap((name) => data[name].rules).map((rule) => [rule.id, rule]));
  const citations = new Map(['citations-fr.json', 'citations-als.json', 'citations-us.json'].flatMap((name) => data[name].citations).map((entry) => [entry.id, entry]));
  const explanations = data['tzdb-explanations.json'].explanations;

  // Item 1, the base, in the comparison section.
  const comparison = partUnder(page, 'comparison');
  if (!comparison) viewer('no comparison section (h2 id "comparison")');
  else {
    const said = pageText(comparison);
    for (const [what, needle] of [
      ['the base', `tzdb ${tzdb} with backzone`], ['the tarball digest', base.tarball], ['the tree digest', base.tree],
      ['the tree size', `${base.treeFiles} files`], ['the window start', manifest.coverage.start], ['the window end', manifest.coverage.end],
      ['the definition of a difference', 'differ by one second or more'], ['the reason for rounding', 'tzdb stores whole seconds'],
      ['the two sentences on the findings', `Two explanations end with a finding about tzdb ${tzdb}, quoted as the atlas states it. At version ${version} neither had been sent to the tz project.`],
    ]) if (!needle || !has(said, needle)) viewer(`the comparison section lacks ${what}`);
  }

  // Item 2, the comparisons, in the Summary's order with its counts, in the row's attributes and in the cells a reader sees.
  const rows = elements(page, /<tr data-comparison="([^"]*)" data-counts="([^"]*)"[^>]*>/gu, '</tr>');
  if (rows.length !== summary.length) viewer(`${rows.length} comparison rows, not ${summary.length}`);
  summary.forEach((row, at) => {
    const shown = rows[at];
    const cells = [`${row.zone}${row.informational ? ' (for information)' : ''}`, ...row.counts.split(' ')];
    if (!shown || decodeEntities(shown.groups[0]) !== `${row.place}|${row.zone}` || shown.groups[1] !== row.counts) {
      viewer(`comparison row ${at + 1} is not ${row.place} against ${row.zone} with ${row.counts}`);
    } else if (!has(pageText(shown.inner), row.name) || pageText(shown.inner).includes('(for information)') !== row.informational) {
      viewer(`comparison row ${at + 1} does not name ${row.name} or mark its zone as the Summary does`);
    } else if (JSON.stringify(cellsOf(shown.inner)) !== JSON.stringify(cells)) {
      viewer(`comparison row ${at + 1} does not show ${cells.join(' | ')} in its cells, as the Summary gives them`);
    }
  });

  // Items 3 and 7, every period, each difference with its anchor and its one explanation.
  const results = [...page.matchAll(/<tr\b[^>]*\bdata-result="([^"]*)"/gu)].map((match) => match[1]);
  const periods = tables.flatMap((table) => table.rows);
  for (const kind of ['agrees', 'rounding', 'differs']) {
    const want = periods.filter((period) => period.kind === kind).length;
    const got = results.filter((result) => result === kind).length;
    if (got !== want) viewer(`${got} periods marked ${kind}, not ${want}`);
  }
  if (results.length !== periods.length) viewer(`${results.length} periods, not ${periods.length}`);
  const pairSections = elements(page, /<section id="([^"]*)"[^>]*\bdata-pair="([^"]*)"[^>]*>/gu, '</section>');
  if (pairSections.length !== tables.length) viewer(`${pairSections.length} place sections, not ${tables.length}`);
  tables.forEach((table, at) => {
    const shown = pairSections[at];
    if (!shown || decodeEntities(shown.groups[1]) !== `${table.place}|${table.zone}`) {
      viewer(`place section ${at + 1} is not ${table.place} against ${table.zone}`);
      return;
    }
    const heading = pageText(/<h3\b[^>]*>([\s\S]*?)<\/h3>/u.exec(shown.inner)?.[1] ?? '');
    if (!heading.includes(table.name) || !heading.includes(table.place) || !heading.includes(table.zone)
        || heading.includes('(for information)') !== table.informational) {
      viewer(`the heading of ${table.place} against ${table.zone} does not give its place, id and zone as the report does`);
    }
    const spans = agreement[at];
    const agrees = [...shown.inner.matchAll(/<li data-agree\b[^>]*>([\s\S]*?)<\/li>/gu)].map((match) => pageText(match[1]));
    if (!spans || spans.place !== table.place || JSON.stringify(agrees) !== JSON.stringify(spans.spans)) {
      viewer(`the agreement spans of ${table.place} against ${table.zone} are not the report's`);
    }
    const shownRows = elements(shown.inner, /<tr\b[^>]*\bdata-result="([^"]*)"[^>]*>/gu, '</tr>');
    if (shownRows.length !== table.rows.length) {
      viewer(`${table.place} against ${table.zone} shows ${shownRows.length} periods, not ${table.rows.length}`);
      return;
    }
    table.rows.forEach((period, row) => {
      const cells = pageText(shownRows[row].inner);
      const rule = rules.get(period.rule);
      const wants = [period.from, period.to, period.length, period.rule, `${period.tzdb} ${period.abbreviation}`, period.atlas,
        rule ? `v${rule.version}, ${rule.uncertainty.flag}` : '(no such rule)'];
      if (period.kind === 'rounding') wants.push(`${period.ms} ms`);
      const columns = [period.from, period.to, period.length, `${period.rule} ${rule ? `v${rule.version}, ${rule.uncertainty.flag}` : '(no such rule)'}`, period.atlas, `${period.tzdb} ${period.abbreviation}`];
      if (shownRows[row].groups[0] !== period.kind || wants.some((want) => !cells.includes(want)) || JSON.stringify(cellsOf(shownRows[row].inner).slice(0, 6)) !== JSON.stringify(columns)) {
        viewer(`period ${row + 1} of ${table.place} against ${table.zone} is not the report's row`);
      }
      // The result cell, the row's last, reads as the report's result; a difference's goes on to name its explanation.
      const result = period.kind === 'agrees' ? 'agrees' : period.kind === 'rounding' ? `within a second (${period.ms} ms)` : `differs by ${period.seconds} s`;
      const shownResult = cellsOf(shownRows[row].inner).at(-1) ?? '';
      if (shownResult !== result && !(period.kind === 'differs' && shownResult.startsWith(`${result}, explained by `))) {
        viewer(`period ${row + 1} of ${table.place} against ${table.zone} does not read "${result}" in its result cell`);
      }
    });
  });
  const differing = elements(page, /<tr id="([^"]+)" data-result="differs" data-explanation="([^"]*)"[^>]*>/gu, '</tr>');
  const expected = differences.differences;
  if (differing.length !== expected.length) viewer(`${differing.length} difference rows with an anchor, not ${expected.length}`);
  if (JSON.stringify(differing.map((row) => row.groups[1])) !== JSON.stringify(expected.map((entry) => entry.explanation))) {
    viewer('the difference rows do not name the explanations of tzdb/differences.json, in its order');
  }
  expected.forEach((entry, at) => {
    const shown = differing[at];
    if (!shown) return;
    const section = pairSections.filter((candidate) => candidate.at < shown.at).at(-1);
    const rule = rules.get(entry.atlasRule);
    const cells = pageText(shown.inner);
    const wants = [entry.from, entry.to, entry.atlasRule, rule ? `v${rule.version}, ${rule.uncertainty.flag}` : '(no such rule)',
      entry.atlasOffset, `${entry.tzdbOffset} ${entry.tzdbAbbreviation}`, `differs by ${entry.differenceSeconds} s`];
    if (!section || decodeEntities(section.groups[1]) !== `${entry.place}|${entry.zone}`) {
      viewer(`difference ${at + 1} is not in the section of ${entry.place} against ${entry.zone}`);
    } else if (wants.some((want) => !cells.includes(want)) || !shown.inner.includes(`href="#${entry.explanation}"`)
        || cellsOf(shown.inner).at(-1) !== `differs by ${entry.differenceSeconds} s, explained by ${entry.explanation}`) {
      viewer(`difference ${at + 1} (${entry.place} against ${entry.zone} from ${entry.from}) does not show what tzdb/differences.json gives`);
    }
  });

  // Item 4, the explanations, with their counts, text, findings and sources.
  const sections = elements(page, /<section id="([^"]*)"[^>]*\bdata-explanation-section\b[^>]*\bdata-count="(\d+)"[^>]*>/gu, '</section>');
  if (JSON.stringify(sections.map((section) => section.groups[0])) !== JSON.stringify(explanations.map((entry) => entry.id))) {
    viewer(`the explanation sections are not the ${explanations.length} of tzdb-explanations.json, in order`);
  }
  for (const entry of explanations) {
    const section = sections.find((candidate) => candidate.groups[0] === entry.id);
    if (!section) continue;
    const said = pageText(section.inner);
    const count = expected.filter((difference) => difference.explanation === entry.id).length;
    if (Number(section.groups[1]) !== count || !said.includes(`${count} period`)) viewer(`${entry.id} does not count its ${count} periods`);
    if (!said.includes(entry.category)) viewer(`${entry.id} does not give its category`);
    if (!has(said, entry.explanation)) viewer(`${entry.id} does not give its text as the atlas does`);
    for (const id of entry.citations) {
      if (!section.inner.includes(`href="#cite-${id}"`)) viewer(`${entry.id} does not link its source ${id}`);
    }
    if (entry.tzdbReport) {
      const label = said.indexOf(LABEL);
      if (label < 0) viewer(`${entry.id} lacks the label "${LABEL}"`);
      else if (!said.slice(label + LABEL.length).includes(squash(entry.tzdbReport))) viewer(`${entry.id} does not quote its finding whole after the label`);
    }
  }

  // Item 4, the sources the explanations cite, each once.
  const cited = [...new Set(explanations.flatMap((entry) => entry.citations))];
  const entries = elements(page, /<li id="cite-([^"]*)"[^>]*\bdata-citation\b[^>]*>/gu, '</li>');
  if (JSON.stringify(entries.map((entry) => entry.groups[0]).sort()) !== JSON.stringify([...cited].sort())) {
    viewer(`the source entries are not the ${cited.length} sources the explanations cite, each once`);
  }
  for (const id of cited) {
    const source = citations.get(id);
    const entry = entries.find((candidate) => candidate.groups[0] === id);
    if (!source || !entry) continue;
    const said = pageText(entry.inner);
    const titled = [...entry.inner.matchAll(/<(\w+)\b[^>]*\blang="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/gu)]
      .some((match) => match[2] === source.language && pageText(match[3]) === squash(source.title));
    if (!titled) viewer(`source ${id} does not give its title marked with its language`);
    for (const [what, value] of [['date', source.date], ['issuer', source.issuer], ['publication', source.publication], ['locator', source.locator], ['gloss', source.gloss]]) {
      if (value && !has(said, value)) viewer(`source ${id} does not give its ${what}`);
    }
    if (!entry.inner.includes(`href="${attribute(source.url)}"`)) viewer(`source ${id} does not link its source`);
  }
  const visible = squash(decodeEntities(page));
  for (const source of citations.values()) {
    if (source.excerpt && (text.includes(squash(source.excerpt)) || visible.includes(squash(source.excerpt)))) viewer(`the excerpt of ${source.id} is on the page`);
  }

  // Item 8, every rule with its version, flag and reason, and every change.
  const ruleEntries = elements(page, /<dt id="rule-([^"]*)"[^>]*\bdata-rule\b[^>]*\bdata-version="(\d+)"[^>]*\bdata-flag="([^"]*)"[^>]*>/gu, '<dt ');
  if (ruleEntries.length !== rules.size) viewer(`${ruleEntries.length} rule entries, not ${rules.size}`);
  let changes = 0;
  for (const rule of rules.values()) {
    const entry = ruleEntries.find((candidate) => candidate.groups[0] === rule.id);
    if (!entry) {
      viewer(`rule ${rule.id} has no entry`);
      continue;
    }
    const said = pageText(entry.inner);
    const shownChanges = (entry.inner.match(/<li data-change\b/gu) ?? []).length;
    changes += shownChanges;
    if (Number(entry.groups[1]) !== rule.version || entry.groups[2] !== rule.uncertainty.flag || !has(said, `${rule.id} ${rule.title}, version ${rule.version}`) || !has(said, `${rule.uncertainty.flag}: ${rule.uncertainty.reason}`)) {
      viewer(`rule ${rule.id} does not give its title, version ${rule.version}, flag ${rule.uncertainty.flag} and reason`);
    }
    const listed = rule.changes ?? [];
    if (shownChanges !== listed.length || listed.some((change) => !has(said, `Version ${change.version}, ${change.date}: ${change.summary}`))) {
      viewer(`rule ${rule.id} does not list its ${listed.length} changes, each with its version, date and summary`);
    }
  }
  const allChanges = [...rules.values()].reduce((total, rule) => total + (rule.changes ?? []).length, 0);
  if (changes !== allChanges) viewer(`${changes} change entries, not ${allChanges}`);

  // Item 9, the files, each linked with its source, bytes and SHA-256, and files.json.
  const fileRows = elements(page, /<tr data-file="([^"]*)"[^>]*>/gu, '</tr>');
  const indexBytes = Buffer.from(indexText, 'utf8');
  for (const file of [{ path: 'files.json', source: null, bytes: indexBytes.length, sha256: sha256(indexBytes) }, ...index.files]) {
    const row = fileRows.find((candidate) => candidate.groups[0] === file.path);
    const said = row ? pageText(row.inner) : '';
    if (!row || !row.inner.includes(`href="${folder}/${file.path}"`) || !said.includes(String(file.bytes)) || !said.includes(file.sha256)
        || (file.source && !said.includes(file.source))) {
      viewer(`the files table does not link ${file.path} with its source, bytes and SHA-256`);
    }
  }
  if (fileRows.length !== index.files.length + 1) viewer(`${fileRows.length} rows in the files table, not ${index.files.length + 1}`);

  // Item 10 and the script rule: nothing to run, embed or load in <main>, and the layout's scripts only.
  const main = mainOf(page);
  if (main === undefined) viewer('no <main>');
  else {
    if (/<script\b/iu.test(main)) viewer('<main> holds a script');
    if (/<[a-z][^>]*\son[a-z]+\s*=/iu.test(main)) viewer('<main> holds an inline event handler');
    const embedded = /<(img|iframe|object|embed|video|audio)\b/iu.exec(main);
    if (embedded) viewer(`<main> holds an ${embedded[1].toLowerCase()} element`);
  }
  if (JSON.stringify(scriptOpenings(page)) !== JSON.stringify(scriptOpenings(reference))) {
    viewer('the page\'s script tags are not those of the sky benchmark page');
  }
  const allowed = foreignOrigins(outsideMain(reference));
  for (const origin of foreignOrigins(outsideMain(page))) {
    if (!allowed.has(origin)) viewer(`the page loads from ${origin}, which the sky benchmark page does not`);
  }

  // In-page links and ids, outside scripts.
  const markup = page.replace(/<script\b[\s\S]*?<\/script>/giu, '');
  const ids = [...markup.matchAll(/\sid="([^"]*)"/gu)].map((match) => decodeEntities(match[1]));
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) viewer(`the id ${id} appears twice`);
    seen.add(id);
  }
  for (const match of markup.matchAll(/\shref="#([^"]*)"/gu)) {
    const target = decodeEntities(match[1]);
    if (!seen.has(target)) viewer(`the link to #${target} has no target`);
  }

  // The dash rule.
  const dashes = dashesIn(page);
  if (dashes.length) viewer(`${dashes.length} en or em dashes, raw or as references`);

  // The licence and attribution text, and the citation form (items 1 to 6 of the preregistration's text).
  const geo = manifest.longitudeSource;
  const licenceTexts = [
    `The Zodiacs.org historical time atlas, version ${version}, is licensed under the Creative Commons Attribution 4.0 International licence (CC BY 4.0), ${index.licenseUrl}. The licensor is Zodiacs.org. The licence's text is LICENSE.txt in the version's folder.`,
    `Cite it as: Zodiacs.org historical time atlas, version ${version}, ${SITE}/developers/time-atlas/ (its files are listed in ${SITE}${folder}/files.json), from ${index.source.repository}/tree/${index.source.commit}/${index.source.path}, licensed CC BY 4.0. Cite the rule ids and versions you relied on.`,
    `${geo.attribution} ${geo.dataset}, ${geo.url}, retrieved ${geo.retrieved}, SHA-256 ${geo.sha256}, licensed under ${geo.license}, ${geo.licenseUrl}. Changes: ${geo.changes}`,
    "The atlas's tools and its schema, in atlas/tools/ and atlas/schema/ of the engine repository, are under the MIT licence, whose text is that repository's LICENSE. They are not among the files published here.",
    "As far as the atlas could establish, every text its citations quote is in the public domain, and LICENSING.md says why for each kind of source. The licence covers the atlas's own work, not the texts it quotes, and no scan or OCR text of a source is copied.",
    `The tzdb ${tzdb} extract the comparison uses, atlas/tzdb/tzdb-${tzdb}.json in the engine repository, is in the public domain like tzdb itself. It is linked here, not published.`,
  ];
  licenceTexts.forEach((wanted, at) => {
    if (!has(text, wanted)) licence(`item ${at + 1} of the licence and attribution text is not on the page as written`);
  });
  if (!page.includes(`href="${folder}/LICENSE.txt"`)) licence('LICENSE.txt is not linked');

  // The Dataset markup: exactly one, free, CC BY 4.0, this version, the span and the seventeen files.
  const datasets = jsonLdNodes(page).filter((node) => [node['@type']].flat().includes('Dataset'));
  if (datasets.length !== 1) licence(`${datasets.length} Dataset nodes, not 1`);
  else {
    const [dataset] = datasets;
    const contentUrls = (dataset.distribution ?? []).map((download) => download.contentUrl);
    const last = new Date(Date.parse(`${manifest.coverage.end.slice(0, 10)}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    if (dataset.isAccessibleForFree !== true) licence('the Dataset is not marked isAccessibleForFree');
    if (JSON.stringify([dataset.license].flat()) !== JSON.stringify([index.licenseUrl])) licence(`the Dataset's licence is not ${index.licenseUrl}`);
    if (dataset.version !== version) licence(`the Dataset's version is not ${version}`);
    if (dataset.temporalCoverage !== `${manifest.coverage.start.slice(0, 10)}/${last}`) licence('the Dataset\'s temporalCoverage is not the atlas\'s span');
    if (JSON.stringify([...contentUrls].sort()) !== JSON.stringify(index.files.map((file) => `${SITE}${folder}/${file.path}`).sort())) {
      licence(`the Dataset does not list exactly the ${index.files.length} files`);
    }
  }

  // The correction route, with its three links.
  const route = 'To correct the atlas or add to it, open an Atlas correction issue in zodiacs-org/engine, or a pull request there, giving the rule id (or the place and period), what the clock showed and when it changed, with the clock the change is read on, and a citation to a primary source: its type, title, date and issuer, a stable link, the page and column, its language, and a verbatim excerpt of at most 40 words in the original language. Issues there are public. CORRECTIONS.md says how a correction is reviewed. The copy in this version\'s folder is frozen; the live one, with its log, is on the engine\'s main branch. An accepted correction gives the rule a new version, and the site publishes the changed atlas only as a new version, at its own path. The files of '
    + `${version} never change.`;
  if (!has(text, route)) corrections('the correction text is not on the page as written');
  for (const [name, href] of [['Atlas correction issue', FORM_URL], ['CORRECTIONS.md', `${folder}/CORRECTIONS.md`], ['the live one', LIVE_CORRECTIONS_URL]]) {
    const linked = [...page.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gu)]
      .some((match) => decodeEntities(match[1]) === href && pageText(match[2]) === name);
    if (!linked) corrections(`"${name}" does not link ${href}`);
  }
  return problems;
}
