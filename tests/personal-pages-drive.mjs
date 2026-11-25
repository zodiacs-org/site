import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Each page checks its own launch switch and shares the browser budget with the next drive.
for (const file of ['./vedic-signs-drive.mjs', './retrogrades-for-you-drive.mjs']) {
  const path = fileURLToPath(new URL(file, import.meta.url));
  const run = spawnSync(process.execPath, [path], { stdio: 'inherit' });
  if (run.error) throw run.error;
  if (run.status !== 0) process.exitCode = 1;
}
