/*
 * What the privacy and terms pages must and must not say, approved by the
 * owner on 20 November 2026 (card t826s5023), and for the translated privacy
 * pages the same day (confirmed 19:02):
 *
 * - /privacy/ names the extra script a chart without a birth time loads, says
 *   which pages load Plausible, and heads its assistant section with a plain
 *   name instead of "AI integration candidates".
 * - /privacy/ and /terms/ no longer carry the Registry's wallet, address
 *   lookup, market-data and purchase disclosures. The same lookup details now
 *   live in the address-lookup section on every locale's /disclosure/ page.
 * - The five translated privacy pages (es, fr, it, pt, ru) say the same about
 *   the no-birth-time script and Plausible in their own words, and carry none
 *   of those disclosures either. They have no assistant section, and there is
 *   no translated terms page.
 *
 * scripts/check-dist.mjs runs legalPageProblems over the built pages (the
 * <main> element only, so the shared navigation and footer are not read), and
 * scripts/legal-pages-copy.test.mjs runs it over the Astro sources.
 */

const PRIVACY_REQUIRED = Object.freeze([
  'id="ai-integrations"',
  '>The Zodiacs app</h2>',
  'a file of historical clock changes chosen by the birthplace’s time zone',
  'when no birth time is given, one more script, which shows our host only that no time was entered',
  'None of these requests goes to any other service.',
  'load Plausible, the site’s analytics',
  'href="/about/"',
  'Plausible, a cookieless analytics service',
]);

const PRIVACY_FORBIDDEN = Object.freeze([
  'AI integration candidates',
  'public-sky ChatGPT candidate',
  'hosted candidate',
  'Cabinet of Twelve',
  'public wallet',
  'Wallet Chart',
  'blockchain',
  'PublicNode',
  'Allnodes',
  'Etherscan',
  'Solana',
  'Dex Screener',
  'GeckoTerminal',
  'market data',
  'market-data',
  'Public Astrofolio, Terminal, and Registry data sources',
  'Aura browser storage',
  'Remember this address on this device',
  'remembered Aura',
  'Aura session data',
  'does not connect wallets',
  'Purchase links',
  'purchase',
  'wallet software',
  'wallet connection',
]);

const TERMS_REQUIRED = Object.freeze([
  '>What this site is</h2>',
  '>Free use</h2>',
  '>Accounts</h2>',
  '>Acceptable use</h2>',
  '>Accuracy and availability</h2>',
  '>Limitation of liability</h2>',
  '>Content and intellectual property</h2>',
  '>Changes</h2>',
  '>Operator and applicable law</h2>',
  '>Contact</h2>',
]);

const TERMS_FORBIDDEN = Object.freeze([
  'Cabinet of Twelve',
  'public addresses',
  'Public address lookups',
  'means in the Registry',
  '“official,”',
  'Digital-asset risks',
  'Digital assets can be',
  'does not connect wallets',
  'request signatures',
  'submit transactions',
  'Purchase links',
  'purchase links',
  'Blockchain transactions',
  'total loss',
  'solicitation',
  'operator attestation',
  'href="/disclosure/"',
]);

// Names and markers that no translated privacy page carries any more, in any
// language: the Registry features, their data providers, and the wallet notice.
const LOCALIZED_PRIVACY_FORBIDDEN = Object.freeze([
  'Cabinet of Twelve',
  'Wallet Chart',
  'PublicNode',
  'Allnodes',
  'Etherscan',
  'Solana',
  'Dex Screener',
  'GeckoTerminal',
  'blockchain',
  'trustWalletNotice',
  'Remember this address',
  'Forget address',
]);

/** Each translated privacy page's own required and forbidden phrases. */
const LOCALIZED_PRIVACY = Object.freeze({
  es: {
    required: [
      'un archivo de cambios históricos de hora elegido según la zona horaria del lugar de nacimiento',
      'cuando no se indica la hora de nacimiento, un script más, que solo muestra a nuestro proveedor de alojamiento que no se introdujo ninguna hora',
      'Ninguna de estas solicitudes va a otro servicio.',
      'ningún script de analítica',
      'cargan Plausible, la analítica del sitio, descrita en «Alojamiento, registros y analítica»',
      'Plausible, un servicio de analítica sin cookies',
    ],
    forbidden: [
      'dirección pública de billetera',
      'direcciones públicas de billetera',
      'datos de mercado',
      'enlaces de compra',
      'conexión de billetera',
      'software de billetera',
      'no conecta billeteras',
      'datos de sesión limitados de Aura',
      'dirección de Aura recordada',
      'Recordar esta dirección',
    ],
  },
  fr: {
    required: [
      'un fichier des changements d’heure historiques, choisi d’après le fuseau horaire du lieu de naissance',
      'quand aucune heure de naissance n’est indiquée, un script de plus, qui montre seulement à notre hébergeur qu’aucune heure n’a été saisie',
      'Aucune de ces requêtes n’est adressée à un autre service.',
      'aucun script d’analyse d’audience',
      'chargent Plausible, l’outil d’analyse d’audience du site, décrit dans « Hébergement, journaux et analyse d’audience »',
      'Plausible, un service d’analyse d’audience sans cookies',
    ],
    forbidden: [
      'adresse publique de portefeuille',
      'adresses publiques de portefeuille',
      'données de marché',
      'liens d’achat',
      'connexion de portefeuille',
      'logiciel de portefeuille',
      'ne connecte pas de portefeuilles',
      'données de session Aura',
      'adresse Aura mémorisée',
    ],
  },
  it: {
    required: [
      'un file con i cambi d’ora storici, scelto in base al fuso orario del luogo di nascita',
      'quando non indichi l’ora di nascita, uno script in più, che mostra al nostro hosting solo che non è stata inserita nessuna ora',
      'Nessuna di queste richieste va a un altro servizio.',
      'alcuno script di analisi',
      'caricano Plausible, il servizio di analisi del sito, descritto in «Hosting, log e analisi»',
      'con Plausible, un servizio di analisi senza cookie',
    ],
    forbidden: [
      'indirizzo pubblico del wallet',
      'indirizzi pubblici di wallet',
      'indirizzi pubblici dei wallet',
      'dati di mercato',
      'link di acquisto',
      'collegamento di un wallet',
      'software di un wallet',
      'non collega wallet',
      'dati di sessione di Aura',
      'indirizzo Aura memorizzato',
    ],
  },
  pt: {
    required: [
      'um arquivo de mudanças históricas de horário, escolhido pelo fuso horário do local de nascimento',
      'quando nenhuma hora de nascimento é informada, mais um script, que mostra ao nosso provedor de hospedagem apenas que nenhuma hora foi informada',
      'Nenhuma dessas solicitações vai para outro serviço.',
      'nenhum script de análise de uso',
      'carregam o Plausible, a análise de uso do site, descrita em “Hospedagem, registros e análise de uso”',
      'Plausible, um serviço de análise sem cookies',
    ],
    forbidden: [
      'endereço público de carteira',
      'endereços públicos de carteira',
      'dados de mercado',
      'links de compra',
      'conexão de carteira',
      'software de carteira',
      'não conecta carteiras',
      'sessão limitados do Aura',
      'endereço do Aura lembrado',
    ],
  },
  ru: {
    required: [
      'файл с историей переводов часов, выбранный по часовому поясу места рождения',
      'а если время рождения не указано, ещё один скрипт, по которому нашему хостингу видно только то, что время не было введено',
      'Ни один из этих запросов не уходит в другие сервисы.',
      'скрипт аналитики',
      'загружают Plausible, аналитику сайта, описанную в разделе «Хостинг, журналы и аналитика»',
      'с помощью Plausible',
    ],
    forbidden: [
      'публичный адрес кошелька',
      'публичные адреса кошельков',
      'публичных адресов кошельков',
      'рыночных данных',
      'рыночные данные',
      'подключения кошелька',
      'программного обеспечения кошелька',
      'не подключает кошельки',
      'данные сессии Aura',
      'запомненный адрес Aura',
      'блокчейн',
    ],
  },
});

/** The translated privacy pages, in the order the site lists its locales. */
export const LOCALIZED_PRIVACY_PATHS = Object.freeze(Object.keys(LOCALIZED_PRIVACY).map((locale) => `/${locale}/privacy/`));

/** Each page's rules. */
export const LEGAL_PAGE_RULES = Object.freeze({
  '/privacy/': Object.freeze({ required: PRIVACY_REQUIRED, forbidden: PRIVACY_FORBIDDEN }),
  '/terms/': Object.freeze({ required: TERMS_REQUIRED, forbidden: TERMS_FORBIDDEN }),
  ...Object.fromEntries(Object.entries(LOCALIZED_PRIVACY).map(([locale, rules]) => [
    `/${locale}/privacy/`,
    Object.freeze({
      required: Object.freeze([...rules.required]),
      forbidden: Object.freeze([...LOCALIZED_PRIVACY_FORBIDDEN, ...rules.forbidden]),
    }),
  ])),
});

const NAMED = { amp: '&', apos: '’', quot: '"', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', nbsp: ' ' };

/**
 * One comparable string from built HTML or an Astro source: entities decoded,
 * straight apostrophes curled (Astro escapes them in expressions, and the
 * sources write both), and whitespace collapsed. Markup is kept, so a rule can
 * name an attribute or a closing tag.
 */
export function normalizeLegalHtml(html) {
  return html
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (entity, body) => {
      if (body[0] === '#') {
        const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));
        return String.fromCodePoint(code);
      }
      return NAMED[body.toLowerCase()] ?? entity;
    })
    .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
    .replace(/\s+/gu, ' ');
}

/** The <main> element of a built page, where the page's own copy is. */
export function mainOf(html) {
  const match = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/u);
  return match ? match[1] : '';
}

/** Problems with one page's copy; an empty list means it holds. */
export function legalPageProblems(path, html) {
  const rules = LEGAL_PAGE_RULES[path];
  if (!rules) throw new Error(`legal-pages-copy: no rules for ${path}`);
  const text = normalizeLegalHtml(html);
  const problems = [];
  for (const phrase of rules.required) {
    if (!text.includes(phrase)) problems.push(`${path}: missing ${JSON.stringify(phrase)}`);
  }
  for (const phrase of rules.forbidden) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) problems.push(`${path}: still carries ${JSON.stringify(phrase)}`);
  }
  return problems;
}
