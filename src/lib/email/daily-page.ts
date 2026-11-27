import { SIGN_SLUGS } from '../signs.js';

function html(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function iconWheel(): string {
  return `<div class="signs" aria-hidden="true">${SIGN_SLUGS.map((sign) => (
    `<img src="/assets/zodiac-icons/48/${sign}.webp" width="28" height="28" alt="" loading="lazy" decoding="async">`
  )).join('')}</div>`;
}

export function dailyEmailPage(
  title: string,
  body: string,
  action?:
    | {
      kind?: 'form';
      action: string;
      token: string;
      label: string;
      decision?: string;
      secondary?: { label: string; decision: string };
    }
    | { kind: 'link'; href: string; label: string; secondary?: { href: string; label: string } },
): string {
  const actionMarkup = action && action.kind === 'link'
    ? `<p class="return"><a href="${html(action.href)}">${html(action.label)}</a></p>${action.secondary ? `<p class="return"><a href="${html(action.secondary.href)}">${html(action.secondary.label)}</a></p>` : ''}`
    : action
      ? [
        `<form method="post" action="${html(action.action)}"><input type="hidden" name="token" value="${html(action.token)}">${action.decision ? `<input type="hidden" name="decision" value="${html(action.decision)}">` : ''}<button type="submit">${html(action.label)}</button></form>`,
        action.secondary
          ? `<form class="secondary" method="post" action="${html(action.action)}"><input type="hidden" name="token" value="${html(action.token)}"><input type="hidden" name="decision" value="${html(action.secondary.decision)}"><button type="submit">${html(action.secondary.label)}</button></form>`
          : '',
      ].join('')
      : '<p class="return"><a href="/">Return to Zodiacs.org</a></p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${html(title)}</title><style>@font-face{font-family:'Instrument Sans';src:url('/fonts/instrument-sans-latin-wght-normal.woff2') format('woff2-variations');font-weight:400 700;font-display:swap}@font-face{font-family:'EB Garamond';src:url('/fonts/eb-garamond-latin-500-normal.woff2') format('woff2');font-weight:500;font-display:swap}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#060709;color:#EEF1F7;font:16px/1.6 'Instrument Sans',system-ui,sans-serif}.card{width:min(560px,calc(100% - 40px));box-sizing:border-box;padding:clamp(28px,7vw,56px);border:1px solid rgba(198,204,218,.16);border-radius:22px;background:#0F121A;text-align:center}.signs{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin:0 auto 24px;max-width:220px}.signs img{border-radius:50%}h1{margin:0 0 12px;font:500 clamp(2rem,7vw,3rem)/1.05 'EB Garamond',Georgia,serif}p{margin:0;color:#C6CCDA}form,.return{margin-top:24px}.secondary{margin-top:12px}button,a{font:600 14px/1 'Instrument Sans',system-ui,sans-serif}button{padding:12px 18px;border:1px solid #C6CCDA;border-radius:999px;background:#EEF1F7;color:#060709;cursor:pointer}.secondary button{padding:4px;border:0;border-radius:0;background:transparent;color:#EEF1F7;text-decoration:underline;text-underline-offset:3px}a{color:#EEF1F7}</style></head><body><main class="card">${iconWheel()}<h1>${html(title)}</h1><p>${html(body)}</p>${actionMarkup}</main></body></html>`;
}
