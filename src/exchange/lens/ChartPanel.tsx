import { useEffect, useRef, useState } from 'preact/hooks';
import type { IChartApi, Time, UTCTimestamp, IRange } from 'lightweight-charts';
import type { Indicators, MarketDataset, SkyEvent } from './types';

interface Props {
  data: MarketDataset | null;
  indicators: Indicators;
  events: SkyEvent[];
  selectedEvent: SkyEvent | null;
  timeZone: string;
  onSelectEvent: (event: SkyEvent) => void;
}

function contiguousRuns(points: Indicators['sma20'], seconds: number) {
  const runs: Indicators['sma20'][] = [];
  for (const point of points) {
    const current = runs.at(-1);
    if (!current || point.time - current.at(-1)!.time !== seconds) runs.push([point]);
    else current.push(point);
  }
  return runs;
}

function eventRange(event: SkyEvent | null, data: MarketDataset): IRange<Time> | null {
  if (!event) return null;
  const at = Date.parse(event.at) / 1000;
  const first = data.candles[0]?.time; const last = data.candles.at(-1)?.time;
  if (first === undefined || last === undefined || at < first || at > last) return null;
  const step = data.interval === '1h' ? 3600 : 86400;
  const from = Math.max(first, Math.floor(at / step) * step - 25 * step) as UTCTimestamp;
  const to = Math.min(last, Math.floor(at / step) * step + 25 * step) as UTCTimestamp;
  return from < to ? { from, to } : null;
}

export default function ChartPanel({ data, indicators, events, selectedEvent, timeZone, onSelectEvent }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<IChartApi | null>(null);
  const visibleRange = useRef<IRange<Time> | null>(null);
  const chartKey = useRef('');
  const selection = useRef(selectedEvent);
  selection.current = selectedEvent;
  const [error, setError] = useState('');
  const [showMA, setShowMA] = useState(true);
  const [showRSI, setShowRSI] = useState(true);

  useEffect(() => {
    if (!host.current || !data?.candles.length) return;
    const key = `${data.instrument.id}:${data.interval}`;
    if (chartKey.current !== key) { visibleRange.current = null; chartKey.current = key; }
    let disposed = false;
    let resize: ResizeObserver | undefined;
    setError('');
    import('lightweight-charts').then((lib) => {
      if (disposed || !host.current) return;
      const chart = lib.createChart(host.current, {
        height: showRSI ? 450 : 370,
        layout: { background: { type: lib.ColorType.Solid, color: '#0d0f16' }, textColor: '#a9adbe', fontFamily: 'Instrument Sans', attributionLogo: true },
        grid: { vertLines: { color: '#1b1e29' }, horzLines: { color: '#1b1e29' } },
        rightPriceScale: { borderColor: '#292d3a', scaleMargins: { top: 0.08, bottom: 0.23 } },
        timeScale: { borderColor: '#292d3a', timeVisible: data.interval === '1h', secondsVisible: false,
          tickMarkFormatter: (value: Time) => typeof value === 'number' ? new Intl.DateTimeFormat('en', { timeZone, month: 'short', day: 'numeric', ...(data.interval === '1h' ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value * 1000)) : null },
        localization: { timeFormatter: (value: Time) => typeof value === 'number'
          ? new Intl.DateTimeFormat('en', { timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value * 1000))
          : String(value) },
      });
      api.current = chart;
      const series = chart.addSeries(lib.CandlestickSeries, {
        upColor: '#a9cdb5', downColor: '#d5a6ad', borderVisible: false,
        wickUpColor: '#a9cdb5', wickDownColor: '#d5a6ad', priceLineVisible: true,
      });
      const seconds = data.interval === '1h' ? 3600 : 86400;
      const byTime = new Map(data.candles.map((c) => [c.time, c]));
      const first = data.candles[0].time;
      const last = data.candles[data.candles.length - 1].time;
      const chartData = [];
      for (let time = first; time <= last; time += seconds) {
        const candle = byTime.get(time);
        chartData.push(candle
          ? { time: time as UTCTimestamp, open: candle.open, high: candle.high, low: candle.low, close: candle.close }
          : { time: time as UTCTimestamp });
      }
      series.setData(chartData);
      const volume = chart.addSeries(lib.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', priceLineVisible: false, lastValueVisible: false });
      volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volume.setData(data.candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? '#a9cdb535' : '#d5a6ad35' })));
      if (showMA) {
        const curves = [[indicators.sma20, '#aebce9', 'SMA 20'], [indicators.sma50, '#d6b6da', 'SMA 50'], [indicators.ema20, '#e3c8a9', 'EMA 20']] as const;
        for (const [points, color, title] of curves) {
          // Separate series avoid a line connecting computed values across a gap.
          for (const run of contiguousRuns(points, seconds)) {
            const line = chart.addSeries(lib.LineSeries, { color, lineWidth: 1, title, priceLineVisible: false, lastValueVisible: false });
            line.setData(run.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
          }
        }
      }
      if (showRSI) {
        const runs = contiguousRuns(indicators.rsi14, seconds);
        for (const [index, run] of runs.entries()) {
          const rsi = chart.addSeries(lib.LineSeries, { color: '#c5b8e7', lineWidth: 1, title: 'RSI 14', priceLineVisible: false, lastValueVisible: index === runs.length - 1 }, 1);
          rsi.setData(run.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
          if (index === 0) {
            rsi.createPriceLine({ price: 70, color: '#535065', lineWidth: 1, lineStyle: lib.LineStyle.Dashed, axisLabelVisible: false });
            rsi.createPriceLine({ price: 30, color: '#535065', lineWidth: 1, lineStyle: lib.LineStyle.Dashed, axisLabelVisible: false });
          }
        }
      }
      const windowIds = new Set<string>();
      const markerEvents = events.flatMap(event => {
        if (!event.personal || windowIds.has(event.personal.window.id)) return [event];
        windowIds.add(event.personal.window.id);
        const window = event.personal.window;
        return [event, { ...event, at: window.startUtc, subtype: 'window-entry' }, { ...event, at: window.endUtc, subtype: 'window-exit' }];
      });
      const markers = markerEvents.map((event) => ({ event, bucket: Math.floor(Date.parse(event.at) / 1000 / seconds) * seconds }))
        .filter(({ bucket }) => byTime.has(bucket))
        .sort((a, b) => a.bucket - b.bucket || a.event.id.localeCompare(b.event.id));
      lib.createSeriesMarkers(series, markers.map(({ event, bucket }) => ({
        time: bucket as UTCTimestamp, position: 'aboveBar', shape: event.economic ? 'square' : event.personal ? event.subtype === 'window-entry' ? 'arrowUp' : event.subtype === 'window-exit' ? 'arrowDown' : 'square' : 'circle',
        color: event.economic ? '#e3c8a9' : event.personal ? '#a9cdb5' : event.family === 'lunation' ? '#c5b8e7' : event.family === 'eclipse' ? '#e5b6c1' : '#b1c4d5',
        text: event.economic ? 'E' : event.personal ? event.subtype === 'window-entry' ? 'P start' : event.subtype === 'window-exit' ? 'P end' : 'P' : '',
      })));
      chart.subscribeClick((param) => {
        if (typeof param.time !== 'number') return;
        const candidates = markers.filter((m) => m.bucket === Number(param.time));
        if (candidates[0]) onSelectEvent(candidates[0].event);
      });
      const range = visibleRange.current ?? eventRange(selection.current, data);
      if (range) chart.timeScale().setVisibleRange(range); else chart.timeScale().fitContent();
      resize = new ResizeObserver(() => host.current && chart.applyOptions({ width: host.current.clientWidth }));
      resize.observe(host.current);
    }).catch(() => !disposed && setError('The chart could not load. Prices and events remain available in the tables below.'));
    return () => { disposed = true; resize?.disconnect(); visibleRange.current = api.current?.timeScale().getVisibleRange() ?? visibleRange.current; api.current?.remove(); api.current = null; };
  }, [data, indicators, events, showMA, showRSI, timeZone]);

  useEffect(() => {
    if (!selectedEvent || !data || !api.current) return;
    const range = eventRange(selectedEvent, data);
    if (range) { api.current.timeScale().setVisibleRange(range); visibleRange.current = range; }
  }, [selectedEvent?.id]);

  const latest = data?.candles.filter((c) => c.complete).at(-1);
  const indicatorValues = [indicators.sma20, indicators.sma50, indicators.ema20, indicators.rsi14].map((points) => new Map(points.map((p) => [p.time, p.value])));
  return <section class="lens-panel lens-chart-panel" aria-labelledby="lens-chart-title">
    <div class="lens-section-head">
      <div><h2 id="lens-chart-title">Price &amp; sky</h2><p class="lens-muted">Shared markers are circles; personal contacts are green squares, with arrows at window entry and exit. Markers sit on their containing candle. Event details retain the exact time.</p></div>
      <div class="lens-inline">
        <label class="lens-check"><input type="checkbox" checked={showMA} onChange={() => setShowMA(!showMA)} /> Moving averages</label>
        <label class="lens-check"><input type="checkbox" checked={showRSI} onChange={() => setShowRSI(!showRSI)} /> RSI</label>
      </div>
    </div>
    <div class="lens-chart" ref={host} data-testid="lens-chart" aria-label="Candlestick chart with volume, technical indicators, and astronomical event markers" />
    {error && <p class="lens-error" role="alert">{error}</p>}
    {!data && <p class="lens-chart-empty">Loading public candles…</p>}
    <div class="lens-chart-foot"><span>SMA 20 · SMA 50 · EMA 20 · RSI 14 · base-asset volume</span>
      <div class="lens-inline"><button class="lens-button lens-button--quiet" onClick={() => api.current?.timeScale().fitContent()}>Fit history</button><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">Charting by TradingView</a></div></div>
    <details class="lens-data-table"><summary>Accessible prices &amp; indicators · latest 20 finalized candles</summary>
      <div class="lens-table-scroll"><table><caption>{data?.instrument.id ?? 'Selected instrument'} · {data?.interval} · Coinbase Exchange</caption>
        <thead><tr><th scope="col">Time ({timeZone})</th><th scope="col">Open</th><th scope="col">High</th><th scope="col">Low</th><th scope="col">Close</th><th scope="col">Volume</th><th scope="col">SMA 20</th><th scope="col">SMA 50</th><th scope="col">EMA 20</th><th scope="col">RSI 14</th></tr></thead>
        <tbody>{data?.candles.filter((c) => c.complete).slice(-20).reverse().map((c) => <tr key={c.time}><th scope="row">{new Intl.DateTimeFormat('en', { timeZone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(c.time * 1000))}</th>{[c.open, c.high, c.low, c.close, c.volume, ...indicatorValues.map((values) => values.get(c.time))].map((n) => <td>{n === undefined ? 'Unavailable' : n.toLocaleString('en', { maximumFractionDigits: 2 })}</td>)}</tr>)}</tbody>
      </table></div>
      {latest && <p class="lens-muted">Last finalized close: ${latest.close.toLocaleString('en', { maximumFractionDigits: 2 })}. Indicator calculations use finalized candles and restart after gaps.</p>}
    </details>
  </section>;
}
