import { useState } from 'preact/hooks';
import type { EventFamily, InstrumentId, Interval, RuleCondition, RuleMatch, WatchRule } from './types';
import { formatEventDate, formatEventTime } from './events';

type RuleInput = { condition: RuleCondition; threshold?: number; family: EventFamily | 'any'; windowHours: number };

export interface RulesPanelProps {
  rules: WatchRule[];
  matches: RuleMatch[];
  instrument: InstrumentId;
  interval: Interval;
  timeZone: string;
  onSave: (input: RuleInput) => Promise<void>;
  onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  storageError: string | null;
}

const conditions: Record<RuleCondition, string> = {
  'sma-cross-up': 'SMA 20 crosses above SMA 50',
  'sma-cross-down': 'SMA 20 crosses below SMA 50',
  'price-cross-up': 'Close crosses above a price level',
  'price-cross-down': 'Close crosses below a price level',
  'rsi-cross-up': 'RSI 14 crosses above a threshold',
  'rsi-cross-down': 'RSI 14 crosses below a threshold',
};
const families: Record<EventFamily | 'any', string> = {
  any: 'Any sky event',
  lunation: 'Lunar phase',
  eclipse: 'Eclipse',
  station: 'Planetary station',
  retrograde: 'Retrograde interval',
  ingress: 'Sign ingress',
  aspect: 'Exact aspect',
};

export default function RulesPanel({ rules, matches, instrument, interval, timeZone, onSave, onToggle, onDelete, storageError }: RulesPanelProps) {
  const timestamp = (value: string) => `${formatEventDate(value, timeZone)} · ${formatEventTime(value, timeZone)}`;
  const [condition, setCondition] = useState<RuleCondition>('rsi-cross-up');
  const [threshold, setThreshold] = useState('30');
  const [family, setFamily] = useState<EventFamily | 'any'>('any');
  const [windowHours, setWindowHours] = useState('24');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const needsThreshold = !condition.startsWith('sma-');
  const isRsi = condition.startsWith('rsi-');
  const visibleRules = rules.filter(rule => rule.instrument === instrument && rule.interval === interval);

  function chooseCondition(value: RuleCondition) {
    setCondition(value);
    setThreshold(value === 'rsi-cross-up' ? '30' : value === 'rsi-cross-down' ? '70' : '');
    setError(null);
  }

  async function perform(action: () => Promise<void>, successMessage: string) {
    setPending(true);
    setError(null);
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The watch rule could not be updated. Please try again.');
    } finally {
      setPending(false);
    }
  }

  async function save(event: Event) {
    event.preventDefault();
    const hours = Number(windowHours);
    const level = Number(threshold);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      setError('Choose a whole-number event window between 1 and 720 hours.');
      return;
    }
    if (needsThreshold && (!threshold.trim() || !Number.isFinite(level) || (isRsi ? level < 0 || level > 100 : level <= 0 || level > 1e9))) {
      setError(isRsi ? 'Choose an RSI threshold from 0 to 100.' : 'Enter a positive price level up to 1,000,000,000 USD.');
      return;
    }
    await perform(() => onSave({ condition, ...(needsThreshold ? { threshold: level } : {}), family, windowHours: hours }), 'Watch rule saved on this device.');
  }

  return (
    <section class="lens-panel" aria-labelledby="lens-rules-heading" data-testid="lens-rules">
      <h2 id="lens-rules-heading" class="lens-section-title">Watch rules</h2>
      <p class="lens-muted">Combine a technical crossing with a sky-event window. Matches use loaded, completed candles. Reminders appear on this page while it is open.</p>
      {(error || storageError) && <p class="lens-error" role="alert">{error || storageError}</p>}
      <p role="status" aria-live="polite" class="lens-muted">{message}</p>
      <form class="lens-form" onSubmit={save} aria-busy={pending} data-testid="rule-form">
        <p class="lens-muted">New rule · {instrument} · {interval === '1h' ? '1-hour candles' : 'Daily candles'}</p>
        <label class="lens-field" for="lens-rule-condition">Technical condition
          <select id="lens-rule-condition" value={condition} disabled={pending} onChange={event => chooseCondition(event.currentTarget.value as RuleCondition)} data-testid="rule-condition">
            {(Object.entries(conditions) as [RuleCondition, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {needsThreshold && <label class="lens-field" for="lens-rule-threshold">{isRsi ? 'RSI threshold (0–100)' : 'Price level (USD)'}
          <input id="lens-rule-threshold" type="number" min={isRsi ? '0' : '0.00000001'} max={isRsi ? '100' : '1000000000'} step="any" required value={threshold} disabled={pending} onInput={event => setThreshold(event.currentTarget.value)} data-testid="rule-threshold" />
        </label>}
        <div class="lens-inline">
          <label class="lens-field" for="lens-rule-family">Sky event
            <select id="lens-rule-family" value={family} disabled={pending} onChange={event => setFamily(event.currentTarget.value as EventFamily | 'any')} data-testid="rule-family">
              {(Object.entries(families) as [EventFamily | 'any', string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label class="lens-field" for="lens-rule-window">Window before and after event (hours)
            <input id="lens-rule-window" type="number" min="1" max="720" step="1" required value={windowHours} disabled={pending} onInput={event => setWindowHours(event.currentTarget.value)} data-testid="rule-window" />
          </label>
        </div>
        <p class="lens-muted">Both clauses must match: the technical crossing and a selected sky event within {windowHours || '…'} hours before or after that candle.</p>
        <button class="lens-button lens-button--primary" type="submit" disabled={pending || Boolean(storageError)} data-testid="rule-save">{pending ? 'Saving…' : 'Save watch rule'}</button>
      </form>
      <div class="lens-list" data-testid="rule-list">
        <h3 class="lens-section-title">Rules for this chart ({visibleRules.length})</h3>
        {visibleRules.length === 0 && <p class="lens-muted">Save a rule to watch for an overlap in your loaded chart history.</p>}
        {visibleRules.map(rule => {
          const ruleMatches = matches.filter(match => match.ruleId === rule.id).slice().sort((a, b) => b.at.localeCompare(a.at));
          return <article class="lens-card" key={rule.id} data-testid="watch-rule">
            <p><strong>{conditions[rule.condition]}{rule.threshold !== undefined ? ` (${rule.threshold}${rule.condition.startsWith('price-') ? ' USD' : ''})` : ''}</strong></p>
            <p>{families[rule.family]} within {rule.windowHours} hours before or after the crossing.</p>
            <p class="lens-muted">{rule.instrument} · {rule.interval === '1h' ? '1-hour' : 'Daily'} · {rule.enabled ? 'Enabled' : 'Paused'} · Rule version {rule.version}</p>
            <div class="lens-inline">
              <button class="lens-button lens-button--quiet" type="button" disabled={pending || Boolean(storageError)} onClick={() => void perform(() => onToggle(rule.id), rule.enabled ? 'Watch rule paused.' : 'Watch rule enabled.')} data-testid="rule-toggle">{rule.enabled ? 'Pause' : 'Enable'}</button>
              <button class="lens-button lens-button--quiet" type="button" disabled={pending || Boolean(storageError)} onClick={() => void perform(() => onDelete(rule.id), 'Watch rule deleted from this device.')} data-testid="rule-delete">Delete rule</button>
            </div>
            {ruleMatches.length > 0 ? <details open data-testid="rule-matches">
              <summary>{ruleMatches.length} {ruleMatches.length === 1 ? 'match' : 'matches'} in loaded data</summary>
              <ol class="lens-list">{ruleMatches.slice(0, 5).map(match => <li class="lens-card" key={match.key}>
                <time dateTime={match.at}>{timestamp(match.at)}</time>
                <p><strong>Technical clause:</strong> {match.condition}</p>
                <p><strong>Sky clause:</strong> {families[rule.family]} within ±{rule.windowHours} h.</p>
                <details><summary>Sky event reference</summary><p class="lens-muted">{match.eventId}</p></details>
              </li>)}</ol>
              {ruleMatches.length > 5 && <p class="lens-muted">Showing the five most recent matches.</p>}
            </details> : <p class="lens-muted">{rule.enabled ? 'No match in the loaded completed candles.' : 'Enable this rule to evaluate loaded candles.'}</p>}
          </article>;
        })}
      </div>
    </section>
  );
}
