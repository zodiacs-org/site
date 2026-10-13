// Records what the npm registry and PyPI said about each package the S4 query guides
// compare: the latest version, its date and its declared licence, read from the
// registries' JSON, with the time of reading. Run: node tools/registry-facts.mjs > registry-facts.json
const NPM = ['@zodiacs/engine', 'astronomy-engine', 'ephemeris', 'sweph', 'swisseph'];
const PYPI = ['pyswisseph', 'kerykeion', 'immanuel', 'flatlib', 'skyfield'];
const get = async (url) => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
};
const npm = [];
for (const name of NPM) {
  const doc = await get(`https://registry.npmjs.org/${name.replace('/', '%2F')}`);
  const latest = doc['dist-tags'].latest;
  const manifest = doc.versions[latest];
  npm.push({ name, latest, published: doc.time[latest], license: manifest.license ?? null, distTags: doc['dist-tags'], source: `https://registry.npmjs.org/${name}` });
}
const pypi = [];
for (const name of PYPI) {
  const doc = await get(`https://pypi.org/pypi/${name}/json`);
  const { version, license, license_expression: expression, classifiers } = doc.info;
  const files = doc.releases[version] ?? [];
  pypi.push({
    name, latest: version, uploaded: files.map((file) => file.upload_time_iso_8601).sort()[0] ?? null,
    license: license || null, licenseExpression: expression ?? null,
    licenseClassifiers: classifiers.filter((classifier) => classifier.startsWith('License ::')),
    source: `https://pypi.org/pypi/${name}/json`,
  });
}
console.log(JSON.stringify({ schema: 'zodiacs.s4-registry-facts.v1', readAt: new Date().toISOString(), npm, pypi }, null, 2));
