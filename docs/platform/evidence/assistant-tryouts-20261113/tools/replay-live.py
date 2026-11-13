#!/usr/bin/env python3
"""Sends again, slowly, each call from the live runs that the live connector did not answer the first time (it was
rate-limited, or the network dropped), and records how it answered in runs/live-replay.jsonl. Read-only.
Run: python3 tools/replay-live.py"""
import json, os, sys, time, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
run = __import__('run-tryouts')
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
out_path = os.path.join(ROOT, 'runs', 'live-replay.jsonl')
done = {(r['id'], r['model'], r['index']) for r in map(json.loads, open(out_path))} if os.path.exists(out_path) else set()
todo = []
for path in sorted(glob.glob(os.path.join(ROOT, 'runs', 'live.*.jsonl'))):
    for row in map(json.loads, open(path)):
        for index, call in enumerate(row['calls']):
            live = call.get('live') or {}
            if live.get('status') == 429 or live.get('error') == 'rate-limited' or 'failed' in live:
                if (row['id'], row['model'], index) not in done: todo.append((row, index, call))
print(len(todo), 'calls to send again')
with open(out_path, 'a') as out:
    for row, index, call in todo:
        for attempt in range(4):
            answer = run.live_call(call['name'], call['arguments'])
            if answer.get('status') != 429 and answer.get('error') != 'rate-limited' and 'failed' not in answer: break
            time.sleep(70)
        out.write(json.dumps({'id': row['id'], 'model': row['model'], 'index': index, 'name': call['name'], 'arguments': call['arguments'], 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'live': answer}, ensure_ascii=False) + '\n'); out.flush()
        time.sleep(4)
