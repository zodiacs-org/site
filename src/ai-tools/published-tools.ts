import { readFileSync } from 'node:fs';

/**
 * The thirteen tool definitions the directories reviewed, as the live server published them on 1 November 2026
 * (docs/platform/zodiacs-ai/evidence/0.6.0/), and as this release must answer them. For the release tests only.
 *
 * 0.6.5 takes a baby's arrival and a coming of age out of get_occasion_sky, after OpenAI's review found that the
 * baby occasion, with names, a place and coordinates, could collect identifying or locating details about a child
 * under 13. That changes four places, all in get_occasion_sky: its description, its occasion field's description
 * and the occasion enum in its input and output schemas. Every other byte of the thirteen stays as published.
 */
export const LIVE_TOOLS = JSON.parse(readFileSync(new URL('../../docs/platform/zodiacs-ai/evidence/0.6.0/tools-list.live-2026-11-01.json', import.meta.url), 'utf8')).result.tools as Record<string, unknown>[];

const DROPPED_OCCASIONS = ['baby', 'coming-of-age'];
const PUBLISHED_OCCASIONS = ['wedding', 'anniversary', 'met', 'birthday', 'baby', 'pet', 'home', 'job', 'graduation', 'retirement', 'coming-of-age', 'gathering'];
const TEXT_065: [string, string][] = [
  ['a wedding, anniversary, birthday, the day a baby arrived, a new home or another occasion', 'a wedding, anniversary, birthday, a new home or another occasion'],
  ['What the day is: wedding, anniversary, met (the day they met), birthday, baby (the day a baby arrived), pet, home, job, graduation, retirement, coming-of-age or gathering.',
    'What the day is: wedding, anniversary, met (the day they met), birthday, pet, home, job, graduation, retirement or gathering.'],
];

/** A published entry as 0.6.5 answers it, and the paths that changed. */
export function as065(tool: Record<string, unknown>): { tool: Record<string, unknown>; changed: string[] } {
  const changed: string[] = [];
  const walk = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) {
      if (JSON.stringify(value) === JSON.stringify(PUBLISHED_OCCASIONS)) {
        changed.push(path);
        return value.filter((kind) => !DROPPED_OCCASIONS.includes(kind));
      }
      return value.map((item, index) => walk(item, `${path}[${index}]`));
    }
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item, `${path}.${key}`)]));
    if (typeof value === 'string') {
      const next = TEXT_065.reduce((text, [before, after]) => text.replace(before, after), value);
      if (next !== value) changed.push(path);
      return next;
    }
    return value;
  };
  return { tool: walk(tool, String(tool.name)) as Record<string, unknown>, changed };
}

/** The thirteen as this release lists them. */
export const PUBLISHED_TOOLS = LIVE_TOOLS.map((tool) => as065(tool).tool);
