/**
 * The horoscope panel's link to its host. MCP Apps first (ui/initialize,
 * tool results, tools/call); ChatGPT's window.openai globals when present.
 * Nothing is stored; the panel only reads results and asks for another sign.
 */
export interface PanelToolResult {
  structuredContent?: unknown;
  _meta?: Record<string, unknown>;
}

interface OpenAiGlobals {
  toolOutput?: unknown;
  toolResponseMetadata?: Record<string, unknown>;
  theme?: string;
  callTool?: (name: string, args: Record<string, unknown>) => Promise<{ structuredContent?: unknown; _meta?: Record<string, unknown>; meta?: Record<string, unknown> }>;
}

const openai = () => (window as unknown as { openai?: OpenAiGlobals }).openai;

export class HoroscopeBridge {
  private pending = new Map<string, { resolve: (value: any) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private serial = 0;
  private targetOrigin = '*';
  private ready = false;
  private serverTools = false;
  private listener = (event: MessageEvent) => {
    if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) return;
    const message = event.data;
    if (message.method === 'ui/notifications/tool-result') { this.onResult(message.params ?? {}); return; }
    if (message.method === 'ui/notifications/host-context-changed') { this.onTheme(message.params?.theme); return; }
    const request = this.pending.get(message.id);
    if (!request) return;
    if (message.id === 'zodiacs-horoscopes-1' && message.result && event.origin !== 'null') this.targetOrigin = event.origin;
    clearTimeout(request.timer);
    this.pending.delete(message.id);
    if (message.error) request.reject(new Error('The assistant could not open that reading.'));
    else request.resolve(message.result);
  };
  private globals = () => {
    const host = openai();
    if (!host) return;
    if (host.toolOutput !== undefined || host.toolResponseMetadata !== undefined) {
      this.onResult({ structuredContent: host.toolOutput, _meta: host.toolResponseMetadata });
    }
    if (host.theme) this.onTheme(host.theme);
  };

  constructor(private onResult: (result: PanelToolResult) => void, private onTheme: (theme: unknown) => void) {}

  connect() {
    this.globals();
    window.addEventListener('openai:set_globals', this.globals);
    if (window.parent === window) return;
    window.addEventListener('message', this.listener);
    this.request('ui/initialize', {
      protocolVersion: '2026-01-26',
      appInfo: { name: 'Zodiacs Horoscopes', version: '0.4.0' },
      appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
    }).then((result) => {
      this.ready = true;
      this.serverTools = !!result?.hostCapabilities?.serverTools;
      this.onTheme(result?.hostContext?.theme);
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, this.targetOrigin);
    }).catch(() => {});
  }

  /** True when this host lets the panel ask for another sign itself. */
  canCall(): boolean {
    return typeof openai()?.callTool === 'function' || (this.ready && this.serverTools);
  }

  async callTool(args: Record<string, unknown>): Promise<PanelToolResult> {
    const host = openai();
    if (typeof host?.callTool === 'function') {
      const result = await host.callTool('get_horoscope', args);
      return { structuredContent: result?.structuredContent, _meta: result?._meta ?? result?.meta };
    }
    if (!this.ready) throw new Error('This panel is not connected to an assistant.');
    return this.request('tools/call', { name: 'get_horoscope', arguments: args });
  }

  private request(method: string, params: unknown): Promise<any> {
    const id = `zodiacs-horoscopes-${++this.serial}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The assistant did not respond. Try again.')); }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, this.targetOrigin);
    });
  }

  dispose() {
    window.removeEventListener('message', this.listener);
    window.removeEventListener('openai:set_globals', this.globals);
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('The panel closed.')); }
    this.pending.clear();
  }
}
