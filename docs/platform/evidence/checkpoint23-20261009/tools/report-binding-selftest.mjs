import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertReportBinding, REPORT_NAMES } from './report-binding.mjs';

for (const name of REPORT_NAMES) {
  const bytes = readFileSync(new URL('../results/' + name, import.meta.url));
  test(name + ': retained bytes bind successfully', () => assertReportBinding(name, bytes, bytes));
  test(name + ': altered committed metrics fail against unaltered regenerated data', () => {
    const altered = JSON.parse(bytes.toString('utf8'));
    if (name === 'validation.json') altered.givenToleranceArcseconds += 0.001;
    else altered.tolerance += 0.001;
    assert.throws(() => assertReportBinding(name, Buffer.from(JSON.stringify(altered, null, 2) + '\n'), bytes));
  });
  test(name + ': altered regenerated metrics fail against retained evidence', () => {
    const altered = JSON.parse(bytes.toString('utf8'));
    if (name === 'validation.json') altered.givenToleranceArcseconds += 0.001;
    else altered.tolerance += 0.001;
    assert.throws(() => assertReportBinding(name, bytes, Buffer.from(JSON.stringify(altered, null, 2) + '\n')));
  });
}
test('only regenerated producer identity may differ', () => {
  const bytes = readFileSync(new URL('../results/validation.json', import.meta.url));
  const regenerated = JSON.parse(bytes.toString('utf8'));
  regenerated.producer = { source: 'a'.repeat(40), head: 'b'.repeat(40), run: '123', node: 'v22.23.3' };
  assertReportBinding('validation.json', bytes, Buffer.from(JSON.stringify(regenerated, null, 2) + '\n'));
  const changedRetained = JSON.parse(bytes.toString('utf8'));
  changedRetained.producer.run = '999';
  assert.throws(() => assertReportBinding('validation.json',
    Buffer.from(JSON.stringify(changedRetained, null, 2) + '\n'), bytes));
});
