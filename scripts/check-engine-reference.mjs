import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function checkEngineReference(root) {
  const directory = join(root, 'developers/engine/reference');
  const base = 'https://zodiacs.org/developers/engine/reference/';
  const errors = [];
  let provenance;
  try { provenance = JSON.parse(await readFile(join(directory, 'provenance.json'), 'utf8')); }
  catch { return { pages: 0, errors: ['Missing or invalid reference provenance'] }; }
  if (provenance.sourceRepository !== 'https://github.com/zodiacs-org/engine'
    || provenance.artifactUrl !== 'https://raw.githubusercontent.com/zodiacs-org/engine/ef44477f85f28a57d5ec7f61ed6ea6a99c4be563/artifacts/zodiacs-engine-0.1.1-rc.16.tgz'
    || provenance.version !== '0.1.1-rc.16' || provenance.license !== 'MIT AND CC-BY-4.0'
    || provenance.sourceCommit !== 'ddbbaa0b1d21e16834722f81e8708816849c6726'
    || provenance.sha256 !== '43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8') errors.push('Reference identity differs from rc16');
  const files = await readdir(directory, { recursive: true });
  const pages = files.filter((file) => file.endsWith('.html'));
  for (const required of ['index.html', 'modules.html', ...['engine','calc','crossings','deltat','geo','houses','receipt','sky','techniques','timing','vedic','window'].map((name) => `modules/${name}.html`)]) {
    if (!pages.includes(required)) errors.push(`Missing required reference page: ${required}`);
  }
  for (const path of pages) {
    const html = await readFile(join(directory, path), 'utf8');
    const canonical = path === 'index.html' ? base : new URL(path, base).href;
    if (!html.includes(`<link rel="canonical" href="${canonical}"/>`) || (html.match(/rel="canonical"/g) ?? []).length !== 1) errors.push(`${path}: incorrect canonical`);
    if (!html.includes('<meta name="robots" content="noindex,follow"/>')) errors.push(`${path}: missing noindex contract`);
    if (!html.includes('@zodiacs/engine 0.1.1-rc.16') || !html.includes('MIT AND CC-BY-4.0')) errors.push(`${path}: missing version or licence`);
    if (!html.includes(`href="${provenance.sourceRepository}/tree/${provenance.sourceCommit}"`)) errors.push(`${path}: missing pinned source link`);
    if (!html.includes('<footer><nav class="engine-sign-rail"') || !html.includes('/about/#editorial-system')) errors.push(`${path}: missing footer or editorial policy`);
    if (/href="[^"\s]*\/sdk\//.test(html)) errors.push(`${path}: reference links to historical SDK`);
    for (const [, value] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|data:|mailto:|javascript:)/.test(value)) continue;
      const url = new URL(value.replaceAll('&amp;', '&'), new URL(path, base));
      let target = join(root, decodeURIComponent(url.pathname));
      try {
        const info = await stat(target);
        if (info.isDirectory()) { target = join(target, 'index.html'); await stat(target); }
      } catch { errors.push(`${path}: missing local target ${value}`); continue; }
      if (url.hash) {
        const content = await readFile(target, 'utf8');
        if (!content.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`)) errors.push(`${path}: missing anchor ${value}`);
      }
    }
  }
  for (const name of ['LICENSE', 'LICENSING', 'NOTICE', 'README']) {
    const path = `release/${name}.txt`;
    try {
      const digest = createHash('sha256').update(await readFile(join(directory, path))).digest('hex');
      if (digest !== provenance.notices?.[path]) errors.push(`${path}: notice digest mismatch`);
    } catch { errors.push(`${path}: missing release document`); }
  }
  return { pages: pages.length, errors: [...new Set(errors)] };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../dist'));
  const result = await checkEngineReference(root);
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else console.log(`Engine reference output: PASS (${result.pages} pages; canonical, links, version, source identity, licences, notices and footer)`);
}
