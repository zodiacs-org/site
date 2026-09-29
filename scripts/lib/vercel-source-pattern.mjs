/**
 * The regular expression Vercel compiles a vercel.json `source` into, for the
 * tests that reason about which headers and rewrites reach a path.
 *
 * Vercel compiles each source with path-to-regexp 6.1.0, strict and case
 * sensitive, with "/" as the delimiter (@vercel/routing-utils' sourceToRegex).
 * This is a port of that version's lexer, parser and regexp builder for the
 * syntax vercel.json uses: literal text, `:name`, `:name(pattern)`, an
 * unnamed `(pattern)`, and the `?`, `*` and `+` modifiers. The compiled
 * expressions `vercel build` wrote for this repository are recorded in
 * docs/platform/evidence/compute-api-2026-09-29/, and a test holds this port
 * to them.
 */

const escapeString = (value) => value.replace(/([.+*?=^!:${}()[\]|/\\])/gu, '\\$1');

function lexer(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '*' || char === '+' || char === '?') {
      tokens.push({ type: 'MODIFIER', value: text[i++] });
      continue;
    }
    if (char === '\\') {
      i += 1;
      tokens.push({ type: 'ESCAPED_CHAR', value: text[i++] });
      continue;
    }
    if (char === '{' || char === '}') throw new TypeError('Brace groups are not used in vercel.json and are not ported.');
    if (char === ':') {
      let name = '';
      let j = i + 1;
      while (j < text.length && /[0-9A-Za-z_]/u.test(text[j])) name += text[j++];
      if (!name) throw new TypeError(`Missing parameter name at ${i}`);
      tokens.push({ type: 'NAME', value: name });
      i = j;
      continue;
    }
    if (char === '(') {
      let count = 1;
      let pattern = '';
      let j = i + 1;
      if (text[j] === '?') throw new TypeError(`Pattern cannot start with "?" at ${j}`);
      while (j < text.length) {
        if (text[j] === '\\') {
          pattern += text[j++] + text[j++];
          continue;
        }
        if (text[j] === ')') {
          count -= 1;
          if (count === 0) {
            j += 1;
            break;
          }
        } else if (text[j] === '(') {
          count += 1;
          if (text[j + 1] !== '?') throw new TypeError(`Capturing groups are not allowed at ${j}`);
        }
        pattern += text[j++];
      }
      if (count) throw new TypeError(`Unbalanced pattern at ${i}`);
      if (!pattern) throw new TypeError(`Missing pattern at ${i}`);
      tokens.push({ type: 'PATTERN', value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: 'CHAR', value: text[i++] });
  }
  tokens.push({ type: 'END', value: '' });
  return tokens;
}

function parse(text) {
  const tokens = lexer(text);
  const prefixes = './';
  const defaultPattern = `[^${escapeString('/')}]+?`;
  const result = [];
  let key = 0;
  let i = 0;
  let path = '';
  const tryConsume = (type) => (i < tokens.length && tokens[i].type === type ? tokens[i++].value : undefined);
  while (i < tokens.length) {
    const char = tryConsume('CHAR');
    const name = tryConsume('NAME');
    const pattern = tryConsume('PATTERN');
    if (name || pattern) {
      let prefix = char || '';
      if (!prefixes.includes(prefix)) {
        path += prefix;
        prefix = '';
      }
      if (path) {
        result.push(path);
        path = '';
      }
      result.push({ name: name || key++, prefix, pattern: pattern || defaultPattern, modifier: tryConsume('MODIFIER') || '' });
      continue;
    }
    const value = char || tryConsume('ESCAPED_CHAR');
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = '';
    }
    if (tokens[i].type !== 'END') throw new TypeError(`Unexpected ${tokens[i].type}`);
    i += 1;
  }
  return result;
}

/** The regular expression source Vercel matches a vercel.json `source` with. */
export function sourceRegexSource(source) {
  let route = '^';
  for (const token of parse(source)) {
    if (typeof token === 'string') {
      route += escapeString(token);
      continue;
    }
    const prefix = escapeString(token.prefix);
    if (prefix) {
      if (token.modifier === '+' || token.modifier === '*') {
        const optional = token.modifier === '*' ? '?' : '';
        route += `(?:${prefix}((?:${token.pattern})(?:${prefix}(?:${token.pattern}))*))${optional}`;
      } else {
        route += `(?:${prefix}(${token.pattern}))${token.modifier}`;
      }
    } else {
      route += `(${token.pattern})${token.modifier}`;
    }
  }
  // Vercel writes the compiled expression with plain slashes, as
  // routing-utils does after path-to-regexp; the match is the same.
  return `${route}$`.replace(/\\\//gu, '/');
}

export function sourcePattern(source) {
  return new RegExp(sourceRegexSource(source));
}

/** Vercel applies every matching header rule in order; a later rule wins on the same key. */
export function effectiveHeaders(config, path) {
  const headers = new Map();
  for (const rule of config.headers ?? []) {
    if (!sourcePattern(rule.source).test(path)) continue;
    for (const { key, value } of rule.headers) headers.set(key.toLowerCase(), value);
  }
  return headers;
}

/** The header rules whose source matches a path, in order. */
export function matchingHeaderRules(config, path) {
  return (config.headers ?? []).filter((rule) => sourcePattern(rule.source).test(path));
}
