/**
 * Sun, Moon and rising in the homepage "recommended next" grammar: mono
 * labels beside the site's sign chips (see .wb__three in today.css). Each
 * label and its chip share a group, so a wrapping row never strands a
 * label at the end of a line.
 * Placements are stated only as far as the chart settles them: with no
 * birth time the Moon is unsettled and there is no rising sign, and a Sun
 * on the edge of a sign on that day is left out rather than guessed. A
 * received card's rising sign is known only to the whole degree.
 */
import { normalizeLongitude, settledSignIndex, signIndexOf } from '../lib/profile/settled-signs';
import { SIGNS, formatLongitude } from '../lib/signs';
import { signIcon } from '../lib/sign-icon';
import type { SavedChart } from '../lib/profile/schema';
import type { PositionsShareChart } from '../lib/share-positions';

export interface Placement {
  label: 'Sun' | 'Moon' | 'Rising';
  lon: number;
  slug: string;
  name: string;
  hue: string;
  /** The longitude is good only to its whole degree (a card's angles). */
  wholeDegree?: boolean;
}

function settle(
  find: (body: string) => number | undefined,
  asc: number | undefined,
  timeKnown: boolean,
  anglesToDegree = false,
): Placement[] {
  const rows: { label: Placement['label']; lon: number | undefined; rising: boolean }[] = [
    { label: 'Sun', lon: find('Sun'), rising: false },
    { label: 'Moon', lon: find('Moon'), rising: false },
    { label: 'Rising', lon: timeKnown ? asc : undefined, rising: true },
  ];
  return rows.flatMap(({ label, lon, rising }) => {
    if (lon === undefined || !Number.isFinite(lon)) return [];
    const index = rising ? signIndexOf(lon) : settledSignIndex(label, lon, timeKnown);
    if (index === null) return [];
    const sign = SIGNS[index];
    const wholeDegree = rising && anglesToDegree ? { wholeDegree: true } : {};
    return [{ label, lon, slug: sign.slug, name: sign.name, hue: sign.hue, ...wholeDegree }];
  });
}

export function chartPlacements(chart: SavedChart): Placement[] {
  return settle(
    (body) => chart.summary.bodies.find((row) => row.body === body)?.lon,
    chart.summary.angles?.asc,
    chart.birth.timeKnown === true,
  );
}

export function cardPlacements(card: { chart: PositionsShareChart; timeKnown: boolean }): Placement[] {
  return settle(
    (body) => card.chart.bodies.find((row) => row.body === body)?.lon,
    card.chart.angles?.asc,
    card.timeKnown,
    true,
  );
}

export default function PlacementList({ placements, linked = true }: { placements: Placement[]; linked?: boolean }) {
  if (placements.length === 0) return null;
  return (
    <dl class="pf-three">
      {placements.map((placement) => {
        const Chip = linked ? 'a' : 'span';
        return (
          <div class="pf-three__pair" key={placement.label}>
            <dt class="mono--label">{placement.label}</dt>
            <dd>
              <Chip
                class="chip"
                href={linked ? `/${placement.slug}/` : undefined}
                style={`--sign:${placement.hue}`}
                title={placement.wholeDegree
                  ? `${Math.floor(normalizeLongitude(placement.lon) % 30)}° ${placement.name}`
                  : formatLongitude(placement.lon, 'en')}
              >
                <picture class="chip__icon">
                  <img src={signIcon(48, placement.slug)} width="18" height="18" alt="" loading="lazy" decoding="async" />
                </picture>
                {placement.name}
              </Chip>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
