import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://zodiacs.org';
// Every href, src and srcset value, quoted either way or bare, is resolved against
// its page. A link to zodiacs.org must reach a file in the build; any other link
// must be HTTPS to a host the reference is built to name. A bare file name that the
// Markdown renderer once linkified became http://LICENSING.md, a host on the .md
// domain anyone could register.
const EXTERNAL_HOSTS = new Set(['github.com', 'raw.githubusercontent.com', 'developer.mozilla.org']);
const LINK_ATTRIBUTE = /\b(href|src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
// The engine's documentation carries no token, market or ownership framing (G1,
// F-21). A bare "token" is not matched: an API reference can use the word for a
// cancellation or format token. Nor is a bare "crypto", which can be the Web
// Crypto API that verifies a digest; its market senses are.
const TOKEN_WORDS = /\b(?:NFTs?|cryptocurrenc(?:y|ies)|crypto[- ](?:assets?|coins?|exchanges?|markets?|tokens?|wallets?)|blockchains?|wallets?|Astrofolio|Solana|Ethereum|minted|minting|airdrops?|on-?chain|web3)\b/i;

/** A decoded URI component, or null where an escape is malformed. */
function decoded(text) {
  try { return decodeURIComponent(text); } catch { return null; }
}

function linkValues(html) {
  return [...html.matchAll(LINK_ATTRIBUTE)].flatMap((match) => {
    const value = (match[2] ?? match[3] ?? match[4]).replaceAll('&amp;', '&');
    return match[1].toLowerCase() === 'srcset'
      ? value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean)
      : [value];
  });
}

export async function checkEngineReference(root) {
  const directory = join(root, 'developers/engine/reference');
  const base = `${SITE}/developers/engine/reference/`;
  const errors = [];
  let provenance;
  try { provenance = JSON.parse(await readFile(join(directory, 'provenance.json'), 'utf8')); }
  catch { return { pages: 0, errors: ['Missing or invalid reference provenance'] }; }
  if (provenance.sourceRepository !== 'https://github.com/zodiacs-org/engine'
    || provenance.artifactUrl !== 'https://raw.githubusercontent.com/zodiacs-org/engine/b080217c1b5b0b36c931e9c237bcff0308ec1efc/artifacts/zodiacs-engine-0.1.1-rc.17.tgz'
    || provenance.version !== '0.1.1-rc.17' || provenance.license !== 'MIT AND CC-BY-4.0'
    || provenance.sourceCommit !== 'aae419c05b77455b9e8f03ca11ee273b446f7d02'
    || provenance.sha256 !== '9cd24c788863424ef614aaadec580db5a0dfc529303d385274db48a092a5299a') errors.push('Reference identity differs from rc17');
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
    if (!html.includes('@zodiacs/engine 0.1.1-rc.17') || !html.includes('MIT AND CC-BY-4.0')) errors.push(`${path}: missing version or licence`);
    if (!html.includes(`href="${provenance.sourceRepository}/tree/${provenance.sourceCommit}"`)) errors.push(`${path}: missing pinned source link`);
    if (!html.includes('<footer><nav class="engine-sign-rail"') || !html.includes('/about/#editorial-system')) errors.push(`${path}: missing footer or editorial policy`);
    const tokenWord = TOKEN_WORDS.exec(html);
    if (tokenWord) errors.push(`${path}: token or market wording "${tokenWord[0]}"`);
    for (const value of linkValues(html)) {
      if (/^\s*(?:data|mailto):/i.test(value)) continue;
      let url;
      try { url = new URL(value.trim(), new URL(path, base)); }
      catch { errors.push(`${path}: invalid link ${value}`); continue; }
      // The historical token SDK, on this site or on any host (its repository too).
      if (/(?:^|\/)sdk(?:\/|$)/i.test(url.pathname)) errors.push(`${path}: reference links to historical SDK`);
      if (url.origin !== SITE) {
        if (url.protocol !== 'https:' || !EXTERNAL_HOSTS.has(url.hostname)) errors.push(`${path}: unexpected external link ${value}`);
        continue;
      }
      const pathname = decoded(url.pathname);
      if (pathname === null) { errors.push(`${path}: malformed link ${value}`); continue; }
      let target = join(root, pathname);
      try {
        const info = await stat(target);
        if (info.isDirectory()) { target = join(target, 'index.html'); await stat(target); }
      } catch { errors.push(`${path}: missing local target ${value}`); continue; }
      if (url.hash) {
        const content = await readFile(target, 'utf8');
        const anchor = decoded(url.hash.slice(1));
        if (anchor === null || !content.includes(`id="${anchor}"`)) errors.push(`${path}: missing anchor ${value}`);
      }
    }
  }
  for (const name of ['LICENSE', 'LICENSING', 'NOTICE', 'README']) {
    const path = `release/${name}.txt`;
    try {
      const bytes = await readFile(join(directory, path));
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== provenance.notices?.[path]) errors.push(`${path}: notice digest mismatch`);
      const tokenWord = TOKEN_WORDS.exec(bytes.toString('utf8'));
      if (tokenWord) errors.push(`${path}: token or market wording "${tokenWord[0]}"`);
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
