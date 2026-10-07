/** Self-contained UI resource: no fetch, storage, personal data or external assets. */
export const WIDGET_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zodiacs sky calendar</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0c0e16;color:#eef1f7}body{margin:0;padding:20px;max-width:760px}h1{font:normal 28px Georgia,serif;margin:0 0 12px}p{line-height:1.5;color:#b9bfce}ol{padding-left:22px}li{padding:12px 0;border-bottom:1px solid #272c3b}time{display:block;font-size:14px;color:#b9bfce;margin-top:5px}a{color:#c3d4ff;text-underline-offset:3px}nav{display:flex;flex-wrap:wrap;gap:16px;margin-top:20px}#status{min-height:20px}form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:grid;gap:6px;font-size:14px}input,select,button{font:inherit;color:inherit;background:#181c29;border:1px solid #454c61;border-radius:6px;padding:10px;min-width:0}button{cursor:pointer;align-self:end}button:disabled{opacity:.55;cursor:default}input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid #c3d4ff;outline-offset:3px}#controls-help{font-size:13px} @media(max-width:420px){form{grid-template-columns:1fr}}
</style></head><body><main><h1>Sky calendar</h1><p id="status" role="status">Ask about a week or month, or choose dates below.</p><form id="calendar" aria-describedby="controls-help"><label>From<input id="from" type="date" required></label><label>To<input id="to" type="date" required></label><label>Times for<select id="zone"></select></label><button id="update" type="submit" disabled>Show these dates</button></form><p id="controls-help">Up to 92 days at a time.</p><ol id="events"></ol><p id="coverage"></p><nav id="links" aria-label="Explore on Zodiacs"></nav></main>
<script>
(() => {
  const status = document.getElementById('status'), list = document.getElementById('events'), coverage = document.getElementById('coverage'), links = document.getElementById('links');
  const form = document.getElementById('calendar'), from = document.getElementById('from'), to = document.getElementById('to'), zone = document.getElementById('zone'), update = document.getElementById('update');
  const COMMON = ['America/Los_Angeles','America/Chicago','America/New_York','America/Sao_Paulo','Europe/London','Europe/Paris','Europe/Moscow','Africa/Lagos','Asia/Dubai','Asia/Kolkata','Asia/Bangkok','Asia/Singapore','Asia/Tokyo','Australia/Sydney','UTC'];
  const place = name => name === 'UTC' || name === 'Etc/UTC' ? 'UTC' : name.split('/').pop().replace(/_/g, ' ');
  let device = 'UTC'; try { device = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch {}
  function setZones(selected) {
    const names = [device, ...COMMON.filter(name => name !== device)];
    if (selected && !names.includes(selected)) names.splice(1, 0, selected);
    zone.replaceChildren(...names.map(name => { const option = document.createElement('option'); option.value = name; option.textContent = name === device ? 'Your time (' + place(name) + ')' : place(name); return option; }));
    zone.value = selected && names.includes(selected) ? selected : device;
  }
  setZones(device);
  let ready = false, busy = false, serial = 0, last = null;
  const pending = new Map();
  const refreshControls = () => { update.disabled = busy || (!ready && typeof window.openai?.callTool !== 'function'); };
  const refuse = message => render({ tool: 'get_upcoming_events', ok: false, error: { message } });
  const cap = text => text ? text[0].toUpperCase() + text.slice(1) : '';
  const label = event => event.kind === 'lunation' ? (event.type === 'new' ? 'New Moon' : 'Full Moon') + ' in ' + cap(event.sign) : event.kind === 'station' ? event.body + ' turns ' + event.type + ' in ' + cap(event.sign) : event.body + ' enters ' + cap(event.sign);
  const when = (at, name) => new Intl.DateTimeFormat('en-GB', { timeZone: name, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(at));
  const day = (at, name) => new Intl.DateTimeFormat('en-GB', { timeZone: name, day: 'numeric', month: 'short' }).format(new Date(at));
  const localDate = (at, name) => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: name, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(at)); return ['year','month','day'].map(type => parts.find(part => part.type === type).value).join('-'); };
  // The instant when a local date begins in a zone (two passes settle daylight-saving changes).
  function startOf(date, name) {
    const [y, m, d] = date.split('-').map(Number);
    let guess = Date.UTC(y, m - 1, d);
    for (let pass = 0; pass < 2; pass++) {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: name, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(guess)).map(part => [part.type, part.value]));
      const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
      guess -= wall - Date.UTC(y, m - 1, d);
    }
    return new Date(guess);
  }
  function render(result) {
    if (!result || result.tool !== 'get_upcoming_events') return;
    list.replaceChildren(); links.replaceChildren(); coverage.textContent = '';
    if (!result.ok) { status.textContent = result.error?.message || 'The calendar could not be updated.'; return; }
    last = result;
    const data = result.data;
    const shown = data.zone && data.zone !== 'UTC' ? data.zone : zone.value || device;
    setZones(shown);
    from.value = localDate(data.from, shown); to.value = localDate(new Date(new Date(data.to).getTime() - 1).toISOString(), shown);
    status.textContent = day(data.from, shown) + ' – ' + day(new Date(new Date(data.to).getTime() - 1).toISOString(), shown) + ' · times for ' + place(shown);
    for (const event of data.events) {
      const item = document.createElement('li'); item.append(document.createTextNode(label(event)));
      const time = document.createElement('time'); time.dateTime = event.at; time.textContent = when(event.at, shown); item.append(time); list.append(item);
    }
    if (!data.events.length) status.textContent += ' · Nothing changes in these dates.';
    coverage.textContent = 'Shows planets changing sign, turning retrograde or direct, and new and full Moons. It does not list eclipses.';
    for (const link of result.links || []) {
      let url; try { url = new URL(link.url); } catch { continue; }
      if (url.origin !== 'https://zodiacs.org' || url.search || url.hash) continue;
      const anchor = document.createElement('a'); anchor.href = url.href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = link.title; links.append(anchor);
    }
    fit();
  }
  // Content height, not the frame's: a host that started the frame tall can shrink it to fit.
  let fitted = 0;
  function fit() {
    if (window.parent === window) return;
    const root = document.documentElement, previous = root.style.height;
    root.style.height = 'max-content'; const height = Math.ceil(root.getBoundingClientRect().height); root.style.height = previous;
    if (height === fitted) return; fitted = height;
    window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/size-changed',params:{height}}, '*');
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => fit()).observe(document.body);
  zone.addEventListener('change', () => { if (last) { const data = last.data; last = { ...last, data: { ...data, zone: zone.value } }; render(last); } });
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
    const name = zone.value || device;
    let start, end;
    try { start = startOf(from.value, name); end = startOf(new Date(Date.parse(to.value + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10), name); } catch { start = end = new Date(NaN); }
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end - start > 92 * 86400000 + 7200000) { refuse('Choose a "From" date before the "To" date, up to 92 days apart.'); return; }
    busy = true; refreshControls(); status.textContent = 'Working out the sky…';
    try {
      const result = await callCalendar({ from: start.toISOString(), to: end.toISOString(), zone: name });
      const output = result?.structuredContent ?? result;
      if (output?.tool !== 'get_upcoming_events') throw new Error('invalid-output');
      render(output);
    } catch { refuse('The calendar could not be updated. Try again from the chat.'); }
    finally { busy = false; refreshControls(); }
  });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || !event.data || event.data.jsonrpc !== '2.0') return;
    if (event.data.id === 'zodiacs-ui-init' && event.data.result && !ready) {
      ready = true; window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized'}, '*');
      // A sandboxed frame may not open tabs itself; when the host offers to, links go through it.
      if (event.data.result.hostCapabilities?.openLinks) document.addEventListener('click', click => {
        const link = click.target instanceof Element ? click.target.closest('a[href]') : null;
        if (!link || !/^https?:$/.test(link.protocol)) return;
        click.preventDefault();
        window.parent.postMessage({ jsonrpc: '2.0', id: 'zodiacs-link-' + ++serial, method: 'ui/open-link', params: { url: link.href } }, '*');
      });
      refreshControls();
    }
    const request = pending.get(event.data.id);
    if (request) { clearTimeout(request.timer); pending.delete(event.data.id); if (event.data.error) request.reject(new Error('host-failed')); else request.resolve(event.data.result); }
    if (event.data.method === 'ui/notifications/tool-result') render(event.data.params?.structuredContent);
  });
  window.addEventListener('openai:set_globals', event => { render(event.detail?.globals?.toolOutput); refreshControls(); });
  render(window.openai?.toolOutput);
  refreshControls();
  if (window.parent !== window) window.parent.postMessage({jsonrpc:'2.0',id:'zodiacs-ui-init',method:'ui/initialize',params:{protocolVersion:'2026-01-26',appInfo:{name:'Zodiacs sky calendar',version:'0.4.0'},appCapabilities:{availableDisplayModes:['inline','fullscreen']}}}, '*');
})();
</script></body></html>`;
