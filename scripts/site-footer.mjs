const SIGNS = [
  ['aries', 'Aries'], ['taurus', 'Taurus'], ['gemini', 'Gemini'],
  ['cancer', 'Cancer'], ['leo', 'Leo'], ['virgo', 'Virgo'],
  ['libra', 'Libra'], ['scorpio', 'Scorpio'], ['sagittarius', 'Sagittarius'],
  ['capricorn', 'Capricorn'], ['aquarius', 'Aquarius'], ['pisces', 'Pisces'],
];

const DEFAULT_EXPLORE = [
  ['/', 'Astrology'],
  ['/astrofolio/', 'Astrofolio'],
  ['/registry/', 'Official Registry'],
  ['/thesis/', 'Thesis'],
  ['/archive/', 'Archive'],
];

const DEFAULT_TRUST = [
  ['/astrofolio/#verify', 'Verify a token'],
  ['/registry/technical/', 'Methodology'],
  ['/disclosure/', 'Disclosure'],
  ['/sdk/', 'SDK'],
];

const CHANNELS = [
  ['https://x.com/astrofoliosol', 'X'],
  ['https://www.instagram.com/astrofolioonsol/', 'Instagram'],
  ['https://tiktok.com/@astrofolio', 'TikTok'],
  ['https://t.me/astrofoliosol', 'Telegram'],
];
const FOOTER_YEAR = new Date().getUTCFullYear();

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderLinks(links, external = false) {
  return links.map(([href, label]) => (
    `<a href="${esc(href)}"${external ? ' rel="noopener noreferrer"' : ''}>${esc(label)}</a>`
  )).join('');
}

export const SITE_FOOTER_STYLESHEET = '<link rel="stylesheet" href="/assets/site-footer.css?v=20261003" />';

export function renderStaticFooter({
  tagline = 'The official public Registry of the Twelve.',
  exploreLinks = DEFAULT_EXPLORE,
  trustLinks = DEFAULT_TRUST,
  established = null,
  originHref = '/disclosure/#origin',
  originLabel = 'Origin receipts',
} = {}) {
  const originLine = established
    ? `<p>Registry record: Zodiac assets originated <span data-registry-established>${esc(established)}</span> · <a href="${esc(originHref)}">${esc(originLabel)}</a></p>`
    : '';

  return `<footer class="zfooter zfooter--static">
  <div class="zfooter__inner">
    <div class="zfooter__lead">
      <div>
        <a class="zfooter__brand" href="/">
          <img class="zfooter__brand-mark" src="/assets/app-icons/v3/favicon.svg" width="26" height="26" alt="" loading="lazy" decoding="async" />
          <span class="zfooter__brand-name">Zodiacs</span><span class="zfooter__brand-tld">.org</span>
        </a>
        <p class="zfooter__tag">${esc(tagline)}</p>
      </div>
      <button class="zfooter__guide" type="button" data-assistant-open data-footer-guide aria-haspopup="dialog">
        <img src="/assets/guide-avatar.webp" width="32" height="32" alt="" loading="lazy" decoding="async" />
        <span>Guide</span>
      </button>
    </div>

    <div class="zfooter__directory">
      <nav class="zfooter__group" aria-label="Explore">
        <details class="zfooter__fold" open data-footer-essential><summary class="zfooter__fold-label"><span class="zfooter__label">Explore</span></summary>
        <div class="zfooter__links">${renderLinks(exploreLinks)}</div>
      </details></nav>
      <nav class="zfooter__group" aria-label="Trust and policies">
        <details class="zfooter__fold" open><summary class="zfooter__fold-label"><span class="zfooter__label">Trust</span></summary>
        <div class="zfooter__links">${renderLinks(trustLinks)}</div>
      </details></nav>
      <nav class="zfooter__group zfooter__group--wide" aria-label="Official channels">
        <details class="zfooter__fold" open><summary class="zfooter__fold-label"><span class="zfooter__label">Follow</span></summary>
        <div class="zfooter__links">${renderLinks(CHANNELS, true)}</div>
      </details></nav>
      <nav class="zfooter__group zfooter__twelve" aria-label="The twelve zodiac signs">
        <span class="zfooter__label">The Twelve</span>
        <div class="zfooter__signs">
          ${SIGNS.map(([slug, name]) => `<a class="zfooter__sign" href="/${slug}/" aria-label="${name}" title="${name}"><img src="/assets/zodiac-icons/48/${slug}.webp?surface=site-footer" width="25" height="25" alt="" loading="lazy" decoding="async" /><span class="zfooter__visually-hidden">${name}</span></a>`).join('')}
        </div>
      </nav>
    </div>

    <div class="zfooter__language">
      <span class="zfooter__label" id="static-footer-language-label">Language</span>
      <nav class="zfooter__locales" aria-labelledby="static-footer-language-label">
        <span class="zfooter__locale" lang="en" aria-current="page">English</span>
        <a class="zfooter__locale" href="/es/" hreflang="es" lang="es">Español</a>
        <a class="zfooter__locale" href="/pt/" hreflang="pt-BR" lang="pt-BR">Português (Brasil)</a>
        <a class="zfooter__locale" href="/fr/" hreflang="fr" lang="fr">Français</a>
        <a class="zfooter__locale" href="/it/" hreflang="it" lang="it">Italiano</a>
      </nav>
    </div>

    <div class="zfooter__colophon">
      <p class="zfooter__copyright">© ${FOOTER_YEAR} Zodiacs.org</p>
      <nav class="zfooter__meta" aria-label="Legal">
        <span class="zfooter__label">Legal</span>
        <div class="zfooter__meta-links"><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></div>
      </nav>
      <nav class="zfooter__meta" aria-label="More">
        <span class="zfooter__label">More</span>
        <div class="zfooter__meta-links"><a href="/widgets/">Widgets</a><a href="/feeds/horoscopes.xml">RSS</a></div>
      </nav>
      <div class="zfooter__meta zfooter__credits">
        <span class="zfooter__label">Data &amp; licenses</span>
        <p>Place data: <a href="https://www.geonames.org/" rel="noopener noreferrer">GeoNames</a> · CC BY 4.0</p>
        <p>Typefaces licensed under <a href="/fonts/OFL-instrument-sans.txt">SIL OFL 1.1</a></p>
${originLine ? `        ${originLine}\n` : ''}
      </div>
    </div>
  </div>
</footer><script>(function () { var mobile = window.matchMedia('(max-width: 620px)'); var groups = document.querySelectorAll('.zfooter__fold:not([data-footer-essential])'); var sync = function () { groups.forEach(function (group) { group.open = !mobile.matches; }); }; sync(); mobile.addEventListener && mobile.addEventListener('change', sync); })();</script>`;
}
