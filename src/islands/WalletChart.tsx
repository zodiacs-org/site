import { CheckOurMath } from './ChartTrust';
import { useMemo, useState } from 'preact/hooks';
import { BirthFields } from './BirthFields';
import type { City } from '../lib/geo/search';
import type { BodyPosition } from '../lib/engine/types';
import type { PairSummary } from '../lib/engine/synastry';
import { summarizePair } from '../lib/engine/synastry';
import { aspectLabel, planetLabel } from '../lib/i18n/astrology';
import { resolveLocalToUtc } from '../lib/time/localToUtc';
import {
  elementLabel,
  formatLongitude,
  signBySlug,
  signForLongitude,
} from '../lib/signs';
import { trackAnalytics } from '../lib/analytics';
import {
  parseWalletAddress,
  truncateWalletAddress,
  type ParsedWalletAddress,
} from '../lib/wallet/address';
import type {
  WalletBirth,
  WalletBirthErrorCode,
  WalletBirthSource,
  WalletChain,
} from '../lib/wallet/types';
import { walletText } from '../strings/wallet-chart';

interface Props {
  availableChains: WalletChain[];
}

interface ComputedWallet extends WalletBirth {
  bodies: BodyPosition[];
}

type RequestState = 'idle' | 'busy';
type ShareState = 'idle' | 'busy' | 'complete' | 'error';

const PLANET_ORDER = new Set([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
]);

const SOURCES = new Set<WalletBirthSource>(['solana-rpc', 'base-explorer', 'base-rpc-outgoing']);

function sourceLabel(source: WalletBirthSource): string {
  if (source === 'solana-rpc') return walletText('sourceSolana');
  if (source === 'base-explorer') return walletText('sourceBaseExplorer');
  return walletText('sourceBaseRpc');
}

export function formatWalletUtc(timestamp: string): string {
  const formatted = new Intl.DateTimeFormat('en', {
    dateStyle: 'long', timeStyle: 'medium', timeZone: 'UTC',
  }).format(new Date(timestamp));
  return `${formatted} UTC`;
}

function validBirthResponse(value: unknown): value is WalletBirth {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WalletBirth>;
  if (candidate.chain !== 'solana' && candidate.chain !== 'base') return false;
  if (typeof candidate.address !== 'string' || !parseWalletAddress(candidate.address)) return false;
  if (typeof candidate.birthTimestamp !== 'string' || !Number.isFinite(new Date(candidate.birthTimestamp).getTime())) return false;
  if (!candidate.source || !SOURCES.has(candidate.source)) return false;
  return candidate.heldSigns === undefined
    || Array.isArray(candidate.heldSigns) && candidate.heldSigns.every((sign) => {
      try { signBySlug(sign); return true; } catch { return false; }
    });
}

export function walletBirthMatchesRequest(
  value: unknown,
  request: ParsedWalletAddress,
): value is WalletBirth {
  return validBirthResponse(value)
    && value.chain === request.chain
    && value.address === request.address;
}

function errorMessage(code: WalletBirthErrorCode | null): string {
  if (code === 'history_too_deep') return walletText('historyTooDeep');
  if (code === 'unavailable' || code === 'disabled') return walletText('unavailable');
  if (code === 'not_found') return walletText('notFound');
  return walletText('invalidResponse');
}

function synastryHeadline(summary: PairSummary): string {
  if (summary.easeful > summary.charged) return walletText('synastryFlow');
  if (summary.charged > summary.easeful) return walletText('synastryCharge');
  return walletText('synastryBalance');
}

export default function WalletChart({ availableChains }: Props) {
  const [address, setAddress] = useState('');
  const [requestState, setRequestState] = useState<RequestState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<ComputedWallet | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownerDate, setOwnerDate] = useState('');
  const [ownerTime, setOwnerTime] = useState('');
  const [ownerTimeKnown, setOwnerTimeKnown] = useState(true);
  const [ownerCity, setOwnerCity] = useState<City | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [ownerSummary, setOwnerSummary] = useState<PairSummary | null>(null);
  const [shareState, setShareState] = useState<ShareState>('idle');

  const networkNames = availableChains
    .map((chain) => walletText(chain === 'solana' ? 'solana' : 'base'))
    .join(' · ');

  const officialSigns = useMemo(() => wallet?.heldSigns?.flatMap((slug) => {
    try { return [signBySlug(slug)]; } catch { return []; }
  }) ?? [], [wallet?.heldSigns]);

  const heldElementBalance = useMemo(() => {
    const counts = new Map<string, number>();
    officialSigns.forEach((sign) => counts.set(sign.element, (counts.get(sign.element) ?? 0) + 1));
    return [...counts.entries()]
      .map(([element, count]) => `${elementLabel(element as 'fire' | 'earth' | 'air' | 'water')} ${count}`)
      .join(' · ');
  }, [officialSigns]);

  async function submitWallet(event: Event) {
    event.preventDefault();
    if (requestState === 'busy') return;
    const parsed = parseWalletAddress(address);
    if (!parsed) {
      setWallet(null);
      clearOwnerComparison();
      setError(walletText('notFound'));
      return;
    }
    if (!availableChains.includes(parsed.chain)) {
      setWallet(null);
      clearOwnerComparison();
      setError(walletText('unavailable'));
      return;
    }

    setRequestState('busy');
    setError(null);
    setShareState('idle');
    try {
      const response = await fetch('/api/wallet-birth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: parsed.address }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = payload && typeof payload === 'object' && 'error' in payload
          && typeof payload.error === 'string'
          ? payload.error as WalletBirthErrorCode
          : null;
        throw new Error(errorMessage(code));
      }
      if (!walletBirthMatchesRequest(payload, parsed)) throw new Error(walletText('invalidResponse'));
      const engine = await import('../lib/engine/full');
      const bodies = engine.computeBodies(new Date(payload.birthTimestamp));
      const computed = { ...payload, bodies };
      setWallet(computed);
      setAddress(parsed.address);
      clearOwnerComparison();
      const analytics: Record<string, string | boolean> = { chain: payload.chain };
      if (payload.heldSigns !== undefined) analytics.holds_registry_asset = payload.heldSigns.length > 0;
      trackAnalytics('wallet_chart_computed', analytics);
    } catch (caught) {
      setWallet(null);
      clearOwnerComparison();
      setError(caught instanceof Error ? caught.message : walletText('invalidResponse'));
    } finally {
      setRequestState('idle');
    }
  }

  async function submitOwner(event: Event) {
    event.preventDefault();
    if (!wallet || ownerBusy) return;
    if (!ownerDate || !ownerCity || ownerTimeKnown && !ownerTime) {
      setOwnerError(walletText('ownerMissing'));
      return;
    }
    setOwnerBusy(true);
    setOwnerError(null);
    try {
      const resolved = resolveLocalToUtc(
        ownerDate,
        ownerTimeKnown ? ownerTime : '12:00',
        ownerCity.tz,
      );
      const engine = await import('../lib/engine/full');
      const ownerBodies = engine.computeBodies(resolved.utc);
      setOwnerSummary(summarizePair(wallet.bodies, ownerBodies, 4));
      setShareState('idle');
    } catch {
      setOwnerError(walletText('invalidResponse'));
    } finally {
      setOwnerBusy(false);
    }
  }

  function clearOwnerComparison() {
    setOwnerOpen(false);
    setOwnerDate('');
    setOwnerTime('');
    setOwnerTimeKnown(true);
    setOwnerCity(null);
    setOwnerError(null);
    setOwnerSummary(null);
    setShareState('idle');
  }

  async function shareCard() {
    if (!wallet || shareState === 'busy') return;
    setShareState('busy');
    try {
      const { saveWalletShareCard } = await import('../lib/wallet/share-card');
      const outcome = await saveWalletShareCard({
        chain: wallet.chain,
        address: wallet.address,
        birthTimestamp: wallet.birthTimestamp,
        bodies: wallet.bodies,
        ownerSummary,
      });
      if (outcome === 'cancelled') {
        setShareState('idle');
        return;
      }
      trackAnalytics('share_card_downloaded', { variant: 'wallet' });
      setShareState('complete');
    } catch {
      setShareState('error');
    }
  }

  return (
    <div class="wallet-chart">
      <form class="wallet-chart__lookup" onSubmit={submitWallet} aria-busy={requestState === 'busy'}>
        <div class="field">
          <label class="field__label" for="wallet-address">{walletText('addressLabel')}</label>
          <input
            id="wallet-address"
            class="field__input wallet-chart__address"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="none"
            spellcheck={false}
            required
            value={address}
            placeholder={walletText('addressPlaceholder')}
            onInput={(event) => setAddress((event.target as HTMLInputElement).value)}
          />
          <p class="field__help">{walletText('addressHelp')}</p>
          <p class="field__help">{walletText('supportedNetworks', { networks: networkNames })}</p>
        </div>
        <button class="btn btn--primary" type="submit" disabled={requestState === 'busy'}>
          {walletText(requestState === 'busy' ? 'calculating' : 'calculate')}
        </button>
      </form>

      <div class="wallet-chart__status" aria-live="polite">
        {error && <p class="wallet-chart__error" role="status">{error}</p>}
      </div>

      {wallet && (
        <section class="wallet-result" aria-labelledby="wallet-result-title">
          <header class="wallet-result__header">
            <em class="kicker">{walletText('resultKicker')}</em>
            <h2 id="wallet-result-title" class="display">
              {walletText('resultTitle', {
                address: truncateWalletAddress(wallet.address),
                time: formatWalletUtc(wallet.birthTimestamp),
              })}
            </h2>
            <CheckOurMath utc={wallet.birthTimestamp} basis="record" />
            <p class="wallet-result__boundary">{walletText('utcOnly')}</p>
            <dl class="wallet-result__receipt">
              <div>
                <dt>{walletText('resultChain')}</dt>
                <dd>{walletText(wallet.chain === 'solana' ? 'solana' : 'base')}</dd>
              </div>
              <div>
                <dt>{walletText('resultSource')}</dt>
                <dd>{sourceLabel(wallet.source)}</dd>
              </div>
            </dl>
            {wallet.source === 'base-rpc-outgoing' && (
              <p class="wallet-result__caveat">{walletText('sourceBaseRpcCaveat')}</p>
            )}
          </header>

          <div class="wallet-result__placements">
            <div class="section-head">
              <h3>{walletText('placementsTitle')}</h3>
              <p>{walletText('placementsIntro')}</p>
            </div>
            <ul class="wallet-placements">
              {wallet.bodies.filter((body) => PLANET_ORDER.has(body.body)).map((body) => {
                const sign = signForLongitude(body.lon);
                return (
                  <li key={body.body} class="wallet-placement">
                    <img
                      src={`/assets/zodiac-icons/48/${sign.slug}.webp`}
                      width="48"
                      height="48"
                      loading="lazy"
                      decoding="async"
                      alt=""
                    />
                    <span>
                      <strong>{planetLabel('en', body.body)}</strong>
                      <small>{formatLongitude(body.lon)}{body.retrograde ? ` · ${walletText('retrograde')}` : ''}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {officialSigns.length > 0 && (
            <aside class="wallet-holdings" aria-labelledby="wallet-holdings-title">
              <div>
                <h3 id="wallet-holdings-title">{walletText('officialHoldingsTitle')}</h3>
                <p>{walletText('officialHoldingsIntro')}</p>
              </div>
              <ul class="wallet-holdings__signs">
                {officialSigns.map((sign) => (
                  <li key={sign.slug}>
                    <img src={`/assets/zodiac-icons/48/${sign.slug}.webp`} width="40" height="40" loading="lazy" decoding="async" alt="" />
                    <span>{sign.name}</span>
                  </li>
                ))}
              </ul>
              <p class="wallet-holdings__balance">{walletText('elementBalance', { balance: heldElementBalance })}</p>
            </aside>
          )}

          <section class="wallet-owner" aria-labelledby="wallet-owner-title">
            <div class={ownerOpen ? 'section-head' : 'sr-only'}>
              <h3 id="wallet-owner-title">{walletText('ownerTitle')}</h3>
              {ownerOpen && <p>{walletText('ownerIntro')}</p>}
            </div>
            {!ownerOpen ? (
              <button class="btn btn--ghost" type="button" onClick={() => setOwnerOpen(true)}>
                {walletText('ownerStart')}
              </button>
            ) : (
              <>
                <p class="wallet-owner__privacy">{walletText('ownerPrivacy')}</p>
                <form class="wallet-owner__form" onSubmit={submitOwner} aria-busy={ownerBusy}>
                  <BirthFields
                    locale="en"
                    dateId="wallet-owner-date"
                    timeId="wallet-owner-time"
                    placeId="wallet-owner-place"
                    date={ownerDate}
                    time={ownerTime}
                    timeKnown={ownerTimeKnown}
                    city={ownerCity}
                    onDateChange={setOwnerDate}
                    onTimeChange={setOwnerTime}
                    onTimeKnownChange={setOwnerTimeKnown}
                    onCityChange={setOwnerCity}
                    timeHelp={walletText('ownerTimeHelp')}
                    placeHelp={walletText('ownerPlaceHelp')}
                  />
                  <div class="wallet-owner__actions">
                    <button class="btn btn--primary" type="submit" disabled={ownerBusy}>
                      {walletText(ownerBusy ? 'ownerCalculating' : 'ownerSubmit')}
                    </button>
                    <button class="btn btn--ghost" type="button" onClick={clearOwnerComparison}>
                      {walletText('ownerCancel')}
                    </button>
                  </div>
                  <div aria-live="polite">{ownerError && <p class="wallet-chart__error">{ownerError}</p>}</div>
                </form>
              </>
            )}
          </section>

          {ownerSummary && (
            <section class="wallet-synastry" aria-labelledby="wallet-synastry-title">
              <h3 id="wallet-synastry-title">{walletText('synastryTitle')}</h3>
              <p>{synastryHeadline(ownerSummary)}</p>
              {ownerSummary.top.length > 0 ? (
                <ul>
                  {ownerSummary.top.slice(0, 3).map((contact) => (
                    <li key={`${contact.a}-${contact.b}-${contact.type}`}>
                      {walletText('synastryContact', {
                        ownerBody: planetLabel('en', contact.b),
                        aspect: aspectLabel('en', contact.type),
                        walletBody: planetLabel('en', contact.a),
                        orb: contact.orb.toFixed(1),
                      })}
                    </li>
                  ))}
                </ul>
              ) : <p>{walletText('synastryNoContact')}</p>}
            </section>
          )}

          <div class="wallet-result__share">
            <button class="btn btn--primary" type="button" onClick={shareCard} disabled={shareState === 'busy'}>
              {walletText(shareState === 'busy' ? 'sharing' : 'share')}
            </button>
            <span aria-live="polite">
              {shareState === 'complete' && walletText('shareComplete')}
              {shareState === 'error' && walletText('shareError')}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
