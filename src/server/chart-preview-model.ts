import { decodePositionsLink } from '../lib/share-positions.js';
import { previewPlacements, type PreviewPlacements } from '../lib/share-preview.js';
import { ringFrontForWholeDegree } from '../lib/ring-front.js';

export const HUES: Record<string, string> = {
  aries: '#DE8E79', taurus: '#B9D4BE', gemini: '#B29DD0', cancer: '#B6D4E4',
  leo: '#E0A9B4', virgo: '#B7D9B0', libra: '#D3A9DE', scorpio: '#B9DCE8',
  sagittarius: '#E0B080', capricorn: '#C0DEA8', aquarius: '#AE8FC9', pisces: '#A9D4C4',
};

const SIGNS = [
  ['Aries', 'aries'], ['Taurus', 'taurus'], ['Gemini', 'gemini'], ['Cancer', 'cancer'],
  ['Leo', 'leo'], ['Virgo', 'virgo'], ['Libra', 'libra'], ['Scorpio', 'scorpio'],
  ['Sagittarius', 'sagittarius'], ['Capricorn', 'capricorn'], ['Aquarius', 'aquarius'], ['Pisces', 'pisces'],
] as const;

export interface ChartPreviewPlacement {
  label: 'Sun' | 'Moon' | 'Rising';
  sign: string;
  hue: string;
  degree: string;
}

export interface ChartPreviewModel {
  placements: ChartPreviewPlacement[];
  settings: string;
  /** The sign the lockup's ring brings forward: the Sun's, when the link settles it. */
  ringFront: string | null;
}

function wholeDegreePlacement(label: ChartPreviewPlacement['label'], longitude: number): ChartPreviewPlacement {
  const sign = SIGNS[Math.floor(longitude / 30)];
  return {
    label,
    sign: sign[0],
    hue: HUES[sign[1]],
    degree: `${longitude % 30} deg`,
  };
}

/** The preview placements of a positions code, for a preview link made before the code moved to the fragment. */
export function previewPlacementsFromToken(value: string): PreviewPlacements | null {
  const chart = decodePositionsLink(value);
  return chart ? previewPlacements(chart) : null;
}

/** The image shows the Sun, the Moon and the Rising sign to the whole degree. */
export function previewModel(placements: PreviewPlacements): ChartPreviewModel {
  const rows = [
    wholeDegreePlacement('Sun', placements.sun),
    wholeDegreePlacement('Moon', placements.moon),
  ];
  if (placements.rising !== null) rows.push(wholeDegreePlacement('Rising', placements.rising));
  return {
    placements: rows,
    settings: placements.rising !== null && placements.houses !== null
      ? `${placements.houses === 'whole' ? 'Whole sign' : 'Placidus'} / Tropical`
      : 'Reference positions / No houses / Tropical',
    // A link with a rising sign was made from a chart with a birth time.
    ringFront: ringFrontForWholeDegree(placements.sun, placements.rising !== null),
  };
}
