/**
 * Your people: the charts you keep for others and the cards they send you,
 * in the profile's row grammar — a mark, a name, the next date worth
 * knowing, and a way to compare with your own chart. Rows are ordered by
 * that date, so whoever comes up next is at the top. A saved chart counts
 * only once it is explicitly someone else's; received cards are never
 * offered for re-sharing.
 */
import { useMemo, useState } from 'preact/hooks';
import Initial from '../components/Initial';
import { useProfile } from '../lib/hooks/useProfile';
import { useCircle } from '../lib/hooks/useMe';
import { explicitSelfChart } from '../lib/profile/read-store';
import { removeCircleEntry } from '../lib/profile/circle';
import { buildPeople, type PersonRow } from '../lib/profile/your-people';
import { openCardComparison, savedCompareHref } from '../lib/profile/people-compare';
import { OPEN_CARD_EVENT } from '../lib/profile/card-link';
import { encodePositionsLink } from '../lib/share-positions';
import { profileChartHandoffFragment } from '../lib/chart-handoff';
import { useProfileSurface } from '../lib/profile/surface-gate';

/** A date within this many days is coming up, and its stamp reads brighter. */
const SOON_DAYS = 14;
// English-only page: format directly rather than through the locale catalog,
// which would split the shared locale module out of every route's bundle.
const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function whenLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export function nextLine(person: PersonRow): string | null {
  if (!person.next) return null;
  const date = SHORT_DATE.format(person.next.at);
  return person.next.kind === 'birthday' ? `Birthday ${date}` : `Sun returns ${date}`;
}

export default function ProfilePeople({ accountBound = false }: { accountBound?: boolean }) {
  const { profile, ready: profileReady } = useProfile();
  const ready = useProfileSurface(accountBound) && profileReady;
  const circle = useCircle();
  const [now] = useState(() => new Date());
  const [armed, setArmed] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const self = useMemo(() => explicitSelfChart(profile.charts), [profile.charts]);
  const people = useMemo(() => buildPeople(profile.charts, circle, now), [profile.charts, circle, now]);

  if (!ready || (!self && people.length === 0)) return null;

  const savedById = new Map(profile.charts.map((chart) => [chart.id, chart]));
  const cardById = new Map(circle.map((entry) => [entry.id, entry]));

  function compareCard(id: string) {
    const entry = cardById.get(id);
    if (!self || !entry) return;
    const result = openCardComparison(self, entry);
    if (typeof result === 'object') {
      window.location.assign(result.href);
      return;
    }
    setMessage(result === 'full'
      ? 'Your saved comparisons are full. Remove one on the compatibility page to add another.'
      : 'This browser wouldn’t open that comparison. Try again.');
  }

  function remove(id: string) {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    if (!removeCircleEntry(id)) setMessage('This browser wouldn’t remove that card. Try again.');
  }

  return (
    <section class="pf-people shell" id="your-people" aria-labelledby="pf-people-title">
      <div class="core pf-people__core">
        <div class="pf-card-head pf-people__head">
          <div>
            <h2 id="pf-people-title">Your people</h2>
            <p>Charts you keep for others, and cards they send you. Kept on this device.</p>
          </div>
          {people.length > 0 && (
            <span class="mono pf-people__count">{people.length === 1 ? '1 person' : `${people.length} people`}</span>
          )}
        </div>

        {people.length > 0 ? (
          <ul class="pf-rows">
            {people.map((person) => {
              const saved = person.kind === 'saved' ? savedById.get(person.id) : undefined;
              const entry = person.kind === 'card' ? cardById.get(person.id) : undefined;
              const handoff = saved?.birth.place ? profileChartHandoffFragment(saved.id) : null;
              const positions = entry ? encodePositionsLink(entry.chart) : null;
              const chartHref = handoff ? `/birth-chart/#${handoff}` : positions ? `/birth-chart/#p=${positions}` : null;
              const label = person.name || 'A chart card';
              const soon = person.next !== null && person.next.days <= SOON_DAYS;
              return (
                <li class="pf-row pf-person" key={person.key} data-person-kind={person.kind}>
                  <Initial name={person.personalName} hue={person.sunHue} size={40} />
                  <div class="pf-row__text">
                    <strong>{label}</strong>
                    <small>
                      {nextLine(person) ?? (person.kind === 'card' ? 'From their card' : 'Saved chart')}
                      {person.kind === 'card' && person.next ? ' · from their card' : ''}
                    </small>
                  </div>
                  <span class={`pf-row__when mono${soon ? ' is-soon' : ''}`}>
                    {person.next ? whenLabel(person.next.days) : ''}
                  </span>
                  <div class="pf-row__actions">
                    {self && (saved
                      ? <a class="pf-chart__action" href={savedCompareHref(self, saved.id)}>Compare</a>
                      : <button class="pf-chart__action" type="button" onClick={() => compareCard(person.id)}>Compare</button>)}
                    {chartHref && <a class="pf-chart__action" href={chartHref}>Chart</a>}
                    {entry && (
                      <button
                        class={`pf-chart__action pf-chart__action--danger${armed === person.id ? ' is-armed' : ''}`}
                        type="button"
                        onClick={() => remove(person.id)}
                        onBlur={() => setArmed((current) => (current === person.id ? null : current))}
                        aria-label={armed === person.id ? `Confirm removing ${label}` : `Remove ${label}`}
                      >
                        {armed === person.id ? 'Remove?' : 'Remove'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div class="pf-people__empty">
            <span class="pf-people__ghosts" aria-hidden="true"><span /><span /><span /></span>
            <p>
              No one here yet. Save a chart for someone you read for, or send your card. When they
              send theirs back, they appear here.
            </p>
          </div>
        )}

        {message && <p class="field__error" role="alert">{message}</p>}

        <div class="pf-people__foot">
          <a class="btn btn--ghost" href="/birth-chart/someone-else/">
            <span>Add someone’s chart</span><span class="orb" aria-hidden="true">+</span>
          </a>
          {self && (
            <button class="pf-quiet" type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CARD_EVENT))}>
              Send your card
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
