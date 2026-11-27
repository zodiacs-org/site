/** Read-only, secret-free gate over the committed daily publication package. */
import '../src/lib/engine/server-de440.mjs';
import {
  canonicalJson,
  expectedDailyPackage,
  formatViolations,
  readActualPackage,
} from './daily-publication-files';
import { verifyDailyPublicationCopy } from './independent-copy-verifier';

const requestedDateIndex = process.argv.indexOf('--date');
const requestedDate = requestedDateIndex >= 0 ? process.argv[requestedDateIndex + 1] : null;
const expected = await expectedDailyPackage();
const actual = await readActualPackage();
const failures = [
  ...expected.violations,
  ...verifyDailyPublicationCopy(actual.publication),
];

if (requestedDate && requestedDate !== expected.daily.date) {
  failures.push({
    ruleId: 'PROV-TARGET-DATE',
    path: 'daily.date',
    message: `${expected.daily.date} does not match requested ${requestedDate}`,
  });
}
if (canonicalJson(actual.publication) !== canonicalJson(expected.publication)) {
  failures.push({
    ruleId: 'PROV-PUBLICATION-HASH',
    path: 'src/data/daily-publication.json',
    message: 'committed publication differs from the facts-derived edition',
  });
}
if (canonicalJson(actual.manifest) !== canonicalJson(expected.manifest)) {
  failures.push({
    ruleId: 'PROV-MANIFEST-HASH',
    path: 'src/data/daily-publication-manifest.json',
    message: 'committed manifest differs from the recomputed provenance record',
  });
}

const unique = [...new Map(failures.map((failure) => [
  `${failure.ruleId}|${failure.path}|${failure.message}`,
  failure,
])).values()].sort((left, right) => (
  left.ruleId.localeCompare(right.ruleId) || left.path.localeCompare(right.path)
));

if (unique.length) {
  console.error(`verify-daily-publication: ${unique.length} failure(s)`);
  console.error(formatViolations(unique));
  process.exit(1);
}
console.log(
  `verify-daily-publication: PASS — ${expected.daily.date}, 12 signs, `
  + `${expected.publication.facts.length} facts, independent copy checks and hashes match`,
);
