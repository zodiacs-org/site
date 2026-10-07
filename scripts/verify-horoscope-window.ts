/**
 * Verifies the committed assistant horoscope window. Without flags it runs
 * the quick checks (no recomputation); --replay also rebuilds the neighbouring
 * editions and requires the committed file to match byte for byte.
 */
import { readFile } from 'node:fs/promises';
import type { HoroscopeWindow } from '../src/ai-tools/horoscope/window';
import {
  HOROSCOPE_WINDOW_PATH,
  expectedHoroscopeWindow,
  quickWindowProblems,
  readCommittedWindowInputs,
  serializeWindow,
} from './horoscope-window-files';

const text = await readFile(HOROSCOPE_WINDOW_PATH, 'utf8');
const committed = JSON.parse(text) as HoroscopeWindow;
const { program } = await readCommittedWindowInputs();
const problems = quickWindowProblems(committed, program);
if (process.argv.includes('--replay')) {
  const { window, violations } = await expectedHoroscopeWindow();
  problems.push(...violations);
  if (serializeWindow(window) !== text) problems.push('committed window differs from deterministic regeneration');
}
if (problems.length) {
  console.error(`verify-horoscope-window: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`verify-horoscope-window: OK — ${committed.editions.map((edition) => edition.anchorDate).join(', ')}`);
