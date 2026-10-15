/**
 * The WebMCP tool each calculator page registers (Track A2): its name, what it does, and the input it takes. The
 * descriptors are small and ship in /assets/webmcp-register.js; a tool's calculation ships in
 * /assets/webmcp-calculators.js, which a page loads only when an agent calls the tool. Every calculation runs in the
 * browser, as the page's own does: nothing is sent anywhere.
 *
 * A page's tool is found from its path, with any released locale's prefix removed, so /es/moon-phase/ registers the
 * same tool as /moon-phase/. Descriptions are written for agents, in English, in every locale.
 */
export const CALCULATOR_RUNTIME_URL = '/assets/webmcp-calculators.js?v=calculators-1';

const LOCALE_PREFIX = /^\/(?:es|pt|fr|it|ru)(?=\/)/u;

const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'A calendar date, YYYY-MM-DD.' } as const;
const TIME = { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: 'A 24-hour clock time, HH:MM.' } as const;
const PLACE = {
  type: 'object',
  description: 'Where: the place\'s coordinates and its IANA time zone, such as Europe/Paris.',
  properties: {
    latitude: { type: 'number', minimum: -90, maximum: 90, description: 'Degrees north (negative south).' },
    longitude: { type: 'number', minimum: -180, maximum: 180, description: 'Degrees east (negative west).' },
    timeZone: { type: 'string', minLength: 1, maxLength: 64, description: 'IANA time zone name.' },
  },
  required: ['latitude', 'longitude', 'timeZone'],
  additionalProperties: false,
} as const;

export interface CalculatorToolDescriptor {
  name: string;
  /** The page's path without a locale prefix. */
  path: string;
  title: string;
  description: string;
  inputSchema: Readonly<Record<string, unknown>>;
}

export const CALCULATOR_TOOLS: readonly CalculatorToolDescriptor[] = Object.freeze([
  {
    name: 'zodiacs.moon_phase',
    path: '/moon-phase/',
    title: 'Moon phase',
    description: 'The Moon\'s phase on a date, as this page shows it: the phase\'s name, how much of the disc is lit, the '
      + 'Moon\'s sign and degree, and the UTC instant read. Give a time and a place for that moment; without a time it '
      + 'reads noon (local noon at the place, or noon UTC), and without a place it reads the time as UTC. Calculated in '
      + 'the browser; nothing is sent.',
    inputSchema: {
      type: 'object',
      properties: { date: DATE, time: TIME, place: PLACE },
      required: ['date'],
      additionalProperties: false,
    },
  },
]);

/** The calculator tool a page path registers, or null when the page has none. */
export function calculatorToolForPath(path: string): CalculatorToolDescriptor | null {
  const plain = path.replace(LOCALE_PREFIX, '');
  return CALCULATOR_TOOLS.find((tool) => tool.path === plain) ?? null;
}
