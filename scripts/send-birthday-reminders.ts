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
import { birthdayEmail, birthdaysToSend, unsubscribeToken } from '../src/lib/birthday-reminder/core';
import { sendPlainEmail } from '../src/lib/birthday-reminder/send';
import { claimReminder, dueReminders, releaseReminder, sweepExpiredRequests } from '../src/lib/birthday-reminder/store';

const args = process.argv.slice(2);
const dateArg = args.includes('--date') ? args[args.indexOf('--date') + 1] : undefined;
const date = dateArg && /^\d{4}-\d{2}-\d{2}$/u.test(dateArg) ? dateArg : new Date().toISOString().slice(0, 10);
const dryRun = args.includes('--dry-run');

if (!birthdayReminderStorageReady()) {
  console.log('Birthday reminder storage is not configured. Nothing deleted, nothing sent.');
  process.exit(0);
}
// The 48-hour promise holds whether or not reminders are being sent.
const swept = dryRun ? 0 : await sweepExpiredRequests();
console.log(`Birthday reminders: ${dryRun ? 'dry run, no' : swept} expired unconfirmed requests deleted.`);
if (args.includes('--cleanup-only')) process.exit(0);
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
const due = await dueReminders(birthdaysToSend(date));
let sent = 0;
let skipped = 0;
let failed = 0;
for (const reminder of due) {
  if (dryRun) continue;
  // Claimed before sending, so a second or concurrent run, or a stop since the list was read, sends nothing.
  if (!await claimReminder(reminder.id)) { skipped++; continue; }
  const unsubscribeUrl = `${origin}/api/email/birthday-reminder?unsubscribe=${unsubscribeToken(reminder.id, birthdayReminderSecret())}`;
  try {
    await sendPlainEmail(reminder.email, birthdayEmail(origin, unsubscribeUrl, postalAddress), process.env, fetch, { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }, `birthday-reminder/${reminder.id}/${date.slice(0, 4)}`);
    sent++;
  } catch {
    failed++;
    // The next run tries again; the idempotency key keeps Resend from sending twice if this one went out after all.
    await releaseReminder(reminder.id).catch(() => false);
  }
}
console.log(`Birthday reminders for ${date}: ${due.length} due, ${dryRun ? 'dry run, none' : sent} sent, ${skipped} already claimed or stopped, ${failed} failed.`);
if (failed) process.exitCode = 1;
