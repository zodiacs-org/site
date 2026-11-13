import { describe, expect, it } from 'vitest';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import LearningPath, {
  activeLearningStep,
  normalizeLearningProgress,
  normalizeLearningState,
  updateLearningProgress,
} from './LearningPath';

describe('learning path progress', () => {
  it('keeps known steps in curriculum order and removes duplicates', () => {
    expect(normalizeLearningProgress([
      'big-three',
      'aspects',
      'big-three',
      'not-a-step',
    ])).toEqual(['aspects', 'big-three']);
  });

  it('treats malformed stored values as no progress', () => {
    expect(normalizeLearningProgress(null)).toEqual([]);
    expect(normalizeLearningProgress({ completed: ['big-three'] })).toEqual([]);
  });

  it('moves the emphasized action through the path without locking later steps', () => {
    expect(activeLearningStep([])).toEqual({ id: 'signs', cue: 'Start here' });
    expect(activeLearningStep(['signs'])).toEqual({ id: 'planets', cue: 'Up next' });
    expect(activeLearningStep(['aspects'])).toEqual({ id: 'signs', cue: 'Up next' });
    expect(activeLearningStep([
      'signs', 'planets', 'planets-houses', 'aspects', 'big-three',
    ])).toBeNull();
  });

  it('renders all five linked lessons before hydration without a permanent loading state', () => {
    const markup = render(h(LearningPath, {}));
    expect(markup.match(/data-learning-step=/g)).toHaveLength(5);
    for (const href of ['#signs', '/learn/planets/', '/learn/houses/', '/learn/aspects/', '/big-three/']) {
      expect(markup).toContain(`href="${href}"`);
    }
    expect(markup).toContain('5 lessons to read');
    expect(markup).toContain('Your progress stays on this device.');
    expect(markup).not.toContain('Opening your saved path');
    expect(markup).not.toContain('Loading');
    expect(markup).not.toContain('Mark Meet the three sides of you complete');
  });

  it('migrates former link-open completions to started steps', () => {
    expect(normalizeLearningState(['big-three', 'aspects', 'big-three', 'missing'])).toEqual({
      started: ['aspects', 'big-three'], completed: [],
    });
  });

  it('opening or reopening a lesson never records completion', () => {
    const initial = normalizeLearningState(null);
    const started = updateLearningProgress(initial, 'start', 'big-three');
    const openedAgain = updateLearningProgress(started, 'start', 'big-three');
    expect(openedAgain).toEqual({ started: ['big-three'], completed: [] });
    expect(activeLearningStep(openedAgain.completed)?.id).toBe('signs');
  });

  it('requires a started step and an explicit reflection confirmation to complete it', () => {
    const initial = normalizeLearningState(null);
    expect(updateLearningProgress(initial, 'complete', 'big-three')).toEqual(initial);
    const started = updateLearningProgress(initial, 'start', 'big-three');
    const reflected = updateLearningProgress(started, 'complete', 'big-three');
    expect(reflected).toEqual({ started: ['big-three'], completed: ['big-three'] });
    expect(activeLearningStep(reflected.completed)?.id).toBe('signs');
    expect(updateLearningProgress(reflected, 'start', 'big-three')).toEqual(reflected);
    expect(updateLearningProgress(reflected, 'complete', 'big-three')).toEqual(reflected);
  });

  it('restores versioned progress while discarding malformed or unstarted completions', () => {
    expect(normalizeLearningState({ version: 2, started: ['big-three', 'aspects'], completed: ['aspects', 'whole-chart'] })).toEqual({
      started: ['aspects', 'big-three'], completed: ['aspects'],
    });
    for (const value of [null, false, {}, { version: 1, completed: ['big-three'] }, { version: 2, started: 'big-three' }]) {
      expect(normalizeLearningState(value)).toEqual({ started: [], completed: [] });
    }
  });
});
