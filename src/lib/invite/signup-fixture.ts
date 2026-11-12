/** Test settings for the invite signup tests (not a test file itself). */
/** Every setting the invite contract and the daily email's double opt-in need, with the signup switch. */
export const SIGNUP_ENV = {
  PUBLIC_SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  DAILY_EMAIL_ENABLED: '1', EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_api_test', RESEND_CONTACTS_API_KEY: 're_contacts_test',
  RESEND_FROM_EMAIL: 'Zodiacs <daily@zodiacs.org>', EMAIL_CONFIRM_SECRET: 'c'.repeat(32), DAILY_EMAIL_UNSUBSCRIBE_SECRET: 'u'.repeat(32),
  DAILY_EMAIL_RECIPIENT_HASH_SECRET: 'h'.repeat(32), RESEND_DAILY_SEGMENT_ID: 'seg_daily', INVITE_SIGNUP_ENABLED: '1',
};
