import { describe, expect, it } from 'vitest';
import { scoreCompatibility } from './compat-score';
import type { InterAspect } from './engine/synastry';

const contact = (a: string, b: string, type: InterAspect['type'], orb = 1): InterAspect => ({ a, aLon: 0, b, bLon: 0, type, orb });

describe('scoreCompatibility', () => {
  it('scores harmony above strain and stays within 0–100', () => {
    const easy = scoreCompatibility([contact('Sun', 'Moon', 'trine'), contact('Venus', 'Venus', 'trine'), contact('Mercury', 'Mercury', 'sextile')], { a: 'earth', b: 'water' });
    const hard = scoreCompatibility([contact('Sun', 'Moon', 'square'), contact('Saturn', 'Venus', 'square'), contact('Mercury', 'Mercury', 'square')], { a: 'fire', b: 'water' });
    expect(easy.overall).toBeGreaterThan(hard.overall);
    for (const score of [easy, hard]) {
      for (const value of [score.overall, ...Object.values(score.areas)]) expect(value).toBeGreaterThanOrEqual(0);
      for (const value of [score.overall, ...Object.values(score.areas)]) expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('reads Venus–Mars contacts as attraction even when they are hard', () => {
    const spark = scoreCompatibility([contact('Venus', 'Mars', 'square')], null);
    const clash = scoreCompatibility([contact('Mercury', 'Saturn', 'square')], null);
    expect(spark.areas.attraction).toBeGreaterThan(62);
    expect(clash.areas.communication).toBeLessThan(62);
  });

  it('is deterministic and names the strongest and hardest areas', () => {
    const contacts = [contact('Venus', 'Mars', 'conjunction'), contact('Saturn', 'Moon', 'square', 2)];
    const first = scoreCompatibility(contacts, { a: 'fire', b: 'air' });
    expect(scoreCompatibility(contacts, { a: 'fire', b: 'air' })).toEqual(first);
    expect(first.headline).toMatch(/^(?:(?:Attraction|Communication|Long-term stability) is the strongest part of this pairing; (?:attraction|communication|long-term stability) will take the most work|Attraction, communication and stability are evenly matched in this pairing)\.$/u);
  });
});
