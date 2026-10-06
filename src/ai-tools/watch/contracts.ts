import { z } from 'zod';

export const WATCH_VERSION = 'sky-watch-v1:rc.16';
export const DAY = 86_400_000;
export const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export const NAMES = ['zodiacs.sky.ingress', 'zodiacs.sky.station', 'zodiacs.sky.lunation'] as const;
export type EventName = typeof NAMES[number];
const zone = z.string().max(80).default('UTC').refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
});
const choices = <T extends string>(values: readonly [T, ...T[]]) => z.array(z.enum(values)).min(1).max(values.length)
  .transform(values => [...new Set(values)].sort());
export const FILTERS = {
  'zodiacs.sky.ingress': z.object({ bodies: choices(BODIES), zone }).strict(),
  'zodiacs.sky.station': z.object({ bodies: choices(['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']), zone }).strict(),
  'zodiacs.sky.lunation': z.object({ phases: choices(['new', 'full']), zone }).strict(),
};
export type Filters = { bodies?: string[]; phases?: string[]; zone: string };
export const subscriptionParams = z.object({
  name: z.enum(NAMES), arguments: z.unknown(),
  delivery: z.object({ mode: z.literal('webhook'), url: z.string().max(2048), secret: z.string().max(100) }).strict(),
  cursor: z.null().optional(), ttlMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
}).strict();
export const unsubscribeParams = subscriptionParams.omit({ ttlMs: true, cursor: true }).extend({
  delivery: subscriptionParams.shape.delivery.omit({ secret: true }),
});

export const EVENT_DEFINITIONS = NAMES.map(name => ({
  name, description: name.endsWith('ingress') ? 'A selected body crosses a tropical zodiac sign boundary.'
    : name.endsWith('station') ? 'A selected planet changes between direct and retrograde motion.'
      : 'A selected new or full Moon occurs.',
  delivery: ['webhook'],
  inputSchema: { type: 'object', additionalProperties: false,
    properties: { ...(name.endsWith('lunation') ? { phases: { type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { enum: ['new', 'full'] } } }
      : { bodies: { type: 'array', minItems: 1, maxItems: 10, uniqueItems: true, items: { enum: name.endsWith('station') ? BODIES.slice(2) : BODIES } } }),
    zone: { type: 'string', description: 'IANA time zone for display; UTC by default.' } },
    required: [name.endsWith('lunation') ? 'phases' : 'bodies'],
  },
  payloadSchema: { type: 'object', additionalProperties: false, required: ['event', 'receipt', 'zone', 'localAt', 'methodUrl'], properties: {
    event: { type: 'object', description: 'Engine event, including kind, UTC at, sign and body or phase type.' },
    receipt: { type: 'object', description: 'Versioned calculation conventions and bounded-search completeness.' },
    zone: { type: 'string' }, localAt: { type: 'string' }, methodUrl: { type: 'string' },
  } },
}));

export type Rpc = <T = any>(operation: string, input?: Record<string, unknown>) => Promise<T>;
export interface Principal { id: string; expires_at: string }
export interface Destination { url: string; secret: string }
export interface Delivery {
  subscription_id: string; event_id: string; lease: string; attempts: number; revision: number;
  sealed: string; previous_sealed: string | null; rotate_until: string | null;
  filters: Filters; payload: { eventId: string; name: EventName; timestamp: string; data: { event: Record<string, unknown>; receipt: unknown }; cursor: null };
}
