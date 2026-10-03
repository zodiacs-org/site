import { z } from 'astro/zod';
import raw from '../../data/chart-of-the-day.json';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { const parsed = new Date(`${value}T00:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; });
const url = z.url().refine((value) => value.startsWith('https://'));
const translated = z.object({ en: z.string().min(1), es: z.string().min(1), pt: z.string().min(1), fr: z.string().min(1), it: z.string().min(1), ru: z.string().min(1) }).strict();
export const dailyEditionSchema = z.object({
  day: date, name: z.string().min(1), birthDate: date,
  // No speculative time from celebrity sites or rectification.
  birthTime: z.null(), timeQuality: z.literal('unknown'),
  birthSource: url, birthSourceTitle: z.string().min(1),
  newsSource: url, newsSourceTitle: z.string().min(1), newsDate: date,
  reliability: translated, reason: translated,
  ownerApproval: z.object({ approved: z.literal(true), approvedAt: z.iso.datetime(), evidence: z.string().min(20) }).strict(),
}).strict();
export type DailyEdition = z.infer<typeof dailyEditionSchema>;
export const dailyManifestSchema = z.object({ version: z.literal(1), editions: z.array(dailyEditionSchema) }).strict().superRefine(({ editions }, context) => {
  const seen = new Set<string>();
  for (const edition of editions) {
    if (seen.has(edition.day)) context.addIssue({ code: 'custom', message: 'Only one approved edition per day' });
    seen.add(edition.day);
    const lag = Date.parse(edition.day) - Date.parse(edition.newsDate);
    if (lag < 0 || lag > 7 * 86_400_000) context.addIssue({ code: 'custom', message: 'News source must be within the preceding week' });
    if (edition.birthDate < '1800-01-01' || edition.birthDate > '2199-12-31') context.addIssue({ code: 'custom', message: 'Birth date outside reference span' });
    if (edition.birthDate > edition.day) context.addIssue({ code: 'custom', message: 'Birth date cannot follow the edition date' });
  }
});
export const dailyEditions = dailyManifestSchema.parse(raw).editions;
export function editionForDay(day: string): DailyEdition | null { return dailyEditions.find((edition) => edition.day === day) ?? null; }
