/**
 * Reads the committed Registry Research pause record,
 * src/data/registry-research/pause.json.
 *
 * Every builder that publishes Registry Research or a Registry Outlook edition
 * reads it first: scripts/build-registry-research.mjs,
 * scripts/build-registry-outlook.mjs and scripts/build-app.mjs. While the
 * status is "paused" they write nothing, and the pairing check
 * (scripts/check-registry-pairing.mjs) accepts the last published editions in
 * place of today's. To resume, set the status to "publishing".
 *
 *   node scripts/registry-research-pause.mjs           prints the state
 *   node scripts/registry-research-pause.mjs --paused  exits 0 only while paused
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryResearchIsPaused, validateRegistryResearchPause } from './registry-research-lib.mjs';

export const REGISTRY_RESEARCH_PAUSE_PATH = 'src/data/registry-research/pause.json';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The validated record, or null when there is none (publishing as normal). */
export async function readRegistryResearchPause(root = defaultRoot) {
  let raw;
  try {
    raw = await readFile(resolve(root, REGISTRY_RESEARCH_PAUSE_PATH), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  const pause = JSON.parse(raw);
  validateRegistryResearchPause(pause);
  return pause;
}

export function describeRegistryResearchPause(pause) {
  if (!registryResearchIsPaused(pause)) return 'Registry Research and Outlook: publishing';
  return `Registry Research and Outlook: paused since ${pause.pausedAt} (${pause.pausedAtLocal ?? 'UTC'}). ${pause.reason}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pause = await readRegistryResearchPause();
  console.log(describeRegistryResearchPause(pause));
  if (process.argv.includes('--paused') && !registryResearchIsPaused(pause)) process.exitCode = 1;
}
