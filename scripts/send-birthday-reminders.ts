/**
 * The birthday reminder's daily send: the confirmed reminders whose birthday
 * is today or was yesterday (UTC; 29 February birthdays on 28 February in
 * other years), one email each, at most once a year. Yesterday's are asked for
 * again so a skipped run is caught up a day late, not a year late. The
 * workflow runs at 10:07 UTC, when the UTC date is the local date from UTC-10
 * to UTC+13. Every email ends with DAILY_EMAIL_POSTAL_ADDRESS, the daily
 * email's postal address: a run that would send exits non-zero without it.
 * Deletes unconfirmed requests older than 48 hours first, whenever storage
 * and the secret are configured, even with the reminder switched off;
 * --cleanup-only stops there. Prints counts only, never an address.
 *
 * Runs only with BIRTHDAY_REMINDER_ENABLED=1, PUBLIC_BIRTHDAY_REMINDER_ENABLED=1,
 * PUBLIC_YEAR_SCORE_ENABLED=1 and its configuration; the workflow
 * (.github/workflows/birthday-reminders.yml) runs it only where the repository
 * variable BIRTHDAY_REMINDERS_SENDING is '1', and reads the other three from
 * repository variables of the same names. All are off.
 *
 *   npx vite-node --script scripts/send-birthday-reminders.ts [--date YYYY-MM-DD] [--dry-run] [--cleanup-only]
 */
import { birthdayReminderEnabled, birthdayReminderSecret, birthdayReminderStorageReady } from '../src/lib/birthday-reminder/config';
import { birthdayEmail, birthdayEmailKey, birthdaysToSend, unsubscribeToken } from '../src/lib/birthday-reminder/core';
import { BirthdayEmailRejectedError, sendPlainEmail } from '../src/lib/birthday-reminder/send';
import { claimReminder, completeReminder, dispatchReminder, dueReminders, releaseReminder, sweepExpiredRequests } from '../src/lib/birthday-reminder/store';
import { ResendRequestWithdrawnError } from '../src/lib/daily-email/resend-request';

const args = process.argv.slice(2);
const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : undefined;
const date = dateArg && /^\d{4}-\d{2}-\d{2}$/u.test(dateArg) ? dateArg : new Date().toISOString().slice(0, 10);
const dryRun = args.includes('--dry-run');

if (!birthdayReminderStorageReady()) {
  console.log('Birthday reminder storage is not configured. Nothing deleted, nothing sent.');
  process.exit(0);
}
// Sweep expired requests before checking whether sending is enabled.
const swept = dryRun ? 0 : await sweepExpiredRequests();
console.log(`Birthday reminders: ${dryRun ? 'dry run, no' : swept} expired unconfirmed requests deleted.`);
if (args.includes('--cleanup-only')) process.exit(0);
if (!dryRun && process.env.BIRTHDAY_REMINDERS_SENDING !== '1') {
  console.log('Birthday reminder sending is off. Nothing sent.');
  process.exit(0);
}
if (!birthdayReminderEnabled()) {
  console.log('Birthday reminders are off (BIRTHDAY_REMINDER_ENABLED or a public switch it needs is not 1, or storage, sending or the secret is missing). Nothing sent.');
  process.exit(0);
}
// The same rule as the daily email: a live send carries the sender's postal address or does not go out.
const postalAddress = (process.env.DAILY_EMAIL_POSTAL_ADDRESS ?? '').trim();
if (!postalAddress && !dryRun) {
  console.error('DAILY_EMAIL_POSTAL_ADDRESS is required when sending. Nothing sent.');
  process.exit(1);
}
const origin = 'https://zodiacs.org';
const birthdays = birthdaysToSend(date);
const due = await dueReminders(birthdays);
let sent = 0;
let skipped = 0;
let failed = 0;
for (const reminder of due) {
  if (dryRun) continue;
  const occurrence = birthdays.find(({ month, day }) => month === reminder.month && day === reminder.day);
  if (!occurrence) throw new Error('Reminder does not match the requested days.');
  const claim = await claimReminder(reminder.id);
  if (!claim) { skipped++; continue; }
  const unsubscribeUrl = `${origin}/api/email/birthday-reminder?unsubscribe=${unsubscribeToken(reminder.id, birthdayReminderSecret())}`;
  try {
    await sendPlainEmail(reminder.email, birthdayEmail(origin, unsubscribeUrl, postalAddress), process.env, fetch,
      { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      birthdayEmailKey(reminder.id, date, reminder.month, reminder.day),
      (hash) => dispatchReminder(reminder.id, claim, occurrence.on, hash));
    if (!await completeReminder(reminder.id, claim)) throw new Error('Birthday reminder completion was not recorded.');
    sent++;
  } catch (error) {
    if (error instanceof ResendRequestWithdrawnError) skipped++;
    else failed++;
    await releaseReminder(reminder.id, claim, error instanceof BirthdayEmailRejectedError).catch(() => false);
  }
}
console.log(`Birthday reminders: ${due.length} due, ${dryRun ? 'dry run, none' : sent} sent, ${skipped} already claimed or stopped, ${failed} failed.`);
if (failed) process.exitCode = 1;
