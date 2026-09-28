import { useEffect, useRef, useState } from 'preact/hooks';
import type { CardOutcome, PreparedChartCard } from '../../lib/share-card';
import { createModuleLoader, ModuleLoadError } from '../../lib/module-load';
import { calculationLoadMessage } from '../CalculationReload';
import CalculationReload from '../CalculationReload';
import type { SolarReturnExportModel } from './export-model';

const loadImage = createModuleLoader(() => import('../../lib/share-card'));
const loadCalendar = createModuleLoader(() => Promise.all([
  import('../../lib/solar-return-ical'), import('../../lib/ical-download'),
]));

interface PreparedImage {
  card: PreparedChartCard;
  share: (card: PreparedChartCard) => Promise<CardOutcome>;
  download: (card: PreparedChartCard) => 'downloaded';
}

export default function SolarReturnActions({ model }: { model: SolarReturnExportModel }) {
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [preparing, setPreparing] = useState(true);
  const [imageError, setImageError] = useState('');
  const [imageReload, setImageReload] = useState(false);
  const [imageMessage, setImageMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarError, setCalendarError] = useState('');
  const [calendarReload, setCalendarReload] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState('');
  const active = useRef(false);
  const lifetime = useRef(0);
  const imageGeneration = useRef(0);
  const sharePending = useRef(false);
  const calendarPending = useRef(false);

  useEffect(() => {
    active.current = true;
    lifetime.current += 1;
    sharePending.current = false;
    calendarPending.current = false;
    setSharing(false);
    setCalendarBusy(false);
    setCalendarError('');
    setCalendarReload(false);
    setCalendarMessage('');
    return () => {
      active.current = false;
      lifetime.current += 1;
      sharePending.current = false;
      calendarPending.current = false;
    };
  }, [model]);

  useEffect(() => {
    const request = ++imageGeneration.current;
    const isCurrent = () => active.current && imageGeneration.current === request;
    setPrepared(null);
    setPreparing(true);
    setImageError('');
    setImageReload(false);
    setImageMessage('');
    void loadImage().then(async (renderer) => {
      if (!isCurrent()) return;
      const card = await renderer.prepareSolarReturnCard(model);
      if (!isCurrent()) return;
      setPrepared({ card, share: renderer.savePreparedChartCard, download: renderer.downloadPreparedChartCard });
    }).catch((cause: unknown) => {
      if (!isCurrent()) return;
      setImageError('The image could not be prepared. Your return chart and calendar are still available.');
      setImageReload(cause instanceof ModuleLoadError);
    }).finally(() => { if (isCurrent()) setPreparing(false); });
    return () => { imageGeneration.current += 1; };
  }, [model, attempt]);

  async function shareImage() {
    if (!active.current || !prepared || sharePending.current) return;
    sharePending.current = true;
    const request = lifetime.current;
    const isCurrent = () => active.current && lifetime.current === request;
    setSharing(true);
    setImageError('');
    setImageMessage('');
    try {
      // The file is ready before this tap, so native sharing keeps user activation.
      const outcome = await prepared.share(prepared.card);
      if (isCurrent()) setImageMessage(outcome === 'shared' ? 'Image shared.' : outcome === 'downloaded' ? 'Image download started.' : '');
    } catch {
      if (isCurrent()) setImageError('The image could not be shared. Try Save image.');
    } finally {
      if (isCurrent()) { sharePending.current = false; setSharing(false); }
    }
  }

  function saveImage() {
    if (!active.current || !prepared || sharePending.current) return;
    setImageError('');
    setImageMessage('');
    try {
      prepared.download(prepared.card);
      setImageMessage('Image download started.');
    } catch {
      setImageError('The image download could not start. Try Save image again.');
    }
  }

  async function saveCalendar() {
    if (!active.current || calendarPending.current) return;
    calendarPending.current = true;
    const request = lifetime.current;
    const isCurrent = () => active.current && lifetime.current === request;
    setCalendarBusy(true);
    setCalendarError('');
    setCalendarReload(false);
    setCalendarMessage('');
    try {
      const [calendar, download] = await loadCalendar();
      if (!isCurrent()) return;
      download.downloadCalendarFile(calendar.buildSolarReturnCalendar(model, new Date()), calendar.solarReturnCalendarFilename(model));
      setCalendarMessage('Calendar download started.');
    } catch (cause) {
      if (!isCurrent()) return;
      setCalendarError('The calendar download could not start. Try Add to calendar again.');
      setCalendarReload(cause instanceof ModuleLoadError);
    } finally {
      if (isCurrent()) { calendarPending.current = false; setCalendarBusy(false); }
    }
  }

  return (
    <section class="sr-result__exports" data-sr-exports aria-label="Save this solar return">
      <div class="calc__actions">
        <button class="btn btn--primary" type="button" disabled={!prepared || preparing || sharing} onClick={saveImage}>Save image</button>
        <button class="btn btn--ghost" type="button" disabled={!prepared || preparing || sharing} onClick={shareImage}>{sharing ? 'Sharing…' : 'Share image'}</button>
        <button class="btn btn--ghost" type="button" disabled={calendarBusy} onClick={saveCalendar}>{calendarBusy ? 'Preparing calendar…' : 'Add to calendar'}</button>
      </div>
      <p class="field__help">The image shows this return chart and reading, with the return to the whole minute, the angles to the whole degree and no Placidus houses. The calendar marks the {model.noTime ? 'approximate ' : ''}return to the whole minute. Birth details and names are left out.</p>
      {model.noTime && <p class="field__help">The return instant can shift by hours with your exact birth time.</p>}
      {preparing && <p class="field__help" role="status">Preparing your return image…</p>}
      {imageError && <p class="calc__error" role="alert" data-sr-image-error>{imageError}</p>}
      {imageError && !prepared && !preparing && <button class="btn btn--ghost" type="button" onClick={() => setAttempt((value) => value + 1)}>Prepare image again</button>}
      {imageMessage && <p class="field__help" role="status" data-sr-image-message>{imageMessage}</p>}
      {calendarError && <p class="calc__error" role="alert" data-sr-calendar-error>{calendarError}</p>}
      {calendarMessage && <p class="field__help" role="status" data-sr-calendar-message>{calendarMessage}</p>}
      <CalculationReload error={imageReload || calendarReload ? calculationLoadMessage('en') : ''} locale="en" />
    </section>
  );
}
