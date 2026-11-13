/**
 * The dated artifact check the Daily Sky and Registry Market Snapshot
 * workflows run before they commit the Registry pairing.
 *
 * Publishing: the market archive, the outlook editions and the Registry
 * Research ledger, publication and compact feed must all be dated TARGET_DATE.
 *
 * Paused (src/data/registry-research/pause.json): the market archive is still
 * dated TARGET_DATE, because the catalogue pages bake it. The outlook and the
 * research artifacts are the last ones published before the pause, so they are
 * not required to carry today's date; they only have to agree with each other.
 *
 *   TARGET_DATE=YYYY-MM-DD node scripts/check-registry-pairing.mjs
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryResearchIsPaused } from './registry-research-lib.mjs';
import { readRegistryResearchPause } from './registry-research-pause.mjs';

export function registryPairingProblems({ target, pause, history, outlook, researchDrafts, researchPublication, researchFeed }) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(target ?? '')) return [`TARGET_DATE is ${target ?? 'unset'}; expected YYYY-MM-DD`];
  const latest = history?.snapshots?.at(-1);
  const market = {
    market: latest?.date,
    marketRead: latest?.source?.readAt?.slice(0, 10),
  };
  const editions = {
    dailyOutlook: outlook?.daily?.date,
    weeklyOutlook: outlook?.weekly?.date,
    researchDrafts: researchDrafts?.generatedAt?.slice(0, 10),
    researchPublication: researchPublication?.generatedAt?.slice(0, 10),
    researchFeed: researchFeed?.generatedAt?.slice(0, 10),
  };
  const problems = [];
  const dated = registryResearchIsPaused(pause) ? market : { ...market, ...editions };
  for (const [label, date] of Object.entries(dated)) {
    if (date !== target) problems.push(`${label} artifact is ${date ?? 'undated'}; expected ${target}`);
  }
  if (registryResearchIsPaused(pause)) {
    for (const [label, date] of Object.entries(editions)) {
      if (!date) problems.push(`${label} artifact is undated`);
    }
    if (editions.dailyOutlook !== editions.weeklyOutlook) {
      problems.push(`paused outlook editions disagree: daily ${editions.dailyOutlook}, weekly ${editions.weeklyOutlook}`);
    }
    if (researchPublication?.generatedAt !== researchFeed?.generatedAt) {
      problems.push('paused research publication and compact feed carry different clocks');
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const json = (path) => readFile(resolve(root, path), 'utf8').then(JSON.parse);
  const [pause, history, outlook, researchDrafts, researchPublication, researchFeed] = await Promise.all([
    readRegistryResearchPause(root),
    json('public/assets/data/registry-market-history.v1.json'),
    json('public/assets/registry-outlook.json'),
    json('src/data/registry-research/drafts.json'),
    json('src/data/registry-research/publication.json'),
    json('public/assets/registry-research-feed.json'),
  ]);
  const problems = registryPairingProblems({
    target: process.env.TARGET_DATE, pause, history, outlook, researchDrafts, researchPublication, researchFeed,
  });
  if (problems.length) throw new Error(problems.join('\n'));
  console.log(registryResearchIsPaused(pause)
    ? `Registry pairing: market archive ${process.env.TARGET_DATE}; outlook ${outlook.daily.date} and research ${researchPublication.generatedAt} kept as published before the pause`
    : `Registry pairing: every artifact dated ${process.env.TARGET_DATE}`);
}
