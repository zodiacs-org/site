import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { SIGN_SLUGS } from './lib/signs';
import { pairFacts } from './lib/compat';

const signEnum = z.enum(SIGN_SLUGS as [string, ...string[]]);
const faqSchema = z.array(z.object({ q: z.string(), a: z.string() }));
const sourcesSchema = z.array(z.object({ label: z.string(), href: z.url().optional() })).default([]);

function derivedPairFaq([slugA, slugB]: [string, string]) {
  const facts = pairFacts(slugA, slugB);
  const names = facts.same ? `two ${facts.a.name} people` : `${facts.a.name} and ${facts.b.name}`;
  const subject = facts.same ? `Two ${facts.a.name} people` : `${facts.a.name} and ${facts.b.name}`;

  return [
    {
      q: `How do ${names} work in a relationship?`,
      a: `${facts.element.label} is the starting pattern: ${facts.element.note} The rest of both birth charts decides how that pattern is lived.`,
    },
    {
      q: `Where do ${names} tend to clash?`,
      a: `${facts.modality.label} describes how decisions and pacing meet: ${facts.modality.note}`,
    },
    {
      q: `Are ${names} compatible?`,
      a: `${subject} can be. Sun signs describe a baseline, not a verdict. ${facts.polarity} A full comparison also reads both Moons, Venuses, Marses, and the aspects between the charts.`,
    },
  ];
}

const guides = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/guides' }),
  schema: z.object({
    sign: signEnum,
    title: z.string(),
    description: z.string().max(170),
    /** Compatibility shortlists — 3 easeful, 3 charged, by slug. */
    compat: z.object({
      easeful: z.array(signEnum).length(3),
      charged: z.array(signEnum).length(3),
    }),
    faq: faqSchema.min(4),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    sources: sourcesSchema,
    draft: z.boolean().default(false),
  }),
});

/**
 * Compatibility pair pages. Filename IS the canonical slug ({a}-{b} in
 * zodiac order); the signs tuple must match it — the pair route asserts
 * id === pairSlug(signs) at build time. Prose only: element/modality/
 * polarity facts are computed from signs.ts and rendered by the page.
 */
const pairs = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/pairs' }),
  schema: z.object({
    signs: z
      .tuple([signEnum, signEnum])
      .refine(
        ([a, b]) => SIGN_SLUGS.indexOf(a) <= SIGN_SLUGS.indexOf(b),
        { message: 'Pair signs must be in zodiac order (aries first, pisces last).' },
      ),
    title: z.string(),
    description: z.string().max(170),
    faq: faqSchema.min(3).optional(),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    draft: z.boolean().default(false),
  }).transform((data) => ({
    ...data,
    faq: data.faq ?? derivedPairFaq(data.signs),
  })),
});

/**
 * Learn cluster pages, organized by subdirectory: planets/, houses/,
 * aspects/. The id carries the subdir ("planets/saturn") and kind is the
 * discriminator the hub + slug routes filter on.
 */
const learn = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/learn' }),
  schema: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('planet'),
      planet: z.enum(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']),
      title: z.string(),
      description: z.string().max(170),
      /** One-line function of the planet, in the house voice. */
      role: z.string(),
      faq: faqSchema.min(3),
      published: z.coerce.date(),
      updated: z.coerce.date(),
      sources: sourcesSchema,
      draft: z.boolean().default(false),
    }),
    z.object({
      kind: z.literal('house'),
      house: z.number().int().min(1).max(12),
      title: z.string(),
      description: z.string().max(170),
      /** One-line territory of the house. */
      theme: z.string(),
      faq: faqSchema.min(3),
      published: z.coerce.date(),
      updated: z.coerce.date(),
      sources: sourcesSchema,
      draft: z.boolean().default(false),
    }),
    z.object({
      kind: z.literal('aspect'),
      aspect: z.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']),
      angle: z.number(),
      title: z.string(),
      description: z.string().max(170),
      /** One-line character of the aspect. */
      theme: z.string(),
      faq: faqSchema.min(3),
      published: z.coerce.date(),
      updated: z.coerce.date(),
      sources: sourcesSchema,
      draft: z.boolean().default(false),
    }),
    z.object({
      kind: z.literal('placement'),
      planet: z.enum(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']),
      sign: signEnum,
      title: z.string(),
      description: z.string().max(170),
      faq: faqSchema.min(3),
      published: z.coerce.date(),
      updated: z.coerce.date(),
      sources: sourcesSchema,
      draft: z.boolean().default(false),
    }),
    // Rising-sign profiles route at /rising-sign/{sign}/, not /learn/ —
    // the sitemap's learn loop must keep filtering this kind out.
    z.object({
      kind: z.literal('rising'),
      sign: signEnum,
      title: z.string(),
      description: z.string().max(170),
      faq: faqSchema.min(3),
      published: z.coerce.date(),
      updated: z.coerce.date(),
      sources: sourcesSchema,
      draft: z.boolean().default(false),
    }),
  ]),
});

/**
 * Birthday pages, one per calendar date (366 with Feb 29). Filename IS the
 * slug ({month}-{day}, e.g. july-7.mdx); the route asserts it matches the
 * month/day frontmatter. Prose only — sign, cusp tables, degree spans, and
 * decans are computed from src/data/birthdays.json and rendered by the page.
 */
const birthdays = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/birthdays' }),
  schema: z.object({
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    title: z.string(),
    description: z.string().max(170),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

/**
 * Monthly horoscopes. Files accumulate as YYYY-MM-{sign}.mdx and may be
 * written ahead of time; every route, the sitemap, the assistant guide, and
 * the freshness gate pick the same edition through
 * src/lib/horoscope-month.mjs — the latest month that is not after the
 * committed daily edition's month — and label it from frontmatter.
 */
const horoscopes = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/horoscopes' }),
  schema: z.object({
    sign: signEnum,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM'),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

/**
 * The Almanac: dated, long-form articles about the computed sky and the
 * tradition's reading of it. Unlike learn, this collection is deliberately
 * flat: each filename is its public slug.
 */
const almanac = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/almanac' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    sources: z.array(z.object({ label: z.string(), href: z.url().optional() })).min(1),
    draft: z.boolean().default(false),
  }),
});

/**
 * Translated Learn-family articles, one folder per language
 * (learn-i18n/{locale}/rising/{sign}.mdx). English stays in `learn`; this
 * collection only ever holds translations of entries that exist there.
 */
const learnLocalized = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/learn-i18n' }),
  schema: z.object({
    kind: z.literal('rising'),
    sign: signEnum,
    locale: z.enum(['es', 'pt', 'fr', 'it']),
    title: z.string().max(60),
    description: z.string().max(155),
    faq: faqSchema.min(3),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    sources: sourcesSchema,
    draft: z.boolean().default(false),
  }),
});

export const collections = { guides, pairs, learn, learnLocalized, horoscopes, birthdays, almanac };
