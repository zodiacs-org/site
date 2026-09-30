// Keep the navigation on hand-authored wing pages in step with the generated
// profiles and hub. Only the established nav regions are replaced; page
// content and its other scripts stay hand-authored.
import { readFile, writeFile } from 'node:fs/promises';
import { wingNavHtml, wingNavCss, wingNavScript } from './wing-nav.mjs';

const pages = ['public/thesis/index.html', 'public/sdk/index.html', 'public/terminal/markets/index.html'];
const stylePages = ['public/astrofolio/index.html', 'public/terminal/index.html', 'public/registry/technical/index.html'];
const check = process.argv.includes('--check');

function divEnd(source, start) {
  let depth = 0;
  const tags = /<\/?div\b[^>]*>/g;
  tags.lastIndex = start;
  for (let match; (match = tags.exec(source));) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  throw new Error('Navigation div is incomplete');
}

function replaceIife(source, needle, replacement) {
  const at = source.indexOf(needle);
  if (at < 0) throw new Error(`Navigation script missing: ${needle}`);
  const start = source.lastIndexOf('(function(){', at);
  const end = source.indexOf('})();', at) + 5;
  if (start < 0 || end < at) throw new Error('Navigation script boundary missing');
  return source.slice(0, start) + replacement + source.slice(end);
}

for (const page of [...pages, ...stylePages]) {
  const url = new URL(`../${page}`, import.meta.url);
  const source = await readFile(url, 'utf8');
  let output = source;
  if (pages.includes(page)) {
    const navStart = output.indexOf('<div class="wnav-wrap">');
    if (navStart < 0) throw new Error(`${page}: navigation markup missing`);
    const menuStart = output.indexOf('<div class="wnav-menu"', divEnd(output, navStart));
    if (menuStart < 0) throw new Error(`${page}: mobile navigation missing`);
    output = output.slice(0, navStart) + wingNavHtml() + output.slice(divEnd(output, menuStart));
  }

  const cssStart = output.indexOf('.wnav-wrap {');
  const lastRule = '@media (max-width: 599.5px) and (prefers-reduced-motion: reduce) { .wnav-wrap { transition: none; } }';
  const cssEnd = output.indexOf(lastRule, cssStart) + lastRule.length;
  if (cssStart < 0 || cssEnd < cssStart) throw new Error(`${page}: navigation styles missing`);
  const css = wingNavCss();
  output = output.slice(0, cssStart) + css.slice(css.indexOf('.wnav-wrap {')).trim() + output.slice(cssEnd);

  // The phone-scroll controller already has a separate slot on these pages.
  // Keep exactly one copy rather than adding another scroll listener.
  const script = wingNavScript();
  const phoneStart = script.indexOf('(function(){', script.indexOf('})();') + 5);
  if (pages.includes(page)) {
    output = replaceIife(output, "var wrap = document.querySelector('[data-wnav]')", script.slice(0, phoneStart).trim());
    output = replaceIife(output, "var nav = document.querySelector('[data-wnav]');", script.slice(phoneStart).trim());
  }
  if (output === source) continue;
  if (check) throw new Error(`${page}: navigation is out of date; run node scripts/sync-wing-navigation.mjs`);
  await writeFile(url, output);
  console.log(`navigation: ${page}`);
}
