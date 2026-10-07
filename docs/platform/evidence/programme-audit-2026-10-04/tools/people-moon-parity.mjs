/*
 * The People pilot's frozen Moon-sign verdicts (src/data/people.json, written by
 * docs/phase5/people-pilot/tools/compute-astro.mjs) against the package's
 * moonSignCandidates for the same civil day, zone and longitude (FINDINGS F-70).
 * The pilot's records are public figures who have died; only counts are written.
 *
 *   node docs/platform/evidence/programme-audit-2026-10-04/tools/people-moon-parity.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareLocalTime } from '@zodiacs/engine/geo';
import { moonSignCandidates } from '@zodiacs/engine/techniques';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const { people } = JSON.parse(readFileSync(resolve(root, 'src/data/people.json'), 'utf8'));
const engineVersion = JSON.parse(readFileSync(resolve(root, 'node_modules/@zodiacs/engine/package.json'), 'utf8')).version;

function nextDay(date) {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(0);
  next.setUTCFullYear(year, month - 1, day + 1);
  return next.toISOString().slice(0, 10);
}

const counts = { pages: 0, verdictsAgree: 0, signsAgree: 0, dayBoundsAgree: 0, refused: 0 };
for (const person of people) {
  const date = person.birthDate.computedGregorianDate;
  const { timeZone, longitude, civilDayStartUtc, civilDayEndUtc } = person.computation;
  await prepareLocalTime(date, timeZone);
  await prepareLocalTime(nextDay(date), timeZone);
  counts.pages += 1;
  let result;
  try {
    result = moonSignCandidates(date, { timeZone, longitude });
  } catch {
    counts.refused += 1;
    continue;
  }
  const pilotSigns = [...new Set([person.moon.signAtCivilDayStart, person.moon.signAtCivilDayEnd])];
  if ((result.sign === null) === person.moon.uncertain) counts.verdictsAgree += 1;
  if (JSON.stringify(result.signs) === JSON.stringify(pilotSigns)) counts.signsAgree += 1;
  if (result.from.toISOString() === civilDayStartUtc && result.to.getTime() + 1 === Date.parse(civilDayEndUtc)) counts.dayBoundsAgree += 1;
}

const record = {
  schema: 'zodiacs.people-moon-parity.v1',
  finding: 'F-70',
  question: 'Do the People pilot\'s frozen Moon-sign verdicts equal the package\'s moonSignCandidates for the same civil day?',
  input: 'src/data/people.json: every page, its computed Gregorian birth date, IANA zone and longitude',
  engine: engineVersion,
  counts,
  note: 'The pilot samples the Moon\'s sign at both ends of the civil day; the package returns the signs the Moon holds across it. The day bounds compare the package\'s from and to (inclusive, to the millisecond) with the pilot\'s start and end.',
};
writeFileSync(resolve(here, '../people-moon-parity.json'), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(counts));
