import programData from '../data/horoscope-program.json';
import publication from '../data/daily-publication.json';
import receipt from '../data/daily-publication-manifest.json';
import daily from '../data/daily.json';
import { pageReadingFromProgram } from './horoscope-page-data';
import type { HoroscopeProgram } from './horoscope-program';
import { SIGNS } from './signs';

const ORIGIN = 'https://zodiacs.org';

/** X weights ordinary Latin text as one character and other ranges as two. */
export function xTextLength(text: string): number {
  return Array.from(text).reduce((length, character) => {
    const point = character.codePointAt(0)!;
    return length + (point <= 0x10ff
      || (point >= 0x2000 && point <= 0x200d)
      || (point >= 0x2010 && point <= 0x201f)
      || (point >= 0x2032 && point <= 0x2037) ? 1 : 2);
  }, 0);
}

export function xCaption(name: string, dailyLine: string, url: string): string {
  const prefix = `${name}: `;
  const budget = 280 - xTextLength(prefix) - 1 - 23;
  let excerpt = dailyLine;
  if (xTextLength(excerpt) > budget) {
    let candidate = '';
    for (const character of dailyLine) {
      if (xTextLength(`${candidate}${character}…`) > budget) break;
      candidate += character;
    }
    // Prefer a complete sentence; otherwise stop before the partial word.
    const sentence = candidate.match(/^.*[.!?](?=\s|$)/u)?.[0];
    const wordBoundary = candidate.search(/\s+\S*$/u);
    excerpt = `${sentence ?? (wordBoundary >= 0 ? candidate.slice(0, wordBoundary) : '')}…`;
  }
  return `${prefix}${excerpt}\n${url}`;
}

export function buildDailyContentManifest(
  generatedAt = new Date().toISOString(),
  program = programData as HoroscopeProgram,
) {
  const date = receipt.date;
  if (receipt.status !== 'verified' || program.anchorDate !== date
    || publication.date !== date || daily.date !== date) {
    throw new Error('Daily content sources must share the verified UTC edition date');
  }
  if (program.signs.length !== 12 || new Set(program.signs.map(({ sign }) => sign)).size !== 12) {
    throw new Error('Daily content requires exactly twelve distinct signs');
  }
  const signs = SIGNS.map(({ slug, name, glyph }) => {
    const today = program.signs.find(({ sign }) => sign === slug)?.readings.today;
    if (today?.period.from !== date || today.period.through !== date || !today.period.utcBasis) {
      throw new Error(`${slug} daily reading must belong to the UTC edition`);
    }
    // This is the first section on the sign page and the hub teaser's source.
    const dailyLine = pageReadingFromProgram(program, slug, 'today').sections[0]?.body;
    if (!dailyLine || dailyLine.includes('—')) {
      throw new Error(`${slug} daily line must be published text without em-dashes`);
    }
    const signPageUrl = `${ORIGIN}/horoscopes/${slug}/`;
    return {
      sign: slug,
      name,
      symbol: glyph,
      dailyLine,
      captions: {
        instagram: `${name}: ${dailyLine}\n${signPageUrl}`,
        x: xCaption(name, dailyLine, signPageUrl),
      },
      signPageUrl,
      iconUrl: `${ORIGIN}/assets/zodiac-icons/400/${slug}.webp`,
    };
  });
  return {
    schema: 'zodiacs.daily-content.v1' as const,
    date,
    generatedAt,
    source: {
      publicationCanonicalSha256: receipt.publication.canonicalSha256,
      url: `${ORIGIN}/horoscopes/`,
    },
    signs,
  };
}

// Both prerendered endpoints serialize the same build snapshot and timestamp.
export const dailyContentManifest = buildDailyContentManifest();

export function dailyContentResponse() {
  return new Response(`${JSON.stringify(dailyContentManifest, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
