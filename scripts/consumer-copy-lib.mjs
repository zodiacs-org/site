const METHOD_FIRST_PATHS = [
  '/methodology/',
  '/privacy/',
  '/terms/',
  '/corrections/',
  '/registry/',
  '/archive/',
  '/thesis/',
  '/sdk/',
  // Source-pinned API comments are technical documentation, like /sdk/.
  '/developers/engine/reference/',
  '/learn/glossary/',
];

const BACKSTAGE_PATTERNS = [
  ['AI-operated', /\bAI[- ]operated\b/iu],
  ['versioned templates', /\bversioned (?:interpretation )?templates?\b/iu],
  ['generation mode', /\bgeneration mode\b/iu],
  ['source hash', /\bsource hashes?\b/iu],
  ['fail-closed', /\bfail[- ]closed\b/iu],
  ['noon-UTC snapshot', /\bnoon[- ]UTC snapshot\b/iu],
  ['proportionate to the evidence', /\bproportionate to (?:the )?evidence\b/iu],
  ['source receipt', /\bsource receipts?\b/iu],
  ['computed from the real sky', /\bcomputed from the real sky\b/iu],
  ['committed calculation', /\bcommitted calculation\b/iu],
  ['deterministic publishing language', /\bdeterministic (?:astronomical (?:calculation|computation)|renderer|template|pipeline|generation)\b/iu],
];

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/giu, ' ')
    .replace(/&(?:amp|#38);/giu, '&')
    .replace(/&(?:quot|#34);/giu, '"')
    .replace(/&(?:apos|#39);/giu, "'")
    .replace(/&#x201[89];/giu, "'")
    .replace(/&#x201[34];/giu, '—');
}

function removeClosedDetails(html) {
  const tokenPattern = /<\/?details\b[^>]*>/giu;
  const stack = [];
  let hiddenDepth = 0;
  let cursor = 0;
  let visible = '';
  let match;

  while ((match = tokenPattern.exec(html)) !== null) {
    if (hiddenDepth === 0) visible += html.slice(cursor, match.index);
    const token = match[0];

    if (/^<\/details/iu.test(token)) {
      const entry = stack.pop();
      if (entry?.hidden) hiddenDepth -= 1;
      else if (hiddenDepth === 0) visible += token;
    } else {
      const attributes = token.replace(/^<details\b|>$/giu, '');
      const closed = !/(?:^|\s)open(?:\s|=|$)/iu.test(attributes);
      const entry = { hidden: hiddenDepth > 0 || closed };
      stack.push(entry);
      if (entry.hidden) hiddenDepth += 1;
      else visible += token;
    }

    cursor = tokenPattern.lastIndex;
  }

  if (hiddenDepth === 0) visible += html.slice(cursor);
  return visible;
}

export function isMethodFirstPath(path) {
  return METHOD_FIRST_PATHS.some((prefix) => path === prefix || path.startsWith(prefix));
}

export function consumerFacingText(html) {
  const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head>/iu)?.[0] ?? '';
  const body = html.match(/<body\b[^>]*>[\s\S]*?<\/body>/iu)?.[0] ?? html;
  const contentBody = body
    .replace(/<!--([\s\S]*?)-->/gu, ' ')
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/giu, ' ');
  const visibleBody = removeClosedDetails(contentBody)
    .replace(/<[^>]+>/gu, ' ');
  return decodeEntities(`${head} ${visibleBody}`).replace(/\s+/gu, ' ').trim();
}

export function backstageCopyMatches(html, path) {
  if (isMethodFirstPath(path)) return [];
  const text = consumerFacingText(html);
  return BACKSTAGE_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
}
