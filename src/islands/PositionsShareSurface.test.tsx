import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { computeChart } from '../lib/engine/full';
import ChartShareDialog from './ChartShareDialog';

const chart = computeChart({
  utc: new Date('1990-06-15T12:30:00.000Z'),
  latitude: 40.7128,
  longitude: -74.006,
  houseSystem: 'whole',
  timeKnown: true,
});

describe('ChartShareDialog', () => {
  it('makes the chart sheet primary and wires the English signature variant', () => {
    const markup = render(h(ChartShareDialog, {
      chart,
      locale: 'en',
      card: 'idle',
      onCardStateChange: () => {},
      onClose: () => {},
    }));

    expect(markup).toContain('data-share-mode="full"');
    expect(markup.match(/data-share-card-action="sheet"/g)).toHaveLength(1);
    expect(markup.match(/data-share-card-action="signature"/g)).toHaveLength(1);
    expect(markup).toContain('data-share-primary="sheet"');
    expect(markup).toContain('Share chart sheet');
    expect(markup).toContain('Share my chart signature');
    expect(markup).toContain('Hide birth details');
    expect(markup).toContain('with no name, birth date, time, place, coordinates or chart link');
    expect(markup).toContain('Its positions still give the birth date and time');
    expect(markup).not.toMatch(/1990-06-15|12:30|40\.7128|74\.006|@|#i=|#s=/);
  });

  it('offers a one-placement Moon card without fabricating a rising sign', () => {
    const markup = render(h(ChartShareDialog, {
      chart: { ...chart, angles: null, houses: null },
      locale: 'en',
      mode: 'moon',
      card: 'idle',
      onCardStateChange: () => {},
      onClose: () => {},
    }));

    expect(markup).toContain('data-share-mode="moon"');
    expect(markup.match(/data-share-card-action="placement"/g)).toHaveLength(1);
    expect(markup).toContain('data-share-primary="placement"');
    expect(markup).toContain('data-share-placement-preview');
    expect(markup).toContain('Moon sign card');
    // With no settled Moon sign to show, the action does not promise one.
    expect(markup).toContain('Needs a birth time');
    expect(markup).toContain('Share this image');
    expect(markup).not.toContain('Share my Moon sign');
    expect(markup).not.toContain('Share chart sheet');
    expect(markup).not.toContain('Share the big three');
    expect(markup).not.toContain('data-share-card-action="signature"');
    // A Moon whose sign is known keeps its promise.
    const known = render(h(ChartShareDialog, {
      chart, locale: 'en', mode: 'moon', card: 'idle', onCardStateChange: () => {}, onClose: () => {},
    }));
    expect(known).toContain('Share my Moon sign');
  });

  it('does not promise the Moon sign the page names for a chart without a birth time until the image can name it', () => {
    // The page names one sign for the birthplace's own day; the image, drawn
    // from 12:00 UTC, names one only when it held all that date everywhere.
    const markup = render(h(ChartShareDialog, {
      chart: { ...chart, input: { ...chart.input, timeKnown: false }, angles: null, houses: null, moonSignCandidates: ['aquarius'] },
      locale: 'en',
      mode: 'moon',
      card: 'idle',
      birthDetails: { date: '1989-12-31', time: '12:00', timeKnown: false, city: 'London', timezone: 'Europe/London' },
      onCardStateChange: () => {},
      onClose: () => {},
    }));
    expect(markup).toContain('Needs a birth time');
    expect(markup).toContain('Share this image');
    expect(markup).not.toContain('Share my Moon sign');
    expect(markup).not.toContain('Aquarius');
  });

  it('uses placement-specific copy and preview for a Rising card', () => {
    const markup = render(h(ChartShareDialog, {
      chart,
      locale: 'en',
      mode: 'rising',
      card: 'idle',
      onCardStateChange: () => {},
      onClose: () => {},
    }));

    expect(markup).toContain('Rising sign card');
    expect(markup).toContain('Share my Rising sign');
    expect(markup).toContain('data-share-placement-preview');
    expect(markup).not.toContain('Share chart sheet');
    expect(markup).not.toContain('Share the big three');
  });
});
