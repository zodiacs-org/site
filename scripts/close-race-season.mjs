/**
 * Locks closed Race seasons into the Trophy Hall (Zodiac Games R2.3).
 *
 * Reads the PUBLIC standings endpoint (no credential): the current board
 * names the running season, and every closed season the Hall does not hold
 * yet (normally just the one before it; more after runs that could not
 * publish) is fetched from the immutable archive view and, if counted,
 * appended once, oldest first, to src/data/games/champions.json. Nothing
 * is ever edited or removed. The daily site build then publishes the Hall
 * entries and the champion state.
 *
 *   node scripts/close-race-season.mjs                  # live
 *   node scripts/close-race-season.mjs --input x.json   # fixture (dev)
 */
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engraveSeasons, previousSeasonIdOf, seasonsToEngrave } from './race-close-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const championsPath = join(repo, 'src', 'data', 'games', 'champions.json');
const API = 'https://zodiacs.org/api/games';
const log = (line) => console.log(`close-season: ${line}`);

async function standings(query) {
  const response = await fetch(`${API}?action=standings${query}`, {
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    return { skip: `standings${query || ''} answered ${response.status}${payload?.error ? ` (${payload.error})` : ''}` };
  }
  return { payload };
}

const champions = JSON.parse(await readFile(championsPath, 'utf8'));
const engravedIds = champions.seasons.map((entry) => entry.seasonId);

const inputFlag = process.argv.indexOf('--input');
let closedId;
let owed;
let archive;
if (inputFlag >= 0) {
  // A fixture is one closed season's archived payload, so it owes at most
  // that season.
  const fixture = JSON.parse(await readFile(process.argv[inputFlag + 1], 'utf8'));
  closedId = fixture.seasonId;
  owed = seasonsToEngrave(closedId, engravedIds, 1);
  archive = async () => ({ payload: fixture });
} else {
  const current = await standings('');
  if (current.skip) {
    log(`skipped, ${current.skip}`);
    process.exit(0);
  }
  closedId = previousSeasonIdOf(current.payload.seasonId);
  owed = seasonsToEngrave(closedId, engravedIds);
  archive = (seasonId) => standings(`&season=${seasonId}`);
}

if (owed.length === 0) {
  log(`${closedId} is already in the Trophy Hall.`);
  process.exit(0);
}
if (owed.length > 1) log(`the Hall is behind; catching up ${owed.join(', ')}, oldest first.`);

const added = await engraveSeasons(champions, owed, archive, log);
if (added.length > 0) {
  await writeFile(championsPath, `${JSON.stringify(champions, null, 2)}\n`);
  // The close workflow names the engraved seasons in its commit and pull request.
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `engraved=${added.map((entry) => entry.seasonId).join(', ')}\n`);
  }
}
