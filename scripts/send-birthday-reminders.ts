/**
 * The birthday reminder's daily send: the confirmed reminders whose birthday
 * is today (UTC; 29 February birthdays on 28 February in other years), one
 * email each, at most once a year. Deletes unconfirmed requests older than 48
 * hours on the way. Prints counts only, never an address.
 *
 * Runs only with BIRTHDAY_REMINDER_ENABLED=1 and its configuration; the
 * workflow (.github/workflows/birthday-reminders.yml) runs it only where the
 * repository variable BIRTHDAY_REMINDERS_SENDING is '1'. Both are off.
 *
 *   npx vite-node --script scripts/send-birthday-reminders.ts [--date YYYY-MM-DD] [--dry-run]
 */
import { birthdayReminderEnabled, birthdayReminderSecret } from '../src/lib/birthday-reminder/config';
import { birthdayEmail, birthdaysOn, unsubscribeToken } from '../src/lib/birthday-reminder/core';
import { sendPlainEmail } from '../src/lib/birthday-reminder/send';
import { dueReminders, markReminderSent } from '../src/lib/birthday-reminder/store';

const args = process.argv.slice(2);
const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : undefined;
const date = dateArg && /^\d{4}-\d{2}-\d{2}$/u.test(dateArg) ? dateArg : new Date().toISOString().slice(0, 10);
const dryRun = args.includes('--dry-run');

if (!birthdayReminderEnabled()) {
  console.log('Birthday reminders are off (BIRTHDAY_REMINDER_ENABLED is not 1, or storage, sending or the secret is missing). Nothing sent.');
  process.exit(0);
}
const origin = 'https://zodiacs.org';
const due = await dueReminders(birthdaysOn(date));
let sent = 0;
let failed = 0;
for (const reminder of due) {
  if (dryRun) continue;
  const unsubscribeUrl = `${origin}/api/email/birthday-reminder?unsubscribe=${unsubscribeToken(reminder.id, birthdayReminderSecret())}`;
  try {
    await sendPlainEmail(reminder.email, birthdayEmail(origin, unsubscribeUrl), process.env, fetch, { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
    await markReminderSent(reminder.id);
    sent++;
  } catch { failed++; }
}
console.log(`Birthday reminders for ${date}: ${due.length} due, ${dryRun ? 'dry run, none' : sent} sent, ${failed} failed.`);
if (failed) process.exitCode = 1;
