import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import StoryCardShare from './StoryCardShare';

const props = { cardKey: 'k', prepare: async () => { throw new Error('not drawn in this test'); }, pageUrl: 'https://zodiacs.org/example/', shareText: 'An example' };

describe('<StoryCardShare>', () => {
  it('draws nothing until asked: a fixed preview, three actions and a privacy line', () => {
    const html = render(h(StoryCardShare, { ...props, heading: 'Share it' }));
    expect(html).toContain('<h3 class="story-share__title">Share it</h3>');
    expect(html.match(/<button/gu)).toHaveLength(3);
    expect(html).toContain('Make card');
    expect(html).toContain('Copy link');
    // Save waits for a card.
    expect(html).toMatch(/<button class="btn btn--ghost" type="button" disabled[^>]*><span>Save<\/span>/u);
    expect(html).toContain('class="story-share__preview"');
    expect(html).not.toContain('<img');
  });

  it('says the card is made on the device and shows no name or birth date', () => {
    expect(render(h(StoryCardShare, props))).toContain('Made on this device. It shows no name or birth date.');
  });
});
