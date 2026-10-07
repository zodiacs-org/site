import { afterEach, describe, expect, it, vi } from 'vitest';
import { StudioBridge } from './bridge';
const origin = 'https://synthetic-host.example';
function setup(capabilities: object) {
  const messages: any[] = [], listeners = new Set<(e: any) => void>();
  const parent = { postMessage: vi.fn((message: any, target: string) => {
    messages.push({ ...message, target });
    if (message.method === 'ui/initialize') queueMicrotask(() => receive({ jsonrpc: '2.0', id: message.id, result: { hostCapabilities: capabilities } }));
  }) };
  const receive = (data: any, source: any = parent, receivedOrigin = origin) => listeners.forEach(fn => fn({ data, source, origin: receivedOrigin }));
  vi.stubGlobal('window', { parent, addEventListener: (_: string, fn: any) => listeners.add(fn), removeEventListener: (_: string, fn: any) => listeners.delete(fn) });
  const changed = vi.fn(), bridge = new StudioBridge(changed);
  return { bridge, messages, receive, changed, listeners };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Chart Studio explicit sharing bridge', () => {
  it('only initializes until asked to share and pins context to the parent origin', async () => {
    const { bridge, messages, receive, changed } = setup({ updateModelContext: { text: {} }, message: { text: {} } });
    await bridge.connect();
    expect(changed).toHaveBeenLastCalledWith(true);
    expect(messages.map(m => m.method)).toEqual(['ui/initialize','ui/notifications/initialized']);
    const shared = bridge.share('reviewed selection');
    const request = messages.at(-1);
    expect(request).toMatchObject({ method: 'ui/update-model-context', target: origin, params: { content: [{ type: 'text', text: 'reviewed selection' }] } });
    receive({ jsonrpc: '2.0', id: request.id, result: {} }, {}, origin);
    receive({ jsonrpc: '2.0', id: request.id, error: {} }, undefined, 'https://other.example');
    receive({ jsonrpc: '2.0', id: request.id, result: {} });
    await expect(shared).resolves.toContain('attached'); bridge.dispose();
  });
  it('uses an explicit user message on hosts without context attachment', async () => {
    const { bridge, messages, receive } = setup({ message: { text: {} } }); await bridge.connect();
    const shared = bridge.share('reviewed selection'), request = messages.at(-1);
    expect(request.method).toBe('ui/message'); expect(request.params.role).toBe('user');
    expect(request.params.content[0].text).toContain('reviewed selection');
    receive({ jsonrpc: '2.0', id: request.id, result: {} }); await expect(shared).resolves.toContain('sent'); bridge.dispose();
  });
  it('does not report success after host errors, timeout or unsupported capabilities', async () => {
    vi.useFakeTimers();
    const { bridge, messages, receive } = setup({ updateModelContext: { text: {} } }); await bridge.connect();
    const refused = bridge.share('selection'), refusal = expect(refused).rejects.toThrow('could not accept');
    receive({ jsonrpc: '2.0', id: messages.at(-1).id, error: { code: -1 } }); await refusal;
    const timed = expect(bridge.share('selection')).rejects.toThrow('did not respond'); await vi.advanceTimersByTimeAsync(10000); await timed; bridge.dispose();
    const unsupported = setup({}); await unsupported.bridge.connect(); expect(unsupported.changed).toHaveBeenCalledWith(false);
    await expect(unsupported.bridge.share('selection')).rejects.toThrow('cannot receive'); unsupported.bridge.dispose();
  });
  it('removes the listener and rejects pending requests on disposal', async () => {
    const { bridge, listeners } = setup({ updateModelContext: { text: {} } }); await bridge.connect();
    const promise = expect(bridge.share('selection')).rejects.toThrow('closed'); bridge.dispose(); await promise; expect(listeners.size).toBe(0);
  });
});
