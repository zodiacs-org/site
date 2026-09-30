// Report measured public-package residuals against the frozen independent
// node/polar references: the true node against NASA JPL Horizons (DE441) state
// vectors and the polar angles against ERFA, on the cases and predeclared
// gates of the Swiss node/polar pack that was removed on 2026-09-28
// (docs/platform/programme/DECISIONS-2026-09-28.md §3). Reports made before
// then measured against Swiss Ephemeris and name its fixture's digest.
// Never regenerates reference values or changes predeclared acceptance limits.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ENGINE_VERSION, natalChart, positions } from '@zodiacs/engine';

const read = (name) => readFileSync(new URL(`../src/lib/engine/fixtures/${name}`, import.meta.url));
const fixtureBytes = read('independent-node-polar.json');
const policyBytes = read('swiss-node-polar-policy.json');
const fixture = JSON.parse(fixtureBytes);
const policy = JSON.parse(policyBytes);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(digest(fixtureBytes), '75f667f192c43c1ee3a8be6c5379586621b5eaa26f32e21e2ec8afd6206e3800');
assert.equal(digest(policyBytes), '7742cb2bc7cd0932a344ddcb708e45dad07b91cb653ea1f55538c2d73fa18e96');
const distance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const nodes = fixture.trueNode.map((reference) => {
  const node = positions(reference.input.utc).find((value) => value.body === 'North Node');
  assert(node);
  const longitudeErrorDegrees = distance(node.lon, reference.longitudeDegrees);
  const speedErrorDegreesPerDay = Math.abs(node.speed - reference.longitudeSpeedDegreesPerDay);
  assert(longitudeErrorDegrees <= policy.trueNode.longitudeCircularDifferenceDegreesMaximum);
  assert(speedErrorDegreesPerDay <= policy.trueNode.longitudeSpeedAbsoluteDifferenceDegreesPerDayMaximum);
  const directionCompared = Math.abs(node.speed) > policy.trueNode.directionDeadbandDegreesPerDay
    && Math.abs(reference.longitudeSpeedDegreesPerDay) > policy.trueNode.directionDeadbandDegreesPerDay;
  if (directionCompared) assert.equal(node.retrograde, reference.longitudeSpeedDegreesPerDay < 0);
  return { id: reference.id, longitudeErrorDegrees, speedErrorDegreesPerDay, directionCompared };
});
const polar = fixture.polar.flatMap((reference) => ['whole', 'placidus'].map((houseSystem) => {
  const chart = natalChart({ utc: reference.input.utc, latitude: reference.latitudeDegrees,
    longitude: reference.longitudeDegreesEastPositive, houseSystem });
  assert(chart.angles && chart.houses);
  assert.equal(chart.houses.system, 'whole');
  assert.equal(chart.flags.includes('polar-fallback'), houseSystem === 'placidus');
  const ascendantErrorDegrees = distance(chart.angles.asc, reference.whole.ascendantDegrees);
  const midheavenErrorDegrees = distance(chart.angles.mc, reference.whole.midheavenDegrees);
  const maximumCuspErrorDegrees = Math.max(...chart.houses.cusps.map((value, index) => distance(value, reference.whole.cuspsDegrees[index])));
  assert(ascendantErrorDegrees <= policy.polar.ascendantCircularDifferenceDegreesMaximum);
  assert(midheavenErrorDegrees <= policy.polar.midheavenCircularDifferenceDegreesMaximum);
  assert(maximumCuspErrorDegrees <= policy.polar.wholeHouseCuspCircularDifferenceDegreesMaximum);
  return { id: reference.id, requestedHouseSystem: houseSystem, actualHouseSystem: chart.houses.system,
    ascendantErrorDegrees, midheavenErrorDegrees, maximumCuspErrorDegrees };
}));
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const artifact = manifest.dependencies['@zodiacs/engine'].replace(/^file:/u, '');
assert(artifact.startsWith('vendor/') && !artifact.includes('..'));
console.log(JSON.stringify({
  schemaVersion: 1, generatedAt: new Date().toISOString(), engineVersion: ENGINE_VERSION,
  node: process.version, icu: process.versions.icu, tzdata: process.versions.tz ?? null,
  artifact, artifactSHA256: digest(readFileSync(new URL(`../${artifact}`, import.meta.url))),
  fixtureSHA256: digest(fixtureBytes), policySHA256: digest(policyBytes),
  scope: 'Three independent node epochs and three polar locations, both requested house systems. Finite corpus, not a complete error bound or human certification.',
  conventions: 'References at the engine\'s own TT; true node from Horizons DE441 geometric state vectors (osculating node, true ecliptic of date); ASC, MC and whole-sign cusps from ERFA at the engine\'s UT1 for the instant; product Placidus fallback compared with whole-sign cusps. See docs/engine-validation/independent-references/README.md.',
  nodes, polar,
  maxima: {
    nodeLongitudeDegrees: Math.max(...nodes.map((value) => value.longitudeErrorDegrees)),
    nodeSpeedDegreesPerDay: Math.max(...nodes.map((value) => value.speedErrorDegreesPerDay)),
    polarAngleDegrees: Math.max(...polar.flatMap((value) => [value.ascendantErrorDegrees, value.midheavenErrorDegrees])),
    wholeCuspDegrees: Math.max(...polar.map((value) => value.maximumCuspErrorDegrees)),
  },
  result: 'passed',
}, null, 2));
