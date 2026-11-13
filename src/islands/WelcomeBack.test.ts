import { describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import type { SavedChart } from '../lib/profile/schema';

const harness = vi.hoisted(() => ({ charts: [] as SavedChart[], enabled: true }));
vi.mock('../lib/hooks/useProfile', () => ({ useProfile: () => ({ profile: { charts: harness.charts } }) }));
vi.mock('../lib/living-chart/feature-flags', () => ({ livingChartCaptureEnabled: () => harness.enabled }));
import WelcomeBack from './WelcomeBack';

function saved(id: string, relationship?: SavedChart['relationship']): SavedChart {
  return { id, name: id, relationship, createdAt: '2026-09-01', updatedAt: id === 'Friend' ? '2026-09-06' : '2026-09-01',
    birth: { date: '1990-01-01', time: null, timeKnown: false, place: null },
    summary: { engineVersion: 'fixture', utcISO: '1990-01-01T12:00:00Z', houseSystem: 'whole', bodies: [{ body: 'Sun', lon: 10, retrograde: false }, { body: 'Moon', lon: 80, retrograde: false }], angles: { asc: 90, mc: 0 }, flags: ['no-time'] },
  };
}
function card() { return (WelcomeBack({})!.props.children as VNode<Record<string, any>>).props; }

describe('homepage personal daily handoff', () => {
  it('names the same explicit chart as Today, even with a newer friend chart', () => {
    harness.enabled = true;
    harness.charts = [saved('Friend', 'other'), saved('Owner', 'self')];
    const props = card();
    expect(props.title).toContain('Owner');
    expect(props.primary.props.href).toBe('/today/');
    // Unknown time must not present a reference Moon or stale rising sign as settled.
    const meta = JSON.stringify(props.meta);
    expect(meta).not.toContain('"Moon"');
    expect(meta).not.toContain('"Rising"');
  });
  it('offers the existing chooser without attributing a friend or legacy chart to the visitor', () => {
    harness.enabled = true;
    harness.charts = [saved('Friend', 'other')];
    const props = card();
    expect(props.title).toBe('Make today personal');
    expect(props.primary.props.href).toBe('/today/');
    expect(props.meta).toBeUndefined();
  });
  it('preserves the latest-chart path when the personal daily feature is off', () => {
    harness.enabled = false;
    harness.charts = [saved('Friend', 'other'), saved('Owner', 'self')];
    expect(card().title).toContain('Friend');
  });
  it('opens a saved chart by its opaque id only, never with birth details in the link', () => {
    harness.enabled = true;
    const id = '22222222-2222-4222-8222-222222222222';
    const placed = (chartId: string): SavedChart => ({
      ...saved(chartId, 'self'),
      name: 'Fixture owner',
      birth: { date: '1990-01-01', time: '08:15', timeKnown: true, place: { name: 'Fixtureville', admin1: '', country: '', lat: 12.3456, lon: 65.4321, tz: 'Etc/UTC' } },
    });
    const hrefs = (charts: SavedChart[]) => {
      harness.charts = charts;
      const found: string[] = [];
      const visit = (node: unknown) => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== 'object' || !('props' in node)) return;
        const props = (node as VNode<Record<string, any>>).props;
        if (typeof props.href === 'string') found.push(props.href);
        visit(props.children);
      };
      const props = card();
      visit([props.primary, props.secondary]);
      return found;
    };
    const links = hrefs([placed(id)]);
    expect(links).toContain(`/birth-chart/#profileChartId=${id}`);
    for (const href of links) {
      expect(href).not.toMatch(/[#&]c=|1990|08:15|Fixture|12\.3456/u);
    }
    // An id that is not an opaque profile id renders no "Open saved chart" link at all.
    expect(hrefs([placed('Owner')]).some((href) => href.startsWith('/birth-chart/'))).toBe(false);
  });

  it('does not add a returning-user card for an empty profile', () => {
    harness.enabled = true;
    harness.charts = [];
    expect(WelcomeBack({})).toBeNull();
  });
});
