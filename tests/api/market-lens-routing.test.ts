import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const dispatch = vi.hoisted(() => vi.fn(async (_req: unknown, _res: unknown) => {}));
vi.mock('../../api/_registry/lens-handler.js', () => ({ handleLensMarket: dispatch }));
import compatibility from '../../api/compatibility';

describe('Market Lens serverless routing', () => {
  it('rewrites the same-origin route into the existing function with its dispatch action', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(config.rewrites.find((rule: { source: string }) => rule.source === '/api/registry/lens')).toEqual({
      source: '/api/registry/lens', destination: '/api/compatibility?action=registry-lens',
    });
  });

  it('dispatches before invite authentication and preserves the requested instrument and interval', async () => {
    const req = { method: 'GET', url: '/api/registry/lens?instrument=ETH-USD&interval=1h', query: { action: 'registry-lens', instrument: 'ETH-USD', interval: '1h' } };
    const res = {};
    await compatibility(req, res);
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(req, res);
  });
});
