import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOOL_DESCRIPTIONS } from './contracts';
import { OUTSIDE_ZODIACS, WHICH_TOOL } from './server';
import { PUBLISHED_TOOLS } from './published-tools';

/**
 * ZOD-207 (a draft on top of ZOD-58): the wording added after 200 questions were tried on two assistants
 * (docs/platform/evidence/assistant-tryouts-20261113/). It lives in the server instructions and in two of the
 * descriptions that are not among the thirteen published ones. The thirteen keep the text ZOD-58 pins.
 */
const branch = (file: string) => JSON.parse(readFileSync(new URL(`../../docs/platform/evidence/assistant-tryouts-20261113/raw/branch/${file}`, import.meta.url), 'utf8'));

describe('the routing wording from the assistant tryouts', () => {
  it('is said as facts about Zodiacs, with no order to the assistant and no dash', () => {
    for (const text of [OUTSIDE_ZODIACS, WHICH_TOOL, TOOL_DESCRIPTIONS.get_natal_chart, TOOL_DESCRIPTIONS.explain_astrology]) {
      expect(text).not.toMatch(/do not call its tools|plainly and confidently|tell the person|[–—’]/u);
    }
    expect(OUTSIDE_ZODIACS).toContain('No Zodiacs tool is for such a request, not even as a first step');
    expect(WHICH_TOOL).toContain('goes to open_chart_studio');
    expect(TOOL_DESCRIPTIONS.get_natal_chart).toContain('open_chart_studio opens with no details');
    expect(TOOL_DESCRIPTIONS.explain_astrology).toContain('get_compatibility compares their charts instead');
  });

  it('is what the tryouts ran: the saved tools/list and instructions are this source', () => {
    const listed = branch('tools-list.json').tools as { name: string; description: string }[];
    for (const { name, description } of listed) expect(description, name).toBe(TOOL_DESCRIPTIONS[name as keyof typeof TOOL_DESCRIPTIONS]);
    const instructions = branch('initialize.json').instructions as string;
    expect(instructions).toContain(OUTSIDE_ZODIACS);
    expect(instructions.endsWith(WHICH_TOOL)).toBe(true);
  });

  it('leaves the thirteen published definitions as ZOD-58 pins them', () => {
    const listed = branch('tools-list.json').tools as Record<string, unknown>[];
    expect(JSON.stringify(listed.slice(0, 13))).toBe(JSON.stringify(PUBLISHED_TOOLS));
  });
});
