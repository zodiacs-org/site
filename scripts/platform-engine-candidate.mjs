// Offline metadata contract. This checks claims and their exact immutable URL;
// it does not authenticate a source commit or fetch a remote artifact.
const keys = [
  'schemaVersion', 'name', 'version', 'releaseStatus', 'releaseLabel',
  'registryVersion', 'registryObservedOn',
  'artifactPath', 'artifactUrl', 'artifactRepository', 'artifactCommit',
  'artifactRepositoryPath', 'sha256', 'sourceRepository', 'sourceCommit',
  'sourcePackagePath', 'evidenceRepository', 'evidenceCommit', 'evidencePaths',
];
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, expected) => record(value)
  && Object.keys(value).length === expected.length
  && expected.every((key) => Object.hasOwn(value, key));
const matches = (value, pattern) => typeof value === 'string' && pattern.exec(value)?.[0] === value;
const commit = (value) => matches(value, /^[a-f0-9]{40}$/u) && value !== '0'.repeat(40);
// The SDK and site repositories moved from ZodiacsOfficial to zodiacs-org on
// 2026-09-24; GitHub serves the same commits, and so the same bytes, at both.
const OWNER = 'zodiacs-org';
// Where each source repository keeps the package, and where an artifact
// repository carries packed archives. Up to rc.6 the engine was packages/engine
// of the SDK; from rc.7 it is the root of its own repository.
const SOURCE_PACKAGE_PATHS = new Map([
  [`https://github.com/${OWNER}/sdk`, 'packages/engine'],
  [`https://github.com/${OWNER}/engine`, ''],
]);
const ARTIFACT_DIRECTORIES = new Map([
  [`https://github.com/${OWNER}/site`, 'vendor'],
  [`https://github.com/${OWNER}/sdk`, 'artifacts'],
  [`https://github.com/${OWNER}/engine`, 'artifacts'],
]);

export function assertEngineCandidate(candidate) {
  const fail = () => { throw new Error('Invalid engine candidate metadata'); };
  if (!exactKeys(candidate, keys)) fail();
  if (candidate.schemaVersion !== 1 || candidate.name !== '@zodiacs/engine'
    || !matches(candidate.version, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-rc\.(?:0|[1-9]\d*)$/u)
    || candidate.version.includes('\n')
    // Vendoring a new archive does not publish it. The separately recorded
    // registry version/date must stay explicit through an adoption.
    || !matches(candidate.registryVersion, /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-rc\.(?:0|[1-9]\d*)$/u)
    || !matches(candidate.registryObservedOn, /^\d{4}-\d{2}-\d{2}$/u)
    || !(candidate.releaseStatus === 'published' && candidate.releaseLabel === 'On npm' && candidate.registryVersion === candidate.version
      || candidate.releaseStatus === 'vendored-candidate' && candidate.releaseLabel === 'Vendored candidate' && candidate.registryVersion !== candidate.version)
    || !matches(candidate.sha256, /^[a-f0-9]{64}$/u) || candidate.sha256.length !== 64
    || !commit(candidate.sourceCommit) || !commit(candidate.artifactCommit) || !commit(candidate.evidenceCommit)
    || !SOURCE_PACKAGE_PATHS.has(candidate.sourceRepository)
    || candidate.sourcePackagePath !== SOURCE_PACKAGE_PATHS.get(candidate.sourceRepository)
    || candidate.evidenceRepository !== `https://github.com/${OWNER}/site`
    || !ARTIFACT_DIRECTORIES.has(candidate.artifactRepository)) fail();
  const file = `zodiacs-engine-${candidate.version}.tgz`;
  const repository = candidate.artifactRepository.split('/').at(-1);
  if (candidate.artifactPath !== `vendor/${file}`
    || candidate.artifactRepositoryPath !== `${ARTIFACT_DIRECTORIES.get(candidate.artifactRepository)}/${file}`
    || candidate.artifactUrl !== `https://raw.githubusercontent.com/${OWNER}/${repository}/${candidate.artifactCommit}/${candidate.artifactRepositoryPath}`) fail();
  if (!exactKeys(candidate.evidencePaths, ['ledger', 'node22', 'node24', 'publicConsumer'])) fail();
  for (const path of Object.values(candidate.evidencePaths)) {
    if (!matches(path, /^docs\/platform\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:md|json|log)$/u)
      || path.includes('\n')) fail();
  }
  return candidate;
}
