/**
 * Lightweight, privacy-neutral Guide shell. This entry mounts only the
 * avatar-only launcher; the conversation drawer is fetched after a
 * deliberate user action.
 */
import './guide-bootstrap.css';
import {
  GUIDE_OPEN_PENDING_KEY,
  GUIDE_PRIVATE_SESSION_KEY,
} from './guide-loader.mjs';

export type AssistantLocale = 'en' | 'es' | 'pt' | 'fr' | 'it';

interface ShellCopy {
  open: string;
}

interface DrawerModule {
  openAssistant(locale?: string, from?: HTMLElement | null): Promise<void>;
}

const COPY: Record<AssistantLocale, ShellCopy> = {
  en: {
    open: 'Open Guide',
  },
  es: {
    open: 'Abrir Guide',
  },
  pt: {
    open: 'Abrir Guide',
  },
  fr: {
    open: 'Ouvrir Guide',
  },
  it: {
    open: 'Apri Guide',
  },
};

const STYLESHEET_HREF = '/assets/assistant-ui.css?v=icon-guide-5';
const DRAWER_MODULE_HREF = '/assets/assistant-drawer.js?v=icon-guide-5';
const GUIDE_AVATAR_SRC = '/assets/guide-avatar.webp';

let stylesheetPromise: Promise<void> | null = null;
let drawerModulePromise: Promise<DrawerModule> | null = null;
let launcher: HTMLButtonElement | null = null;
let locale: AssistantLocale = 'en';
let openersWired = false;
let portraitPromise: Promise<HTMLImageElement> | null = null;
let footerGuideObserver: IntersectionObserver | null = null;
let footerGuideVisible = false;

function safeSessionGet(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

/**
 * A tab that already loaded remote analytics gets a clean document before the
 * private drawer mounts. The reload is consumed by the tiny inline loader,
 * which reopens Guide after Base has skipped the provider for this tab.
 */
function beginPrivateTransition(): boolean {
  if (!document.documentElement.hasAttribute('data-guide-analytics-boundary')) return false;
  if (safeSessionGet(GUIDE_PRIVATE_SESSION_KEY) === '1') return false;
  try {
    sessionStorage.setItem(GUIDE_PRIVATE_SESSION_KEY, '1');
    sessionStorage.setItem(GUIDE_OPEN_PENDING_KEY, '1');
    location.reload();
  } catch {
    location.assign('/ask/#guide');
  }
  return true;
}

function normalizeLocale(value?: string): AssistantLocale {
  const candidate = (value ?? document.documentElement.lang).trim().toLowerCase();
  for (const released of ['en', 'es', 'pt', 'fr', 'it'] as const) {
    if (candidate === released || candidate.startsWith(`${released}-`)) return released;
  }
  return 'en';
}

function ensureStylesheet(): Promise<void> {
  if (stylesheetPromise) return stylesheetPromise;
  const existing = document.querySelector<HTMLLinkElement>(`link[href="${STYLESHEET_HREF}"]`);
  const link = existing ?? document.createElement('link');
  if (!existing) {
    link.rel = 'stylesheet';
    link.href = STYLESHEET_HREF;
    link.dataset.assistantStyles = 'shell';
    link.setAttribute('fetchpriority', 'low');
  }
  stylesheetPromise = new Promise((resolve) => {
    if (link.sheet) return resolve();
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
  });
  if (!existing) document.head.append(link);
  return stylesheetPromise;
}

function loadPortrait(): Promise<HTMLImageElement> {
  if (portraitPromise) return portraitPromise;
  portraitPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Guide portrait unavailable'));
    image.src = GUIDE_AVATAR_SRC;
  });
  return portraitPromise;
}

function paintPortrait(canvas: HTMLCanvasElement, size: number): void {
  const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(size * scale);
  canvas.height = Math.round(size * scale);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.scale(scale, scale);
  context.fillStyle = '#050506';
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  context.fill();
  const metal = context.createRadialGradient(size * 0.43, size * 0.38, 0, size / 2, size / 2, size * 0.27);
  metal.addColorStop(0, '#ffffff');
  metal.addColorStop(1, '#bfc3c9');
  context.fillStyle = metal;
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.26, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#111214';
  context.lineWidth = Math.max(1.5, size * 0.055);
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(size * 0.39, size * 0.66);
  context.lineTo(size * 0.61, size * 0.34);
  context.moveTo(size * 0.39, size * 0.66);
  context.lineTo(size * 0.53, size * 0.52);
  context.stroke();

  // Canvas is deliberately not an LCP image candidate. Once the small local
  // asset arrives, paint the exact user-supplied portrait into the same fixed
  // geometry without creating a model-visible or remotely fetched surface.
  void loadPortrait().then((image) => {
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, size, size);
    context.save();
    context.beginPath();
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(image, 0, 0, size, size);
    context.restore();
    canvas.dataset.guidePortrait = 'ready';
  }).catch(() => {});
}

function createPortrait(className: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.className = `zguide-shell-portrait ${className}`;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  paintPortrait(canvas, size);
  return canvas;
}

function currentCopy(): ShellCopy {
  return COPY[locale];
}

async function loadDrawer(): Promise<DrawerModule> {
  drawerModulePromise ??= import(DRAWER_MODULE_HREF) as Promise<DrawerModule>;
  try {
    return await drawerModulePromise;
  } catch (error) {
    drawerModulePromise = null;
    throw error;
  }
}

/** Backward-compatible public facade for legacy Guide openers. */
export async function openAssistant(
  requestedLocale?: string,
  from?: HTMLElement | null,
): Promise<void> {
  if (beginPrivateTransition()) return;
  await bootstrapGuide(requestedLocale);
  const restoreTarget = from?.isConnected ? from : launcher;
  const drawer = await loadDrawer();
  await drawer.openAssistant(requestedLocale ?? locale, restoreTarget);
}

function buildLauncher(): void {
  const existing = document.querySelector<HTMLButtonElement>('[data-guide-launcher]');
  if (existing) {
    launcher = existing;
    return;
  }
  launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'zguide-launcher';
  launcher.dataset.guideLauncher = '';
  launcher.setAttribute('aria-label', currentCopy().open);
  launcher.append(createPortrait('zguide-launcher__avatar', 32));
  launcher.addEventListener('click', () => void openAssistant(undefined, launcher));
  document.body.append(launcher);
}

function syncLauncherWithFooterGuide(): void {
  if (!launcher || footerGuideObserver) return;
  const footerGuide = document.querySelector<HTMLElement>('[data-footer-guide]');
  if (!footerGuide || typeof IntersectionObserver === 'undefined') return;
  const footerRegion = footerGuide.closest<HTMLElement>('.zfooter') ?? footerGuide;

  const updateLauncher = (): void => {
    if (!launcher) return;
    const keepForFocus = document.activeElement === launcher;
    launcher.toggleAttribute('data-footer-guide-visible', footerGuideVisible && !keepForFocus);
  };

  footerGuideObserver = new IntersectionObserver(([entry]) => {
    footerGuideVisible = Boolean(entry?.isIntersecting);
    updateLauncher();
  }, { threshold: 0 });
  footerGuideObserver.observe(footerRegion);
  launcher.addEventListener('focus', updateLauncher);
  launcher.addEventListener('blur', updateLauncher);
}

function wireOpeners(): void {
  if (openersWired) return;
  openersWired = true;
  document.querySelectorAll<HTMLElement>('[data-assistant-open]').forEach((button) => {
    button.dataset.guideWired = 'shell';
  });
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-assistant-open]')
      : null;
    if (!target || target === launcher) return;
    if (target instanceof HTMLAnchorElement
      && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    event.preventDefault();
    void openAssistant(target.dataset.assistantLocale, target);
  });
}

/** Mount the icon-only launcher. Guide opens only after deliberate user action. */
export async function bootstrapGuide(requestedLocale?: string): Promise<void> {
  locale = normalizeLocale(requestedLocale);
  await ensureStylesheet();
  buildLauncher();
  launcher?.setAttribute('aria-label', currentCopy().open);
  syncLauncherWithFooterGuide();
  wireOpeners();
}
