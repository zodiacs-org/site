import { describe, expect, it } from 'vitest';
import { MILESTONE_WORDS, milestoneCard } from './milestone-card';

describe('milestone card', () => {
  const asOf = new Date('2026-10-11T12:00:00Z');

  it('dates the milestones from a birth date alone', async () => {
    const card = await milestoneCard({ birthDate: '1997-03-15', time: null, timeZone: null, longitude: null }, asOf);
    expect(card.timeKnown).toBe(false);
    expect(card.next?.kind).toBe('saturn-return');
    expect(card.next?.passes.map((pass) => pass.at.slice(0, 10))).toEqual(['2026-04-23', '2026-11-19', '2026-12-31']);
    expect(card.numbers).toEqual({ fullMoons: 366, mercuryRetrogrades: 93, jupiterReturns: 2 });
  });

  it('uses the birth time and place when given', async () => {
    const card = await milestoneCard({ birthDate: '1997-03-15', time: '08:30', timeZone: 'Europe/London', longitude: -0.1278 }, asOf);
    expect(card.timeKnown).toBe(true);
    expect(card.birth).toBe('1997-03-15T08:30:00.000Z');
  });

  it('refuses a future birth, a time without a place and an impossible date', async () => {
    await expect(milestoneCard({ birthDate: '2027-01-01', time: null, timeZone: null, longitude: null }, asOf)).rejects.toThrow(RangeError);
    await expect(milestoneCard({ birthDate: '1997-03-15', time: '08:30', timeZone: null, longitude: null }, asOf)).rejects.toThrow(RangeError);
    await expect(milestoneCard({ birthDate: '1997-02-30', time: null, timeZone: null, longitude: null }, asOf)).rejects.toThrow(RangeError);
  });

  it('explains each milestone without a promise', () => {
    const text = Object.values(MILESTONE_WORDS).map((words) => words.about).join(' ');
    expect(text).not.toMatch(/\b(will|lucky|unlucky|best|worst|guarantee|destined|fated)\b/iu);
  });
});
