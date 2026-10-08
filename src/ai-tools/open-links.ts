/**
 * Opens the panel's web links through an MCP Apps host that offers to
 * (ui/open-link), since a sandboxed frame may not be allowed to open a tab
 * itself. Hosts that don't offer it keep ordinary links.
 */
export function openLinksThroughHost(open: (url: string) => Promise<unknown>): () => void {
  if (typeof document === 'undefined') return () => {};
  const click = (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest?.('a[href]');
    if (!(link instanceof HTMLAnchorElement) || !/^https?:$/.test(link.protocol)) return;
    event.preventDefault();
    // The host may ask the person first; a refusal or a slow answer leaves the panel as it is.
    open(link.href).catch(() => {});
  };
  document.addEventListener('click', click);
  return () => document.removeEventListener('click', click);
}
