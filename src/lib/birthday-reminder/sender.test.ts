import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalArgv = process.argv;
const run = () => import('../../../scripts/send-birthday-reminders');

describe('the birthday reminder sender', () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries({
      BIRTHDAY_REMINDER_ENABLED: '1',
      PUBLIC_BIRTHDAY_REMINDER_ENABLED: '1',
      PUBLIC_YEAR_SCORE_ENABLED: '1',
      PUBLIC_SUPABASE_URL: 'https://storage.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'test',
      BIRTHDAY_REMINDER_SECRET: 'x'.repeat(32),
      RESEND_API_KEY: 'test',
      RESEND_FROM_EMAIL: 'sender@example.invalid',
      DAILY_EMAIL_POSTAL_ADDRESS: ' ',
    })) vi.stubEnv(key, value);
    process.argv = [originalArgv[0], 'send-birthday-reminders.ts', '--date', '2027-03-01'];
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('stops after cleanup when the sending switch is unset', async () => {
    vi.stubEnv('BIRTHDAY_REMINDERS_SENDING', undefined);
    vi.stubEnv('DAILY_EMAIL_POSTAL_ADDRESS', 'Test postal address');
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(0));
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('sender exited'); });

    await expect(run()).rejects.toThrow('sender exited');
    expect(process.exit).toHaveBeenCalledWith(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://storage.invalid/rest/v1/rpc/birthday_reminders_sweep');
  });

  it('exits non-zero before looking up recipients when the postal address is missing', async () => {
    vi.stubEnv('BIRTHDAY_REMINDERS_SENDING', '1');
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(0));
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('sender exited'); });

    await expect(run()).rejects.toThrow('sender exited');
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('DAILY_EMAIL_POSTAL_ADDRESS'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://storage.invalid/rest/v1/rpc/birthday_reminders_sweep');
  });

  it('allows a dry run without a postal address, reads the catch-up list once and logs counts only', async () => {
    process.argv.push('--dry-run');
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json([
      { id: '0f8fad5b-d9cb-469f-a165-70867728950e', email: 'reader@example.invalid', month: 2, day: 29 },
    ]));
    vi.stubGlobal('fetch', fetcher);

    await run();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [[url, init]] = fetcher.mock.calls;
    expect(url).toBe('https://storage.invalid/rest/v1/rpc/birthday_reminders_due');
    expect(JSON.parse(init.body)).toEqual({ p_days: [
      { month: 2, day: 28 }, { month: 2, day: 29 }, { month: 3, day: 1 },
    ] });
    expect(vi.mocked(console.log).mock.calls).toEqual([
      ['Birthday reminders: dry run, no expired unconfirmed requests deleted.'],
      ['Birthday reminders: 1 due, dry run, none sent, 0 already claimed or stopped, 0 failed.'],
    ]);
    expect(console.error).not.toHaveBeenCalled();
  });
});
