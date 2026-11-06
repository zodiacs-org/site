/**
 * Check 16 of validate-pilot.mjs: the People pilot's dignity table against
 * the engine's. The pilot's table is the DIGNITY object of compute-astro.mjs,
 * which stays frozen and is read here as text; since engine 1.1.0-rc.2 the
 * site takes its dignities from @zodiacs/engine/lite (src/lib/dignities.ts
 * is an adapter over it), so a People page and a chart page agree when the
 * pilot's table gives, for each of the seven classical planets in each of the
 * twelve signs, the conditions dignitiesFor gives, in its order (domicile,
 * exaltation, detriment, fall). Taking the table's text as an argument lets a
 * control run the comparison on a changed copy, never on the frozen file.
 */
export const CLASSICAL_PLANETS = Object.freeze(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']);
export const SIGN_SLUGS = Object.freeze(['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']);
const CONDITIONS = Object.freeze(['domicile', 'exaltation', 'detriment', 'fall']);

/** The DIGNITY object's text in compute-astro.mjs's source, or null. */
function dignityBlock(toolSource) {
  const start = toolSource.indexOf('const DIGNITY = {');
  if (start < 0) return null;
  const end = toolSource.indexOf('\n};', start);
  return end < 0 ? null : toolSource.slice(start, end);
}

/** A planet's row of the pilot's table, as lists of sign slugs per condition, or null. */
export function pilotRow(toolSource, planet) {
  const block = dignityBlock(toolSource);
  const text = block?.match(new RegExp(`\\b${planet}: \\{[^}]*\\}`, 'u'))?.[0];
  if (!text) return null;
  const row = {};
  for (const condition of CONDITIONS) {
    const list = text.match(new RegExp(`\\b${condition}: \\[([^\\]]*)\\]`, 'u'))?.[1];
    if (list === undefined) return null;
    row[condition] = (list.match(/'[a-z]+'/gu) ?? []).map((quoted) => quoted.slice(1, -1));
  }
  return row;
}

/**
 * Every planet and sign where the pilot's table and dignitiesFor differ: an
 * empty list when they agree on all 84. A planet whose row cannot be read is
 * one difference with a null sign.
 */
export function dignityTableDifferences(toolSource, dignitiesFor) {
  const differences = [];
  for (const planet of CLASSICAL_PLANETS) {
    const row = pilotRow(toolSource, planet);
    if (!row) {
      differences.push({ planet, sign: null, pilot: null, engine: null });
      continue;
    }
    for (const sign of SIGN_SLUGS) {
      const pilot = CONDITIONS.filter((condition) => row[condition].includes(sign));
      const engine = [...dignitiesFor(planet, sign)];
      if (pilot.join(',') !== engine.join(',')) differences.push({ planet, sign, pilot, engine });
    }
  }
  return differences;
}
