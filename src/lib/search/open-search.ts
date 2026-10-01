/**
 * The site search dialog — plain DOM, no framework, loaded lazily from the
 * nav's loader script on first use (`/`, Cmd/Ctrl+K, or the nav button).
 * The index (/search-index.json, ~44 KB gz) is fetched once per session on
 * first open and ranked client-side; nothing the visitor types leaves the
 * page. English v1 — the index is EN-only by design (D9 froze ES).
 */
import { searchIndex, type SearchEntry } from './score';

const KIND_LABEL: Record<string, string> = {
  tool: 'Tool',
  sign: 'Sign',
  learn: 'Learn',
  term: 'Glossary',
  pairing: 'Pairing',
  horoscope: 'Horoscope',
  page: 'Page',
  astrofolio: 'Astrofolio',
  terminal: 'Terminal',
  registry: 'Registry',
};

let root: HTMLDivElement | null = null;
let input: HTMLInputElement | null = null;
let closeButton: HTMLButtonElement | null = null;
let list: HTMLUListElement | null = null;
let status: HTMLParagraphElement | null = null;
let opener: HTMLElement | null = null;
let entries: SearchEntry[] | null = null;
let results: SearchEntry[] = [];
let active = -1;

const track = (name: string, props: Record<string, string> = {}) => {
  (window as unknown as {
    zodiacsAnalytics?: { track?: (n: string, p: Record<string, string>) => void };
  }).zodiacsAnalytics?.track?.(name, props);
};

async function loadEntries(): Promise<SearchEntry[]> {
  if (entries) return entries;
  const res = await fetch('/search-index.json');
  if (!res.ok) throw new Error(`search index ${res.status}`);
  entries = (await res.json()) as SearchEntry[];
  return entries;
}

function signSlug(entry: SearchEntry): string | null {
  if (entry.kind !== 'sign') return null;
  return entry.path.replaceAll('/', '') || null;
}

function render(query: string) {
  if (!list || !status || !input) return;
  results = entries ? searchIndex(entries, query) : [];
  active = results.length ? 0 : -1;
  list.textContent = '';
  for (const [i, entry] of results.entries()) {
    const li = document.createElement('li');
    li.id = `zsearch-opt-${i}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === active));
    li.className = 'zsearch__opt' + (i === active ? ' is-active' : '');
    const slug = signSlug(entry);
    if (slug) {
      const img = document.createElement('img');
      img.src = `/assets/zodiac-icons/48/${slug}.webp`;
      img.alt = '';
      img.width = 22;
      img.height = 22;
      img.className = 'zsearch__icon';
      li.appendChild(img);
    }
    const text = document.createElement('span');
    text.className = 'zsearch__text';
    const title = document.createElement('span');
    title.className = 'zsearch__title';
    title.textContent = entry.title;
    const desc = document.createElement('span');
    desc.className = 'zsearch__desc';
    desc.textContent = entry.description;
    text.append(title, desc);
    const kind = document.createElement('span');
    kind.className = 'zsearch__kind mono';
    kind.textContent = KIND_LABEL[entry.kind] ?? entry.kind;
    li.append(text, kind);
    li.addEventListener('click', () => go(entry));
    list.appendChild(li);
  }
  const trimmed = query.trim();
  status.textContent = trimmed.length < 2
    ? 'Type to search tools, signs, guides, and the glossary.'
    : results.length === 0
      ? `Nothing matches “${trimmed}”.`
      : `${results.length} result${results.length === 1 ? '' : 's'}`;
  status.hidden = results.length > 0 && trimmed.length >= 2;
  input.setAttribute('aria-expanded', String(results.length > 0));
  input.setAttribute('aria-activedescendant', active >= 0 ? `zsearch-opt-${active}` : '');
}

function setActive(next: number) {
  if (!list || !results.length) return;
  active = (next + results.length) % results.length;
  for (const [i, li] of [...list.children].entries()) {
    li.setAttribute('aria-selected', String(i === active));
    li.classList.toggle('is-active', i === active);
    if (i === active) (li as HTMLElement).scrollIntoView({ block: 'nearest' });
  }
  input?.setAttribute('aria-activedescendant', `zsearch-opt-${active}`);
}

function go(entry: SearchEntry) {
  track('search_go', { kind: entry.kind });
  window.location.href = entry.path;
}

function close() {
  if (!root) return;
  root.hidden = true;
  document.documentElement.style.overflow = '';
  opener?.focus();
  opener = null;
}

function build() {
  root = document.createElement('div');
  root.className = 'zsearch';
  root.hidden = true;
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  const panel = document.createElement('div');
  panel.className = 'zsearch__panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Search the site');

  const head = document.createElement('div');
  head.className = 'zsearch__head';
  head.innerHTML = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.75" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5L13.5 13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

  input = document.createElement('input');
  input.className = 'zsearch__input';
  input.type = 'text';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'zsearch-list');
  input.setAttribute('aria-autocomplete', 'list');
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Search the site…';
  input.addEventListener('input', () => render(input!.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter' && active >= 0 && results[active]) { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      closeButton?.focus();
    }
  });

  const esc = document.createElement('kbd');
  esc.className = 'zsearch__esc mono';
  esc.textContent = 'esc';

  closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'zsearch__x';
  closeButton.setAttribute('aria-label', 'Close search');
  closeButton.textContent = '✕';
  closeButton.addEventListener('click', close);
  closeButton.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      input?.focus();
    }
  });

  head.append(input, esc, closeButton);

  list = document.createElement('ul');
  list.className = 'zsearch__list';
  list.id = 'zsearch-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Results');

  status = document.createElement('p');
  status.className = 'zsearch__status';
  status.setAttribute('role', 'status');

  const foot = document.createElement('p');
  foot.className = 'zsearch__foot mono';
  foot.textContent = window.matchMedia('(pointer: coarse)').matches ? 'Search tools, signs or astrology terms' : '↑↓ move · ↵ open · esc close';
  if (window.matchMedia('(pointer: coarse)').matches) esc.hidden = true;

  panel.append(head, list, status, foot);
  root.appendChild(panel);
  document.body.appendChild(root);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root && !root.hidden) { e.stopPropagation(); close(); }
  }, true);
}

/** Open the dialog (idempotent to call while open). */
export async function openSearch(from?: HTMLElement | null) {
  if (!root) build();
  opener = from ?? (document.activeElement as HTMLElement | null);
  root!.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  input!.value = '';
  input!.focus();
  track('search_open');
  try {
    await loadEntries();
  } catch {
    if (status) {
      status.hidden = false;
      status.textContent = 'Search is unavailable right now — check your connection and try again.';
    }
    return;
  }
  // Rank whatever was typed while the index was in flight — re-rendering
  // with '' here would wipe a fast typer's query.
  render(input!.value);
}
