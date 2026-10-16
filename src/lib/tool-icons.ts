/**
 * The tool icon set: one line drawing per tool, on a flat pastel disc, drawn
 * the way the twelve sign icons are (the same dark line, the same weight, the
 * same round disc in one of the twelve sign hues). The hue follows the
 * subject where there is a natural link: the Moon's tools wear Cancer, the
 * Sun's wear Leo, Saturn return wears Capricorn, Compatibility wears Libra.
 *
 * Every drawing sits on a 24 x 24 grid and is stroked, never filled, at 1.5
 * units with round caps and joins; ToolIcon.astro supplies those attributes.
 * A shape that must hide the line behind it (the Moon crossing the Sun in
 * Eclipses) fills with the disc's own hue through --tool-icon-hue.
 *
 * Render with src/components/ToolIcon.astro. TOOL_ICON_FOR_PATH maps each
 * tool route to its icon so a page can ask by href.
 */
/** The twelve sign hues, as the --sign-* custom properties name them. */
export type ToolIconHue =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export type ToolIconName =
  | 'birth-chart'
  | 'moon-sign'
  | 'rising-sign'
  | 'big-three'
  | 'birthday'
  | 'numerology'
  | 'chart-pdf'
  | 'compatibility'
  | 'someone-else'
  | 'invite'
  | 'group-charts'
  | 'chart-twins'
  | 'baby-zodiac'
  | 'today'
  | 'moon-phase'
  | 'horoscopes'
  | 'transits'
  | 'void-of-course'
  | 'chart-of-the-day'
  | 'saturn-return'
  | 'solar-return'
  | 'lunar-return'
  | 'sky-wrapped'
  | 'eclipses'
  | 'retrogrades'
  | 'full-moon-calendar'
  | 'sky-calendar'
  | 'sky-events'
  | 'guide'
  | 'privacy';

export interface ToolIconDrawing {
  /** The sign whose pastel hue paints the disc. */
  hue: ToolIconHue;
  /** Inner SVG markup on the 24 x 24 grid. */
  body: string;
}

/** The return arrow shared by the three return tools, around their own body. */
const RETURN_ARROW = '<path d="M20.3 12a8.3 8.3 0 1 1-2.43-5.87L20.3 8.5"/><path d="M20.3 4.4v4.1h-4.1"/>';

export const TOOL_ICONS: Readonly<Record<ToolIconName, ToolIconDrawing>> = {
  // A chart wheel: the circle, the inner ring and the six house spokes.
  'birth-chart': {
    hue: 'aries',
    body: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.4"/><path d="M15.4 12h5.1M8.6 12H3.5M13.7 9.06l2.55-4.42M10.3 9.06 7.75 4.64M10.3 14.94l-2.55 4.42M13.7 14.94l2.55 4.42"/>',
  },
  // A crescent.
  'moon-sign': {
    hue: 'cancer',
    body: '<path d="M15.2 4.2a8.2 8.2 0 1 0 4.8 12 6.6 6.6 0 0 1-4.8-12Z"/>',
  },
  // The Sun on the eastern horizon.
  'rising-sign': {
    hue: 'sagittarius',
    body: '<path d="M3.5 17h17"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M12 5.2v3M6.1 8.2l2 2M17.9 8.2l-2 2"/>',
  },
  // Three linked placements.
  'big-three': {
    hue: 'leo',
    body: '<circle cx="12" cy="6.4" r="2.7"/><circle cx="6.4" cy="16.6" r="2.7"/><circle cx="17.6" cy="16.6" r="2.7"/><path d="M10.7 8.8 7.7 14.2M13.3 8.8l3 5.4M9.1 16.6h5.8"/>',
  },
  // A cake with one candle.
  birthday: {
    hue: 'taurus',
    body: '<path d="M4.5 19.8h15"/><path d="M6.2 19.8v-6.3a1.6 1.6 0 0 1 1.6-1.6h8.4a1.6 1.6 0 0 1 1.6 1.6v6.3"/><path d="M6.2 15.4c1.3 0 1.7 1.1 2.95 1.1s1.6-1.1 2.85-1.1 1.6 1.1 2.85 1.1 1.65-1.1 2.95-1.1"/><path d="M12 11.9V8.6"/><path d="M12 3.9c1.1 1.1 1.4 2 .75 2.75a1 1 0 0 1-1.5 0c-.65-.75-.35-1.65.75-2.75Z"/>',
  },
  // A crossed seven in a tile.
  numerology: {
    hue: 'scorpio',
    body: '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.4"/><path d="M9 8.6h6.2l-3.6 7.6"/><path d="M10.4 12.4h3.6"/>',
  },
  // A page with a folded corner and a chart circle.
  'chart-pdf': {
    hue: 'gemini',
    body: '<path d="M6.5 3.6h7.6l4.4 4.4v12.4h-12Z"/><path d="M13.9 3.6v4.6h4.6"/><circle cx="12.5" cy="14.3" r="3.1"/>',
  },
  // Two linked rings.
  compatibility: {
    hue: 'libra',
    body: '<circle cx="9" cy="12" r="5.6"/><circle cx="15" cy="12" r="5.6"/>',
  },
  // A person inside a chart circle.
  'someone-else': {
    hue: 'pisces',
    body: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h1.4M19.1 12h1.4"/><circle cx="12" cy="9.9" r="2.7"/><path d="M7.3 18.3a5.1 5.1 0 0 1 9.4 0"/>',
  },
  // A paper plane.
  invite: {
    hue: 'aquarius',
    body: '<path d="M20.5 3.6 3.6 10.3l6.6 3.4 3.4 6.7Z"/><path d="M10.2 13.7 20.5 3.6"/>',
  },
  // Three overlapping rings.
  'group-charts': {
    hue: 'sagittarius',
    body: '<circle cx="12" cy="8.6" r="4.7"/><circle cx="8.4" cy="14.9" r="4.7"/><circle cx="15.6" cy="14.9" r="4.7"/>',
  },
  // Two people side by side.
  'chart-twins': {
    hue: 'gemini',
    body: '<circle cx="7.6" cy="9" r="2.6"/><path d="M3.4 18.6a4.3 4.3 0 0 1 8.4 0"/><circle cx="16.4" cy="9" r="2.6"/><path d="M12.2 18.6a4.3 4.3 0 0 1 8.4 0"/>',
  },
  // A sleeping baby's face with a curl.
  'baby-zodiac': {
    hue: 'cancer',
    body: '<circle cx="12" cy="13.2" r="7"/><path d="M12 6.2c-.5-1.7.4-3 1.9-2.9 1 .1 1.3 1.1.6 1.6"/><path d="M8.6 13.1q1 .9 2 0M13.4 13.1q1 .9 2 0"/><path d="M10.6 16.4q1.4.9 2.8 0"/>',
  },
  // The Sun with eight rays.
  today: {
    hue: 'leo',
    body: '<circle cx="12" cy="12" r="3.9"/><path d="M12 3.3v2.4M12 18.3v2.4M3.3 12h2.4M18.3 12h2.4M5.85 5.85l1.7 1.7M16.45 16.45l1.7 1.7M5.85 18.15l1.7-1.7M16.45 7.55l1.7-1.7"/>',
  },
  // A full disc with its terminator.
  'moon-phase': {
    hue: 'cancer',
    body: '<circle cx="12" cy="12" r="8.3"/><path d="M12 3.7a4.3 8.3 0 0 1 0 16.6"/>',
  },
  // An open book.
  horoscopes: {
    hue: 'aries',
    body: '<path d="M12 7C10.1 5.6 7.3 5.1 3.8 5.4v12.7c3.5-.3 6.3.2 8.2 1.6 1.9-1.4 4.7-1.9 8.2-1.6V5.4C16.7 5.1 13.9 5.6 12 7Z"/><path d="M12 7v12.7"/>',
  },
  // A planet on a dashed orbit around the chart.
  transits: {
    hue: 'sagittarius',
    body: '<circle cx="12" cy="12" r="8.3" stroke-dasharray="2.3 2.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17.9" cy="6.1" r="2" fill="currentColor" stroke="none"/>',
  },
  // A crescent trailing three dots.
  'void-of-course': {
    hue: 'pisces',
    body: '<path d="M11.4 5.1a7 7 0 1 0 3.2 11.6 5.6 5.6 0 0 1-3.2-11.6Z"/><circle cx="16.9" cy="7.2" r="1" fill="currentColor" stroke="none"/><circle cx="19.4" cy="10.4" r="1" fill="currentColor" stroke="none"/><circle cx="20.3" cy="14.2" r="1" fill="currentColor" stroke="none"/>',
  },
  // A person with a four-pointed star.
  'chart-of-the-day': {
    hue: 'virgo',
    body: '<circle cx="10.2" cy="9.4" r="3"/><path d="M4.4 19.6a5.8 5.8 0 0 1 11.6 0"/><path d="M18 3.2C18.36 5.5 18.9 6.04 21.2 6.4C18.9 6.76 18.36 7.3 18 9.6C17.64 7.3 17.1 6.76 14.8 6.4C17.1 6.04 17.64 5.5 18 3.2Z"/>',
  },
  // A ringed planet inside the return arrow. The planet hides the back of
  // its ring and the front arc is drawn again over it, so the ring reads as
  // passing in front at small sizes instead of crossing the planet.
  'saturn-return': {
    hue: 'capricorn',
    body: `${RETURN_ARROW}<ellipse cx="12" cy="12" rx="5.2" ry="1.7" transform="rotate(-24 12 12)"/><circle cx="12" cy="12" r="2.6" style="fill:var(--tool-icon-hue)"/><path d="M7.25 14.12A5.2 1.7 -24 0 0 16.75 9.88"/>`,
  },
  // The Sun's circled dot inside the return arrow.
  'solar-return': {
    hue: 'leo',
    body: `${RETURN_ARROW}<circle cx="12" cy="12" r="3.1"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/>`,
  },
  // A crescent inside the return arrow.
  'lunar-return': {
    hue: 'cancer',
    body: `${RETURN_ARROW}<path d="M13.4 8.3a4 4 0 1 0 2.4 5.9 3.2 3.2 0 0 1-2.4-5.9Z"/>`,
  },
  // A wrapped gift.
  'sky-wrapped': {
    hue: 'sagittarius',
    body: '<rect x="4.2" y="8.6" width="15.6" height="3.6" rx="1"/><path d="M5.6 12.2v7.6h12.8v-7.6"/><path d="M12 8.6v11.2"/><path d="M12 8.6c-1-2.9-4.6-3.9-4.6-1.6 0 1.3 2.4 1.6 4.6 1.6 2.2 0 4.6-.3 4.6-1.6 0-2.3-3.6-1.3-4.6 1.6Z"/>',
  },
  // The Moon passing over the Sun.
  eclipses: {
    hue: 'scorpio',
    body: '<circle cx="9.8" cy="9.8" r="5.4"/><path d="M3.3 9.8H2.6M9.8 3.3v-.7M5.2 5.2l-.5-.5"/><circle cx="14.2" cy="14.2" r="5.4" style="fill:var(--tool-icon-hue)"/>',
  },
  // A retrograde loop with its arrow.
  retrogrades: {
    hue: 'gemini',
    body: '<path d="M3.5 17.4C9.2 17.4 14.6 13.3 14.6 9.1c0-2.4-1.7-3.7-3.1-3.7-1.6 0-2.7 1.4-2.7 3.1 0 4.3 5.2 7.3 11.6 7.3"/><path d="M18.2 13.5l2.3 2.3-2.3 2.3"/>',
  },
  // A full moon with its maria.
  'full-moon-calendar': {
    hue: 'pisces',
    body: '<circle cx="12" cy="12" r="8.3"/><circle cx="9.2" cy="9.6" r="1.8"/><circle cx="14.6" cy="14.6" r="1.3"/><circle cx="14.4" cy="8.4" r=".8"/>',
  },
  // A calendar page with a star.
  'sky-calendar': {
    hue: 'taurus',
    body: '<rect x="4.2" y="5.6" width="15.6" height="14.4" rx="2.2"/><path d="M4.2 9.6h15.6M8.6 3.6v3.6M15.4 3.6v3.6"/><path d="M12 11.9C12.32 13.99 12.81 14.48 14.9 14.8C12.81 15.12 12.32 15.61 12 17.7C11.68 15.61 11.19 15.12 9.1 14.8C11.19 14.48 11.68 13.99 12 11.9Z"/>',
  },
  // A shooting star.
  'sky-events': {
    hue: 'aquarius',
    body: '<path d="M16.2 3.9C16.64 6.71 17.29 7.36 20.1 7.8C17.29 8.24 16.64 8.89 16.2 11.7C15.76 8.89 15.11 8.24 12.3 7.8C15.11 7.36 15.76 6.71 16.2 3.9Z"/><path d="M12.4 11.6 4.4 19.6M9.7 9.8l-4.2 4.2M14.2 14.3 10 18.5"/>',
  },
  // A speech bubble.
  guide: {
    hue: 'gemini',
    body: '<path d="M5.2 5.2h13.6a1.7 1.7 0 0 1 1.7 1.7v8.2a1.7 1.7 0 0 1-1.7 1.7h-7.1L7.2 20v-3.2h-2a1.7 1.7 0 0 1-1.7-1.7V6.9a1.7 1.7 0 0 1 1.7-1.7Z"/><path d="M8 9.6h8M8 12.6h5"/>',
  },
  // A padlock.
  privacy: {
    hue: 'scorpio',
    body: '<rect x="5.4" y="10.6" width="13.2" height="9.6" rx="2.2"/><path d="M8.4 10.6V8.2a3.6 3.6 0 0 1 7.2 0v2.4"/><path d="M12 14.2v2.4"/>',
  },
};

export const TOOL_ICON_NAMES = Object.keys(TOOL_ICONS) as ToolIconName[];

/** Each tool route (English path) and the icon it wears wherever it is listed. */
export const TOOL_ICON_FOR_PATH: Readonly<Record<string, ToolIconName>> = {
  '/birth-chart/': 'birth-chart',
  '/moon-sign/': 'moon-sign',
  '/rising-sign/': 'rising-sign',
  '/big-three/': 'big-three',
  '/birthday/': 'birthday',
  '/numerology/': 'numerology',
  '/astrologer-kit/': 'chart-pdf',
  '/compatibility/': 'compatibility',
  '/birth-chart/someone-else/': 'someone-else',
  '/compatibility/invite/': 'invite',
  '/group-charts/': 'group-charts',
  '/chart-twins/': 'chart-twins',
  '/baby-zodiac/': 'baby-zodiac',
  '/today/': 'today',
  '/moon-phase/': 'moon-phase',
  '/horoscopes/': 'horoscopes',
  '/transits/': 'transits',
  '/void-of-course-moon/': 'void-of-course',
  '/chart-of-the-day/': 'chart-of-the-day',
  '/saturn-return/': 'saturn-return',
  '/solar-return/': 'solar-return',
  '/lunar-return/': 'lunar-return',
  '/your-sky-wrapped/': 'sky-wrapped',
  '/eclipses/': 'eclipses',
  '/retrogrades/': 'retrogrades',
  '/full-moon-calendar/': 'full-moon-calendar',
  '/sky-calendar/': 'sky-calendar',
  '/events/': 'sky-events',
  '/ask/': 'guide',
  '/privacy/': 'privacy',
};

/** The icon for a tool route, accepting a localized path such as /es/moon-sign/. */
export function toolIconForPath(path: string): ToolIconName | undefined {
  const english = path.replace(/^\/(?:es|pt|fr|it|ru)(?=\/)/u, '');
  return TOOL_ICON_FOR_PATH[english];
}
