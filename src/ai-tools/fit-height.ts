/**
 * Tells an MCP Apps host how big the panel's content is, so an inline panel
 * grows to fit instead of scrolling inside a short frame (Claude clips and
 * scrolls otherwise). Measured the way the MCP Apps SDK does: height from a
 * temporary max-content root, width from the window; sent only on change.
 */
export function reportSizeChanges(post: (message: unknown) => void): () => void {
  // Sizing is a courtesy to the host; without a page to measure it does nothing.
  if (typeof document === 'undefined' || typeof ResizeObserver === 'undefined' || typeof requestAnimationFrame === 'undefined') return () => {};
  let width = 0, height = 0, frame = 0;
  const measure = () => {
    frame = 0;
    const root = document.documentElement;
    const previous = root.style.height;
    root.style.height = 'max-content';
    const nextHeight = Math.ceil(root.getBoundingClientRect().height);
    root.style.height = previous;
    const nextWidth = Math.ceil(window.innerWidth);
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth; height = nextHeight;
    post({ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { width, height } });
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
  const observer = new ResizeObserver(schedule);
  observer.observe(document.documentElement);
  observer.observe(document.body);
  schedule();
  return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
}
