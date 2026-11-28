import '../src/lib/engine/server-de440.mjs';
import { readFile } from 'node:fs/promises';
import type { HoroscopeProgram } from '../src/lib/horoscope-program';
import {
  HOROSCOPE_PROGRAM_PATH,
  expectedHoroscopeProgram,
} from './horoscope-program-files';
import { verifyHoroscopeProgramCopy } from './independent-copy-verifier';

const actual = JSON.parse(await readFile(HOROSCOPE_PROGRAM_PATH, 'utf8')) as HoroscopeProgram;
const { program: expected, violations } = await expectedHoroscopeProgram(actual.anchorDate);
const copyViolations = verifyHoroscopeProgramCopy(actual);
const failures = [...violations, ...copyViolations];

if (failures.length) {
  console.error(`verify-horoscope-program: ${failures.length} policy violation(s)`);
  for (const failure of failures) {
    console.error(`  ${failure.ruleId} ${failure.path}: ${failure.message}`);
  }
  process.exit(1);
}
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  console.error('verify-horoscope-program: committed program differs from deterministic regeneration');
  process.exit(1);
}

console.log(
  `verify-horoscope-program: OK — ${actual.anchorDate}, ${actual.signs.length} signs, `
  + `${actual.evidence.length} evidence receipts; independent copy checks and replay match`,
);
