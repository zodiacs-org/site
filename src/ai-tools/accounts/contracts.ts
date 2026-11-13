import { z } from 'zod';
import { AI_RESULT_SCHEMA, INPUT_SCHEMAS, ORIGIN, ZONE_PATTERN } from '../contracts';
import { compatibilityInput, compatibilityPerson } from '../features/compatibility';

/**
 * "Save to my Zodiacs account": the one tool that needs a signed-in person.
 * Offered only where ZODIACS_ACCOUNTS_ENABLED=1 (and the 0.5.0 tools are on);
 * see docs/platform/zodiacs-ai/ACCOUNTS.md. Every other tool stays anonymous.
 */
export const ACCOUNTS_SWITCH_ENV = 'ZODIACS_ACCOUNTS_ENABLED';
export const SAVE_TOOL_NAME = 'save_to_zodiacs';
export type SaveToolName = typeof SAVE_TOOL_NAME;
/** Supabase's identity scope; saving is the separate server-issued permission below. */
export const ACCOUNT_SCOPES = ['openid'] as const;
export const ACCOUNT_PERMISSION = 'profile:save';
export const SAVE_KINDS = ['chart', 'comparison', 'occasion', 'week'] as const;
export type SaveKind = typeof SAVE_KINDS[number];
export const SAVED_RECORD_SCHEMA = 'zodiacs.assistant-save.v1';
/** The stored record's serialized size; the database checks a looser backstop on jsonb's text form. */
export const MAX_SAVED_RECORD_BYTES = 8192;
/** A single stored string; tool text is far shorter. */
export const MAX_SAVED_STRING = 600;
export const MAX_LABEL = 80;
/** Saved items per account, shared with the site's own saves; public.saved_pages enforces it. */
export const MAX_SAVED_ITEMS = 100;
export const PROFILE_URL = `${ORIGIN}/profile/`;

/** Plain text only: no control characters, markup or link syntax. */
export const PLAIN_TEXT = /^[^\u0000-\u001f\u007f-\u009f<>{}[\]\\`]+$/u;
const plainText = (max: number) => z.string().trim().min(1).max(max).regex(PLAIN_TEXT, 'Use plain text.');
const date = z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/);
const zone = z.string().min(1).max(64).regex(ZONE_PATTERN);

/** The personal-week details get_horoscope takes for a forecast of the person's week. */
export const weekInput = z.strictObject({
  birthDate: date.describe('The birth date given to get_horoscope, such as 1990-05-03.'),
  birthTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u).optional().describe('The birth time, if one was given; needs birthZone.'),
  birthZone: zone.optional().describe("The birthplace's time zone, needed with birthTime."),
  zone: zone.optional().describe("The person's own time zone, for the dates of the week."),
}).superRefine((args, context) => {
  if (args.birthTime !== undefined && !args.birthZone) context.addIssue({ code: 'custom', message: 'A birth time needs its time zone.' });
});

export const saveInput = z.strictObject({
  kind: z.enum(SAVE_KINDS).describe('What to save: chart (one person\'s chart), comparison (get_compatibility), occasion (get_occasion_sky) or week (the personal week from get_horoscope).'),
  label: plainText(MAX_LABEL).optional().describe('Optional short name for the saved item, such as "Our wedding day". Plain text.'),
  chart: compatibilityPerson.optional().describe('For kind chart: the same details as one side of get_compatibility, or { famous: "<name>" }.'),
  comparison: compatibilityInput.optional().describe('For kind comparison: exactly the arguments given to get_compatibility.'),
  occasion: INPUT_SCHEMAS.get_occasion_sky.optional().describe('For kind occasion: exactly the arguments given to get_occasion_sky.'),
  week: weekInput.optional().describe('For kind week: the birth details given to get_horoscope for the personal week.'),
}).superRefine((args, context) => {
  const given = (['chart', 'comparison', 'occasion', 'week'] as const).filter(key => args[key] !== undefined);
  if (given.length !== 1 || given[0] !== args.kind) context.addIssue({ code: 'custom', message: 'Give exactly the details for the kind being saved.' });
});
export type SaveInput = z.infer<typeof saveInput>;

const link = z.object({ title: z.string(), url: z.url() });
export const saveData = z.object({
  saved: z.literal(true),
  id: z.uuid(),
  kind: z.enum(SAVE_KINDS),
  title: z.string(),
  summary: z.string(),
  savedAt: z.string(),
  /** True when the same item was already in the account; it is not saved twice. */
  alreadySaved: z.boolean(),
  profileUrl: z.url(),
  note: z.string(),
});
export const SAVE_ERROR_SCHEMA = z.object({ schema: z.literal(AI_RESULT_SCHEMA), ok: z.literal(false), tool: z.literal(SAVE_TOOL_NAME),
  error: z.object({ code: z.string(), message: z.string(), retryAfterSeconds: z.number().optional() }) });
export const SAVE_OUTPUT_SCHEMA = z.union([
  z.object({ schema: z.literal(AI_RESULT_SCHEMA), ok: z.literal(true), tool: z.literal(SAVE_TOOL_NAME), data: saveData, links: z.array(link) }),
  SAVE_ERROR_SCHEMA,
]);
export type SaveResult = z.infer<typeof SAVE_OUTPUT_SCHEMA>;

export const SAVE_TITLE = 'Save to my Zodiacs account';
export const SAVE_DESCRIPTION = "Saves something Zodiacs worked out in this conversation to the person's own Zodiacs account at zodiacs.org, where they can see it on their profile: a birth chart, a compatibility comparison with its score, an occasion card with its rating, or a personal week ahead. Call it only when the person asks to save or keep one of these. Pass kind and, under the same name, exactly the arguments the earlier tool was given (for a week, the birth details given to get_horoscope); Zodiacs works the result out again and saves that, so nothing else can be saved. The person must sign in to their Zodiacs account; if they have not, it asks them to. Saving the same item twice keeps one copy.";
export const SAVE_NOTE = 'Saved to your Zodiacs account. You can see it on your profile and delete it there at any time.';
