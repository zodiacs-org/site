/** Writes src/data/horoscope-window.json around the committed daily program. */
import { writeFile } from 'node:fs/promises';
import { HOROSCOPE_WINDOW_PATH, expectedHoroscopeWindow, serializeWindow } from './horoscope-window-files';

const { window, violations } = await expectedHoroscopeWindow();
if (violations.length) {
  console.error(`horoscope-window: ${violations.length} blocking problem(s)`);
  for (const problem of violations) console.error(`  ${problem}`);
  process.exit(1);
}
const text = serializeWindow(window);
await writeFile(HOROSCOPE_WINDOW_PATH, text);
console.log(
  `horoscope-window: wrote ${window.editions.map((edition) => edition.anchorDate).join(', ')} `
  + `(${Object.keys(window.evidence).length} evidence receipts, ${Buffer.byteLength(text)} bytes)`,
);
