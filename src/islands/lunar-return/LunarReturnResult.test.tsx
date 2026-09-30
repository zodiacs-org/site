import type { VNode } from 'preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeLunarReturn } from './compute';
const hooks = vi.hoisted(() => ({ focus: vi.fn() }));
vi.mock('preact/hooks', () => ({ useMemo: (fn: () => unknown) => fn(), useRef: () => ({ current: { focus: hooks.focus } }), useEffect: (fn: () => unknown) => fn() }));
import { LunarReturnResult } from './LunarReturnResult';
import LunarReturnActions from './LunarReturnActions';
import EvidenceDisclosure from '../EvidenceDisclosure';
const Wheel = () => null;
const result = () => computeLunarReturn({ birthDate: '1990-02-01', birthTime: '12:00', timeKnown: true,
  birthplace: { name: 'Synthetic', lat: 0, lon: 0, tz: 'Etc/UTC' }, houseSystem: 'placidus', castLocation: null }, new Date('2026-03-01T00:00:00Z'));
function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
beforeEach(() => hooks.focus.mockReset());
describe('lunar result presentation', () => {
  it('passes the same return model to wheel and exports and labels its fixed reference', () => {
    const data = result(); const tree = nodes(LunarReturnResult({ result: data, Wheel }));
    const model = tree.find((n) => n.type === LunarReturnActions)!.props.model;
    const wheel = tree.find((n) => n.type === Wheel)!.props;
    expect(model.instantUtc).toBe(data.chart.input.utc.toISOString()); expect(model.referenceUtc).toBe(data.referenceUtc);
    expect(wheel.bodies).toEqual(model.wheel.bodies.filter((b: { body: string }) => b.body !== 'South Node'));
    expect(wheel.asc).toBe(model.wheel.angles.asc); expect(wheel.cusps).toEqual(model.wheel.houses.cusps);
    expect(tree[0].props['data-lr-reference']).toBe(data.referenceUtc);
    expect(wheel.animate).toBe(false);
  });
  it('focuses the result heading and keeps the full labelled placement table in details', () => {
    const data = result(); const tree = nodes(LunarReturnResult({ result: data, Wheel }));
    expect(hooks.focus).toHaveBeenCalledOnce();
    expect(tree.find((n) => n.props.id === 'lunar-return-reading-title')!.props.tabIndex).toBe(-1);
    expect(tree.find((n) => n.type === EvidenceDisclosure)!.props.label).toBe('Return chart details');
    expect(tree.filter((n) => n.type === 'th' && n.props.scope === 'row').map((n) => n.props.children)).toEqual(data.chart.bodies.map((b) => b.body));
  });
  it('keeps local-time provenance in details without adding it to export data', () => {
    const notice = (data: ReturnType<typeof result>) => nodes(LunarReturnResult({ result: data, Wheel }))
      .find((n) => n.type === 'p' && n.props.class === 'notice' && typeof n.props.children === 'string'
        && /local mean time|ran to seconds/.test(n.props.children))?.props.children;
    // Since engine rc.15 `lmt` means a local mean time read the wall time; without the
    // birthplace's own, it was the zone's. A legal mean time such as Paris Mean Time carries no flag.
    const data = result(); data.natalTimeFlags = ['lmt']; const tree = nodes(LunarReturnResult({ result: data, Wheel }));
    expect(notice(data)).toBe('The birth time is read on the local mean time its time zone kept then.');
    expect(JSON.stringify(tree.find((n) => n.type === LunarReturnActions)!.props.model)).not.toContain('lmt');
    const wholeMinute = result(); wholeMinute.natalTimeFlags = []; wholeMinute.natalLocalMeanTime = true;
    expect(notice(wholeMinute)).toBe('The birth time is read on the birthplace\'s own local mean time, set by its longitude.');
    const both = result(); both.natalTimeFlags = ['lmt']; both.natalLocalMeanTime = true;
    expect(notice(both)).toBe('The birth time is read on the birthplace\'s own local mean time, set by its longitude.');
    expect(notice(result())).toBeUndefined();
  });
});
