const MAJOR_ASPECT_ANGLES = [0, 60, 90, 120, 180];
const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export function quietSunFixture(daily) {
  // The dated sky can have contacts throughout a whole sign, so search all
  // twelve signs while keeping the fixture's Sun-sign baseline meaningful.
  const candidates = Array.from({ length: 3_600 }, (_, index) => index / 10).map((lon) => {
    const nearestOrb = Math.min(...daily.bodies.flatMap((body) => {
      const rawSeparation = Math.abs(body.lon - lon) % 360;
      const separation = rawSeparation > 180 ? 360 - rawSeparation : rawSeparation;
      return MAJOR_ASPECT_ANGLES.map((angle) => Math.abs(separation - angle));
    }));
    return { lon, nearestOrb };
  });
  const best = candidates.sort((a, b) => b.nearestOrb - a.nearestOrb)[0];
  if (!best || best.nearestOrb <= 3) {
    throw new Error(`No deterministic quiet Sun fixture exists for ${daily.date}.`);
  }
  return { longitude: best.lon, sign: SIGNS[Math.floor(best.lon / 30)], nearestOrb: best.nearestOrb };
}
