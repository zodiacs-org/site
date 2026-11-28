#!/usr/bin/env python3
"""Asks each question once, in a new conversation, with the Zodiacs tools on offer, and records the tools the model
calls in its first turn. Nothing is scored here; see score.py.

  run-tryouts.py --provider claude --model claude-sonnet-5-5 --tools raw/live --out runs/live.claude-sonnet-5-5.jsonl [--forward]

--tools is a folder with tools-list.json and initialize.json (a saved tools/list and initialize result).
--forward sends each call the model makes on to the live connector, read-only, and records how it answered.
openai: no longer runs. The owner has not approved OpenAI API spend (ZOD-207); the OpenAI runs recorded in runs/
are kept as evidence, and `--provider openai` stops (exit 1) before any request is made.
claude: `claude -p` (Claude Code, headless) with no built-in tools, its system prompt replaced, and the tools served
by tools/stub-mcp.mjs over MCP. The first turn only (--max-turns 1).
The system prompt is one line that sets the scene, the date, and the connector's own instructions.
Claude uses the machine's signed-in Claude Code. No key is read or written here. Its environment is built from an
allowlist of names (CHILD_ENV below); no other variable, key or OPENAI_* value is read or passed on. Gateways are not
supported: ANTHROPIC_BASE_URL may be set only to an https URL on the host api.anthropic.com (it is passed on then);
anything else stops the run (exit 1) before any request. Claude Code also reads its managed settings whatever
--setting-sources says (managed-settings.json and every *.json in managed-settings.d, under /etc/claude-code and, on
macOS, /Library/Application Support/ClaudeCode), so the run stops too if any of them sets an ANTHROPIC_BASE_URL that is
not https on api.anthropic.com, or cannot be read. A --provider value containing "openai" (also as --provider=...,
or under an abbreviated flag starting --prov) stops the run before argparse, and flags must be spelled in full.
"""
import argparse, json, os, subprocess, sys, tempfile, time
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
LIVE = 'https://zodiacs.org/mcp'
TODAY = 'Friday 13 November 2026'

def system_prompt(instructions):
    return (f"You are a helpful assistant in a chat app. Today is {TODAY}. The person has connected the Zodiacs connector, "
            f"so its tools are available to you. Use a tool when it helps answer; answer directly when no tool fits.\n\n"
            f"Zodiacs connector instructions: {instructions}")

OPENAI_REFUSAL = ('The OpenAI API is not used: the owner has not approved OpenAI API spend (ZOD-207). '
                  'Use the recorded runs in runs/ instead.')

class LimitStop(Exception): pass

# The only variables the claude child sees. Values are read for these names only.
CHILD_ENV = ('PATH', 'HOME', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR', 'USER', 'CLAUDE_CONFIG_DIR')

def child_environment():
    environment = {name: os.environ[name] for name in CHILD_ENV if name in os.environ}
    # Only reached after refuse_gateway(): if set, it is https on api.anthropic.com.
    if 'ANTHROPIC_BASE_URL' in os.environ: environment['ANTHROPIC_BASE_URL'] = os.environ['ANTHROPIC_BASE_URL']
    environment['ENABLE_TOOL_SEARCH'] = 'false'
    return environment

def ask_claude(args, tools_file, system, question):
    with tempfile.TemporaryDirectory() as work:
        log = os.path.join(work, 'calls.jsonl')
        env = {'TOOLS': tools_file, 'LOG': log, **({'FORWARD': LIVE} if args.forward else {})}
        config = {'mcpServers': {'zodiacs': {'command': 'node', 'args': [os.path.join(HERE, 'stub-mcp.mjs')], 'env': env}}}
        command = ['claude', '-p', question['question'], '--model', args.model, '--system-prompt', system, '--mcp-config', json.dumps(config),
                   '--strict-mcp-config', '--tools', '', '--max-turns', '1', '--output-format', 'stream-json', '--verbose',
                   '--permission-mode', 'bypassPermissions', '--setting-sources', '']
        done = subprocess.run(command, cwd=work, env=child_environment(), capture_output=True, text=True, timeout=300)
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

def refuse_openai(argv):
    # Runs before argparse. Any --provider value naming openai exits 1, whether given as --provider X or
    # --provider=X, or under any token starting --prov (an abbreviation attempt; argparse rejects those anyway).
    # Other arguments, paths included, may contain "openai".
    for i, arg in enumerate(argv):
        if not arg.startswith('--prov'): continue
        if '=' in arg: value = arg.split('=', 1)[1]
        else: value = argv[i + 1] if i + 1 < len(argv) else ''
        if 'openai' in value.lower():
            print(OPENAI_REFUSAL, file=sys.stderr); sys.exit(1)

def is_anthropic_url(value):
    # True only for an https URL whose hostname is exactly api.anthropic.com.
    if not isinstance(value, str): return False
    try:
        url = urlparse(value)
        url.port  # raises ValueError on a malformed port
        return url.scheme == 'https' and url.hostname == 'api.anthropic.com'
    except ValueError:
        return False

def refuse_gateway():
    # Gateways are not supported: Claude Code is only ever pointed at its default host. The value is never printed.
    if 'ANTHROPIC_BASE_URL' in os.environ and not is_anthropic_url(os.environ['ANTHROPIC_BASE_URL']):
        print('ANTHROPIC_BASE_URL is not https on api.anthropic.com; unset it. '
              'Gateways are not supported by this runner (ZOD-207).', file=sys.stderr); sys.exit(1)

# Claude Code loads these even with --setting-sources ''.
MANAGED_ROOTS_LINUX = ('/etc/claude-code',)
MANAGED_ROOTS_MACOS = ('/etc/claude-code', '/Library/Application Support/ClaudeCode')

def managed_settings_files(roots):
    # managed-settings.json, then every *.json in managed-settings.d, under each root. Listing only, no reads.
    files = []
    for root in roots:
        files.append(os.path.join(root, 'managed-settings.json'))
        drop_ins = os.path.join(root, 'managed-settings.d')
        if os.path.isdir(drop_ins):
            files += sorted(os.path.join(drop_ins, name) for name in os.listdir(drop_ins) if name.endswith('.json'))
    return [path for path in files if os.path.exists(path)]

def refuse_managed_gateway(roots=None):
    # roots is for tests only; by default the platform's real managed settings locations are checked.
    # Only the check's result and the file path are ever printed, never a value from a file.
    if roots is None: roots = MANAGED_ROOTS_MACOS if sys.platform == 'darwin' else MANAGED_ROOTS_LINUX
    try:
        paths = managed_settings_files(roots)
    except OSError:
        print('The managed settings folders could not be listed; the run stops (ZOD-207).', file=sys.stderr); sys.exit(1)
    for path in paths:
        try:
            with open(path) as f: settings = json.load(f)
            if not isinstance(settings, dict): raise ValueError
            env = settings.get('env')
            if env is None: env = {}
            if not isinstance(env, dict): raise ValueError
            ok = 'ANTHROPIC_BASE_URL' not in env or is_anthropic_url(env['ANTHROPIC_BASE_URL'])
        except Exception:
            print(f'{path} could not be read as settings; the run stops (ZOD-207).', file=sys.stderr); sys.exit(1)
        if not ok:
            print(f'{path} sets ANTHROPIC_BASE_URL to something other than https on api.anthropic.com. '
                  'Gateways are not supported by this runner (ZOD-207).', file=sys.stderr); sys.exit(1)

def main():
    refuse_openai(sys.argv[1:])
    refuse_gateway()
    refuse_managed_gateway()
    parser = argparse.ArgumentParser(allow_abbrev=False)
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
    if args.provider == 'openai': print(OPENAI_REFUSAL, file=sys.stderr); sys.exit(1)
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
            result = ask_claude(args, tools_file, system, question)
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
