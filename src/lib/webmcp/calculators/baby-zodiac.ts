/**
 * /baby-zodiac/'s reading for a due date, as BabyZodiac computes it (baby-zodiac.test.ts runs the island's code beside
 * this): the Sun's sign at noon UTC, or both signs when the Sun changes sign that day, with a near-edge neighbour;
 * the Moon's noon sign from three days before to three days after, as spans; and the planets retrograde at noon,
 * from the committed retrograde windows, which cover a stated span only.
 */
import sky from '../../../data/sky.json';
import { bodyLongitude } from '../../engine/full';
import { signForLongitude } from '../../signs';
import { birthdaySlug } from '../../birthdays';
import { ENGINE, pageUrl } from './format';

const DAY = 86400_000;

export function babyZodiacResult(due: string) {
  const noon = new Date(`${due}T12:00:00Z`);
  const dayStart = new Date(`${due}T00:00:00Z`);
  const s0 = signForLongitude(bodyLongitude('Sun', dayStart));
  const s1 = signForLongitude(bodyLongitude('Sun', new Date(dayStart.getTime() + DAY - 1000)));
  let sun;
  if (s0.slug !== s1.slug) {
    sun = { changesSignThatDay: true, signs: [s0.name, s1.name], nearEdge: null };
  } else {
    const lon = bodyLongitude('Sun', noon);
    const inSign = ((lon % 360) + 360) % 360 % 30;
    const nearEdge = inSign < 1 ? signForLongitude(lon - 2) : inSign > 29 ? signForLongitude(lon + 2) : null;
    sun = { changesSignThatDay: false, signs: [s0.name], nearEdge: nearEdge?.name ?? null };
  }

  const moonSpans: { from: string; to: string; sign: string }[] = [];
  for (let d = -3; d <= 3; d += 1) {
    const at = new Date(noon.getTime() + d * DAY);
    const sign = signForLongitude(bodyLongitude('Moon', at)).name;
    const last = moonSpans[moonSpans.length - 1];
    if (last && last.sign === sign) last.to = at.toISOString();
    else moonSpans.push({ from: at.toISOString(), to: at.toISOString(), sign });
  }

  // The page lists retrograde planets from sky.json's windows; outside their span it can say nothing either way.
  const covered = noon >= new Date(sky.from) && noon < new Date(sky.to);
  const retrograde = covered
    ? (sky.retrogrades as { planet: string; from: string; to: string | null }[])
      .filter((w) => new Date(w.from) <= noon && (w.to === null || new Date(w.to) >= noon))
      .map((w) => w.planet)
    : null;

  return {
    dueDate: due,
    computedUtc: noon.toISOString(),
    sun,
    moonSpans,
    retrograde,
    retrogradeCoverage: { from: sky.from, to: sky.to },
    birthdayPage: pageUrl(`/birthday/${birthdaySlug(noon.getUTCMonth() + 1, noon.getUTCDate())}/`),
    engine: ENGINE,
    page: pageUrl('/baby-zodiac/'),
  };
}
