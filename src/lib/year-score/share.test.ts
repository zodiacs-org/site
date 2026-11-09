import { describe, expect, it } from 'vitest';
import { figureYearScoreShareUrl, parseYearScoreShare, yearScoreShareUrl } from './share';
import { handleYearScoreImageRequest, handleYearScoreLinkRequest, isResultShareRoute } from '../../server/result-preview';
import vercel from '../../../vercel.json';

const params = (query: string) => new URLSearchParams(query);

describe('Year Ahead Score share links', () => {
  it('carry the Sun sign and the score for a person, the slug for a figure, and nothing else', () => {
    expect(yearScoreShareUrl('https://zodiacs.org', { sun: 'leo', score: 6.44 })).toBe('https://zodiacs.org/share/year-score/?s=leo&v=6.4');
    expect(yearScoreShareUrl('https://zodiacs.org', { sun: null, score: 6 })).toBeNull();
    expect(figureYearScoreShareUrl('https://zodiacs.org', 'elon-musk')).toBe('https://zodiacs.org/share/year-score/?p=elon-musk');
  });
  it('refuse a figure link with a score or sign added, unknown keys, repeats and out-of-range scores', () => {
    expect(parseYearScoreShare(params('p=elon-musk&v=9.9'))).toBeNull();
    expect(parseYearScoreShare(params('p=elon-musk&s=leo'))).toBeNull();
    expect(parseYearScoreShare(params('s=leo&v=6.4&d=1990-05-03'))).toBeNull();
    expect(parseYearScoreShare(params('s=leo&v=6.4&v=6.5'))).toBeNull();
    expect(parseYearScoreShare(params('s=leo&v=11.0'))).toBeNull();
    expect(parseYearScoreShare(params('s=leo&v=6'))).toBeNull();
    expect(parseYearScoreShare(params('s=leo&v=10.0&ref=chatgpt'))).toEqual({ kind: 'self', sun: 'leo', score: 10, ref: 'chatgpt' });
  });
});

describe('the Year Ahead Score share page and picture', () => {
  it('are routed through the share function', () => {
    expect(isResultShareRoute('year-score-link') && isResultShareRoute('year-score-image')).toBe(true);
    const rewrites = (vercel as { rewrites: { source: string; destination: string }[] }).rewrites;
    expect(rewrites).toContainEqual({ source: '/share/year-score/', destination: '/api/compatibility?__zodiacs_share=year-score-link' });
    expect(rewrites).toContainEqual({ source: '/api/og/year-score-image', destination: '/api/compatibility?__zodiacs_share=year-score-image' });
  });
  it('draw a person’s own card as a JPEG and a page that shows only the sign and score', async () => {
    const image = await handleYearScoreImageRequest(new Request('https://zodiacs.org/api/og/year-score-image?s=leo&v=6.4'));
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/jpeg');
    const html = await (await handleYearScoreLinkRequest(new Request('https://zodiacs.org/share/year-score/?s=leo&v=6.4'))).text();
    expect(html).toContain('My Year Ahead Score: 6.4/10');
    expect(html).toContain('Leo Sun');
    expect(html).toContain('noindex');
    expect(html).toContain('href="/year-score/"');
    expect(html).not.toMatch(/[–—]/u);
  }, 30_000);
  it('score a figure on the server, and answer an unknown figure with 404 and its picture with 400', async () => {
    const html = await (await handleYearScoreLinkRequest(new Request('https://zodiacs.org/share/year-score/?p=jensen-huang'))).text();
    expect(html).toMatch(/Jensen Huang’s Year Ahead Score: \d{1,2}\.\d\/10/u);
    expect(html).toContain('href="/year/jensen-huang/"');
    expect((await handleYearScoreLinkRequest(new Request('https://zodiacs.org/share/year-score/?p=changpeng-zhao'))).status).toBe(404);
    expect((await handleYearScoreImageRequest(new Request('https://zodiacs.org/api/og/year-score-image?p=nobody-here'))).status).toBe(400);
  }, 30_000);
});
