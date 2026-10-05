/**
 * The scorer for the Zodiacs sky-fact benchmark, v0. No dependencies: it runs
 * in Node.js 18 or later and, imported as a module, in a browser.
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
 *            quotes or emphasis between.
 *            A sign counts wherever its name or symbol appears, except
 *            "Gemini" naming Google's assistant in these forms: "I am Gemini"
 *            or "I'm Gemini"; "As Gemini" at the start of a line or a
 *            sentence, before "I" or ", I"; "Google Gemini" or "Google's
 *            Gemini"; "Gemini" before Pro, Flash, Ultra, Nano, app, apps or
 *            model, or before "a model", "a language model", "a large model",
 *            "a large language model" or "an AI", with or without a comma
 *            between; and "Gemini" before a version number on the same line,
 *            one digit with or without a point and one or two more, that is
 *            followed by Pro, Flash, Ultra or Nano, or by a comma, full stop,
 *            semicolon, exclamation or question mark, closing bracket or the
 *            end of the reply. So "Gemini 2.5 Pro" and "As Gemini 2.5, I" are
 *            the assistant, and "Gemini 12°", "Gemini 3 days later", "Gemini
 *            14:30", "Gemini, 1942 to 1949", "read as Gemini, I think" and a
 *            list's "Gemini" with the next item's number on the line below
 *            are the sign.
 *            YES and NO count only standing alone: followed, after any
 *            closing emphasis or quote and any space, by one of
 *            . , ! ? ; : ) ] | — –, by a hyphen with a space or another
 *            hyphen after it, or by the end of a line; or, at the start of a
 *            line or a sentence, by ( or …. So "no idea", "no-one", "there is
 *            no station" and "no (direct) way" are not NO, and "No (it was
 *            direct)" is. YES, NO and DEPENDS joined by "or", "nor" or a
 *            slash, with commas before the last and any quotes or emphasis
 *            around each, only list the choices and name none of them: "yes
 *            or no", "yes/no", "neither yes nor no", "YES, NO or DEPENDS".
 *            "Yes and no" names both.
 *            DEPENDS counts as the word "depends". A date may also be written
 *            as 7 March 2023, 7th of March 2023, March 7, 2023, Mar. 7 2023,
 *            7 Sept 2023 or 2023/03/07, and a YYYY-MM-DD date may run on into
 *            a time. Two days joined by "or", "and", "to", "through", a dash
 *            or a slash, before one month and year, name two dates: "18 or 19
 *            March 2041", "18 March or 19 March 2041", "March 19–20, 2041".
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

/** A line without surrounding whitespace, quotes, emphasis, backticks or full stops and exclamation marks at its end. */
function bare(line) {
  let text = line.trim();
  for (;;) {
    const next = text
      .replace(/^[*_`"'“”‘’]+|[*_`"'“”‘’]+$/gu, '')
      .replace(/[.!]+$/u, '')
      .trim();
    if (next === text) return text;
    text = next;
  }
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
  // Two days before one month and year: "18 or 19 March 2041" and "18 March or 19 March 2041" name the 18th too.
  for (const match of text.matchAll(new RegExp(`(?:^|[^\\d:])(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(?:of\\s+)?${MONTH_NAMES})?${JOINED}(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_NAMES}\\s*,?\\s+(\\d{4})\\b`, 'giu'))) {
    found.push(isoOf(match[5], monthNumber(match[2] ?? match[4]), match[1]));
  }
  // "March 19 or 20, 2041" and "March 19 or March 20, 2041" name both days.
  for (const match of text.matchAll(new RegExp(`\\b${MONTH_NAMES}\\s+(\\d{1,2})(?:st|nd|rd|th)?${JOINED}(?:${MONTH_NAMES}\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s+(\\d{4})\\b`, 'giu'))) {
    found.push(isoOf(match[5], monthNumber(match[1]), match[2]), isoOf(match[5], monthNumber(match[3] ?? match[1]), match[4]));
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
/** The start of a line, after any list marker, or of a sentence, after . ! ? : or ; and a space; for a pattern with the m flag. */
const STARTS = `(?:^[^\\S\\r\\n]*(?:[-*+•][^\\S\\r\\n]+|\\d{1,2}[.)][^\\S\\r\\n]+)?|[.!?:;]${CLOSE}\\s+)${OPEN}`;

/** Google's assistant naming itself, in the forms the header lists, which is not the sign. It is read on the reply's own lines. */
const ASSISTANT_NAME = new RegExp([
  "\\b(?:i\\s+am|i'm|i’m)\\s+gemini\\b",
  `${STARTS}as\\s+gemini\\b(?=\\s*,?\\s*i\\b)`,
  "\\bgoogle(?:'s|’s)?\\s+gemini\\b",
  // Before a version on the same line, then a model's name or the end of a clause or the reply; or before a model's name, "a model" or "an AI".
  "\\bgemini(?=[^\\S\\r\\n]+\\d(?:\\.\\d{1,2})?(?!\\.?\\d)(?:\\s+(?:pro|flash|ultra|nano)\\b|\\s*(?:[,.;!?)\\]]|(?![\\s\\S])))"
    + "|\\s*(?:,\\s*)?(?:pro\\b|flash\\b|ultra\\b|nano\\b|app\\b|apps\\b|model\\b|a\\s+(?:large\\s+)?(?:language\\s+)?model\\b|an\\s+ai\\b))",
].join('|'), 'gimu');

/** YES or NO standing alone, as the header says: before the marks it lists anywhere, and before ( or … only where a line or a sentence starts. */
const STANDALONE = (word) => new RegExp(
  `\\b${word}\\b(?=${CLOSE}\\s*(?:[.,!?;:)\\]|—–]|-[-\\s]|$))|${STARTS}${word}\\b(?=${CLOSE}\\s*[(…])`,
  'imu',
);

/** The answer words joined by "or", "nor" or a slash only list the choices, and name none of them; "yes and no" names both. */
const WORD = `${OPEN}\\b(?:yes|no|depends)\\b${CLOSE}`;
const CHOICES = new RegExp(`${WORD}(?:\\s*,\\s*${WORD})*(?:\\s*\\/\\s*${WORD}|\\s*,?\\s+n?or\\s+${WORD})+`, 'giu');
const YES_AND_NO = new RegExp(`\\b(?:yes${CLOSE}\\s+and\\s+${OPEN}no|no${CLOSE}\\s+and\\s+${OPEN}yes)\\b`, 'iu');

function lenientValue(kind, text, echoes) {
  const spec = KINDS[kind];
  const lines = withoutEchoes(text, echoes).replace(VARIATION_SELECTORS, '');
  const found = new Set();
  if (spec.dates) {
    for (const date of datesIn(collapse(lines))) found.add(date);
  } else {
    const unasked = lines.replace(CHOICES, ' ');
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
