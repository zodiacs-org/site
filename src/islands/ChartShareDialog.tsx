import { useEffect, useRef, useState } from 'preact/hooks';
import type { Chart } from '../lib/engine/types';
import { t, type CatalogLocale as Locale } from '../lib/i18n';
import { encodeSharedPositionsLink, type PositionsShareInput } from '../lib/share-positions';
import { loadTimedSharedPositions, loadUntimedSharedPositions } from '../lib/share-positions-untimed';
import { previewPlacements, previewQuery } from '../lib/share-preview';
import {
  prepareBigThreeCard,
  prepareChartCard,
  prepareChartSheet,
  preparePlacementCard,
  primaryShareCardVariant,
  savePreparedChartCard,
  untimedMoonSign,
  type ChartSheetBirthDetails,
  type PreparedChartCard,
} from '../lib/share-card';
import { ensurePastelZodiacIconEmbedding } from '../lib/share-card-pastel-icons';
import { shareCardText } from '../lib/share-card-copy';
import { signBySlug, signForLongitude, signName } from '../lib/signs';
import { moonIsUncertain, moonLabel } from '../lib/moon-certainty';
import Wheel from '../lib/wheel/Wheel';
import { CopyLinkButton, type CopyLinkState } from './CopyLinkButton';
import { shareText } from './PositionsShareSurface';

type Mode = 'full' | 'moon' | 'rising';
type CardState = 'idle' | 'busy' | 'saved' | 'error';
type Choice = 'sheet' | 'signature' | 'big-three' | 'full' | 'placement';
type PreparedState = 'idle' | 'preparing' | 'ready' | 'busy' | 'saved' | 'error';

interface Props {
  chart: Chart;
  locale: Locale;
  mode?: Mode;
  card: CardState;
  onCardStateChange: (state: CardState) => void;
  onClose: () => void;
  detailsUrl?: string;
  receiverPath?: string;
  birthDetails?: ChartSheetBirthDetails;
  preparedPrimary?: PreparedChartCard | null;
  moonAmbiguous?: boolean;
}

const LINK_COPY = {
  en: {
    copied: 'Link copied', preview: 'Copy link with preview', details: 'Copy link with birth details',
    detailsNote: 'Includes your birth details.',
    previewNote: 'Both links keep the chart code after the # sign, which browsers do not send to servers. The preview link also sends the Sun, Moon and Rising, to the whole degree, to our preview service.',
    sheet: 'Share chart sheet',
  },
  es: { copied: 'Enlace copiado', preview: 'Copiar enlace con vista previa', details: 'Copiar enlace con datos de nacimiento', detailsNote: 'Incluye tus datos de nacimiento.', previewNote: 'Ambos enlaces guardan el código de la carta después del signo #, que los navegadores no envían a los servidores. El enlace con vista previa también envía el Sol, la Luna y el Ascendente, al grado entero, a nuestro servicio de vista previa.', sheet: 'Compartir hoja de la carta' },
  pt: { copied: 'Link copiado', preview: 'Copiar link com prévia', details: 'Copiar link com dados de nascimento', detailsNote: 'Inclui seus dados de nascimento.', previewNote: 'Os dois links guardam o código do mapa depois do sinal #, que os navegadores não enviam aos servidores. O link com prévia também envia o Sol, a Lua e o Ascendente, em graus inteiros, ao nosso serviço de prévia.', sheet: 'Compartilhar folha do mapa' },
  fr: { copied: 'Lien copié', preview: 'Copier le lien avec aperçu', details: 'Copier le lien avec données de naissance', detailsNote: 'Inclut tes données de naissance.', previewNote: 'Les deux liens gardent le code du thème après le signe #, que les navigateurs n’envoient pas aux serveurs. Le lien avec aperçu envoie aussi le Soleil, la Lune et l’Ascendant, au degré entier, à notre service d’aperçu.', sheet: 'Partager la feuille du thème' },
  it: { copied: 'Link copiato', preview: 'Copia il link con anteprima', details: 'Copia il link con dati di nascita', detailsNote: 'Include i tuoi dati di nascita.', previewNote: 'Entrambi i link tengono il codice del tema dopo il segno #, che i browser non inviano ai server. Il link con anteprima invia anche Sole, Luna e Ascendente, al grado intero, al nostro servizio di anteprima.', sheet: 'Condividi il foglio del tema' },
  ru: { copied: 'Ссылка скопирована', preview: 'Скопировать ссылку с превью', details: 'Скопировать ссылку с данными рождения', detailsNote: 'Включает ваши данные рождения.', previewNote: 'Обе ссылки хранят код карты после знака #, который браузеры не отправляют на серверы. Ссылка с превью также отправляет нашему сервису превью Солнце, Луну и Асцендент с точностью до целого градуса.', sheet: 'Поделиться листом карты' },
} as const;

function trackShare(variant: 'details_link' | 'positions_link' | 'big_three_card' | 'full_chart_card' | 'signature_card'): void {
  const analytics = (window as Window & {
    zodiacsAnalytics?: { track?: (name: string, props: { variant: string }) => void };
  }).zodiacsAnalytics;
  analytics?.track?.('chart_share', { variant });
}

export default function ChartShareDialog({
  chart,
  locale,
  mode = 'full',
  card,
  onCardStateChange,
  onClose,
  detailsUrl = '',
  receiverPath = '/birth-chart/',
  birthDetails,
  preparedPrimary = null,
  moonAmbiguous = false,
}: Props) {
  const copy = LINK_COPY[locale];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hideRef = useRef(true);
  const generationRef = useRef<Record<Choice, number>>({
    sheet: 0, signature: 0, 'big-three': 0, full: 0, placement: 0,
  });
  const preparationRef = useRef(new Map<Choice, number>());
  const [hideBirthDetails, setHideBirthDetails] = useState(true);
  const [links, setLinks] = useState<{ positions: string; preview: string } | null>(null);
  const [linkState, setLinkState] = useState<Record<'positions' | 'preview' | 'details', CopyLinkState>>({
    positions: 'idle', preview: 'idle', details: 'idle',
  });
  const [prepared, setPrepared] = useState<Partial<Record<Choice, PreparedChartCard>>>({});
  const [states, setStates] = useState<Record<Choice, PreparedState>>({
    sheet: 'idle', signature: 'idle', 'big-three': 'idle', full: 'idle', placement: 'idle',
  });

  const primaryChoice: Choice = mode === 'full' ? 'sheet' : 'placement';
  const primaryAlternative = primaryShareCardVariant(locale, Boolean(chart.angles));
  const primaryTitle = mode === 'full'
    ? copy.sheet
    : shareText(locale, mode === 'moon' ? 'moonCardTitle' : 'risingCardTitle');
  const placementLongitude = mode === 'moon'
    ? chart.bodies.find((body) => body.body === 'Moon')?.lon
    : mode === 'rising' ? chart.angles?.asc : undefined;
  const placementChart = moonAmbiguous && chart.moonSignCandidates === undefined
    ? { ...chart, moonSignCandidates: [] } : chart;
  const uncertainMoon = mode === 'moon' && moonIsUncertain(placementChart);
  const placementSign = uncertainMoon || placementLongitude == null ? null : signForLongitude(placementLongitude);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  const birthDate = birthDetails?.date;
  // Without a birth time the Moon card is drawn from the sky at 12:00 UTC, as
  // the link is, and names a sign only when the Moon held it all that date
  // everywhere (untimedMoonSign), whatever sign the page gives for the birthplace.
  const moonFromNoon = mode === 'moon' && !chart.angles;
  const [settledMoon, setSettledMoon] = useState<string | null>(null);
  useEffect(() => {
    setSettledMoon(null);
    if (!moonFromNoon) return undefined;
    let current = true;
    void untimedMoonSign(birthDate).then((sign) => { if (current) setSettledMoon(sign); }, () => {});
    return () => { current = false; };
  }, [chart, mode, birthDate]);
  const settledSign = moonFromNoon && settledMoon ? signBySlug(settledMoon) : null;
  const imageMoonUnknown = moonFromNoon ? !settledSign : uncertainMoon;
  useEffect(() => {
    let current = true;
    const base = { houseSystem: chart.houses?.system ?? 'whole', engineVersion: chart.engineVersion };
    // With a birth time the links carry the bodies at the whole minute, whose
    // seconds can no longer give the longitude before standard time. Without
    // one the chart is noon at the birthplace, an instant that gives the place
    // away; the links carry noon UTC on the date instead.
    const ready: Promise<PositionsShareInput | null> = chart.input.timeKnown
      ? loadTimedSharedPositions({
        ...base,
        bodies: chart.bodies,
        angles: chart.angles ? { asc: chart.angles.asc, mc: chart.angles.mc } : null,
      }, chart.input.utc)
      : birthDate ? loadUntimedSharedPositions(base, birthDate) : Promise.resolve(null);
    void ready.then((shared) => {
      if (!current || !shared) return;
      const token = encodeSharedPositionsLink(shared);
      const placements = previewPlacements(shared);
      if (!token || !placements) return;
      const positions = `${window.location.origin}${receiverPath}#p=${token}`;
      // The preview service gets the Sun, Moon and Rising to the whole degree;
      // the full code stays in the fragment.
      const preview = `${window.location.origin}/api/og/chart?${previewQuery(placements)}#p=${token}`;
      setLinks({ positions, preview });
    }, (error) => console.error(error));
    return () => { current = false; };
  }, [chart, receiverPath, birthDate]);

  useEffect(() => {
    if (!preparedPrimary) return;
    if (primaryChoice === 'sheet' && !hideRef.current) return;
    setPrepared((current) => ({ ...current, [primaryChoice]: preparedPrimary }));
    setStates((current) => ({ ...current, [primaryChoice]: 'ready' }));
  }, [preparedPrimary, primaryChoice]);

  useEffect(() => {
    if (preparedPrimary) return;
    void prepareChoice(primaryChoice, hideRef.current);
  }, [preparedPrimary, primaryChoice]);

  useEffect(() => {
    if (mode !== 'full') return;
    void prepareChoice(primaryAlternative);
  }, [mode, primaryAlternative]);

  async function buildChoice(choice: Choice, hidden: boolean): Promise<PreparedChartCard> {
    // Images with birth details hidden show what the links carry (share-card's imageChart).
    const timeOptions = { referenceTime: !chart.input.timeKnown, moonAmbiguous, birthDate };
    if (choice === 'sheet') {
      await ensurePastelZodiacIconEmbedding();
      return prepareChartSheet(chart, {
        locale, hideBirthDetails: hidden, birthDetails, moonAmbiguous, birthDate,
      });
    }
    if (choice === 'placement') {
      return preparePlacementCard(chart, mode === 'rising' ? 'rising' : 'moon', locale, timeOptions);
    }
    if (choice === 'signature') return prepareChartCard(chart, { variant: 'signature', locale, ...timeOptions });
    if (choice === 'big-three') return prepareBigThreeCard(chart, locale, timeOptions);
    return prepareChartCard(chart, { variant: 'full', locale, ...timeOptions });
  }

  async function prepareChoice(choice: Choice, hidden = hideRef.current): Promise<void> {
    const generation = generationRef.current[choice];
    if (preparationRef.current.get(choice) === generation) return;
    preparationRef.current.set(choice, generation);
    setStates((current) => ({ ...current, [choice]: 'preparing' }));
    try {
      const result = await buildChoice(choice, hidden);
      if (generation !== generationRef.current[choice] || (choice === 'sheet' && hidden !== hideRef.current)) return;
      setPrepared((current) => ({ ...current, [choice]: result }));
      setStates((current) => ({ ...current, [choice]: 'ready' }));
    } catch (error) {
      console.error(error);
      if (generation === generationRef.current[choice]) setStates((current) => ({ ...current, [choice]: 'error' }));
    } finally {
      if (preparationRef.current.get(choice) === generation) preparationRef.current.delete(choice);
    }
  }

  function changePrivacy(hidden: boolean): void {
    generationRef.current.sheet += 1;
    hideRef.current = hidden;
    setHideBirthDetails(hidden);
    setPrepared((current) => {
      const next = { ...current };
      delete next.sheet;
      if (hidden && preparedPrimary) next.sheet = preparedPrimary;
      return next;
    });
    setStates((current) => ({ ...current, sheet: hidden && preparedPrimary ? 'ready' : 'idle' }));
    if (!hidden || !preparedPrimary) void prepareChoice('sheet', hidden);
  }

  function shareChoice(choice: Choice): void {
    const artifact = prepared[choice];
    if (!artifact) {
      void prepareChoice(choice);
      return;
    }
    if (states[choice] === 'busy') return;
    setStates((current) => ({ ...current, [choice]: 'busy' }));
    onCardStateChange('busy');
    void savePreparedChartCard(artifact).then((outcome) => {
      if (outcome === 'cancelled') {
        setStates((current) => ({ ...current, [choice]: 'ready' }));
        onCardStateChange('idle');
        return;
      }
      const variant = choice === 'signature'
        ? 'signature_card'
        : choice === 'big-three' || choice === 'placement'
          ? 'big_three_card'
          : 'full_chart_card';
      trackShare(variant);
      (window as Window & { zodiacsAnalytics?: { track?: (name: string, props: { variant: string }) => void } })
        .zodiacsAnalytics?.track?.('share_card_downloaded', { variant });
      setStates((current) => ({ ...current, [choice]: 'saved' }));
      onCardStateChange('saved');
    }).catch((error) => {
      console.error(error);
      setStates((current) => ({ ...current, [choice]: 'error' }));
      onCardStateChange('error');
    });
  }

  const actionText = (choice: Choice): string => {
    if (states[choice] === 'preparing') return shareText(locale, 'preparingImage');
    if (states[choice] === 'busy') return t(locale, 'rendering');
    if (choice === 'sheet') return copy.sheet;
    if (choice === 'signature') return shareCardText(locale, 'signatureAction');
    if (choice === 'placement') {
      // A Moon card that names no sign does not promise one.
      if (imageMoonUnknown) return shareText(locale, 'shareThisImage');
      return shareText(locale, mode === 'moon' ? 'moonCardAction' : 'risingCardAction');
    }
    if (choice === 'big-three') return shareCardText(locale, 'bigThreeAction');
    return shareCardText(locale, 'fullChartAction');
  };

  return (
    <dialog
      class="calc-share-dialog"
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
      data-share-dialog
      data-share-mode={mode}
      aria-labelledby="chart-share-title"
    >
      <div class="calc-share-dialog__surface">
        <header class="calc-share-dialog__head">
          <h2 id="chart-share-title">{shareText(locale, 'shareOptionsTitle')}</h2>
          <button class="calc-share-dialog__close" type="button" aria-label={shareText(locale, 'closeShare')} onClick={() => dialogRef.current?.close()}>×</button>
        </header>

        {links && (
          <section class="calc-share-dialog__links" aria-label={shareText(locale, 'shareOptionsTitle')}>
            <CopyLinkButton
              url={links.positions}
              state={linkState.positions}
              onStateChange={(state) => setLinkState((current) => ({ ...current, positions: state }))}
              idleLabel={shareText(locale, 'copyPositionsLink')}
              copiedLabel={copy.copied}
              ariaLabel={shareText(locale, 'copyPositionsLink')}
              buttonClass="btn btn--primary"
              dataHook="positions"
              onCopied={() => trackShare('positions_link')}
            />
            <p class="calc-share-dialog__note" data-positions-share-note>
              {shareText(locale, chart.input.timeKnown ? 'positionsShareNote' : 'positionsShareNoteNoTime')}
            </p>
            <CopyLinkButton
              url={links.preview}
              state={linkState.preview}
              onStateChange={(state) => setLinkState((current) => ({ ...current, preview: state }))}
              idleLabel={copy.preview}
              copiedLabel={copy.copied}
              ariaLabel={copy.preview}
              buttonClass="btn btn--ghost"
              dataHook="preview"
              onCopied={() => trackShare('positions_link')}
            >
              <p class="calc-share-dialog__note">{copy.previewNote}</p>
            </CopyLinkButton>
            {mode === 'full' && detailsUrl && (
              <CopyLinkButton
                url={detailsUrl}
                state={linkState.details}
                onStateChange={(state) => setLinkState((current) => ({ ...current, details: state }))}
                idleLabel={copy.details}
                copiedLabel={copy.copied}
                ariaLabel={copy.details}
                buttonClass="btn btn--ghost"
                dataHook="details"
                onCopied={() => trackShare('details_link')}
              >
                <p class="calc-share-dialog__note">{copy.detailsNote}</p>
              </CopyLinkButton>
            )}
          </section>
        )}

        <section class="calc-share-dialog__chart" aria-label={primaryTitle} data-share-primary={mode === 'full' ? 'sheet' : 'placement'}>
          {mode === 'full' ? (
            <div class="calc-share-dialog__chart-wheel" aria-hidden="true">
              <Wheel
                bodies={chart.bodies.filter((body) => body.body !== 'South Node')}
                asc={chart.angles?.asc ?? null}
                mc={chart.angles?.mc ?? null}
                cusps={chart.houses?.cusps ?? null}
                aspects={chart.aspects.filter((aspect) => aspect.orb < 6)}
              />
            </div>
          ) : imageMoonUnknown ? (
            <div class="calc-share-dialog__placement" data-share-placement-preview>
              <span>{moonLabel(moonFromNoon ? { ...placementChart, moonSignCandidates: [] } : placementChart, locale)}</span>
            </div>
          ) : settledSign ?? placementSign ? (
            <div class="calc-share-dialog__placement" style={`--sign:${(settledSign ?? placementSign)!.hue}`} aria-hidden="true" data-share-placement-preview>
              <span class="calc-share-dialog__placement-glyph">{(settledSign ?? placementSign)!.glyph}</span>
              <span>{signName((settledSign ?? placementSign)!, locale)}</span>
            </div>
          ) : null}
          <div class="calc-share-dialog__chart-copy"><h3>{primaryTitle}</h3></div>
        </section>

        {mode === 'full' && (
          <label class="calc-share-dialog__privacy">
            <input type="checkbox" checked={hideBirthDetails} onChange={(event) => changePrivacy(event.currentTarget.checked)} data-hide-birth-details />
            <span>{shareText(locale, 'hideBirthDetails')}</span>
          </label>
        )}

        <div class="calc-share-dialog__cards" role="group" aria-label={shareText(locale, 'moreWaysToShare')}>
          <button
            class="btn btn--primary calc-share-dialog__card"
            type="button"
            onClick={() => shareChoice(primaryChoice)}
            disabled={card === 'busy' || !prepared[primaryChoice] || states[primaryChoice] === 'preparing' || states[primaryChoice] === 'busy'}
            data-share-card-action={primaryChoice}
          >
            <span>{actionText(primaryChoice)}</span><span class="orb">{states[primaryChoice] === 'saved' ? '✓' : '↗'}</span>
          </button>
          {mode === 'full' && (
            <button
              class="btn btn--ghost calc-share-dialog__card"
              type="button"
              onClick={() => shareChoice(primaryAlternative)}
              disabled={card === 'busy' || !prepared[primaryAlternative] || states[primaryAlternative] === 'preparing' || states[primaryAlternative] === 'busy'}
              data-share-card-action={primaryAlternative}
            >
              <span>{actionText(primaryAlternative)}</span><span class="orb">{states[primaryAlternative] === 'saved' ? '✓' : states[primaryAlternative] === 'ready' ? '↗' : '+'}</span>
            </button>
          )}
        </div>
        <p class="calc-share-dialog__note" data-chart-image-privacy>
          {shareText(locale, !hideBirthDetails ? 'chartImagePrivacyDetails'
            : chart.input.timeKnown ? 'chartImagePrivacy' : 'chartImagePrivacyNoTime')}
        </p>
        {(card === 'error' || Object.values(states).includes('error')) && <p class="calc__error" role="alert">{t(locale, 'cardError')}</p>}
      </div>
    </dialog>
  );
}
