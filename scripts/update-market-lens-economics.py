#!/usr/bin/env python3
"""Read public official schedules only; no credentials or personal inputs.

Run manually when verifying schedules. Build uses the checked-in snapshot.
Failed months are recorded as unavailable, never filled with customary times.
"""
import argparse, datetime, hashlib, html, json, re, subprocess
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

def clean(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', value))).strip()

def retrieve(url):
    result = subprocess.run(['curl', '-fsSL', '--max-time', '30', url], capture_output=True)
    if result.returncode:
        return None
    return result.stdout.decode('utf-8-sig')

def extract_bls(text, year):
    rows = []
    for block in re.findall(r'BEGIN:VEVENT\s*(.*?)END:VEVENT', text, re.S):
        fields = dict(line.split(':', 1) for line in block.splitlines() if ':' in line)
        title = fields.get('SUMMARY')
        if title not in ['Consumer Price Index', 'Employment Situation']:
            continue
        start = fields.get('DTSTART;TZID=US-Eastern', '')
        if not re.fullmatch(str(year) + r'\d{4}T\d{6}', start):
            continue
        date = datetime.datetime.strptime(start, '%Y%m%dT%H%M%S')
        rows.append({'kind': 'cpi' if title == 'Consumer Price Index' else 'employment', 'title': 'US ' + title, 'date': date.strftime('%Y-%m-%d'), 'time': date.strftime('%H:%M'), 'sourceKey': fields['UID'], 'excerpt': block.strip()})
    return rows

def extract_fed(text, year, month):
    rows = []
    for block in text.split('<div class="panel-body">')[1:]:
        cols = {}
        for width in [2, 7, 3]:
            match = re.search(r'<div class="col-xs-' + str(width) + r'">(.*?)</div>', block, re.S)
            cols[width] = clean(match.group(1)) if match else ''
        kind = 'fomc-decision' if cols[7].startswith('FOMC Meeting') else 'fomc-press-conference' if cols[7].startswith('FOMC Press Conference') else None
        if kind is None:
            continue
        match = re.fullmatch(r'(\d{1,2}):(\d{2}) ([ap])\.m\.', cols[2])
        if not match or not re.fullmatch(r'\d{1,2}', cols[3]):
            raise ValueError('Unsupported official Fed date/time: ' + str(cols))
        hour = int(match[1]) % 12 + (12 if match[3] == 'p' else 0)
        rows.append({'kind': kind, 'title': 'FOMC decision' if kind == 'fomc-decision' else 'FOMC press conference', 'date': f'{year}-{month:02d}-{int(cols[3]):02d}', 'time': f'{hour:02d}:{match[2]}', 'sourceKey': f'{year}-{month:02d}-{cols[3]}:{kind}', 'excerpt': f'{cols[2]} | {cols[7]} | Day {cols[3]}'})
    return rows

def revise(rows, previous, year):
    unavailable = []
    for row in rows:
        prior = next((old for old in previous['events'] if old.get('sourceKey') == row['sourceKey'] and old['kind'] == row['kind']), None)
        if prior:
            row['revisions'] = list(prior.get('revisions', []))
            if prior['at'] != row['at']:
                row['revisions'].append({'at': prior['at'], 'verifiedAt': prior['verifiedAt']})
            if row['revisions']:
                row['status'] = 'rescheduled'
    for prior in previous['events']:
        if prior['date'].startswith(str(year)) and not any(row['sourceKey'] == prior.get('sourceKey') and row['kind'] == prior['kind'] for row in rows):
            unavailable.append({'provider': 'prior event', 'period': prior['date'], 'sourceUrl': prior['sourceUrl'], 'reason': 'Previously published event absent in refreshed sources; previous time is withheld pending verification.'})
    return unavailable

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--year', type=int, default=2026)
    args = parser.parse_args()
    year = args.year
    verified = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    sources, rows, unavailable = [], [], []
    urls = [('bls', f'https://www.bls.gov/schedule/news_release/bls.ics', 0)] + [('fed', f'https://www.federalreserve.gov/newsevents/{year}-{month}.htm', i + 1) for i, month in enumerate(MONTHS)]
    for provider, url, month in urls:
        text = retrieve(url)
        if text is None:
            unavailable.append({'provider': provider, 'period': f'{year}-{month:02d}' if month else str(year), 'sourceUrl': url, 'reason': 'Official source retrieval failed; exact schedule not inferred.'})
            continue
        digest = hashlib.sha256(text.encode()).hexdigest()
        sources.append({'url': url, 'sha256': digest, 'verifiedAt': verified})
        extracted = extract_bls(text, year) if provider == 'bls' else extract_fed(text, year, month)
        for row in extracted:
            local = datetime.datetime.fromisoformat(row['date'] + 'T' + row['time']).replace(tzinfo=ZoneInfo('America/New_York'))
            row.update({'id': f'economic:{row["kind"]}:{row["date"]}', 'at': local.astimezone(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'), 'timeZone': 'America/New_York', 'sourceUrl': url, 'sourceSha256': digest, 'verifiedAt': verified, 'status': 'scheduled', 'revisions': []})
            rows.append(row)
    target = ROOT / 'public/data/market-lens/economics.json'
    previous = json.loads(target.read_text()) if target.exists() else {'events': []}
    unavailable.extend(revise(rows, previous, year))
    snapshot = {'schema': 1, 'verifiedAt': verified, 'coverage': {'start': f'{year}-01-01', 'endExclusive': f'{year+1}-01-01'}, 'staleAfterDays': 7, 'timeZone': 'America/New_York', 'sources': sources, 'events': sorted(rows, key=lambda row: row['at']), 'unavailable': unavailable, 'limitations': ['Schedule snapshot, not a live release feed. Verify the official source before a session.', 'Fed calendar times are read in US Eastern; DST is resolved with America/New_York.', 'No consensus, release values, surprise scores or unscheduled events. Missing months and later years are unavailable.']}
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(snapshot, indent=2) + '\n')
    print(f'{len(rows)} official events; {len(unavailable)} unavailable source periods; verified {verified}')

if __name__ == '__main__':
    main()
