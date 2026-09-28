/**
 * Site-wide Guide drawer. Signed-out conversation state lives only in this
 * browser tab. Saved-chart birth inputs are used locally when houses need
 * recomputing; cloud requests contain placement lines, never birth details.
 */
import './assistant.css';
import { houseOf, wholeSignCusps } from '../engine/houses';
import { normalizeLocale as normalizeSiteLocale, type ReleasedLocale as Locale } from '../i18n/core';
import { PROFILE_KEY, type SavedChart } from '../profile/schema';
import { repairLegacyPolarChart } from '../profile/polar-repair';
import { profileAccessAllowed } from '../account-v2/profile-access-reader';
import {
  ACCOUNT_V2_LOCAL_OWNER_KEY,
  ACCOUNT_V2_STORAGE_PREFIX,
  isAccountV2Id,
} from '../account-v2/storage-identity';
import { degreeInSign, signForLongitude } from '../signs';
import type { BodyPosition } from '../engine/types';

export type AssistantLocale = Locale;

type GuideAuthor = 'user' | 'guide';

interface GuideGeneration {
  modelId: string;
  promptVersion: string;
  policyVersion: string;
  protocolSchema: 'zodiacs.guide.conversation.draft.v1';
  generatedAt: string;
}

interface GuideMessage {
  messageId: string;
  turnId: string;
  sequence: number;
  author: GuideAuthor;
  content: string;
  contextRevision: number;
  createdAt: string;
  generation: GuideGeneration | null;
}

interface StoredBody {
  body: string;
  lon: number;
  retrograde: boolean;
}

interface StoredChart {
  id: string;
  name: string;
  accountRevision: number;
  updatedAt: string;
  birth: {
    date: string;
    time: string | null;
    timeKnown: boolean;
    place: { lat: number; lon: number; tz: string } | null;
  };
  summary: {
    houseSystem: 'whole' | 'placidus';
    engineVersion: string;
    bodies: StoredBody[];
    angles: { asc: number; mc: number } | null;
  };
}

interface GuideSession {
  version: 1;
  authBoundary: string;
  localDate: string;
  timeZone: string;
  conversationId: string;
  localOwnerId: string;
  dailySessionId: string;
  disclosureId: string;
  consentPolicyVersion: string;
  cloudConsentGranted: boolean;
  revision: number;
  contextRevision: number;
  contextEpoch: number;
  nextSequence: number;
  modelHistoryStartSequence: number;
  lastPageSourceId: string | null;
  removedPageSourceIds: string[];
  todaySkyRemoved: boolean;
  messages: GuideMessage[];
}

interface PageInfo {
  sourceId: string;
  title: string;
  facts: string;
}

interface GuideContextSource {
  sourceId: string;
  kind: 'owner_chart' | 'site_page' | 'today_sky';
  sourceRevision: number;
  title: string;
  facts: string;
  subject: {
    boundary: 'root_user' | 'public_reference';
    subjectId: string;
    subjectName: string | null;
    subjectIsUser: boolean;
  };
  containsThirdPartyData: false;
  persistence: 'local_only';
  contentDigest: string;
}

interface Copy {
  title: string;
  open: string;
  launcher: string;
  close: string;
  clear: string;
  intro: string;
  log: string;
  input: string;
  placeholder: string;
  send: string;
  stop: string;
  retry: string;
  newline: string;
  context: string;
  pageSource: string;
  addPage: string;
  removeSource: string;
  chartOn: string;
  chartOff: string;
  skyOn: string;
  skyOff: string;
  chartReading: string;
  thinking: string;
  stopped: string;
  complete: string;
  empty: string;
  unavailable: string;
  disabled: string;
  rateLimited: string;
  user: string;
  assistant: string;
  privacy: string;
  cloudTitle: string;
  cloudBody: string;
  cloudConfirm: string;
  cloudCancel: string;
  consentTitle: string;
  consentBody: string;
  /** consentBody for a chart without a birth time. */
  consentBodyNoTime: string;
  consentConfirm: string;
  consentCancel: string;
  sources: string;
  contextUpdated: string;
}

const COPY: Record<AssistantLocale, Copy> = {
  en: {
    title: 'Guide', open: 'Open Guide', launcher: 'Ask Guide', close: 'Close Guide', clear: "Clear today's conversation",
    intro: 'Ask about this page, astrology, or your birth chart.',
    log: 'Guide conversation',
    input: 'Your question', placeholder: 'What would you like help with?', send: 'Send', stop: 'Stop', retry: 'Retry',
    newline: 'Shift + Enter for a new line', context: 'Visible sources', pageSource: 'This page',
    addPage: 'Use this page', removeSource: 'Remove source', chartOn: 'Using my chart', chartOff: 'Use my chart',
    skyOn: "Using today's sky", skyOff: "Use today's sky",
    chartReading: 'Reading the placements in your saved chart…', thinking: 'Guide is thinking…',
    stopped: 'Stopped.', complete: 'Answer complete.', empty: 'Write a question first.',
    unavailable: 'Guide is temporarily unavailable. Please try again later.',
    disabled: 'Guide is resting right now. The rest of Zodiacs.org still works.',
    rateLimited: 'Guide is busy or has reached a fair-use limit. Wait a minute; if it continues, come back tomorrow.',
    user: 'You', assistant: 'Guide',
    privacy: 'Guide can be wrong. This web conversation stays in this browser session and is not synced to an account; submitted content and generated draft replies are processed by OpenAI.',
    cloudTitle: 'Before Guide answers',
    cloudBody: 'Guide sends your question, recent Guide messages, and the visible sources above to OpenAI for an input safety check and to generate a draft reply. It then sends that generated draft reply back to OpenAI for a second safety check before showing it. This web Guide conversation stays only in this browser session, is not synced to your account, and is not stored as text by Zodiacs.org. Under standard API controls, OpenAI may retain abuse-monitoring data for up to 30 days, or longer where the law requires it or to protect against harm. Continue for this Guide day?',
    cloudConfirm: 'Continue with Guide', cloudCancel: 'Not now', consentTitle: 'Before your chart is attached',
    consentBody: 'This is the one chart you explicitly marked as your own. The placement lines below will be sent to OpenAI with your question. Zodiacs.org does not attach its saved name, birth date, time, place, or coordinates, and does not store the signed-out conversation. The planet positions still give your birth date and time, and the ascendant and midheaven, kept to the whole degree, give your birthplace roughly.',
    consentBodyNoTime: 'This is the one chart you explicitly marked as your own. The placement lines below will be sent to OpenAI with your question. Zodiacs.org does not attach its saved name, birth date, place, or coordinates, and does not store the signed-out conversation. With no birth time, the lines are the sky at 12:00 UTC on your birth date, without the Moon, whose sign needs a birth time: they give your birth date and nothing about your birthplace.',
    consentConfirm: 'Attach my chart', consentCancel: 'Keep it private', sources: 'From this site:',
    contextUpdated: 'Source removed. Earlier messages remain visible, but Guide will not use them in future answers.',
  },
  es: {
    title: 'Guide', open: 'Abrir Guide', launcher: 'Preguntar a Guide', close: 'Cerrar Guide', clear: 'Borrar la conversación de hoy',
    intro: 'Pregunta sobre esta página, astrología o tu carta natal.',
    log: 'Conversación con Guide',
    input: 'Tu pregunta', placeholder: '¿En qué te puedo ayudar?', send: 'Enviar', stop: 'Detener', retry: 'Reintentar',
    newline: 'Mayús + Intro para una línea nueva', context: 'Fuentes visibles', pageSource: 'Esta página',
    addPage: 'Usar esta página', removeSource: 'Quitar fuente', chartOn: 'Usando mi carta', chartOff: 'Usar mi carta',
    skyOn: 'Usando el cielo de hoy', skyOff: 'Usar el cielo de hoy',
    chartReading: 'Leyendo las posiciones de tu carta guardada…', thinking: 'Guide está pensando…',
    stopped: 'Detenido.', complete: 'Respuesta completa.', empty: 'Escribe una pregunta primero.',
    unavailable: 'Guide no está disponible temporalmente. Inténtalo de nuevo más tarde.',
    disabled: 'Guide está descansando ahora. El resto de Zodiacs.org sigue funcionando.',
    rateLimited: 'Guide está ocupado o alcanzó un límite de uso justo. Espera un minuto; si continúa, vuelve mañana.', user: 'Tú', assistant: 'Guide',
    privacy: 'Guide puede equivocarse. Esta conversación web permanece en esta sesión del navegador y no se sincroniza con una cuenta; OpenAI procesa el contenido enviado y los borradores de respuesta generados.',
    cloudTitle: 'Antes de que Guide responda',
    cloudBody: 'Guide envía tu pregunta, los mensajes recientes y las fuentes visibles a OpenAI para una revisión de seguridad de la entrada y para generar un borrador de respuesta. Después envía ese borrador de respuesta generado de nuevo a OpenAI para una segunda revisión de seguridad antes de mostrártelo. Esta conversación web permanece solo en esta sesión del navegador, no se sincroniza con tu cuenta y Zodiacs.org no almacena su texto. Con los controles estándar de la API, OpenAI puede conservar datos de control de abusos hasta 30 días, o más cuando la ley lo exige o para proteger frente a daños. ¿Continuar durante este día de Guide?',
    cloudConfirm: 'Continuar con Guide', cloudCancel: 'Ahora no', consentTitle: 'Antes de adjuntar tu carta',
    consentBody: 'Las posiciones que aparecen abajo se enviarán a OpenAI con tu pregunta. Zodiacs.org no adjunta tu nombre, fecha, hora, lugar de nacimiento ni coordenadas guardados, y no guarda la conversación. Aun así, las posiciones de los planetas permiten deducir tu fecha y hora de nacimiento, y el ascendente y el medio cielo, al grado entero, tu lugar de nacimiento de forma aproximada.',
    consentBodyNoTime: 'Las posiciones que aparecen abajo se enviarán a OpenAI con tu pregunta. Zodiacs.org no adjunta tu nombre, fecha, lugar de nacimiento ni coordenadas guardados, y no guarda la conversación. Sin hora de nacimiento, son las posiciones del cielo a las 12:00 UTC de tu fecha de nacimiento, sin la Luna, cuyo signo necesita la hora: permiten deducir tu fecha de nacimiento, pero nada sobre tu lugar de nacimiento.',
    consentConfirm: 'Adjuntar mi carta', consentCancel: 'Mantenerla privada', sources: 'De este sitio:',
    contextUpdated: 'Fuente eliminada. Los mensajes anteriores siguen visibles, pero Guide no los usará en respuestas futuras.',
  },
  pt: {
    title: 'Guide', open: 'Abrir Guide', launcher: 'Perguntar ao Guide', close: 'Fechar Guide', clear: 'Limpar a conversa de hoje',
    intro: 'Pergunte sobre esta página, astrologia ou seu mapa natal.',
    log: 'Conversa com o Guide',
    input: 'Sua pergunta', placeholder: 'Como posso ajudar?', send: 'Enviar', stop: 'Parar', retry: 'Tentar de novo',
    newline: 'Shift + Enter para uma nova linha', context: 'Fontes visíveis', pageSource: 'Esta página',
    addPage: 'Usar esta página', removeSource: 'Remover fonte', chartOn: 'Usando meu mapa', chartOff: 'Usar meu mapa',
    skyOn: 'Usando o céu de hoje', skyOff: 'Usar o céu de hoje',
    chartReading: 'Lendo as posições do seu mapa salvo…', thinking: 'Guide está pensando…',
    stopped: 'Interrompido.', complete: 'Resposta concluída.', empty: 'Escreva uma pergunta primeiro.',
    unavailable: 'O Guide está temporariamente indisponível. Tente novamente mais tarde.',
    disabled: 'O Guide está descansando agora. O restante do Zodiacs.org continua funcionando.',
    rateLimited: 'O Guide está ocupado ou atingiu um limite de uso justo. Espere um minuto; se continuar, volte amanhã.', user: 'Você', assistant: 'Guide',
    privacy: 'O Guide pode errar. Esta conversa na web fica nesta sessão do navegador e não é sincronizada com uma conta; o conteúdo enviado e os rascunhos de resposta gerados são processados pela OpenAI.',
    cloudTitle: 'Antes de o Guide responder',
    cloudBody: 'O Guide envia sua pergunta, as mensagens recentes e as fontes visíveis à OpenAI para uma verificação de segurança da entrada e para gerar um rascunho de resposta. Depois, envia esse rascunho de resposta gerado de volta à OpenAI para uma segunda verificação de segurança antes de mostrá-lo. Esta conversa do Guide na web fica apenas nesta sessão do navegador, não é sincronizada com sua conta e não é armazenada como texto pelo Zodiacs.org. Nos controles padrão da API, a OpenAI pode reter dados de monitoramento de abuso por até 30 dias, ou mais quando a lei exige ou para proteger contra danos. Continuar neste dia do Guide?',
    cloudConfirm: 'Continuar com o Guide', cloudCancel: 'Agora não', consentTitle: 'Antes de anexar seu mapa',
    consentBody: 'As posições abaixo serão enviadas à OpenAI com sua pergunta. O Zodiacs.org não anexa nome, data, hora, local de nascimento nem coordenadas salvos e não armazena a conversa. Mesmo assim, as posições dos planetas permitem deduzir sua data e hora de nascimento, e o ascendente e o meio do céu, em graus inteiros, o seu local de nascimento de forma aproximada.',
    consentBodyNoTime: 'As posições abaixo serão enviadas à OpenAI com sua pergunta. O Zodiacs.org não anexa nome, data, local de nascimento nem coordenadas salvos e não armazena a conversa. Sem a hora de nascimento, são as posições do céu às 12:00 UTC da sua data de nascimento, sem a Lua, cujo signo depende da hora: indicam a sua data de nascimento, mas nada sobre o seu local de nascimento.',
    consentConfirm: 'Anexar meu mapa', consentCancel: 'Manter privado', sources: 'Deste site:',
    contextUpdated: 'Fonte removida. As mensagens anteriores continuam visíveis, mas o Guide não as usará nas próximas respostas.',
  },
  fr: {
    title: 'Guide', open: 'Ouvrir Guide', launcher: 'Demander à Guide', close: 'Fermer Guide', clear: 'Effacer la conversation du jour',
    intro: 'Pose une question sur cette page, l’astrologie ou ton thème natal.',
    log: 'Conversation avec Guide',
    input: 'Ta question', placeholder: 'Comment puis-je aider ?', send: 'Envoyer', stop: 'Arrêter', retry: 'Réessayer',
    newline: 'Maj + Entrée pour aller à la ligne', context: 'Sources visibles', pageSource: 'Cette page',
    addPage: 'Utiliser cette page', removeSource: 'Retirer la source', chartOn: 'Avec mon thème', chartOff: 'Utiliser mon thème',
    skyOn: 'Avec le ciel du jour', skyOff: 'Utiliser le ciel du jour',
    chartReading: 'Lecture des positions de ton thème enregistré…', thinking: 'Guide réfléchit…',
    stopped: 'Interrompu.', complete: 'Réponse terminée.', empty: 'Écris d’abord une question.',
    unavailable: 'Guide est temporairement indisponible. Réessaie plus tard.',
    disabled: 'Guide se repose pour le moment. Le reste de Zodiacs.org fonctionne toujours.',
    rateLimited: 'Guide est occupé ou a atteint une limite d’utilisation équitable. Attends une minute ; si cela continue, reviens demain.', user: 'Toi', assistant: 'Guide',
    privacy: 'Guide peut se tromper. Cette conversation web reste dans cette session du navigateur et n’est pas synchronisée avec un compte ; OpenAI traite le contenu envoyé et les brouillons de réponse générés.',
    cloudTitle: 'Avant la réponse de Guide',
    cloudBody: 'Guide envoie ta question, les messages récents et les sources visibles à OpenAI pour un contrôle de sécurité de l’entrée et pour produire un brouillon de réponse. Guide renvoie ensuite ce brouillon de réponse généré à OpenAI pour un second contrôle de sécurité avant de te l’afficher. Cette conversation Guide web reste uniquement dans cette session du navigateur, n’est pas synchronisée avec ton compte et n’est pas stockée sous forme de texte par Zodiacs.org. Avec les contrôles API standard, OpenAI peut garder des données de surveillance des abus jusqu’à 30 jours, ou plus longtemps lorsque la loi l’exige ou pour prévenir un préjudice. Continuer pour cette journée Guide ?',
    cloudConfirm: 'Continuer avec Guide', cloudCancel: 'Pas maintenant', consentTitle: 'Avant de joindre ton thème',
    consentBody: 'Les positions ci-dessous seront envoyées à OpenAI avec ta question. Zodiacs.org ne joint aucun nom, date, heure, lieu de naissance ou coordonnée enregistrés et ne conserve pas la conversation. Les positions des planètes permettent quand même de retrouver ta date et ton heure de naissance, et l’ascendant et le milieu du ciel, au degré entier, ton lieu de naissance de façon approximative.',
    consentBodyNoTime: 'Les positions ci-dessous seront envoyées à OpenAI avec ta question. Zodiacs.org ne joint aucun nom, date, lieu de naissance ou coordonnée enregistrés et ne conserve pas la conversation. Sans heure de naissance, ce sont les positions du ciel à 12:00 UTC à ta date de naissance, sans la Lune, dont le signe demande l’heure : elles donnent ta date de naissance, mais rien sur ton lieu de naissance.',
    consentConfirm: 'Joindre mon thème', consentCancel: 'Le garder privé', sources: 'Depuis ce site :',
    contextUpdated: 'Source retirée. Les anciens messages restent visibles, mais Guide ne les utilisera plus dans ses réponses.',
  },
  it: {
    title: 'Guide', open: 'Apri Guide', launcher: 'Chiedi a Guide', close: 'Chiudi Guide', clear: 'Cancella la conversazione di oggi',
    intro: 'Chiedi di questa pagina, astrologia o il tuo tema natale.',
    log: 'Conversazione con Guide',
    input: 'La tua domanda', placeholder: 'Come posso aiutarti?', send: 'Invia', stop: 'Interrompi', retry: 'Riprova',
    newline: 'Maiusc + Invio per andare a capo', context: 'Fonti visibili', pageSource: 'Questa pagina',
    addPage: 'Usa questa pagina', removeSource: 'Rimuovi fonte', chartOn: 'Con il mio tema', chartOff: 'Usa il mio tema',
    skyOn: 'Con il cielo di oggi', skyOff: 'Usa il cielo di oggi',
    chartReading: 'Lettura delle posizioni nel tuo tema salvato…', thinking: 'Guide sta pensando…',
    stopped: 'Interrotto.', complete: 'Risposta completata.', empty: 'Prima scrivi una domanda.',
    unavailable: 'Guide non è disponibile temporaneamente. Riprova più tardi.',
    disabled: 'Guide sta riposando. Il resto di Zodiacs.org continua a funzionare.',
    rateLimited: 'Guide è occupato o ha raggiunto un limite di utilizzo equo. Aspetta un minuto; se continua, torna domani.', user: 'Tu', assistant: 'Guide',
    privacy: 'Guide può sbagliare. Questa conversazione web resta nella sessione del browser e non viene sincronizzata con un account; OpenAI elabora i contenuti inviati e le bozze di risposta generate.',
    cloudTitle: 'Prima che Guide risponda',
    cloudBody: 'Guide invia la tua domanda, i messaggi recenti e le fonti visibili a OpenAI per un controllo di sicurezza dell’input e per generare una bozza di risposta. Poi invia di nuovo a OpenAI la bozza di risposta generata per un secondo controllo di sicurezza prima di mostrartela. Questa conversazione web con Guide resta soltanto in questa sessione del browser, non viene sincronizzata con il tuo account e non viene archiviata come testo da Zodiacs.org. Con i controlli API standard, OpenAI può conservare dati di monitoraggio degli abusi fino a 30 giorni, o più a lungo quando la legge lo richiede o per prevenire danni. Continuare per questa giornata Guide?',
    cloudConfirm: 'Continua con Guide', cloudCancel: 'Non ora', consentTitle: 'Prima di allegare il tuo tema',
    consentBody: 'Le posizioni qui sotto saranno inviate a OpenAI con la tua domanda. Zodiacs.org non allega nome, data, ora, luogo di nascita o coordinate salvati e non conserva la conversazione. Le posizioni dei pianeti permettono comunque di ricavare data e ora di nascita, e l’ascendente e il medio cielo, al grado intero, il luogo di nascita in modo approssimativo.',
    consentBodyNoTime: 'Le posizioni qui sotto saranno inviate a OpenAI con la tua domanda. Zodiacs.org non allega nome, data, luogo di nascita o coordinate salvati e non conserva la conversazione. Senza ora di nascita, sono le posizioni del cielo alle 12:00 UTC della tua data di nascita, senza la Luna, il cui segno richiede l’ora: indicano la data di nascita, ma nulla del luogo di nascita.',
    consentConfirm: 'Allega il mio tema', consentCancel: 'Tienilo privato', sources: 'Da questo sito:',
    contextUpdated: 'Fonte rimossa. I messaggi precedenti restano visibili, ma Guide non li userà nelle risposte future.',
  },
};

const MAX_INPUT = 2_400;
const MAX_MESSAGES = 12;
const MAX_CHART_CONTEXT = 3_500;
const SESSION_KEY = 'zodiacs.guide.daily-session.v1';
const AUTH_BOUNDARY_KEY = 'zodiacs.guide.auth-boundary.v1';
const CONSENT_POLICY_VERSION = 'guide-cloud-processing-2026-08-14.2';
const STYLESHEET_HREF = '/assets/assistant-drawer.css?v=ask-guide-4';
const GUIDE_AVATAR_SRC = '/assets/guide-avatar.webp';
const STREAM_SCHEMA = 'zodiacs.guide.stream-event.draft.v1';
const GUIDE_LINK_PATHS = new Set([
  '/ask/',
  '/birth-chart/',
  '/moon-sign/',
  '/methodology/',
  '/transits/',
  '/compatibility/',
  '/learn/',
  '/horoscopes/',
  '/profile/',
]);
let stylesheetPromise: Promise<void> | null = null;

let root: HTMLDivElement | null = null;
let panel: HTMLDivElement | null = null;
let title: HTMLHeadingElement | null = null;
let closeButton: HTMLButtonElement | null = null;
let clearButton: HTMLButtonElement | null = null;
let intro: HTMLParagraphElement | null = null;
let sourcesRegion: HTMLDivElement | null = null;
let pageSourceChip: HTMLDivElement | null = null;
let pageSourceText: HTMLSpanElement | null = null;
let pageSourceRemove: HTMLButtonElement | null = null;
let pageSourceAdd: HTMLButtonElement | null = null;
let transcript: HTMLDivElement | null = null;
let status: HTMLParagraphElement | null = null;
let form: HTMLFormElement | null = null;
let textarea: HTMLTextAreaElement | null = null;
let sendButton: HTMLButtonElement | null = null;
let stopButton: HTMLButtonElement | null = null;
let retryButton: HTMLButtonElement | null = null;
let chartButton: HTMLButtonElement | null = null;
let skyButton: HTMLButtonElement | null = null;
let newlineHint: HTMLSpanElement | null = null;
let privacy: HTMLParagraphElement | null = null;
let launcher: HTMLButtonElement | null = null;
let opener: HTMLElement | null = null;
let activeRequest: AbortController | null = null;
let previousOverflow = '';
let locale: AssistantLocale = 'en';
let session: GuideSession | null = null;
let currentPage: PageInfo | null = null;
let savedChart: StoredChart | null = null;
let chartEnabled = false;
let chartConsented = false;
let chartSourceId: string | null = null;
let chartSummaryPromise: Promise<string | null> | null = null;
let profileAccessGeneration = 0;
let interactionPending = false;
let hasUserOpened = false;
let pendingRetry: PendingTurn | null = null;
let authFencePromise: Promise<void> | null = null;
let authFenceCleanup: (() => void) | null = null;
let authFenceVersion = 0;

interface PendingTurn {
  body: Record<string, unknown>;
  question: string;
  requestHistory: GuideMessage[];
  userMessage: GuideMessage;
  turnId: string;
  attemptId: string;
  userArticle: HTMLElement;
  assistantArticle: HTMLElement;
  assistantBody: HTMLElement;
  chartAuthority: StoredChart | null;
}

class AssistantFailure extends Error {
  constructor(public code: string, public retryable = false, public accepted = false) {
    super(code);
  }
}

const currentCopy = () => COPY[locale];

function createGuideAvatar(className: string, size: number): HTMLImageElement {
  const image = document.createElement('img');
  image.className = `zguide-avatar ${className}`;
  image.src = GUIDE_AVATAR_SRC;
  image.alt = '';
  image.width = size;
  image.height = size;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  image.setAttribute('aria-hidden', 'true');
  image.setAttribute('fetchpriority', 'low');
  return image;
}

function ensureStylesheet(): Promise<void> {
  if (stylesheetPromise) return stylesheetPromise;
  const existing = document.querySelector<HTMLLinkElement>(`link[href="${STYLESHEET_HREF}"]`);
  const link = existing ?? document.createElement('link');
  if (!existing) {
    link.rel = 'stylesheet';
    link.href = STYLESHEET_HREF;
    link.dataset.assistantStyles = '';
  }
  stylesheetPromise = new Promise((resolve) => {
    if (link.sheet) return resolve();
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
  if (!existing) document.head.appendChild(link);
  return stylesheetPromise;
}

function normalizeLocale(value?: string): AssistantLocale {
  return normalizeSiteLocale(value ?? document.documentElement.lang);
}

function track(name: string): void {
  (window as unknown as { zodiacsAnalytics?: { track?: (event: string) => void } })
    .zodiacsAnalytics?.track?.(name);
}

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function localDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function guideDayAnchorMatches(
  storedDate: string,
  storedTimeZone: string,
  currentDate: string,
  currentTimeZone: string,
): boolean {
  return storedDate === currentDate && storedTimeZone === currentTimeZone;
}

function safeSessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function safeSessionSet(key: string, value: string): boolean {
  try { sessionStorage.setItem(key, value); return true; } catch { return false; }
}

function rememberedAuthBoundary(): string {
  const value = safeSessionGet(AUTH_BOUNDARY_KEY);
  return value && /^(?:signed_out|account:[0-9a-f-]{36}|blocked:[0-9a-f-]{36})$/u.test(value)
    ? value
    : 'signed_out';
}

function isGuideMessage(value: unknown): value is GuideMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Partial<GuideMessage>;
  return typeof message.messageId === 'string'
    && typeof message.turnId === 'string'
    && Number.isSafeInteger(message.sequence)
    && (message.author === 'user' || message.author === 'guide')
    && typeof message.content === 'string'
    && typeof message.contextRevision === 'number'
    && typeof message.createdAt === 'string';
}

function createSession(): GuideSession {
  return {
    version: 1,
    authBoundary: rememberedAuthBoundary(),
    localDate: localDate(),
    timeZone: localTimeZone(),
    conversationId: uuid(),
    localOwnerId: uuid(),
    dailySessionId: uuid(),
    disclosureId: uuid(),
    consentPolicyVersion: CONSENT_POLICY_VERSION,
    cloudConsentGranted: false,
    revision: 0,
    contextRevision: 0,
    contextEpoch: 0,
    nextSequence: 1,
    modelHistoryStartSequence: 1,
    lastPageSourceId: null,
    removedPageSourceIds: [],
    todaySkyRemoved: false,
    messages: [],
  };
}

function parseSession(raw: string | null): GuideSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<GuideSession>;
    if (value.version !== 1 || value.authBoundary !== rememberedAuthBoundary()
      || value.localDate !== localDate() || value.timeZone !== localTimeZone()
      || typeof value.conversationId !== 'string' || typeof value.localOwnerId !== 'string'
      || typeof value.dailySessionId !== 'string' || typeof value.disclosureId !== 'string'
      || !Number.isSafeInteger(value.revision) || !Number.isSafeInteger(value.contextRevision)
      || !Number.isSafeInteger(value.contextEpoch) || !Number.isSafeInteger(value.nextSequence)
      || !Number.isSafeInteger(value.modelHistoryStartSequence) || !Array.isArray(value.messages)
      || !value.messages.every(isGuideMessage) || !Array.isArray(value.removedPageSourceIds)) return null;
    return {
      ...value,
      consentPolicyVersion: CONSENT_POLICY_VERSION,
      cloudConsentGranted: value.consentPolicyVersion === CONSENT_POLICY_VERSION
        && value.cloudConsentGranted === true,
      messages: value.messages.slice(-MAX_MESSAGES),
      removedPageSourceIds: value.removedPageSourceIds.filter((id): id is string => typeof id === 'string').slice(-20),
      todaySkyRemoved: value.todaySkyRemoved === true,
    } as GuideSession;
  } catch {
    return null;
  }
}

function saveSession(): void {
  if (!session) return;
  let serialized = JSON.stringify(session);
  while (new TextEncoder().encode(serialized).byteLength > 48_000 && session.messages.length > 2) {
    session.messages = session.messages.slice(2);
    serialized = JSON.stringify(session);
  }
  safeSessionSet(SESSION_KEY, serialized);
}

function getSession(): GuideSession {
  session ??= parseSession(safeSessionGet(SESSION_KEY)) ?? createSession();
  saveSession();
  return session;
}

const PAGE_CATALOG = {
  guide: { title: 'Guide', facts: 'The current page is the canonical Guide home at /ask/.' },
  'birth-chart': { title: 'Birth chart', facts: 'The current page is part of the Zodiacs.org birth-chart calculator.' },
  'moon-sign': { title: 'Moon sign', facts: 'The current page is the canonical Zodiacs.org Moon-sign calculator and explanation at /moon-sign/.' },
  'astrology-method': { title: 'Astrology method', facts: 'The current page explains how Zodiacs.org separates astronomical calculation from astrological interpretation.' },
  transits: { title: 'Transits', facts: 'The current page is part of the Zodiacs.org current-sky and transit tools.' },
  compatibility: { title: 'Compatibility', facts: 'The current page is part of the Zodiacs.org chart-comparison and compatibility guides.' },
  learn: { title: 'Learn astrology', facts: 'The current page is part of the Zodiacs.org Learn astrology reference.' },
  horoscopes: { title: 'Horoscopes and Today', facts: 'The current page is part of the dated Zodiacs.org horoscope or Today editions.' },
  account: { title: 'Optional Zodiacs account', facts: 'The current page is part of the optional Zodiacs account and saved-chart area.' },
} as const;

type PageCatalogId = keyof typeof PAGE_CATALOG;

function approvedPageId(pathname: string): PageCatalogId | null {
  const path = pathname.replace(/^\/(?:es|pt|fr|it|ru)(?=\/|$)/, '') || '/';
  if (path === '/ask/' || path === '/ask') return 'guide';
  if (/^\/moon-sign(?:\/|$)/.test(path)) return 'moon-sign';
  if (/^\/(?:birth-chart|rising-sign|solar-return|saturn-return|baby-zodiac)(?:\/|$)/.test(path)) return 'birth-chart';
  if (/^\/methodology(?:\/|$)/.test(path)) return 'astrology-method';
  if (/^\/(?:transits|events|moon-phase|full-moon-calendar|eclipses|retrogrades|mercury-retrograde)(?:\/|$)/.test(path)) return 'transits';
  if (/^\/compatibility(?:\/|$)/.test(path)) return 'compatibility';
  if (/^\/learn(?:\/|$)/.test(path)) return 'learn';
  if (/^\/(?:horoscopes|today)(?:\/|$)/.test(path)) return 'horoscopes';
  if (/^\/(?:profile|account)(?:\/|$)/.test(path)) return 'account';
  return null;
}

function pageInfo(): PageInfo | null {
  // Only the pathname selects a fixed public catalog entry. Queries,
  // referrers, DOM text, and document titles are never read into context.
  const id = approvedPageId(location.pathname);
  if (!id) return null;
  const approved = PAGE_CATALOG[id];
  return { sourceId: `page:${id}`, title: approved.title, facts: approved.facts };
}

function clearPendingRetry(): void {
  pendingRetry = null;
  if (retryButton) retryButton.hidden = true;
}

function invalidateContext(cutOffHistory: boolean, renewCloudConsent = false): void {
  const state = getSession();
  state.revision += 1;
  state.contextRevision += 1;
  state.contextEpoch += 1;
  if (cutOffHistory) state.modelHistoryStartSequence = state.nextSequence;
  if (renewCloudConsent) state.cloudConsentGranted = false;
  clearPendingRetry();
  saveSession();
}

function syncPageBoundary(): void {
  currentPage = pageInfo();
  const state = getSession();
  if (!currentPage) {
    if (state.lastPageSourceId !== null) {
      state.lastPageSourceId = null;
      invalidateContext(true);
    }
    syncSourceControls();
    return;
  }
  if (state.lastPageSourceId === null) {
    state.lastPageSourceId = currentPage.sourceId;
    invalidateContext(false);
  } else if (state.lastPageSourceId !== currentPage.sourceId) {
    state.lastPageSourceId = currentPage.sourceId;
    invalidateContext(true, true);
  }
  syncSourceControls();
}

function pageSourceEnabled(): boolean {
  const state = getSession();
  return Boolean(currentPage && !state.removedPageSourceIds.includes(currentPage.sourceId));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

async function sha256Hex(value: string): Promise<string> {
  if (!crypto.subtle) throw new AssistantFailure('unavailable');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function localSource(candidate: Omit<GuideContextSource, 'contentDigest'>): Promise<GuideContextSource> {
  const contentDigest = await sha256Hex(canonicalJson({
    domain: 'zodiacs.guide.source-content.draft.v1',
    kind: candidate.kind,
    sourceId: candidate.sourceId,
    sourceRevision: candidate.sourceRevision,
    title: candidate.title,
    facts: candidate.facts,
    subject: candidate.subject,
    containsThirdPartyData: candidate.containsThirdPartyData,
  }));
  return { ...candidate, contentDigest };
}

function sourceScope(source: GuideContextSource | null) {
  return source === null ? null : {
    kind: source.kind,
    sourceId: source.sourceId,
    sourceRevision: source.sourceRevision,
    contentDigest: source.contentDigest,
    subject: {
      boundary: source.subject.boundary,
      subjectId: source.subject.subjectId,
      subjectIsUser: source.subject.subjectIsUser,
    },
  };
}

async function contextScopeDigest(
  history: GuideMessage[],
  ownerChart: GuideContextSource | null,
  todaySky: GuideContextSource | null,
  attachments: GuideContextSource[],
): Promise<string> {
  const state = getSession();
  const historyProjection = await Promise.all(history.map(async (message) => ({
    sequence: message.sequence,
    messageId: message.messageId,
    author: message.author,
    contentDigest: await sha256Hex(message.content),
  })));
  return sha256Hex(canonicalJson({
    domain: 'zodiacs.guide.context-scope.draft.v1',
    conversationId: state.conversationId,
    contextEpoch: state.contextEpoch,
    modelHistoryStartSequence: state.modelHistoryStartSequence,
    history: historyProjection,
    base: [
      { slot: 'owner_chart', state: ownerChart ? 'active' : 'unavailable', source: sourceScope(ownerChart) },
      { slot: 'today_sky', state: todaySky ? 'active' : 'unavailable', source: sourceScope(todaySky) },
    ],
    attachments: attachments.map(sourceScope),
  }));
}

function finiteLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 360;
}

function parseStoredChart(value: unknown): StoredChart | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  // Match the profile reader's guarded local repair before projecting the
  // placement-only context. Account selection and attestation stay unchanged.
  const candidate = repairLegacyPolarChart(value as SavedChart) as unknown as Record<string, unknown>;
  const rawBirth = candidate.birth;
  const rawSummary = candidate.summary;
  if (!rawBirth || typeof rawBirth !== 'object' || Array.isArray(rawBirth)) return null;
  if (!rawSummary || typeof rawSummary !== 'object' || Array.isArray(rawSummary)) return null;
  const birth = rawBirth as Record<string, unknown>;
  const summary = rawSummary as Record<string, unknown>;
  const bodies = Array.isArray(summary.bodies) ? summary.bodies.flatMap((body): StoredBody[] => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
    const record = body as Record<string, unknown>;
    if (typeof record.body !== 'string' || !record.body.trim() || !finiteLongitude(record.lon)) return [];
    return [{ body: record.body.trim(), lon: record.lon, retrograde: record.retrograde === true }];
  }) : [];
  if (!bodies.length) return null;
  let angles: StoredChart['summary']['angles'] = null;
  if (summary.angles && typeof summary.angles === 'object' && !Array.isArray(summary.angles)) {
    const value = summary.angles as Record<string, unknown>;
    if (finiteLongitude(value.asc) && finiteLongitude(value.mc)) angles = { asc: value.asc, mc: value.mc };
  }
  let place: StoredChart['birth']['place'] = null;
  if (birth.place && typeof birth.place === 'object' && !Array.isArray(birth.place)) {
    const value = birth.place as Record<string, unknown>;
    if (typeof value.lat === 'number' && Number.isFinite(value.lat)
      && typeof value.lon === 'number' && Number.isFinite(value.lon)
      && typeof value.tz === 'string' && value.tz.trim()) {
      place = { lat: value.lat, lon: value.lon, tz: value.tz };
    }
  }
  return {
    id: typeof candidate.id === 'string' ? candidate.id : '',
    name: typeof candidate.name === 'string' ? candidate.name : '',
    accountRevision: -1,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : '',
    birth: {
      date: typeof birth.date === 'string' ? birth.date : '',
      time: typeof birth.time === 'string' ? birth.time : null,
      timeKnown: birth.timeKnown === true,
      place,
    },
    summary: {
      houseSystem: summary.houseSystem === 'placidus' ? 'placidus' : 'whole',
      engineVersion: typeof summary.engineVersion === 'string' ? summary.engineVersion : '',
      bodies,
      angles,
    },
  };
}

function parseLocalOwner(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const owner = JSON.parse(raw) as Record<string, unknown>;
    return Object.keys(owner).length === 2 && owner.version === 1 && isAccountV2Id(owner.accountId)
      ? owner.accountId
      : null;
  } catch { return null; }
}

/** Resolve only the one chart explicitly selected under account-v2's self attestation. */
export function selectedSelfChartFromJson(
  profileRaw: string | null,
  ownerRaw: string | null,
  metadataRaw: string | null,
): StoredChart | null {
  if (!profileRaw || !metadataRaw) return null;
  const accountId = parseLocalOwner(ownerRaw);
  if (!accountId) return null;
  try {
    const profile = JSON.parse(profileRaw) as { version?: unknown; charts?: unknown };
    const metadata = JSON.parse(metadataRaw) as Record<string, unknown>;
    if (profile?.version !== 1 || !Array.isArray(profile.charts)
      || metadata.version !== 1 || metadata.accountId !== accountId
      || !Array.isArray(metadata.charts) || metadata.charts.length > 64) return null;
    const selected = metadata.charts.filter((entry): entry is Record<string, unknown> => (
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
      && isAccountV2Id((entry as Record<string, unknown>).chartId)
      && (entry as Record<string, unknown>).selectedForSync === true
      && Number.isSafeInteger((entry as Record<string, unknown>).serverRevision)
      && Number((entry as Record<string, unknown>).serverRevision) >= 0
    ));
    if (selected.length !== 1) return null;
    const selectedId = selected[0].chartId;
    const chart = profile.charts.map(parseStoredChart).find((candidate) => (
      candidate !== null && candidate.id === selectedId
      && isAccountV2Id(candidate.id) && candidate.name.trim().length > 0
    )) ?? null;
    return chart ? { ...chart, accountRevision: Number(selected[0].serverRevision) } : null;
  } catch { return null; }
}

function sameSelfChartAuthority(left: StoredChart | null, right: StoredChart | null): boolean {
  return left !== null && right !== null
    && left.id === right.id
    && left.updatedAt === right.updatedAt
    && left.accountRevision === right.accountRevision;
}

function readSelectedSelfChart(): StoredChart | null {
  if (!profileAccessAllowed()) return null;
  try {
    const ownerRaw = localStorage.getItem(ACCOUNT_V2_LOCAL_OWNER_KEY);
    const ownerId = parseLocalOwner(ownerRaw);
    if (!ownerId || getSession().authBoundary !== `account:${ownerId}`) return null;
    return selectedSelfChartFromJson(
      localStorage.getItem(PROFILE_KEY),
      ownerRaw,
      localStorage.getItem(`${ACCOUNT_V2_STORAGE_PREFIX}account.${ownerId}.v1`),
    );
  } catch { return null; }
}

function placementLabel(lon: number): string {
  const sign = signForLongitude(lon);
  const within = degreeInSign(lon);
  const minutes = Math.floor((within - Math.floor(within)) * 60 + 1e-7);
  return `${Math.floor(within)}°${String(minutes).padStart(2, '0')}′ ${sign.name}`;
}

/** An angle as a shared chart code keeps it: its sign and whole degree. */
function wholeDegreeLabel(lon: number): string {
  return `${Math.floor(degreeInSign(lon))}° ${signForLongitude(lon).name}`;
}

/**
 * The bodies Guide gets for a chart without a birth time: the sky at 12:00
 * UTC on the birth date (untimedSharedPositions), as a shared chart code
 * carries it. The chart itself is noon at the birthplace, an instant whose
 * bodies to the arcminute give its time zone, or before standard time its
 * longitude. Null when the date is not one.
 */
async function untimedPlacements(chart: StoredChart): Promise<StoredBody[] | null> {
  const [{ computeBodies }, { untimedSharedPositions }] = await Promise.all([
    import('../engine/full'),
    import('../share-positions-noon'),
  ]);
  const shared = untimedSharedPositions(chart.summary, chart.birth.date, computeBodies);
  // computeBodies' rows carry each body's motion too.
  return shared
    ? (shared.bodies as readonly BodyPosition[]).map(({ body, lon, retrograde }) => ({ body, lon, retrograde }))
    : null;
}

/**
 * Resolve a saved chart to placement lines without returning birth inputs.
 * The bodies go to the arcminute, which still gives the birth date and time.
 * The ascendant and midheaven go only to the whole degree, as in a shared
 * chart code: to the arcminute, with the bodies, they would give the
 * birthplace to about ten kilometres. House numbers are given only for
 * whole-sign houses, which follow from the ascendant's sign; Placidus
 * numbers would need the exact angles, so a Placidus chart has none. A chart
 * without a birth time goes as the sky at 12:00 UTC on its date, without the
 * Moon, whose sign is not known without a birth time.
 */
export async function placementSummaryForChart(chart: StoredChart): Promise<string | null> {
  const timed = chart.birth.timeKnown;
  const angles = timed ? chart.summary.angles : null;
  const cusps = angles && chart.summary.houseSystem === 'whole' ? wholeSignCusps(angles.asc) : null;
  const bodies = timed ? chart.summary.bodies : await untimedPlacements(chart);
  if (!bodies) return null;
  const lines = bodies.map(({ body, lon, retrograde }) => {
    if (!timed && body === 'Moon') return 'Moon: sign not known without a birth time';
    const house = cusps ? houseOf(lon, cusps) : null;
    return `${body}: ${placementLabel(lon)}${house ? ` · house ${house}` : ''}${retrograde ? ' · retrograde' : ''}`;
  });
  if (angles) {
    for (const [label, lon] of [['ASC', angles.asc], ['MC', angles.mc]] as const) {
      const house = cusps ? houseOf(lon, cusps) : null;
      lines.push(`${label}: ${wholeDegreeLabel(lon)}${house ? ` · house ${house}` : ''}`);
    }
  }
  if (!lines.length) return null;
  const heading = timed
    ? 'Tropical chart placements:'
    : 'Tropical chart placements at 12:00 UTC on the birth date (birth time not known):';
  return `${heading}\n${lines.join('\n')}`.slice(0, MAX_CHART_CONTEXT);
}

const MAX_SKY_CONTEXT = 1_600;
let todaySkyPromise: Promise<string | null> | null = null;
let todaySkyStamp = '';

/** Current tropical positions, computed on this device like saved-chart placements. */
export async function todaySkySummary(now = new Date()): Promise<string | null> {
  try {
    const { computeBodies } = await import('../engine/full');
    const lines = computeBodies(now).map(({ body, lon, retrograde }) => (
      `${body}: ${placementLabel(lon)}${retrograde ? ' · retrograde' : ''}`
    ));
    if (!lines.length) return null;
    const stamp = now.toISOString().slice(0, 16).replace('T', ' ');
    return `Current sky (tropical, geocentric), computed ${stamp} UTC:\n${lines.join('\n')}`
      .slice(0, MAX_SKY_CONTEXT);
  } catch {
    return null;
  }
}

/** One computation per minute; positions drift too slowly to matter within it. */
function cachedTodaySkySummary(): Promise<string | null> {
  const stamp = new Date().toISOString().slice(0, 16);
  if (!todaySkyPromise || todaySkyStamp !== stamp) {
    todaySkyStamp = stamp;
    todaySkyPromise = todaySkySummary();
  }
  return todaySkyPromise;
}

function todaySkyEnabled(): boolean {
  return !getSession().todaySkyRemoved;
}

export interface ParsedAssistantFrame {
  delta?: string;
  done?: boolean;
  error?: string;
  event?: Record<string, unknown>;
}

/** Parse one SSE frame without trusting or rendering server HTML. */
export function parseAssistantSseFrame(frame: string): ParsedAssistantFrame {
  const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, '')).join('\n');
  if (!data) return {};
  if (data === '[DONE]') return { done: true };
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (typeof parsed.error === 'string') return { error: parsed.error };
    if (typeof parsed.t === 'string') return { delta: parsed.t };
    if (typeof parsed.type === 'string') return { event: parsed };
  } catch { return { error: 'temporarily_unavailable' }; }
  return {};
}

interface StreamResult {
  message: GuideMessage;
  conversationRevision: number;
}

async function consumeGuideStream(
  response: Response,
  pending: PendingTurn,
  onDelta: (delta: string) => void,
): Promise<StreamResult> {
  if (!response.body) throw new AssistantFailure('temporarily_unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let expectedSequence = 0;
  let acceptedRevision: number | null = null;
  let completed: StreamResult | null = null;
  const consumeFrame = (frame: string): boolean => {
    const parsed = parseAssistantSseFrame(frame);
    if (parsed.error) throw new AssistantFailure(parsed.error, false, acceptedRevision !== null);
    const event = parsed.event;
    if (!event) return false;
    if (event.schema !== STREAM_SCHEMA || event.conversationId !== getSession().conversationId
      || event.turnId !== pending.turnId || event.attemptId !== pending.attemptId
      || event.eventSequence !== expectedSequence) {
      throw new AssistantFailure('invalid_response', false, acceptedRevision !== null);
    }
    expectedSequence += 1;
    if (event.type === 'accepted') {
      if (acceptedRevision !== null || event.conversationRevision !== getSession().revision + 1) {
        throw new AssistantFailure('invalid_response', false, true);
      }
      acceptedRevision = event.conversationRevision as number;
      return false;
    }
    if (acceptedRevision === null) throw new AssistantFailure('invalid_response');
    if (event.type === 'delta' && typeof event.delta === 'string') {
      onDelta(event.delta);
      return false;
    }
    if (event.type === 'error' && typeof event.code === 'string') {
      throw new AssistantFailure(event.code, false, true);
    }
    if (event.type === 'cancelled') throw new AssistantFailure('cancelled', false, true);
    if (event.type === 'completed') {
      const message = event.message;
      if (!isGuideMessage(message) || message.author !== 'guide' || message.turnId !== pending.turnId
        || message.sequence !== pending.userMessage.sequence + 1
        || event.conversationRevision !== acceptedRevision + 1) {
        throw new AssistantFailure('invalid_response', false, true);
      }
      completed = { message, conversationRevision: event.conversationRevision as number };
      return true;
    }
    throw new AssistantFailure('invalid_response', false, true);
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let boundary = buffer.match(/\r?\n\r?\n/);
    while (boundary?.index !== undefined) {
      const frame = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      if (consumeFrame(frame)) {
        await reader.cancel().catch(() => {});
        return completed!;
      }
      boundary = buffer.match(/\r?\n\r?\n/);
    }
    if (done) break;
  }
  if (buffer.trim() && consumeFrame(buffer)) return completed!;
  throw new AssistantFailure('temporarily_unavailable', false, acceptedRevision !== null);
}

/** Legacy test helper retained while first-party callers move to Guide events. */
export async function consumeAssistantStream(response: Response, onDelta: (delta: string) => void): Promise<void> {
  if (!response.body) throw new AssistantFailure('temporarily_unavailable');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const consume = (frame: string) => {
    const parsed = parseAssistantSseFrame(frame);
    if (parsed.error) throw new AssistantFailure(parsed.error);
    if (parsed.delta) onDelta(parsed.delta);
    return parsed.done === true;
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let boundary = buffer.match(/\r?\n\r?\n/);
    while (boundary?.index !== undefined) {
      const frame = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      if (consume(frame)) { await reader.cancel().catch(() => {}); return; }
      boundary = buffer.match(/\r?\n\r?\n/);
    }
    if (done) break;
  }
  if (buffer.trim() && consume(buffer)) return;
  throw new AssistantFailure('temporarily_unavailable');
}

export type AssistantInline =
  | { kind: 'text'; text: string }
  | { kind: 'strong' | 'em'; children: AssistantInline[] }
  | { kind: 'link'; path: string; label: string };

export type AssistantBlock =
  | { kind: 'paragraph'; children: AssistantInline[] }
  | { kind: 'list'; ordered: boolean; items: AssistantInline[][] };

/** Same-site catalog paths only; trailing punctuation is not part of a path. */
export function assistantLinkPath(candidate: string): string | null {
  let path = candidate;
  while (/[.,!?;:)\]]$/.test(path)) path = path.slice(0, -1);
  if (!path || !path.startsWith('/') || path.startsWith('//')
    || path.includes('\\') || path.includes('?')) return null;
  try {
    const url = new URL(path, 'https://zodiacs.org');
    return url.search === '' && GUIDE_LINK_PATHS.has(`${url.pathname}${url.hash}`)
      ? path
      : null;
  } catch {
    return null;
  }
}

function pushInline(parts: AssistantInline[], part: AssistantInline): void {
  const last = parts[parts.length - 1];
  if (part.kind === 'text') {
    if (!part.text) return;
    if (last?.kind === 'text') {
      last.text += part.text;
      return;
    }
  }
  parts.push(part);
}

function pushLinkifiedText(parts: AssistantInline[], text: string): void {
  const pattern = /(^|[\s([])(\/(?!\/)[^\s<>"`]+)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const start = match.index + match[1].length;
    const path = assistantLinkPath(match[2]);
    if (!path) continue;
    pushInline(parts, { kind: 'text', text: text.slice(cursor, start) });
    pushInline(parts, { kind: 'link', path, label: path });
    cursor = start + path.length;
  }
  pushInline(parts, { kind: 'text', text: text.slice(cursor) });
}

function parseLinkifiedText(text: string): AssistantInline[] {
  const parts: AssistantInline[] = [];
  pushLinkifiedText(parts, text);
  return parts;
}

function parseInlineText(text: string): AssistantInline[] {
  const parts: AssistantInline[] = [];
  const marks = /\*\*([^*\n]+)\*\*|\*([^*\s][^*\n]*?)\*|\[([^\]\n]+)\]\(\s*(\/[^\s)]+)\s*\)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = marks.exec(text)) !== null) {
    // A lone asterisk pair only reads as emphasis at a word boundary; "2*3*4"
    // and similar runs stay literal text.
    if (match[2] !== undefined && match.index > 0 && !/[\s([{'"«‹—–-]/.test(text[match.index - 1]!)) {
      continue;
    }
    pushLinkifiedText(parts, text.slice(cursor, match.index));
    if (match[1] !== undefined) {
      pushInline(parts, { kind: 'strong', children: parseLinkifiedText(match[1]) });
    } else if (match[2] !== undefined) {
      pushInline(parts, { kind: 'em', children: parseLinkifiedText(match[2]) });
    } else {
      const path = assistantLinkPath(match[4] ?? '');
      if (path) pushInline(parts, { kind: 'link', path, label: match[3] ?? path });
      else pushLinkifiedText(parts, match[0]);
    }
    cursor = match.index + match[0].length;
  }
  pushLinkifiedText(parts, text.slice(cursor));
  return parts;
}

const BULLET_LINE = /^[-*]\s+/;
const ORDERED_LINE = /^\d{1,2}[.)]\s+/;

/**
 * Parses model text into the small sanctioned subset — paragraphs, flat
 * lists, bold, italics, and same-site links. Anything outside the subset
 * stays literal text; markup never becomes HTML.
 */
export function parseAssistantMarkdown(text: string): AssistantBlock[] {
  const blocks: AssistantBlock[] = [];
  for (const rawBlock of text.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/)) {
    const lines = rawBlock.split('\n').map((line) => line.trim()).filter(Boolean);
    let paragraph: string[] = [];
    let list: { ordered: boolean; items: AssistantInline[][] } | null = null;
    const flushParagraph = () => {
      if (!paragraph.length) return;
      // A heading outside the subset degrades to an ordinary lead-in line.
      const content = paragraph.join('\n').replace(/^#{1,4}\s+/, '');
      blocks.push({ kind: 'paragraph', children: parseInlineText(content) });
      paragraph = [];
    };
    const flushList = () => {
      if (!list) return;
      blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
      list = null;
    };
    for (const line of lines) {
      const marker = BULLET_LINE.test(line) ? BULLET_LINE : ORDERED_LINE.test(line) ? ORDERED_LINE : null;
      if (!marker) {
        flushList();
        paragraph.push(line);
        continue;
      }
      flushParagraph();
      const ordered = marker === ORDERED_LINE;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(parseInlineText(line.replace(marker, '')));
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}

function appendInlineNodes(container: Node, parts: AssistantInline[]): void {
  for (const part of parts) {
    if (part.kind === 'text') {
      container.appendChild(document.createTextNode(part.text));
    } else if (part.kind === 'link') {
      const anchor = document.createElement('a');
      anchor.href = part.path;
      anchor.textContent = part.label;
      anchor.className = 'zassistant__link';
      container.appendChild(anchor);
    } else {
      const wrap = document.createElement(part.kind);
      appendInlineNodes(wrap, part.children);
      container.appendChild(wrap);
    }
  }
}

/** Model text always renders as DOM nodes built from the parsed subset — never HTML. */
export function renderAssistantText(container: HTMLElement, text: string): void {
  container.textContent = '';
  for (const block of parseAssistantMarkdown(text)) {
    if (block.kind === 'paragraph') {
      const paragraph = document.createElement('p');
      appendInlineNodes(paragraph, block.children);
      container.appendChild(paragraph);
      continue;
    }
    const list = document.createElement(block.ordered ? 'ol' : 'ul');
    for (const item of block.items) {
      const entry = document.createElement('li');
      appendInlineNodes(entry, item);
      list.appendChild(entry);
    }
    container.appendChild(list);
  }
}

function scrollTranscript(): void {
  requestAnimationFrame(() => { if (transcript) transcript.scrollTop = transcript.scrollHeight; });
}

function appendMessage(role: GuideAuthor, content: string): { article: HTMLElement; body: HTMLElement } {
  const article = document.createElement('article');
  article.className = `zassistant__message zassistant__message--${role === 'guide' ? 'assistant' : 'user'}`;
  const label = document.createElement('span');
  label.className = 'zassistant__speaker mono';
  if (role === 'guide') {
    label.append(
      createGuideAvatar('zassistant__message-avatar', 20),
      document.createTextNode(currentCopy().assistant),
    );
  } else {
    label.textContent = currentCopy().user;
  }
  // Guide replies hold parsed block elements; a div keeps that valid HTML.
  const body = document.createElement('div');
  body.className = 'zassistant__message-body';
  body.textContent = content;
  article.append(label, body);
  transcript?.appendChild(article);
  if (intro) intro.hidden = true;
  scrollTranscript();
  return { article, body };
}

function renderTranscript(): void {
  transcript?.replaceChildren();
  for (const message of getSession().messages) {
    const bubble = appendMessage(message.author, message.content);
    if (message.author === 'guide') {
      renderAssistantText(bubble.body, message.content);
      appendSourcesRow(bubble.body, message.content);
    }
  }
  if (intro) intro.hidden = getSession().messages.length > 0;
}

function setStatus(message = ''): void { if (status) status.textContent = message; }

function syncTextareaHeight(): void {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
}

function syncSendState(): void {
  if (!sendButton || !textarea) return;
  sendButton.disabled = Boolean(activeRequest) || interactionPending || !textarea.value.trim();
}

function syncChartButton(): void {
  if (!chartButton) return;
  chartButton.hidden = !savedChart;
  chartButton.disabled = Boolean(activeRequest) || interactionPending;
  chartButton.setAttribute('aria-pressed', String(chartEnabled));
  chartButton.classList.toggle('is-active', chartEnabled);
  chartButton.textContent = chartEnabled ? currentCopy().chartOn : currentCopy().chartOff;
}

function syncSkyButton(): void {
  if (!skyButton) return;
  const enabled = todaySkyEnabled();
  skyButton.disabled = Boolean(activeRequest) || interactionPending;
  skyButton.setAttribute('aria-pressed', String(enabled));
  skyButton.classList.toggle('is-active', enabled);
  skyButton.textContent = enabled ? currentCopy().skyOn : currentCopy().skyOff;
}

function syncSourceControls(): void {
  const enabled = pageSourceEnabled();
  if (pageSourceChip) pageSourceChip.hidden = !enabled;
  if (pageSourceText && currentPage) pageSourceText.textContent = `${currentCopy().pageSource}: ${currentPage.title}`;
  if (pageSourceAdd) pageSourceAdd.hidden = enabled;
  if (pageSourceRemove) pageSourceRemove.disabled = Boolean(activeRequest) || interactionPending;
  if (pageSourceAdd) pageSourceAdd.disabled = Boolean(activeRequest) || interactionPending;
  syncChartButton();
  syncSkyButton();
}

function setBusy(busy: boolean): void {
  activeRequest = busy ? activeRequest : null;
  panel?.setAttribute('aria-busy', String(busy));
  if (stopButton) stopButton.hidden = !busy;
  syncSendState();
  syncSourceControls();
}

function refreshSavedChart(): void {
  dismissPendingConsent?.();
  const next = readSelectedSelfChart();
  if (chartEnabled) invalidateContext(true);
  savedChart = next;
  chartEnabled = false;
  chartConsented = false;
  chartSourceId = null;
  chartSummaryPromise = null;
  syncSourceControls();
}

function friendlyFailure(code: string): string {
  if (code === 'rate_limited' || code === 'limit' || code === '429') return currentCopy().rateLimited;
  if (code === 'disabled') return currentCopy().disabled;
  if (code === 'cancelled') return currentCopy().stopped;
  return currentCopy().unavailable;
}

async function failure(response: Response): Promise<AssistantFailure> {
  try {
    const data = await response.json() as { code?: unknown; error?: unknown; retryable?: unknown };
    const code = typeof data.code === 'string' ? data.code
      : typeof data.error === 'string' ? data.error : String(response.status);
    return new AssistantFailure(code, data.retryable === true, false);
  } catch {
    return new AssistantFailure(response.status === 429 ? 'rate_limited' : 'temporarily_unavailable', response.status >= 500);
  }
}

function abortRequest(): void { activeRequest?.abort(); }

let dismissPendingConsent: (() => void) | null = null;
let dismissPendingCloudConsent: (() => void) | null = null;

function currentProfileAccessGeneration(generation: number): boolean {
  return generation === profileAccessGeneration;
}

function replaceWithFreshSession(): void {
  session = createSession();
  syncPageBoundary();
  saveSession();
}

function clearAssistantForProfileRevocation(): void {
  abortRequest();
  dismissPendingConsent?.();
  dismissPendingCloudConsent?.();
  dismissPendingConsent = null;
  dismissPendingCloudConsent = null;
  savedChart = null;
  chartSummaryPromise = null;
  chartConsented = false;
  chartEnabled = false;
  chartSourceId = null;
  pendingRetry = null;
  replaceWithFreshSession();
  transcript?.replaceChildren();
  if (intro) intro.hidden = false;
  if (textarea) { textarea.value = ''; syncTextareaHeight(); }
  if (retryButton) retryButton.hidden = true;
  setStatus();
  setBusy(false);
}

function rotateGuideDayIfNeeded(): boolean {
  const state = getSession();
  if (guideDayAnchorMatches(state.localDate, state.timeZone, localDate(), localTimeZone())) return false;
  profileAccessGeneration += 1;
  clearAssistantForProfileRevocation();
  return true;
}

function applyGuideAuthBoundary(next: string, invalidateEpoch: boolean): void {
  const state = getSession();
  const changed = state.authBoundary !== next;
  if (invalidateEpoch || changed) profileAccessGeneration += 1;
  if (!changed) return;
  safeSessionSet(AUTH_BOUNDARY_KEY, next);
  clearAssistantForProfileRevocation();
}

/** Resolve account identity only when Guide is opened; the generic welcome stays lightweight. */
async function ensureGuideAuthFence(): Promise<void> {
  authFencePromise ??= (async () => {
    const fenceVersion = authFenceVersion;
    try {
      const { getSupabaseClient } = await import('../supabase/client');
      if (fenceVersion !== authFenceVersion) return;
      const client = getSupabaseClient();
      if (!client) {
        applyGuideAuthBoundary('signed_out', false);
        return;
      }
      let authEventVersion = 0;
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
        if (fenceVersion !== authFenceVersion) return;
        authEventVersion += 1;
        const accountId = nextSession?.user?.id;
        applyGuideAuthBoundary(
          isAccountV2Id(accountId) ? `account:${accountId}` : 'signed_out',
          false,
        );
      });
      if (fenceVersion !== authFenceVersion) {
        subscription.unsubscribe();
        return;
      }
      authFenceCleanup = () => subscription.unsubscribe();
      const snapshotVersion = authEventVersion;
      const { data, error } = await client.auth.getSession();
      if (fenceVersion !== authFenceVersion || snapshotVersion !== authEventVersion) return;
      if (error) {
        applyGuideAuthBoundary(`blocked:${uuid()}`, true);
        return;
      }
      const accountId = data.session?.user?.id;
      applyGuideAuthBoundary(
        isAccountV2Id(accountId) ? `account:${accountId}` : 'signed_out',
        false,
      );
    } catch {
      if (fenceVersion !== authFenceVersion) return;
      applyGuideAuthBoundary(`blocked:${uuid()}`, true);
    }
  })();
  await authFencePromise;
}

function suspendGuideForPageCache(): void {
  profileAccessGeneration += 1;
  authFenceVersion += 1;
  authFenceCleanup?.();
  authFenceCleanup = null;
  authFencePromise = null;
  abortRequest();
  dismissPendingConsent?.();
  dismissPendingCloudConsent?.();
  dismissPendingConsent = null;
  dismissPendingCloudConsent = null;
  savedChart = null;
  chartSummaryPromise = null;
  chartConsented = false;
  chartEnabled = false;
  chartSourceId = null;
  clearPendingRetry();
  interactionPending = false;
  transcript?.replaceChildren();
  if (intro) intro.hidden = false;
  if (textarea) { textarea.value = ''; syncTextareaHeight(); }
  if (root) root.hidden = true;
  document.documentElement.style.overflow = previousOverflow;
  launcher?.removeAttribute('aria-expanded');
  opener = null;
  setStatus();
  setBusy(false);
}

function restoreGuideAfterPageCache(event: PageTransitionEvent): void {
  if (!event.persisted) return;
  // The private drawer remains hidden until a fresh auth snapshot resolves.
  void ensureGuideAuthFence();
}

function onProfileAccessChange(): void {
  profileAccessGeneration += 1;
  if (profileAccessAllowed()) {
    if (hasUserOpened) refreshSavedChart();
    return;
  }
  clearAssistantForProfileRevocation();
}

function onProfileDataChange(): void {
  profileAccessGeneration += 1;
  clearPendingRetry();
  abortRequest();
  dismissPendingConsent?.();
  dismissPendingConsent = null;
  if (hasUserOpened) refreshSavedChart();
}

function onGuideStorageChange(event: StorageEvent): void {
  try {
    if (event.storageArea !== localStorage) return;
    if (event.key === null || event.key === PROFILE_KEY || event.key === ACCOUNT_V2_LOCAL_OWNER_KEY
      || event.key?.startsWith(`${ACCOUNT_V2_STORAGE_PREFIX}account.`)) onProfileDataChange();
  } catch {
    onProfileDataChange();
  }
}

function consentCard(
  headingText: string,
  bodyText: string,
  confirmText: string,
  cancelText: string,
  previewText?: string,
): { card: HTMLElement; promise: Promise<boolean>; dismiss: () => void } {
  const card = document.createElement('section');
  card.className = 'zassistant__consent';
  const heading = document.createElement('h3');
  heading.textContent = headingText;
  const body = document.createElement('p');
  body.textContent = bodyText;
  card.append(heading, body);
  if (previewText) {
    const preview = document.createElement('pre');
    preview.className = 'zassistant__consent-preview';
    preview.textContent = previewText;
    card.append(preview);
  }
  const actions = document.createElement('div');
  actions.className = 'zassistant__consent-actions';
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'zassistant__consent-confirm';
  confirm.textContent = confirmText;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'zassistant__consent-cancel';
  cancel.textContent = cancelText;
  actions.append(confirm, cancel);
  card.append(actions);
  transcript?.append(card);
  scrollTranscript();
  let settle!: (value: boolean) => void;
  const promise = new Promise<boolean>((resolve) => { settle = resolve; });
  let settled = false;
  const finish = (value: boolean) => {
    if (settled) return;
    settled = true;
    card.remove();
    settle(value);
  };
  confirm.addEventListener('click', () => finish(true));
  cancel.addEventListener('click', () => finish(false));
  confirm.focus();
  return { card, promise, dismiss: () => finish(false) };
}

async function requestCloudConsent(): Promise<boolean> {
  const state = getSession();
  if (state.cloudConsentGranted && state.consentPolicyVersion === CONSENT_POLICY_VERSION) return true;
  const copy = currentCopy();
  const card = consentCard(copy.cloudTitle, copy.cloudBody, copy.cloudConfirm, copy.cloudCancel);
  dismissPendingCloudConsent = card.dismiss;
  const granted = await card.promise;
  if (dismissPendingCloudConsent === card.dismiss) dismissPendingCloudConsent = null;
  if (granted) {
    state.cloudConsentGranted = true;
    state.consentPolicyVersion = CONSENT_POLICY_VERSION;
    saveSession();
  }
  return granted;
}

async function requestChartConsent(expectedGeneration = profileAccessGeneration): Promise<boolean> {
  if (!currentProfileAccessGeneration(expectedGeneration) || !profileAccessAllowed()) return false;
  if (chartConsented && chartEnabled) return true;
  const chart = savedChart;
  if (!chart || !transcript) return false;
  chartSummaryPromise ??= placementSummaryForChart(chart);
  const summary = await chartSummaryPromise;
  if (!summary || !currentProfileAccessGeneration(expectedGeneration)
    || !profileAccessAllowed() || savedChart !== chart) return false;
  const copy = currentCopy();
  const localLabel = chart.name.trim().slice(0, 120);
  const preview = `${localLabel ? `Selected self chart (kept on this device): ${localLabel}\n\n` : ''}${summary}`;
  const body = chart.birth.timeKnown ? copy.consentBody : copy.consentBodyNoTime;
  const card = consentCard(copy.consentTitle, body, copy.consentConfirm, copy.consentCancel, preview);
  dismissPendingConsent = card.dismiss;
  const granted = await card.promise;
  if (dismissPendingConsent === card.dismiss) dismissPendingConsent = null;
  const current = currentProfileAccessGeneration(expectedGeneration)
    && profileAccessAllowed() && savedChart === chart;
  if (current && granted) {
    chartConsented = true;
    chartEnabled = true;
    chartSourceId = uuid();
    invalidateContext(false);
  } else if (current) {
    chartConsented = false;
    chartEnabled = false;
  }
  syncSourceControls();
  return current && granted;
}

function appendSourcesRow(container: HTMLElement, text: string): void {
  const paths = [...new Set([...text.matchAll(/(?:^|[\s([])(\/(?!\/)[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?)/g)]
    .map((match) => match[1].endsWith('/') ? match[1] : `${match[1]}/`)
    .filter((path) => GUIDE_LINK_PATHS.has(path)))].slice(0, 4);
  if (!paths.length) return;
  const row = document.createElement('span');
  row.className = 'zassistant__sources';
  row.append(document.createTextNode(`${currentCopy().sources} `));
  paths.forEach((path, index) => {
    if (index) row.append(document.createTextNode(' · '));
    const anchor = document.createElement('a');
    anchor.href = path;
    anchor.textContent = path;
    row.append(anchor);
  });
  container.append(row);
}

function questionRequestsMyChart(question: string): boolean {
  const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(?:my (?:birth )?chart|mi carta(?: natal)?|meu mapa(?: natal)?|mon theme(?: natal)?|mio tema(?: natale)?)\b/.test(normalized);
}

async function buildTurnBody(
  question: string,
  ids: { turnId: string; operationId: string; attemptId: string; messageId: string },
  retryOfAttemptId: string | null,
  chartFacts?: string,
): Promise<{ body: Record<string, unknown>; history: GuideMessage[]; userMessage: GuideMessage }> {
  const state = getSession();
  const history = state.messages.filter((message) => message.sequence >= state.modelHistoryStartSequence).slice(-11);
  const attachments: GuideContextSource[] = [];
  if (currentPage && pageSourceEnabled()) {
    attachments.push(await localSource({
      sourceId: currentPage.sourceId,
      kind: 'site_page', sourceRevision: 1, title: currentPage.title, facts: currentPage.facts,
      subject: { boundary: 'public_reference', subjectId: currentPage.sourceId, subjectName: null, subjectIsUser: false },
      containsThirdPartyData: false, persistence: 'local_only',
    }));
  }
  const ownerChart = chartFacts && chartSourceId ? await localSource({
    sourceId: chartSourceId,
    kind: 'owner_chart', sourceRevision: 1, title: 'My chart', facts: chartFacts,
    subject: { boundary: 'root_user', subjectId: 'self', subjectName: 'You', subjectIsUser: true },
    containsThirdPartyData: false, persistence: 'local_only',
  }) : null;
  const skyFacts = todaySkyEnabled() ? await cachedTodaySkySummary() : null;
  const skySourceId = `sky:${localDate()}`;
  const todaySky = skyFacts ? await localSource({
    sourceId: skySourceId,
    kind: 'today_sky', sourceRevision: 1, title: "Today's sky", facts: skyFacts,
    subject: { boundary: 'public_reference', subjectId: skySourceId, subjectName: null, subjectIsUser: false },
    containsThirdPartyData: false, persistence: 'local_only',
  }) : null;
  const digest = await contextScopeDigest(history, ownerChart, todaySky, attachments);
  const now = new Date().toISOString();
  const userMessage: GuideMessage = {
    messageId: ids.messageId, turnId: ids.turnId, sequence: state.nextSequence,
    author: 'user', content: question, contextRevision: state.contextRevision,
    createdAt: now, generation: null,
  };
  return {
    history,
    userMessage,
    body: {
      schema: 'zodiacs.guide.ephemeral-turn.draft.v1',
      mode: 'ephemeral',
      conversationId: state.conversationId,
      turnId: ids.turnId,
      operationId: ids.operationId,
      attemptId: ids.attemptId,
      retryOfAttemptId,
      baseRevision: state.revision,
      contextEpoch: state.contextEpoch,
      clientAuthEpoch: 0,
      userMessage: { messageId: ids.messageId, content: question },
      consent: {
        purpose: 'guide_cloud_processing',
        policyVersion: CONSENT_POLICY_VERSION,
        consentRevision: 1,
        disclosureId: state.disclosureId,
        disclosedContextEpoch: state.contextEpoch,
        contextScopeDigest: digest,
      },
      ephemeralContext: {
        baseContext: {
          ownerChart: { slot: 'owner_chart', state: ownerChart ? 'active' : 'unavailable', source: ownerChart },
          todaySky: { slot: 'today_sky', state: todaySky ? 'active' : 'unavailable', source: todaySky },
        },
        attachments,
        history,
        modelHistoryStartSequence: state.modelHistoryStartSequence,
      },
    },
  };
}

async function runTurn(pending: PendingTurn): Promise<void> {
  // Consent, chart calculation, or a queued retry may have remained open over
  // local midnight or a time-zone change. Never send an old Guide-day body.
  if (rotateGuideDayIfNeeded()) {
    pending.userArticle.remove();
    pending.assistantArticle.remove();
    return;
  }
  if (pending.chartAuthority && !sameSelfChartAuthority(
    pending.chartAuthority,
    readSelectedSelfChart(),
  )) {
    pending.userArticle.remove();
    pending.assistantArticle.remove();
    refreshSavedChart();
    setStatus(currentCopy().contextUpdated);
    return;
  }
  const expectedGeneration = profileAccessGeneration;
  const request = new AbortController();
  activeRequest = request;
  pendingRetry = null;
  if (retryButton) retryButton.hidden = true;
  setBusy(true);
  pending.assistantArticle.setAttribute('aria-busy', 'true');
  if (!pending.assistantArticle.isConnected) transcript?.append(pending.assistantArticle);
  pending.assistantBody.textContent = '';
  pending.assistantArticle.classList.remove('is-partial', 'is-error');
  setStatus(currentCopy().thinking);
  let answer = '';
  const requestIsCurrent = () => currentProfileAccessGeneration(expectedGeneration) && activeRequest === request;
  const authorityTimer = pending.chartAuthority ? window.setInterval(() => {
    if (!sameSelfChartAuthority(pending.chartAuthority, readSelectedSelfChart())) onProfileDataChange();
  }, 250) : 0;
  try {
    const response = await fetch('/v1/guide/turn', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(pending.body), signal: request.signal,
    });
    if (!requestIsCurrent()) { await response.body?.cancel().catch(() => {}); return; }
    if (!response.ok) throw await failure(response);
    const completed = await consumeGuideStream(response, pending, (delta) => {
      if (!requestIsCurrent()) return;
      answer += delta;
      renderAssistantText(pending.assistantBody, answer);
      scrollTranscript();
    });
    if (!requestIsCurrent()) return;
    if (!completed.message.content.trim() || (answer && answer !== completed.message.content)) {
      throw new AssistantFailure('invalid_response', false, true);
    }
    renderAssistantText(pending.assistantBody, completed.message.content);
    appendSourcesRow(pending.assistantBody, completed.message.content);
    pending.assistantArticle.removeAttribute('aria-busy');
    const state = getSession();
    state.messages = [...state.messages, pending.userMessage, completed.message].slice(-MAX_MESSAGES);
    state.nextSequence = completed.message.sequence + 1;
    state.revision = completed.conversationRevision;
    saveSession();
    setStatus(currentCopy().complete);
    track('guide_reply');
  } catch (error) {
    if (!requestIsCurrent()) return;
    pending.assistantArticle.removeAttribute('aria-busy');
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    const guideFailure = error instanceof AssistantFailure ? error : new AssistantFailure('temporarily_unavailable');
    if (!answer) pending.assistantArticle.remove();
    else pending.assistantArticle.classList.add('is-partial');
    setStatus(aborted ? currentCopy().stopped : friendlyFailure(guideFailure.code));
    if (!aborted && guideFailure.retryable && !guideFailure.accepted && !answer) {
      pendingRetry = pending;
      if (retryButton) retryButton.hidden = false;
    }
  } finally {
    if (authorityTimer) window.clearInterval(authorityTimer);
    if (activeRequest === request) setBusy(false);
    if (currentProfileAccessGeneration(expectedGeneration) && root && !root.hidden) textarea?.focus();
  }
}

async function submitQuestion(): Promise<void> {
  if (!textarea || activeRequest || interactionPending) return;
  if (rotateGuideDayIfNeeded()) return;
  const question = textarea.value.trim();
  if (!question) { setStatus(currentCopy().empty); return; }
  interactionPending = true;
  syncSendState();
  syncSourceControls();
  const expectedGeneration = profileAccessGeneration;
  try {
    if (!await requestCloudConsent()) return;
    if (rotateGuideDayIfNeeded()) return;
    if (!currentProfileAccessGeneration(expectedGeneration)) return;
    let chartFacts: string | undefined;
    let chartAuthority: StoredChart | null = null;
    const wantsChart = Boolean(savedChart) && (chartEnabled || questionRequestsMyChart(question));
    if (wantsChart && !chartEnabled) {
      setStatus(currentCopy().chartReading);
      await requestChartConsent(expectedGeneration);
    }
    if (rotateGuideDayIfNeeded()) return;
    if (!currentProfileAccessGeneration(expectedGeneration)) return;
    if (chartEnabled && savedChart) {
      const current = readSelectedSelfChart();
      if (!sameSelfChartAuthority(savedChart, current)) {
        refreshSavedChart();
        setStatus(currentCopy().contextUpdated);
        return;
      }
      chartSummaryPromise ??= placementSummaryForChart(savedChart);
      chartFacts = (await chartSummaryPromise) ?? undefined;
      const currentAfterSummary = readSelectedSelfChart();
      if (!chartFacts || !sameSelfChartAuthority(savedChart, currentAfterSummary)) {
        refreshSavedChart();
        setStatus(currentCopy().contextUpdated);
        return;
      }
      chartAuthority = currentAfterSummary;
    }
    if (rotateGuideDayIfNeeded()) return;
    if (!currentProfileAccessGeneration(expectedGeneration)) return;
    const ids = { turnId: uuid(), operationId: uuid(), attemptId: uuid(), messageId: uuid() };
    const built = await buildTurnBody(question, ids, null, chartFacts);
    const user = appendMessage('user', question);
    const guide = appendMessage('guide', '');
    textarea.value = '';
    syncTextareaHeight();
    const pending: PendingTurn = {
      body: built.body, question, requestHistory: built.history, userMessage: built.userMessage,
      turnId: ids.turnId, attemptId: ids.attemptId, userArticle: user.article,
      assistantArticle: guide.article, assistantBody: guide.body,
      chartAuthority,
    };
    interactionPending = false;
    await runTurn(pending);
  } catch (error) {
    setStatus(friendlyFailure(error instanceof AssistantFailure ? error.code : 'temporarily_unavailable'));
  } finally {
    interactionPending = false;
    syncSendState();
    syncSourceControls();
  }
}

async function retryTurn(): Promise<void> {
  if (rotateGuideDayIfNeeded()) return;
  const prior = pendingRetry;
  if (!prior || activeRequest) return;
  const state = getSession();
  if (prior.body.contextEpoch !== state.contextEpoch || prior.body.baseRevision !== state.revision) {
    clearPendingRetry();
    setStatus(currentCopy().contextUpdated);
    return;
  }
  const nextAttemptId = uuid();
  const body = { ...prior.body, attemptId: nextAttemptId, retryOfAttemptId: prior.attemptId };
  await runTurn({ ...prior, body, attemptId: nextAttemptId });
}

function focusableControls(): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>('button:not([hidden]):not([disabled]), textarea:not([disabled]), a[href]')]
    .filter((element) => element.getClientRects().length > 0);
}

function closeAssistant(): void {
  if (!root || root.hidden) return;
  abortRequest();
  dismissPendingConsent?.();
  dismissPendingCloudConsent?.();
  root.hidden = true;
  document.documentElement.style.overflow = previousOverflow;
  launcher?.removeAttribute('aria-expanded');
  opener?.focus();
  opener = null;
}

function clearConversation(): void {
  abortRequest();
  const state = getSession();
  state.messages = [];
  state.nextSequence = 1;
  state.modelHistoryStartSequence = 1;
  state.revision += 1;
  state.contextRevision += 1;
  state.contextEpoch += 1;
  pendingRetry = null;
  saveSession();
  renderTranscript();
  setStatus();
  if (retryButton) retryButton.hidden = true;
}

function applyCopy(): void {
  const copy = currentCopy();
  if (title) title.textContent = copy.title;
  launcher?.setAttribute('aria-label', copy.open);
  const launcherLabel = launcher?.querySelector('span');
  if (launcherLabel) launcherLabel.textContent = copy.launcher;
  if (closeButton) closeButton.setAttribute('aria-label', copy.close);
  if (clearButton) clearButton.setAttribute('aria-label', copy.clear);
  if (intro) intro.textContent = copy.intro;
  if (sourcesRegion) sourcesRegion.setAttribute('aria-label', copy.context);
  if (pageSourceRemove) pageSourceRemove.setAttribute('aria-label', `${copy.removeSource}: ${copy.pageSource}`);
  if (pageSourceAdd) pageSourceAdd.textContent = `＋ ${copy.addPage}`;
  if (transcript) transcript.setAttribute('aria-label', copy.log);
  if (textarea) { textarea.setAttribute('aria-label', copy.input); textarea.placeholder = copy.placeholder; }
  if (sendButton) sendButton.textContent = copy.send;
  if (stopButton) stopButton.textContent = copy.stop;
  if (retryButton) retryButton.textContent = copy.retry;
  if (newlineHint) newlineHint.textContent = copy.newline;
  if (privacy) privacy.textContent = copy.privacy;
  syncSourceControls();
}

function removePageSource(): void {
  if (!currentPage || activeRequest || interactionPending) return;
  const state = getSession();
  if (!state.removedPageSourceIds.includes(currentPage.sourceId)) {
    state.removedPageSourceIds.push(currentPage.sourceId);
    state.removedPageSourceIds = state.removedPageSourceIds.slice(-20);
    invalidateContext(true);
  }
  syncSourceControls();
  setStatus(currentCopy().contextUpdated);
}

function addPageSource(): void {
  if (!currentPage || activeRequest || interactionPending) return;
  const state = getSession();
  state.removedPageSourceIds = state.removedPageSourceIds.filter((id) => id !== currentPage!.sourceId);
  invalidateContext(false, true);
  syncSourceControls();
  setStatus();
}

function toggleTodaySky(): void {
  if (activeRequest || interactionPending) return;
  const state = getSession();
  state.todaySkyRemoved = !state.todaySkyRemoved;
  // Removing cuts the source's influence on later answers, like other source
  // removals; re-adding widens the visible scope, so cloud consent renews.
  if (state.todaySkyRemoved) invalidateContext(true);
  else invalidateContext(false, true);
  syncSourceControls();
  setStatus(state.todaySkyRemoved ? currentCopy().contextUpdated : '');
}

function toggleChart(): void {
  if (activeRequest || interactionPending) return;
  if (chartEnabled) {
    chartEnabled = false;
    chartConsented = false;
    chartSourceId = null;
    invalidateContext(true);
    syncSourceControls();
    setStatus(currentCopy().contextUpdated);
    return;
  }
  interactionPending = true;
  syncSendState();
  syncSourceControls();
  const expectedGeneration = profileAccessGeneration;
  void requestChartConsent(expectedGeneration).finally(() => {
    interactionPending = false;
    syncSendState();
    syncSourceControls();
  });
}

function build(): void {
  root = document.createElement('div');
  root.className = 'zassistant';
  root.hidden = true;
  root.addEventListener('click', (event) => { if (event.target === root) closeAssistant(); });
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = focusableControls();
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  panel = document.createElement('div');
  panel.className = 'zassistant__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'zassistant-title');
  const header = document.createElement('header');
  header.className = 'zassistant__head';
  const headerIdentity = document.createElement('div');
  headerIdentity.className = 'zassistant__identity';
  title = document.createElement('h2');
  title.id = 'zassistant-title';
  title.className = 'zassistant__title';
  headerIdentity.append(createGuideAvatar('zassistant__avatar', 38), title);
  const headerActions = document.createElement('div');
  headerActions.className = 'zassistant__head-actions';
  clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'zassistant__clear';
  clearButton.textContent = '⌫';
  clearButton.addEventListener('click', clearConversation);
  closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'zassistant__close';
  closeButton.textContent = '✕';
  closeButton.addEventListener('click', closeAssistant);
  headerActions.append(clearButton, closeButton);
  header.append(headerIdentity, headerActions);
  intro = document.createElement('p');
  intro.className = 'zassistant__intro';
  sourcesRegion = document.createElement('div');
  sourcesRegion.className = 'zassistant__context';
  pageSourceChip = document.createElement('div');
  pageSourceChip.className = 'zassistant__source-chip';
  pageSourceText = document.createElement('span');
  pageSourceRemove = document.createElement('button');
  pageSourceRemove.type = 'button';
  pageSourceRemove.className = 'zassistant__source-remove';
  pageSourceRemove.textContent = '×';
  pageSourceRemove.addEventListener('click', removePageSource);
  pageSourceChip.append(pageSourceText, pageSourceRemove);
  pageSourceAdd = document.createElement('button');
  pageSourceAdd.type = 'button';
  pageSourceAdd.className = 'zassistant__source-add';
  pageSourceAdd.addEventListener('click', addPageSource);
  chartButton = document.createElement('button');
  chartButton.type = 'button';
  chartButton.className = 'zassistant__chart-chip';
  chartButton.hidden = true;
  chartButton.addEventListener('click', toggleChart);
  skyButton = document.createElement('button');
  skyButton.type = 'button';
  skyButton.className = 'zassistant__sky-chip';
  skyButton.addEventListener('click', toggleTodaySky);
  sourcesRegion.append(pageSourceChip, pageSourceAdd, skyButton, chartButton);
  transcript = document.createElement('div');
  transcript.className = 'zassistant__log';
  transcript.setAttribute('role', 'log');
  transcript.setAttribute('aria-live', 'polite');
  transcript.setAttribute('aria-relevant', 'additions text');
  status = document.createElement('p');
  status.className = 'zassistant__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  form = document.createElement('form');
  form.className = 'zassistant__form';
  form.addEventListener('submit', (event) => { event.preventDefault(); void submitQuestion(); });
  textarea = document.createElement('textarea');
  textarea.className = 'zassistant__input';
  textarea.rows = 2;
  textarea.maxLength = MAX_INPUT;
  textarea.autocomplete = 'off';
  textarea.spellcheck = true;
  textarea.addEventListener('input', () => { syncTextareaHeight(); syncSendState(); });
  textarea.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); form?.requestSubmit();
    }
  });
  const actions = document.createElement('div');
  actions.className = 'zassistant__actions';
  newlineHint = document.createElement('span');
  newlineHint.className = 'zassistant__hint mono';
  retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'zassistant__retry';
  retryButton.hidden = true;
  retryButton.addEventListener('click', () => void retryTurn());
  sendButton = document.createElement('button');
  sendButton.type = 'submit';
  sendButton.className = 'zassistant__send';
  sendButton.disabled = true;
  stopButton = document.createElement('button');
  stopButton.type = 'button';
  stopButton.className = 'zassistant__stop';
  stopButton.hidden = true;
  stopButton.addEventListener('click', abortRequest);
  actions.append(newlineHint, retryButton, sendButton, stopButton);
  form.append(textarea, actions);
  privacy = document.createElement('p');
  privacy.className = 'zassistant__privacy';
  panel.append(header, intro, sourcesRegion, transcript, status, form, privacy);
  root.append(panel);
  document.body.append(root);
  const shellLauncher = document.querySelector<HTMLButtonElement>('[data-guide-launcher]');
  if (shellLauncher) {
    // The privacy-neutral shell owns this listener and node. Adopting it keeps
    // the visible control stable and preserves focus restoration after the
    // drawer is loaded on demand.
    launcher = shellLauncher;
  } else {
    launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'zguide-launcher';
    launcher.dataset.guideLauncher = '';
    launcher.setAttribute('aria-label', currentCopy().open);
    const launcherLabel = document.createElement('span');
    launcherLabel.textContent = currentCopy().launcher;
    launcher.append(createGuideAvatar('zguide-launcher__avatar', 32), launcherLabel);
    launcher.addEventListener('click', () => void openAssistant(undefined, launcher));
    document.body.append(launcher);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root && !root.hidden) {
      event.preventDefault(); event.stopPropagation(); closeAssistant();
    }
  }, true);
  window.addEventListener('zodiacs:profile', onProfileDataChange);
  window.addEventListener('zodiacs:profile-access', onProfileAccessChange);
  window.addEventListener('storage', onGuideStorageChange);
  window.addEventListener('pagehide', suspendGuideForPageCache);
  window.addEventListener('pageshow', restoreGuideAfterPageCache);
}

/** Mount the default-visible launcher; Guide opens only on deliberate action. */
export async function bootstrapGuide(requestedLocale?: string): Promise<void> {
  await ensureStylesheet();
  locale = normalizeLocale(requestedLocale);
  getSession();
  if (!root) build();
  syncPageBoundary();
  applyCopy();
}

/** Open the Guide drawer. Safe to call repeatedly on the same page. */
export async function openAssistant(requestedLocale?: string, from?: HTMLElement | null): Promise<void> {
  await bootstrapGuide(requestedLocale);
  rotateGuideDayIfNeeded();
  await ensureGuideAuthFence();
  hasUserOpened = true;
  applyCopy();
  refreshSavedChart();
  renderTranscript();
  if (root!.hidden) {
    opener = from ?? (document.activeElement as HTMLElement | null);
    previousOverflow = document.documentElement.style.overflow;
  }
  root!.hidden = false;
  launcher?.setAttribute('aria-expanded', 'true');
  document.documentElement.style.overflow = 'hidden';
  setStatus();
  prefillFromOpener(from);
  textarea!.focus();
  track('guide_open');
}

/**
 * A quick-prompt opener may carry `data-assistant-prompt`. The text lands in
 * the visitor's own composer as an editable draft and nothing else: it is not
 * sent, not added to the page context, and never read from the URL or page
 * text (see `syncPageBoundary`). An existing draft is left alone.
 */
function prefillFromOpener(from?: HTMLElement | null): void {
  const prompt = from?.dataset?.assistantPrompt?.trim();
  if (!prompt || !textarea || textarea.value.trim()) return;
  textarea.value = prompt.slice(0, 280);
  syncTextareaHeight();
  syncSendState();
}
