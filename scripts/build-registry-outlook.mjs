import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistryOutlookArtifact } from './registry-outlook-artifact.mjs';
import { registryResearchIsPaused } from './registry-research-lib.mjs';
import { describeRegistryResearchPause, readRegistryResearchPause } from './registry-research-pause.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(repositoryRoot, 'public/assets/registry-outlook.json');
const pause = await readRegistryResearchPause(repositoryRoot);

if (registryResearchIsPaused(pause)) {
  // Paused: no new daily or weekly edition is published. The last one stays
  // as it was written, byte for byte.
  const kept = JSON.parse(await readFile(outputPath, 'utf8'));
  console.log(describeRegistryResearchPause(pause));
  console.log(`Registry Outlook paused: nothing written; edition ${kept.daily?.date ?? 'unknown'} kept as published`);
} else {
  const outlook = await buildRegistryOutlookArtifact(repositoryRoot);
  await writeFile(outputPath, `${JSON.stringify(outlook, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
  console.log(`  daily + weekly symbolic outlook · edition ${outlook.daily.date}`);
}
