import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OTHER_LABELLED,
  PROJECT_ID,
  TEAM_ID,
  UNLABELLED,
  bangkokWindow,
  botRow,
  isMachineOnlyPath,
  normaliseRows,
  pathFamily,
  querySpecs,
  renderTable,
  summarise,
} from './crawler-counts.mjs';

const fixture = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures/crawler-counts-sample.json'), 'utf8'));

describe('crawler counts', () => {
  it('sorts paths into families, ignoring locales and query strings', () => {
    expect(pathFamily('/birth-chart/')).toBe('calculators');
    expect(pathFamily('/es/moon-sign/?ref=chatgpt')).toBe('calculators');
    expect(pathFamily('/compatibility/')).toBe('calculators');
    expect(pathFamily('/compatibility/aries-taurus/')).toBe('learn');
    expect(pathFamily('/learn/planets/')).toBe('learn');
    expect(pathFamily('/horoscopes/leo/')).toBe('horoscopes');
    expect(pathFamily('/mercury-retrograde/2027/')).toBe('events');
    expect(pathFamily('/sky-calendar.ics')).toBe('events');
    expect(pathFamily('/full-moon/2026-07-29/')).toBe('events');
    expect(pathFamily('/venus-retrograde/2026-10-03/')).toBe('events');
    expect(pathFamily('/mystery.md')).toBe('other');
    expect(isMachineOnlyPath('/birth-chart.md')).toBe(true);
    expect(isMachineOnlyPath('/mystery.md')).toBe(false);
    expect(isMachineOnlyPath('/llms.txt')).toBe(true);
    expect(pathFamily('/llms.txt')).toBe('llms');
    expect(pathFamily('/llms-full.txt')).toBe('llms');
    expect(pathFamily('/birth-chart.md')).toBe('md');
    expect(pathFamily('/mcp')).toBe('mcp');
    expect(pathFamily('/registry/')).toBe('other');
  });

  it('maps the labels Vercel logs to the named rows', () => {
    expect(botRow('claude-user')).toBe('Claude-User');
    expect(botRow('ClaudeBot')).toBe('ClaudeBot');
    expect(botRow('meta-externalagent')).toBe('Meta');
    expect(botRow('facebookexternalhit')).toBe('Meta');
    expect(botRow('Googlebot')).toBe('Googlebot');
    expect(botRow('')).toBe(UNLABELLED);
    expect(botRow(null)).toBe(UNLABELLED);
    expect(botRow('SomeNewBot')).toBe(OTHER_LABELLED);
  });

  it('refuses rows that carry a user agent or an IP address', () => {
    expect(() => normaliseRows([{ bot_name: 'GPTBot', request_path: '/', count: 1, user_agent: 'x' }])).toThrow(/user_agent/u);
    expect(() => normaliseRows({ rows: [{ bot_name: '', ip: '203.0.113.1', count: 1 }] })).toThrow(/"ip"/u);
    expect(() => normaliseRows([{ bot_name: 'GPTBot', count: 'many' }])).toThrow(/count/u);
  });

  it('totals bots and families and estimates the unlabelled share on machine-only paths', () => {
    const rows = normaliseRows([
      { bot_name: 'ClaudeBot', request_path: '/llms.txt', count: 30 },
      { bot_name: '', request_path: '/llms.txt', count: 10 },
      { bot_name: 'GPTBot', request_path: '/birth-chart.md', count: 5 },
      { bot_name: null, request_path: '/birth-chart.md', count: 5 },
      { bot_name: 'Googlebot', request_path: '/birth-chart/', count: 7 },
      { bot_name: '', request_path: '/api/v1/llms.txt', count: 99 },
    ]);
    const summary = summarise(rows);
    expect(summary.table.get('ClaudeBot').byFamily.llms).toBe(30);
    expect(summary.table.get(UNLABELLED).total).toBe(114);
    expect(summary.machine).toMatchObject({ all: 50, unlabelled: 15 });
    const markdown = renderTable(summary, { from: '2026-11-16', to: '2026-11-22' });
    expect(markdown).toContain('15 of 50 (30.0%)');
    expect(markdown).toContain(PROJECT_ID);
    expect(markdown).not.toMatch(/[\u2013\u2014]/u);
  });

  it('turns Bangkok days into UTC bounds and names the project in both queries', () => {
    expect(bangkokWindow('2026-11-16', '2026-11-22')).toEqual({
      startTime: '2026-11-15T17:00:00.000Z',
      endTime: '2026-11-22T17:00:00.000Z',
    });
    const specs = querySpecs('2026-11-16', '2026-11-22');
    expect(specs.map((spec) => spec.groupBy)).toEqual([['bot_name'], ['bot_name', 'request_path']]);
    for (const spec of specs) {
      expect(spec).toMatchObject({
        metric: 'vercel.request.count',
        scope: { projectId: PROJECT_ID, teamId: TEAM_ID },
      });
    }
    expect(() => bangkokWindow('2026-11-22', '2026-11-16')).toThrow();
  });

  it('uses bot-only totals when both exports are present and does not print unknown .md paths', () => {
    const summary = summarise(fixture);
    expect(summary.totalSource).toBe('bot-totals');
    expect(summary.table.get('ClaudeBot').total).toBe(40);
    expect(summary.table.get(UNLABELLED).total).toBe(20);
    expect(summary.table.get('ClaudeBot').byFamily.events).toBe(10);
    expect(summary.table.get(UNLABELLED).byFamily.other).toBe(99);
    expect(summary.machine).toMatchObject({ all: 50, unlabelled: 15 });
    expect([...summary.machine.byPath.keys()]).toEqual(['/llms.txt', '/birth-chart.md']);
    const markdown = renderTable(summary, { from: '2026-11-16', to: '2026-11-22' });
    expect(markdown).toContain('| ClaudeBot | 40 |');
    expect(markdown).not.toContain('mystery.md');
    expect(markdown).not.toContain('1990-01-01');
    expect(markdown).not.toMatch(/[\u2013\u2014]/u);
  });

  it('flags a path export that reached its group limit', () => {
    const summary = summarise(fixture, { pathLimit: 7 });
    expect(summary.incompletePathBreakdown).toBe(true);
    expect(renderTable(summary, { from: '2026-11-16', to: '2026-11-22' })).toContain('reached its group limit');
  });
});
