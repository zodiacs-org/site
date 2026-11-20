/*
 * What the English privacy and terms pages must and must not say, approved by
 * the owner on 20 November 2026 (card t826s5023):
 *
 * - /privacy/ names the extra script a chart without a birth time loads, says
 *   which pages load Plausible, and heads its assistant section with a plain
 *   name instead of "AI integration candidates".
 * - /privacy/ and /terms/ no longer carry the Registry's wallet, address
 *   lookup, market-data and purchase disclosures. /disclosure/ and the
 *   Registry pages themselves are unchanged, and the translated privacy pages
 *   keep theirs until they are revised.
 *
 * scripts/check-dist.mjs runs legalPageProblems over the built pages (the
 * <main> element only, so the shared navigation and footer are not read), and
 * scripts/legal-pages-copy.test.mjs runs it over the Astro sources.
 */

const PRIVACY_REQUIRED = Object.freeze([
  'id="ai-integrations"',
  '>The Zodiacs app</h2>',
  'a file of historical clock changes chosen by the birthplace’s time zone',
  'when no birth time is given, one more script, which shows our host only that no time was entered',
  'None of these requests goes to any other service.',
  'load Plausible, the site’s analytics',
  'href="/about/"',
  'Plausible, a cookieless analytics service',
]);

const PRIVACY_FORBIDDEN = Object.freeze([
  'AI integration candidates',
  'public-sky ChatGPT candidate',
  'hosted candidate',
  'Cabinet of Twelve',
  'public wallet',
  'Wallet Chart',
  'blockchain',
  'PublicNode',
  'Allnodes',
  'Etherscan',
  'Solana',
  'Dex Screener',
  'GeckoTerminal',
  'market data',
  'market-data',
  'Public Astrofolio, Terminal, and Registry data sources',
  'Aura browser storage',
  'Remember this address on this device',
  'remembered Aura',
  'Aura session data',
  'does not connect wallets',
  'Purchase links',
  'purchase',
  'wallet software',
  'wallet connection',
]);

const TERMS_REQUIRED = Object.freeze([
  '>What this site is</h2>',
  '>Free use</h2>',
  '>Accounts</h2>',
  '>Acceptable use</h2>',
  '>Accuracy and availability</h2>',
  '>Limitation of liability</h2>',
  '>Content and intellectual property</h2>',
  '>Changes</h2>',
  '>Operator and applicable law</h2>',
  '>Contact</h2>',
]);

const TERMS_FORBIDDEN = Object.freeze([
  'Cabinet of Twelve',
  'public addresses',
  'Public address lookups',
  'means in the Registry',
  '“official,”',
  'Digital-asset risks',
  'Digital assets can be',
  'does not connect wallets',
  'request signatures',
  'submit transactions',
  'Purchase links',
  'purchase links',
  'Blockchain transactions',
  'total loss',
  'solicitation',
  'operator attestation',
  'href="/disclosure/"',
]);

/** Each page's rules. */
export const LEGAL_PAGE_RULES = Object.freeze({
  '/privacy/': Object.freeze({ required: PRIVACY_REQUIRED, forbidden: PRIVACY_FORBIDDEN }),
  '/terms/': Object.freeze({ required: TERMS_REQUIRED, forbidden: TERMS_FORBIDDEN }),
});

const NAMED = { amp: '&', apos: '’', quot: '"', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', nbsp: ' ' };

/**
 * One comparable string from built HTML or an Astro source: entities decoded,
 * straight apostrophes curled (Astro escapes them in expressions, and the
 * sources write both), and whitespace collapsed. Markup is kept, so a rule can
 * name an attribute or a closing tag.
 */
export function normalizeLegalHtml(html) {
  return html
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (entity, body) => {
      if (body[0] === '#') {
        const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));
        return String.fromCodePoint(code);
      }
      return NAMED[body.toLowerCase()] ?? entity;
    })
    .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
    .replace(/\s+/gu, ' ');
}

/** The <main> element of a built page, where the page's own copy is. */
export function mainOf(html) {
  const match = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/u);
  return match ? match[1] : '';
}

/** Problems with one page's copy; an empty list means it holds. */
export function legalPageProblems(path, html) {
  const rules = LEGAL_PAGE_RULES[path];
  if (!rules) throw new Error(`legal-pages-copy: no rules for ${path}`);
  const text = normalizeLegalHtml(html);
  const problems = [];
  for (const phrase of rules.required) {
    if (!text.includes(phrase)) problems.push(`${path}: missing ${JSON.stringify(phrase)}`);
  }
  for (const phrase of rules.forbidden) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) problems.push(`${path}: still carries ${JSON.stringify(phrase)}`);
  }
  return problems;
}
