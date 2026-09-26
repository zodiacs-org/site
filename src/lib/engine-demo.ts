/**
 * The worked example the engine page publishes, and the output it produces.
 *
 * Both live here rather than inline in the page so `scripts/engine-demo.test.mjs`
 * can execute the exact source a reader copies and compare its stdout against
 * the exact text printed beside it. A screenshot or a hand-typed result would
 * drift the first time a body moved; this cannot, because the test runs it.
 *
 * The instant and coordinates are a round public place and an arbitrary date.
 * No real person's birth details appear here.
 */
export const ENGINE_DEMO_SOURCE = `import { natalChart } from '@zodiacs/engine';

// 15 June 1990, 13:30 UTC, London. No API key and no network call.
const chart = natalChart({
  utc: '1990-06-15T13:30:00Z',
  latitude: 51.5074,
  longitude: -0.1278,
  houseSystem: 'placidus',
});

for (const p of chart.bodies) {
  const mark = p.retrograde ? ' retrograde' : '';
  console.log(\`\${p.body.padEnd(10)} \${p.degree.toFixed(2).padStart(6)}° \${p.sign}\${mark}\`);
}
console.log(\`ascendant  \${chart.angles.asc.toFixed(2)}°   engine \${chart.engineVersion}\`);
`;

/** Standard output of the source above, captured from a run, asserted by the test. */
export const ENGINE_DEMO_OUTPUT = `Sun         24.19° gemini
Moon        16.19° pisces
Mercury      5.80° gemini
Venus       18.85° taurus
Mars        11.09° aries
Jupiter     15.90° cancer
Saturn      24.03° capricorn retrograde
Uranus       8.16° capricorn retrograde
Neptune     13.72° capricorn retrograde
Pluto       15.40° scorpio retrograde
North Node   8.12° aquarius
South Node   8.12° leo
ascendant  191.24°   engine 0.1.1-rc.9
`;
