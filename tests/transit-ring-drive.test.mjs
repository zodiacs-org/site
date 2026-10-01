import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  launch: vi.fn(), close: vi.fn(), newPage: vi.fn(), stop: vi.fn(), writeFile: vi.fn(),
}));
vi.mock('playwright-core', () => ({ chromium: { launch: harness.launch } }));
vi.mock('./visual/browser.mjs', () => ({ findChromium: async () => 'synthetic-browser', STABLE_CHROMIUM_ARGS: [] }));
vi.mock('./visual/preview-server.mjs', () => ({
  startPreview: async () => ({ baseURL: 'http://127.0.0.1:4399', stop: harness.stop }),
}));
vi.mock('./visual/phase1-evidence-contract.mjs', () => ({ phase1TemplateSourceSha256: async () => 'current-source' }));
vi.mock('node:fs/promises', () => ({
  mkdir: async () => {},
  writeFile: harness.writeFile,
  readFile: async (path) => String(path).endsWith('dist/.phase1-build-receipt.json')
    ? Buffer.from(JSON.stringify({ templateSourceSha256: 'current-source' }))
    : String(path).endsWith('dist/transits/index.html') ? '<html><body></body></html>' : Buffer.from('synthetic-driver'),
}));
vi.mock('node:child_process', () => ({ execFileSync: () => 'a'.repeat(40) }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  harness.stop.mockResolvedValue(undefined);
  harness.close.mockResolvedValue(undefined);
  harness.newPage.mockRejectedValue(new Error('Synthetic browser drive failure'));
  harness.launch.mockResolvedValue({ close: harness.close, newPage: harness.newPage, version: async () => 'synthetic' });
  vi.spyOn(process, 'exit').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('calendar UI drive resource cleanup', () => {
  it.each(['launch', 'drive', 'close'])('stops its preview and records failure when browser %s fails', async (stage) => {
    if (stage === 'launch') harness.launch.mockRejectedValue(new Error('Synthetic launch failure'));
    if (stage === 'close') harness.close.mockRejectedValue(new Error('Synthetic close failure'));
    await import('./transit-ring-drive.mjs');
    expect(harness.stop).toHaveBeenCalledOnce();
    expect(harness.close).toHaveBeenCalledTimes(stage === 'launch' ? 0 : 1);
    const receipt = JSON.parse(harness.writeFile.mock.calls.find(([path]) => path.endsWith('/result.json'))[1]);
    expect(receipt.failed).toBeGreaterThan(0);
    expect(receipt.results.some((result) => !result.ok && result.detail.includes('Synthetic'))).toBe(true);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
