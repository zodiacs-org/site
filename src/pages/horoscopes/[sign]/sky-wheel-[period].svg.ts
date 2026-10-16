/**
 * The wheel under each horoscope reading: the edition's sky at noon UTC,
 * counted from the sign, with the planets that period's reading cites in
 * colour. Rendered at build by the shared Wheel component; see
 * src/lib/horoscope-wheel.ts.
 */
import type { APIRoute } from 'astro';
import dailyData from '../../../data/daily.json';
import programData from '../../../data/horoscope-program.json';
import type { Daily } from '../../../lib/daily';
import { editionDateLabel } from '../../../lib/edition-freshness';
import { pageReadingFromProgram } from '../../../lib/horoscope-page-data';
import type { HoroscopeProgram, HoroscopeSign } from '../../../lib/horoscope-program';
import { horoscopeWheelFocus, horoscopeWheelSvg } from '../../../lib/horoscope-wheel';
import { SIGNS } from '../../../lib/signs';

/** One wheel per period page; monthly reads dated events, so none is lit. */
const HOROSCOPE_WHEEL_PERIODS = ['today', 'tomorrow', 'weekly', 'monthly', 'love', 'career', 'year'] as const;
type Period = (typeof HOROSCOPE_WHEEL_PERIODS)[number];

export function getStaticPaths() {
  return SIGNS.flatMap((sign) => HOROSCOPE_WHEEL_PERIODS.map((period) => ({
    params: { sign: sign.slug, period },
    props: { signSlug: sign.slug, signName: sign.name, period },
  })));
}

export const GET: APIRoute = ({ props }) => {
  const { signSlug, signName, period } = props as { signSlug: string; signName: string; period: Period };
  const daily = dailyData as Daily;
  const reading = period === 'monthly'
    ? null
    : pageReadingFromProgram(programData as HoroscopeProgram, signSlug as HoroscopeSign, period);
  const svg = horoscopeWheelSvg({
    daily,
    signSlug,
    focus: horoscopeWheelFocus(reading?.sky, daily),
    label: `The sky at noon UTC on ${editionDateLabel(daily.date)}, counted from ${signName} as the first house`,
  });
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
};
