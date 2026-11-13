// Print one sign's localized horoscope periods to the terminal, for review.
//   npx vite-node --script scripts/locale-expansion/print-period.ts es leo
import { HOROSCOPE_MODULES } from '../../src/lib/locale-expansion/horoscope/modules';
import { localizedMonthlyReading, localizedPeriodReading, PERIOD_SURFACES } from '../../src/lib/locale-expansion/horoscope/engine';
import { expansionMonth } from '../../src/lib/locale-expansion/horoscope/month';

const [locale = 'es', sign = 'leo'] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const mod = HOROSCOPE_MODULES[locale as keyof typeof HOROSCOPE_MODULES];
if (!mod) throw new Error(`no horoscope module for ${locale}`);
for (const surface of PERIOD_SURFACES) {
  const reading = localizedPeriodReading(mod, sign as never, surface);
  console.log(`\n===== ${surface}: ${mod.chrome.title('X', { surface, from: reading.from, through: reading.through })}`);
  for (const passage of reading.passages) console.log(`${passage.heading ? `[${passage.heading}] ` : ''}${passage.text}`);
}
const month = expansionMonth();
const monthly = localizedMonthlyReading(mod, sign as never, month.transits);
console.log(`\n===== monthly ${month.month}`);
for (const passage of monthly.passages) console.log(`${passage.heading ? `[${passage.heading}] ` : ''}${passage.text}`);
