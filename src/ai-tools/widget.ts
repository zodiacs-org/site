/** Self-contained UI resource: no fetch, storage, personal data or external assets. */
export const WIDGET_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zodiacs sky events</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0c0e16;color:#eef1f7}body{margin:0;padding:20px;max-width:760px}h1{font:normal 28px Georgia,serif;margin:0 0 12px}p{line-height:1.5;color:#b9bfce}ol{padding-left:22px}li{padding:12px 0;border-bottom:1px solid #272c3b}time{display:block;font-size:14px;color:#b9bfce;margin-top:5px}a{color:#c3d4ff;text-underline-offset:3px}nav{display:flex;flex-wrap:wrap;gap:16px;margin-top:20px}#status{min-height:20px}form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:grid;gap:6px;font-size:14px}input,button{font:inherit;color:inherit;background:#181c29;border:1px solid #454c61;border-radius:6px;padding:10px;min-width:0}button{cursor:pointer;align-self:end}button:disabled{opacity:.55;cursor:default}input:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid #c3d4ff;outline-offset:3px}#controls-help{font-size:13px} @media(max-width:420px){form{grid-template-columns:1fr}}
</style></head><body><main><h1>Sky calendar</h1><p id="status" role="status">Open the calendar for the next seven days, or ask Zodiacs about a week or month.</p><form id="calendar" aria-describedby="controls-help"><label>Start date (UTC, exclusive)<input id="from" type="date" required></label><label>End date (UTC, inclusive)<input id="to" type="date" required></label><label>Display timezone<input id="zone" type="text" value="UTC" maxlength="64" required autocomplete="off" spellcheck="false"></label><button id="update" type="submit" disabled>Update calendar</button></form><p id="controls-help">Windows are at most 31 days. Date controls use midnight UTC; the timezone changes the displayed event times.</p><ol id="events"></ol><p id="coverage"></p><nav id="links" aria-label="Explore on Zodiacs"></nav></main>
<script>
(() => {
  const status = document.getElementById('status'), list = document.getElementById('events'), coverage = document.getElementById('coverage'), links = document.getElementById('links');
  const form = document.getElementById('calendar'), from = document.getElementById('from'), to = document.getElementById('to'), zone = document.getElementById('zone'), update = document.getElementById('update');
  let ready = false, busy = false, serial = 0;
  const pending = new Map();
  const refreshControls = () => { update.disabled = busy || (!ready && typeof window.openai?.callTool !== 'function'); };
  const refuse = message => render({ tool: 'get_upcoming_events', ok: false, error: { message } });
  const label = event => event.kind === 'lunation' ? (event.type === 'new' ? 'New Moon' : 'Full Moon') : event.kind === 'station' ? event.body + ' stations ' + event.type : event.body + ' enters ' + event.sign;
  function render(result) {
    if (!result || result.tool !== 'get_upcoming_events') return;
    list.replaceChildren(); links.replaceChildren(); coverage.textContent = '';
    if (!result.ok) { status.textContent = result.error?.message || 'The event search could not be completed.'; return; }
    const data = result.data;
    from.value = data.from.slice(0, 10); to.value = data.to.slice(0, 10); zone.value = data.zone;
    status.textContent = data.from + ' to ' + data.to + ' · ' + data.zone;
    for (const event of data.events) {
      const item = document.createElement('li'); item.append(document.createTextNode(label(event)));
      const time = document.createElement('time'); time.dateTime = event.at; time.textContent = event.localAt + ' · UTC ' + event.at; item.append(time); list.append(item);
    }
    if (!data.events.length) status.textContent += ' · No supported events were found in this window.';
    coverage.textContent = 'Tropical geocentric · Engine ' + (data.calculation?.backend?.version || 'version in receipt') + '. Supported searches: sign ingresses, stations, new and full Moons. Completeness is tested, not proven.';
    for (const link of result.links || []) {
      let url; try { url = new URL(link.url); } catch { continue; }
      if (url.origin !== 'https://zodiacs.org' || url.search || url.hash) continue;
      const anchor = document.createElement('a'); anchor.href = url.href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = link.title; links.append(anchor);
    }
    if (window.parent !== window) window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height:document.documentElement.scrollHeight}}, '*');
  }
  async function callCalendar(args) {
    if (typeof window.openai?.callTool === 'function') return window.openai.callTool('get_upcoming_events', args);
    if (!ready) throw new Error('host-unavailable');
    const id = 'zodiacs-events-' + ++serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('host-timeout')); }, 15000);
      pending.set(id, { resolve, reject, timer });
      window.parent.postMessage({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'get_upcoming_events', arguments: args } }, '*');
    });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const start = new Date(from.value + 'T00:00:00Z'), end = new Date(to.value + 'T00:00:00Z');
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end - start > 31 * 86400000) { refuse('Choose an increasing UTC date window of at most 31 days.'); return; }
    busy = true; refreshControls(); status.textContent = 'Calculating sky events…';
    try {
      const result = await callCalendar({ from: start.toISOString(), to: end.toISOString(), zone: zone.value.trim() });
      const output = result?.structuredContent ?? result;
      if (output?.tool !== 'get_upcoming_events') throw new Error('invalid-output');
      render(output);
    } catch { refuse('The calendar could not be updated. Try again from the connected app.'); }
    finally { busy = false; refreshControls(); }
  });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || !event.data || event.data.jsonrpc !== '2.0') return;
    if (event.data.id === 'zodiacs-ui-init' && event.data.result && !ready) {
      ready = true; window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized'}, '*');
      refreshControls();
    }
    const request = pending.get(event.data.id);
    if (request) { clearTimeout(request.timer); pending.delete(event.data.id); if (event.data.error) request.reject(new Error('host-failed')); else request.resolve(event.data.result); }
    if (event.data.method === 'ui/notifications/tool-result') render(event.data.params?.structuredContent);
  });
  window.addEventListener('openai:set_globals', event => { render(event.detail?.globals?.toolOutput); refreshControls(); });
  render(window.openai?.toolOutput);
  refreshControls();
  if (window.parent !== window) window.parent.postMessage({jsonrpc:'2.0',id:'zodiacs-ui-init',method:'ui/initialize',params:{protocolVersion:'2026-01-26',appInfo:{name:'Zodiacs sky calendar',version:'0.1.0'},appCapabilities:{availableDisplayModes:['inline','fullscreen']}}}, '*');
})();
</script></body></html>`;
