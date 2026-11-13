import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact-render-to-string';
import SkyTicker from './SkyTicker';
import daily from '../data/daily.json';
import { formatLongitude, signForLongitude } from '../lib/signs';

afterEach(() => vi.useRealTimers());

describe('server-rendered sky receipt', () => {
  it('renders the committed Sun and Moon without browser state or hydration', () => {
    const html = render(<SkyTicker />);
    const sun = daily.bodies.find(({ body }) => body === 'Sun')!;
    const moon = daily.bodies.find(({ body }) => body === 'Moon')!;

    expect(html).toContain('class="skyticker"');
    expect(html).toContain(`Sun ${formatLongitude(sun.lon, 'en')}`);
    expect(html).toContain(`Moon in ${signForLongitude(moon.lon).name}`);
    expect(html).toContain('aria-label=');
    expect(html).not.toMatch(/<(?:button|input|select|script)\b/u);
  });

  it('keeps the exact receipt markup unchanged when the viewing clock changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2000-01-01T00:00:00Z'));
    const first = render(<SkyTicker />);
    vi.setSystemTime(new Date('2099-12-31T23:59:59Z'));

    expect(render(<SkyTicker />)).toBe(first);
    const editionDate = new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${daily.date}T12:00:00Z`));
    expect(first).toContain(editionDate);
  });
});
