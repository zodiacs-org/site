import { reportSizeChanges } from '../fit-height';
import { openLinksThroughHost } from '../open-links';

/** MCP Apps transport. Only explicit user actions call share(); chart state is never persisted. */
export class StudioBridge {
  private pending = new Map<string, { resolve: (value: any) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private serial = 0;
  private ready = false;
  private targetOrigin = '*';
  private textContext = false;
  private textMessage = false;
  private stopSizing: () => void = () => {};
  private stopLinks: () => void = () => {};
  private listener = (event: MessageEvent) => {
    if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) return;
    const request = this.pending.get(event.data.id);
    if (!request) return;
    if (event.data.id === 'zodiacs-studio-1' && event.data.result && event.origin !== 'null') this.targetOrigin = event.origin;
    clearTimeout(request.timer); this.pending.delete(event.data.id);
    if (event.data.error) request.reject(new Error('The assistant could not accept this selection.'));
    else request.resolve(event.data.result);
  };
  constructor(private changed: (available: boolean) => void) {}
  async connect() {
    if (window.parent === window) return;
    window.addEventListener('message', this.listener);
    try {
      const result = await this.request('ui/initialize', { protocolVersion: '2026-01-26', appInfo: { name: 'Zodiacs Chart Studio', version: '0.3.0' }, appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] } });
      this.textContext = !!result?.hostCapabilities?.updateModelContext?.text;
      this.textMessage = !!result?.hostCapabilities?.message?.text;
      this.ready = true;
      window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, this.targetOrigin);
      this.changed(this.textContext || this.textMessage);
      this.stopSizing = reportSizeChanges((message) => window.parent.postMessage(message, this.targetOrigin));
      if (result?.hostCapabilities?.openLinks) this.stopLinks = openLinksThroughHost((url) => this.request('ui/open-link', { url }));
    } catch { this.changed(false); }
  }
  private request(method: string, params: unknown): Promise<any> {
    const id = `zodiacs-studio-${++this.serial}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The assistant did not respond. Try again.')); }, 10000);
      this.pending.set(id, { resolve, reject, timer });
      window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, this.targetOrigin);
    });
  }
  async share(text: string) {
    if (!this.ready) throw new Error('Open Chart Studio in a connected assistant to share a selection.');
    // Context-only attachment lets the user write their question before sending.
    if (this.textContext) await this.request('ui/update-model-context', { content: [{ type: 'text', text, _meta: { 'openai/title': 'Zodiacs chart selection' } }] });
    else if (this.textMessage) await this.request('ui/message', { role: 'user', content: [{ type: 'text', text: 'Explain this selected chart element. Separate computed facts from astrological interpretation.\n' + text }] });
    else throw new Error('This host cannot receive chart context.');
    return this.textContext ? 'Selection attached. Ask your question in the conversation.' : 'Selection sent to the conversation.';
  }
  dispose() {
    window.removeEventListener('message', this.listener);
    this.stopSizing();
    this.stopLinks();
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Chart Studio closed.')); }
    this.pending.clear(); this.ready = false;
  }
}
