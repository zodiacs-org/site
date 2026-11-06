import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { COMPAT_MY_SIGN_SCRIPT } from './compat-my-sign';
import { MY_SIGN_KEY } from './my-sign';
import { pairSlug } from './compat';
import { SIGNS } from './signs';

/** Just enough of the DOM for the inline script: elements, attributes and order. */
class FakeElement {
  attrs = new Map<string, string>();
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  classes = new Set<string>();
  text = '';
  constructor(attrs: Record<string, string> = {}, children: FakeElement[] = [], text = '') {
    for (const [key, value] of Object.entries(attrs)) this.attrs.set(key, value);
    for (const child of children) this.appendChild(child);
    this.text = text;
  }
  get classList() { return { add: (name: string) => { this.classes.add(name); } }; }
  get firstElementChild() { return this.children[0] ?? null; }
  get textContent() { return this.text; }
  set textContent(value: string) { this.text = value; }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  appendChild(child: FakeElement) { return this.insertBefore(child, null); }
  insertBefore(child: FakeElement, ref: FakeElement | null) {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
    const at = ref ? this.children.indexOf(ref) : this.children.length;
    this.children.splice(at < 0 ? this.children.length : at, 0, child);
    child.parent = this;
    return child;
  }
  cloneNode() { return new FakeElement(Object.fromEntries(this.attrs)); }
  all(): FakeElement[] { return this.children.flatMap((child) => [child, ...child.all()]); }
  querySelectorAll(selector: string) {
    const name = /^\[([a-z-]+)\]$/.exec(selector)?.[1];
    if (!name) throw new Error(`unsupported selector ${selector}`);
    return this.all().filter((element) => element.attrs.has(name));
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
}

function hubLibrary() {
  const note = new FakeElement({ 'data-compat-library-note': '' }, [], 'Plain-language guides, without a score');
  const index = new FakeElement({ 'data-compat-index': '' }, SIGNS.map((a, i) => new FakeElement(
    { 'data-sign': a.slug, 'data-name': a.name, class: 'compat-row' },
    [
      new FakeElement({ 'data-sign-name': '' }, [], a.name),
      new FakeElement({ 'data-pairs': '' }, SIGNS.slice(i).map((b) => new FakeElement(
        { class: 'compat-row__pair', 'data-astro-cid-x': '', href: `/compatibility/${pairSlug(a.slug, b.slug)}/` }, [], b.name,
      ))),
    ],
  )));
  const document = new FakeElement({}, [note, index]);
  return { document, index, note };
}

function run(stored: string | null, search = '', throws = false) {
  const page = hubLibrary();
  const localStorage = {
    getItem: (key: string) => {
      if (throws) throw new Error('blocked');
      return key === MY_SIGN_KEY ? stored : null;
    },
  };
  new Function('document', 'localStorage', 'location', COMPAT_MY_SIGN_SCRIPT)(page.document, localStorage, { search });
  return page;
}

const order = (index: FakeElement) => index.children.map((row) => row.getAttribute('data-sign'));
const pairs = (row: FakeElement) => row.querySelector('[data-pairs]')!.children;

describe('compatibility hub: the remembered sign leads the pairing library', () => {
  it('puts the remembered sign first with all twelve partners, so only the other sign is picked', () => {
    const { index, note } = run('leo');
    const row = index.children[0];
    expect(row.getAttribute('data-sign')).toBe('leo');
    expect(row.classes.has('is-mine')).toBe(true);
    expect(row.querySelector('[data-sign-name]')!.textContent).toBe('Leo, your sign');
    expect(pairs(row).map((link) => link.textContent)).toEqual(SIGNS.map((sign) => sign.name));
    expect(pairs(row).map((link) => link.getAttribute('href')))
      .toEqual(SIGNS.map((sign) => `/compatibility/${pairSlug('leo', sign.slug)}/`));
    // Clones keep the page's scoped style hook and class.
    for (const link of pairs(row)) {
      expect(link.getAttribute('class')).toBe('compat-row__pair');
      expect(link.attrs.has('data-astro-cid-x')).toBe(true);
    }
    expect(note.textContent).toBe('Starting with Leo, your sign. Plain-language guides, without a score');
    // The other rows keep their published links, in their order.
    expect(order(index)).toEqual(['leo', ...SIGNS.map((s) => s.slug).filter((slug) => slug !== 'leo')]);
    expect(pairs(index.children[1]).length).toBe(12);
    expect(index.children.reduce((sum, r) => sum + pairs(r).length, 0)).toBe(78 + 4);
  });

  it('works for the first and the last sign', () => {
    const aries = run('aries');
    expect(order(aries.index)[0]).toBe('aries');
    expect(pairs(aries.index.children[0]).length).toBe(12);
    const pisces = run('pisces');
    expect(order(pisces.index)[0]).toBe('pisces');
    expect(pairs(pisces.index.children[0]).map((link) => link.getAttribute('href'))[0]).toBe('/compatibility/aries-pisces/');
    expect(pairs(pisces.index.children[0]).length).toBe(12);
  });

  it('leaves the library as published without a remembered sign, with a bad value or blocked storage', () => {
    for (const page of [run(null), run('ophiuchus'), run('<b>leo</b>'), run('leo', '', true)]) {
      expect(order(page.index)).toEqual(SIGNS.map((s) => s.slug));
      expect(page.note.textContent).toBe('Plain-language guides, without a score');
      expect(page.index.children.some((row) => row.classes.size > 0)).toBe(false);
    }
  });

  it('never overrides a pairing carried in the address', () => {
    for (const search of ['?sign1=aries&sign2=leo', '?x=1&sign2=leo']) {
      const page = run('leo', search);
      expect(order(page.index)).toEqual(SIGNS.map((s) => s.slug));
      expect(pairs(page.index.children[4]).length).toBe(8);
    }
  });

  it('is inlined on the English hub, after the library, with the hooks it reads', () => {
    const page = readFileSync(new URL('../pages/compatibility/index.astro', import.meta.url), 'utf8');
    expect(page).toMatch(/<script is:inline set:html=\{COMPAT_MY_SIGN_SCRIPT\} \/>/u);
    expect(page.indexOf('COMPAT_MY_SIGN_SCRIPT} />')).toBeGreaterThan(page.indexOf('</details>'));
    for (const hook of ['data-compat-index', 'data-sign={a.slug}', 'data-name={a.name}', 'data-sign-name', 'data-pairs', 'data-compat-library-note']) {
      expect(page).toContain(hook);
    }
  });

  it('has no em or en dashes in its copy', () => {
    expect(COMPAT_MY_SIGN_SCRIPT).not.toMatch(/[–—]/u);
  });
});
