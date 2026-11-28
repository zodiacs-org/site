/*
 * Spaces that Astro's whitespace compression drops (compressHTML "jsx", Astro 7's default).
 *
 *   node scripts/astro-inline-spacing.mjs [files or folders, default src]
 *
 * In "jsx" mode Astro removes any run of whitespace that contains a line break
 * where it meets an element or an expression, as JSX does. So in
 *
 *   computed from Mercury’s actual motion,
 *   <a href="/learn/glossary/#station">station to station</a>
 *
 * the reader gets "motion,station to station": the line break that HTML would
 * show as a space is gone. Keep the words and the element on one line, or end
 * the line with {' '}.
 *
 * This reads each .astro template's markup with Astro's own parser and reports
 * every place where text meets an inline element or an expression across a
 * line break and nothing else supplies the space: neither the expression's own
 * text (a string that starts or ends with a space, {' '}) nor the element's
 * first or last text. A boundary before closing punctuation (a comma, a full
 * stop, a closing bracket or quote) or after an opening one is left alone,
 * since no space belongs there.
 */
import { parse } from '@astrojs/compiler-rs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Phrasing elements whose neighbouring text runs on the same line. */
export const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 's', 'samp',
  'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var',
]);
const RAW_TEXT = new Set(['script', 'style', 'pre', 'textarea']);
const CLOSING = /^[,.;:!?)\]}’”…%]/u;
const OPENING = /[([{“‘]$/u;

function elementName(node) {
  const name = node.openingElement.name;
  return name.type === 'JSXIdentifier' ? name.name : '';
}

/**
 * Whether an expression's output is sure to begin (side 'start') or end (side 'end') with whitespace,
 * or to be empty, so it needs no space from its neighbour. Anything else, a variable or a call, may
 * not, and counts as text.
 */
function suppliesSpace(node, side) {
  if (!node) return true;
  switch (node.type) {
    case 'JSXEmptyExpression':
      return true;
    case 'Literal':
      if (typeof node.value === 'string') return node.value === '' || (side === 'start' ? /^\s/u : /\s$/u).test(node.value);
      return node.value === null || node.value === false;
    case 'Identifier':
      return node.name === 'undefined';
    case 'TemplateLiteral': {
      const quasis = node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw);
      if (node.expressions.length === 0) return suppliesSpace({ type: 'Literal', value: quasis.join('') }, side);
      return (side === 'start' ? /^\s/u : /\s$/u).test(side === 'start' ? quasis[0] : quasis[quasis.length - 1]);
    }
    case 'ConditionalExpression':
      return suppliesSpace(node.consequent, side) && suppliesSpace(node.alternate, side);
    case 'LogicalExpression':
      // `a && b` renders b or nothing (a false or empty test); `a || b` and `a ?? b` render either.
      return node.operator === '&&' ? suppliesSpace(node.right, side) : suppliesSpace(node.left, side) && suppliesSpace(node.right, side);
    case 'ParenthesizedExpression':
      return suppliesSpace(node.expression, side);
    case 'JSXExpressionContainer':
      return suppliesSpace(node.expression, side);
    case 'JSXText':
      return (side === 'start' ? /^\s/u : /\s$/u).test(node.value);
    case 'JSXFragment':
    case 'JSXElement': {
      const children = (node.children ?? []).filter((child) => !(child.type === 'JSXExpressionContainer' && child.expression?.type === 'JSXEmptyExpression'));
      if (children.length === 0) return node.type === 'JSXFragment';
      return suppliesSpace(side === 'start' ? children[0] : children[children.length - 1], side);
    }
    default:
      return false;
  }
}

/** A sibling that runs on the same line as text: an inline element, a component, an expression or a fragment. */
function inlineNeighbour(node) {
  if (!node) return false;
  if (node.type === 'JSXExpressionContainer') return node.expression?.type !== 'JSXEmptyExpression';
  if (node.type === 'JSXFragment') return true;
  if (node.type === 'JSXElement') {
    const name = elementName(node);
    return name === '' || /^[A-Z]/u.test(name) || INLINE_ELEMENTS.has(name);
  }
  return false;
}

/** The places in one template where a space a reader expects is dropped. */
export function droppedSpaces(source) {
  const { ast } = parse(source);
  const found = [];
  const lineOf = (offset) => source.slice(0, offset).split('\n').length;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (node.type === 'JSXElement' && RAW_TEXT.has(elementName(node))) return;
    if (Array.isArray(node.children)) {
      const children = node.children.filter((child) => !(child.type === 'JSXExpressionContainer' && child.expression?.type === 'JSXEmptyExpression'));
      children.forEach((child, index) => {
        if (child.type !== 'JSXText' || !/\S/u.test(child.value)) return;
        const text = child.value.trim().replace(/\s+/gu, ' ');
        const leading = child.value.match(/^\s*/u)[0];
        const trailing = child.value.match(/\s*$/u)[0];
        const before = children[index - 1];
        const after = children[index + 1];
        if (leading.includes('\n') && inlineNeighbour(before) && !CLOSING.test(text) && !suppliesSpace(before, 'end')) {
          found.push({ line: lineOf(child.start), text: `… ${text.slice(0, 40)}` });
        }
        if (trailing.includes('\n') && inlineNeighbour(after) && !OPENING.test(text) && !suppliesSpace(after, 'start')) {
          found.push({ line: lineOf(child.end), text: `${text.slice(-40)} …` });
        }
      });
    }
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === 'object' && key !== 'openingElement' && key !== 'closingElement') visit(value);
    }
  };
  visit(ast.body);
  return found;
}

async function astroFiles(path) {
  if (!(await stat(path)).isDirectory()) return path.endsWith('.astro') ? [path] : [];
  const files = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    files.push(...(await astroFiles(join(path, entry.name))));
  }
  return files.sort();
}

/** Every dropped space under the given files or folders, as `path:line text`. */
export async function scan(paths = [join(repo, 'src')]) {
  const report = [];
  for (const path of paths) {
    for (const file of await astroFiles(resolve(path))) {
      for (const { line, text } of droppedSpaces(await readFile(file, 'utf8'))) {
        report.push(`${relative(repo, file)}:${line} ${text}`);
      }
    }
  }
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = await scan(process.argv.length > 2 ? process.argv.slice(2) : undefined);
  if (report.length) {
    console.error(`astro-inline-spacing: ${report.length} line break(s) where Astro drops the space; end the line with {' '} or join the lines:\n  ${report.join('\n  ')}`);
    process.exit(1);
  }
  console.log('astro-inline-spacing: no dropped spaces');
}
