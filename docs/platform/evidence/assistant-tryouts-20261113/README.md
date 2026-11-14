# Assistant tryouts, 13 November 2026 (ZOD-207)

200 synthetic questions, asked of two assistants with the Zodiacs connector's tools on offer, to see which tool each
one picks. Start with `REPORT.md`.

| File | What it is |
|---|---|
| `REPORT.md` | What was run, the rates, what changed on this branch, and the calls for Dias |
| `questions.json` | The 200 questions, each with the expected tool (or `none`) and the other first calls accepted |
| `RESULTS.md` | Rates per tool list and model, and per expected tool (generated) |
| `MISSES.md`, `misses.json` | Every miss: question, expected, chosen, model (generated) |
| `runs/*.jsonl` | One line per question per run: the calls the model made in its first turn, with arguments |
| `runs/live-replay.jsonl` | The live connector's answers to calls it rate-limited the first time |
| `LIVE-CALLS.md` | How the live connector answered the calls sent on to it (generated) |
| `raw/live/` | The live server's `initialize` and `tools/list`, fetched 13 November 2026 (0.6.6, 19 tools) |
| `raw/pr971/` | The same two answers from PR 971 at `2d1f90f01` (0.6.7 draft), where this branch started |
| `raw/branch/` | The same two answers from this branch as it stood before the fix round (on PR 971 at `2d1f90f01`) |
| `raw/pr971b/` | The same two answers from PR 971's new head, `989c49537`, pushed while this ran |
| `raw/pr971b-branch-instructions/` | A what-if pairing: the new head's tool list with this branch's instructions. No branch has it |
| `FIX-ROUND.md` | The fix round of 13 November 2026, after Dias's answers: what changed, and the 200 asked again |
| `raw/fix-round/` | The same two answers from this branch after the fix round: joined with PR 971 at `989c49537`, "ask first" back, four published descriptions reworded. `src/ai-tools/tryouts-routing.test.ts` holds the source to it |
| `raw/fix-round-1/` | The fix round's first wording, before two sentences were tightened and the word "crypto" taken out. Its run rows carry `toolSet: fix-round`, the folder's name when they ran |
| `raw/join/` | The same two answers from this branch after `main` was merged in on 14 November 2026 (PR 971 had merged there as `6de2a8fae`). All 19 descriptions are those of `raw/fix-round/`, byte for byte. Two things moved, both main's: `get_horoscope` names the panel `horoscopes-v7`, and the instructions say "birthplace or place name; an occasion card link can hold coordinates rounded to two decimals." where they said "birthplace, coordinates or place name." No questions were run against it by the builder |
| `tools/` | The scripts: `build-questions.py`, `run-tryouts.py`, `stub-mcp.mjs`, `score.py`, `replay-live.py`, `dump-branch-tools.ts`, `live-calls.py` |

To run it again:

```bash
python3 tools/build-questions.py > questions.json
npx vite-node --script docs/platform/evidence/assistant-tryouts-20261113/tools/dump-branch-tools.ts docs/platform/evidence/assistant-tryouts-20261113/raw/branch   # from the repository root
python3 tools/run-tryouts.py --provider openai --model gpt-6.1-sol --tools raw/branch --out runs/branch.gpt-6.1-sol.jsonl
python3 tools/run-tryouts.py --provider claude --model claude-sonnet-5-5 --tools raw/branch --out runs/branch.claude-sonnet-5-5.jsonl
python3 tools/score.py
```

`run-tryouts.py --questions <file>` takes any other question file of the same shape, and skips ids already in `--out`.
The OpenAI run reads `OPENAI_API_KEY` from the environment; the Claude run uses the machine's signed-in Claude Code.
No key is in this folder.
