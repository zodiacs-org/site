import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { TOOL_DESCRIPTIONS } from './contracts';
import { ASK_FIRST, CHILD_HOROSCOPE, OUTSIDE_ZODIACS, WHICH_TOOL } from './server';
import { executeAiTool } from './tools';
import { PLAIN_DESCRIPTIONS, PUBLISHED_TOOLS, ZOD_207_SENTENCES } from './published-tools';

/**
 * ZOD-207 (a draft on top of ZOD-58): the wording added after 200 questions were tried on two assistants
 * (docs/platform/evidence/assistant-tryouts-20261113/). It lives in the server instructions, in three of the
 * descriptions that are not among the thirteen published ones, and, since the owner's answers of 13 November 2026
 * (17:12 Asia/Bangkok), in four of the thirteen: get_horoscope, check_sky_fact, get_upcoming_events and
 * open_chart_studio, so that declining and Chart Studio routing hold when a host withholds the instructions.
 * raw/pr971b/ is PR 971's list at 989c49537; raw/fix-round/ is this source's.
 */
const saved = (folder: string, file: string) => JSON.parse(readFileSync(new URL(`../../docs/platform/evidence/assistant-tryouts-20261113/raw/${folder}/${file}`, import.meta.url), 'utf8'));
type Listed = { name: string; description: string };
const FOUR = ['check_sky_fact', 'get_horoscope', 'get_upcoming_events', 'open_chart_studio'];
const NOT_A_REQUEST = /is not a request for this tool, not even (?:as a first step|to look the date up first)/u;

describe('the routing wording from the assistant tryouts', () => {
  it('is said without the orders ZOD-58 took out, and with no dash', () => {
    // The consumer rule: no description names crypto or tokens, even to decline them.
    for (const description of Object.values(TOOL_DESCRIPTIONS)) expect(description).not.toMatch(/crypto|token|blockchain|NFT/u);
    for (const text of [OUTSIDE_ZODIACS, WHICH_TOOL, CHILD_HOROSCOPE, TOOL_DESCRIPTIONS.get_natal_chart, TOOL_DESCRIPTIONS.explain_astrology, TOOL_DESCRIPTIONS.get_horoscope_period, ...FOUR.map(name => TOOL_DESCRIPTIONS[name as keyof typeof TOOL_DESCRIPTIONS])]) {
      expect(text).not.toMatch(/do not call its tools|plainly and confidently|tell the person|[–—’]/u);
    }
    expect(OUTSIDE_ZODIACS).toContain('No Zodiacs tool is for such a request, not even as a first step');
    expect(OUTSIDE_ZODIACS).not.toMatch(/crypto|token|blockchain|NFT/u);
    expect(WHICH_TOOL).toContain('goes to open_chart_studio');
    expect(TOOL_DESCRIPTIONS.get_natal_chart).toContain('belongs to open_chart_studio, which opens with no details');
    expect(TOOL_DESCRIPTIONS.explain_astrology).toContain('Two people with birth dates belong to get_compatibility');
    expect(TOOL_DESCRIPTIONS.explain_astrology).toContain('The sign of a calendar date belongs to get_birthday.');
    expect(TOOL_DESCRIPTIONS.explain_astrology).toContain('are not requests for this tool, not even as a first step');
  });

  it('is the saved tools/list and instructions of the fix round', () => {
    const listed = saved('fix-round', 'tools-list.json').tools as Listed[];
    for (const { name, description } of listed) expect(description, name).toBe(TOOL_DESCRIPTIONS[name as keyof typeof TOOL_DESCRIPTIONS]);
    expect(JSON.stringify(listed.slice(0, 13))).toBe(JSON.stringify(PUBLISHED_TOOLS));
    const instructions = saved('fix-round', 'initialize.json').instructions as string;
    expect(instructions).toContain(OUTSIDE_ZODIACS);
    expect(instructions).toContain(CHILD_HOROSCOPE);
    expect(instructions.endsWith(WHICH_TOOL)).toBe(true);
  });
});

describe('someone else\'s birth details', () => {
  it('are asked about first, in the instructions as in get_capabilities', async () => {
    expect(ASK_FIRST).toBe('Ask before using someone else\'s birth details.');
    const instructions = saved('fix-round', 'initialize.json').instructions as string;
    expect(instructions).toContain(ASK_FIRST);
    expect(instructions).not.toMatch(/the person asking answers for that|take the details as given/u);
    const capabilities = await executeAiTool('get_capabilities', {}, { occasions: true, coverage: true });
    if (!capabilities.ok || capabilities.tool !== 'get_capabilities') throw new Error(JSON.stringify(capabilities));
    expect(capabilities.data.privacy).toContain(ASK_FIRST);
    for (const description of Object.values(TOOL_DESCRIPTIONS)) expect(description).not.toMatch(/the person asking answers for that|take the details as given/u);
  });
});

describe('the four published descriptions the owner approved changing on 13 November 2026', () => {
  it('differ from PR 971 at 989c49537 only by the ZOD-207 sentences, and nothing else in the thirteen moved', () => {
    expect(Object.keys(ZOD_207_SENTENCES).sort()).toEqual(FOUR);
    const before = saved('pr971b', 'tools-list.json').tools as Listed[];
    const after = saved('fix-round', 'tools-list.json').tools as Listed[];
    expect(after.map(tool => tool.name)).toEqual(before.map(tool => tool.name));
    for (const [index, tool] of after.slice(0, 13).entries()) {
      let description = tool.description;
      for (const [was, now] of ZOD_207_SENTENCES[tool.name] ?? []) {
        expect(description.split(now).length, `${tool.name}: ${now.slice(0, 40)}`).toBe(2);
        expect(now.startsWith(was.replace(/\.$/u, '')), tool.name).toBe(tool.name !== 'open_chart_studio');
        description = description.replace(now, was);
      }
      expect(JSON.stringify({ ...tool, description }), tool.name).toBe(JSON.stringify(before[index]));
      expect(tool.description !== before[index].description, tool.name).toBe(FOUR.includes(tool.name));
      expect(PLAIN_DESCRIPTIONS[tool.name], tool.name).toBe(tool.description);
    }
  });

  it('say what is not a request for the tool, so declining does not rest on the server instructions', () => {
    const { get_horoscope: horoscope, check_sky_fact: fact, get_upcoming_events: events } = TOOL_DESCRIPTIONS;
    for (const text of [horoscope, fact, events]) expect(text).toMatch(NOT_A_REQUEST);
    // Stock and lottery picks, investment calls, bets, election and health forecasts, guarantees.
    expect(horoscope).toMatch(/no betting tips, sports picks, stock picks, investment timing, financial forecasts, election forecasts, health predictions or guaranteed outcomes, including when such a request mentions a horoscope\. A request for one of those is not a request for this tool, not even as a first step: Zodiacs does not do this/u);
    for (const text of [fact, events]) expect(text).toMatch(/a stock or lottery pick, an investment call, a bet, an election or health forecast, or a guarantee/u);
    expect(fact).toContain('Whether a retrograde, a sign or a Moon phase makes a good time to buy, sell, bet or invest is not a claim about the sky.');
    // Reminders and anything scheduled.
    expect(events).toContain('A request to set a reminder or an alert, or to schedule anything, is not a request for this tool, not even to look the date up first: Zodiacs sets no reminders and schedules nothing.');
    expect(horoscope).toContain('a reminder or a horoscope on a schedule is not a request for this tool either');
  });

  it('send a chart asked for with no birth date to Chart Studio, and a horoscope with no sign to get_horoscope', () => {
    const studio = TOOL_DESCRIPTIONS.open_chart_studio;
    expect(studio).toContain('It takes no input, so it opens before any birth detail is given.');
    expect(studio).toContain('It fits a request for a birth chart, a rising sign or a Moon sign when no birth date is in the conversation');
    expect(studio).toContain('nothing has to be asked for beforehand');
    expect(TOOL_DESCRIPTIONS.get_horoscope).toContain('A horoscope asked for with no sign named still belongs here');
  });

  it('give no horoscope for a named child under 13, and the general one for a Sun sign alone', () => {
    for (const text of [TOOL_DESCRIPTIONS.get_horoscope, TOOL_DESCRIPTIONS.get_horoscope_period, CHILD_HOROSCOPE]) {
      expect(text).toContain('There is no horoscope for a named child under 13, meaning a particular child the request names or points to');
      expect(text).toMatch(/A Sun sign on its own, with no name and no birth date, gets the general (?:horoscope|reading) for that sign\./u);
    }
    expect(TOOL_DESCRIPTIONS.get_horoscope).toContain('It refuses a birth date less than 13 years ago.');
  });
});
