#!/usr/bin/env node
/**
 * Zodiacs Sky Card: writes today's sky into a README between two markers.
 *
 * It asks the public Zodiacs server (https://zodiacs.org/mcp, no key) for the
 * Moon's phase and sign, whether Mercury is retrograde, and the published
 * horoscope for one Sun sign, then puts a short card between
 * <!-- zodiacs-sky:start --> and <!-- zodiacs-sky:end --> (appended to the end
 * of the file the first time). It sends only the sign and a time zone, never
 * anything about the person. If Zodiacs cannot answer, the README is left as
 * it is and the run still succeeds, so a profile never breaks.
 *
 * Settings come from the environment, as the GitHub Action passes them:
 * SKY_SIGN (required, such as scorpio), SKY_TIMEZONE (default UTC) and
 * SKY_README (default README.md). Run: SKY_SIGN=leo node sky-card.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const START = '<!-- zodiacs-sky:start -->';
export const END = '<!-- zodiacs-sky:end -->';
export const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const ENDPOINT = process.env.ZODIACS_MCP_URL ?? 'https://zodiacs.org/mcp';
const SOURCE = 'utm_source=github-sky-card';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PHASES = [
  [/new/iu, '🌑'], [/waxing crescent/iu, '🌒'], [/first quarter/iu, '🌓'], [/waxing gibbous/iu, '🌔'],
  [/full/iu, '🌕'], [/waning gibbous/iu, '🌖'], [/(last|third) quarter/iu, '🌗'], [/waning crescent/iu, '🌘'],
];

const title = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/** The Moon emoji for a phase name such as "Waning Gibbous". */
export function phaseEmoji(name) {
  return PHASES.find(([pattern]) => pattern.test(name))?.[1] ?? '🌙';
}

/** A date such as 2026-11-08 written as 8 November 2026. */
export function longDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** The first sentence of a reading, kept under about 220 characters. */
export function firstSentence(text) {
  const clean = text.replace(/\s+/gu, ' ').trim();
  const end = clean.search(/[.!?](\s|$)/u);
  const sentence = end === -1 ? clean : clean.slice(0, end + 1);
  return sentence.length <= 220 ? sentence : `${sentence.slice(0, 217).replace(/\s+\S*$/u, '')}...`;
}

/** A zodiacs.org page with the card's source added, before any #. */
export function cardLink(url) {
  const plain = url.replace(/[?&]ref=[^&#]*/u, '').replace(/\?&/u, '?').replace(/\?(#|$)/u, '$1');
  const hash = plain.indexOf('#');
  const [base, fragment] = hash === -1 ? [plain, ''] : [plain.slice(0, hash), plain.slice(hash)];
  return `${base}${base.includes('?') ? '&' : '?'}${SOURCE}${fragment}`;
}

/** The card, from what the three Zodiacs tools returned. */
export function renderCard({ date, moonPhase, moonSign, mercuryRetrograde, signName, reading, confidence, signUrl }) {
  const moon = `${phaseEmoji(moonPhase)} **${moonPhase} in ${title(moonSign)}**`;
  const mercury = mercuryRetrograde ? '☿ **Mercury is retrograde**' : '☿ **Mercury is direct**';
  return [
    START,
    `### Today's sky, ${longDate(date)}`,
    '',
    `${moon} · ${mercury}`,
    '',
    `**${signName} today:** ${firstSentence(reading)}${confidence ? ` *${confidence}*` : ''}`,
    '',
    `[Read the full ${signName} horoscope on Zodiacs](${cardLink(signUrl)})`,
    END,
  ].join('\n');
}

/** The README with the card between the markers, or added at the end the first time. */
export function replaceBlock(readme, card) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start !== -1 && end > start) return `${readme.slice(0, start)}${card}${readme.slice(end + END.length)}`;
  return `${readme.replace(/\s*$/u, '')}\n\n${card}\n`;
}

async function call(name, args, attempt = 1) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18', 'User-Agent': 'zodiacs-sky-card/1' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  if (response.status === 429 && attempt === 1) {
    const wait = Math.min(Number(response.headers.get('retry-after')) || 30, 60);
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    return call(name, args, 2);
  }
  if (!response.ok) throw new Error(`Zodiacs answered ${response.status} for ${name}`);
  const text = await response.text();
  const line = text.split('\n').find((row) => row.startsWith('data: '));
  const result = JSON.parse(line ? line.slice(6) : text).result?.structuredContent;
  if (!result?.ok) throw new Error(`Zodiacs could not answer ${name}: ${result?.error?.message ?? 'no result'}`);
  return result;
}

/** Asks Zodiacs for today's sky and the sign's horoscope, in the given time zone. */
export async function fetchSky(sign, zone) {
  const [horoscope, sky, mercury] = await Promise.all([
    call('get_horoscope', { sign, zone }),
    call('get_sky', { zone, bodies: ['Moon'] }),
    call('check_sky_fact', { kind: 'retrograde', body: 'Mercury', instant: new Date().toISOString() }),
  ]);
  const data = horoscope.data;
  return {
    date: data.date,
    moonPhase: sky.data.moonPhase.name,
    moonSign: sky.data.calculation.result.instants[0].bodies.find((body) => body.body === 'Moon').sign,
    mercuryRetrograde: String(mercury.data.answer) === 'true',
    signName: data.signName,
    reading: data.reading?.paragraphs?.[0]?.text ?? data.reading?.title ?? '',
    confidence: (data.disclosure ?? '').match(/Reading confidence \d+%/u)?.[0] ?? '',
    signUrl: horoscope.links.find((link) => link.url.includes(`/horoscopes/${sign}/`))?.url ?? `https://zodiacs.org/horoscopes/${sign}/`,
  };
}

async function main() {
  const sign = (process.env.SKY_SIGN ?? '').trim().toLowerCase();
  const zone = (process.env.SKY_TIMEZONE ?? '').trim() || 'UTC';
  const path = (process.env.SKY_README ?? '').trim() || 'README.md';
  if (!SIGNS.includes(sign)) {
    console.error(`::error::sign must be one of: ${SIGNS.join(', ')}`);
    process.exit(1);
  }
  let card;
  try {
    card = renderCard(await fetchSky(sign, zone));
  } catch (error) {
    console.log(`::warning::Zodiacs did not answer today (${error.message}). The README is unchanged.`);
    return;
  }
  const readme = await readFile(path, 'utf8').catch(() => '');
  const next = replaceBlock(readme, card);
  if (next === readme) { console.log('The sky card is already up to date.'); return; }
  await writeFile(path, next);
  console.log(`Updated ${path}:\n${card}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
