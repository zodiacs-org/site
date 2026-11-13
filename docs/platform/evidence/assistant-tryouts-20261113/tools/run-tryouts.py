#!/usr/bin/env python3
"""Asks each question once, in a new conversation, with the Zodiacs tools on offer, and records the tools the model
calls in its first turn. Nothing is scored here; see score.py.

  run-tryouts.py --provider openai --model gpt-6.1-sol --tools raw/live --out runs/live.gpt-6.1-sol.jsonl [--forward]
  run-tryouts.py --provider claude --model claude-sonnet-5-5 --tools raw/live --out runs/live.claude-sonnet-5-5.jsonl [--forward]

--tools is a folder with tools-list.json and initialize.json (a saved tools/list and initialize result).
--forward sends each call the model makes on to the live connector, read-only, and records how it answered.
openai: the Responses API, each tool offered as a function with its name, description and input schema.
claude: `claude -p` (Claude Code, headless) with no built-in tools, its system prompt replaced, and the tools served
by tools/stub-mcp.mjs over MCP. The first turn only (--max-turns 1).
Both get the same system prompt: one line that sets the scene, the date, and the connector's own instructions.
The OpenAI key is read from OPENAI_API_KEY; Claude uses the machine's signed-in Claude Code. No key is written anywhere.
"""
import argparse, json, os, subprocess, sys, tempfile, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
LIVE = 'https://zodiacs.org/mcp'
TODAY = 'Friday 13 November 2026'

def system_prompt(instructions):
    return (f"You are a helpful assistant in a chat app. Today is {TODAY}. The person has connected the Zodiacs connector, "
            f"so its tools are available to you. Use a tool when it helps answer; answer directly when no tool fits.\n\n"
            f"Zodiacs connector instructions: {instructions}")

class LimitStop(Exception): pass

def post(url, body, headers, timeout=180):
    request = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', **headers})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode(), response.headers.get('content-type', '')
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode(), error.headers.get('content-type', '')

def live_call(name, arguments):
    status, text, kind = post(LIVE, {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call', 'params': {'name': name, 'arguments': arguments}},
                              {'Accept': 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18'})
    try:
        body = json.loads(next(line for line in text.split('\n') if line.startswith('data: '))[6:] if 'event-stream' in kind else text)
        result = body.get('result') or {}
        structured = result.get('structuredContent') or {}
        return {'status': status, 'isError': result.get('isError', 'error' in body), 'ok': structured.get('ok'),
                'error': (body.get('error') or {}).get('message') or (structured.get('error') or {}).get('code')}
    except Exception as error:
        return {'status': status, 'failed': str(error)[:200]}

def ask_openai(args, tools, system, question):
    body = {'model': args.model, 'instructions': system, 'input': question['question'], 'store': False,
            'tools': [{'type': 'function', 'name': t['name'], 'description': t['description'], 'parameters': t['inputSchema'], 'strict': False} for t in tools]}
    for attempt in range(4):
        status, text, _ = post('https://api.openai.com/v1/responses', body, {'Authorization': f"Bearer {os.environ['OPENAI_API_KEY']}"})
        if status == 200: break
        if status == 429 and 'insufficient_quota' in text: raise LimitStop(text[:300])
        time.sleep(5 * (attempt + 1))
    else:
        return {'error': f'HTTP {status}: {text[:300]}'}
    reply = json.loads(text)
    calls = [{'name': item['name'], 'arguments': json.loads(item.get('arguments') or '{}')} for item in reply['output'] if item['type'] == 'function_call']
    said = ''.join(part.get('text', '') for item in reply['output'] if item['type'] == 'message' for part in item.get('content', []))
    if args.forward:
        for call in calls: call['live'] = live_call(call['name'], call['arguments'])
    return {'modelReported': reply.get('model'), 'calls': calls, 'text': said[:600]}

def ask_claude(args, tools_file, system, question):
    with tempfile.TemporaryDirectory() as work:
        log = os.path.join(work, 'calls.jsonl')
        env = {'TOOLS': tools_file, 'LOG': log, **({'FORWARD': LIVE} if args.forward else {})}
        config = {'mcpServers': {'zodiacs': {'command': 'node', 'args': [os.path.join(HERE, 'stub-mcp.mjs')], 'env': env}}}
        command = ['claude', '-p', question['question'], '--model', args.model, '--system-prompt', system, '--mcp-config', json.dumps(config),
                   '--strict-mcp-config', '--tools', '', '--max-turns', '1', '--output-format', 'stream-json', '--verbose',
                   '--permission-mode', 'bypassPermissions', '--setting-sources', '']
        environment = {k: v for k, v in os.environ.items() if k != 'ANTHROPIC_API_KEY'}
        environment['ENABLE_TOOL_SEARCH'] = 'false'
        done = subprocess.run(command, cwd=work, env=environment, capture_output=True, text=True, timeout=300)
        out = done.stdout
        if 'model_requires_usage_credits' in out or '"api_error_status":429' in out.replace(' ', ''):
            raise LimitStop(out[-600:])
        calls, text, model, offered = [], '', None, None
        for line in out.splitlines():
            try: event = json.loads(line)
            except ValueError: continue
            if event.get('type') == 'system' and event.get('subtype') == 'init':
                offered = len([t for t in event.get('tools', []) if t.startswith('mcp__zodiacs__')])
                other = [t for t in event.get('tools', []) if not t.startswith('mcp__zodiacs__')]
                model = event.get('model')
            if event.get('type') == 'assistant':
                for block in event['message'].get('content', []):
                    if block.get('type') == 'tool_use': calls.append({'name': block['name'].replace('mcp__zodiacs__', ''), 'arguments': block.get('input', {})})
                    if block.get('type') == 'text': text += block['text']
        if offered is None: return {'error': (out[-300:] + done.stderr[-300:])}
        if offered != len(json.load(open(tools_file))['tools']): return {'error': f'the stub offered {offered} tools; not recorded, ask again'}
        if args.forward and os.path.exists(log):
            live = [json.loads(line) for line in open(log)]
            for call, record in zip(calls, live): call['live'] = record.get('live')
        return {'modelReported': model, 'toolsOffered': offered, 'otherTools': other, 'calls': calls, 'text': text[:600]}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--provider', required=True, choices=['openai', 'claude'])
    parser.add_argument('--model', required=True)
    parser.add_argument('--tools', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--questions', default=os.path.join(HERE, '..', 'questions.json'))
    parser.add_argument('--forward', action='store_true')
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--only', default='')
    parser.add_argument('--without-instructions', action='store_true', help='leave the connector instructions out of the system prompt')
    args = parser.parse_args()
    tools_file = os.path.abspath(os.path.join(args.tools, 'tools-list.json'))
    tools = json.load(open(tools_file))['tools']
    system = system_prompt(json.load(open(os.path.join(args.tools, 'initialize.json')))['instructions'])
    if args.without_instructions: system = system.split('\n\nZodiacs connector instructions:')[0]
    questions = json.load(open(args.questions))
    if args.only: questions = [q for q in questions if q['id'] in args.only.split(',')]
    done = {json.loads(line)['id'] for line in open(args.out)} if os.path.exists(args.out) else set()
    todo = [q for q in questions if q['id'] not in done]
    def one(question):
        try:
            result = ask_openai(args, tools, system, question) if args.provider == 'openai' else ask_claude(args, tools_file, system, question)
        except LimitStop: raise
        except Exception as error: result = {'error': str(error)[:300]}
        return {'id': question['id'], 'question': question['question'], 'provider': args.provider, 'model': args.model,
                'toolSet': os.path.basename(os.path.normpath(args.tools)), 'forwardedToLive': args.forward, 'instructionsGiven': not args.without_instructions, 'at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), **result}
    with ThreadPoolExecutor(args.workers) as pool, open(args.out, 'a') as out:
        for row in pool.map(one, todo):
            if 'error' in row: print('ERROR', row['id'], row['error'], file=sys.stderr); continue
            out.write(json.dumps(row, ensure_ascii=False) + '\n'); out.flush()
    print(args.out, sum(1 for _ in open(args.out)), 'rows')

if __name__ == '__main__':
    main()
