import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_FOOTER_STYLESHEET } from './site-footer.mjs';

const marker = 'data-canonical-thesis-footer';
export function inlineThesisFooter(html, css) {
  if (/<\/style\b/i.test(css)) throw new Error('Canonical footer CSS cannot be embedded safely');
  for (const match of css.matchAll(/url\(\s*["']?([^"'\s)]+)/gi)) {
    if (!/^(?:\/|[a-z][a-z0-9+.-]*:|#)/i.test(match[1])) {
      throw new Error('Canonical footer CSS contains a relative asset URL');
    }
  }
  const inline = '<style ' + marker + '>' + css + '</style>';
  const links = html.split(SITE_FOOTER_STYLESHEET).length - 1;
  const embedded = html.split('<style ' + marker + '>').length - 1;
  if (links === 0 && embedded === 1 && html.includes(inline)) return html;
  if (links !== 1 || embedded !== 0) throw new Error('Unexpected thesis footer stylesheet shape');
  const at = html.indexOf(SITE_FOOTER_STYLESHEET);
  if (at < html.indexOf('<head>') || at > html.indexOf('</head>')) {
    throw new Error('Thesis footer stylesheet must be in the head');
  }
  return html.replace(SITE_FOOTER_STYLESHEET, inline);
}
export async function buildThesisFooter(repoRoot, { checkOnly = false } = {}) {
  const [canonical, published, built, html] = await Promise.all([
    readFile(resolve(repoRoot, 'src/styles/site-footer.css'), 'utf8'),
    readFile(resolve(repoRoot, 'public/assets/site-footer.css'), 'utf8'),
    readFile(resolve(repoRoot, 'dist/assets/site-footer.css'), 'utf8'),
    readFile(resolve(repoRoot, 'dist/thesis/index.html'), 'utf8'),
  ]);
  if (canonical !== published || canonical !== built) throw new Error('Canonical footer stylesheet copies differ');
  const output = inlineThesisFooter(html, canonical);
  if (checkOnly && html !== output) throw new Error('Built thesis footer stylesheet is not inline');
  if (!checkOnly && output !== html) await writeFile(resolve(repoRoot, 'dist/thesis/index.html'), output);
  console.log('thesis footer: exact canonical CSS inline at the original cascade position');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildThesisFooter(fileURLToPath(new URL('../', import.meta.url)), {
    checkOnly: process.argv.includes('--check'),
  });
}
