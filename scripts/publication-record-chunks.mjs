import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/**
 * The publication records (src/data/locale-expansion-publication.json and
 * src/data/natal-aspects-publication.json) carry hold reasons and, once
 * pages are released, reviewer names. They are read on the server only, so
 * no file the browser loads may contain them: not a chunk under _astro/, not
 * a script elsewhere in dist, and not a page's inline script or island
 * props. `holdReason` is the key every entry of both records has, and
 * nothing written for the browser uses it.
 */
export const PUBLICATION_RECORD_MARKER = 'holdReason';

const BROWSER_FILE = /\.(?:m?js|cjs|html)$/u;

async function browserFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return out;
    throw error;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await browserFiles(path));
    else if (BROWSER_FILE.test(entry.name)) out.push(path);
  }
  return out;
}

/** Scripts and pages under `dir` (dist) that contain the record's key, as paths relative to `dir`. */
export async function chunksWithPublicationRecord(dir, marker = PUBLICATION_RECORD_MARKER) {
  const hits = [];
  for (const file of await browserFiles(dir)) {
    if ((await readFile(file, 'utf8')).includes(marker)) hits.push(relative(dir, file).split(sep).join('/'));
  }
  return hits.sort();
}
