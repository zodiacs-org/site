import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { birthdayGrowthLine, birthdayPull, parseBirthdayBody, plainText, smartQuotes } from './birthday-reading';

const dir = new URL('../content/birthdays/', import.meta.url);

async function readings() {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.mdx')).sort();
  return Promise.all(names.map(async (name) => {
    const source = await readFile(new URL(name, dir), 'utf8');
    const body = source.slice(source.indexOf('\n---', 3) + 4);
    return { name, body, reading: parseBirthdayBody(body) };
  }));
}

describe('birthday reading parts', () => {
  it('finds one opening, three sections and a closing paragraph on every date', async () => {
    const all = await readings();
    expect(all).toHaveLength(366);
    for (const { name, reading } of all) {
      expect(reading.intro.length, name).toBeGreaterThan(0);
      expect(reading.sections, name).toHaveLength(3);
      expect(reading.closing, name).toMatch(/\/birth-chart\//u);
    }
  });

  it('quotes only sentences the date already says, never the same one twice', async () => {
    const seen = new Set<string>();
    let pulls = 0;
    let growth = 0;
    for (const { name, body, reading } of await readings()) {
      const text = smartQuotes(plainText(body));
      const pull = birthdayPull(reading);
      if (pull) {
        pulls += 1;
        const core = pull.replace(/[.!?]$/u, '');
        const lowered = core.charAt(0).toLowerCase() + core.slice(1);
        expect(text.includes(core) || text.includes(lowered), `${name}: ${pull}`).toBe(true);
        expect(seen.has(pull), `${name} repeats a pull quote`).toBe(false);
        seen.add(pull);
        expect(pull).not.toMatch(/[—–]/u);
      }
      const line = birthdayGrowthLine(reading);
      if (line) {
        growth += 1;
        expect(text.includes(line), `${name}: ${line}`).toBe(true);
        const growthSection = smartQuotes(plainText(reading.sections[2].paragraphs.join('\n\n')));
        expect(growthSection.includes(line), `${name}: the line comes from the growth edge`).toBe(true);
      }
    }
    // Dates without a suitable line show no pull quote or card rather than invented text.
    expect(pulls).toBeGreaterThan(320);
    expect(growth).toBeGreaterThan(310);
  });

  it('is stable for a known date', async () => {
    const all = await readings();
    const july8 = all.find(({ name }) => name === 'july-8.mdx')!;
    expect(birthdayGrowthLine(july8.reading)).toBe('The practice is scheduled candor: air the small complaint at week two, while it is still small, and the reservoir never reaches the brim.');
    expect(birthdayPull(july8.reading)).toBe('The quieter this person gets, the more is moving underneath.');
  });
});
