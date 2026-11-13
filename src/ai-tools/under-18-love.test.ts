import { describe, expect, it } from 'vitest';
import { UNDER_13_REFUSAL } from './contracts';
import { childBirthDateRefusal, executeAiTool, type AiCallContext } from './tools';
import { MINOR_LOVE_NOTE, MINOR_NOTE } from './features/reading-guards';
import committedWindow from '../data/horoscope-window.json';
import type { HoroscopeWindow } from './horoscope/window';

/**
 * ZOD-58. get_horoscope takes a focus and, for the personal week, a birth date. A love reading asked for with a
 * birth date under 18 came back in full, beside a note saying romantic readings were left out. Zodiacs gives no
 * love or romance reading for anyone under 18: the general reading comes back instead, with a note that says so.
 * The tool definitions do not change.
 */
const window = committedWindow as HoroscopeWindow;
const centre = window.generatedFor;
const NOW = new Date(`${centre}T12:00:00Z`);
const yearsAgo = (years: number, days = 0) => {
  const day = new Date(Date.UTC(Number(centre.slice(0, 4)) - years, Number(centre.slice(5, 7)) - 1, Number(centre.slice(8, 10)) + days));
  return day.toISOString().slice(0, 10);
};
const ROMANCE = /\b(?:love|loving|lover|romance|romantic|attraction|intimacy|sexual|chemistry|dating|flirt\w*)\b/iu;
const passagesOf = (surface: 'today' | 'love' | 'career') =>
  window.editions.find(edition => edition.anchorDate === centre)!.signs.leo[surface].passages.map(passage => passage.text);

async function read(input: Record<string, unknown>, context: AiCallContext = {}, occasions = false) {
  const result = await executeAiTool('get_horoscope', { sign: 'leo', ...input }, { now: () => NOW, horoscopeWindow: async () => window, ...(occasions ? { occasions: true } : {}) }, context);
  if (!result.ok || result.tool !== 'get_horoscope') throw new Error(JSON.stringify(result));
  return result.data;
}

describe('a love horoscope and a birth date under 18', () => {
  it('gives a 15-year-old the general reading, softened, with a note that says why', async () => {
    const context: AiCallContext = {};
    const data = await read({ focus: 'love', birthDate: yearsAgo(15) }, context);
    expect(data.status).toBe('available');
    expect(data.focus).toBe('general');
    expect(data.reading!.title).not.toMatch(/love/iu);
    expect(data.reading!.paragraphs.map(paragraph => paragraph.text)).not.toEqual(passagesOf('love'));
    expect(JSON.stringify({ reading: data.reading, why: data.why })).not.toMatch(ROMANCE);
    expect(data.message).toBe(MINOR_LOVE_NOTE);
    expect(data.message).toContain('does not give love or romance readings for anyone under 18');
    expect(data.shareUrl ?? '').not.toMatch(/love/iu);
    // The panel opens on the general reading and holds no love reading to switch to.
    const panel = context.horoscopePanel!;
    expect(panel.requested.focus).toBe('general');
    for (const day of panel.days) {
      expect(day.focuses.love).toMatchObject({ status: 'unavailable', paragraphs: [], facts: [], houses: [], shareUrl: null });
      expect(JSON.stringify([day.focuses.general.paragraphs, day.focuses.career.paragraphs])).not.toMatch(ROMANCE);
    }
    expect(JSON.stringify(panel.weeks.map(week => week.paragraphs))).not.toMatch(ROMANCE);
  });
  it('holds on the day before the 18th birthday, and for a week asked for with love', async () => {
    const data = await read({ focus: 'love', birthDate: yearsAgo(18, 1) });
    expect(data.focus).toBe('general');
    expect(data.message).toBe(MINOR_LOVE_NOTE);
    const week = await read({ period: 'week', focus: 'love', birthDate: yearsAgo(15) });
    expect(week.focus).toBe('general');
    expect(week.message).toBe(MINOR_LOVE_NOTE);
    expect(JSON.stringify(week.reading)).not.toMatch(ROMANCE);
  });
  it('keeps the personal week note true: with it, no love reading is given', async () => {
    const data = await read({ focus: 'love', birthDate: yearsAgo(15) }, {}, true);
    expect(data.focus).toBe('general');
    expect(data.personal!.note).toContain(MINOR_NOTE);
    expect(data.message).toBe(MINOR_LOVE_NOTE);
    expect(JSON.stringify({ reading: data.reading, items: data.personal!.items })).not.toMatch(ROMANCE);
  });
  it('softens a general or career reading for a birth date under 18, with no love note', async () => {
    const context: AiCallContext = {};
    const data = await read({ focus: 'career', birthDate: yearsAgo(15) }, context);
    expect(data.focus).toBe('career');
    expect(data.message).toBeUndefined();
    expect(JSON.stringify(data.reading)).not.toMatch(ROMANCE);
    expect(context.horoscopePanel!.days.every(day => day.focuses.love.status === 'unavailable')).toBe(true);
    // Marked, so a sign picked inside the panel (which carries no birth date) stays softened (horoscope/app.tsx).
    expect(context.horoscopePanel!.minor).toBe(true);
  });
  it('gives the love reading on the 18th birthday, to an adult, and with no birth date', async () => {
    for (const input of [{ birthDate: yearsAgo(18) }, { birthDate: yearsAgo(40) }, {}]) {
      const context: AiCallContext = {};
      const data = await read({ focus: 'love', ...input }, context);
      expect(data.focus).toBe('love');
      expect(data.reading!.paragraphs.map(paragraph => paragraph.text)).toEqual(passagesOf('love'));
      expect(data.message).toBeUndefined();
      expect(context.horoscopePanel!.requested.focus).toBe('love');
      expect(context.horoscopePanel!.days.find(day => day.date === centre)!.focuses.love.status).toBe('available');
      expect(context.horoscopePanel!.minor).toBeUndefined();
    }
  });
  it('keeps 29 February as 29 February: born on 1 March, still under 18 that day', async () => {
    const leap = new Date('2028-02-29T12:00:00Z');
    const result = await executeAiTool('get_horoscope', { sign: 'leo', focus: 'love', birthDate: '2010-03-01', zone: 'UTC' }, { now: () => leap, horoscopeWindow: async () => window }, {});
    if (!result.ok || result.tool !== 'get_horoscope') throw new Error(JSON.stringify(result));
    expect(result.data.focus).toBe('general');
    expect(result.data.message).toContain(MINOR_LOVE_NOTE);
  });
  it('still refuses a birth date under 13 before any reading', () => {
    const refusal = childBirthDateRefusal('get_horoscope', { sign: 'leo', focus: 'love', birthDate: yearsAgo(12) }, NOW);
    expect(refusal).toMatchObject({ ok: false, tool: 'get_horoscope', error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
    expect(childBirthDateRefusal('get_horoscope', { sign: 'leo', focus: 'love', birthDate: yearsAgo(15) }, NOW)).toBeNull();
  });
});
