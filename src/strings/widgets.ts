export const WIDGET_EN = Object.freeze({
  pageMetaTitle: 'Free Astrology Widgets: Moon, Sky & Birth Chart | Zodiacs.org',
  pageMetaDescription: 'Embed a moon phase, current sky, or private mini birth chart on any site. Sandboxed iframe and script modes, free with the Zodiacs.org credit intact.',
  pageKicker: 'Widgets',
  pageTitle: 'The sky, on your site.',
  pageIntro: 'Three small, private astrology tools for another site. The iframe is the primary mode; the script mode mounts the same sandboxed document. Every widget keeps its Zodiacs.org credit.',
  generatorTitle: 'Build an embed',
  widgetLabel: 'Widget',
  modeLabel: 'Embed mode',
  themeLabel: 'Theme',
  accentLabel: 'Accent',
  moonOption: 'Moon phase today',
  skyOption: 'The sky today',
  chartOption: 'Mini birth chart',
  iframeOption: 'Sandboxed iframe',
  scriptOption: 'Script mount',
  darkOption: 'Dark',
  lightOption: 'Light',
  previewTitle: 'Live preview',
  codeLabel: 'Embed code',
  copyAction: 'Copy embed code',
  copiedAction: 'Copied',
  backlinkNote: 'The Powered by Zodiacs.org link is part of every widget and is not removable.',
  // The sentence about the city list was added when an AI review pointed out
  // that the note claimed nothing is sent while the place field fetches
  // `/data/cities/<letter>.json` as a visitor types. `src/pages/widgets/` is the
  // only surface that renders this and it renders the English, but the four
  // localized copies in `src/strings/additions.{es,fr,it,pt}.mjs` still predate
  // that sentence: they are under the Phase 1 locale-catalog freeze and were
  // left alone. Re-translate them before any localized /widgets/ page ships, or
  // that page will understate what the widget requests.
  privacyNote: 'The mini chart computes inside its iframe: the birth date, time and place a visitor enters are not sent anywhere, and the chart is never uploaded. Typing a place does fetch a city list from zodiacs.org, picked by the first letter of what was typed, so that request reveals one letter and nothing more. Loading the widget is a request to zodiacs.org as well, like any embedded asset, so a visitor\'s browser reveals its IP address and your site\'s origin. Those are separate things.',
  sizeNote: 'The documents are standalone and lazy-load their heavier computation only after a mini-chart submission.',
  moonTitle: 'Moon phase today',
  moonSign: 'Moon in {sign}',
  illumination: '{percent}% illuminated',
  skyTitle: 'The sky today',
  retrograde: 'Retrograde: {planets}',
  retrogradeAbbreviation: 'Rx',
  noRetrograde: 'No planets retrograde',
  poweredBy: 'Powered by Zodiacs.org',
  chartTitle: 'Mini birth chart',
  chartIntro: 'Sun, Moon, and rising, computed privately here.',
  dateLabel: 'Birth date',
  timeLabel: 'Birth time',
  placeLabel: 'Birthplace',
  placePlaceholder: 'Start typing a city…',
  changePlace: 'Change birthplace',
  noPlaces: 'No places found',
  placeError: 'The offline place index could not load.',
  computeAction: 'Find the big three',
  computing: 'Computing…',
  chartError: 'The chart could not be computed in this browser.',
  chartPrivacy: 'Computed on this device. Nothing entered here is sent to a chart API.',
  requiresJavaScript: 'JavaScript is required for the calculation, but the form remains private and sends no birth details.',
  widgetError: 'Choose a complete date, time, and birthplace.',
  sun: 'Sun',
  moon: 'Moon',
  rising: 'Rising',
  widgetTitleMoon: 'Moon phase today | Zodiacs.org',
  widgetTitleSky: 'The sky today | Zodiacs.org',
  widgetTitleChart: 'Mini birth chart | Zodiacs.org',
});

export const WIDGET_SIGN_NAMES_EN = Object.freeze({
  aries: 'Aries',
  taurus: 'Taurus',
  gemini: 'Gemini',
  cancer: 'Cancer',
  leo: 'Leo',
  virgo: 'Virgo',
  libra: 'Libra',
  scorpio: 'Scorpio',
  sagittarius: 'Sagittarius',
  capricorn: 'Capricorn',
  aquarius: 'Aquarius',
  pisces: 'Pisces',
});

export const WIDGET_PLANET_NAMES_EN = Object.freeze({
  Sun: 'Sun',
  Moon: 'Moon',
  Mercury: 'Mercury',
  Venus: 'Venus',
  Mars: 'Mars',
  Jupiter: 'Jupiter',
  Saturn: 'Saturn',
  Uranus: 'Uranus',
  Neptune: 'Neptune',
  Pluto: 'Pluto',
});

export const WIDGET_PHASE_NAMES_EN: Readonly<Record<string, string>> = Object.freeze({
  'New Moon': 'New Moon',
  'Waxing Crescent': 'Waxing Crescent',
  'First Quarter': 'First Quarter',
  'Waxing Gibbous': 'Waxing Gibbous',
  'Full Moon': 'Full Moon',
  'Waning Gibbous': 'Waning Gibbous',
  'Last Quarter': 'Last Quarter',
  'Waning Crescent': 'Waning Crescent',
});

export function widgetText(
  key: keyof typeof WIDGET_EN,
  values: Record<string, string | number> = {},
): string {
  return WIDGET_EN[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));
}

export function widgetSignName(slug: string): string {
  return WIDGET_SIGN_NAMES_EN[slug as keyof typeof WIDGET_SIGN_NAMES_EN] ?? slug;
}

export function widgetPlanetName(body: string): string {
  return WIDGET_PLANET_NAMES_EN[body as keyof typeof WIDGET_PLANET_NAMES_EN] ?? body;
}

export function widgetPhaseName(phase: string): string {
  return WIDGET_PHASE_NAMES_EN[phase] ?? phase;
}
