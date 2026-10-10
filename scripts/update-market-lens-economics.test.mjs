import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function python(program) {
  return JSON.parse(execFileSync('python3', ['-B', '-c', `import importlib.util, json
spec = importlib.util.spec_from_file_location('schedules', 'scripts/update-market-lens-economics.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
${program}`], { encoding: 'utf8' }));
}
describe('official economic schedule refresh', () => {
  it('reads source-provided BLS times and withholds an absent time', () => {
    const rows = python(`text = 'BEGIN:VEVENT\\nSUMMARY:Employment Situation\\nDTSTART;TZID=US-Eastern:20261106T083000\\nUID:employment-nov\\nEND:VEVENT\\nBEGIN:VEVENT\\nSUMMARY:Consumer Price Index\\nUID:missing-time\\nEND:VEVENT'
print(json.dumps(s.extract_bls(text, 2026)))`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'employment', date: '2026-11-06', time: '08:30', sourceKey: 'employment-nov' });
  });
  it('retains a reschedule across later unchanged verifications without mutating old receipts', () => {
    const result = python(`prior = {'id': 'economic:cpi:2026-10-14', 'kind': 'cpi', 'date': '2026-10-14', 'sourceKey': 'cpi-oct', 'at': '2026-10-14T12:30:00.000Z', 'verifiedAt': '2026-10-01T00:00:00.000Z', 'sourceUrl': 'https://www.bls.gov/schedule/news_release/bls.ics', 'revisions': []}
changed = dict(prior, id='economic:cpi:2026-10-15', date='2026-10-15', at='2026-10-15T13:00:00.000Z', status='scheduled', verifiedAt='2026-10-02T00:00:00.000Z')
missing = s.revise([changed], {'events': [prior]}, 2026)
again = dict(changed, status='scheduled')
s.revise([again], {'events': [changed]}, 2026)
print(json.dumps({'changed': changed, 'again': again, 'prior': prior, 'missing': missing}))`);
    expect(result.changed.status).toBe('rescheduled');
    expect(result.again.status).toBe('rescheduled');
    expect(result.again.revisions).toEqual([{ at: '2026-10-14T12:30:00.000Z', verifiedAt: '2026-10-01T00:00:00.000Z' }]);
    expect(result.prior.revisions).toEqual([]);
    expect(result.missing).toEqual([]);
  });
  it('withholds disappeared releases and reports their date as unavailable', () => {
    const result = python(`prior = {'id': 'economic:cpi:2026-10-14', 'kind': 'cpi', 'date': '2026-10-14', 'sourceKey': 'cpi-oct', 'at': '2026-10-14T12:30:00.000Z', 'verifiedAt': '2026-10-01T00:00:00.000Z', 'sourceUrl': 'https://www.bls.gov/schedule/news_release/bls.ics', 'revisions': []}
print(json.dumps(s.revise([], {'events': [prior]}, 2026)))`);
    expect(result).toHaveLength(1); expect(result[0].period).toBe('2026-10-14');
    expect(result[0].reason).toContain('withheld');
  });
});
