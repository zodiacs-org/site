/**
 * Keeps a withheld Registry Research note out of the built site.
 *
 * While src/data/registry-research/pause.json says "paused", a note that was
 * still scheduled is withheld: its page says it was not published and carries
 * no body (src/pages/terminal/research/[slug].astro). Its public JSON must not
 * ship either. The committed copies under public/assets/ stay exactly as they
 * are (the paused builder, scripts/build-registry-research.mjs, requires them
 * unchanged so publishing can resume with nothing else to restore); this step
 * runs once Astro has copied public/ into dist/ and, in dist/ only:
 *
 *   - deletes assets/data/registry-research/items/{id}.json for each withheld note,
 *   - drops the withheld notes from assets/data/registry-research/index.json
 *     (the full archive index) and from assets/registry-research-feed.json.
 *
 * The RSS and JSON feeds under /feeds/, the sitemap and the search index
 * already leave scheduled and noindex notes out. scripts/check-dist.mjs fails
 * when a withheld note's JSON is still in dist/.
 */
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryResearchIsPaused } from './registry-research-lib.mjs';

export const REGISTRY_RESEARCH_DIST_PATHS = {
  index: 'assets/data/registry-research/index.json',
  feed: 'assets/registry-research-feed.json',
  items: 'assets/data/registry-research/items',
};

/** The ids of the notes withheld while publishing is paused: every note still scheduled. */
export function withheldRegistryResearchIds(publication, pause) {
  if (!registryResearchIsPaused(pause)) return [];
  return publication.items.filter((item) => item.status === 'scheduled').map((item) => item.id);
}

export function registryResearchItemDistPath(id) {
  return `${REGISTRY_RESEARCH_DIST_PATHS.items}/${id}.json`;
}

function withoutItems(document, withheld) {
  const next = { ...document, items: document.items.filter((item) => !withheld.has(item.id)) };
  if (Array.isArray(document.rollingItemIds)) {
    next.rollingItemIds = document.rollingItemIds.filter((id) => !withheld.has(id));
  }
  return next;
}

async function rewriteWithout(path, withheld) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  const document = JSON.parse(raw);
  if (!Array.isArray(document.items) || !document.items.some((item) => withheld.has(item.id))) return;
  await writeFile(path, `${JSON.stringify(withoutItems(document, withheld), null, 2)}\n`, 'utf8');
}

/** Removes the withheld notes' JSON from a built output directory. Returns the withheld ids. */
export async function withholdRegistryResearchFromDist(distRoot, { publication, pause }) {
  const ids = withheldRegistryResearchIds(publication, pause);
  if (!ids.length) return ids;
  const withheld = new Set(ids);
  await Promise.all([
    ...ids.map((id) => rm(resolve(distRoot, registryResearchItemDistPath(id)), { force: true })),
    rewriteWithout(resolve(distRoot, REGISTRY_RESEARCH_DIST_PATHS.index), withheld),
    rewriteWithout(resolve(distRoot, REGISTRY_RESEARCH_DIST_PATHS.feed), withheld),
  ]);
  return ids;
}

async function optionalText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * What a built output directory still gives away about a withheld note: its
 * item JSON, an entry in the archive index or the compact feed, or a body on
 * its page. Empty when nothing is withheld or nothing leaks.
 */
export async function registryResearchWithheldProblems(distRoot, { publication, pause }) {
  const problems = [];
  const items = new Map(publication.items.map((item) => [item.id, item]));
  for (const id of withheldRegistryResearchIds(publication, pause)) {
    if ((await optionalText(resolve(distRoot, registryResearchItemDistPath(id)))) !== null) {
      problems.push(`withheld note ${id} ships its JSON at /${registryResearchItemDistPath(id)}`);
    }
    for (const path of [REGISTRY_RESEARCH_DIST_PATHS.index, REGISTRY_RESEARCH_DIST_PATHS.feed]) {
      const raw = await optionalText(resolve(distRoot, path));
      if (raw !== null && JSON.parse(raw).items?.some((item) => item.id === id)) {
        problems.push(`withheld note ${id} is listed in /${path}`);
      }
    }
    const url = items.get(id).url;
    const html = await optionalText(resolve(distRoot, url.replace(/^\//u, ''), 'index.html'));
    if (html !== null && (html.includes('data-research-body') || html.includes(registryResearchItemDistPath(id)))) {
      problems.push(`withheld note ${id} carries its body on ${url}`);
    }
  }
  return problems;
}

const repositoryRoot =resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function committedJson(path) {
  try {
    return JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

/** Astro integration: runs after the build has copied public/ into the output directory. */
export function registryResearchWithheld() {
  return {
    name: 'registry-research-withheld',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const [publication, pause] = await Promise.all([
          committedJson('src/data/registry-research/publication.json'),
          committedJson('src/data/registry-research/pause.json'),
        ]);
        if (!publication) return;
        const ids = await withholdRegistryResearchFromDist(fileURLToPath(dir), { publication, pause });
        if (ids.length) logger.info(`Registry Research paused: ${ids.length} scheduled note(s) left out of the public JSON`);
      },
    },
  };
}
