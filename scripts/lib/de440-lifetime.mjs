// The pinned reducer reuses its last decoded records and working vectors.
// Clear these request-derived values while keeping the verified pack open.
export function addDe440Lifetime(generated) {
  const constructors = generated.match(
    /^function sourceOf\(copy\d*, digest\d*, header\d*\) \{\n  const reducer = new Reducer\(new PackEphemeris\(copy\d*, header\d*\)\);$/gmu,
  );
  if (constructors?.length !== 1) throw new Error('DE440 source constructor changed; review cleanup');
  const [constructor] = constructors;
  if (generated.match(/^    b\d*\.cachedRecord = record\d*;$/gmu)?.length !== 1) {
    throw new Error('DE440 record cache changed; review cleanup');
  }
  for (const marker of [
    constructor,
    'cachedRecord: -1,',
    'scratch = new Float64Array(6);',
    'scratch2 = new Float64Array(6);',
    ...['a', 'b', 'c', 'emb', 'moon', 'earth'].map((field) => `  ${field} = new Float64Array(6);`),
  ]) {
    if (generated.split(marker).length !== 2) {
      throw new Error(`DE440 private state changed; review cleanup: ${marker}`);
    }
  }
  if (generated.includes('var clearDe440State = () => {};')) return generated;
  return generated.replace(constructor, `var clearDe440State = () => {};
${constructor}
  clearDe440State = () => {
    for (const body of reducer.backend.bodies.values()) {
      body.cachedRecord = -1;
      body.coefficients.fill(0);
    }
    for (const vector of [
      reducer.a, reducer.b, reducer.c, reducer.emb, reducer.moon, reducer.earth,
      reducer.backend.scratch, reducer.backend.scratch2,
    ]) vector.fill(0);
  };`);
}
