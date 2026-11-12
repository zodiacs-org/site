import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { answerCounts, citationHost, copyProblems, loadQuestions, planAnswers, matchPhrase, opportunityScore, pagePath, parseCsv, scoreAnswer, summarisePhrase } from './lib.mjs';

describe('visibility lib', () => {
  it('holds fifty questions with unique ids and phrases', () => {
    const qs = loadQuestions();
    expect(qs).toHaveLength(50);
    expect(new Set(qs.map((q) => q.id)).size).toBe(50);
    expect(new Set(qs.map((q) => q.phrase)).size).toBe(50);
    for (const q of qs) expect(copyProblems(q.question + ' ' + q.phrase)).toEqual([]);
  });

  it('matches phrases exactly or by every word', () => {
    expect(matchPhrase('What is my rising sign?', 'what is my rising sign')).toBe('exact');
    expect(matchPhrase('rising sign what is my', 'what is my rising sign')).toBe('close');
    expect(matchPhrase('rising sign', 'what is my rising sign')).toBe(null);
  });

  it('scores brand mentions and citations, including Gemini redirect links', () => {
    const r = scoreAnswer('Try Zodiacs.org or Astro.com.', [
      { url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc', title: 'zodiacs.org' },
      { url: 'https://www.astro.com/horoscope', title: 'Astro' },
    ]);
    expect(r.mentioned).toBe(true);
    expect(r.cited).toBe(true);
    expect(r.citedHosts).toEqual(['zodiacs.org', 'astro.com']);
    expect(citationHost({ url: 'https://zodiacs.org/rising-sign/' })).toBe('zodiacs.org');
    expect(scoreAnswer('No brand here', []).mentioned).toBe(false);
  });

  it('parses a Search Console export and weights position by impressions', () => {
    const rows = parseCsv('Top queries,Clicks,Impressions,CTR,Position\n"what is my rising sign",2,100,2%,10\nrising sign what is my,0,300,0%,20\n');
    expect(rows).toHaveLength(3);
    const data = rows.slice(1).map((r) => ({ query: r[0], clicks: +r[1], impressions: +r[2], position: +r[4] }));
    const s = summarisePhrase(data, 'what is my rising sign');
    expect(s.impressions).toBe(400);
    expect(s.position).toBe(17.5);
    expect(summarisePhrase(data, 'what is my rising sign', { closeMatches: false }).impressions).toBe(100);
    // Query text is never kept: a searcher can type birth details.
    expect(s.queryCount).toBe(2);
    expect(JSON.stringify(s)).not.toMatch(/rising sign what is my/);
    // Landing pages keep only origin and path.
    const withPage = summarisePhrase([{ query: 'what is my rising sign', page: 'https://zodiacs.org/rising-sign/?date=1990-03-12&time=15:00&place=London#x', clicks: 0, impressions: 5, position: 3 }], 'what is my rising sign');
    expect(withPage.topPages).toEqual(['https://zodiacs.org/rising-sign/']);
    expect(pagePath('not a url')).toBe(null);
  });

  it('ranks striking-distance phrases above ones already on top', () => {
    const top = opportunityScore({ demand: 1000, position: 2 });
    const near = opportunityScore({ demand: 1000, position: 12 });
    expect(near).toBeGreaterThan(top);
    expect(opportunityScore({ demand: 1000, position: 12, aiCiteRate: 1 })).toBeLessThan(near);
  });

  it('flags dashes and market words in copy', () => {
    expect(copyProblems('Free birth chart \u2014 with houses')).toEqual(['em or en dash']);
    expect(copyProblems('Buy the token')[0]).toMatch(/market word/);
    expect(copyProblems('What is my rising sign?')).toEqual([]);
  });

  it('resumes only successful answers to the current wording', () => {
    const qs = [
      { id: 'q1', question: 'What is my rising sign?' },
      { id: 'q2', question: 'Is there a free birth chart calculator with no signup?' },
    ];
    const doc = {
      answers: [
        { id: 'q1', run: 1, question: 'What is my rising sign?', text: 'ok' },
        { id: 'q1', run: 2, question: 'What is my rising sign?', error: '503 overloaded' },
        { id: 'q2', run: 1, question: 'Is there a free birth chart calculator?', text: 'old wording' },
        { id: 'q9', run: 1, question: 'Outside this run', error: '500' },
      ],
    };
    const plan = planAnswers(doc, qs, 2);
    // The failed call and the answer to old wording are asked again.
    expect(plan.todo.map(([q, r]) => `${q.id}#${r}`)).toEqual(['q1#2', 'q2#1', 'q2#2']);
    expect(plan.answers.map((a) => `${a.id}#${a.run}`)).toEqual(['q1#1', 'q9#1']);
    expect(plan.superseded.map((a) => a.text)).toEqual(['old wording']);
    // A rerun after the retries succeed has nothing left to ask.
    const after = { answers: [...plan.answers, ...plan.todo.map(([q, r]) => ({ id: q.id, run: r, question: q.question, text: 'new' }))], superseded: plan.superseded };
    expect(planAnswers(after, qs, 2).todo).toEqual([]);
    expect(planAnswers(after, qs, 2).superseded).toHaveLength(1);
    expect(answerCounts(doc.answers[0], qs[0])).toBe(true);
    expect(answerCounts(doc.answers[1], qs[0])).toBe(false);
    expect(answerCounts(doc.answers[2], qs[1])).toBe(false);
  });

  it('keeps API keys out of the committed scripts', () => {
    const src = readFileSync(new URL('./ai-answers.mjs', import.meta.url), 'utf8');
    expect(src).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
  });
});

describe('keyword tables', () => {
  it('are current, keep volumes honest, and carry no dashes or market words', async () => {
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, [new URL('./build-keywords.mjs', import.meta.url).pathname, '--check']);
    const rows = parseCsv(readFileSync(new URL('../../docs/visibility/keywords/all-locales.csv', import.meta.url), 'utf8')).slice(1);
    expect(rows.length).toBe(9 * 296);
    for (const r of rows) {
      expect(r[8] === 'TBD' || /^\d+$/.test(r[8])).toBe(true);
      expect(copyProblems(r[5])).toEqual([]);
    }
  });
});
