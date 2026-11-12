/**
 * Rendered-copy dash gate. AGENTS.md: "No em dashes or en dashes in copy."
 *
 * The MCP tools already rewrite their output through plainDashes()
 * (src/ai-tools/plain-text.ts). This gate covers the web surfaces that the
 * 12 November 2026 copy audit found carrying dashes and that have since been
 * fixed, so they cannot come back unnoticed:
 *
 *   - the Astrofolio navigation description, on every page (its title,
 *     aria-description and mobile-menu line);
 *   - every /people/ page: title, meta, structured data and all body text,
 *     including the closed evidence panel;
 *   - the /lunar-return/ and /numerology/ titles (and their search entries);
 *   - the /corrections/ body;
 *   - the daily publication's lines, which /today/ and /profile/ print.
 *
 * Other surfaces still carry dashes on purpose or await a decision (the
 * Russian locale, legal and disclosure keys, wing pages, OG images, the
 * empty-value glyph), so the gate is scoped rather than site-wide. Widen
 * DASH_GATED_PAGES as each surface is cleaned.
 */

const DASH = /[\u2013\u2014]/u;

/** Pages whose whole text (head, structured data, body) must carry no dash. */
const WHOLE_PAGE_PREFIXES = ['/people/'];
/** Pages whose visible body must carry no dash. */
const BODY_PAGES = new Set(['/corrections/']);
/** Pages whose title, og:title and twitter:title must carry no dash. */
const TITLE_PAGES = new Set(['/lunar-return/', '/numerology/']);

export const DASH_GATED_PAGES = Object.freeze({
  wholePagePrefixes: WHOLE_PAGE_PREFIXES,
  bodyPages: [...BODY_PAGES],
  titlePages: [...TITLE_PAGES],
});

function decode(value) {
  return value
    .replace(/&nbsp;/giu, ' ')
    .replace(/&ndash;|&#8211;|&#x2013;/giu, '\u2013')
    .replace(/&mdash;|&#8212;|&#x2014;/giu, '\u2014')
    .replace(/&(?:amp|#38);/giu, '&')
    .replace(/&(?:quot|#34);/giu, '"')
    .replace(/&(?:apos|#39);/giu, "'");
}

function snippets(label, text) {
  const out = [];
  const pattern = /[\u2013\u2014]/gu;
  let match;
  while ((match = pattern.exec(text)) !== null && out.length < 3) {
    const around = text.slice(Math.max(0, match.index - 40), match.index + 40).replace(/\s+/gu, ' ').trim();
    out.push(`${label}: …${around}…`);
  }
  return out;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'iu'));
  return match ? decode(match[1]) : null;
}

function bodyText(html) {
  const body = html.match(/<body\b[^>]*>[\s\S]*<\/body>/iu)?.[0] ?? html;
  return decode(body
    .replace(/<!--[\s\S]*?-->/gu, ' ')
    .replace(/<(script|style|svg|template)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ')
    .replace(/<[^>]+>/gu, ' '));
}

function headTexts(html) {
  const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/iu)?.[0] ?? '';
  const texts = [];
  const title = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu);
  if (title) texts.push(['title', decode(title[1])]);
  for (const meta of head.matchAll(/<meta\b[^>]*>/giu)) {
    const key = attribute(meta[0], 'name') ?? attribute(meta[0], 'property');
    const content = attribute(meta[0], 'content');
    if (key && content !== null) texts.push([`meta ${key}`, content]);
  }
  return texts;
}

function jsonLdTexts(html) {
  return [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/giu)]
    .map((match) => ['JSON-LD', match[1].replace(/\\u2013/giu, '\u2013').replace(/\\u2014/giu, '\u2014')]);
}

/** The Astrofolio navigation description: chip title, aria-description, mobile line. */
function navigationDescriptionTexts(html) {
  const texts = [];
  for (const link of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/giu)) {
    const tag = link[0].match(/^<a\b[^>]*>/iu)[0];
    const href = attribute(tag, 'href') ?? '';
    const ariaDescription = attribute(tag, 'aria-description');
    if (ariaDescription !== null) texts.push(['nav aria-description', ariaDescription]);
    if (!/\/astrofolio\/$/u.test(href)) continue;
    if (ariaDescription !== null || /mobile-menu__link/u.test(attribute(tag, 'class') ?? '')) {
      const title = attribute(tag, 'title');
      if (title !== null) texts.push(['nav title', title]);
      texts.push(['nav text', decode(link[0].replace(/<[^>]+>/gu, ' '))]);
    }
  }
  return texts;
}

/** Dash findings for one built HTML page at a site path such as /people/ada-lovelace/. */
export function renderedDashMatches(html, path) {
  const texts = [...navigationDescriptionTexts(html)];
  if (WHOLE_PAGE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    texts.push(...headTexts(html), ...jsonLdTexts(html), ['body', bodyText(html)]);
  } else if (TITLE_PAGES.has(path)) {
    texts.push(...headTexts(html).filter(([label]) => /^(?:title|meta (?:og|twitter):title)$/u.test(label)));
  } else if (BODY_PAGES.has(path)) {
    texts.push(['body', bodyText(html)]);
  }
  return texts.flatMap(([label, text]) => (DASH.test(text) ? snippets(label, text) : []));
}

/** Search entries for the gated pages: their titles and descriptions. */
export function searchIndexDashMatches(entries) {
  return entries
    .filter((entry) => TITLE_PAGES.has(entry.path) || BODY_PAGES.has(entry.path)
      || WHOLE_PAGE_PREFIXES.some((prefix) => entry.path?.startsWith(prefix)))
    .flatMap((entry) => Object.entries(entry)
      .filter(([, value]) => typeof value === 'string' && DASH.test(value))
      .map(([key, value]) => `${entry.path} ${key}: ${value}`));
}

/** Every line the daily publication prints (headline, lines, the Sun-sign line). */
export function dailyPublicationDashMatches(publication) {
  const found = [];
  for (const entry of publication.signs ?? []) {
    const printed = [
      ['headline', entry.headline],
      ['todayLine', entry.todayLine?.text],
      ...(entry.lines ?? []).map((line, index) => [`lines[${index}]`, line.text]),
    ];
    for (const [key, value] of printed) {
      if (typeof value === 'string' && DASH.test(value)) found.push(`${entry.sign} ${key}: ${value}`);
    }
  }
  return found;
}
