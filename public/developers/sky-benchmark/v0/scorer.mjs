/**
 * The scorer for the Zodiacs sky-fact benchmark, v0. No dependencies: it runs
 * in Node.js 18 or later and, imported as a module, in a browser whose
 * regular expressions have lookbehind, as every major browser's have since
 * Safari 16.4 in 2023.
 *
 *   node scorer.mjs replies.jsonl
 *
 * replies.jsonl holds one JSON object per line, {"id": "si-001", "reply": "…"},
 * with the reply exactly as the assistant gave it. items.json and key.json are
 * read from the folder this file is in. It prints the scores as JSON, and
 * names any id in the replies that is not a question.
 *
 * Each question asks for one answer in a fixed form. A reply is read strictly
 * and, only when that fails, leniently:
 *
 *   strict   its last non-empty line, without surrounding quotes, backticks,
 *            asterisks or underscores and without full stops or exclamation
 *            marks at its end, must be exactly one answer in that form: a
 *            sign's name (or its symbol), YES, NO or DEPENDS where the
 *            question allows them, or a date as YYYY-MM-DD;
 *   lenient  failing that, the whole reply, once any copy of the question or
 *            of its instruction is taken out, must name exactly one distinct
 *            answer of the allowed kinds. Below, the start of a line or a
 *            sentence is the start of a line, after any list marker such as
 *            "-" or "1.", or what follows . ! ? : or ; and a space, with any
 *            quotes or emphasis between, but not what follows an ellipsis;
 *            an ellipsis is … or two or more full stops.
 *            A sign counts wherever its name or symbol appears, except
 *            "Gemini" naming Google's assistant in these forms: "I am Gemini"
 *            or "I'm Gemini"; "As Gemini" at the start of a line or a
 *            sentence, before "I" or ", I"; "Google Gemini" or "Google's
 *            Gemini"; "Gemini" before Pro, Flash, Ultra, Nano, app, apps or
 *            model, or before "a model", "a language model", "a large model",
 *            "a large language model" or "an AI", on the same line, with or
 *            without a comma between; and "Gemini" before a version number on
 *            the same line, one digit with or without a point and one or two
 *            more, that is followed by Pro, Flash, Ultra or Nano, or by a
 *            comma, full stop, semicolon, exclamation or question mark,
 *            closing bracket or the end of the reply. So "Gemini 2.5 Pro" and
 *            "As Gemini 2.5, I" are the assistant, and "Gemini 12°", "Gemini
 *            3 days later", "Gemini 14:30", "Gemini, 1942 to 1949", "read as
 *            Gemini, I think", "Gemini" with "Pro tip" on the line below and
 *            a list's "Gemini" with the next item's number on the line below
 *            are the sign.
 *            YES and NO count only standing alone: followed, after any
 *            closing emphasis or quote, any space and any aside in brackets
 *            on the same line, by one of , ! ? ; : ) ] | — –, by a full stop
 *            that does not begin an ellipsis, by a hyphen with a space or
 *            another hyphen after it, by an ellipsis that ends the line, or
 *            by the end of a line; or, at the start of a line or a sentence,
 *            by ( or an ellipsis. So "no idea", "no-one", "there is no
 *            station", "no... certainty" and "no (direct) way" are not NO,
 *            and "No (it was direct) all day" opening a line, "the answer is
 *            no (it was direct)." and "the answer is no..." are.
 *            YES, NO and DEPENDS joined by "or", "nor", a slash or a bar with
 *            no space around it, with commas before the last and any quotes
 *            or emphasis around each, only list the choices and name none of
 *            them: "yes or no", "yes/no", "yes|no", "neither yes nor no",
 *            "YES, NO or DEPENDS". A "no" before such a list is not NO
 *            either: "there is no yes/no". A table's cells, "| NO | NO |",
 *            are not a list. "Yes and no" names both.
 *            DEPENDS counts as the word "depends". A date may also be written
 *            as 7 March 2023, 7th of March 2023, March 7, 2023, Mar. 7 2023,
 *            7 Sept 2023 or 2023/03/07, and a YYYY-MM-DD date may run on into
 *            a time. Two days joined by "or", "and", "to", "through", a dash
 *            or a slash, before one month and year, name two dates: "18 or 19
 *            March 2041", "18 March or 19 March 2041", "March 19–20, 2041".
 *            A day the month does not have is still one of the two, and
 *            never right, so "28 or 29 February 2041" reads as nothing. The
 *            first day must start the reply or follow a space, a bracket, a
 *            quote or emphasis, so "UTC+10 – 8 March 2023" names 8 March.
 *
 * A reply neither reading parses is unparsed, and counts as wrong. Letter
 * case never matters. The strict score is the benchmark's score. The lenient
 * one is a rough guide to how much of a gap is the form of the replies: a
 * stray "Yes," opening a reply still reads as YES, and a reply that names two
 * signs reads as nothing.
 */

export const SIGNS = Object.freeze(['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']);
const GLYPHS = Object.freeze(['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']);
const MONTHS = Object.freeze(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']);

/** What each kind of question accepts, and the instruction v0's questions end with. */
const KINDS = Object.freeze({
  sign: { signs: true, words: [], instruction: 'Answer with only the name of the sign.' },
  'sign-or-depends': {
    signs: true,
    words: ['DEPENDS'],
    instruction: 'If the answer depends on the time of day or the time zone, answer DEPENDS; otherwise answer with only the name of the sign.',
  },
  'yes-no-depends': {
    signs: false,
    words: ['YES', 'NO', 'DEPENDS'],
    instruction: 'If the answer depends on the time of day or the time zone, answer DEPENDS; otherwise answer YES or NO.',
  },
  date: { dates: true, instruction: 'Answer with only the date, as YYYY-MM-DD.' },
});
export const INSTRUCTIONS = Object.freeze(Object.fromEntries(Object.entries(KINDS).map(([kind, spec]) => [kind, spec.instruction])));

const pad = (value) => String(value).padStart(2, '0');

function isoOf(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`;
}

/** Quotes, emphasis and backticks that may surround a line, and what else may end one. */
const WRAPPING = new Set('*_`"\'“”‘’');
const ENDING = new Set('*_`"\'“”‘’.!');
const SPACE = /\s/u;

/**
 * A line without surrounding whitespace, quotes, emphasis, backticks or full
 * stops and exclamation marks at its end, taken off one character at a time
 * from each end so that a long run of them costs one pass.
 */
function bare(line) {
  let from = 0;
  let to = line.length;
  while (from < to && (WRAPPING.has(line[from]) || SPACE.test(line[from]))) from += 1;
  while (to > from && (ENDING.has(line[to - 1]) || SPACE.test(line[to - 1]))) to -= 1;
  return line.slice(from, to);
}

const VARIATION_SELECTORS = /[︎️]/gu;

function strictValue(kind, line) {
  const spec = KINDS[kind];
  const text = bare(line).replace(VARIATION_SELECTORS, '');
  if (spec.dates) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(text);
    return match ? isoOf(match[1], match[2], match[3]) : null;
  }
  const upper = text.toUpperCase();
  if (spec.words.includes(upper)) return upper;
  if (spec.signs) {
    const index = SIGNS.findIndex((sign) => sign.toUpperCase() === upper);
    if (index >= 0) return SIGNS[index];
    const glyph = GLYPHS.indexOf(text);
    if (glyph >= 0) return SIGNS[glyph];
  }
  return null;
}

const MONTH_NAMES = `(${MONTHS.map((name) => (name === 'september' ? 'september|sept\\.?|sep\\.?' : `${name}|${name.slice(0, 3)}\\.?`)).join('|')})`;
const monthNumber = (word) => MONTHS.findIndex((name) => word.toLowerCase().startsWith(name.slice(0, 3))) + 1;
/** What joins two days: "or", "and", "to" or "through", a dash or a slash. */
const JOINED = '(?:\\s*,?\\s+(?:or|and|to|through)\\s+(?:the\\s+)?|\\s*[-–—/]\\s*)';
/** A day of a hedge that its month does not have: still one of the hedge's two dates, and never a right one. */
const NO_SUCH_DAY = Object.freeze(['no such first day', 'no such second day']);

/** Every date the reply writes in one of the accepted forms, as YYYY-MM-DD. */
function datesIn(text) {
  const found = [];
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})(?!\d)/gu)) found.push(isoOf(match[1], match[2], match[3]));
  for (const match of text.matchAll(/\b(\d{4})\/(\d{1,2})\/(\d{1,2})(?!\d)/gu)) found.push(isoOf(match[1], match[2], match[3]));
  for (const match of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_NAMES}\\s*,?\\s+(\\d{4})\\b`, 'giu'))) {
    found.push(isoOf(match[3], monthNumber(match[2]), match[1]));
  }
  for (const match of text.matchAll(new RegExp(`\\b${MONTH_NAMES}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s+(\\d{4})\\b`, 'giu'))) {
    found.push(isoOf(match[3], monthNumber(match[1]), match[2]));
  }
  // Two days before one month and year: "18 or 19 March 2041" and "18 March or 19 March 2041" name both days. The first
  // starts the text or follows a space, a bracket, a quote or emphasis, so "UTC+10 – 8 March 2023" names only the 8th.
  for (const match of text.matchAll(new RegExp(`(?:^|[\\s(\\[{"'“‘*_\`])(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(?:of\\s+)?${MONTH_NAMES})?${JOINED}(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_NAMES}\\s*,?\\s+(\\d{4})\\b`, 'giu'))) {
    found.push(isoOf(match[5], monthNumber(match[2] ?? match[4]), match[1]) ?? NO_SUCH_DAY[0], isoOf(match[5], monthNumber(match[4]), match[3]) ?? NO_SUCH_DAY[1]);
  }
  // "March 19 or 20, 2041" and "March 19 or March 20, 2041" name both days.
  for (const match of text.matchAll(new RegExp(`\\b${MONTH_NAMES}\\s+(\\d{1,2})(?:st|nd|rd|th)?${JOINED}(?:${MONTH_NAMES}\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s+(\\d{4})\\b`, 'giu'))) {
    found.push(isoOf(match[5], monthNumber(match[1]), match[2]) ?? NO_SUCH_DAY[0], isoOf(match[5], monthNumber(match[3] ?? match[1]), match[4]) ?? NO_SUCH_DAY[1]);
  }
  return found.filter(Boolean);
}

const collapse = (text) => text.replace(/\s+/gu, ' ').trim();
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/**
 * The reply with every copy of the question and of its instruction taken out,
 * however its lines are wrapped. Line ends outside the copies are kept.
 */
function withoutEchoes(text, echoes) {
  let out = text;
  for (const echo of echoes.map(collapse).filter((value) => value.length > 0).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(echo.split(' ').map(escape).join('\\s+'), 'giu'), ' ');
  }
  return out;
}

/** Emphasis or quotes that may open a word, and that may close one. */
const OPEN = '[*_`"\'“‘]*';
const CLOSE = '[*_`"\'”’]*';
/** Spaces within a line. */
const GAP = '[^\\S\\r\\n]';
/**
 * The start of a line, after any list marker, or of a sentence, after . ! ? :
 * or ; and a space, but not after an ellipsis; for a pattern with the m flag.
 */
const STARTS = `(?:^${GAP}*(?:[-*+•]${GAP}+|\\d{1,2}[.)]${GAP}+)?|(?:[!?:;]|(?<!\\.)\\.)${CLOSE}\\s+)${OPEN}`;
/**
 * Google's assistant naming itself, in the forms the header lists, which is
 * not the sign. No two quantifiers here can share a run of spaces, so a long
 * run is read once.
 */
const ASSISTANT_NAME = new RegExp([
  "\\b(?:i\\s+am|i'm|i’m)\\s+gemini\\b",
  `${STARTS}as\\s+gemini\\b(?=\\s*(?:,\\s*)?i\\b)`,
  "\\bgoogle(?:'s|’s)?\\s+gemini\\b",
  // Before a version on the same line, then a model's name or the end of a clause or the reply; or before a model's name, "a model" or
  // "an AI" on the same line.
  `\\bgemini(?=${GAP}+\\d(?:\\.\\d{1,2})?(?!\\.?\\d)(?:\\s+(?:pro|flash|ultra|nano)\\b|\\s*(?:[,.;!?)\\]]|(?![\\s\\S])))`
    + `|${GAP}*(?:,${GAP}*)?(?:pro\\b|flash\\b|ultra\\b|nano\\b|app\\b|apps\\b|model\\b|a${GAP}+(?:large${GAP}+)?(?:language${GAP}+)?model\\b|an${GAP}+ai\\b))`,
].join('|'), 'gimu');

/** After YES or NO, on its line: closing emphasis or quotes, spaces, and perhaps an aside in brackets. */
const TRAIL = `${CLOSE}${GAP}*(?:\\([^()\\n]*\\)${CLOSE}${GAP}*)?`;
/**
 * What may follow YES or NO standing alone: one of these marks, a full stop
 * that does not begin an ellipsis, a hyphen before a space or another hyphen,
 * an ellipsis (… or two or more full stops) that ends the line, or the end of
 * the line.
 */
const ENDS = `(?:[,!?;:)\\]|—–]|\\.(?!\\.)|-[-\\s]|(?:…|\\.{2,})${CLOSE}${GAP}*$|$)`;
/** YES or NO standing alone, as the header says; at the start of a line or a sentence, also before ( or an ellipsis. */
const STANDALONE = (word) => new RegExp(
  `\\b${word}\\b(?=${TRAIL}${ENDS})|${STARTS}${word}\\b(?=${CLOSE}\\s*(?:[(…]|\\.\\.))`,
  'imu',
);

/**
 * The answer words joined by "or", "nor", a slash or a bar with no space
 * around it only list the choices, and name none of them; a table's cells,
 * "| NO | NO |", are not a list. "Yes and no" names both. A list is matched
 * only from its first word, after any opening marks, so the search does not
 * start again at every word or mark of a long run.
 */
const WORD = `${OPEN}\\b(?:yes|no|depends)\\b${CLOSE}`;
const CHOICES = new RegExp(
  `(?<![*_\`"'“‘])${OPEN}\\b(?:yes|no|depends)\\b(?<!\\b(?:yes|no|depends)\\b${CLOSE}\\s*,\\s*${OPEN}(?:yes|no|depends))${CLOSE}`
    + `(?:\\s*,\\s*${WORD})*(?:(?:\\s*\\/\\s*|\\|)${WORD}|(?:\\s*,\\s+|\\s+)n?or\\s+${WORD})+`,
  'giu',
);
const YES_AND_NO = new RegExp(`\\b(?:yes${CLOSE}\\s+and\\s+${OPEN}no|no${CLOSE}\\s+and\\s+${OPEN}yes)\\b`, 'iu');

function lenientValue(kind, text, echoes) {
  const spec = KINDS[kind];
  const lines = withoutEchoes(text, echoes).replace(VARIATION_SELECTORS, '');
  const found = new Set();
  if (spec.dates) {
    for (const date of datesIn(collapse(lines))) found.add(date);
  } else {
    // A word in place of the list, so that "there is no yes/no" leaves no "no" standing alone.
    const unasked = lines.replace(CHOICES, ' choices ');
    for (const word of spec.words) {
      if (word === 'DEPENDS' ? /\bdepends\b/iu.test(unasked) : STANDALONE(word).test(unasked)) found.add(word);
    }
    if (spec.words.includes('YES') && YES_AND_NO.test(unasked)) {
      found.add('YES');
      found.add('NO');
    }
    if (spec.signs) {
      const named = collapse(lines.replace(ASSISTANT_NAME, ' '));
      SIGNS.forEach((sign, index) => {
        if (new RegExp(`\\b${sign}\\b`, 'iu').test(named) || named.includes(GLYPHS[index])) found.add(sign);
      });
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

/**
 * Reads one reply to one question: the value it gives, and which reading
 * found it. `echoes` are texts to ignore in the lenient reading, such as the
 * question itself; its instruction is always ignored.
 */
export function readReply(kind, reply, echoes = []) {
  if (!KINDS[kind]) throw new Error(`unknown answer kind ${kind}`);
  const text = typeof reply === 'string' ? reply : '';
  const lines = text.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line.length > 0);
  const strict = lines.length > 0 ? strictValue(kind, lines[lines.length - 1]) : null;
  if (strict !== null) return { value: strict, reading: 'strict' };
  const lenient = lenientValue(kind, text, [...echoes, KINDS[kind].instruction]);
  if (lenient !== null) return { value: lenient, reading: 'lenient' };
  return { value: null, reading: 'unparsed' };
}

/** One reply scored against the key: correct under the strict reading, and under either reading. */
export function scoreReply(item, key, reply) {
  if (item.id !== key.id) throw new Error(`question ${item.id} scored against the key of ${key.id}`);
  const { value, reading } = readReply(item.answer, reply, [item.prompt]);
  const right = value !== null && key.accepted.includes(value);
  return {
    id: item.id,
    family: item.family,
    value,
    reading,
    strict: right && reading === 'strict',
    lenient: right,
  };
}

function tally(rows) {
  const count = rows.length;
  const strict = rows.filter((row) => row.strict).length;
  const lenient = rows.filter((row) => row.lenient).length;
  const ratio = (value) => (count === 0 ? null : Math.round((value / count) * 10000) / 10000);
  return {
    count,
    strict: { correct: strict, score: ratio(strict) },
    lenient: { correct: lenient, score: ratio(lenient) },
    readings: {
      strict: rows.filter((row) => row.reading === 'strict').length,
      lenient: rows.filter((row) => row.reading === 'lenient').length,
      unparsed: rows.filter((row) => row.reading === 'unparsed').length,
    },
  };
}

/**
 * A run scored: every question, overall and by family. `replies` maps each
 * question's id to the reply given; a question with no reply counts as
 * unparsed, and an id that is not a question is listed under `unknown`.
 */
export function scoreRun(items, key, replies) {
  const keys = new Map(key.items.map((entry) => [entry.id, entry]));
  const ids = new Set(items.items.map((item) => item.id));
  const rows = items.items.map((item) => {
    const entry = keys.get(item.id);
    if (!entry) throw new Error(`the key has no answer for ${item.id}`);
    return scoreReply(item, entry, replies.get(item.id) ?? '');
  });
  const families = {};
  for (const family of [...new Set(items.items.map((item) => item.family))]) {
    families[family] = tally(rows.filter((row) => row.family === family));
  }
  return {
    benchmark: { name: items.name, version: items.version },
    answered: rows.filter((row) => replies.has(row.id)).length,
    unknown: [...replies.keys()].filter((id) => !ids.has(id)),
    ...tally(rows),
    families,
    rows,
  };
}

async function main(path) {
  const { readFile } = await import('node:fs/promises');
  const here = new URL('./', import.meta.url);
  const items = JSON.parse(await readFile(new URL('items.json', here), 'utf8'));
  const key = JSON.parse(await readFile(new URL('key.json', here), 'utf8'));
  const replies = new Map();
  for (const [number, line] of (await readFile(path, 'utf8')).split(/\r?\n/u).entries()) {
    if (line.trim() === '') continue;
    const { id, reply } = JSON.parse(line);
    if (typeof id !== 'string' || typeof reply !== 'string') throw new Error(`line ${number + 1}: needs a string id and a string reply`);
    if (replies.has(id)) throw new Error(`line ${number + 1}: a second reply to ${id}`);
    replies.set(id, reply);
  }
  const { rows, ...summary } = scoreRun(items, key, replies);
  if (summary.unknown.length > 0) console.error(`scorer: ${summary.unknown.length} repl${summary.unknown.length === 1 ? 'y has an id' : 'ies have ids'} that no question has: ${summary.unknown.join(', ')}`);
  console.log(JSON.stringify({ ...summary, rows }, null, 2));
}

/** True when this file is the script node was asked to run, by whatever path or link. */
async function invokedDirectly() {
  if (typeof process === 'undefined' || !process.argv?.[1]) return false;
  const [{ realpathSync }, { fileURLToPath }] = await Promise.all([import('node:fs'), import('node:url')]);
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (await invokedDirectly()) {
  if (!process.argv[2]) {
    console.error('usage: node scorer.mjs replies.jsonl');
    process.exit(2);
  }
  await main(process.argv[2]);
}
