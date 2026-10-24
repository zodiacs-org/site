import { describe, expect, it } from 'vitest';
import { SIGNS } from '../signs';
import {
  explainHouse,
  explainPlanet,
  explainSign,
  ordinal,
  wheelExplainCopy,
  type WheelExplainCopy,
} from './copy';

const { copy } = wheelExplainCopy('en');
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node'];

/** Every sentence a visitor can be shown, plus the panel chrome. */
function everyLine(table: WheelExplainCopy): string[] {
  const lines = [table.idleTitle, table.hint, table.keyHint, table.houseHint, table.houseKeyHint, table.close, table.groupLabel];
  for (const body of BODIES) {
    for (let sign = 0; sign < 12; sign += 1) {
      lines.push(explainPlanet({ body, lon: sign * 30 + 12, house: (sign % 12) + 1, retrograde: true }, table).text);
      lines.push(explainPlanet({ body, lon: sign * 30 + 12 }, table).text);
    }
  }
  for (const sign of SIGNS) {
    lines.push(explainSign(sign.slug, null, table).text);
    lines.push(explainSign(sign.slug, { bodies: [] }, table).text);
    lines.push(explainSign(sign.slug, { bodies: [{ body: 'Sun', lon: SIGNS.indexOf(sign) * 30 + 3 }] }, table).text);
  }
  for (let house = 1; house <= 12; house += 1) {
    lines.push(explainHouse(house, null, table).text);
    lines.push(explainHouse(house, { bodies: [] }, table).text);
    lines.push(explainHouse(house, { bodies: [{ body: 'Venus', lon: 0, house }] }, table).text);
  }
  return lines;
}

describe('wheel explain copy', () => {
  it('covers every body, sign and house the wheel can draw', () => {
    expect(Object.keys(copy.planets).sort()).toEqual([...BODIES].sort());
    for (const sign of SIGNS) {
      expect(copy.signs[sign.slug], sign.slug).toMatch(new RegExp(`^${sign.name} is an? ${sign.element} sign about `));
      expect(copy.signLeans[sign.slug], sign.slug).toBeTruthy();
    }
    for (let house = 1; house <= 12; house += 1) expect(copy.houseAreas[house], String(house)).toBeTruthy();
  });

  it('keeps every explanation to one or two short sentences', () => {
    for (const line of everyLine(copy).slice(7)) {
      const sentences = line.split(/(?<=[.!?])\s+/u).filter(Boolean);
      expect(sentences.length, line).toBeGreaterThanOrEqual(1);
      expect(sentences.length, line).toBeLessThanOrEqual(2);
      // The panel's height is fixed so nothing moves; this is what it is sized for.
      expect(line.length, line).toBeLessThanOrEqual(215);
    }
  });

  it('follows the house rules for copy', () => {
    for (const line of everyLine(copy)) {
      expect(line, 'no em or en dashes').not.toMatch(/[\u2013\u2014]/u);
      expect(line, 'no forecasts').not.toMatch(/\b(will|destined|fate|luck|lucky|guarantee|predict)/iu);
      expect(line, 'no market language').not.toMatch(/\b(token|crypto|coin|wallet|market|buy|price|invest)/iu);
      expect(line).not.toMatch(/\s{2}|\s[.,]/u);
    }
  });

  it('places a planet in its sign and house in this chart', () => {
    const sun = explainPlanet({ body: 'Sun', lon: 195.02, house: 10 });
    expect(sun).toEqual({
      kind: 'planet',
      id: 'body:Sun',
      title: 'Sun in Libra',
      text: 'The Sun is your core self: what gives you energy and what you are growing into. Here it is in Libra, which leans toward balance and fairness, in the 10th house of work, reputation and your public role.',
      label: 'Sun in Libra, 10th house',
    });
    const mercury = explainPlanet({ body: 'Mercury', lon: 359.9, retrograde: true });
    expect(mercury.text).toBe('Mercury is how you think, talk and take in information. Here it is in Pisces, which leans toward imagination and empathy.');
    expect(mercury.label).toBe('Mercury in Pisces, retrograde');
  });

  it('says what a sign or house holds, and that an empty one is ordinary', () => {
    const bodies = [
      { body: 'Sun', lon: 10, house: 4 },
      { body: 'Mercury', lon: 20, house: 4 },
      { body: 'North Node', lon: 25, house: 4 },
    ];
    expect(explainSign('aries', { bodies }).text).toBe('Aries is a fire sign about beginnings, courage and acting on instinct. In this chart it holds the Sun, Mercury and the North Node.');
    expect(explainSign('taurus', { bodies }).text).toMatch(/No planets sit in it in this chart, which is common\.$/u);
    expect(explainSign('leo').text).toBe('Leo is a fire sign about warmth, creativity and being seen.');
    expect(explainHouse(4, { bodies: bodies.slice(0, 2) }).text).toBe('The 4th house is the part of the chart about home, family and your roots. In this chart it holds the Sun and Mercury.');
    expect(explainHouse(7, { bodies }).text).toMatch(/It is empty in this chart, which is common and does not mean that area is missing\.$/u);
    expect(explainHouse(12)).toMatchObject({ id: 'house:12', title: '12th house', label: '12th house' });
  });

  it('rejects ids the wheel never draws', () => {
    expect(() => explainSign('ophiuchus')).toThrow(/unknown sign/u);
    expect(() => explainHouse(0)).toThrow(/outside 1 to 12/u);
    expect(() => explainHouse(13)).toThrow(/outside 1 to 12/u);
  });

  it('spells ordinals', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 111].map(ordinal)).toEqual(
      ['1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '111th'],
    );
  });

  it('falls back to English for a locale without its own table, and says so', () => {
    expect(wheelExplainCopy('en')).toEqual({ copy, fallback: false });
    for (const locale of ['es', 'pt', 'fr', 'it', 'ru', 'ar'] as const) {
      expect(wheelExplainCopy(locale)).toEqual({ copy, fallback: true });
    }
  });
});
