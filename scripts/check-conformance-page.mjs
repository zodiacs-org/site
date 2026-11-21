// Check what readers see after Astro renders the pinned conformance data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import source from '../src/data/conformance/source.json' with { type: 'json' };
import summary from '../src/data/conformance/summary.json' with { type: 'json' };
import unsupported from '../src/data/conformance/unsupported.json' with { type: 'json' };

const page = parse(readFileSync(new URL('../dist/developers/conformance/index.html', import.meta.url), 'utf8'));
const text = (element) => element.text.trim();
const cells = (row, selector) => row.querySelectorAll(selector).map(text);
const columns = ['Vectors', 'Pass', 'Fail', 'Unsupported', 'Error'];
const counts = (bucket) => [bucket.count, bucket.pass, bucket.fail, bucket.unsupported, bucket.error].map(String);
const scoreboard = page.querySelector('[aria-label="Scoreboard by adapter"] table');
assert.deepEqual(cells(scoreboard, 'thead th'), ['Adapter', 'Suite', ...columns, 'L1 positions passed']);
const rows = scoreboard.querySelectorAll('tbody tr');
assert.equal(rows.length, summary.runs.length);
assert.equal(text(page.querySelector(`time[datetime="${source.commitDate}"]`)), source.commitDate);
const entry = page.querySelector('#run');
assert.equal(text(entry), 'How to enter');
for (const file of ['README.md', 'SPEC.md']) {
  assert.ok(entry.nextElementSibling.querySelector(`a[href="${source.repository}/blob/${source.commit}/conformance/${file}"]`), file);
}

for (const run of summary.runs) {
  const { name, engine, engineVersion } = run.adapter;
  const row = rows.find((row) => row.querySelector(`th a[href="#${name}"]`));
  assert.ok(row, `Missing scoreboard row for ${engine}`);
  const label = text(row.querySelector('th'));
  assert.ok(label.includes(engine) && label.includes(engineVersion), label);
  if (name === 'zodiacs-engine') assert.match(label, /default DE440/u);
  const positions = run.summary.byLevel.L1;
  assert.deepEqual(cells(row, 'td'), [run.suiteVersion, ...counts(run.summary.total), `${positions.pass}/${positions.count}`], label);

  const section = page.querySelector(`section[aria-labelledby="${name}"]`);
  assert.equal(text(section.querySelector('h3')), label);
  assert.deepEqual(cells(section, 'thead th'), ['Kind', ...columns, 'Median / largest residual']);
  for (const [attribute, buckets] of [['level', run.summary.byLevel], ['kind', run.summary.byKind]]) {
    const details = section.querySelectorAll(`tr[data-${attribute}]`);
    assert.deepEqual(details.map((tr) => tr.getAttribute(`data-${attribute}`)).sort(), Object.keys(buckets).sort());
    for (const tr of details) {
      const key = tr.getAttribute(`data-${attribute}`);
      assert.deepEqual(cells(tr, 'td').slice(0, columns.length), counts(buckets[key]), `${label}: ${key}`);
      if (attribute === 'level') assert.ok(text(tr.querySelector('th')).startsWith(key), key);
    }
  }

  const groups = section.querySelectorAll('details dt').map((term) => [
    text(term), cells(term.nextElementSibling, 'li code'),
  ]);
  assert.deepEqual(groups, Object.entries(unsupported[engine]), `${label}: unsupported IDs and adapter reasons`);
  assert.equal(groups.flatMap(([, ids]) => ids).length, run.summary.total.unsupported);
}
console.log('Conformance scoreboard matches the pinned results and unsupported reasons.');
