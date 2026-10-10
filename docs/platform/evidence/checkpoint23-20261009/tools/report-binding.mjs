import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const REPORT_NAMES = ['houses-given.json', 'houses-end-to-end.json', 'co-given.json', 'co-end-to-end.json', 'validation.json'];
const validationSha256 = '07a86d180f2e1ff7e1115b0896a8a9002dd033d14c2105685e6ff5f1ef26f2ff';
export function assertReportBinding(name, committed, generated) {
  assert.ok(REPORT_NAMES.includes(name), 'Unknown checkpoint report');
  if (name !== 'validation.json') {
    assert.ok(generated.equals(committed), name + ' differs from retained committed bytes');
    return;
  }
  assert.equal(createHash('sha256').update(committed).digest('hex'), validationSha256,
    'Retained validation evidence, including original producer identity, changed');
  const oldReport = JSON.parse(committed.toString('utf8'));
  const newReport = JSON.parse(generated.toString('utf8'));
  // Only the new execution identity differs; every claim/metric/hash is compared.
  delete oldReport.producer;
  delete newReport.producer;
  assert.deepEqual(newReport, oldReport, 'Validation claims differ from retained evidence');
}
