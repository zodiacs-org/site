/** Keep a changed MCP panel from silently reusing a host-cached resource URI. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const MANIFEST = new URL('src/ai-tools/panel-fingerprints.json', ROOT);
const PANELS = [
  ['sky-events', 'src/ai-tools/contracts.ts', 'WIDGET_URI'],
  ['chart-studio', 'src/ai-tools/contracts.ts', 'STUDIO_URI'],
  ['horoscopes', 'src/ai-tools/horoscope/reading.ts', 'HOROSCOPE_URI'],
  ['occasions', 'src/ai-tools/contracts.ts', 'OCCASIONS_URI'],
];

async function currentUri(path, symbol) {
  const source = await readFile(new URL(path, ROOT), 'utf8');
  const match = source.match(new RegExp(`\\bexport const ${symbol} = '([^']+)'`, 'u'));
  if (!match?.[1]?.startsWith('ui://zodiacs/')) throw new Error(`Cannot read ${symbol} from ${path}`);
  return match[1];
}

export async function panelFingerprintEntries(htmlByName) {
  return Promise.all(PANELS.map(async ([name, path, symbol]) => {
    const html = htmlByName[name];
    if (typeof html !== 'string' || !html.startsWith('<!doctype html>')) throw new Error(`Missing ${name} panel HTML`);
    return { name, uri: await currentUri(path, symbol), sha256: createHash('sha256').update(html).digest('hex') };
  }));
}

export function assertPanelFingerprints(entries, recorded) {
  for (const { name, uri, sha256 } of entries) {
    if (recorded[uri] !== sha256) {
      if (Object.hasOwn(recorded, uri)) throw new Error(`Panel ${name} changed: give it a new URI in contracts.ts`);
      throw new Error(`Panel ${name} has a new URI: run npm run ai:build`);
    }
  }
  if (Object.keys(recorded).length !== entries.length) throw new Error('Panel fingerprint manifest has stale URIs; run npm run ai:build');
}

export async function syncPanelFingerprints(htmlByName, check) {
  const entries = await panelFingerprintEntries(htmlByName);
  const current = Object.fromEntries(entries.map(({ uri, sha256 }) => [uri, sha256]));
  const bytes = JSON.stringify(current, null, 2) + '\n';
  const previousBytes = await readFile(MANIFEST, 'utf8').catch(() => null);
  const recorded = previousBytes ? JSON.parse(previousBytes) : {};
  if (check) {
    assertPanelFingerprints(entries, recorded);
    if (previousBytes !== bytes) throw new Error('Panel fingerprint manifest is stale; run npm run ai:build');
  } else {
    // A new address may be recorded. Rebuilding changed HTML at the same
    // address must fail instead of silently blessing the stale host cache.
    for (const { name, uri, sha256 } of entries) {
      if (Object.hasOwn(recorded, uri) && recorded[uri] !== sha256) {
        throw new Error(`Panel ${name} changed: give it a new URI in contracts.ts`);
      }
    }
    await writeFile(MANIFEST, bytes);
  }
  console.log(`${check ? 'Verified' : 'Built'} panel fingerprints (${entries.length} current URIs)`);
}
