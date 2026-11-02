import { writeFile } from 'node:fs/promises';
import {
  HOROSCOPE_PROGRAM_PATH,
  expectedHoroscopeProgram,
} from './horoscope-program-files';

const dateIndex = process.argv.indexOf('--date');
const requestedDate = dateIndex >= 0 ? process.argv[dateIndex + 1] : undefined;
const { program, violations } = await expectedHoroscopeProgram(requestedDate);

if (violations.length) {
  console.error(`horoscope-program: ${violations.length} blocking violation(s)`);
  for (const failure of violations) {
    console.error(`  ${failure.ruleId} ${failure.path}: ${failure.message}`);
  }
  process.exit(1);
}

await writeFile(HOROSCOPE_PROGRAM_PATH, `${JSON.stringify(program, null, 2)}\n`);
console.log(
  `horoscope-program: wrote ${program.signs.length} signs for ${program.anchorDate} `
  + `(${program.evidence.length} evidence receipts; today, tomorrow, weekly, love, career, 2026, and 2027)`,
);
