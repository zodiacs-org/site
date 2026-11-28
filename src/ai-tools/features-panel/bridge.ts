/**
 * The feature cards panel's link to its host. MCP Apps first (ui/initialize
 * and tool results); ChatGPT's window.openai globals when present. Inline only:
 * displays the structured result it is given, calls no tools, stores nothing.
 */
import { reportSizeChanges } from '../fit-height';
import { openLinksThroughHost } from '../open-links';

export interface PanelToolResult {
  structuredContent?: unknown;
}

interface OpenAiGlobals {
  toolOutput?: unknown;
  theme?: string;
}

const openai = () => (window as unknown as { openai?: OpenAiGlobals }).openai;

export class FeaturesBridge {
  private pending = new Map<string, { resolve: (value: any) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private serial = 0;
  private targetOrigin = '*';
  private stopSizing: () => void = () => {};
  private stopLinks: () => void = () => {};
  private applyTheme(value: unknown) {
    if (value === 'light' || value === 'dark') this.onTheme(value);
  }
  private listener = (event: MessageEvent) => {
    if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) return;
    const message = event.data;
    if (message.method === 'ui/notifications/tool-result') { this.onResult(message.params ?? {}); return; }
    if (message.method === 'ui/notifications/host-context-changed') { this.applyTheme(message.params?.theme); return; }
    const request = this.pending.get(message.id);
    if (!request) return;
    if (message.id === 'zodiacs-features-1' && message.result && event.origin !== 'null') this.targetOrigin = event.origin;
    clearTimeout(request.timer);
    this.pending.delete(message.id);
    if (message.error) request.reject(new Error('The assistant refused the request.'));
    else request.resolve(message.result);
  };
  private globals = (event?: Event) => {
    const changed = event ? (event as CustomEvent<{ globals?: OpenAiGlobals }>).detail?.globals : openai();
    if (!changed) return;
    if (changed.toolOutput !== undefined) this.onResult({ structuredContent: changed.toolOutput });
    this.applyTheme(changed.theme);
  };

  constructor(private onResult: (result: PanelToolResult) => void, private onTheme: (theme: 'light' | 'dark') => void) {}

  connect() {
    this.globals();
    window.addEventListener('openai:set_globals', this.globals);
    if (window.parent === window) return;
    window.addEventListener('message', this.listener);
    this.request('ui/initialize', {
      protocolVersion: '2026-01-26',
      appInfo: { name: 'Zodiacs Feature Cards', version: '0.1.0' },
      appCapabilities: { availableDisplayModes: ['inline'] },
    }).then((result) => {
      this.applyTheme(result?.hostContext?.theme);
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, this.targetOrigin);
      if (!openai()) {
        this.stopSizing = reportSizeChanges((message) => window.parent.postMessage(message, this.targetOrigin));
        if (result?.hostCapabilities?.openLinks) this.stopLinks = openLinksThroughHost((url) => this.request('ui/open-link', { url }));
      }
    }).catch(() => {});
  }

  private request(method: string, params: unknown): Promise<any> {
    const id = `zodiacs-features-${++this.serial}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The assistant did not respond.')); }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, this.targetOrigin);
    });
  }

  dispose() {
    window.removeEventListener('message', this.listener);
    window.removeEventListener('openai:set_globals', this.globals);
    this.stopSizing();
    this.stopLinks();
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('The panel closed.')); }
    this.pending.clear();
  }
}
