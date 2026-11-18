import packageDocument from '../../package.json' with { type: 'json' };
import latest from '../data/accuracy/latest.json' with { type: 'json' };

export const ACCURACY_PATH = '/developers/accuracy/';

// SemVer precedence against the stable release 1.1.0. A prerelease has
// lower precedence than the stable release only at the same core version.
export function accuracyEngineEligible(version) {
  const numeric = '(0|[1-9][0-9]*)';
  const prerelease = '(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)';
  const semver = new RegExp(
    `^${numeric}\\.${numeric}\\.${numeric}(?:-(${prerelease}(?:\\.${prerelease})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
    'u',
  );
  const parsed = semver.exec(version);
  if (!parsed) return false;
  const [, major, minor, patch, pre] = parsed;
  if (major !== '1') return major !== '0';
  if (minor !== '1') return minor !== '0';
  return patch !== '0' || pre === undefined;
}

const dependency = packageDocument.dependencies['@zodiacs/engine'];
const vendoredVersion = /\/zodiacs-engine-(.+)\.tgz$/u.exec(dependency)?.[1] ?? dependency;
export const accuracyDiscoverable = accuracyEngineEligible(vendoredVersion) && latest !== null;
