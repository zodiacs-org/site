/**
 * The compatibility hub's pairing library, led by the visitor's remembered
 * Sun sign (`my-sign.ts`, kept on this device only). Inline on the page,
 * right after the library, so it runs before first paint: the remembered
 * sign's row moves to the top, lists all twelve partners in zodiac order and
 * is named as "your sign", so the visitor only picks the other sign. The
 * library is closed when the page loads, so nothing visible moves.
 *
 * It never overrides a choice: a pairing carried in the address
 * (`?sign1=&sign2=`) leaves the library as published, and nothing is done
 * when no sign is remembered. New links are clones of the page's own pair
 * links, so they keep the page's scoped styles.
 */
import { MY_SIGN_KEY } from './my-sign';

export const COMPAT_MY_SIGN_COPY = {
  yours: ', your sign',
  note: 'Starting with {sign}, your sign. Plain-language guides, without a score',
} as const;

export const COMPAT_MY_SIGN_SCRIPT = `(function () {
  var mine = null;
  try { mine = localStorage.getItem(${JSON.stringify(MY_SIGN_KEY)}); } catch (e) { return; }
  if (!mine || !/^[a-z]+$/.test(mine)) return;
  if (/[?&]sign[12]=/.test(location.search)) return;
  var index = document.querySelector('[data-compat-index]');
  if (!index) return;
  var rows = index.querySelectorAll('[data-sign]');
  var row = null;
  var before = [];
  for (var i = 0; i < rows.length; i += 1) {
    if (rows[i].getAttribute('data-sign') === mine) { row = rows[i]; break; }
    before.push(rows[i]);
  }
  if (!row) return;
  var list = row.querySelector('[data-pairs]');
  var first = list && list.firstElementChild;
  if (!first) return;
  for (var j = 0; j < before.length; j += 1) {
    var link = first.cloneNode(false);
    link.setAttribute('href', '/compatibility/' + before[j].getAttribute('data-sign') + '-' + mine + '/');
    link.textContent = before[j].getAttribute('data-name');
    list.insertBefore(link, first);
  }
  var name = row.getAttribute('data-name');
  var label = row.querySelector('[data-sign-name]');
  if (label) label.textContent = name + ${JSON.stringify(COMPAT_MY_SIGN_COPY.yours)};
  row.classList.add('is-mine');
  if (index.firstElementChild !== row) index.insertBefore(row, index.firstElementChild);
  var note = document.querySelector('[data-compat-library-note]');
  if (note) note.textContent = ${JSON.stringify(COMPAT_MY_SIGN_COPY.note)}.replace('{sign}', name);
})();`;
