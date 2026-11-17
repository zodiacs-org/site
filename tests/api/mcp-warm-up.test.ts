import { afterEach, describe, expect, it, vi } from 'vitest';

// api/compatibility.ts awaits warmUp while a Vercel instance starts, so it must stay inside the instance and never fail it.
describe('the /mcp warm-up', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('answers initialize and tools/list inside the instance without reaching the network', async () => {
    vi.stubEnv('ZODIACS_MCP_ENABLED', '1');
    vi.stubEnv('ZODIACS_OCCASIONS_ENABLED', '1');
    vi.stubEnv('NODE_ENV', 'production');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('the warm-up must not fetch'));
    const { warmUp } = await import('../../api/_ai/handler.js');
    await expect(warmUp()).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves, without throwing, while the server is switched off', async () => {
    vi.stubEnv('ZODIACS_MCP_ENABLED', '0');
    const { warmUp } = await import('../../api/_ai/handler.js');
    await expect(warmUp()).resolves.toBeUndefined();
  });
});
